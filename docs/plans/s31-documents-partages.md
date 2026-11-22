---
validated: yes
---

# Plan — Story s31-documents-partages

Branch: `feature/s31-documents-partages`

Sources : `docs/research/s31-documents-partages.md`, `docs/designs/s31-documents-partages.md` (+ `.html`),
[ADR 069](../decisions/069-documents-partages-table-dediee-et-route-authentifiee.md).

## Target story

**En tant que** membre propriétaire **je veux** accéder aux statuts, PV et ordres du jour **afin de**
retrouver les documents de l'association sans les demander au bureau.

1. Le bureau dépose un document partagé (titre, catégorie, fichier) et le voit apparaître dans l'espace
   documentaire des membres.
2. Tout membre authentifié consulte et télécharge les documents partagés de son association.
3. Un visiteur non connecté n'accède ni à la liste ni à un fichier, y compris par une URL directe.
4. Les documents d'une association ne sont jamais accessibles depuis une autre.
5. Le bureau retire un document ; il disparaît de la liste et son URL directe cesse de servir le fichier.

Décisions prises par le plan (ADR 069) : table dédiée `shared_document` ; catégorie administrable, domaine
`document` de `association_category` (seed « Statuts », « Procès-verbaux », « Ordres du jour ») ; PDF seul,
10 Mo ; clé `{org}/shared-documents/{id}/file-{uuid}.pdf` **hors** de `CONTENT_FILE_SCOPES` ; route
`GET /api/documents/[id]` par identifiant (401 sans session, 403 sans droit, 404 inconnu / autre
association / retiré ; `no-store`, `nosniff`, `attachment`) ; actions `shared.document.manage` (owner, board)
et `shared.document.read` (owner, board, member) ; pas de quota.

## Tasks (ordered)

1. [x] **Types de domaine et registre.** `src/services/types/domain/shared-document-types.ts` (DTO membre et
   bureau, résultats de dépôt / retrait, enjeux de validation, plafond du titre — 120 caractères —,
   constructeur de clé `buildSharedDocumentFileKey` et préfixe `shared-documents`) ; deux entrées
   `SHARED_DOCUMENT_MANAGE` / `SHARED_DOCUMENT_READ` dans `action-registry-types.ts` ; domaine
   `CategoryDomainConst.DOCUMENT = 'document'` dans `association-category-types.ts`. Tests : clé générée
   (uuid requis, extension `pdf`, préfixe tenant), **garde** « `shared-documents` n'est pas dans
   `CONTENT_FILE_SCOPES` et `isContentFileKeyAllowed` refuse une telle clé », rôles par défaut des deux
   actions.
2. [x] **Modèle, migrations, inventaires.** `src/db/models/shared-document-model.ts` (patron
   `water-analysis-model.ts` : `title`, `category_id` → `association_category.id`, `file_key`, `file_bytes`,
   `created_at`, index `(organization_id, created_at)`), export dans `db.ts` ; `pnpm db:generate` puis
   `drizzle-kit generate --custom` pour la RLS (patron `0025_water_analysis_rls.sql`) ;
   `FILE_KEY_COLUMNS` += `shared_document.file_key` ; `docs/architecture.md` : classement RLS (54 → 55,
   35 → 36, ligne justifiée), liste de l'inventaire, entité « Documents » corrigée (renvoi ADR 069). Tests :
   `src/db/file-key-inventory.test.ts` et `src/db/rls-inventory.test.ts` passent.
3. [x] **Repository.** `src/db/repositories/shared-document-repository.ts` : `createSharedDocumentDao`,
   `getSharedDocumentByIdDao`, `listSharedDocumentsDao` (jointure catégorie, nom gardé même supprimée
   logiquement, tri catégorie puis `created_at` décroissant pour l'espace membre, `created_at` décroissant
   pour le bureau), `deleteSharedDocumentDao` (retourne la ligne supprimée), `countSharedDocumentsByCategoryDao`
   (`getDb()`, jamais `db`). Branchement du domaine `document` dans `association-category-service.ts`
   (`MANAGE_ACTION_OF_DOMAIN`, `USAGE_COUNTS_OF_DOMAIN`). Test : le service des catégories gouverne le
   domaine `document` par `shared.document.manage`.
