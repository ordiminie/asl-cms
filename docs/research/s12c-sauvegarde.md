# Research — Story s12c-sauvegarde

> Recherche menée le 5 novembre 2026 sur `main` à `c95ba644` (s49 mergée). Tout ce qui est nommé
> ci-dessous a été ouvert dans le dépôt. Rien n'a été exécuté contre un Postgres : le comportement de
> `pg_dump` / `pg_restore` face à la RLS forcée est une **question ouverte** (voir la fin), pas un fait.
> Le découpage a passé `/ks-stories-review` (`Stories ready: yes`).

## Target story

**s12c-sauvegarde — Sauvegarder et restaurer les données** (complexité 3, hors tableau de périmètre du
PRD). Dépendances : s01b, s04, s05, s06, s09, s12b — toutes livrées, mais la **recette de s12b n'est pas
terminée** (déploiement de s49 et association B restants) ; le serveur réel n'est donc pas encore un
terrain d'essai fiable.

En tant que prestataire (SuperAdmin), je veux sauvegarder la base et les fichiers de toutes les
associations, afin qu'aucune perte du serveur ne fasse disparaître leurs données.

Critères d'acceptation (verbatim, numérotés pour la suite) :

1. Une sauvegarde produit, pour un même horodatage, une copie de la base **et** une copie du répertoire
   de fichiers (`LOCAL_STORAGE_ROOT`).
2. La sauvegarde contient les lignes de **tous** les tenants : après restauration, le nombre de lignes de
   chaque table métier est identique à celui de la base d'origine, pour chacune des associations —
   vérifié par un test automatisé sur deux tenants.
3. Restaurer une sauvegarde sur une base vide et un répertoire vide rend une application dans laquelle
   **toute clé de fichier référencée en base** désigne un fichier présent — vérifié par le même test, sur
   l'inventaire des colonnes de clé de fichier décrit dans les notes.
4. Ajouter une colonne de clé de fichier qui suit la convention de nommage, sans la déclarer à
   l'inventaire, fait échouer ce test — vérifié en ajoutant une colonne de contrôle.
5. La sauvegarde s'exécute sans intervention humaine, à une fréquence planifiée, sans confirmation
   interactive.
6. Chaque sauvegarde est copiée hors du serveur qui l'a produite ; la destination vient de la
   configuration, pas du code.
7. Les sauvegardes plus anciennes que la durée de conservation configurée sont supprimées, sur le serveur
   comme à destination ; la durée vient de la configuration.
8. Une sauvegarde en échec (base, fichiers ou copie distante) sort en erreur et ne produit jamais une
   archive partielle présentée comme réussie.
9. L'absence de sauvegarde réussie dans la fenêtre attendue déclenche une alerte reçue hors du serveur,
   par un canal qui ne dépend ni de l'application ni de son adaptateur d'envoi d'emails — que la
   sauvegarde ait échoué ou qu'elle ne se soit pas lancée du tout.

Hors critères testables, à vérifier en review : un exercice de restauration **sur le serveur réel** avant
l'import de s13, avec date et durée consignées dans la documentation d'exploitation.

## Current state of the code

**Scripts existants (racine du dépôt) — hérités du boilerplate, inutilisables par un cron.**

- `db_backup.sh` : exige `env=prod|dev`, fait `source .env.production`, **lit une confirmation au
  clavier** (`read confirmation`), écrit dans `~/backup/sql/backup_<env>_<horodatage>.dump` avec
  `pg_dump -F c -b -v --schema=public --schema=drizzle --no-owner --no-acl`, sur `DATABASE_URL` — donc
  avec le rôle `asl_app`, soumis à la RLS. Aucun traitement des fichiers, aucun contrôle d'échec au-delà
  de la sortie de `pg_dump` (pas de `set -e`), aucune rotation.
