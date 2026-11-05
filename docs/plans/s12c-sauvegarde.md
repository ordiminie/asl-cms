---
validated: yes
---

# Plan — Story s12c-sauvegarde

Branch: `feature/s12c-sauvegarde`

**Prérequis avant `/ks-execute`** : (1) amender le critère 6 dans `docs/stories.md` (document de cadrage,
commité sur `main`, chemin par chemin : l'arbre contient des modifications étrangères à cette story) ;
(2) la recherche `docs/research/s12c-sauvegarde.md` et l'ADR 045 voyagent avec la branche. Décisions de
l'utilisatrice du 5 novembre : sauvegardes sur le serveur, alerte par email, pas de chiffrement, tous les deux
jours, 15 jours de rétention.

## Target story

**Sauvegarder et restaurer les données** (complexité 3). Le prestataire sauvegarde la base et les fichiers de
toutes les associations, et sait restaurer. Critères (texte complet dans `docs/stories.md`) :

1. Une sauvegarde = une copie de la base **et** du répertoire de fichiers, sous un même horodatage.
2. Après restauration, le nombre de lignes de chaque table métier est identique, pour chaque association —
   test automatisé sur deux tenants.
3. Après restauration sur base et répertoire vides, toute clé de fichier référencée en base désigne un
   fichier présent — même test, sur l'inventaire.
4. Une colonne de clé de fichier non déclarée à l'inventaire fait échouer le test (colonne de contrôle).
5. Exécution planifiée, sans intervention humaine ni confirmation interactive.
6. **Amendé** (voir ci-dessous) : la destination des sauvegardes vient de la configuration.
7. Les sauvegardes plus anciennes que la rétention configurée sont supprimées (**15 jours** par défaut).
8. Un échec ne produit jamais une archive partielle présentée comme réussie.
9. L'absence de sauvegarde réussie dans la fenêtre déclenche une alerte hors serveur, indépendante de
   l'application et de Brevo, que la sauvegarde ait échoué ou ne se soit pas lancée.

**Critère 6, amendement proposé** (arbitrage du 5 novembre : un seul serveur) : « Chaque sauvegarde est
écrite dans un répertoire de sauvegarde distinct de la racine des fichiers et du répertoire déployé ; sa
destination vient de la configuration, pas du code. La copie hors du serveur est reportée au deuxième
client. » Le critère « hors du serveur » n'est donc **pas** satisfait par cette livraison ; c'est un risque
accepté, consigné dans l'ADR 045 et dans la mémoire du projet.

## Tasks (ordered)

Le test de restauration est écrit **en premier** (tâche 3, rouge) ; les tâches 4 et 5 le rendent vert.

1. [x] **Inventaire des clés de fichier** — `src/lib/files/file-key-inventory.ts` : la liste unique des
       colonnes (`organization.identity_logo_key`, `identity_favicon_key`, `page.share_image_key`,
       `news.image_key`, `board_member.photo_key`, `water_analysis.poster_key`, `report_key`) et des chemins JSON
       (`content_block.data` : `fileKey`, `images[].fileKey`, selon le type de bloc). Test Vitest
       `src/db/file-key-inventory.test.ts` (même emplacement et même méthode que `rls-inventory.test.ts`, hors de
       `src/db/models/`) : échoue si une colonne listée n'existe pas dans un `pgTable` ; échoue sur toute colonne
       `*_key` des modèles absente de la liste (critère 4, prouvé en ajoutant une colonne de contrôle dans une
       source de modèle simulée) ; échoue si un type de bloc du schéma Zod porte un `fileKey` non déclaré.
2. [x] **Rôle `asl_backup`** — ajouté à `ops/postgres/bootstrap.sql` (`BYPASSRLS`, `pg_read_all_data`, aucune
       propriété) ; étape équivalente dans `.github/workflows/ci.yml` (jobs `e2e` et du smoke, qui préparent la
       base) ; assertion de privilèges dans `src/db/scripts/role-privileges.ts` (le rôle de sauvegarde doit être
       `BYPASSRLS`, ni superuser, ni propriétaire) avec son test ; section README « Appliquer ce correctif sur un
       serveur déjà installé » (`CREATE ROLE` à la main, secret dans `.env.production`).
3. [x] **Test de restauration (e2e, rouge)** — `e2e/backup-restore.spec.ts` (Playwright sans navigateur, sur
       le Postgres éphémère du job `e2e`, ADR 002) : deux associations amorcées avec un fichier par famille de
       l'inventaire et des lignes dans chaque table métier ; sauvegarde réelle ; restauration dans une base et un
       répertoire vides ; comparaison du nombre de lignes par table et par tenant (lecture sous `bypass`) ;
       chaque clé de l'inventaire désigne un fichier présent ; lecture finale **avec `asl_app` sous
       `app.organization_id`** pour prouver que droits et policies ont survécu. Un second cas prouve le piège :
       un `pg_dump` sous `asl_app` ne contient aucune ligne métier (le test échouerait sans `asl_backup`).
4. [x] **Orchestrateur de sauvegarde** — `scripts/ops/backup.ts` + `pnpm ops:backup`, sur le modèle de
       `deploy-release.ts` (étapes injectables) : répertoire temporaire → `pg_dump -F c` (rôle
       `BACKUP_DATABASE_URL`) → archive des fichiers → `SHA256SUMS` → relecture/vérification → renommage atomique
       → purge de rétention → signal de vie. Vitest `scripts/ops/backup.test.ts` : l'ordre (base avant fichiers) ;
       une étape en échec ne laisse aucun répertoire au nom final, ne purge rien, n'envoie pas le signal de
       réussite mais `/fail` ; la purge supprime au-delà de la rétention et **conserve toujours la plus récente
       sauvegarde complète** ; aucune lecture clavier. Variables : `BACKUP_DIR`, `BACKUP_RETENTION_DAYS` (15),
       `BACKUP_DATABASE_URL`, `BACKUP_HEALTHCHECK_URL` (obligatoire : sans elle le script refuse de tourner).
5. [x] **Orchestrateur de restauration** — `scripts/ops/restore.ts` + `pnpm ops:restore -- <sauvegarde>
--target-url … --target-storage …` : vérifie les sommes de contrôle, refuse une base ou un répertoire cible
       non vides, refuse la cible égale aux URL du serveur sans `--replace-production`, restaure en conservant
       propriétaires et droits (`pg_restore`, sans `--no-owner`/`--no-acl`), décompresse les fichiers. Vitest sur
       les gardes ; le cas e2e de la tâche 3 passe au vert.
6. [x] **Configuration d'exploitation** — variables déclarées dans `src/env.ts` (optionnelles côté
       application, lues par les scripts comme `check.ts`/`purge`), `ops/env.production.example`, et
       `ops/env-production-example.test.ts` (le test existant vérifie le fichier d'exemple).
7. [x] **Unités systemd** — `ops/systemd/asl-cms-backup.service` (modèle de `asl-cms-purge.service` :
       `Type=oneshot`, `User=asl-cms`, `ProtectSystem=strict`, `ReadWritePaths=/srv/asl-cms/shared`) et
       `asl-cms-backup.timer` (`OnCalendar=*-*-1/2`, `Persistent=true`, `RandomizedDelaySec=15min`) ; tests de
       contrat dans `ops/ops-config.test.ts` (utilisateur, durcissement, aucune lecture interactive, rythme).
8. [x] **Retrait des scripts hérités et documentation** — suppression de `db_backup.sh` et `db_restore.sh`
       (remplacés, pas doublés) ; `docs/exploitation/README.md` : §8 (minuterie), nouvelle section sauvegarde /
       restauration / **exercice de restauration** (date et durée à consigner), réglages Healthchecks (période
       2 jours, délai de grâce), mise à jour d'un serveur déjà installé ; `docs/architecture.md` (inventaire des
       clés de fichier, rôle `asl_backup`, exemption) ; `docs/stories.md` (critère 6 amendé, si pas déjà fait) ;
       `AGENTS.md` si une règle change ; la mention des scripts dans `package.json`/README racine.
