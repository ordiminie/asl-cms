-- Isolation multi-tenant de `page` et `content_block` (ADR 002, ADR 007, ADR 019).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0007_organization_setting_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- `content_block` ne porte pas `organization_id` : le tenant d'un bloc est
-- celui de sa page (ADR 019, pas de colonne dupliquee). Sa policy joint donc
-- `page` — et comme `page` est elle-meme sous RLS forcee, la sous-requete ne
-- voit que les pages du tenant courant : hors scope, aucun bloc ne sort.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "page" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "page" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "page"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint

ALTER TABLE "content_block" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_block" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "content_block"
  USING (
    EXISTS (
      SELECT 1 FROM "page"
      WHERE "page"."id" = "content_block"."page_id"
        AND "page"."organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );
