-- Isolation multi-tenant des campagnes email (ADR 002, ADR 051, s25).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0042_member_note_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Une policy **par table** : `campaign`, `campaign_recipient` et
-- `member_unsubscribe` portent chacune leur propre `organization_id`, aucune
-- jointure. Un jeton de desinscription d'une autre association ne se resout
-- donc pas dans le tenant du domaine appele.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "campaign" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "campaign_recipient" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_recipient" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaign_recipient"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "member_unsubscribe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_unsubscribe" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_unsubscribe"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