- `db_restore.sh` : en `prod`, **force `DATABASE_URL="dangerous"`** (garde-fou : on commente la ligne
  pour restaurer la production) ; demande `yes` au clavier ; fait `DROP SCHEMA public CASCADE` et
  `drizzle`, recrée `uuid-ossp`, puis `pg_restore --no-owner --no-acl`. Contient `ALTER DATABASE
verceldb SET search_path …` (nom de base hérité de Vercel, faux ici : la base s'appelle `asl_cms`) et
  vérifie par `SELECT COUNT(*) FROM public.user`.

**Rôles Postgres (`ops/postgres/bootstrap.sql`).** Deux rôles seulement : `asl_owner` (propriétaire,
`NOBYPASSRLS`, migrations) et `asl_app` (`NOBYPASSRLS`, application). `ALTER DEFAULT PRIVILEGES FOR ROLE
asl_owner … GRANT … TO asl_app` : les droits de `asl_app` ne valent que pour les objets **créés par
`asl_owner`**. `src/db/scripts/check.ts` + `role-privileges.ts` font échouer le démarrage si le rôle de
`DATABASE_URL` est superuser ou `BYPASSRLS`. Il n'existe aucun rôle de sauvegarde.

**RLS.** Forcée par migration sur les tables métier (`ALTER TABLE … FORCE ROW LEVEL SECURITY`, p. ex.
`drizzle/migrations/0004_rls_tenant_isolation.sql`, `0007`, `0009`, `0013`) ; 40 migrations. Policy
`tenant_isolation` : `organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid OR
current_setting('app.bypass_rls', true) = 'on'` (ADR 002). `withRlsBypass()` (`src/db/tenant-scope.ts`) est
la seule porte dérobée applicative ; ses usages actuels : provisioning (`organization-service.ts`,
`admin/organizations/actions.ts`), `rate-limit-service.ts`, le seed.
`src/db/rls-inventory.test.ts` est un **précédent direct** pour s12c : un test qui lit les `pgTable` et les
migrations et échoue sur toute dérive, hors de `src/db/models/` (drizzle-kit charge ce dossier par
`require` et casse sur un import de `vitest`).

**Stockage de fichiers.** `STORAGE_TYPE=local`, racine `LOCAL_STORAGE_ROOT`
(`/srv/asl-cms/shared/storage` en production, `.storage` en dev ; `src/env.ts`, `ops/env.production.example`).
Adaptateur `src/lib/files/storage/local-storage.ts` (+ tests). Clés de la forme
`{organizationId}/{famille}/…` (ADR 004, 015) : le préfixe tenant fait que la racine contient un
sous-répertoire par association.

**Colonnes de clé de fichier réellement présentes** (grep sur `src/db/models/`) :

| Table                                              | Colonne                                             | Story     |
| -------------------------------------------------- | --------------------------------------------------- | --------- |
| `organization` (`auth-model.ts:197-198`)           | `identity_logo_key`, `identity_favicon_key`         | s01b      |
| `page` (`page-model.ts:51`)                        | `share_image_key`                                   | s04 / s11 |
| `news` (`news-model.ts:50`)                        | `image_key`                                         | s05       |
| `board_member` (`board-member-model.ts:45`)        | `photo_key`                                         | s06       |
| `water_analysis` (`water-analysis-model.ts:40-41`) | `poster_key`, `report_key` (toutes deux `NOT NULL`) | s09       |

Les commentaires de `board-member-model.ts`, `news-model.ts` et `water-analysis-model.ts` annoncent déjà la
**convention de nommage `_key`** « que l'inventaire de s12c lira ». Elle est donc posée côté schéma ; il
reste à écrire l'inventaire et le test qui la lit.

**Clés de fichier hors colonnes — le trou principal.** Les images et PDF des **blocs de page** (s04) ne
sont pas des colonnes : `content_block.data` est un `jsonb` (`content-block-model.ts:25`) dont le schéma Zod
(`src/services/types/domain/page-block-types.ts`, l. 39-71) porte `fileKey` (bloc image, bloc PDF) et
`images[].fileKey` (galerie). Une convention de nom de colonne ne les voit pas. C'est précisément la
« famille » que l'énoncé de la story appelle « les images de blocs de page (s04) », et le critère 3 les
inclut (« toute clé de fichier référencée en base »).

**Planification.** `ops/systemd/asl-cms-purge.{service,timer}` est le modèle imposé (README §8 : « s12c et
s26 y ajoutent les leurs, sur le modèle de `asl-cms-purge.*` ») : `Type=oneshot`, `User=asl-cms`,
`WorkingDirectory=/srv/asl-cms/current`, `ProtectSystem=strict`, `ReadWritePaths=/srv/asl-cms/shared`,
`OnCalendar=daily`, `Persistent=true`, `RandomizedDelaySec=15min`. `ops/ops-config.test.ts` verrouille ces
contrats par des tests de fichiers (précédent pour tester les futures unités).

**Scripts d'exploitation TypeScript.** `src/db/scripts/*.ts` (bootstrap, purge, transfer-presidency) et
`scripts/ops/deploy-release.ts` (testé par `deploy-release.test.ts`). `package.json` : `ops:bootstrap`,
`ops:transfer-presidency`, `ops:deploy-release`. Depuis s49, `allow-server-only.ts` neutralise `server-only`
dans les scripts d'exploitation (ADR 044). `pg_dump` est présent sur ce poste (`/usr/bin/pg_dump`) ; `rclone`
et `restic` ne le sont pas.

**CI.** `.github/workflows/ci.yml` : job `e2e` avec service `postgres:17`, `db:migrate` + `db:seed` +
`db:check` puis Playwright ; `DATABASE_URL` = `asl_app`, `DATABASE_MIGRATION_URL` = `test` (le rôle de test
du service est superuser). Un second job (l. 149+) prépare la même base. C'est là que le test de
restauration doit vivre (le test unitaire ne peut pas : `db.ts` refuse toute connexion en test, ADR 002).

## Anchor points

- `ops/systemd/asl-cms-backup.{service,timer}` : nouvelles unités, calquées sur la purge (README §8,
  `ops-config.test.ts` à étendre).
- Un script de sauvegarde et un de restauration non interactifs, à côté de `ops/` ou `scripts/ops/`
  (TypeScript testable comme `deploy-release.ts`, ou shell comme `deploy.sh` — à trancher au plan).
  `db_backup.sh` / `db_restore.sh` de la racine sont à **remplacer ou réécrire**, pas à doubler (« sans
  dupliquer »).
- `src/env.ts` / `ops/env.production.example` + `env-production-example.test.ts` : variables
  d'exploitation (fréquence, destination distante, rétention, fenêtre d'alerte, URL/jeton du signal de vie).
