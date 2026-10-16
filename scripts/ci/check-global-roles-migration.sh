#!/usr/bin/env bash
# Contrôles de s47 (ADR 035) pour le job CI « migrations sur la base de main ».
#
#   check-global-roles-migration.sh before   photo de la base au seed de main
#   check-global-roles-migration.sh after    contrôles, après les migrations
#                                            de la branche
#
# Critère 3 : les comptes aux rôles globaux retirés (admin, moderator,
# redactor, public) passent à `user` et gardent leurs lignes `member`.
# Connexion : DATABASE_MIGRATION_URL, rôle propriétaire et superutilisateur du
# Postgres jetable de la CI, que la RLS ne filtre pas.
set -euo pipefail

: "${DATABASE_MIGRATION_URL:?DATABASE_MIGRATION_URL doit être défini}"

SNAPSHOT_DIR="${RUNNER_TEMP:-/tmp}/s47-global-roles"
RETIRED_ACCOUNTS="$SNAPSHOT_DIR/retired-accounts"
MEMBER_TOTAL="$SNAPSHOT_DIR/member-total"
KEPT_ROLES="('user', 'super_admin')"

query() {
  psql "$DATABASE_MIGRATION_URL" -v ON_ERROR_STOP=1 -At -F ' ' -c "$1"
}

fail() {
  echo "::error::$1"
  exit 1
}

memberships_of() {
  query "SELECT u.id, count(m.id) FROM \"user\" u
           LEFT JOIN member m ON m.user_id = u.id
          WHERE $1
          GROUP BY u.id ORDER BY u.id"
}

snapshot_before() {
  mkdir -p "$SNAPSHOT_DIR"
  query 'SELECT count(*) FROM member' >"$MEMBER_TOTAL"
  memberships_of "u.role::text NOT IN $KEPT_ROLES" >"$RETIRED_ACCOUNTS"

  local converted
  converted=$(grep -c . "$RETIRED_ACCOUNTS" || true)
  echo "Lignes member au total : $(cat "$MEMBER_TOTAL")"
  echo "Comptes à convertir (id, lignes member) : $converted"
  cat "$RETIRED_ACCOUNTS"
  if [ "$converted" -eq 0 ]; then
    echo "::warning::Aucun compte au rôle retiré dans le seed de main : le contrôle de conversion n'éprouve rien."
  fi
}

check_after() {
  local outside
  outside=$(query "SELECT count(*) FROM \"user\" WHERE role::text NOT IN $KEPT_ROLES")
  [ "$outside" -eq 0 ] || fail "$outside compte(s) portent encore un rôle hors $KEPT_ROLES"
  echo "OK : aucun rôle global hors $KEPT_ROLES"

  local total
  total=$(query 'SELECT count(*) FROM member')
  [ "$total" -eq "$(cat "$MEMBER_TOTAL")" ] ||
    fail "Lignes member : $(cat "$MEMBER_TOTAL") avant, $total après"
  echo "OK : $total lignes member, inchangé"

  if [ ! -s "$RETIRED_ACCOUNTS" ]; then
    echo "Aucun compte converti à contrôler."
    return
  fi

  local ids
  ids=$(cut -d ' ' -f 1 "$RETIRED_ACCOUNTS" | sed "s/.*/'&'/" | paste -sd ',')

  local not_user
  not_user=$(query "SELECT count(*) FROM \"user\" WHERE id IN ($ids) AND role::text <> 'user'")
  [ "$not_user" -eq 0 ] || fail "$not_user compte(s) converti(s) ne valent pas user"

  local after
  after=$(memberships_of "u.id IN ($ids)")
  if [ "$after" != "$(cat "$RETIRED_ACCOUNTS")" ]; then
    echo "Avant :"
    cat "$RETIRED_ACCOUNTS"
    echo "Après :"
    echo "$after"
    fail "Les comptes convertis n'ont plus les mêmes lignes member"
  fi
  echo "OK : $(grep -c . "$RETIRED_ACCOUNTS") compte(s) converti(s) en user, lignes member intactes"
}

case "${1:-}" in
  before) snapshot_before ;;
  after) check_after ;;
  *)
    echo "usage : $0 before|after" >&2
    exit 2
    ;;
esac
