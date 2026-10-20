#!/usr/bin/env bash
# Ajoute le domaine d'une association a nginx, avec son propre certificat
# (ADR 036, s12b). Aucune modification du code n'est necessaire.
#
#   sudo ops/add-domain.sh <domaine>
#
# Prealables : l'association est provisionnee dans /admin (ou par
# pnpm ops:bootstrap pour la premiere), et l'enregistrement DNS du domaine
# pointe vers ce serveur.
#
# 1. ecrit un bloc HTTP seul (defi ACME + redirection) et recharge nginx,
#    sauf si le certificat du domaine existe deja (script relance) ;
# 2. obtient le certificat du domaine par certbot --webroot ; son
#    renouvellement automatique rechargera nginx ;
# 3. ecrit le bloc complet (HTTPS), verifie la configuration et recharge.
# Seul le fichier de ce domaine est ecrit : les autres sites sont intacts.
set -euo pipefail

domain="${1:-}"
if [[ ! "$domain" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "Usage : sudo $0 <domaine> (minuscules, sans protocole ni port)" >&2
  exit 2
fi
if [[ "$(id -u)" -ne 0 ]]; then
  echo "A lancer en root : sudo $0 $domain" >&2
  exit 2
fi

template="$(cd "$(dirname "$0")" && pwd)/nginx/asl-cms-site.conf.template"
site_file="/etc/nginx/sites-available/asl-cms-$domain.conf"
enabled_link="/etc/nginx/sites-enabled/asl-cms-$domain.conf"
webroot=/var/www/asl-cms-acme

render() {
  sed "s/__DOMAIN__/$domain/g" "$template"
}

reload_nginx() {
  nginx -t
  systemctl reload nginx
}

mkdir -p "$webroot"

# Relance sur un domaine deja certifie : le bloc complet en place sert deja
# le defi ACME ; repasser par le bloc HTTP seul couperait HTTPS un instant.
if [[ ! -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
  echo "[add-domain] Bloc HTTP seul pour $domain"
  render | sed '/^# BEGIN HTTPS$/,/^# END HTTPS$/d' > "$site_file"
  ln -sfn "$site_file" "$enabled_link"
  reload_nginx
fi

echo "[add-domain] Certificat pour $domain"
certbot certonly \
  --webroot \
  -w "$webroot" \
  -d "$domain" \
  --cert-name "$domain" \
  --non-interactive \
  --keep-until-expiring \
  --deploy-hook "systemctl reload nginx"

echo "[add-domain] Bloc complet (HTTPS) pour $domain"
render > "$site_file"
ln -sfn "$site_file" "$enabled_link"
reload_nginx

echo "[add-domain] $domain est servi en HTTPS. Verifier : curl -I https://$domain/"
