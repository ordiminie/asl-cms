-- Isolation multi-tenant : RLS activee ET forcee sur les tables **metier**
-- portant organization_id (ADR 002). Fichier prepare par
-- `drizzle-kit generate --custom` : le journal et les snapshots restent
-- coherents, ce qu'AGENTS.md exige.
--
-- Le `true` de current_setting rend l'absence de reglage NON fatale : la
-- variable vaut NULL, la comparaison vaut NULL, et AUCUNE ligne ne sort.
-- Oublier de poser le tenant ne donne donc pas un acces large, il donne zero
-- ligne. NULLIF couvre la chaine vide, qui ferait echouer le cast en uuid.
--
-- Une policy FOR ALL sans WITH CHECK explicite reutilise son USING comme
-- WITH CHECK : un INSERT hors tenant est refuse. Mesure en base, rien a
-- ajouter.
--
-- FORCE est indispensable : sans lui, le proprietaire des tables (le role des
-- migrations) n'est pas soumis a la policy. Il ne protege en revanche PAS d'un
-- role SUPERUSER ou BYPASSRLS — d'ou le role applicatif `asl_app`, dont
-- `pnpm db:check` verifie desormais les privileges.
--
-- ⚠️ `member` et `invitation` portent `organization_id` et ne sont PAS
-- couvertes : elles sont le **plan identite**, exempte par l'ADR 014. Leur
-- lecture principale est inter-tenant par construction (le `customSession` de
-- Better Auth charge toutes les organisations d'un utilisateur a chaque
-- requete, avant tout scope), et une policy y rendait l'inscription et la
-- session inoperantes — mesure. Leur isolation reste applicative (CASL).
-- La convention de l'ADR 002 reste entiere pour toute table metier future.

ALTER TABLE "user_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_submissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_submissions"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
