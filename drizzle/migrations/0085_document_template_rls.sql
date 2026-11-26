-- Isolation multi-tenant des modeles de documents (ADR 002, ADR 074, s36).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0083_member_document_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : un modele porte sa
-- propre colonne de tenant, aucune jointure. Les modeles d'une association ne
-- sont jamais visibles d'une autre (critere 5).
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "document_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_template" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "document_template"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
