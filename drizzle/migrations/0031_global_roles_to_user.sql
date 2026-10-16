-- Rôles globaux réduits (s47, ADR 035). Fichier préparé par
-- `drizzle-kit generate --custom`.
--
-- Les comptes aux rôles globaux retirés passent à `user` AVANT que la
-- migration suivante, générée, ne recrée l'énuméré `role_type` sans eux : son
-- recast échouerait sur une ligne portant encore une valeur retirée. Les
-- lignes `member` (rôles d'association) ne sont pas touchées.

UPDATE "user" SET "role" = 'user' WHERE "role" IN ('admin', 'moderator', 'redactor', 'public');
