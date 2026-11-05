# Review — Story s12c-sauvegarde

> Fresh-context review. Each issue classified: critical / major / minor.
> Diff reviewed: `git diff main...feature/s12c-sauvegarde` (commit d56b557c)

## Ce qui a été exécuté, et ce qui ne l'a pas été

- Exécuté par le reviewer : `pnpm test --run scripts/ops src/db/file-key-inventory.test.ts src/db/scripts/role-privileges.test.ts ops/` -> 7 fichiers, 220 tests passés. `eslint` sur les fichiers touchés : aucune sortie (propre). `knip` : aucun signalement sur les nouveaux fichiers.
- `pg_dump` 15 local : `--format=custom`, `--file`, `--dbname` confirmés par `--help` ; `pg_restore` : `--exit-on-error`, `--single-transaction`, `--dbname`, `--list` confirmés. `tar --create/--extract/--list --gzip --file --directory` : options standard.
- **NON vérifié** (à ne pas compter comme vert) : `e2e/backup-restore.spec.ts` (pas de Postgres ici : jugé par lecture seule, la CI GitHub fait foi) ; l'étape CI « Client PostgreSQL 17 » ; la syntaxe `OnCalendar=*-*-1/2` (pas de `systemd-analyze` ici ; la forme `jour/pas` est valide en systemd, et le test ne fait que figer la chaîne) ; la convention Healthchecks (POST sur l'URL de ping, suffixe `/fail`) : conforme à ce que je connais du service, non testée en réseau.

## Plan compliance

