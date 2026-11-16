-- Isolation multi-tenant des adresses de fiche (ADR 002, ADR 056, s54), puis
-- reprise des adresses, des refus de campagne et des lignes d'envoi
-- existantes. Fichier prepare par `drizzle-kit generate --custom`, patron de
-- `0055_member_profile_account_rls.sql` : RLS activee ET forcee, policy
-- `tenant_isolation` qui ne laisse passer que les lignes du tenant pose par
-- `withTenant()`, ou toutes sous `app.bypass_rls = 'on'` (seed, SuperAdmin).
--
-- La policy porte **directement** sur `organization_id` : chaque adresse
-- porte sa propre colonne de tenant, aucune jointure.
--
-- Sans tenant pose, `current_setting(..., true)` vaut NULL : aucune ligne ne
-- sort. Un oubli de scope ne fuite pas, il ne retourne rien. La policy FOR ALL
-- sans WITH CHECK reutilise son USING : une ecriture hors tenant est refusee.
--
-- Reprise (ADR 056 §2, ADR 057), avant que la migration generee suivante ne
-- retire `member_profile.email`, `mail_only` et `member_unsubscribe` :
--
-- 1. chaque `member_profile.email` non nul devient une adresse `active`,
--    `holder`, d'origine `file` si la fiche a un `pennylane_customer_id`,
--    sinon `site` (critere 6 : tout ce qui existe reste actif et titulaire) ;
-- 2. chaque refus de `member_unsubscribe` date l'adresse de sa fiche, et
--    toute adresse de l'association egale sans casse : sous l'ADR 055, le
--    refus valait deja pour toute l'adresse ;
-- 3. chaque ligne de `campaign_recipient` recoit l'adresse de sa fiche. Deux
--    lignes d'une campagne dont les fiches portent desormais la meme adresse :
--    la premiere (par identifiant) la garde. Une ligne dont la fiche n'a plus
--    d'adresse, ou n'en est plus la premiere, recoit son jeton de
--    desinscription, qui n'est pas une adresse : elle n'est egale a aucune
--    adresse active, la livraison la traite comme une fiche supprimee et rien
--    n'est envoye (ADR 057), sans perdre la ligne de l'archive.
--
-- Toutes ces tables sont sous RLS forcee, proprietaire compris : le tenant est
-- pose association par association (`app.organization_id`, local a la
-- transaction), jamais contourne — patron de `0047` et `0055`.

ALTER TABLE "member_profile_email" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_profile_email" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_profile_email"
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

    INSERT INTO "member_profile_email" (
      "organization_id", "member_profile_id", "email", "role", "status", "origin"
    )
    SELECT
      p."organization_id",
      p."id",
      p."email",
      'holder'::"member_profile_email_role",
      'active'::"member_profile_email_status",
      CASE WHEN p."pennylane_customer_id" IS NOT NULL THEN 'file' ELSE 'site' END
        ::"member_profile_email_origin"
    FROM "member_profile" p
    WHERE p."email" IS NOT NULL
      AND p."organization_id" = org."id";

    UPDATE "member_profile_email" e
    SET "unsubscribed_at" = refusal."refused_at"
    FROM (
      SELECT lower(trim(p."email")) AS "email_key", min(u."created_at") AS "refused_at"
      FROM "member_unsubscribe" u
      JOIN "member_profile" p ON p."id" = u."member_profile_id"
      WHERE u."organization_id" = org."id"
        AND p."email" IS NOT NULL
      GROUP BY lower(trim(p."email"))
    ) refusal
    WHERE e."organization_id" = org."id"
      AND lower(trim(e."email")) = refusal."email_key";

    UPDATE "campaign_recipient" r
    SET "email" = ranked."email"
    FROM (
      SELECT
        r2."id",
        p."email",
        row_number() OVER (
          PARTITION BY r2."campaign_id", lower(p."email")
          ORDER BY r2."id"
        ) AS "rank"
      FROM "campaign_recipient" r2
      JOIN "member_profile" p ON p."id" = r2."member_profile_id"
      WHERE r2."organization_id" = org."id"
        AND p."email" IS NOT NULL
    ) ranked
    WHERE r."id" = ranked."id"
      AND ranked."rank" = 1;

    UPDATE "campaign_recipient"
    SET "email" = "unsubscribe_token"
    WHERE "organization_id" = org."id"
      AND "email" IS NULL;
  END LOOP;

  PERFORM set_config('app.organization_id', '', true);
END $$;
