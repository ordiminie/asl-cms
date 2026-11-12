-- Isolation multi-tenant du planificateur et des parts de campagne (ADR 002,
-- ADR 006, ADR 052, s26). Fichier prepare par `drizzle-kit generate
-- --custom`, patron de `0044_campaign_rls.sql` : RLS activee ET forcee,
-- policy `tenant_isolation` qui ne laisse passer que les lignes du tenant pose
-- par `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Une policy **par table** : `scheduled_job` et `campaign_part` portent
-- chacune leur propre `organization_id`, aucune jointure. Le planificateur
-- ouvre un `withTenant` par association : une tache d'une autre association
-- ne se prend ni ne se lit.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "scheduled_job" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scheduled_job" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "scheduled_job"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "campaign_part" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_part" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign_part"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
