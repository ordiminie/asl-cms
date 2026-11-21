-- Isolation multi-tenant des fiches sans adresse email figees pour le courrier
-- d'une campagne (ADR 002, ADR 065, s28). Fichier prepare par
-- `drizzle-kit generate --custom`, patron de `0068_campaign_recipient_profile_rls.sql` :
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

ALTER TABLE "campaign_letter_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_letter_profile" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign_letter_profile"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
