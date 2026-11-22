# Research — Story s31-documents-partages

## Target story

**En tant que** membre propriétaire **je veux** accéder aux statuts, PV et ordres du jour **afin de**
retrouver les documents de l'association sans les demander au bureau. Complexité 2. Dépendances :
s01b, s03, s03b, s12, s12d (toutes livrées).

Critères d'acceptation :

1. Le bureau dépose un document partagé (titre, catégorie, fichier) et le voit apparaître dans
   l'espace documentaire des membres.
2. Tout membre authentifié consulte et télécharge les documents partagés de son association.
3. Un visiteur non connecté n'accède ni à la liste ni à un fichier, y compris par une URL directe.
4. Les documents d'une association ne sont jamais accessibles depuis une autre.
5. Le bureau retire un document ; il disparaît de la liste et son URL directe cesse de servir le
   fichier.

Notes agentiques retenues : le fichier n'est **jamais** servi par une URL publique devinable ; un
`<a href>` vers un chemin de stockage direct est un échec de review. Adaptateur `local` (ADR 004).
Volumétrie du VPS (100 Go) à considérer. La colonne de clé de fichier **doit** être déclarée dans
l'inventaire de s12c. s32 (documents nominatifs) et s34 (PV d'AG publié comme document partagé)
réutiliseront la route de service authentifiée que pose cette story.

## Current state of the code

Aucune trace de « document partagé » dans `src/` : pas de modèle, pas de route, pas d'écran. Le
`document` annoncé par `docs/architecture.md` (« Documents — `document` (partagé ou nominatif) ») est
une intention, pas une table.

Chaîne la plus proche, à prendre comme patron de bout en bout : **les analyses d'eau (s09, ADR 026)**.

- Modèle `src/db/models/water-analysis-model.ts` : `uuid` par `uuid_generate_v4()`,
  `organization_id` → `organization.id` `onDelete: 'cascade'`, colonnes `…_key` en `text notNull`,
  poids en `integer` (`report_bytes`), `created_at`/`updated_at` `timestamptz`, index
  `(organization_id, sampled_on)`.
- Migration RLS `drizzle/migrations/0025_water_analysis_rls.sql` (générée par
  `drizzle-kit generate --custom`) : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy
  `tenant_isolation` sur `organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  OR current_setting('app.bypass_rls', true) = 'on'`. Dernière migration : `0074_harsh_gertrude_yorkes.sql`.
- Service `src/services/water-analysis-service.ts` : `safeParse` → `requireWaterAnalysisManager`
  (`canPerformAction(getAuthUser(), orgId, ActionIdConst.WATER_ANALYSIS_MANAGE)`) → contrôle du
  fichier par **signature binaire** (`validateContentFile('document', bytes)`) **avant toute
  écriture** → id généré par le serveur → `getContentFileStorage().upload(file, key)` → insertion
  sous `withTenant`, avec effacement des fichiers écrits si l'insertion échoue. Suppression : la
  ligne d'abord (`deleteWaterAnalysisDao` retourne la ligne supprimée), puis `deleteFilesQuietly`
  (un échec disque laisse un orphelin journalisé, jamais une ligne sans fichier).
- Écrans du bureau `src/app/[locale]/(bureau)/bureau/analyses-eau/` (`page.tsx`, `nouvelle/`,
  `[id]/`, `actions.ts` + tests), composants `src/components/features/water-analysis/`.
- e2e `e2e/water-analysis.spec.ts` : deux tenants (`localhost` = TechCorp Solutions, `127.0.0.1` =
  Marketing Pro), `OWNER_A = user-owner@gmail.com`, `MEMBER_A = user@gmail.com`, mot de passe
  `Azerty123`, fixtures PNG/PDF minimales, preuve RLS par client `pg` direct.

Espace membre : `src/app/[locale]/(app)/dashboard/page.tsx` (`withAuth(Page)`), qui passe des
promesses de la DAL `src/app/dal/member-space-dal.ts` à `MemberSpace`
(`src/components/features/member-space/member-space.tsx`). `MemberSpace` a **trois états** :
compte sans fiche (`MemberSpaceWithoutProfile`), fiche sans parcelle (`MemberSpaceWithoutParcels`),
fiche avec parcelles (cartes Terrains, Factures, Coordonnées, Adresses, Signalements, Question,
Sécurité). Chaque carte asynchrone est lue derrière son propre `<Suspense>`.

Barre du bureau : `src/components/features/association/bureau-sidebar.tsx`, `NAV_GROUPS` (groupe
« Site » : pages, accueil, actualités, analyses d'eau, navigation, messages, signalements, bureau,
alerte ; groupe « Association » : propriétaires, questions, groupes, campagnes, envois, identité,
réglages).

## Anchor points

- **Modèle** : nouveau `src/db/models/shared-document-model.ts` (ou `document-model.ts`) + export
  dans `src/db/models/db.ts` (où `water-analysis-model` est réexporté) ; migration générée +
  migration `--custom` pour la RLS.
