-- Isolation multi-tenant des fiches ciblees figees par destinataire de
-- campagne (ADR 002, ADR 061, s27). Fichier prepare par
-- `drizzle-kit generate --custom`, patron de `0066_recipient_group_rls.sql` :
-- RLS activee ET forcee, policy `tenant_isolation` qui ne laisse passer que les
-- lignes du tenant pose par `withTenant()`, ou toutes sous
-- `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : chaque ligne porte
-- sa propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "campaign_recipient_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_recipient_profile" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign_recipient_profile"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
