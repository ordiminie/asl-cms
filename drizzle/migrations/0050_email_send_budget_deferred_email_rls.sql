-- Isolation multi-tenant du budget d'envoi et des emails reportes (ADR 002,
-- ADR 053, s52). Fichier prepare par `drizzle-kit generate --custom`, patron
-- de `0046_scheduled_job_campaign_part_rls.sql` : RLS activee ET forcee,
-- policy `tenant_isolation` qui ne laisse passer que les lignes du tenant pose
-- par `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Une policy **par table** : `email_send_budget` et `deferred_email` portent
-- chacune leur propre `organization_id`, aucune jointure. Le budget d'une
-- association ne se lit ni ne se consomme depuis une autre ; un email reporte
-- (adresse, objet, contenu) ne sort que sous le scope de son association.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "email_send_budget" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_send_budget" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "email_send_budget"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "deferred_email" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deferred_email" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "deferred_email"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