- `ops/postgres/bootstrap.sql` (et sa documentation §2.1) : un éventuel rôle de sauvegarde ; `check.ts` /
  `role-privileges.ts` à ne pas casser (ils refusent `BYPASSRLS` pour le rôle applicatif).
- Fichier d'inventaire unique des colonnes de clé de fichier (nouveau) + test sur le modèle de
  `src/db/rls-inventory.test.ts`.
- `docs/exploitation/README.md` : §8 (minuteries), nouvelle section sauvegarde/restauration, §10/11
  (critères, exercice de restauration), et `docs/exploitation/recette-*.md` pour la date et la durée de
  l'exercice réel.
- `docs/architecture.md` + un nouvel ADR (le numéro suivant est **045**, le dernier est 044).

## Verified APIs / functions

- `withRlsBypass`, `withTenant`, `getDb` — `src/db/tenant-scope.ts` (usages listés plus haut).
- `createStorage(type, config): StorageOperations` — `src/lib/files/storage/storage-factory.ts` ;
  contrat `upload / download / delete / list` (`types.ts`) ; implémentation `local-storage.ts`.
- `tableNamesIn`, `forcedTablesIn` — exportées par `src/db/rls-inventory.test.ts` (extraction par regex des
  `pgTable` et des `FORCE ROW LEVEL SECURITY`) : modèle de lecture du schéma pour l'inventaire.
- `assertApplicationRolePrivileges` — `src/db/scripts/role-privileges.ts`.
- `pnpm db:migrate`, `db:seed`, `db:check`, `ops:deploy-release` — `package.json`.
- Cadre de test e2e : `playwright` sur build de production + Postgres éphémère (`ci.yml`, job `e2e`).

## Traps & constraints

1. **RLS forcée et `pg_dump` (piège n°1 de la story, non tranché).** `asl_app` ne voit rien hors scope, et
   `FORCE` vaut aussi pour `asl_owner`. Candidats à éprouver : rôle dédié `BYPASSRLS` en lecture seule,
   ou superuser `postgres` du VPS (`sudo -u postgres pg_dump`, sans mot de passe), ou `pg_dump` sous
   `app.bypass_rls`. Le dernier n'est pas possible tel quel : la policy lit un réglage de **session**
   (`current_setting`), alors que `pg_dump` ouvre ses propres connexions. Tout nouveau contournement est
   un point d'arrêt de revue : à justifier dans l'ADR.
2. **Restauration et rôles.** Le script actuel utilise `--no-owner --no-acl` : les objets restaurés
   appartiennent alors au rôle restaurateur et **`asl_app` perd ses droits** (les `DEFAULT PRIVILEGES` ne
   couvrent que les objets créés par `asl_owner`). L'application redémarrerait sur une base « cohérente »
   mais illisible pour elle. La restauration doit conserver propriétaires et droits, ou les rétablir, et le
   test doit ensuite lire **avec `asl_app` sous `withTenant`** pour le prouver.
