-- ShipSaaS s'appuie sur des UUID générés côté base : sans ces extensions,
-- `pnpm db:push` échoue avec une erreur de fonction UUID inconnue.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
