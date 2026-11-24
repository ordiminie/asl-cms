-- Isolation multi-tenant des rangs de relance d'impaye (ADR 002, ADR 070, s29).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0076_shared_document_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : un rang porte sa
-- propre colonne de tenant, aucune jointure. Le gestionnaire sans session de
-- `billing.unpaid_reminders` ecrit sous le tenant de sa tache ; une autre
-- association ne lit ni n'ecrit rien.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "unpaid_reminder" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unpaid_reminder" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "unpaid_reminder"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