3. **Politiques et `FORCE` dans le dump.** À vérifier que la sauvegarde emporte bien policies et
   `relforcerowsecurity` ; sans cela, la base restaurée n'est plus isolée en silence.
4. **Les clés de fichier ne sont pas toutes des colonnes** (voir plus haut) : l'inventaire doit couvrir les
   chemins `jsonb` des blocs, et la détection inverse (critère 4) ne peut pas reposer sur le seul nom de
   colonne pour eux. Il faut décider d'une convention équivalente pour le JSON (p. ex. une liste de
   « chemins de clé » `content_block.data → fileKey`, `images[].fileKey`) ou de lire le schéma Zod.
5. **Ordre base puis fichiers** (piège n°2) : un fichier en trop est inoffensif, une clé sans fichier non.
   Les fichiers orphelins après échec de suppression existent déjà par conception (ADR 015, point 3).
6. **Atomicité (critère 8).** Écrire dans un répertoire temporaire puis renommer ; ne rien publier, ni
   copier à distance, ni envoyer de signal de vie avant que base **et** fichiers **et** copie soient finis.
7. **Durcissement systemd.** `ProtectSystem=strict` + `ReadWritePaths=/srv/asl-cms/shared` : les
   sauvegardes locales doivent vivre sous `shared/` (la story les veut hors du répertoire déployé), et un
   outil de copie distante a besoin de son propre accès réseau et de ses identifiants (secrets).
8. **L'alerte ne passe pas par Brevo ni par l'application** (piège n°3) et doit couvrir « ne s'est pas
   lancée ». La minuterie `Persistent=true` rattrape un passage manqué mais ne prévient de rien.
9. **Hérités à ne pas copier :** `ALTER DATABASE verceldb`, `read` interactif, `source .env.production`
   depuis un répertoire courant, absence de `set -euo pipefail`.
10. **Vérification manuelle impossible ici.** `/srv/asl-cms` n'existe pas sur ce poste ; tout essai « réel »
    se fait sur le VPS, après la recette de s12b. Le CI est le seul terrain automatisé.
11. **Pas de build ni d'e2e en local** (machine trop juste) : le test de restauration sera validé par la CI
    GitHub, pas ici.

## Décisions de l'utilisatrice (5 novembre 2026)

Arbitrées après la première version de cette recherche ; elles remplacent les questions 3, 4 et 5 ci-dessous.

