#!/usr/bin/env bash
# Retour arriere (ADR 036, s12b) : refait pointer /srv/asl-cms/current vers
# une version precedente, conservee sur le disque, puis relance le service.
#
#   sudo ops/rollback.sh                       # version la plus recente hors celle en service
#   sudo ops/rollback.sh <commit court>        # version choisie dans releases/
#
# Les migrations ne sont pas annulees : Drizzle n'ecrit pas de migration
# descendante. L'ancienne version tourne alors sur le schema migre (ADR 036,
# consequences) ; la sauvegarde de s12c couvre le cas ou ca ne suffit pas.
set -euo pipefail

APP_ROOT=/srv/asl-cms
SERVICE=asl-cms

if [[ "$(id -u)" -ne 0 ]]; then
  echo "A lancer en root : sudo $0 $*" >&2
  exit 2
fi

current="$(readlink "$APP_ROOT/current" || true)"

if [[ -n "${1:-}" ]]; then
  target="$APP_ROOT/releases/$1"
else
  target=""
  while IFS= read -r candidate; do
    candidate="${candidate%/}"
    if [[ "$candidate" != "$current" ]]; then
      target="$candidate"
      break
    fi
  done < <(ls -1dt "$APP_ROOT"/releases/*/ 2>/dev/null)
fi

if [[ -z "$target" || ! -d "$target/.next" ]]; then
  echo "Aucune version construite a restaurer (${target:-aucune})." >&2
  exit 1
fi
if [[ "$target" == "$current" ]]; then
  echo "$target est deja en service." >&2
  exit 1
fi

echo "[rollback] $current -> $target"
ln -sfn "$target" "$APP_ROOT/current.next"
mv -T "$APP_ROOT/current.next" "$APP_ROOT/current"
systemctl restart "$SERVICE"
echo "[rollback] Service relance sur $target"
