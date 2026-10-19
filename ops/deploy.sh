#!/usr/bin/env bash
# Deploie une version d'ASL-CMS sur le serveur (ADR 036, s12b).
#
#   sudo ops/deploy.sh <branche|tag|commit>
#
# 1. met a jour le miroir du depot (/srv/asl-cms/repo.git) ;
# 2. prepare /srv/asl-cms/releases/<commit> : clone, lien vers
#    shared/.env.production, .next/cache lie vers shared/next-cache/<commit>,
#    pnpm install --frozen-lockfile ;
# 3. delegue a l'orchestrateur (scripts/ops/deploy-release.ts) : build,
#    migrations, controle du role, bascule du lien current, redemarrage,
#    verification. Une etape en echec avant la bascule laisse la version
#    precedente en service.
#
# A lancer en root (sudo) : les commandes du depot tournent sous l'utilisateur
# asl-cms, seul le redemarrage du service demande root.
set -euo pipefail

APP_ROOT=/srv/asl-cms
APP_USER=asl-cms
MIRROR="$APP_ROOT/repo.git"
ENV_FILE="$APP_ROOT/shared/.env.production"

ref="${1:-}"
if [[ -z "$ref" ]]; then
  echo "Usage : sudo $0 <branche|tag|commit>" >&2
  exit 2
fi
if [[ "$(id -u)" -ne 0 ]]; then
  echo "A lancer en root : sudo $0 $ref" >&2
  exit 2
fi
if [[ ! -d "$MIRROR" ]]; then
  echo "Miroir absent : $MIRROR (voir docs/exploitation/README.md, Preparation)" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier d'environnement absent : $ENV_FILE" >&2
  exit 1
fi

as_app() {
  runuser -u "$APP_USER" -- "$@"
}

# Le repertoire courant herite de sudo (souvent le dossier personnel de
# l'administrateur, ferme aux autres) : asl-cms ne pourrait pas y lire.
cd "$APP_ROOT"

echo "[deploy] Mise a jour du miroir"
as_app git -C "$MIRROR" fetch --prune --quiet origin '+refs/heads/*:refs/heads/*' '+refs/tags/*:refs/tags/*'

commit="$(as_app git -C "$MIRROR" rev-parse --verify --quiet "${ref}^{commit}" || true)"
if [[ -z "$commit" ]]; then
  echo "Reference inconnue : $ref" >&2
  exit 1
fi
short="${commit:0:12}"
release="$APP_ROOT/releases/$short"
cache_dir="$APP_ROOT/shared/next-cache/$short"
current="$(readlink "$APP_ROOT/current" || true)"
previous="$(readlink "$APP_ROOT/previous" || true)"

if [[ "$current" == "$release" ]]; then
  echo "Le commit $short est deja en service ($release) : rien a deployer." >&2
  exit 1
fi
# Reconstruire la cible du retour arriere la laisserait a moitie construite si
# le build echouait : rollback.sh n'aurait plus de version saine a remettre.
if [[ "$previous" == "$release" ]]; then
  echo "Le commit $short est la version du retour arriere ($APP_ROOT/previous) :" >&2
  echo "pour la remettre en service sans la reconstruire : sudo ops/rollback.sh" >&2
  exit 1
fi
if [[ -e "$release" ]]; then
  echo "[deploy] Version $short deja presente sans etre en service : reconstruction"
  rm -rf "$release" "$cache_dir"
fi

echo "[deploy] Preparation de $release"
as_app git clone --quiet "$MIRROR" "$release"
as_app git -C "$release" checkout --quiet --detach "$commit"
as_app ln -s "$ENV_FILE" "$release/.env.production"
# Le service ne peut ecrire que dans shared/ (asl-cms.service) : le cache de
# Next (images optimisees, ISR) y vit, une copie par version. next build garde
# .next/cache quand il vide .next.
as_app mkdir -p "$cache_dir" "$release/.next"
as_app ln -s "$cache_dir" "$release/.next/cache"
# Sans NODE_ENV=production : l'installation garde les devDependencies (tsx,
# drizzle-kit) dont les scripts d'exploitation ont besoin. HUSKY=0 : pas de
# hooks git sur le serveur.
(cd "$release" && as_app env -u NODE_ENV HUSKY=0 pnpm install --frozen-lockfile)

echo "[deploy] Orchestrateur"
cd "$release"
exec pnpm --silent ops:deploy-release -- "$release"
