-- Isolation multi-tenant de `menu_item` (ADR 002, ADR 021).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0013_page_content_block_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id`, comme celle de `page`
-- et contrairement a celle de `content_block` qui joint `page` : une entree de
-- menu porte sa propre colonne de tenant (ADR 021), la requete reelle etant
-- « toutes les entrees de cette association ».
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "menu_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "menu_item"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
