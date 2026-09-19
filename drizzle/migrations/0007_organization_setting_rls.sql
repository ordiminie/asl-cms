-- Isolation multi-tenant de `organization_setting` (ADR 002, ADR 010, ADR 016).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0004_rls_tenant_isolation.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort, et un parametre se lit alors a sa valeur par defaut. Un oubli de scope
-- ne fuite pas, il ne retourne rien. La policy FOR ALL sans WITH CHECK reutilise
-- son USING : une ecriture hors tenant est refusee.

ALTER TABLE "organization_setting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_setting" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "organization_setting"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
