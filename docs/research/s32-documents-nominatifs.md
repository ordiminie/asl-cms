# Research — Story s32-documents-nominatifs

## Target story

**s32 — Accéder à ses documents personnels** (complexité 4, `docs/stories.md` l. 2582). Le
propriétaire récupère sa facture et sa convocation sans qu'un autre membre puisse les voir.
Dépendances : s12, s12d, s31, s53. La revue du découpage est passée (`docs/reviews/stories.md` :
`Stories ready: yes`).

Critères d'acceptation :

1. Le bureau dépose un document nominatif pour un membre donné, et ce membre le voit dans son espace.
2. Chaque fiche a un dossier **physiquement séparé**, et non un répertoire commun filtré à la lecture.
3. Un compte relié à plusieurs fiches (s53) voit les documents de chacune, chacun avec son terrain.
   Il ne voit rien d'une fiche qui n'est pas reliée à son compte.
4. Aucun accès aux documents d'autrui, même en forgeant l'identifiant ou le chemin. Deux tests sont
   exigés : un test d'autorisation croisée **et** un test de traversée de chemin.
5. Un document daté d'avant la vente d'une parcelle reste visible de l'ancien propriétaire et
   invisible du nouveau.
6. Le bureau accède à tous les documents nominatifs de son association, et à aucun d'une autre.
7. Un dépôt en lot associe chaque fichier au bon membre, ou rejette et signale la ligne. Il ne
   rattache jamais un document au mauvais membre.

Notes impératives :

- Le cloisonnement s'indexe sur la **clé primaire de la fiche** (`member_profile.id`), jamais sur le
  compte : une fiche existe sans compte. L'amendement du 15/11 précise que le dossier est celui de la
  fiche, donc du terrain (s53), et que la lecture passe de « ma fiche » à « mes fiches ».
- Exigence de défense en profondeur (CDCT §7) : il faut « exclure tout accès croisé même en cas de bug
  d'autorisation ». Un `WHERE member_id = ?` sur un répertoire commun est exactement ce que le CDC
  refuse.
- La story renvoie à `/ks-architect` le choix de l'arborescence, du nommage non devinable et des
  droits **avant** `/ks-plan`. **Ce choix n'est consigné nulle part aujourd'hui** (voir Open
  questions).
- La story réutilise la route authentifiée par identifiant de s31.
- Le critère de vente s'appuie sur la lecture datée de s12.
- La colonne de clé de fichier doit être déclarée dans l'inventaire de s12c.
- Hors périmètre (cimetière) : aucune classification automatique par IA.
- Volumétrie : environ 800 documents par an, membres sans email compris.

Stories avales qui dépendent de ce mécanisme :

- **s33**, modèles de documents (`stories.md` l. 2817-2840). Le dépôt en lot généré « passe par le
  mécanisme de s32 — ne pas écrire dans le stockage en contournant sa couche de cloisonnement ».
  L'API de dépôt de s32 doit donc pouvoir être appelée par un service, et pas seulement par un
  formulaire.
- **s57**, délai d'accès après vente (l. 4290) : « le vendeur voit les documents d'avant la vente et
  pas ceux d'après ».

## Current state of the code

### s31, le patron à reprendre (vérifié fichier par fichier)

- **Modèle** `src/db/models/shared-document-model.ts`, table `shared_document`. Colonnes : `id` uuid
  (`uuid_generate_v4()`), `organization_id` (FK cascade), `title`, `category_id` (FK
  `association_category`, RESTRICT), `file_key`, `file_bytes` integer, `created_at` timestamptz.
  Index `(organization_id, created_at)`. Pas d'`updated_at` : un document se retire puis se redépose.
- **Migration RLS** `drizzle/migrations/0076_shared_document_rls.sql`, générée par
  `drizzle-kit generate --custom`. Elle contient `ENABLE` + `FORCE ROW LEVEL SECURITY` et une policy
  `tenant_isolation` sur `organization_id = NULLIF(current_setting('app.organization_id', true),
  '')::uuid OR current_setting('app.bypass_rls', true) = 'on'`.
- **Repository** `src/db/repositories/shared-document-repository.ts`. Tout passe par `getDb()`. Il
  expose :
  - `createSharedDocumentDao({id, organizationId, title, categoryId, fileKey, fileBytes})`, qui
    reçoit l'id généré par le service ;
  - `getSharedDocumentByIdDao(id)` ;
  - `listSharedDocumentsDao(orgId, 'category'|'recent')`, avec jointure sur la catégorie ;
  - `deleteSharedDocumentDao(id)`, qui fait `returning` ;
  - `countSharedDocumentsByCategoryDao`.
