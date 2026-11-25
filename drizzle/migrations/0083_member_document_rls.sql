-- Isolation multi-tenant des documents nominatifs (ADR 002, ADR 073, s32).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0076_shared_document_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : un document porte
-- sa propre colonne de tenant, aucune jointure. C'est le premier des trois
-- controles de lecture de l'ADR 073 §4 : la route `GET /api/member-documents/[id]`
-- relit l'identifiant sous le tenant du domaine, celui d'une autre association
-- ne rend rien.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "member_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_document" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_document"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
