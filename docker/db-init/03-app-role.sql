-- Rôle applicatif soumis à la RLS (ADR 002).
--
-- `asl` est le superuser bootstrap de l'image postgres : il possède les tables,
-- porte `rolsuper` et `rolbypassrls`, et `FORCE ROW LEVEL SECURITY` ne le
-- contraint PAS — mesuré. Une policy posée sans rôle dédié serait donc visible
-- en base et sans aucun effet, ce qui est le pire des cas parce que silencieux.
--
-- `asl_app` n'est ni propriétaire ni `BYPASSRLS` : c'est le rôle sous lequel
-- l'application tourne (`DATABASE_URL`). Migrations et seed gardent le rôle
-- propriétaire (`DATABASE_MIGRATION_URL`).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'asl_app') THEN
    CREATE ROLE asl_app LOGIN PASSWORD 'asl_app' NOSUPERUSER NOCREATEDB
      NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

\connect asl_cms

GRANT CONNECT ON DATABASE asl_cms TO asl_app;
GRANT USAGE ON SCHEMA public TO asl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO asl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO asl_app;

-- Sans ce ALTER DEFAULT PRIVILEGES, toute table créée ENSUITE par `asl`
-- (donc toute migration future) serait inaccessible à `asl_app`, et l'erreur
-- n'apparaîtrait qu'au premier accès en production.
ALTER DEFAULT PRIVILEGES FOR ROLE asl IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO asl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE asl IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO asl_app;

\connect asl_cms_test

GRANT CONNECT ON DATABASE asl_cms_test TO asl_app;
GRANT USAGE ON SCHEMA public TO asl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO asl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO asl_app;

ALTER DEFAULT PRIVILEGES FOR ROLE asl IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO asl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE asl IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO asl_app;