9. [ ] **Exercice sur le serveur réel** — hors code, **après la recette de s12b** : installer l'unité, créer le
       rôle, lancer `systemctl start asl-cms-backup`, restaurer dans une base jetable, consigner la date et la
       durée dans `docs/exploitation/` (propriété d'exploitation, vérifiée en review, pas en test). Peut suivre le
       merge de la story, comme la recette de s12b.

## Files touched

Nouveaux : `src/lib/files/file-key-inventory.ts`, `src/db/file-key-inventory.test.ts`,
`scripts/ops/backup.ts`, `scripts/ops/backup.test.ts`, `scripts/ops/restore.ts`, `scripts/ops/restore.test.ts`,
`e2e/backup-restore.spec.ts`, `ops/systemd/asl-cms-backup.service`, `ops/systemd/asl-cms-backup.timer`,
`docs/decisions/045-…md`, `docs/research/s12c-sauvegarde.md`, `docs/plans/s12c-sauvegarde.md`,
`docs/reviews/s12c-sauvegarde.md` (au ship).

Modifiés : `ops/postgres/bootstrap.sql`, `src/db/scripts/role-privileges.ts` (+ test),
`.github/workflows/ci.yml`, `src/env.ts`, `ops/env.production.example`, `ops/env-production-example.test.ts`,
`ops/ops-config.test.ts`, `package.json` (`ops:backup`, `ops:restore`), `docs/exploitation/README.md`,
`docs/architecture.md`, `docs/stories.md`, `env.example`.

Supprimés : `db_backup.sh`, `db_restore.sh`.

Aucune migration : aucun modèle de données ne change.

## Test strategy

- **Vitest (unitaire)** : inventaire (convention `_key` + chemins JSON, détection inverse), orchestrateurs de
  sauvegarde et de restauration à étapes injectées (ordre, atomicité, rétention, garde-fous), contrats
  systemd/env. Aucune base réelle (`db.ts` refuse la connexion en test, ADR 002).
- **Playwright sans navigateur, sur le Postgres éphémère** : le test de restauration de bout en bout
  (critères 2 et 3, plus le piège de la RLS). C'est le seul niveau où une vraie policy s'exécute (ADR 002) et
  où `pg_dump`/`pg_restore` tournent.
- **Pas d'exécution locale du build ni de l'e2e** (machine trop juste) : le verdict du test de restauration
  est celui de la CI GitHub. Localement : lint, typecheck, `pnpm test --run` ciblé sur les fichiers touchés.
- **Piège connu** : pas de `pnpm test` en mode watch ; `pnpm test --run`.

## Definition of Done

- Un PR, un commit de story ; la recherche, l'ADR 045 et le plan voyagent avec la branche.
- Critères 1 à 5 et 7 à 9 couverts par un test ; le critère 6 est amendé et le risque documenté.
- Test de restauration vert en CI ; critère 4 prouvé par la colonne de contrôle.
- Revue passée (aucun critique ouvert), tout nouveau contournement de la RLS (`asl_backup`) justifié.
- Le README d'exploitation décrit la sauvegarde, la restauration et la mise à jour d'un serveur existant.
- **Exercice de restauration sur le serveur réel** consigné (tâche 9) avant l'import de s13.
- Rien en dur : rythme, rétention, répertoire, URL de signal de vie en configuration ; aucun secret au dépôt.
