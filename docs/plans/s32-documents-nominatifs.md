---
validated: yes
---

# Plan — Story s32-documents-nominatifs

Branch: `feature/s32-documents-nominatifs`

Sources : `docs/research/s32-documents-nominatifs.md`, `docs/designs/s32-documents-nominatifs.md` (+ `.html`),
[ADR 073](../decisions/073-documents-nominatifs-dossier-par-fiche-et-triple-controle.md).

## Target story

**En tant que** membre propriétaire **je veux** accéder à mes documents nominatifs **afin de** récupérer ma
facture et ma convocation sans risque qu'un autre membre les voie.

1. Le bureau dépose un document nominatif pour un membre donné ; ce membre le voit dans son espace.
2. Chaque fiche dispose d'un dossier **physiquement séparé** (pas de répertoire partagé filtré à la lecture).
3. Un compte relié à plusieurs fiches (s53) voit les documents de chacune, chacun indiquant son terrain ; aucun
   document d'une fiche non reliée.
4. Aucun accès au document d'un autre membre, même en forgeant l'identifiant ou le chemin (test d'autorisation
   croisée **et** test de traversée de chemin).
5. Un document daté d'avant la vente d'une parcelle reste accessible à l'ancien propriétaire et invisible du
   nouveau.
6. Le bureau accède à tous les documents nominatifs de son association, à aucun d'une autre.
7. Un dépôt en lot associe chaque fichier au bon membre, ou rejette la ligne en la signalant, sans jamais
   rattacher un document au mauvais membre.

**Arbitrages (25/11/2026)** : lot rapproché par la **référence client Pennylane en tête du nom de fichier** ;
côté bureau, une section « Documents » sur chaque fiche **et** une page « Documents nominatifs » qui porte le lot ;
**retrait** par le bureau avec confirmation.

**Décisions du plan (ADR 073)** : table `member_document` rattachée à la fiche ; clé
`{org}/member-documents/{profileId}/{docId}-{uuid}.pdf` hors de `CONTENT_FILE_SCOPES` ; stockage ouvert sur le
dossier de la fiche ; trois contrôles indépendants à la lecture (RLS, possession, cohérence clé ↔ fiche) ; route
`GET /api/member-documents/[id]` (401 sans session, 404 pour tout le reste) ; action `member.document.manage`
(owner, board), lecture membre par possession ; `document_date` saisie (défaut : jour du dépôt), descriptive ;
catégories du domaine `member_document` (seed « Facture », « Convocation ») ; PDF seul, 10 Mo ; pas de
notification email.

