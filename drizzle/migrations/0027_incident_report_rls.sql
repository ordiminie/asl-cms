-- Isolation multi-tenant des signalements et des categories (ADR 002, ADR 028, s10).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0025_water_analysis_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Les trois policies portent **directement** sur `organization_id` : la
-- categorie, le signalement et chaque evenement de son historique portent leur
-- propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "association_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "association_category" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "association_category"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "incident_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incident_report" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "incident_report"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "incident_report_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incident_report_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "incident_report_event"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
