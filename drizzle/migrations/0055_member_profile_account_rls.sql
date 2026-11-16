-- Isolation multi-tenant du lien fiche ↔ compte (ADR 002, ADR 054, s53),
-- puis reprise des liens existants. Fichier prepare par
-- `drizzle-kit generate --custom`, patron de `0053_member_question_rls.sql` :
-- RLS activee ET forcee, policy `tenant_isolation` qui ne laisse passer que
-- les lignes du tenant pose par `withTenant()`, ou toutes sous
-- `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : chaque lien porte
-- sa propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.
--
-- Reprise (ADR 054 §2) : chaque `member_profile.user_id` non nul est copie
-- dans la table, avant que la migration generee suivante ne retire la
-- colonne. Les deux tables sont sous RLS forcee, proprietaire compris : le
-- tenant est pose association par association (`app.organization_id`, local
-- a la transaction), jamais contourne — patron de `0047`.

ALTER TABLE "member_profile_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_profile_account" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_profile_account"
  USING (
    "organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );--> statement-breakpoint
DO $$
DECLARE
  org record;
BEGIN
  FOR org IN SELECT "id" FROM "organization" LOOP
    PERFORM set_config('app.organization_id', org."id"::text, true);

    INSERT INTO "member_profile_account" (
      "member_profile_id", "organization_id", "user_id"
    )
    SELECT p."id", p."organization_id", p."user_id"
    FROM "member_profile" p
    WHERE p."user_id" IS NOT NULL
      AND p."organization_id" = org."id"
    ON CONFLICT ("member_profile_id") DO NOTHING;
  END LOOP;

  PERFORM set_config('app.organization_id', '', true);
END $$;