- [x] Tâches 1 à 8 présentes dans le diff et cohérentes avec le plan. La tâche 9 (exercice sur le serveur réel) reste cochée `[ ]` : c'est prévu par le plan (hors code, après la recette de s12b), donc un reste à faire explicite, pas un écart. Le tableau d'exercice du README est vide : à remplir avant s13.
- [x] Fichiers hors liste du plan, tous justifiés : étape CI « Client PostgreSQL 17 » (pg_dump refuse un serveur plus récent que lui ; le service CI est `postgres:17`, donc nécessaire pour le e2e), purge des `.tmp-*` (cohérente avec le critère 8 : un essai interrompu ne s'accumule pas), garde `BACKUP_DIR` (traduction directe du critère 6 amendé). `README.md` racine, `env.example` : prévus par la tâche 8/6.
- [x] Critère 6 jugé sur le texte amendé (commit 04b5e120, vérifié dans `docs/stories.md`) : destination en configuration (`BACKUP_DIR`, obligatoire, absolue, refusée si dans `LOCAL_STORAGE_ROOT`, au-dessus, ou dans le répertoire déployé). Couvert par les tests de `backupConfigFrom`. Le risque « même disque » est consigné dans l'ADR 045, le README et l'exemple d'env.

### Critères 1 à 9

| # | Critère | Preuve |
|---|---------|--------|
| 1 | base + fichiers, même horodatage | test d'ordre unitaire + e2e (3 fichiers sous un répertoire unique) |
| 2 | lignes identiques par table et par tenant | e2e seulement (non vérifié ici) |
| 3 | clés d'inventaire -> fichiers présents | e2e seulement (non vérifié ici) |
| 4 | colonne de contrôle non déclarée -> échec | `file-key-inventory.test.ts` (relu, exécuté, vert) |
| 5 | planifié, non interactif | tests systemd (`StandardInput=null`, timer) + « ne lit jamais le clavier » |
| 6 | destination en configuration (amendé) | `backupConfigFrom` testé |
| 7 | rétention configurable, 15 par défaut | `backupsToPurge` + purge réelle en fin de sauvegarde |
| 8 | pas d'archive partielle | `it.each` sur les 7 étapes : aucun nom final, aucun `.tmp-` restant, rien purgé, `/fail` |
| 9 | alerte hors serveur | signal succès en dernier / `/fail` sur échec testés ; le cas « ne s'est pas lancée » repose par construction sur le silence côté Healthchecks (réglage manuel documenté, donc non testable en code) |

## Anti-hallucination

- [x] Aucun import ni appel inventé trouvé : `assertBackupRolePrivileges` existe et est exporté (`src/db/scripts/role-privileges.ts`), `initDotEnv` existe (`src/db/scripts/env.ts`), `FILE_KEY_*` et `fileKeysAtPath` existent, `pg.Client`/`pg_roles`/`pg_class.relowner`/`pg_namespace.nspowner`/`pg_database.datdba` sont des catalogues réels.
- [x] Mot de passe : jamais en ligne de commande (`pgToolConnection` retire le mot de passe de l'URL et le passe par `PGPASSWORD`) ; les messages d'erreur n'incluent que commande + code de sortie. Aucun secret au dépôt (CI : mots de passe jetables).
- [x] Atomicité : construction dans `.tmp-<horodatage>`, vérification (sommes, `pg_restore --list`, `tar --list`), `rename` du répertoire, purge seulement après publication, ping en dernier, `slice(1)` garantit que la plus récente n'est jamais purgée, seuls les noms au format horodatage et `.tmp-*` sont touchés.
- [x] Restauration : sommes vérifiées avant toute écriture ; base cible non vide ou répertoire non vide refusés ; cible = `DATABASE_URL`/`DATABASE_MIGRATION_URL`/`LOCAL_STORAGE_ROOT` refusée sans `--replace-production` ; ni `--no-owner` ni `--no-acl` (ADR 045), ce que le test pinne.
- [x] Pas de valeur en dur gênante (ADR 010) : répertoire, rétention, URL du signal, URL de base viennent de l'environnement ; 15 jours n'est que la valeur par défaut prévue par la story ; le rythme vit dans l'unité timer (configuration d'exploitation versionnée).

## Justification du nouveau contournement de la RLS (`asl_backup`)

Point d'arrêt de revue traité : **justifié**, pas rejeté.

- Nécessaire : l'ADR 045 démontre que `asl_app` et `asl_owner` (FORCE RLS) ne peuvent pas produire une sauvegarde contenant les lignes métier, et que `app.bypass_rls` (réglage de session) est impossible pour `pg_dump`. Le second cas du e2e pinne ce piège.
- Borné : `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS` + `pg_read_all_data`, propriétaire de rien, `CONNECT` explicite. `pg_read_all_data` ne donne aucune écriture. Le script revérifie ces propriétés à chaque exécution (superuser, bypass manquant, objets possédés) avant `pg_dump`.
- `db:check` (`check.ts`, `assertApplicationRolePrivileges`) n'est pas modifié et continue de refuser `BYPASSRLS` pour `DATABASE_URL` ; il ne voit pas `asl_backup`.
- Réserve (voir M1) : ce rôle lit aussi les tables d'authentification (hachages, sessions) ; c'est inhérent à une sauvegarde complète et c'est la raison pour laquelle l'URL est un secret restreint à l'unité.

## Rules compliance

- [x] Conventions du dépôt : pas de `process.env` hors scripts d'exploitation (désactivation ESLint motivée, même précédent que les autres `ops`), kebab-case, scripts fonctionnels à étapes injectables, tests colocalisés.
- [ ] ADR : aucune contradiction frontale ; l'ADR 002 et `AGENTS.md` disent encore que `withRlsBypass()` est « la seule porte dérobée » (voir m1).
- [x] Design system : sans objet (aucune UI).

## Tests

- [x] Suite exécutée par le reviewer, verte (voir plus haut).
- [x] Assertions : pas de test sans assertion. L'ordre des appels est pinné en entier (`toEqual` sur la liste d'appels), le `it.each` d'échec couvre les 7 étapes, le test de rétention couvre « la plus récente est gardée même trop vieille ». Les tests qui figent des chaînes (systemd) sont des tests de contrat, pas de comportement : acceptable, signalés comme tels.
- [ ] `e2e/backup-restore.spec.ts` : lu, **non exécuté**. Lecture : la méthode est saine (vraies commandes `backup.ts`/`restore.ts`, fichier par famille et par tenant, famille vide refusée, comparaison table par table et par tenant sous `asl_app`, isolation A/B après restauration, journal drizzle comparé, ping unique attendu `/ping/s12c`, nettoyage en `afterAll`, second cas qui prouve que `pg_dump` sous `asl_app` échoue puis sort vide). Risques de CI non vérifiables ici : dépendance à `BACKUP_DATABASE_URL` et à `DATABASE_MIGRATION_URL` superuser, mutation temporaire de données partagées avec d'autres specs si Playwright les lance en parallèle.

