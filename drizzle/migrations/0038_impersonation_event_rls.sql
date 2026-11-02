-- Isolation multi-tenant de la trace des sessions a la place d'un compte (ADR 002, ADR 041, s48).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0036_member_role_event_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : chaque ligne de trace
-- porte sa propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "impersonation_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "impersonation_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "impersonation_event"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