- **Inventaire de fichiers** : `src/lib/files/file-key-inventory.ts`, `FILE_KEY_COLUMNS` — ajouter
  la colonne de clé. `src/db/file-key-inventory.test.ts` échoue sinon.
- **Classement RLS** : `src/db/rls-inventory.test.ts` + section « Classement RLS des 54 tables »
  de `docs/architecture.md` (« Scopée par une policy RLS forcée — 35 tables ») : décomptes à mettre
  à jour, le test les lit.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts` — une action de
  gestion (`owner`, `board`) et une action de lecture (`owner`, `board`, `member`), lue par
  `canPerformAction`.
- **Catégories** : `association_category` générique (ADR 028) — `CategoryDomainConst`
  (`report`, `question`) dans `src/services/types/domain/association-category-types.ts`, plus les
  deux tables de correspondance `MANAGE_ACTION_OF_DOMAIN` et `USAGE_COUNTS_OF_DOMAIN` de
  `src/services/association-category-service.ts`. s23 a ajouté `question` sans migration et
  réutilise l'écran `ReportCategoriesManager`
  (`src/app/[locale]/(bureau)/bureau/questions/sujets/page.tsx` + `actions.ts`, 158 lignes).
- **Route de lecture authentifiée** : nouvelle route sous `src/app/api/` (ex.
  `src/app/api/documents/[id]/route.ts`), **par identifiant de document**, la clé lue en base —
  aucun chemin ne vient de la requête (patron `GET /api/identity/{kind}` d'ADR 015, plus strict que
  `/api/files/[...key]`). Réponses `no-store` + `nosniff` sur le patron de
  `src/app/api/campaigns/letter-pdf-response.ts` (`emptyResponse`, `pdfAttachment`,
  `refusalResponseOf` : `AuthorizationError` → 403, `ValidationParsedZodError` → 404).
- **Espace membre** : une carte « Documents de l'association » dans `MemberSpace`, lue derrière son
  `<Suspense>` ; à placer dans les trois états (critère 2 : *tout* membre authentifié, y compris un
  compte du bureau sans fiche).
- **Bureau** : nouvel écran `src/app/[locale]/(bureau)/bureau/documents/` + entrée dans
  `NAV_GROUPS`.
- **Libellés** : `messages/fr.json` (next-intl conservé, ADR 008).
- **Seed** : `src/db/scripts/seed.ts` — catégories de premier tenant (Statuts, PV, Ordres du jour)
  comme valeurs de seed (ADR 010), jamais en constantes.

## Verified APIs / functions

- `canPerformAction(user: User | undefined, organizationId: string, actionId: string): boolean` —
  `src/services/authorization/action-registry-authorization.ts`. SuperAdmin passe toujours ; sinon
  rôle de l'appartenance dans **cette** organisation, défaut fermé.
- `getAuthUser()` — `src/services/authentication/auth-service.ts`.
- `withTenant(organizationId, fn)` — `src/db/tenant-scope.ts`.
- `getContentFileStorage(): StorageOperations` — `src/services/content-file-service.ts`
  (`createStorage('local', {bucket: 'pages', …})`, `upload(file, key)`, `download(key): Blob`,
  `delete(key)`).
- `validateContentFile(kind: 'image' | 'document', content: Uint8Array)` — réexport de
  `validatePageBlockFile` (`src/services/types/domain/page-block-types.ts`) : `document` = `pdf`
  seul, **10 Mo** (`PAGE_FILE_MAX_BYTES.document`), format jugé sur la signature.
- `buildContentFileKey(orgId, scope, ownerId, slotId, format)` et `isContentFileKeyAllowed(orgId,
  key, scopes = CONTENT_FILE_SCOPES)` — `src/services/types/domain/content-file-types.ts`.
- `createContentFileGET(scopes = CONTENT_FILE_SCOPES)` — `src/app/api/files/content-file-route.ts`,
  route **publique sans autorisation**, cache `public, max-age=31536000, immutable`.
- `getCurrentTenantDal()` / `requireCurrentTenantDal()` — `src/app/dal/tenant-dal.ts`.
- `requireActionAuth()` — `src/app/dal/user-dal.ts`, utilisé par `openMyInvoicePdfAction`
  (`src/app/[locale]/(app)/dashboard/actions.ts:86`).
- `withAuth(Page)` — `src/components/features/auth/with-auth.tsx`.
- `ReportCategoriesManager` — `src/components/features/incident-report/report-categories-manager.tsx`
  (props `list`, `labels`, `backHref`, `intro`, `showUsageCount`, `create/update/deleteAction`).
- Session : ADR 034 — une session ne s'ouvre sur un domaine que pour un `super_admin` ou un compte
  ayant une ligne `member` dans l'association du domaine (`canOpenSessionOn`). La lecture doit
  néanmoins **re-vérifier** l'appartenance au service (défense en profondeur), pas s'y fier.
- `src/proxy.ts` : le `matcher` **exclut `/api`** (sauf `/api/auth/error`). Une route `/api/…`
  n'est donc pas gardée par le proxy : la route elle-même doit vérifier session et tenant.

## Traps & constraints

- ⚠️ **Ne pas ajouter de portée à `CONTENT_FILE_SCOPES`.** `/api/files/[...key]` sert *toutes* les
  portées enregistrées sans autorisation : un document partagé placé sous une portée de ce tableau
  deviendrait public par sa clé (échec du critère 3). Il faut soit une portée hors de ce tableau,
  soit un constructeur de clé distinct. La clé reste générée par le serveur, préfixée par
  l'`organizationId` (séparation par tenant, ADR 004).
- **Route par identifiant, pas par clé** : la clé n'apparaît jamais dans la page ni dans l'URL ;
  la route lit la ligne sous `withTenant(tenant.id)` (le tenant vient du **domaine**, ADR 003), donc
  un identifiant de l'autre association ne rend rien (RLS), et un document retiré ne rend rien
  (critère 5) — 404 dans les deux cas, sans rien révéler.
- **Pas de cache long** sur la route : `no-store`. Sinon un document retiré reste servi par un cache
  intermédiaire ou le navigateur (critère 5). `Content-Disposition` avec un nom **sans** donnée
  nominative.
- **`proxy.ts` ne protège pas `/api`** : un visiteur non connecté atteint la route ; elle doit
  rendre 401/404 d'elle-même (critère 3, à prouver en e2e par une URL directe).
- **Enveloppe de requête** déjà à 16 Mo (`bodySizeLimit`, `proxyClientMaxBodySize`) ; la garde
  mécanique de `src/services/__tests__/board-member-service.test.ts` porte sur le plus grand plafond
  de `CONTENT_FILE_MAX_BYTES` : rien à changer si le document reste plafonné à 10 Mo.
- **Inventaire s12c** : en plus de `FILE_KEY_COLUMNS`, `e2e/backup-restore.spec.ts` exige qu'**au
  moins une clé de chaque famille existe chez chacune des deux associations** (`seedFixture`, l. ~251,
  insertion directe en base puis nettoyage dans `removeFixture`). Ajouter la famille sans compléter
  cette fixture fait échouer la spec de restauration.
- **Décomptes RLS** : `src/db/rls-inventory.test.ts` lit `docs/architecture.md` ; ajouter une table
  sans mettre à jour la liste et les nombres (54 → 55, 35 → 36) échoue.
- **RLS non testable en unitaire** : `db.ts` refuse toute connexion en test ; l'isolation se prouve
  en e2e (patron `e2e/tenant-isolation.spec.ts`, blocs s19/s54 : hors scope rien ne sort ; dans le
  scope de A seules les lignes de A ; écriture pour l'autre tenant refusée).
- **Rien en dur** (ADR 010) : les catégories (statuts, PV, ordres du jour) sont des valeurs de seed
  du premier tenant. Le plafond de 10 catégories par domaine s'applique (ADR 028).
- **Effacement disque ↔ ligne** (ADR 004 « À surveiller ») : ordre de s09 — ligne supprimée puis
  fichier effacé en silence ; à l'insertion, fichier écrit puis ligne, avec effacement si l'insertion
  échoue.
- **Logger** : jamais dans une fonction `'use cache'`. La liste des documents est une donnée sous
  session : pas de `'use cache'` public ; `<Suspense>` + stream (rule-react-cache-next-cache).
- **e2e en CI uniquement** (machine trop juste) ; tests unitaires lents sur le montage 9p — valider
  sur une copie en disque local si timeouts.
- s32 (nominatifs) et s34 (PV d'AG) bâtiront sur la route et le modèle : garder le modèle de s31
  **partagé** sans anticiper le nominatif (pas de colonne `member_profile_id` « pour plus tard »).

## Open questions

1. **Catégorie** : catégorie administrable (nouveau domaine `document` de `association_category`,
   écran sur le patron des sujets de s23) ou liste fermée ? La règle « rien en dur » oriente vers le
   domaine administrable ; à fixer au plan.
2. **Nom de table** : `shared_document` (explicite, laisse s32 libre de son propre modèle à stockage
   séparé) ou `document` avec discriminant (ce que suggère l'architecture) ? L'exigence de s32
   (dossier physiquement séparé par fiche) pèse pour deux tables ; à fixer au plan, ADR à l'appui.
3. **Formats** : PDF seul (seule nature `document` existante, 10 Mo) suffit-il pour des statuts, PV,
   ordres du jour ? Rien dans la story ne demande Word ou image.
4. **Volumétrie** : se contenter du plafond par fichier (10 Mo), ou afficher/borner un volume total
   par association ? À ~3 documents/an, le plafond par fichier suffit vraisemblablement.
5. **Consultation vs téléchargement** : `inline` (ouverture dans le navigateur) ou `attachment` ?
   Le critère dit « consulte et télécharge ».