**Règle de nommage du lot** : la partie du nom avant le premier `_` est comparée exactement (sans casse, espaces
retirés) à `pennylane_customer_id`, de forme uuid — l'exemple `C1234_…` du design est illustratif, les libellés
d'aide montrent la vraie forme (« 3f2a…_facture-2026.pdf »). Un **titre commun au lot** est saisi (manque n° 5 du
design, retenu). Pas de refus d'un dépôt daté après la dernière période de la fiche (s57). L'état d'erreur de la
carte membre suit s31 (frontière de l'espace membre), sans frontière propre.

## Tasks (ordered)

1. [x] **Types de domaine, registre, catégorie.** `src/services/types/domain/member-document-types.ts` : DTO
   membre (titre, catégorie, date, poids, terrain : `parcelNumbers`, `meterNumber`, `holderName`) et bureau
   (+ fiche), résultats de dépôt / retrait / ligne de lot, enjeux de validation, plafond du titre (120),
   `MEMBER_DOCUMENT_KEY_PREFIX = 'member-documents'`, `buildMemberDocumentFileKey(org, profileId, docId)`,
   `memberDocumentFolderOf(org, profileId)`, `isMemberDocumentKeyOf(key, org, profileId)` (préfixe exact, nom
   sans séparateur, `..`, `\0`), `memberDocumentDownloadName(title)`. Règle pure
   `referenceOfBatchFileName(name)` dans `src/services/rules/member-document-batch-rules.ts`. Entrée
   `MEMBER_DOCUMENT_MANAGE` au registre ; `CategoryDomainConst.MEMBER_DOCUMENT`. Tests : clé (uuid requis,
   préfixe, extension), refus d'uuid forgé, `isMemberDocumentKeyOf` sur clé d'une autre fiche / d'un autre
   tenant / avec `..` / `%2F` / `\`, **garde** « `member-documents` hors `CONTENT_FILE_SCOPES` et
   `isContentFileKeyAllowed` refuse la clé », règle de nommage (sans `_`, espaces, casse, nom vide, `_` en tête),
   rôles de l'action.
2. [x] **Modèle, migrations, inventaires.** `src/db/models/member-document-model.ts` (index
   `(organization_id, member_profile_id)` et `(organization_id, created_at)`), export du schéma,
   `pnpm db:generate` (`0082`) puis `drizzle-kit generate --custom` pour la RLS forcée (`0083`, patron `0076`).
   `FILE_KEY_COLUMNS` + fixture de `e2e/backup-restore.spec.ts` (une ligne par tenant sur une fiche du seed) ;
   `docs/architecture.md` : classement RLS 57 → 58 tables, 38 → 39 scopées, entrée « Documents » complétée.
   Tests : `src/db/rls-inventory.test.ts` et `src/db/file-key-inventory.test.ts` verts.
3. [x] **Repository.** `src/db/repositories/member-document-repository.ts`, tout par `getDb()` :
   `createMemberDocumentDao`, `getMemberDocumentByIdDao`, `listMemberDocumentsByProfilesDao(ids)`,
   `listMemberDocumentsByProfileDao(id)`, `listMemberDocumentsForBureauDao(org, {search, categoryId, page})`
   (jointure fiche + catégorie, pagination serveur), `countMemberDocumentsByCategoryDao`,
   `deleteMemberDocumentDao(id)` (`returning`), `getMemberProfileIdByPennylaneReferenceDao(org, ref)`,
   `countMemberProfilesWithoutReferenceDao(org)`. Tests unitaires sur la forme des requêtes (patron s31).
4. [x] **Stockage par fiche, dépôt et retrait.** `getMemberDocumentStorage(org, profileId)` (basePath = dossier
   de la fiche, nom de fichier seul) ; `src/services/validation/member-document-validation.ts` ;
   `src/services/member-document-service.ts` : `depositMemberDocumentService({organizationId,
   memberProfileId, title, categoryId, documentDate, file})` — `safeParse` → `member.document.manage` → fiche
   existante sous le tenant, catégorie active du domaine, `validateContentFile('document')` → fichier puis
   ligne, fichier effacé si l'insertion échoue ; `removeMemberDocumentService` (ligne puis fichier, orphelin
   journalisé) ; `getMemberDocumentsForBureauService`, `getMemberDocumentsOfProfileForBureauService`. Façade +
   intercepteur `shouldLogDetails: () => false`. Tests par rôle (owner, board, member, SuperAdmin, invité) :
   refus sans écriture, ordre des écritures, nettoyage sur échec, fiche d'une autre association refusée,
   l'appel au stockage reçoit le dossier de la bonne fiche.
5. [x] **Lecture membre et route.** `getMyMemberDocumentsService(org)` (fiches par `getMyMemberProfiles`,
   terrain par `listOwnershipPeriodsByProfilesDao` + `parcelsOwnedOn` à `document_date`, patron
   `getMyInvoicesService`, tri par date décroissante) ; `readMemberDocumentFileService(org, id)` appliquant les
   **trois contrôles** de l'ADR 073 §4 ; route `src/app/api/member-documents/[id]/route.ts` (helpers de
   `letter-pdf-response.ts`). Tests : service — fiche non possédée → `not_found`, clé incohérente avec la fiche
   → refus journalisé même si la possession passe, compte multi-fiches, membre sans fiche ; route — 401, 404
   (non-uuid, `..%2F`, inconnu, non possédé), en-têtes `no-store` / `nosniff` / `attachment`.
6. [x] **Dépôt en lot.** `depositMemberDocumentBatchLineService({organizationId, fileName, title, categoryId,
   documentDate, file})` : `referenceOfBatchFileName` → fiche par référence sous le tenant → même chemin que
   le dépôt unitaire ; résultat `deposited` (fiche, terrain) ou `rejected` (`no_reference_in_name`,
   `unknown_reference`, `invalid_file`, `too_large`, `invalid_input`). Une transaction par fichier, rien de
   journalisé. Tests : référence d'une fiche de l'autre association → `unknown_reference`, deux fichiers pour
   deux fiches → chacun la sienne, référence absente → rejet, aucun dépôt sans correspondance exacte.
7. [x] **Fiche du bureau : section, dépôt unitaire, retrait.** DAL `src/app/dal/member-document-dal.ts`
   (`cache()` seul) ; promesse non attendue dans `proprietaires/[id]/page.tsx` ; `MemberDocumentsSection`
   dans `MemberProfileDetail` après « Factures » ; page `proprietaires/[id]/documents/nouveau` (RHF + Zod +
   `FileUpload`, champ date) ; actions `depositMemberDocumentAction`, `removeMemberDocumentAction`
   (`requireCurrentTenantDal` → `requireActionAuth` → façade → `revalidatePath` → `redirect` hors du try) ;
   retrait par `alert-dialog`. Messages `messages/fr.json` (`BureauMemberDocuments`). Tests de composants,
   d'actions et de DAL.
8. [x] **Page « Documents nominatifs », lot, catégories.** `/bureau/documents-nominatifs` (recherche, filtre
   catégorie avec décompte, tableau paginé serveur), entrée `NAV_GROUPS` après « Documents » ;
   `/bureau/documents-nominatifs/lot` : client qui envoie **un fichier par appel** à
   `depositMemberDocumentBatchLineAction`, progression « n traités sur N », avertissement avant de quitter,
   rapport par ligne (écartés en tête, raison écrite), encart des fiches sans référence ;
   `/bureau/documents-nominatifs/categories` (écran générique, `showRoutingEmail={false}`). Tests : composant
   du lot (appels séquentiels, un par fichier ; rapport fidèle aux résultats du serveur, qui reste seul juge
   du rapprochement), action, page.
9. [x] **Carte « Mes documents ».** Promesse dans `dashboard/page.tsx`, carte `MyMemberDocumentsCard` dans
   `MemberSpace` (états « complet » et « sans parcelle »), derrière son `<Suspense>`, après « Mes factures » ;
   terrain affiché avec les clés de « Mes factures » ; lien `memberDocumentDownloadPathOf(id)`. Tests : liste
   multi-fiches avec terrain et titulaire, état vide.
10. [x] **Seed.** `tenant-categories-seed.ts` : « Facture », « Convocation » pour chaque tenant de démo ; deux
    documents de démo facultatifs non requis par les e2e (les specs créent leurs données).
11. [x] **e2e et documentation.** `e2e/member-documents.spec.ts` (série, `TENANT_A = localhost`,
    `TENANT_B = 127.0.0.1`) : dépôt par le bureau puis lecture par le membre (octets identiques) ; **croisé** —
    membre A2 demande le document de A1 → 404, owner de B demande un document de A sur son domaine → 404 ;
    **traversée** — `/api/member-documents/..%2F…`, id non uuid, et la clé demandée sous `/api/files/...` → 404 ;
    compte multi-fiches (Lefèvre) voit les documents de ses trois fiches avec leur terrain ; **vente** — sur la
    parcelle 9 (Moreau → Laurent, 01/10/2019), document de 2019 sur la fiche Moreau : visible de Moreau, invisible
    d'un compte que la spec relie à la fiche Laurent (liaison créée puis retirée en bypass) ; bureau de A ne voit
    pas les documents de B ; **lot** — la spec pose une référence Pennylane sur deux fiches, envoie trois fichiers
    (deux références valides, une inconnue) : deux déposés sur la bonne fiche, un écarté ; retrait → 404.
    `docs/design-system.md` : formes retenues par s32 (rapport de lot, garde de sortie) ; manque n° 3 et n° 7
    consignés.

## Files touched

- `src/services/types/domain/member-document-types.ts`, `action-registry-types.ts`,
  `association-category-types.ts`
- `src/services/rules/member-document-batch-rules.ts`
- `src/db/models/member-document-model.ts`, export du schéma, `drizzle/migrations/0082_*`, `0083_*` + meta
- `src/lib/files/file-key-inventory.ts`, `e2e/backup-restore.spec.ts`
- `src/db/repositories/member-document-repository.ts`
- `src/services/member-document-service.ts`, `validation/member-document-validation.ts`,
  `facades/member-document-service-facade.ts`, `facades/interceptors/member-document-service-logger-interceptor.ts`
- `src/app/api/member-documents/[id]/route.ts`
- `src/app/dal/member-document-dal.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`, `…/[id]/documents/nouveau/`
- `src/app/[locale]/(bureau)/bureau/documents-nominatifs/` (page, `lot/`, `categories/`, `actions.ts`)
- `src/components/features/member-documents/*`, `member-profile/member-profile-detail.tsx`,
  `association/bureau-sidebar.tsx`, `member-space/member-space.tsx`, `member-space/my-member-documents-card.tsx`
- `src/app/[locale]/(app)/dashboard/page.tsx`
- `messages/fr.json`, `src/db/scripts/tenant-categories-seed.ts`
- `e2e/member-documents.spec.ts`
- `docs/architecture.md`, `docs/design-system.md`, ADR 073

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`, sur copie en disque local si le montage 9p expire)** : clé et
  cohérence clé ↔ fiche, règle de nommage, garde `CONTENT_FILE_SCOPES`, services par rôle (repositories et
  stockage mockés), ordre des écritures, trois contrôles de lecture indépendamment (chacun seul fait refuser),
  route (codes et en-têtes), composants (carte, section, rapport de lot), actions.
- **e2e (Playwright, en CI)** : la RLS, l'autorisation croisée, la traversée de chemin, la vente, le
  multi-fiches et le lot se prouvent sur la base seedée — la RLS n'est pas testable en unitaire.
- Gardes existantes à garder vertes : `rls-inventory.test.ts`, `file-key-inventory.test.ts`,
  `backup-restore.spec.ts`, `shared-documents.spec.ts`, `member-invoices.spec.ts`.

## Definition of Done

- Une PR `feature/s32-documents-nominatifs`, un commit (plus un pour la migration si utile), recherche, design,
  plan, ADR 073 et revue embarqués.
- Les sept critères couverts par un test nommé ; les tests croisés et de traversée en e2e, verts en CI.
- Aucun `withRlsBypass` nouveau dans le code applicatif ; aucune clé `member-documents` servie par `/api/files`.
- Aucune valeur en dur (catégories en seed), libellés dans `messages/fr.json`.
- Revue passée (`Ship allowed: yes`), aucune régression.
