#!/usr/bin/env bash
# Retour arriere (ADR 036, s12b) : refait pointer /srv/asl-cms/current vers
# une version precedente, conservee sur le disque, puis relance le service et
# verifie qu'il repond.
#
#   sudo ops/rollback.sh                       # version servie avant celle en service
#   sudo ops/rollback.sh <commit court>        # version choisie dans releases/
#
# Sans argument, la cible est le lien /srv/asl-cms/previous, ecrit par
# l'orchestrateur apres chaque deploiement reussi : c'est toujours une version
# qui a ete servie, jamais une version construite puis abandonnee (migration
# en echec, par exemple). Apres la bascule, `previous` designe la version
# quittee : relancer le script sans argument y revient.
#
# Les migrations ne sont pas annulees : Drizzle n'ecrit pas de migration
# descendante. L'ancienne version tourne alors sur le schema migre (ADR 036,
# consequences) ; la sauvegarde de s12c couvre le cas ou ca ne suffit pas.
set -euo pipefail

APP_ROOT=/srv/asl-cms
SERVICE=asl-cms
LOCAL_URL=http://127.0.0.1:3100/
VERIFY_ATTEMPTS=30
VERIFY_DELAY_SECONDS=2

if [[ "$(id -u)" -ne 0 ]]; then
  echo "A lancer en root : sudo $0 $*" >&2
  exit 2
fi

current="$(readlink "$APP_ROOT/current" || true)"

if [[ -n "${1:-}" ]]; then
  target="$APP_ROOT/releases/$1"
else
  target="$(readlink "$APP_ROOT/previous" || true)"
  if [[ -z "$target" ]]; then
    echo "Aucune version precedente retenue ($APP_ROOT/previous absent) :" >&2
    echo "preciser la version, par exemple : sudo $0 <commit court>" >&2
    exit 1
  fi
fi

# BUILD_ID est ecrit a la fin de next build : sans lui, le build a ete
# interrompu (.next existe des son debut).
if [[ ! -f "$target/.next/BUILD_ID" ]]; then
  echo "Aucune version entierement construite a restaurer ($target)." >&2
  exit 1
fi
if [[ "$target" == "$current" ]]; then
  echo "$target est deja en service." >&2
  exit 1
fi

echo "[rollback] $current -> $target"
ln -sfn "$target" "$APP_ROOT/current.next"
mv -T "$APP_ROOT/current.next" "$APP_ROOT/current"
if [[ -n "$current" ]]; then
  ln -sfn "$current" "$APP_ROOT/previous.next"
  mv -T "$APP_ROOT/previous.next" "$APP_ROOT/previous"
fi
systemctl restart "$SERVICE"

# Meme verification que l'orchestrateur : tout statut HTTP < 500.
for ((attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++)); do
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$LOCAL_URL" || true)"
  if [[ "$status" =~ ^[1-4][0-9][0-9]$ ]]; then
    echo "[rollback] $LOCAL_URL repond $status"
    echo "[rollback] Service relance sur $target"
    exit 0
  fi
  echo "[rollback] $LOCAL_URL repond ${status:-rien} (essai $attempt)" >&2
  sleep "$VERIFY_DELAY_SECONDS"
done

echo "[rollback] $LOCAL_URL ne repond pas apres $VERIFY_ATTEMPTS essais :" >&2
echo "consulter le journal du service : sudo journalctl -u $SERVICE -n 100" >&2
exit 1
