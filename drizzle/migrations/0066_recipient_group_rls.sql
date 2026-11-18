-- Isolation multi-tenant des groupes de destinataires et de leurs appartenances
-- (ADR 002, ADR 060, s27). Fichier prepare par `drizzle-kit generate --custom`,
-- patron de `0064_member_invoice_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Les policies portent **directement** sur `organization_id` : chaque groupe
-- et chaque appartenance porte sa propre colonne de tenant, aucune jointure.
-- Une fiche d'une autre association est invisible sous le tenant : le service
-- la refuse avant toute ecriture (ADR 060 §4).
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "recipient_group" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipient_group" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "recipient_group"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "recipient_group_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipient_group_member" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "recipient_group_member"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
