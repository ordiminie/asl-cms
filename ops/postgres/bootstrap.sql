-- Amorcage de PostgreSQL pour ASL-CMS (ADR 002, ADR 036, s12b).
-- Derive de docker/db-init/ (developpement), adapte a la production :
--
--   sudo -u postgres psql -f ops/postgres/bootstrap.sql
--
-- A lancer UNE fois, sur un PostgreSQL neuf. Les mots de passe sont demandes
-- par psql (\prompt) : ils ne sont ni versionnes, ni dans l'historique du
-- shell. Generer chacun avec `openssl rand -hex 24` (sans caractere a echapper
-- dans une URL) et les reporter dans shared/.env.production.
--
-- Deux roles :
--   asl_owner : proprietaire de la base et des tables, utilise par les
--               migrations seulement (DATABASE_MIGRATION_URL) ;
--   asl_app   : role de l'application (DATABASE_URL), ni proprietaire ni
--               BYPASSRLS, donc reellement soumis aux policies RLS. pnpm
--               db:check refuse de demarrer s'il en va autrement.

\set ON_ERROR_STOP on

\prompt 'Mot de passe du role proprietaire asl_owner : ' owner_password
\prompt 'Mot de passe du role applicatif asl_app : ' app_password

CREATE ROLE asl_owner LOGIN PASSWORD :'owner_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE ROLE asl_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE DATABASE asl_cms OWNER asl_owner ENCODING 'UTF8' TEMPLATE template0;

\connect asl_cms

-- Les UUID des tables sont generes par uuid_generate_v4().
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Personne d'autre que les deux roles ne se connecte a cette base.
REVOKE ALL ON DATABASE asl_cms FROM PUBLIC;
GRANT CONNECT ON DATABASE asl_cms TO asl_owner;
GRANT CONNECT ON DATABASE asl_cms TO asl_app;
GRANT USAGE ON SCHEMA public TO asl_app;

-- Les tables sont creees ENSUITE par les migrations, sous asl_owner : sans ces
-- privileges par defaut, asl_app n'y aurait pas acces, et l'erreur
-- n'apparaitrait qu'au premier acces en production.
ALTER DEFAULT PRIVILEGES FOR ROLE asl_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO asl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE asl_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO asl_app;
