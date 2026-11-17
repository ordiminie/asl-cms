-- Isolation multi-tenant des factures des membres et des alertes de statut
-- (ADR 002, ADR 059, s19). Fichier prepare par `drizzle-kit generate --custom`,
-- patron de `0053_member_question_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Les policies portent **directement** sur `organization_id` : chaque facture
-- et chaque alerte porte sa propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "member_invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_invoice" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_invoice"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "invoice_status_alert" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_status_alert" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invoice_status_alert"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
