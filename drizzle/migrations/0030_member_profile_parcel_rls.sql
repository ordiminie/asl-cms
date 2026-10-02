-- Isolation multi-tenant des fiches de proprietaires, des parcelles et des
-- periodes de propriete (ADR 002, ADR 029, s12).
-- Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0025_water_analysis_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- Les trois policies portent **directement** sur `organization_id` : la fiche,
-- la parcelle et chaque periode de propriete portent leur propre colonne de
-- tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.

ALTER TABLE "member_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_profile" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_profile"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parcel" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "parcel"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
ALTER TABLE "parcel_ownership" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parcel_ownership" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "parcel_ownership"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