1. **Destination : le serveur lui-même, pour l'instant.** Un seul serveur existe. Aucun stockage externe, aucun
   outil de copie distante, aucun compte tiers. ⚠️ Cela **contredit le critère 6** (« copiée hors du serveur
   qui l'a produite ») et la raison d'être de la story (« aucune perte du serveur ne fasse disparaître leurs
   données ») : une sauvegarde sur le disque qu'elle protège ne survit pas à la perte du disque. À traiter
   au plan : soit amender le critère 6 dans `docs/stories.md` (« destination configurée, par défaut un
   répertoire local distinct ; copie distante dès qu'une destination est fournie »), soit livrer la copie
   distante derrière une configuration vide. Le critère « la destination vient de la configuration » reste
   vrai dans les deux cas. À consigner dans l'ADR comme risque accepté et dette ; la sauvegarde infogérée du
   VPS chez LWS (ADR 004, « à surveiller ») est peut-être le seul filet hors disque : à vérifier avec LWS.
2. **Alerte : par email à `contact@zouritestudio.fr`.** Le critère 9 exige un canal indépendant du serveur
   et de l'adaptateur Brevo, et qui couvre « ne s'est pas lancée ». Un email envoyé _par le serveur_ ne
   couvre pas ce second cas (serveur éteint ou minuterie morte = aucun email). Il faut donc un signal de vie
   reçu par un service externe qui écrit à cette adresse quand il cesse d'arriver (type Healthchecks.io,
   gratuit à cette échelle) : un compte externe à créer, adresse de destination = `contact@zouritestudio.fr`.
   L'adresse elle-même est une configuration d'exploitation, pas une constante du code ni un paramètre
   d'association.
3. **Pas de chiffrement des sauvegardes dans cette version.** À rouvrir quand un deuxième client signe
   (action déjà notée pour ce moment-là : voir la mémoire sur la clé Brevo par association). Conséquence
   directe de la décision 1 : sans copie hors du serveur, le chiffrement protège moins ; les sauvegardes
   locales héritent des droits du répertoire (propriétaire `asl-cms`, 750).
4. **Fréquence : une sauvegarde tous les deux jours** (et non chaque jour), parce que la période d'un jour n'entre
   pas dans l'offre gratuite de Healthchecks.io : le check est réglé sur **2 jours** de période. Pièges à
   traiter au plan : (a) systemd n'a pas de « tous les deux jours » exact ; `OnCalendar=*-*-1/2` (jours impairs)
   donne un écart de 2 jours, sauf 31 → 1 (1 jour) et fin février, ce qui est inoffensif ; l'alternative est une
   minuterie quotidienne dont le script saute si la dernière réussite a moins de 2 jours. (b) Le délai de grâce
   du check doit couvrir `RandomizedDelaySec` et la durée de la sauvegarde, sinon fausses alertes ; il se règle
   chez Healthchecks, pas dans le dépôt. (c) Le rythme et la fenêtre d'alerte sont de la configuration
   d'exploitation, pas du code (critère 5 et 9).
5. **Rétention : 15 jours**, pour ne pas saturer le disque (critère 7). Avec une sauvegarde tous les deux jours,
   cela garde environ 8 sauvegardes. La durée est une variable de configuration (valeur par défaut 15), jamais
   une constante. Seule la copie sur le serveur est concernée (décision 1). À mesurer au plan : taille d'une
   sauvegarde (base + `LOCAL_STORAGE_ROOT`) × 8, contre l'espace libre du VPS ; la purge ne doit **jamais
   supprimer la dernière sauvegarde réussie**, même si elle a plus de 15 jours (serveur resté à l'arrêt), et ne
   supprime rien si la sauvegarde du jour a échoué.

## Open questions

À résoudre au plan (certaines par une expérience sur le Postgres éphémère, avant d'écrire l'ADR) :

1. **Quel rôle sauvegarde et restaure ?** Rôle dédié `BYPASSRLS` (nouveau privilège sensible, à créer dans
   `bootstrap.sql` et à documenter pour un serveur déjà installé), ou `postgres` via `sudo`. Que fait
   exactement `pg_dump` avec chacun face aux tables `FORCE`? À éprouver avant de décider.
2. **Les policies et `FORCE` sont-ils restaurés** par `pg_restore` ? Faut-il `--no-owner`, `--role`, ou
   rejouer les `GRANT` ? À éprouver.
3. ~~**Outil de copie distante** : `rclone`, `restic`, `rsync`/`scp` vers quoi ? Aucune destination n'est
   fixée dans le dépôt, et le prestataire (l'utilisatrice) n'a pas indiqué de stockage externe. **Décision
   qui dépend d'elle** (compte, coût, hébergeur — hors UE pose un sujet RGPD, cf. ADR 004).~~ Tranché : sur le serveur, voir ci-dessus.
4. ~~**Canal d'alerte hors serveur** : service de signal de vie (« dead-man's switch ») du type
   Healthchecks.io, ou autre ; vers quelle adresse l'alerte arrive-t-elle ? Aussi à choisir par
   l'utilisatrice (compte externe). Le dépôt n'en contient aucun.~~ Tranché : email `contact@zouritestudio.fr` ; reste le choix du service de signal de vie.
5. ~~**Chiffrement des sauvegardes** : elles contiennent des données nominatives de ~400 propriétaires et
   partent hors du serveur ; la story ne le dit pas. À trancher dans l'ADR (clé, rotation, secret).~~ Tranché : non, à rouvrir au 2e client.
6. ~~Fréquence, rétention, fenêtre d'alerte~~ Tranché : tous les 2 jours, 15 jours, voir décisions 4 et 5.
7. **Forme de l'inventaire pour le JSON** (voir piège 4) et lieu du fichier d'inventaire unique que
   « chaque story qui stocke des fichiers complète » (s31, s32, s34, s36).
8. **Script en shell ou en TypeScript ?** Les scripts d'exploitation récents sont en TS testé, `deploy.sh`
   et `add-domain.sh` en shell. Le test de restauration en CI en dépend.
9. **Sort de `db_backup.sh` / `db_restore.sh`** : supprimés au profit des nouveaux, ou conservés comme
   outils de développement ? Le garde-fou `DATABASE_URL="dangerous"` doit survivre sous une forme
   équivalente.
10. **Moment de livraison** : la recette de s12b (déploiement de s49, association B) n'est pas finie ; la
    partie « exercice sur le serveur réel » de s12c ne peut pas être menée avant. Le plan peut-il se
    terminer en CI et laisser l'exercice réel à une tâche d'exploitation distincte, comme la recette de
    s12b l'a été ?
