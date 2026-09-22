# Research — Story s05-actualites

## Target story

**En tant que** membre du bureau **je veux** publier des actualités datées **afin d'**informer les
membres et les visiteurs de la vie de l'association.

Complexité 2. Dépend de **s04** (livrée, mergée : `94b4906`, PR #21). Réf. `V5 §4.1`, `CDCT §4.1`,
PRD ligne « Actualités de l'association (mini-blog daté) », critère de succès « le bureau crée,
modifie et publie une page, **une actualité** et une analyse d'eau sans intervention du prestataire ».

### Acceptance criteria (docs/stories.md)

1. Le bureau crée une actualité (titre, date, image, contenu) et la voit apparaître en tête de la
   liste publique une fois publiée.
2. La liste publique est triée par date décroissante et paginée ; chaque actualité a sa page dédiée
   avec une URL stable.
3. Une actualité en brouillon n'apparaît ni dans la liste ni à son URL pour un visiteur.
4. Les actualités d'une association ne sont jamais visibles sur le site d'une autre.

### Notes de la story à tenir

- « Mêmes briques que s04 (éditeur, stockage, cache) : **réemployer** les composants créés par s04 au
  lieu d'en dériver une variante. »
- Troisième modèle de contenu répétable avec s06 (fiches du bureau) et s09 (analyses d'eau) : « si un
  motif commun se dégage, le factoriser **maintenant**, avant que s09 ne fige une troisième
  implémentation divergente ».
- Règles transverses (`docs/stories.md` l. 40-70) : rien en dur, couches, Cache Components, **registre
  d'actions** (toute action soumise à autorisation y est déclarée).
- `docs/reviews/stories.md` : `Stories ready: yes` — le découpage a passé sa revue.

---

## Current state of the code

Vérifié le 22 septembre 2026 sur `main` (`0b328a2`, s03c). s01 → s04b, s12a et s03c sont mergées.
**Aucune trace d'« actualité » dans le code** : `grep -rni actualite src messages/fr.json e2e` ne rend
rien.

### Le blog hérité — ce que `posts` est réellement

`src/db/models/post-model.ts` (tables `posts`, `posts_translation`, `categories`, `hashtags`,
`post_hashtags`) est le blog **multilingue** du boilerplate :

- `posts` : `status` (`post_status` = `draft | published | archived`), `authorid` (FK `user`),
  `categoryid`, `createdat` / `updatedat` **sans fuseau** (`mode: 'date'`), `nbview`, `nblike`.
  **Aucune colonne de date de publication, aucune image, aucun `organization_id`.**
- `posts_translation` : `language` (défaut `fr`), `title`, `slug` **unique globalement**
  (`text('slug').notNull().unique()`), `content` (texte markdown/MDX), `description`, `meta_*`.
  Unique `(postid, language)`.
- `categories.name` et `hashtags.name` : **uniques globalement**.

Ce blog est **vivant**, pas dormant :

- Routes publiques `src/app/[locale]/(public)/blog/**` (liste, pagination `/blog/page/[page]`,
  catégories, article `/blog/[slug]`), gardées par `isPageEnabled(PagesConst.BLOG)`
  (`src/lib/utils.ts:14`) — et `NEXT_PUBLIC_ENABLED_PAGES` contient `blog` dans `.env.development`,
  `.env.test`, `.env.local` **et** `.github/workflows/ci.yml:44`.
- Back-office **SuperAdmin** `src/app/[locale]/admin/blog/**` (création, édition, publication).
- `src/app/dal/blog-dal.ts` fusionne **deux sources** : la base (`getPublishedPostsWithTranslationsService`)
  et des fichiers MDX de `content/blog/` (4 articles du boilerplate : `001-bienvenue`, `002-proxy-pattern`,
  `003-intro-nextjs`, `004-tailwind-v4`). Rendu par `MDXContent` (`await connection()`, non cachable).
- `src/app/sitemap.ts:90-116` publie `/blog` et tous les slugs de blog.
- `src/db/scripts/seed.ts:362-430` insère des posts traduits en fr/en/es, sans organisation.

`docs/architecture.md` (classement RLS, l. 253-260) range ces 5 tables dans « contenu du socle, pas
encore rattaché à un tenant — exemptées en attendant leur story », et nomme la story « actualités »
comme celle qui les scope. L'ADR 009 (l. 104, 130) conserve `post` comme « base des actualités s05 ».
**Mais** `docs/architecture.md` l. 200 liste aussi `news` parmi les modèles à champs fixes, et l'ADR 007
dit que les contenus répétables sont des modèles à **champs fixes**. Voir Trap 1.

### La chaîne « pages » de s04 — ce qui existe et se réemploie

| Couche         | Fichier                                                                           | Ce qu'il fait                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle         | `src/db/models/page-model.ts`                                                     | `page` : `organization_id` (FK cascade), `slug`, `title`, `status` (`page_status` = `draft \| published \| unpublished`), `created_at`/`updated_at` **avec fuseau** ; unique `(organization_id, slug)`.                                                                    |
| Modèle         | `src/db/models/content-block-model.ts`                                            | `content_block` : `page_id` **NOT NULL** FK `page`, `type` texte, `rank`, `data` jsonb. Pas d'`organization_id` : la policy joint `page`.                                                                                                                                  |
| Migration RLS  | `drizzle/migrations/0013_page_content_block_rls.sql`                              | Patron à reprendre : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation` sur `NULLIF(current_setting('app.organization_id', true), '')::uuid` ou `app.bypass_rls = 'on'`. Autres exemples : `0007`, `0009`, `0015`.                                           |
| Repository     | `src/db/repositories/page-repository.ts`                                          | `getDb()` partout ; `getPagesByOrganizationDao` (tri `updatedAt desc`), `getPageByIdDao`, `getPageBySlugDao`, `createPageDao`, `updatePageDao`, `updatePageStatusDao`, `reorderPageBlocksTxnDao`.                                                                          |
| Types domaine  | `src/services/types/domain/page-block-types.ts`                                   | Schéma Zod discriminé des 5 blocs, `RESERVED_PAGE_SLUGS` (ADR 020), validation « obligatoire pour publier », **signatures binaires** des fichiers, `buildPageBlockFileKey`, `isPageBlockFileKeyAllowed`.                                                                   |
| Types domaine  | `src/services/types/domain/page-types.ts`                                         | `PageDTO`, `PageWithBlocksDTO`, `PAGE_SLUG_UNAVAILABLE`, résultats de mutation/publication.                                                                                                                                                                                |
| Validation     | `src/services/validation/page-validation.ts`                                      | `pageSlugSchema` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 80), `pageTitleSchema` (1-160), schémas de service.                                                                                                                                                                    |
| Service        | `src/services/page-service.ts`                                                    | Ordre `safeParse` → `requirePageManager` (`canPerformAction(..., PAGE_MANAGE)`) → écriture sous `withTenant`. Lectures publiques **sans autorisation, délibérément**. Upload et lecture de fichiers de bloc.                                                               |
| Façade         | `src/services/facades/page-service-facade.ts`                                     | Réexporte les méthodes de `interceptors/page-service-logger-interceptor.ts`.                                                                                                                                                                                               |
| DAL            | `src/app/dal/page-dal.ts`                                                         | `pageTag(orgId, slug)` ; lecture interne `'use cache'` + `cacheLife('hours')` + `cacheTag` ; `getPublicPageBySlugDal` (publiée ou rien) ; `getPageBySlugForPreviewDal` (sans cache) ; `getPagesForBureauDal`, `getPageForBureauDal`, `canManageCurrentPagesDal`.           |
| Rendu          | `src/lib/cms/render-page-block.ts`                                                | Rendu **pur et synchrone** `remark` → `remark-html` avec schéma de sanitisation restreint ; `renderPageBlock` est le **seul export** de rendu (`renderMarkdown`, `escapeHtml`, `fileUrl` sont privés). `PAGE_BLOCK_FILE_ROUTE = '/api/pages/files'`.                       |
| Route fichier  | `src/app/api/pages/files/[...key]/route.ts`                                       | Tenant du domaine, clé de la requête validée contre `{orgId}/pages/`, `nosniff`, cache long `immutable`.                                                                                                                                                                   |
| Route publique | `src/app/[locale]/(public)/[slug]/page.tsx`                                       | `/{slug}` à la racine (ADR 020) ; publiée ou `notFound()` ; aperçu du bureau avec bandeau `PublicCmsPage.previewDraft/previewUnpublished`.                                                                                                                                 |
| Back-office    | `src/app/[locale]/(bureau)/bureau/pages/{page.tsx,[id]/page.tsx,[id]/actions.ts}` | Liste + éditeur derrière `<Suspense>`, contrôle d'accès répété (`BureauAccessDenied`). Actions : `createPageAction` (crée puis `redirect`), `savePageDraftAction`, `publishPageAction`, `unpublishPageAction`, `uploadPageBlockFileAction` ; `updateTag` **après** succès. |
| Composants     | `src/components/features/pages/`                                                  | `page-editor.tsx` (500 l.), `pages-list.tsx`, `blocks/*-block-form.tsx`, `blocks/restricted-markdown-editor.tsx` (barre réduite §2.1), `blocks/block-form-types.ts` (`pageBlockFileUrl`).                                                                                  |
| Primitives UI  | `src/components/ui/`                                                              | `preview-bar.tsx` (`PreviewBarStatus`), `sortable-list.tsx`, `block-picker.tsx`, `pagination.tsx`, `file-upload.tsx`, `table.tsx`, `badge.tsx`.                                                                                                                            |
| e2e            | `e2e/page-cms.spec.ts`                                                            | Tenants A = `http://localhost:PORT` (TechCorp), B = `http://127.0.0.1:PORT` (Marketing Pro) ; comptes `user-owner@gmail.com` (Présidente A), `user@gmail.com` (membre simple A), `user-admin@gmail.com` (bureau B) ; preuve RLS en SQL direct sous le rôle applicatif.     |

### Navigation (s04b)

`menu_item.page_id` est **NOT NULL** (FK `page`, `src/db/models/menu-item-model.ts`) et
`PublicMenuEntryDTO = {id, title, slug}` : le menu public ne peut pointer **que vers une page CMS**.
Voir Trap 8.

### Sidebar du bureau

`src/components/features/association/bureau-sidebar.tsx:21-36` : `NAV_GROUPS` — « Le site »
(`/bureau/pages`, `/bureau/navigation`) puis « L'association » (`/bureau/identite`, `/bureau/reglages`),
libellés sous `BureauIdentityPage.nav` dans `messages/fr.json`.

---

## Anchor points

- **Modèle + migration** : `src/db/models/` (nouveau fichier ou `post-model.ts`, voir Trap 1),
  enregistré dans `src/db/models/db.ts` (`schema: {...page, ...menuItem, ...}` l. 32-43) ; policy RLS par
  `drizzle-kit generate --custom` sur le patron `0013`/`0015`. Dernière migration : `0015_menu_item_rls.sql`.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts` — `ActionIdConst`
  (l. 43-60) et `ACTION_REGISTRY` (l. 62-79). Entrées existantes : `ASSOCIATION_IDENTITY_UPDATE`,
  `ASSOCIATION_SETTINGS_UPDATE`, `PAGE_MANAGE` (`'page.manage'`, un seul id pour créer/modifier/publier/
  dépublier), `SITE_NAVIGATION_MANAGE`, toutes `['owner', 'board']`. s05 y ajoute la sienne.
- **Service** : gabarit `src/services/page-service.ts` (ordre validé → autorisé → `withTenant`).
- **DAL + invalidation** : gabarit `src/app/dal/page-dal.ts` + `updateTag` dans les actions de
  `bureau/pages/[id]/actions.ts`. Pour une liste, il faudra un tag de **liste par association** en plus
  du tag par actualité.
- **Routes publiques** : nouveau segment sous `src/app/[locale]/(public)/` (liste paginée + page
  dédiée). **À ajouter à `RESERVED_PAGE_SLUGS` dans le même commit** (ADR 020, commentaire l. 83-86 de
  `page-block-types.ts`).
- **Back-office** : nouvelle route sous `src/app/[locale]/(bureau)/bureau/`, entrée dans le groupe
  `siteGroup` de `NAV_GROUPS`.
- **Fichiers** : `createStorage('local', {...})` (`src/lib/files/storage/storage-factory.ts`), patron
  `getPageFileStorage` de `page-service.ts` (bucket `'pages'`).
- **e2e** : nouveau `e2e/<…>.spec.ts` sur le patron de `e2e/page-cms.spec.ts` (mêmes tenants, mêmes
  comptes, preuve RLS en SQL direct).

## Verified APIs / functions

| Nom                                          | Fichier                                                               | Signature vérifiée                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireCurrentTenantDal`                    | `src/app/dal/tenant-dal.ts:93`                                        | `() => Promise<TenantDTO>`                                                                                                                                                  |
| `getCurrentTenantDal`                        | `src/app/dal/tenant-dal.ts:71`                                        | `cache(...)`, rend le tenant ou `undefined` (utilisé par la route fichiers)                                                                                                 |
| `withCurrentTenant`                          | `src/app/dal/tenant-dal.ts:112`                                       | `<T>(callback: () => Promise<T>) => Promise<T>`                                                                                                                             |
| `getDb` / `withTenant` / `withRlsBypass`     | `src/db/tenant-scope.ts:122/128/144`                                  | `getDb(): ScopedDb` ; `withTenant(organizationId, callback)` ; `withRlsBypass(callback)`                                                                                    |
| `canPerformAction`                           | `src/services/authorization/action-registry-authorization.ts`         | `(user, organizationId, actionId) => boolean` — SuperAdmin passe, action absente refusée                                                                                    |
| `canManageAssociation`                       | `src/services/authorization/association-authorization.ts`             | `(user, organizationId) => boolean` — sert l'**affichage**, pas la mutation                                                                                                 |
| `getAuthUser`                                | `src/services/authentication/auth-service`                            | importé par `page-service.ts`                                                                                                                                               |
| `requireActionAuth`                          | `src/app/dal/user-dal`                                                | appelé en tête de chaque Server Action de pages                                                                                                                             |
| `pageTag`                                    | `src/app/dal/page-dal.ts`                                             | `(organizationId, slug) => 'page:<org>:<slug>'`                                                                                                                             |
| `siteNavigationTag`                          | `src/app/dal/site-navigation-dal.ts:31`                               | `(organizationId) => string`                                                                                                                                                |
| `renderPageBlock`                            | `src/lib/cms/render-page-block.ts`                                    | `(block: {type: string; data: unknown}) => string \| null` — un bloc `{type:'text', markdown}` passe par le même schéma sanitisé                                            |
| `RestrictedMarkdownEditor`                   | `src/components/features/pages/blocks/restricted-markdown-editor.tsx` | props `{value, onChange, label, placeholder?}` — indépendant des pages                                                                                                      |
| `ImageBlockForm`                             | `src/components/features/pages/blocks/image-block-form.tsx`           | `BlockFormProps<ImageBlock>` = `{data, onChange, onUpload(file, kind)}` — l'upload est **injecté**, l'URL d'aperçu vient de `pageBlockFileUrl` (préfixe `/api/pages/files`) |
| `validatePageBlockFile`                      | `page-block-types.ts`                                                 | `(kind: 'image' \| 'document', content: Uint8Array) => PageFileValidation` — signature binaire, 5 Mo image / 10 Mo PDF                                                      |
| `buildPageBlockFileKey`                      | `page-block-types.ts`                                                 | `(orgId, pageId, blockId, format) => '{org}/pages/{page}/{block}-{uuid}.{ext}'` — **lié à la page**                                                                         |
| `isPageBlockFileKeyAllowed`                  | `page-block-types.ts`                                                 | n'accepte que le préfixe `{org}/pages/`                                                                                                                                     |
| `uploadPageBlockFileService`                 | `page-service.ts`                                                     | exige `pageId` + `blockId` et vérifie que la **page** existe                                                                                                                |
| `RESERVED_PAGE_SLUGS` / `isPageSlugReserved` | `page-block-types.ts`                                                 | liste explicite ; contient déjà `blog`, pas encore de segment « actualités »                                                                                                |
| `PreviewBar`, `PreviewBarStatus`             | `src/components/ui/preview-bar.tsx:19,56`                             | statuts client `draft \| dirty \| live \| publishing \| error \| unpublished`                                                                                               |
| `isPageEnabled`, `PagesConst.BLOG`           | `src/lib/utils.ts:14`, `src/env.ts:22-23`                             | garde du blog hérité, piloté par `NEXT_PUBLIC_ENABLED_PAGES`                                                                                                                |
| `updateTag`                                  | `next/cache`                                                          | usage réel : `bureau/pages/[id]/actions.ts`, `bureau/reglages/actions.ts`                                                                                                   |

## Traps & constraints

1. **`posts` ou une table dédiée — les documents se contredisent, le code penche nettement.**
   L'ADR 009 et le classement RLS de `docs/architecture.md` désignent `posts` comme « base des
   actualités » ; l'ADR 007 et `docs/architecture.md` l. 200 parlent d'un modèle `news` à champs fixes.
   Ce que coûterait le réemploi de `posts`, vérifié dans le code :
   - forme inadaptée : multilingue (`posts_translation`) alors que l'ADR 008 fixe `fr` seule ; slug
     **unique global** (contraire à l'isolation — même anti-patron que s04 a refusé pour `page`) ;
     catégories et hashtags uniques globalement ; `nbview`/`nblike` ; `archived` au lieu d'`unpublished` ;
     **ni date de publication ni image** — deux des quatre champs du critère 1 ;
   - **casse de l'existant** : poser `organization_id` + RLS forcée sur `posts` rend vides, sans erreur,
     `/blog`, `/admin/blog` (SuperAdmin, hors tenant), `sitemap.ts` et le seed — tous lisent hors
     `withTenant`. « Un oubli de scope ne retourne rien. »
   - Une table dédiée laisse en revanche `posts` exemptée dans le classement RLS, où elle est rangée
     « en attendant leur story » : la ligne de `docs/architecture.md` doit alors être **réécrite**
     (destin du blog hérité), pas laissée en suspens.
     Décision structurante → **ADR** au plan, qui supersède ou précise l'ADR 009 sur ce point. Aucun test
     automatique ne vérifie le classement RLS (recherche faite dans `e2e/` et `src/`) : c'est un tableau de
     documentation à tenir à jour à la main (compte actuel : « 24 tables »).
2. **`content_block` ne peut pas porter le contenu d'une actualité tel quel** : `page_id` NOT NULL,
   FK `page`, policy qui joint `page`. Réemployer les blocs = modifier le schéma de s04 (colonne
   polymorphe ou table de jonction). Un champ `content` markdown unique, rendu par la **même** chaîne
   sanitisée que le bloc texte, respecte l'ADR 007 (« champs fixes ») — mais `renderMarkdown` est
   privé : il faut soit l'exporter, soit appeler `renderPageBlock({type: 'text', data: {markdown}})`.
3. **Toute la chaîne de fichiers de s04 est liée à la page** : clé `{org}/pages/{pageId}/{blockId}-…`,
   `isPageBlockFileKeyAllowed` n'accepte que `/pages/`, `uploadPageBlockFileService` vérifie l'existence
   de la **page**, route `/api/pages/files`, `pageBlockFileUrl` codé sur ce préfixe dans
   `ImageBlockForm`. L'image d'une actualité ne passe dans aucun de ces contrôles sans modification.
   C'est le premier point de factorisation que la note de la story vise (s06 photo, s09 PDF suivront) :
   généraliser clé/route par « nature de contenu », ou dupliquer par modèle. Le contrôle par
   **signature binaire** (`validatePageBlockFile`) est déjà générique et se réemploie tel quel.
4. **s12c lira les colonnes de clés de fichier** (`docs/stories.md` l. 1300-1312) : l'inventaire doit
   savoir si l'image d'une actualité a « sa propre colonne » ou réutilise celle de s04, et une
   **convention reconnaissable** de colonne de clé est attendue. Existant : `identity_logo_key`,
   `identity_favicon_key` (suffixe `_key`, `organization`) ; les clés de blocs de page vivent **dans le
   jsonb**, donc invisibles à une détection par colonne. Une colonne `…_key` dédiée à l'actualité suivrait
   le seul précédent en colonne.
5. **Nouveau segment racine = collision possible avec une page existante.** Les pages vivent à
   `/{slug}` (ADR 020) ; un segment statique `/actualites` (ou autre) **gagne** sur `(public)/[slug]` dans
   le routage Next. Une association qui aurait déjà créé en s04 une page de slug identique la verrait
   disparaître sans message. Ajouter le segment à `RESERVED_PAGE_SLUGS` empêche les nouvelles, pas les
   existantes : vérifier en base (seed, e2e, données réelles) avant de choisir le nom.
6. **Tri et date.** Critère 2 : tri « par date décroissante » — la date de l'actualité, saisie par le
   bureau (critère 1 : « titre, **date**, … »), pas `created_at`. Deux actualités de même date demandent
   un départage stable (sinon la pagination saute ou répète une ligne). Une colonne `date` sans heure
   évite les ambiguïtés de fuseau (`page` utilise `withTimezone: true` ; `posts` non).
7. **Cache Components.** Liste publique paginée en `'use cache'` : clé = `(organizationId, numéro de
page)`, tag de liste par association invalidé à chaque publication, dépublication, modification
   d'une actualité publiée **et** changement de date (qui déplace l'actualité dans la liste). Aucun
   `new Date()` dans le scope : une actualité « datée dans le futur » ne peut pas être masquée par
   comparaison à l'horloge dans une lecture cachée (voir Open question 4). Compromis hérité à connaître :
   la façade appelée depuis un scope caché passe par l'intercepteur de log (commentaire de
   `page-dal.ts`) — ne pas l'aggraver par un appel direct à `logger`.
8. **Le menu ne sait pas pointer vers la liste des actualités** (`menu_item.page_id` NOT NULL). Sans
   modification de s04b, un visiteur ne trouve `/actualites` que par un lien écrit à la main dans une
   page ou le pied de page. Hors critères de s05, mais le public visé ne tape pas d'URL.
9. **Registre d'actions** : déclarer l'action (ex. une entrée unique « gérer les actualités »,
   `['owner','board']`, sur le précédent `PAGE_MANAGE`) — l'oublier est un défaut de revue.
   `canManageAssociation` reste pour décider l'**affichage** (sidebar, aperçu).
10. **Aperçu d'un brouillon** : les critères ne l'exigent pas, mais s04 l'a posé (`resolvePage` :
    publiée, sinon aperçu si `canManageCurrent…`). Le critère 3 impose seulement 404 **pour un
    visiteur** — le même patron le satisfait.
11. **Rien en dur** : la taille de page de la liste publique et le libellé des contrôles de pagination.
    Le design system (§2.1, l. 361) donne « 25 lignes par page, 10 sous 640 px » pour les **tableaux** du
    back-office, pas pour une liste publique. Libellés dans `messages/fr.json`.
12. **Design system** : l'icône `Megaphone` est réservée à « actualité » (§1.7, l. 311) ; l'état vide
    est déjà rédigé (§3.2, l. 552 : « Aucune actualité pour l'instant. → Écrire la première ») ; dates en
    clair côté public (« 2 septembre 2026 »), `02/09/2026` en tableau et en champ (§3.6, l. 590). Aucune
    carte d'actualité ni liste publique n'est maquettée : `/ks-design s05` doit composer avec l'existant
    et remonter un gap plutôt qu'inventer.
13. **`page-editor.tsx` fait 500 lignes et est spécifique aux blocs** (`EMPTY_BLOCK`, `SortableList`,
    `BlockPicker`) : le réemploi porte sur ses **pièces** (`PreviewBar`, `RestrictedMarkdownEditor`,
    `ImageBlockForm` si son `onUpload` et son URL d'aperçu sont injectables), pas sur l'éditeur entier.
14. **Blog hérité encore exposé** : tant que `blog` reste dans `NEXT_PUBLIC_ENABLED_PAGES` (dev, test,
    CI), le site de chaque association sert `/blog` avec les 4 articles MDX du boilerplate et les posts
    du seed, **identiques pour tous les tenants**. Deux « fils d'actualité » coexisteraient. Hors critères,
    mais à trancher avec le Trap 1.
15. **Process** : `pnpm test --run` ; migrations par `pnpm db:generate` / `drizzle-kit generate --custom`,
    jamais de SQL ni de journal écrits à la main ; `feature/s05-actualites` à brancher depuis `main` à
    jour (`0b328a2`). Ce fichier de recherche voyage avec cette branche.

## Open questions

1. **Table dédiée ou réemploi de `posts` ?** Le code (Trap 1) plaide pour une table dédiée à champs
   fixes ; l'ADR 009 dit l'inverse. À trancher au plan, par un ADR — et avec lui le **sort du blog
   hérité** (`/blog`, `/admin/blog`, `content/blog/`, `sitemap.ts`, seed, `PagesConst.BLOG`) : laissé tel
   quel, désactivé par configuration, ou retiré par une story propre.
2. **Forme du contenu** : un champ markdown unique au rendu sanitisé de s04, ou des blocs (qui
   imposent de modifier `content_block`) ? L'ADR 007 penche pour le champ fixe.
3. **Factorisation fichiers (Trap 3)** : généraliser maintenant la clé et la route de lecture à
   plusieurs natures de contenu (actualité, puis photo de fiche s06, PDF s09), ou ajouter une chaîne
   par modèle ? La note de la story demande de trancher **ici**, avant s09. Nom et convention de la
   colonne de clé à fixer en même temps (Trap 4, attendu par s12c).
4. **Sémantique de la date** : date de publication choisie par le bureau (antidatable ?), date
   d'événement, ou horodatage automatique de publication ? Une date future cache-t-elle l'actualité ?
   (Si oui, ce n'est pas faisable dans une lecture `'use cache'` sans horloge — Trap 7.) L'image est-elle
   obligatoire pour publier, et le texte alternatif aussi (comme le bloc image de s04) ?
5. **URL** : nom du segment de liste et de la page dédiée (`/actualites` + `/actualites/{slug}` ?), slug
   dérivé du titre et figé, ou identifiant ? « URL stable » (critère 2) : un changement de titre ne doit
   pas casser l'adresse. Vérifier l'absence de page CMS de même slug (Trap 5).
6. **Taille de page de la liste publique** : paramètre d'association (registre ADR 016) ou constante
   d'affichage ? Le design system ne la fixe pas pour une liste publique.
7. **Accès à la liste depuis le site** (Trap 8) : lien depuis le menu hors périmètre de s05, ou petite
   extension de `menu_item` ? À signaler, pas à ajouter en silence.
8. **Suppression d'une actualité** : les critères ne parlent que de créer, publier, brouillon. La
   dépublication (acquise pour les pages) suffit-elle, ou faut-il supprimer ? Si suppression, que devient
   le fichier image ?