- **Service** `src/services/shared-document-service.ts` (`server-only`).
  - **Dépôt** (`publishSharedDocumentService({organizationId, title, categoryId, file})`), dans cet
    ordre : `safeParse` → `requireManager` (`canPerformAction`) → contrôles du titre, de la catégorie
    (`listActiveCategoriesDao` sous `withTenant`) et du fichier (`validateContentFile('document',
    bytes)`, signature binaire, PDF de 10 Mo au plus).
  - Les refus remontent dans `{status: 'rejected', issues}` sans rien écrire.
  - L'écriture suit : `crypto.randomUUID()` → `buildSharedDocumentFileKey` →
    `getContentFileStorage().upload()` (**hors transaction**) → insertion sous `withTenant`. Si
    l'insertion échoue, `deleteFileQuietly(fileKey)` est appelé et l'erreur est relancée.
  - **Retrait** (`deleteSharedDocumentService`) : la ligne est supprimée d'abord, puis le fichier
    (orphelin journalisé en cas d'échec).
  - **Lecture** (`readSharedDocumentFileService(orgId, documentId)`) : `UnauthenticatedError` sans
    session, `AuthorizationError` sans `shared.document.read`, `NotFoundError` si la ligne est absente
    sous le tenant. La clé est **relue en base**.
  - Autres fonctions : `getSharedDocumentsForMemberService`, `getSharedDocumentsForBureauService`,
    `canManageSharedDocumentsService`.
- **Façade** `src/services/facades/shared-document-service-facade.ts`. L'intercepteur
  `interceptors/shared-document-service-logger-interceptor.ts` utilise `createServiceInterceptor(...,
  {shouldLogDetails: () => false})` : aucun fichier ni contenu n'entre dans les journaux. **s32 doit
  faire de même**, et y ajouter les noms des membres.
- **Types de domaine** `src/services/types/domain/shared-document-types.ts`. On y trouve :
  - `SharedDocumentDTO`, qui ne porte jamais la clé ;
  - `SHARED_DOCUMENT_KEY_PREFIX = 'shared-documents'` ;
  - `buildSharedDocumentFileKey(orgId, docId)`, qui vérifie les uuid par regex et produit
    `{org}/shared-documents/{docId}/file-{uuid}.pdf` ;
  - `sharedDocumentDownloadName(title)` (ASCII seul) ;
  - `SharedDocumentIssueConst`.
- **Validation** `src/services/validation/shared-document-validation.ts` (Zod : uuid de
  l'organisation et du document).
- **Route** `src/app/api/documents/[id]/route.ts`, `GET(_req, {params: Promise<{id}>})` :
  `getCurrentTenantDal()` (404 sans tenant) → service → `pdfAttachment(bytes, name)`. Les erreurs
  donnent 401, 404 ou `refusalResponseOf` (403 pour une erreur d'autorisation, 404 pour une erreur de
  validation). Les helpers viennent de `src/app/api/campaigns/letter-pdf-response.ts` :
  `emptyResponse(status)`, `pdfAttachment(pdf: Uint8Array, fileName, extraHeaders?)` (en-têtes
  `no-store`, `nosniff`, `attachment`) et `refusalResponseOf(error)`. Route testée par
  `route.test.ts`.
- **DAL** `src/app/dal/shared-document-dal.ts` : `cache()` seul, **aucun `'use cache'`** (données
  sous session). On y trouve :
  - `getMySharedDocumentsDal()`, qui avale `AuthorizationError` et rend `undefined` ;
  - `getSharedDocumentsForBureauDal(orgId)` ;
  - `canManageCurrentSharedDocumentsDal()` ;
  - `getDocumentCategoryChoicesDal(orgId)`.
- **Actions** `src/app/[locale]/(bureau)/bureau/documents/actions.ts` :
  - `publishSharedDocumentAction(_state, formData)` et `deleteSharedDocumentAction(documentId)` ;
  - séquence : `requireCurrentTenantDal()` → `requireActionAuth()` → façade → `revalidatePath(...)`
    → `redirect()` **hors du try**.
  - Messages tirés de `getTranslations('BureauSharedDocumentsPage')`.
- **Écrans** :
  - bureau : `/bureau/documents` (liste), `/nouveau` (dépôt) et `/categories` ;
  - entrée de barre latérale dans `src/components/features/association/bureau-sidebar.tsx`
    (`NAV_GROUPS`, groupe `group`) ;
  - membre : carte `MySharedDocumentsCard` (`src/components/features/member-space/
    my-shared-documents-card.tsx`), rendue par `MemberSpace` derrière son propre `<Suspense>` ;
  - composants : `shared-document-form.tsx` (RHF + Zod + `FileUpload` de `src/components/ui/
    file-upload.tsx`), `shared-document-list.tsx`, `remove-shared-document-button.tsx` et
    `shared-document-paths.ts` (`sharedDocumentDownloadPathOf(id)`, motifs de revalidation, dont
    `MEMBER_SPACE_ROUTE_PATTERN = '/[locale]/(app)/dashboard'`).
- **i18n** `messages/fr.json` : namespaces `BureauSharedDocumentsPage` et `MemberSpacePage.documents`.
- **Registre** `src/services/types/domain/action-registry-types.ts` :
  `SHARED_DOCUMENT_MANAGE = 'shared.document.manage'` (owner, board) et
  `SHARED_DOCUMENT_READ = 'shared.document.read'` (owner, board, member).
- **Catégories** : domaine `CategoryDomainConst.DOCUMENT = 'document'`
  (`association-category-types.ts`). Les valeurs de seed (Statuts, PV, Ordres du jour) sont dans
  `src/db/scripts/tenant-categories-seed.ts`. **Aucun document partagé n'est seedé.**
- **Tests** : `src/services/__tests__/shared-document-service.test.ts` (mocks de `@/db/tenant-scope`,
  du repository, de `association-category-repository` et de `@/lib/files/storage/storage-factory`),
  plus les tests de la DAL, des actions, de la route, des composants et des types.
- **e2e** `e2e/shared-documents.spec.ts` (mode série). Cas couverts :
  - dépôt par le bureau, puis lecture par un membre avec octets identiques et en-têtes vérifiés ;
  - 401 sans session par URL directe ;
  - identifiant de A demandé sur le domaine de B → 404 ;
  - clé de stockage demandée sous `/api/files/...` → 404 ;
  - retrait suivi d'un 404.

  Helpers locaux : `withAppRoleClient`, `inBypass` (pour `set_config('app.bypass_rls','on',true)`),
  `login` (mot de passe `/login/prestataire`) et nettoyage par préfixe de titre.

### Stockage

- **Adaptateur local** `src/lib/files/storage/local-storage.ts`, `createLocalStorage(config, rootDir)`.
  - `baseDir = path.resolve(rootDir, config.basePath)`.
  - `resolveInsideRoot(baseDir, key)` refuse une clé vide, un octet nul, un chemin absolu POSIX ou
    win32, tout segment `..` (séparateurs `/` et `\`), et en dernier recours tout chemin résolu qui
    ne commence pas par `baseDir + sep`.
  - **Pas de `realpath`** : un lien symbolique sous la racine n'est pas suivi ni contrôlé.
  - Écriture par fichier temporaire `wx` puis `rename`. Les quatre opérations sont `upload`,
    `download`, `delete` et `list`.
  - Tests : `local-storage.test.ts` couvre les chemins forgés (`../`, `\\`, `C:\`, `\0`, vide) et
    deux organisations distinctes.
- **Factory** `src/lib/files/storage/storage-factory.ts` : `createStorage(type: 's3'|'local', config)`
  → `createLocalStorage(config, env.LOCAL_STORAGE_ROOT)`. Le cas `s3` lève une erreur.
- **Stockage de contenu** `src/services/content-file-service.ts` : `getContentFileStorage()` =
  `createStorage('local', {bucket:'pages', basePath:'', ...})`. **Toutes les familles de fichiers
  partagent donc la même racine** ; seule la clé sépare. s31 utilise ce même stockage.
- **Portées publiques** `src/services/types/domain/content-file-types.ts` :
  - `CONTENT_FILE_SCOPES` vaut `pages`, `news`, `board` et `water-analysis` ;
  - `isContentFileKeyAllowed(org, key, scopes?)` filtre par portée, segment vide, `..`, `\0`, `\`
    et extension ;
  - `validateContentFile(kind, bytes)` est réexporté depuis `page-block-types.ts` ; la nature
    `document` (PDF seul) a un plafond `PAGE_FILE_MAX_BYTES.document` de 10 Mo.
- **Route publique** `src/app/api/files/[...key]/route.ts` → `createContentFileGET()`
  (`content-file-route.ts`). Elle sert sans autorisation, avec un cache public d'un an : **une
  nouvelle portée nominative ne doit jamais rejoindre `CONTENT_FILE_SCOPES`**.
- **Proxy** `src/proxy.ts`, `matcher` `'/((?!api|trpc|_next|_vercel|monitoring|.*\\..*).*)'` :
  aucune route `/api` n'est gardée, la route doit tout contrôler elle-même (ADR 069, « À
  surveiller »).

### Fiches, parcelles, comptes

- **`member_profile`** (`src/db/models/member-profile-model.ts`) :
  - identité : `id` uuid, seule identité ;
  - colonnes : `organization_id`, `name` (un seul champ, tel qu'il s'écrit sur un courrier), `phone`,
    `home_*`, `land_*`, `company_name` et `pennylane_customer_id` (unique par organisation quand il
    est non nul, index partiel, ADR 048), plus `created_at` et `updated_at` ;
  - **il n'existe aucun numéro de membre, ni email, ni colonne de parcelle ou de compte.**
- **`parcel_ownership`** : période datée demi-ouverte `[starts_on, ends_on)` ; le jour de la vente
  appartient à l'acquéreur. `parcel` porte `number` (unique par association) et `meter_number`.
- **`member_profile_account`** (s53, ADR 054) : table de liaison fiche ↔ compte (plusieurs à
  plusieurs). « Mes fiches » se lit toujours triée par premier numéro de parcelle actuelle (ADR 054
  §7).
- **Visibilité des factures** (ADR 059 §3, précédent direct du critère 5) :
  - la facture est rattachée à `member_profile_id` ;
  - `parcel_id` est seulement **descriptif**, contrôlé à l'écriture par
    `getParcelOwnerAtService(org, parcelId, issuedOn)` ;
  - « la visibilité ne lit que `member_profile_id` : une vente ne déplace aucune facture » ;
  - `recordSaleService` clôt la période du vendeur et ouvre celle de l'acquéreur (fiche distincte),
    sans rien déplacer d'autre.

### Espace membre

- Page `src/app/[locale]/(app)/dashboard/page.tsx` (`withAuth(Page)`). Elle crée les promesses des
  DAL (`getMyLandsDal`, `getMyInvoicesDal`, `getMySharedDocumentsDal`…) et les passe à
  `MemberSpace` (`src/components/features/member-space/member-space.tsx`), qui a trois états :
  - sans fiche (`MemberSpaceWithoutProfile`) : documents partagés seuls ;
  - sans parcelle ;
  - complet : `MyLandsCard`, `MyInvoices`, documents, contact, emails, signalements, question,
    sécurité.
- **Précédent « chacun indiquant son terrain »** : `getMyInvoicesService` dans
  `member-space-service.ts`.
  - Il lit `getMyMemberProfiles` → `provider.listInvoicesOf(org, profileIds)`.
  - `toMyInvoice` produit `parcelNumbers` et `meterNumber` (via `terrainOf`, `parcelsOwnedOn(periods,
    profileId, issuedOn)` pour Pennylane), ainsi que `holderName` (nom de la fiche s'il diffère du
    compte) et `landCount`.
  - L'UI est `my-invoices-card.tsx` (colonne `columns.land`, `t('holder', {name})`,
    `Intl.ListFormat`).
- `getMyInvoicePdfUrlService(org, invoiceId)` montre le contrôle de possession :
  `profiles.some(p => p.id === invoice.memberProfileId)`, sinon `not_found`.

### Fiche du bureau

- Page `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`.
  - Contrôle `canManageCurrentMemberProfilesDal()`, puis `getMemberProfileForBureauDal` (sinon
    `notFound()`).
  - Les sections lentes sont passées en **promesses non attendues** : `notesPromise`,
    `unsubscribePromise` et `invoicesPromise` (`getMemberInvoicesForBureauDal(tenant.id, id)`).
  - Rendu par `MemberProfileDetail` (`src/components/features/member-profile/
    member-profile-detail.tsx`) : `DetailCard`, `MemberProfileEmailsCard`, `MemberRoleCard`,
    `MemberBillingCard`, `MemberInvoicesSection` (l. 318) et `MemberNotesCard`.
  - Sous-routes existantes : `factures/nouvelle`, `factures/[invoiceId]` et `vente/[parcelId]`.

### Import en lot (existant)

- ADR 047 : lecteur CSV maison `src/lib/import/csv-reader.ts` (`readCsv(bytes): CsvReadResult`, avec
  repli Windows-1252 et détection du séparateur), une transaction de tenant par ligne, un rapport
  éphémère jamais stocké ni journalisé.
- Service `src/services/member-import-service.ts`, `importMembersService(input)` →
  `ImportMembersResult` (`imported`/`file_refused`…, `ImportReportDTO` dans
  `types/domain/member-import-types.ts`). Écran SuperAdmin `src/app/[locale]/admin/membres-import/`.
- **Aucun dépôt multi-fichiers n'existe.** `FileUpload` accepte `multi`, mais aucun formulaire ne
  l'utilise ainsi.

## Anchor points

- **Nouveau modèle** `src/db/models/<nom>-model.ts`. Une table métier dédiée (ADR 069 : pas de
  discriminant avec `shared_document`) avec :
  - `organization_id` (RLS forcée) ;
  - `member_profile_id`, en FK RESTRICT comme `member_invoice` ;
  - une colonne de clé suffixée `_key` ;
  - la migration `--custom` de RLS sur le patron `0076`.

  Dernière migration à ce jour : `0081_reflective_sabra` (82 entrées au journal). La prochaine sera
  `0082` (schéma), puis `0083` (RLS custom).
- **Clé de stockage** : un builder sur le patron de `buildSharedDocumentFileKey`, avec uuid vérifiés,
  un préfixe **hors** `CONTENT_FILE_SCOPES` et l'id de fiche dans le chemin. Exemple indicatif, à
  arbitrer : `{org}/member-documents/{memberProfileId}/{docId}-{uuid}.pdf`.

  `createLocalStorage(config, root)` confine déjà sous `path.resolve(root, config.basePath)`. Un
  stockage **ouvert par fiche** (`basePath = {org}/member-documents/{profileId}`) refuserait toute
  clé sortant du dossier de la fiche au niveau de l'adaptateur. C'est un levier de défense en
  profondeur sans nouveau code de confinement, à confirmer à l'architecture.
- **Route** : nouvelle route par identifiant, sur la forme de `src/app/api/documents/[id]/route.ts`
  (un chemin séparé reste à nommer), réutilisant `letter-pdf-response.ts`.
- **Service de lecture membre** : `getMyMemberProfiles(orgId, authUser.id)` (`src/services/
  member-account-service.ts` l. 416) pour « mes fiches », puis un filtre `member_profile_id IN (...)`
  **et** un contrôle de possession à la lecture du fichier (précédent `getMyInvoicePdfUrlService`).
- **Registre** : nouvelles entrées dans `ActionIdConst` et `ACTION_REGISTRY`, par exemple
  `member.document.manage` (owner, board). La lecture membre ne passe pas forcément par une action :
  la possession de la fiche suffit, comme pour les factures. À trancher.
- **Espace membre** : une nouvelle promesse dans `dashboard/page.tsx` et une carte dans `MemberSpace`
  derrière `<Suspense>`, sans doute dans les états « complet » et « sans parcelle » (pas dans « sans
  fiche »). La revalidation passe par `MEMBER_SPACE_ROUTE_PATTERN`.
- **Fiche du bureau** : une promesse supplémentaire dans `proprietaires/[id]/page.tsx` et une section
  dans `MemberProfileDetail`, sur le patron de `MemberInvoicesSection`. Une sous-route de dépôt est
  possible (`proprietaires/[id]/documents/nouveau`, patron `factures/nouvelle`).
- **Vue d'ensemble du bureau** (critère 6) et **dépôt en lot** (critère 7) : sous
  `/bureau/documents` (partagés aujourd'hui) ou dans un segment voisin, avec une entrée dans
  `NAV_GROUPS` si c'est un nouvel écran.
- **Inventaire** : ajouter `{table: '<table>', column: '<col>_key'}` à `FILE_KEY_COLUMNS`
  (`src/lib/files/file-key-inventory.ts`). Il faut aussi étendre `seedFixture`/`removeFixture` et le
  type `Fixture` de `e2e/backup-restore.spec.ts` (l. 229-400). Le test exige **une clé par famille
  et par tenant** (l. 483-500) : la fixture doit insérer, pour chacune des deux associations, une
  ligne rattachée à une fiche existante de ce tenant (fiches du seed `a12…`/`b12…`) ou à une fiche
  créée par la fixture.
- **Classement RLS** : ajouter la table à `docs/architecture.md` (« Classement RLS des 57 tables »
  → 58 ; « Scopée par une policy RLS forcée — 38 tables » → 39), sinon `src/db/rls-inventory.test.ts`
  échoue. Ajouter aussi la phrase d'énumération « plus `<table>` de s32 ».
- **Seed** : `src/db/scripts/seed.ts` et `tenant-member-profiles-seed.ts`. Les documents de démo
  sont facultatifs (aucun document partagé n'est seedé).

## Verified APIs / functions

| Symbole                                                                                                                                                                                                                                      | Emplacement                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `getDb(): ScopedDb`, `withTenant<T>(orgId, cb)` (uuid vérifié ; ouvre une transaction ; un scope imbriqué réutilise la transaction et restaure le réglage), `withRlsBypass(cb)`                                                              | `src/db/tenant-scope.ts` l. 122, 128, 146                                         |
| `canPerformAction(user, orgId, actionId): boolean` (SuperAdmin → `true` ; sinon le rôle d'adhésion selon `ACTION_REGISTRY`, défaut fermé)                                                                                                    | `src/services/authorization/action-registry-authorization.ts` l. 18               |
| `getAuthUser()`                                                                                                                                                                                                                              | `src/services/authentication/auth-service`                                        |
| `getMyMemberProfiles(orgId, userId): Promise<MyMemberProfileRow[]>` (triées ADR 054 §7 ; `MyMemberProfileRow = MemberProfileReadRow & {currentParcelNumbers: string[]}`)                                                                    | `src/services/member-account-service.ts` l. 416 ; `member-profile-repository.ts` l. 93 |
| `getParcelOwnerAtService(orgId, parcelId, date: string): Promise<MemberProfileFieldsDTO \| undefined>` — **exige `member.profile.manage`** (`requireMemberProfileManager`), donc il est utilisable côté bureau et non côté membre | `src/services/parcel-ownership-service.ts` l. 247                                 |
| `recordSaleService(input)`, `attachParcelService(input)`                                                                                                                                                                                     | même fichier, l. 193 et 113                                                       |
| `parcelsOwnedOn(periods, profileId, date): TerrainParcel[]` et `OwnershipPeriod`                                                                                                                                                             | `src/services/rules/pennylane-invoice-mapping.ts` l. 267-296                      |
| `listOwnershipPeriodsByProfilesDao(ids)`, `getCurrentParcelsByMemberDao(id)`, `getMemberFormerParcelsDao(id)`, `getParcelOwnerAtDao(parcelId, date)`                                                                                         | `src/db/repositories/parcel-ownership-repository.ts`                              |
| `lastOwnershipDayOf`                                                                                                                                                                                                                         | `src/services/rules/parcel-ownership-rules.ts`                                    |
| `getMyLandsService`, `getMyInvoicesService`, `getMyInvoicePdfUrlService`                                                                                                                                                                     | `src/services/member-space-service.ts`                                            |
| `validateContentFile(kind: 'image'\|'document', bytes)` → `{valid: true} \| {valid:false, reason:'size'\|…}`                                                                                                                                 | réexport `content-file-types.ts` ← `page-block-types.ts` l. 197-267               |
| `getContentFileStorage(): StorageOperations`                                                                                                                                                                                                 | `src/services/content-file-service.ts`                                            |
| `createStorage(type, config)`, `createLocalStorage(config, rootDir)`, `StorageOperations {upload(file, path), download(path): Blob, delete, list}`                                                                                            | `src/lib/files/storage/{storage-factory,local-storage,types}.ts`                  |
| `getCurrentTenantDal()` (renvoie `undefined` si le domaine est inconnu), `requireCurrentTenantDal()` (`notFound()`)                                                                                                                         | `src/app/dal/tenant-dal.ts` l. 71, 93                                             |
| `requireActionAuth()`                                                                                                                                                                                                                        | `src/app/dal/user-dal`                                                            |
| `emptyResponse`, `pdfAttachment`, `refusalResponseOf`                                                                                                                                                                                        | `src/app/api/campaigns/letter-pdf-response.ts`                                    |
| `createServiceInterceptor(methods, tag, {shouldLogDetails})`                                                                                                                                                                                 | `src/services/facades/interceptors/create-service-interceptor.ts`                 |
| `readCsv(bytes): CsvReadResult`, `normalizeHeader`                                                                                                                                                                                           | `src/lib/import/csv-reader.ts`                                                    |
| `FILE_KEY_COLUMNS`, `NOT_FILE_KEY_COLUMNS`, `FILE_KEY_COLUMN_SUFFIX = '_key'`                                                                                                                                                                | `src/lib/files/file-key-inventory.ts` (garde : `src/db/file-key-inventory.test.ts`) |

**Identifiants portés par une fiche, pour le rapprochement en lot.** Il y en a trois :

- `member_profile.id`, l'uuid, seule identité ;
- `pennylane_customer_id`, facultatif et unique par organisation, absent des fiches créées à la main
  (ADR 048) ;
- les numéros de parcelle via `parcel_ownership`, **interdits comme identité** car non uniques et
  transmis à la vente.

L'email est interdit, le nom et l'adresse ne sont pas uniques. **Il n'existe aucun numéro de membre.**

## Traps & constraints

- **Proxy** : `/api` n'est pas gardé. La route nominative contrôle elle-même la session, le tenant
  par domaine et la possession. Un `redirect()`/`forbidden()` en cours de stream ne change pas le
  statut : la route rend ses codes elle-même (401/403/404).
- **Lecture datée côté membre** : `getParcelOwnerAtService` refuse un simple membre. Pour un terrain
  affiché ou daté côté membre, il faut passer par `listOwnershipPeriodsByProfilesDao` +
  `parcelsOwnedOn`, comme les factures. Aucune story ne relit `parcel_ownership` par ses propres
  requêtes (architecture l. 299).
- **Critère 5 satisfait par le rattachement à la fiche** (ADR 059 §3) : l'acquéreur a une **autre**
  fiche, donc il ne voit rien. Le risque réel est le sens inverse : un dépôt postérieur à la vente
  sur la fiche du vendeur et qui concerne la parcelle vendue. Dans ce cas, un contrôle à l'écriture
  par `getParcelOwnerAtService(parcel, documentDate)` s'impose si le document porte une parcelle.
- **Seed pour l'e2e du critère 5** : il n'existe aucune vente où **les deux** fiches ont un compte.
  - Parcelle 9 : Lucie Moreau, avec compte, la vend le 01/10/2019 à Marcel Laurent, **sans email ni
    compte** (`a1200000-…-000000000004`).
  - Parcelle 47 : Dubois → Roy le 15/06/2026, les deux sans email.

  Prouver « invisible du nouveau » dans un navigateur demande donc une adresse pour l'acquéreur dans
  le seed, ou une preuve par la session d'un compte relié à la fiche acquéreuse créée par la spec. À
  arbitrer au plan. Les specs `member-invoices.spec.ts` et `shared-documents.spec.ts` posent les
  patrons : `newMemberSession` par lien magique via l'outbox, `login` par mot de passe, et
  `TENANT_A = localhost` / `TENANT_B = 127.0.0.1`.
- **Comptes utiles du seed** :
  - Lefèvre (`bernard.lefevre@example.test`) : trois fiches et un compte, parcelles 61/62/63,
    première fiche `a1200000-…-000000000008` ;
  - SCI Les Pins (`contact@sci-les-pins.test`, `b1200000-…-000000000001`, Marketing Pro) ;
  - `admin@gmail.com` : membre de TechCorp et bureau de Marketing Pro ;
  - Gérard Pommier : une fiche dans chaque association, un seul compte.
- **Taille d'envoi** : `next.config.ts` fixe `serverActions.bodySizeLimit: '16mb'` et
  `proxyClientMaxBodySize: '16mb'`, et nginx `client_max_body_size 17m`
  (`ops/nginx/asl-cms-site.conf.template`, verrouillé par `ops/ops-config.test.ts`). **Un lot de
  plusieurs PDF de 10 Mo ne tient pas dans une seule Server Action.** Il faut un envoi fichier par
  fichier (ou par paquets inférieurs à 16 Mo), sinon le relèvement des trois plafonds devient une
  décision d'exploitation.
- **Ordre des écritures** (ADR 004, ADR 069 §7) : fichier puis ligne ; un échec d'insertion efface le
  fichier. Au retrait, la ligne part d'abord, puis le fichier. L'E/S disque se fait **hors** de la
  transaction `withTenant` : ne pas garder une transaction ouverte pendant un lot.
- **Une transaction par ligne de lot** (ADR 047) et un rapport éphémère, jamais journalisé (noms de
  membres).
- **Journaux** : l'intercepteur avec `shouldLogDetails: () => false` est obligatoire. Pas de
  `logger` dans un `'use cache'`, et de toute façon aucune donnée de s32 ne se cache : tout est par
  utilisateur, `cache()` sert seulement à dédupliquer.
- **`withRlsBypass`** : toute nouvelle occurrence dans le code applicatif est un point d'arrêt de
  revue. Les specs e2e utilisent `set_config('app.bypass_rls','on',true)` côté client `pg`, ce qui
  est admis.
- **Migrations** : ne jamais écrire le SQL à la main. Générer le schéma par `pnpm db:generate`, et
  la RLS par `drizzle-kit generate --custom` (patron `0076`).
- **Tests unitaires** : `pnpm test --run`, jamais `pnpm test` (watch). Sur le montage 9p
  (`/workspace`), les workers Vitest expirent : valider sur une copie en disque local, et ne jamais
  compter un timeout comme vert. La RLS ne se teste pas en unitaire (`db.ts` refuse la connexion,
  repositories mockés). Les tests d'isolation et de traversée sont des **e2e Playwright**, exécutés en
  CI et non en local.
- **Traversée de chemin** : la route par identifiant n'accepte aucun chemin. Il faut quand même
  prouver :
  - qu'un id forgé (non-uuid, `..%2F`, id d'une autre fiche, id d'un autre tenant) ne rend rien ;
  - que la clé nominative demandée sous `/api/files/...` rend 404 ;
  - que le builder de clé refuse un id non uuid.

  L'adaptateur a déjà ses tests de chemins forgés. **Pas de `realpath`** : sans risque tant que rien
  ne crée de lien symbolique sous la racine, à noter si l'architecture s'appuie sur l'adaptateur
  comme barrière.
- **Cloisonnement physique et utilisateur Unix** : l'application tourne sous un seul utilisateur
  (systemd, ADR 036). Des droits de système de fichiers par fiche ne protègent pas contre un bug
  applicatif. La défense en profondeur doit venir de l'arborescence par fiche, de la clé relue en
  base, de la possession vérifiée et éventuellement d'un stockage ouvert par fiche (voir Anchor
  points).
- **SuperAdmin et « connexion à la place » (s48)** : `canPerformAction` rend `true` pour le
  SuperAdmin. En connexion à la place, la session est celle du compte cible : « mes fiches » suit.
- **Un compte du bureau peut aussi être propriétaire.** La carte membre lit « mes fiches » par la
  liaison, indépendamment du rôle ; la vue du bureau passe par l'action de gestion.
- **`e2e/backup-restore.spec.ts`** : la fixture écrit un faux fichier par famille et par tenant.
  Oublier la nouvelle famille fait échouer `src/db/file-key-inventory.test.ts` (toute colonne `_key`
  non déclarée).
- **s33 et s57** consommeront ce mécanisme. L'API de dépôt doit être un service appelable par fiche,
  pas une logique enfouie dans l'action.
- **Dernier ADR** : 072, le prochain est 073. Le nouvel ADR complète 004 et 069.

## Open questions

1. **Arborescence et droits, censés être tranchés à `/ks-architect` avant le plan, et absents** :
   `docs/architecture.md` ne dit que « physiquement séparé par membre » (l. 375). Il faut décider :
   - le préfixe (`member-documents` ?) ;
   - le segment de fiche (`{memberProfileId}`) ;
   - le nommage non devinable (uuid) ;
   - s'il faut un **stockage ouvert par fiche** (`basePath` = dossier de la fiche) ou une
     vérification du préfixe de clé à la lecture contre la fiche possédée.

   À consigner dans un ADR 073 (story), ou à renvoyer à `/ks-architect`.
2. **La date du document** pour le critère 5. Trois candidates : la date du document saisie par le
   bureau (date de facture ou de convocation), la date de dépôt (`created_at`), ou les deux. La
   lecture de l'ADR 059 suggère un rattachement à la fiche avec une date du document descriptive.
   Faut-il aussi une parcelle descriptive vérifiée par `getParcelOwnerAtService` à cette date ? Et
   que refuse-t-on : un dépôt dont la date tombe après la fin de toutes les périodes de la fiche ?
3. **Le vendeur voit-il les documents de sa fiche après avoir tout vendu ?** Par le rattachement à la
   fiche, oui, sans limite aujourd'hui. s57 posera le délai d'accès et dit « pas ceux d'après » :
   faut-il, dès s32, refuser au dépôt un document daté après la dernière période de la fiche ?
4. **Format du lot.** Comment un fichier trouve-t-il sa fiche ? Les options :
   - une convention de nom de fichier (quel identifiant ? `pennylane_customer_id` ? l'uuid n'est pas
     saisissable par un bénévole) ;
   - un manifeste CSV (`fichier ; identifiant`) ;
   - une association ligne à ligne à l'écran, chaque fichier choisi contre une fiche.

   L'email et le numéro de parcelle sont interdits. La contrainte de 16 Mo impose un envoi fichier
   par fichier. Que fait-on d'un fichier sans correspondance ou ambigu : rejet de la ligne avec
   signalement (critère 7), jamais de choix par défaut ?
5. **Retrait par le bureau** : aucun critère ne le demande. s31 l'a fait (ligne puis fichier). Le
   retient-on (erreur de dépôt sur la mauvaise fiche) ? Avec une trace ?
6. **Limites** : PDF seul et 10 Mo (nature `document`), comme s31 ? D'autres formats (image de
   courrier scanné) ? Faut-il un quota (ADR 069 l'avait renvoyé à s32, environ 800 fichiers par an) ?
7. **Catégories** (facture, convocation) : faut-il un domaine `association_category` (par exemple
   `member_document`) avec des valeurs de seed (ADR 010, rien en dur), réutiliser le domaine
   `document` de s31, ou aucune catégorie (titre libre) ?
8. **Vue d'ensemble du bureau** (critère 6) : un écran transversal (liste de tous les documents
   nominatifs, filtrable par fiche) **et** une section sur la fiche, ou la section seule ? Où vit le
   dépôt en lot ?
9. **Lecture membre par action du registre ou par possession seule ?** Les factures n'ont pas
   d'action de lecture membre (possession de la fiche). s31 avait `shared.document.read`. Faut-il une
   action `member.document.read` pour s37, ou non ?
10. **Notification** : le membre est-il averti d'un nouveau document (email, budget Brevo de 300 par
    jour) ? Aucun critère ne le demande : hors périmètre par défaut, à confirmer.
11. **Seed et e2e du critère 5** : faut-il donner une adresse et un compte à un acquéreur du seed (cela
    touche `tenant-member-profiles-seed.ts` et des specs existantes qui comptent des fiches), ou
    créer l'acquéreur dans la spec ?
12. **Design** : la story a une UI : dépôt unitaire depuis la fiche, dépôt en lot avec rapport par
    ligne, vue d'ensemble du bureau, carte « Mes documents » dans l'espace membre avec le terrain.
    Elle passe donc par `/ks-design`. Les patrons existants sont la carte de s31, le tableau des
    factures avec sa colonne terrain, et la mention imprimée « document personnel » (design-system
    §6.2).
