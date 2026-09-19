-- Isolation multi-tenant de `rate_limit_event` (ADR 002, s03).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0007_organization_setting_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Sans tenant pose, aucune ligne ne sort et aucune ne s'ecrit : la limitation
-- de debit ne s'execute que dans `withTenant(organizationId, ...)`. La policy
-- FOR ALL sans WITH CHECK reutilise son USING : une ecriture hors tenant est
-- refusee.

ALTER TABLE "rate_limit_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "rate_limit_event"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
