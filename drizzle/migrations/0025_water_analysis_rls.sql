-- Isolation multi-tenant de `water_analysis` (ADR 002, s09).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0017_news_rls.sql` : RLS activee ET forcee, policy `tenant_isolation` qui
-- ne laisse passer que les lignes du tenant pose par `withTenant()`, ou toutes
-- sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id`, comme celles de
-- `page`, de `news` et de `board_member` : une analyse d'eau porte sa propre
-- colonne de tenant.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "water_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "water_analysis" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "water_analysis"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
