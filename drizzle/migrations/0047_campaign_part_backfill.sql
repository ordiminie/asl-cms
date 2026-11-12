-- Rattrapage des campagnes de s25 en parts (s26, ADR 052). Fichier prepare
-- par `drizzle-kit generate --custom`.
--
-- Chaque campagne existante recoit sa part 1, au jour de son envoi
-- (`send_date`), avec tous ses destinataires ; la migration generee suivante
-- rend `campaign_recipient.part_id` obligatoire.
--
-- Statut derive de la campagne : `sent` donne une part `sent`. Une campagne
-- encore `sending` a la migration est une livraison de s25 arretee par un
-- redemarrage (aucune reprise en s25, ADR 051 ; l'ecran la montrait deja
-- interrompue) : sa part est `failed`, la campagne `interrupted`, et ses
-- destinataires non servis `failed`, comme apres des tentatives epuisees.
-- Rien n'est renvoye.
--
-- Toutes les migrations en attente s'appliquent dans une seule transaction :
-- aucune valeur d'enum ajoutee par `0045` n'est employee ici.
--
-- Les tables sont sous RLS forcee, proprietaire compris : le tenant est pose
-- association par association (`app.organization_id`, local a la
-- transaction), jamais contourne.

DO $$
DECLARE
  org record;
BEGIN
  FOR org IN SELECT "id" FROM "organization" LOOP
    PERFORM set_config('app.organization_id', org."id"::text, true);

    INSERT INTO "campaign_part" (
      "organization_id", "campaign_id", "number", "scheduled_for",
      "recipient_count", "status", "finished_at"
    )
    SELECT
      c."organization_id", c."id", 1, c."send_date", c."recipient_count",
      CASE WHEN c."status" = 'sent'
        THEN 'sent'::"campaign_part_status"
        ELSE 'failed'::"campaign_part_status"
      END,
      COALESCE(c."finished_at", now())
    FROM "campaign" c
    WHERE c."organization_id" = org."id"
      AND NOT EXISTS (
        SELECT 1 FROM "campaign_part" p WHERE p."campaign_id" = c."id"
      );

    UPDATE "campaign_recipient" r
    SET "part_id" = p."id"
    FROM "campaign_part" p
    WHERE p."campaign_id" = r."campaign_id"
      AND p."number" = 1
      AND r."part_id" IS NULL
      AND r."organization_id" = org."id";

    UPDATE "campaign_recipient" r
    SET "status" = 'failed'
    FROM "campaign" c
    WHERE c."id" = r."campaign_id"
      AND c."status" <> 'sent'
      AND r."status" = 'pending'
      AND r."organization_id" = org."id";

    UPDATE "campaign"
    SET "status" = 'interrupted',
      "finished_at" = COALESCE("finished_at", now()),
      "updated_at" = now()
    WHERE "organization_id" = org."id"
      AND "status" = 'sending';
  END LOOP;

  PERFORM set_config('app.organization_id', '', true);
END $$;