## Regressions

- [x] Aucune trouvée : `db_backup.sh`/`db_restore.sh` supprimés sans autre référence (grep sur README/docs mis à jour dans le diff) ; variables `BACKUP_*` optionnelles dans `env-schemas.ts`, donc l'application démarre sans elles ; `role-privileges.ts` ne fait qu'ajouter une fonction.

## Findings

- minor (m1) — `AGENTS.md:138` (et ADR 002) — « `withRlsBypass()` est la seule porte dérobée » est maintenant inexact : `asl_backup` est un second contournement. `docs/architecture.md` et l'ADR 045 le disent, mais `AGENTS.md`, qui est lu à chaque session, n'a pas été reformulé, alors que le plan demandait « `AGENTS.md` si une règle change ». À corriger (ajouter : « hors application, seul le rôle `asl_backup`, ADR 045 »). L'ADR 002 est immuable : l'ADR 045 le complète déjà.
- minor (m2) — `scripts/ops/backup.ts` (`archiveFiles`/`run`) — `tar` sort en code 1 quand un fichier change pendant la lecture ; `run` traite tout code non nul comme un échec : un téléversement pendant la sauvegarde donnerait un `/fail` et aucune sauvegarde. Rare (la nuit, association de petite taille) et sûr (échec bruyant, jamais silencieux) ; à noter dans l'exploitation ou à tolérer explicitement.
- minor (m3) — `ops/systemd/asl-cms-backup.service` — `ReadWritePaths=/srv/asl-cms/shared` est en dur alors que `BACKUP_DIR` est configurable : un `BACKUP_DIR` hors de `shared/` échouerait sous `ProtectSystem=strict`. Le README et l'exemple d'env fixent `shared/backups`, donc sans effet par défaut ; à documenter.
- minor (m4) — `scripts/ops/backup.ts` `backupsToPurge` — la purge supprime tout `.tmp-*` sans verrou : une sauvegarde manuelle lancée pendant celle de la minuterie peut effacer le répertoire de travail de l'autre. Cas rare, effet : un échec bruyant, pas de corruption.
- minor (m5) — `src/env-schemas.ts` — `BACKUP_DATABASE_URL` (secret d'un rôle BYPASSRLS) est déclaré dans l'environnement validé de l'application, qui ne la lit jamais. Inoffensif, mais élargit la surface sans besoin ; les scripts lisent déjà `process.env` eux-mêmes.
- minor (m6) — commit d56b557c — le trailer indique « Claude Opus 5.5 » alors que l'attribution de session est « Claude Sonnet 5.5 ».
- minor (m7, non vérifié) — `.github/workflows/ci.yml` — l'étape « Client PostgreSQL 17 » repose sur le script `apt.postgresql.org.sh` du paquet `postgresql-common` (chemin et option `-y` conformes à la documentation PGDG telle que je la connais) et sur `pg_wrapper` choisissant la version la plus haute. Plausible et justifiée, mais dépend d'un dépôt apt externe sans épinglage ; le verdict est celui de la CI.
- info — tâche 9 (exercice réel) et réglage Healthchecks restent à faire par l'exploitation avant s13 ; le filet hors disque (sauvegarde LWS) reste non vérifié, risque accepté dans l'ADR 045.

## Verdict

Aucun critique, aucun majeur. Le rôle `asl_backup` est justifié et borné ; l'atomicité, la rétention, le signal de vie, la gestion du mot de passe et les gardes de restauration sont corrects et testés. Réserves : e2e et CI non vérifiés localement (la CI doit être verte avant merge), reformulation de la règle d'`AGENTS.md` à faire.

Max severity: minor
Ship allowed: yes
