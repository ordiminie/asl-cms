# ADR 045 — Sauvegarde sur le serveur : rôle dédié `BYPASSRLS`, restauration par superutilisateur, signal de vie externe

- Status: accepted
- Date: 2026-11-05
- Scope: story s12c-sauvegarde

## Context

s12c sauvegarde la base **et** le répertoire de fichiers (`LOCAL_STORAGE_ROOT`) de toutes les associations,
et prouve qu'on sait restaurer (recherche : `docs/research/s12c-sauvegarde.md`). Trois forces :

- **La RLS forcée (ADR 002).** `asl_app` ne voit aucune ligne hors d'un scope de tenant ; `asl_owner` non
  plus, car `FORCE ROW LEVEL SECURITY` s'applique au propriétaire. Un `pg_dump` sous l'un ou l'autre
  échoue, ou produit une sauvegarde sans aucune ligne métier. La policy lit un réglage de **session**
  (`app.bypass_rls`) : `pg_dump`, qui ouvre ses propres connexions, ne peut pas le poser. La restauration
  insère sous les mêmes policies.
- **Un seul serveur, un seul client** (arbitrage du 5 novembre 2026) : les sauvegardes restent sur le VPS,
  sans copie distante ni chiffrement dans cette version.
- **Une minuterie qui ne tourne plus ne produit aucune erreur** (ADR 006). L'alerte ne peut passer ni par
  l'application ni par Brevo, et doit couvrir « ne s'est pas lancée ».

## Decision

1. **Un rôle de sauvegarde dédié, `asl_backup`**, créé dans `ops/postgres/bootstrap.sql` :
   `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS`, membre de `pg_read_all_data`. Il ne
   possède rien et ne peut rien écrire. Il sert **uniquement** à `pg_dump`, dans une unité systemd à part,
   via `BACKUP_DATABASE_URL` (secret). Ce rôle est un contournement de la RLS : c'est le seul, avec
   `withRlsBypass()`, et il est lisible à ce titre en revue. `db:check` continue de refuser `BYPASSRLS` pour
   le rôle **applicatif** ; il ne voit jamais `asl_backup`.
2. **La restauration est un acte humain, par un superutilisateur Postgres**, vers une base **vide**
   (`pnpm ops:restore`). Elle conserve propriétaires et droits du dump (pas de `--no-owner --no-acl`), de
   sorte que `asl_app` retrouve ses accès ; elle refuse une base cible non vide ou un répertoire non vide.
   Le garde-fou de `db_restore.sh` (`DATABASE_URL="dangerous"`) devient : la cible doit être donnée
   explicitement (`--target-url`) et **ne jamais être égale à `DATABASE_URL`/`DATABASE_MIGRATION_URL` du
   serveur sans `--replace-production`**, option qui n'a pas de valeur par défaut.
3. **Une sauvegarde = un répertoire daté** `BACKUP_DIR/<horodatage>/` contenant `database.dump` (format
   custom), `files.tar.gz`, `SHA256SUMS`. Il est construit dans `BACKUP_DIR/.tmp-<horodatage>/`, vérifié,
   puis **renommé** : une archive partielle n'a jamais le nom d'une sauvegarde. Ordre : base, puis fichiers
   (un fichier en trop est inoffensif, une clé sans fichier ne l'est pas).
4. **Rythme tous les deux jours** : `OnCalendar=*-*-1/2` (jours impairs), `Persistent=true`. Écart d'un jour
   entre le 31 et le 1er : sans conséquence.
5. **Rétention de 15 jours** (`BACKUP_RETENTION_DAYS`, défaut 15) appliquée après une sauvegarde
   **réussie** seulement, et qui ne supprime **jamais la plus récente sauvegarde complète**.
6. **Signal de vie externe** : Healthchecks.io (période 2 jours, alerte par email à
   `contact@zouritestudio.fr`, réglée chez le service). Le script appelle `BACKUP_HEALTHCHECK_URL` (secret)
   **en dernier**, après une sauvegarde entièrement réussie, et son `/fail` sur échec. Le silence — échec,
   minuterie morte, serveur éteint — déclenche l'alerte.
7. **L'inventaire des clés de fichier** est un module unique (`src/lib/files/file-key-inventory.ts`) :
   colonnes `_key` (convention de nommage, détection inverse par lecture des `pgTable`) **et** chemins JSON
   des blocs de page (`content_block.data`), que le nom d'une colonne ne révèle pas.

## Considered options

- **`pg_dump` sous `asl_owner` ou `asl_app`** — rejeté : soumis aux policies, sauvegarde vide ou en échec.
- **`pg_dump` sous le superutilisateur `postgres` (`sudo -u postgres`)** — rejeté pour la minuterie : une
  unité planifiée tournant en superutilisateur de la base est un pouvoir bien plus large que « lire toutes
  les lignes ». Retenu, en revanche, pour la restauration humaine.
- **Poser `app.bypass_rls` pour la session** — impossible : `pg_dump` ouvre ses propres connexions.
- **`ALTER ROLE asl_app BYPASSRLS` le temps de la sauvegarde** — rejeté : ouvre une fenêtre où l'isolation
  est inactive pour l'application entière.
- **`--no-owner --no-acl` (comme `db_restore.sh`)** — rejeté : les objets restaurés appartiendraient au
  restaurateur et `asl_app` perdrait ses droits, sur une base d'apparence cohérente.
- **Copie hors du serveur (rclone/restic/rsync) et chiffrement** — **reportés** (arbitrage du 5 novembre
  2026, un seul serveur). Risque accepté, voir Consequences.
- **Alerte par email envoyé par le serveur (Brevo ou MTA local)** — rejeté : ne couvre ni un serveur éteint
  ni une minuterie morte, et passerait par ce qu'elle surveille.
- **Rythme quotidien** — écarté : la période d'un jour n'entre pas dans l'offre gratuite de Healthchecks.

## Consequences

**Plus simple.** Une sauvegarde se vérifie (sommes de contrôle, test de restauration en CI) ; l'oubli d'une
famille de fichiers devient un test rouge ; la restauration conserve l'isolation et les droits.

**Plus difficile.**

- **Risque accepté : les sauvegardes vivent sur le disque qu'elles protègent.** La perte du disque ou du
  serveur emporte la base, les fichiers **et** les sauvegardes. Le seul filet hors disque est la sauvegarde
  infogérée du VPS chez LWS, **non vérifiée**. À rouvrir au deuxième client (copie distante, chiffrement) ;
  le critère 6 de la story est amendé en conséquence.
- Un rôle `BYPASSRLS` de plus à créer, y compris sur un serveur déjà installé (README).
- Les sauvegardes contiennent des données nominatives non chiffrées ; elles héritent des droits du
  répertoire (`asl-cms`, 750).

**À surveiller.** L'espace disque (≈ 8 sauvegardes conservées) ; le délai de grâce du check Healthchecks
(il doit couvrir `RandomizedDelaySec` et la durée de la sauvegarde) ; tout nouveau stockage de fichier doit
déclarer ses clés à l'inventaire.
