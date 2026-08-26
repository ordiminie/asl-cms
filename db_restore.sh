#!/bin/bash

# Vérifier si un argument est fourni
if [ -z "$1" ]; then
  echo "Usage: $0 env=<environment> <chemin/nomfichier.dump>"
  exit 1
fi

# Extraire l'environnement depuis l'argument
ENV=$(echo "$1" | cut -d '=' -f 2)

# Vérifier l'environnement
if [ "$ENV" != "prod" ] && [ "$ENV" != "dev" ]; then
  echo "Environnement invalide : $ENV. Utilisez 'prod' ou 'dev'."
  exit 1
fi

# Vérifier si un fichier dump a été fourni en second argument
if [ -z "$2" ]; then
  echo "Erreur : Aucun fichier dump spécifié."
  echo "Usage: $0 env=<environment> <chemin/nomfichier.dump>"
  exit 1
fi

# Charger les variables d'environnement selon l'environnement
if [ "$ENV" == "prod" ]; then
  source .env.production
  DATABASE_URL="dangerous" #Commenter cette ligne pour restaure prod (attention :) )
else
  source .env.development
fi

# Fichier dump
DUMP_FILE=$2

# Vérifier si le fichier existe
if [ ! -f "$DUMP_FILE" ]; then
  echo "Erreur : Le fichier '$DUMP_FILE' n'existe pas."
  exit 1
fi

# Masquer le mot de passe avant affichage
MASKED_DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's#://([^:/@]+):[^@]*@#://\1:***@#')

# Afficher la confirmation
echo "Environnement: $ENV"
echo "Base de données: $MASKED_DATABASE_URL"
echo "Fichier dump: $DUMP_FILE"
echo "Vous êtes sur le point de restaurer la base de données dans l'environnement '$ENV'."
echo "Cela écrasera toutes les données existantes !"
read -p "Voulez-vous continuer ? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restauration annulée."
  exit 0
fi

# Avant la restauration, supprimer toutes les tables avec CASCADE
echo "Suppression des tables existantes..."
psql "$DATABASE_URL" <<EOF
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA drizzle;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
EOF

# Continuer avec la restauration
echo "Restauration en cours..."
pg_restore --verbose --no-owner --no-acl --dbname="$DATABASE_URL" "$DUMP_FILE"

# Configuration du search_path après la restauration
echo "Configuration du search_path..."
psql "$DATABASE_URL" <<EOF
ALTER DATABASE verceldb SET search_path TO public, drizzle;
SET search_path TO public, drizzle;
EOF

# Vérifier si la restauration a réussi
if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM public.user;" > /dev/null 2>&1; then
    echo "Restauration terminée avec succès."
else
    echo "Erreur : La restauration a échoué."
    exit 1
fi

