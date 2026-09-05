#!/bin/bash

# Vérifier si un argument est passé
if [ -z "$1" ]; then
  echo "Usage: $0 env=<environment>"
  exit 1
fi

# Extraire l'environnement depuis l'argument
ENV=$(echo "$1" | cut -d '=' -f 2)

# Vérifier l'environnement
if [ "$ENV" != "prod" ] && [ "$ENV" != "dev" ]; then
  echo "Environnement invalide : $ENV. Utilisez 'prod' ou 'dev'."
  exit 1
fi

# Charger les variables d'environnement selon l'environnement
if [ "$ENV" == "prod" ]; then
  source .env.production
else
  source .env.development
fi

# Masquer le mot de passe avant affichage
MASKED_DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's#://([^:/@]+):[^@]*@#://\1:***@#')

# Afficher la confirmation
echo "Environnement: $ENV"
echo "Base de données: $MASKED_DATABASE_URL"
echo -n "Continuer la sauvegarde? (yes/no): "
read confirmation

if [ "$confirmation" != "yes" ]; then
  echo "Sauvegarde annulée."
  exit 0
fi

# Créer le répertoire de sauvegarde si nécessaire
mkdir -p ~/backup/sql/
# Définir le fichier de sauvegarde
BACKUP_FILE=~/backup/sql/backup_${ENV}_$(date +%Y-%m-%d_%H-%M-%S).dump

# Lancer la commande pg_dump
pg_dump -F c -b -v --schema=public --schema=drizzle --no-owner --no-acl -f "$BACKUP_FILE" "$DATABASE_URL"

echo "Sauvegarde terminée pour l'environnement $ENV. fichier "$BACKUP_FILE" créé."
