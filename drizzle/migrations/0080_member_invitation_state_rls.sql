-- Isolation multi-tenant des traces d'invitation et de premiere connexion
-- (ADR 002, ADR 071, s42a). Fichier prepare par `drizzle-kit generate
-- --custom`, patron de `0078_unpaid_reminder_rls.sql` : RLS activee ET forcee,
-- policy `tenant_isolation` qui ne laisse passer que les lignes du tenant pose
-- par `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : une trace porte sa
-- propre colonne de tenant, aucune jointure. Le hook de premiere connexion et
-- le rejeu d'une invitation reportee ecrivent sous le tenant de l'association ;
-- une autre association ne lit ni n'ecrit rien.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "member_invitation_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_invitation_state" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_invitation_state"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
