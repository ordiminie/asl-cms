-- Limiteur generique (s08b) : `rate_limit_event.day date` devient
-- `window_start timestamptz NOT NULL` dans la migration suivante. Fichier
-- prepare par `drizzle-kit generate --custom`.
--
-- La table est videe d'abord : l'ajout d'une colonne `NOT NULL` sans defaut
-- echoue sur une table peuplee. Effet strictement permissif et assume : les
-- compteurs en cours (lignes qui vivent au plus une journee) repartent a zero
-- au deploiement.

TRUNCATE TABLE "rate_limit_event";
