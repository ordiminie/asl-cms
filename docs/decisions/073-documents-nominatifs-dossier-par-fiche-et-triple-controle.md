# ADR 073 — Documents nominatifs : un dossier par fiche, un stockage ouvert sur ce dossier, trois contrôles indépendants à la lecture

- Status: accepted
- Date: 2026-11-25
- Scope: story s32-documents-nominatifs
- Complète : ADR 004 (stockage sur le disque du VPS), ADR 054 (lien fiche ↔ compte), ADR 059 §3 (une vente
  ne déplace aucune facture), ADR 069 (documents partagés), ADR 045 (inventaire des clés de fichier)

## Context

s32 dépose pour une fiche membre ses documents personnels (factures, convocations). Le CDCT §7 n'exige pas
« filtrer à la lecture » mais « exclure tout accès croisé **même en cas de bug d'autorisation** » : une
défense en profondeur, où le cloisonnement du stockage s'ajoute à l'autorisation applicative. La story
renvoyait ce choix à `/ks-architect` ; il n'y a jamais été consigné, il l'est ici.

Faits du code qui pèsent :

- `createLocalStorage(config, root)` confine déjà toute clé sous `path.resolve(root, config.basePath)` et
  refuse `..`, `\0`, `\` et les chemins absolus ; `getContentFileStorage()` ouvre ce stockage avec
  `basePath: ''`, donc **toutes** les familles de fichiers partagent la racine et seule la clé les sépare ;
- `GET /api/files/[...key]` sert sans autorisation, avec un cache public d'un an, toute clé d'une portée de
  `CONTENT_FILE_SCOPES` ; le proxy ne garde aucune route `/api` ;
- l'application tourne sous un seul utilisateur Unix (ADR 036) : des droits disque par fiche ne protégeraient
  pas d'un bug applicatif ;
- un dossier nominatif existe pour une fiche **sans compte** : il ne peut pas être indexé sur l'utilisateur ;
- une fiche n'a ni numéro de membre ni email ; son seul identifiant saisissable par le bureau est
  `pennylane_customer_id` (facultatif, unique par association, de forme uuid).

## Decision

1. **Table dédiée `member_document`** : `id`, `organization_id` (RLS forcée, policy `tenant_isolation`),
   `member_profile_id` → `member_profile` (RESTRICT), `title`, `category_id` → `association_category`
   (RESTRICT), `document_date` (date, saisie par le bureau, défaut : jour du dépôt), `file_key`,
   `file_bytes`, `created_at`. Aucun lien avec `shared_document` (ADR 069).
2. **Dossier physiquement séparé par fiche**, indexé sur la clé primaire de la fiche :
   `{organizationId}/member-documents/{memberProfileId}/{documentId}-{uuid}.pdf`, générée par le serveur à
   partir d'uuid vérifiés. `member-documents` **n'est pas** une portée de `CONTENT_FILE_SCOPES`.
3. **Stockage ouvert sur le dossier de la fiche** : toute lecture, écriture ou suppression passe par
   `getMemberDocumentStorage(organizationId, memberProfileId)`, un stockage local dont le `basePath` est le
   dossier de cette fiche ; il ne reçoit que le nom du fichier. L'adaptateur refuse donc, à lui seul, toute
   clé qui sortirait du dossier de la fiche visée.
4. **Trois contrôles indépendants à la lecture d'un fichier**, chacun suffisant à refuser :
   1. la ligne est relue **sous le tenant du domaine** (`withTenant`, RLS) ;
   2. **possession** : la fiche de la ligne fait partie des fiches du compte (`getMyMemberProfiles`), ou
      l'utilisateur a `member.document.manage` dans cette association ;
   3. **cohérence clé ↔ fiche** : la clé lue en base commence par
      `{organizationId}/member-documents/{ligne.member_profile_id}/` et son nom de fichier ne contient aucun
      séparateur ; le stockage est ouvert sur le dossier de **cette** fiche. Une clé incohérente est un
      refus journalisé (sans nom de membre), jamais un fichier servi.
5. **Route `GET /api/member-documents/[id]`, par identifiant** : 401 sans session, 404 pour tout le reste
   (identifiant non uuid, inconnu, d'une autre association, d'une fiche non possédée, retiré) — un membre
   n'apprend pas qu'un document existe. `no-store`, `nosniff`, `attachment` sous un nom ASCII tiré du titre.
6. **Une action au registre** (ADR 018) : `member.document.manage` (`owner`, `board`) — déposer, retirer,
   lister tous les documents de l'association, administrer les catégories. La lecture membre ne passe pas par
   une action mais par la **possession**, comme les factures (ADR 059).
7. **Vente** (critère 5) : le document appartient à la fiche, une vente ne déplace rien (ADR 059 §3).
   L'acquéreur ayant une autre fiche, il ne le voit jamais ; le vendeur le garde. `document_date` est
   descriptive ; s32 ne refuse pas un dépôt daté après la dernière période de la fiche (délai d'accès du
   vendeur : s57).
8. **Dépôt en lot** : un fichier par appel (plafond de 16 Mo par requête). La fiche se trouve par la partie
   du nom de fichier qui précède le premier `_`, comparée **exactement** (sans casse, espaces retirés) à
   `pennylane_customer_id`. Sans `_`, sans correspondance, PDF invalide ou trop lourd : ligne écartée avec sa
   raison, jamais de fiche par défaut. L'unicité de la référence rend le cas « plusieurs fiches » impossible.
   Une transaction par fichier, rapport éphémère jamais stocké ni journalisé (ADR 047).
9. **Catégories administrables** : domaine `member_document` de `association_category` (ADR 028), valeurs de
   seed « Facture » et « Convocation » (ADR 010). PDF seul, 10 Mo (nature `document`). Pas de quota.
10. **Ordre des écritures** (ADR 069 §7) : fichier puis ligne, fichier effacé si l'insertion échoue ; au
    retrait, ligne puis fichier, un échec disque laissant un orphelin journalisé.

## Considered options

- **Répertoire commun filtré par `member_profile_id`** — rejeté : exactement ce que la story refuse ; un oubli
  de filtre serait une fuite.
- **Dossier indexé sur le compte** — rejeté : une fiche sans compte a des documents ; un compte relie
  plusieurs fiches (s53) et une fiche peut changer de compte.
- **Droits Unix par fiche (un utilisateur ou un groupe par dossier)** — rejeté : un seul processus applicatif
  sert toutes les fiches ; il aurait tous les droits, la barrière serait décorative.
- **Contrôle du préfixe seul, sur le stockage commun** — insuffisant seul : retenu comme troisième contrôle,
  doublé du stockage ouvert par fiche pour que l'adaptateur refuse lui aussi.
- **Chiffrement par fiche** — écarté pour V1 : la clé vivrait dans le même processus ; aucun gain contre un
  bug applicatif, coût de gestion des clés et de restauration (ADR 045).
- **Rapprochement du lot par manifeste CSV ou choix à l'écran** — rejetés par arbitrage (25/11/2026) : la
  référence Pennylane est le seul identifiant stable déjà saisi ; un fichier sans correspondance se dépose à
  l'unité.
- **Action `member.document.read`** — rejetée : la possession est le seul critère pertinent ; une action
  configurable (s37) pourrait l'ouvrir à tort.

## Consequences

- `file_key` de `member_document` rejoint `FILE_KEY_COLUMNS` et la fixture de `e2e/backup-restore.spec.ts`.
- Le classement RLS passe de 57 à 58 tables (39 scopées).
- s33 et s57 consomment un service de dépôt appelable par fiche.
- À surveiller : l'adaptateur n'appelle pas `realpath` ; tant que rien ne crée de lien symbolique sous
  `LOCAL_STORAGE_ROOT`, le confinement tient. Toute future route de fichier refait elle-même ses contrôles.