4. [x] **Service, validation, façade.** `src/services/validation/shared-document-validation.ts`,
   `src/services/shared-document-service.ts`, façade + intercepteur de log (patron water-analysis) :
   `publishSharedDocumentService` (safeParse → autorisation manage → titre, catégorie **active du domaine
   `document` de cette association**, PDF par signature binaire ≤ 10 Mo, **avant toute écriture** → id serveur
   → fichier écrit → ligne insérée, fichier effacé si l'insertion échoue) ; `deleteSharedDocumentService`
   (ligne puis fichier, orphelin journalisé) ; `getSharedDocumentsForMemberService` (action read) ;
   `getSharedDocumentsForBureauService` (action manage) ; `readSharedDocumentFileService(orgId, id)` (session
   requise → `UnauthenticatedError` ou équivalent existant ; action read → `AuthorizationError` ; ligne lue sous
   `withTenant` → `NotFoundError`) ; `canManageSharedDocumentsService`. Tests unitaires par rôle (super_admin,
   owner, board, member, compte d'une autre association, sans session) et par refus (titre vide ou trop long,
   catégorie absente / supprimée / d'un autre domaine, non-PDF, > 10 Mo), ordre des écritures et effacement
   sur échec.
5. [x] **Route authentifiée.** `src/app/api/documents/[id]/route.ts` : tenant du domaine
   (`getCurrentTenantDal`), aucun chemin tiré de la requête, réponses `no-store` + `nosniff` (réemploi ou
   déplacement neutre des helpers de `letter-pdf-response.ts`), `Content-Disposition: attachment;
   filename="<titre en ASCII>.pdf"`. Tests : 401 / 403 / 404 (identifiant invalide, inconnu) / 200 avec
   en-têtes ; aucun tenant → 404.
6. [x] **DAL et écrans du bureau.** `src/app/dal/shared-document-dal.ts` (pas de `'use cache'` : données sous
   session) ; `src/app/[locale]/(bureau)/bureau/documents/` : `page.tsx` (liste, vide, succès ancré, alerte
   retrait), `nouveau/page.tsx` (formulaire RHF + Zod, `file-upload`, état « aucune catégorie »),
   `categories/page.tsx` (+ `actions.ts`, patron `questions/sujets`), `actions.ts` (dépôt, retrait,
   `requireActionAuth`, messages `getTranslations`) ; composants `src/components/features/shared-document/` ;
   paramètre `showRoutingEmail` (défaut `true`) de `ReportCategoriesManager` ; entrée « Documents » dans
   `NAV_GROUPS` ; libellés `messages/fr.json`. Tests : actions (autorisation, validation, redirections),
   composants (états 2a–2d, 3a–3d), manager sans colonne de routage, sidebar.
7. [x] **Carte de l'espace membre.** `getMySharedDocumentsDal` (DAL de l'espace membre ou du domaine),
   `MySharedDocumentsCard` (+ `Loading`) derrière son `<Suspense>`, rendue dans les **trois** états de
   `MemberSpace` (avec parcelles, sans parcelle, sans fiche) ; liens `/api/documents/{id}` — jamais de clé ;
   page `/dashboard` passe la promesse. Tests : groupement par catégorie, ordre, vide, chargement, présence
   dans les trois états, aucun `href` contenant `shared-documents/`.
8. [x] **Seed.** `tenant-categories-seed.ts` : trois catégories `document` pour TechCorp Solutions, une pour
   Marketing Pro (isolation). Test existant du seed / de ses données mis à jour si présent.
9. [x] **e2e.** `e2e/shared-documents.spec.ts` : le bureau (owner A) dépose un PDF, le voit ; le membre A le
   voit et le télécharge (octets identiques) ; anonyme : `/dashboard` redirige vers la connexion et
   `GET /api/documents/{id}` ne sert pas le fichier ; un membre A sur le domaine B (identifiant de A) → 404 ;
   la clé de stockage sous `/api/files/...` → 404 ; retrait → absent de la liste et URL directe 404. Bloc RLS
   `shared_document` dans `e2e/tenant-isolation.spec.ts` (hors scope rien, scope A seulement A, écriture pour
   B refusée). Fixture de `e2e/backup-restore.spec.ts` : une ligne + un fichier par association, nettoyés.
10. [x] **Documentation.** `docs/design-system.md` : §3.18 « Formes retenues par s31 » (carte groupée par
    catégorie, écran de catégories sans adresse de routage — manque 1) et ligne du manque 2 au §9 ;
    `docs/exploitation/README.md` si l'inventaire des fichiers sauvegardés y est énuméré. Lint, typecheck,
    `pnpm test --run` verts.

## Files touched

- Nouveaux : `src/services/types/domain/shared-document-types.ts` (+ test), `src/db/models/shared-document-model.ts`,
  `drizzle/migrations/0075_*.sql`, `0076_shared_document_rls.sql` (+ meta), `src/db/repositories/shared-document-repository.ts`,
  `src/services/validation/shared-document-validation.ts`, `src/services/shared-document-service.ts` (+ test),
  `src/services/facades/shared-document-service-facade.ts`, `src/services/facades/interceptors/shared-document-service-logger-interceptor.ts`,
  `src/app/api/documents/[id]/route.ts` (+ test), `src/app/dal/shared-document-dal.ts` (+ test),
  `src/app/[locale]/(bureau)/bureau/documents/**` (pages, actions, tests), `src/components/features/shared-document/**`,
  `src/components/features/member-space/my-shared-documents-card.tsx` (+ test), `e2e/shared-documents.spec.ts`.
- Modifiés : `action-registry-types.ts`, `association-category-types.ts`, `association-category-service.ts`,
  `content-file-types.test.ts` (garde), `src/db/models/db.ts`, `src/lib/files/file-key-inventory.ts`,
  `report-categories-manager.tsx`, `bureau-sidebar.tsx`, `member-space.tsx` (+ test), `dashboard/page.tsx`,
  `messages/fr.json`, `src/db/scripts/tenant-categories-seed.ts`, `e2e/tenant-isolation.spec.ts`,
  `e2e/backup-restore.spec.ts`, `docs/architecture.md`, `docs/design-system.md`.
- Voyagent avec la story : recherche, design (.md + .html), ADR 069, ce plan.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : règles pures (clé, garde de portée), service par rôle et par refus
  avec repositories et stockage mockés, ordre des écritures et effacement sur échec, route (statuts et
  en-têtes), actions serveur, composants (états du design, absence de clé dans le HTML), inventaires RLS et
  fichiers.
- **e2e (Playwright, en CI seulement — machine trop juste)** : critères 1 à 5 de bout en bout sur deux
  domaines, preuve RLS par client `pg`, fixture de restauration. La RLS n'est pas testable en unitaire.
- Montage 9p lent : en cas de timeout de worker, revalider sur une copie en disque local ; un timeout n'est
  jamais compté vert.

## Definition of Done

- Une PR `feature/s31-documents-partages`, un commit de story (plus un pour la migration si utile).
- Tests unitaires verts ; e2e verts en CI, dont l'accès anonyme par URL directe, l'accès croisé entre
  associations, l'URL d'un document retiré et la clé sous `/api/files`.
- Aucun `<a href>` vers un chemin de stockage ; aucune nouvelle portée publique ; aucune occurrence de
  `withRlsBypass()` ajoutée.
- Inventaires RLS et clés de fichier à jour ; fixture de restauration complétée.
- Revue passée (`Ship allowed: yes`).
