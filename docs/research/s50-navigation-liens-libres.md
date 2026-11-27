# Research — Story s50-navigation-liens-libres

## Target story

**En tant que** membre du bureau **je veux** ajouter au menu une entrée composée d'un libellé et d'une
adresse, interne ou externe, **afin que** le visiteur atteigne le formulaire de contact, les actualités
ou un site partenaire depuis le menu, sans que j'aie à fabriquer une page pour cela. Complexité 2.
Dépendance : s04b (mergée, PR #22, `1c583bac`). Story hors du tableau de périmètre du PRD, ajoutée le
5/11/2026 pendant la recette de s12b ; elle **élargit** s04b sans lever sa règle « une seule profondeur
de menu ».

Critères d'acceptation (docs/stories.md:3827) :

1. Le bureau ajoute une entrée « libellé + adresse » : **chemin interne** (commence par `/`) ou
   **adresse externe** en `https://`. Elle s'ordonne, se retire et se masque comme une entrée de page
   (s04b, critères 1 et 6).
2. Le menu public affiche l'entrée à sa place ; l'entrée externe porte `rel="noopener noreferrer"`.
3. Adresse refusée = rien d'enregistré, erreur **sur le champ** : schéma autre que `https`
   (`javascript:`, `data:`, `http:`…), adresse relative au protocole (`//hôte`), libellé vide. Testé,
   **y compris côté serveur**.
4. Les entrées de page existantes restent inchangées par la migration et continuent de s'afficher ;
   une entrée ne vise **jamais à la fois** une page et une adresse — **contrainte en base**.
5. Scopée au tenant, prouvée par un test d'accès croisé entre deux tenants (RLS déjà forcée).
6. Ajouter, **modifier** ou retirer une entrée libre met le menu à jour sans délai (même invalidation
   que s04b).
7. Un membre non-bureau ne peut ni ajouter ni modifier.

Notes agentiques retenues : migration par `pnpm db:generate` ; **liste blanche** (chemin interne ou
`https://`), même validation à l'écriture **et au rendu** ; vérifier que `updateTag` de s04b couvre
les entrées libres ; piège s34 (lien libre vers un module désactivé) à trancher au plan ; **ne pas**
valider l'existence de la route interne, **ne pas** ouvrir de nouvel onglet, **ne pas** toucher au
pied de page ; l'écran existe, l'entrée libre est une variante de son formulaire, composée du design
system.

## Current state of the code

### Persistance

- `src/db/models/menu-item-model.ts` — table `menu_item` : `id` (uuid, `uuid_generate_v4()`),
  `organization_id` (NOT NULL, FK `organization` cascade), `page_id` (**NOT NULL**, FK `page`
  `onDelete: 'cascade'`), `rank` (integer NOT NULL), `visible` (boolean, défaut `true`),
  `created_at`/`updated_at` (timestamptz). Contrainte `unique('menu_item_organization_page_unique')`
  sur `(organization_id, page_id)`. `menuItemRelations` : `page: one(page, …)`. Types
  `MenuItemModel`, `AddMenuItemModel`. **Aucun libellé propre** : le texte affiché est
  `page.title`.
- Migrations : `drizzle/migrations/0014_remarkable_red_shift.sql` (création, générée) et
  `0015_menu_item_rls.sql` (custom : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy
  `tenant_isolation` `USING (organization_id = NULLIF(current_setting('app.organization_id', true),
  '')::uuid OR current_setting('app.bypass_rls', true) = 'on')`, FOR ALL sans WITH CHECK → le USING
  vaut WITH CHECK). La policy ne porte que sur `organization_id` : **ajouter des colonnes ne la
  touche pas**, aucune migration RLS à écrire.
- Dernière migration : `0086_charming_ego` (journal idx 86) → la migration de s50 sera `0087_*`.
- Dernier ADR : `077-…` → un ADR de s50 serait `078`.
- `src/db/repositories/menu-item-repository.ts` (tout sous `getDb()`, scope par l'appelant) :
  - `MenuItemRow` (l. 12) : `{id, organizationId, pageId: string, rank, visible, pageTitle: string,
    pageSlug: string, pageStatus: PageModel['status']}`.
  - `getMenuItemsByOrganizationDao(organizationId)` (l. 28) : `select … from(menuItem)
    .innerJoin(page, eq(menuItem.pageId, page.id))` + `orderBy(asc(menuItem.rank))`.
  - `addMenuItemDao({organizationId, pageId, rank})` (l. 47) → `MenuItemModel`.
  - `removeMenuItemDao(organizationId, menuItemId)` (l. 56), `setMenuItemVisibilityDao(organizationId,
    menuItemId, visible)` (l. 70), `reorderMenuItemsTxnDao(organizationId, orderedIds)` (l. 92, une
    transaction, rang = index dans le tableau). Toutes filtrent `id` **et** `organization_id`.
  - **Aucune DAO de modification** (libellé/cible) : s04b n'avait rien à modifier.
- Seed (`src/db/scripts/seed.ts`) : **aucune** ligne `menu_item`. TechCorp Solutions (`localhost`,
  `enabled_modules = '{voirie}'`) et Marketing Pro (`127.0.0.1`, `'{}'`) sont les deux tenants e2e.

### Service, façade, validation, types

- `src/services/site-navigation-service.ts` :
  - `requireNavigationManager(organizationId)` (l. 53, interne) : `getAuthUser()` +
    `canPerformAction(authUser, organizationId, ActionIdConst.SITE_NAVIGATION_MANAGE)`, sinon
    `AuthorizationError`.
  - `addMenuItemService({organizationId, pageId})` (l. 77) : `safeParse` → contrôle d'accès →
    `withTenant` → `getPageByIdDao` (sinon `NotFoundError`) → doublon détecté en lisant tout le menu
    (`MENU_ITEM_ALREADY_IN_MENU` rendu en résultat, pas levé) → `addMenuItemDao` au rang
    `existing.length` → `{status: 'added', item}` (DTO construit à la main depuis la page).
  - `removeMenuItemService` (l. 123), `reorderMenuItemsService` (l. 144),
    `setMenuItemVisibilityService` (l. 164) : même gabarit, **indépendants du type d'entrée** (ils
    n'agissent que par `menuItemId`) — ils serviront tels quels les entrées libres.
  - `getMenuItemsForBureauService(organizationId)` (l. 190) → `MenuItemDTO[]` via `toMenuItemDto`
    (l. 43).
  - `getPublicSiteNavigationService(organizationId)` (l. 282) : **sans contrôle d'autorisation
    (délibéré)**, `withTenant`, filtre `row.visible && row.pageStatus === 'published'`, mappe
    `{id, title: row.pageTitle, slug: row.pageSlug}` + `footerContent`. Exécuté **dans** le scope
    `'use cache'` du DAL : doit rester pur (pas d'horloge, pas de `headers()`).
  - `canManageSiteNavigationService` (l. 311).
- Façade `src/services/facades/site-navigation-service-facade.ts` : réexporte chaque méthode depuis
  `interceptors/site-navigation-service-logger-interceptor.ts` (`createServiceInterceptor(…,
  'SITE-NAVIGATION-SERVICE', {shouldLogDetails: () => false})`, import `* as` du service : une
  nouvelle fonction exportée du service est interceptée d'office, mais **doit être réexportée à la
  main** dans la façade).
- Autorisation : `ActionIdConst.SITE_NAVIGATION_MANAGE = 'site.navigation.manage'`
  (`src/services/types/domain/action-registry-types.ts:59`), `defaultRoles: ['owner', 'board']`
  (l. 203) ; `canPerformAction` (`src/services/authorization/action-registry-authorization.ts:18`) :
  SuperAdmin partout, sinon rôle de la ligne `member`. Testé par
  `src/services/__tests__/action-registry-authorization.test.ts:41`. **Rien à ajouter** : la même
  action couvre l'entrée libre (critère 7).
- Validation `src/services/validation/site-navigation-validation.ts` :
  `siteNavigationOrganizationIdSchema`, `menuItemIdSchema` (uuid), `addMenuItemServiceSchema
  {organizationId, pageId}`, `menuItemMutationServiceSchema`, `reorderMenuItemsServiceSchema`,
  `setMenuItemVisibilityServiceSchema`, `saveSiteFooterServiceSchema` (+ `SITE_FOOTER_MAX_LENGTH`).
  Zod `^4.4.3`. **Pas de test unitaire dédié** au fichier de validation.
- Types `src/services/types/domain/site-navigation-types.ts` :
  - `MenuItemDTO` : `{id, pageId: string, rank, visible, pageTitle: string, pageSlug: string,
    pageStatus: PageStatus}`.
  - `PublicMenuEntryDTO` : `{id, title, slug}` — **une entrée publique = un slug**.
  - `SiteNavigationDTO {menu: PublicMenuEntryDTO[], footerContent}` ;
    `MENU_ITEM_ALREADY_IN_MENU` ; `MenuItemMutationResult = {status: 'added'; item} | {status:
    'rejected'; error}`.

### DAL et cache

- `src/app/dal/site-navigation-dal.ts` :
  - `siteNavigationTag(organizationId)` → `` `site-navigation:${organizationId}` `` — **un seul tag**
    pour menu + pied de page (ADR 021).
  - `readPublicSiteNavigationCached` (interne) : `cache(async (organizationId) => { 'use cache';
    cacheLife('hours'); cacheTag(siteNavigationTag(organizationId)); return
    getPublicSiteNavigationService(organizationId) })`.
  - `getPublicSiteNavigationDal(organizationId)`, `getCurrentPublicSiteNavigationDal()` (tenant du
    domaine), `getSiteNavigationForBureauDal(organizationId)` (non caché),
    `canManageCurrentSiteNavigationDal()`.
- Invalidation `updateTag(siteNavigationTag(tenant.id))` : dans **chaque** action de
  `src/app/[locale]/(bureau)/bureau/navigation/actions.ts` (après succès seulement), et dans
  `publishPageAction` / `unpublishPageAction` de `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts`
  (l. 185, l. 213). Le tag porte l'organisation, pas le type d'entrée : **une nouvelle action
  (ajout/modification d'une entrée libre) qui appelle `updateTag(siteNavigationTag(tenant.id))`
  après succès est couverte**. Le piège n'est que l'oubli de cet appel dans l'action neuve.
- Il n'existe pas d'action de suppression de page : la cascade `page_id` n'a pas d'invalidation à
  porter (inchangé).

### Server Actions (écran bureau)

`src/app/[locale]/(bureau)/bureau/navigation/actions.ts` : `failure(error)` (l. 33, traduit
`BureauNavigationPage.errors.forbidden|failed`), `addMenuItemAction(pageId)` (l. 44),
`removeMenuItemAction(menuItemId)`, `reorderMenuItemsAction(orderedIds)`,
`setMenuItemVisibilityAction(menuItemId, visible)`, `saveSiteFooterAction(content)`. Gabarit :
`requireCurrentTenantDal()` → `try { requireActionAuth(); service; updateTag; return {status} } catch
→ failure`. **Arguments typés, pas de `FormData`** ; les types de résultat
`SiteNavigationActionResult` / `SiteNavigationAddResult` sont **exportés du composant client**
(`site-navigation-manager.tsx`). Aucune action ne rend aujourd'hui d'erreur **par champ** : un refus
est un message global (`Alert` en tête de la carte).

### Écran bureau

- `src/app/[locale]/(bureau)/bureau/navigation/page.tsx` : RSC, `Suspense` →
  `SiteNavigationSection` (contrôle `canManageCurrentSiteNavigationDal`, sinon
  `<BureauAccessDenied />`) → `getSiteNavigationForBureauDal` + `getPagesForBureauDal` →
  `<SiteNavigationManager … addAction removeAction reorderAction setVisibilityAction
  saveFooterAction />`.
- `src/components/features/navigation/site-navigation-manager.tsx` (`'use client'`, 443 l.) :
  - État optimiste `items`, `apply(run)` (transition + `menuError`), `reorder`, `toggleVisibility`,
    `remove` (bandeau d'annulation 10 s), **`undoRemoval` recrée l'entrée par
    `addAction(removed.pageId)`** puis rejoue l'ordre, `add(pageId)`.
  - `addablePages` filtre par `item.pageId`.
  - `<SortableList getLabel={(item) => item.pageTitle} …>` (composant `src/components/ui/sortable-list.tsx`,
    props `items, getId, getLabel, onReorder, renderItem, showMoveButtons?, undoWindowMs?`).
  - `MenuItemRow` (l. 245) : titre `item.pageTitle`, `Badge` de statut via
    `STATUS_DOT_CLASS[item.pageStatus]` + `t(\`status.${item.pageStatus}\`)`, annotation
    `menu.hiddenBecauseUnpublished` si non publiée, `Switch` « Visible », bouton « Retirer du menu ».
    **Aucun bouton « Modifier »**.
  - `AddMenuEntry` (l. 310) : `Popover` + `Command` (recherche de page) — le design s04b prévoyait un
    `sheet` en mobile, le code garde le `Popover`.
- Libellés `messages/fr.json` → `BureauNavigationPage` : `metadata.title`, `title`, `menu.{title,
  empty, emptyAction, visible, remove, hiddenBecauseUnpublished, add ("Ajouter une entrée"),
  searchLabel, searchPlaceholder, noResult, removedBanner ("Entrée « {title} » retirée du menu."),
  undo}`, `footer.*`, `status.{draft, published, unpublished}`, `errors.{title, forbidden, failed,
  invalidData, alreadyInMenu}`. `PublicLayout.menuLabel` = « Menu du site ». `PublicMobileMenu` :
  `toggle`, `login` (+ clés héritées `privacy`, `terms`, `docs`, `blog` inutilisées).

### Rendu public

- `src/app/[locale]/(public)/layout.tsx` : `getCurrentPublicSiteNavigationDal()` → `<nav
  aria-label={t('menuLabel')}>` (caché sous `sm`) avec `<Link href={\`/${entry.slug}\`}>` de
  **`next/link`** (pas de préfixe de locale, ADR 008) ; aucune `nav` si menu vide ;
  `<PublicMobileMenu entries={menu} />` en mobile.
- `src/components/features/layouts/public-mobile-menu.tsx` (`'use client'`) :
  `DropdownMenuItem asChild` → `<Link href={\`/${entry.slug}\`}>`, séparateur, puis « Connexion ».
- `src/components/features/layouts/public-footer.tsx` lit `footerContent` du même DAL (hors
  périmètre, ne pas toucher).
- Les deux composants construisent le `href` **eux-mêmes** depuis `slug` : aucune fonction de rendu
  partagée.

### Modules (s34) et routes fixes

- Drapeaux : `organization.enabled_modules` = tableau de l'énuméré `organization_module`
  (`src/db/models/auth-model.ts:152`) **limité à `'vote' | 'voirie' | 'annonces'`**. Exposé par
  `TenantDTO.enabledModules` (`src/app/dal/tenant-dal.ts`, caché sous `TENANT_CACHE_TAG`).
- Contrôle : `isModuleEnabled(enabledModules, moduleKey)` (`src/lib/helper/tenant-helper.ts:36`, pur)
  et `requireEnabledModuleDal(moduleKey)` (`tenant-dal.ts:131`, `notFound()` sinon). Seul appelant :
  la sonde `src/app/[locale]/(public)/modules/[module]/page.tsx` — **aucun module n'a encore d'écran**
  (s33, s34, s35 non livrées).
- Activation : SuperAdmin seul, `src/app/[locale]/admin/organizations/actions.ts:277`
  (`updateOrganizationModulesService`) suivi de `updateTag(TENANT_CACHE_TAG)` — **pas** de
  `siteNavigationTag`.
- **Les cinq routes citées par la story ne sont pas des modules** : `/actualites`, `/analyses-eau`,
  `/le-bureau`, `/signaler`, `/contact` sont du socle, toujours servies (pages
  `src/app/[locale]/(public)/<route>/page.tsx`, aucune lecture de `enabledModules`). Les seules
  routes de module à venir sont celles de `vote`, `voirie`, `annonces` — déjà dans
  `RESERVED_PAGE_SLUGS` (`src/services/types/domain/page-block-types.ts:100`), comme `contact`,
  `actualites`, `analyses-eau`, `le-bureau`, `signaler`, `modules`.
- Aucune navigation actuelle ne masque de lien selon un module : il n'y a rien à masquer aujourd'hui.

## Anchor points

| Où                                                                    | Changement attendu                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/models/menu-item-model.ts`                                    | `page_id` facultatif ; colonnes libellé + adresse (nullable) ; `check(...)` « page **xor** adresse » (+ libellé requis avec l'adresse)  |
| `drizzle/migrations/0087_*.sql`                                       | **générée** (`pnpm db:generate`) : `DROP NOT NULL` + `ADD COLUMN` + `ADD CONSTRAINT … CHECK` ; lignes existantes valides d'office       |
| `src/db/repositories/menu-item-repository.ts`                         | `innerJoin` → `leftJoin` ; `MenuItemRow` à champs de page nullables ; DAO d'ajout d'entrée libre ; DAO de modification                  |
| `src/services/validation/site-navigation-validation.ts`               | schémas serveur ajout/modification d'entrée libre (libellé `trim().min(1)`, adresse en liste blanche)                                     |
| `src/services/types/domain/site-navigation-types.ts`                  | `MenuItemDTO` et `PublicMenuEntryDTO` en union discriminée (page / lien) ; prédicat pur d'adresse sûre (cf. `isPageSlugReserved`)       |
| `src/services/site-navigation-service.ts`                             | `addMenuLinkService`, `updateMenuLinkService` ; `toMenuItemDto` ; filtre public : page publiée **ou** lien à adresse sûre               |
| `src/services/facades/site-navigation-service-facade.ts`              | réexporter les nouvelles fonctions                                                                                                       |
| `src/app/[locale]/(bureau)/bureau/navigation/actions.ts` + `page.tsx` | actions ajout/modification (erreurs par champ) + `updateTag(siteNavigationTag(...))` ; câbler les props                                 |
| `site-navigation-manager.tsx`                                         | variante du formulaire (choix page/adresse), ligne d'une entrée libre (pas de badge de statut), modification, annulation du retrait     |
| `(public)/layout.tsx`, `public-mobile-menu.tsx`                       | `href` depuis le DTO ; `rel="noopener noreferrer"` sur l'externe, **sans** `target="_blank"`                                           |
| `messages/fr.json` `BureauNavigationPage`                             | libellés du formulaire et erreurs de champ                                                                                               |
| `e2e/site-navigation.spec.ts`                                         | entrée libre interne + externe, rendu, isolation A/B, refus non-bureau                                                                   |

## Verified APIs / functions

- **Drizzle** `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`. `check(name, sql\`…\`)` dans le
  troisième argument de `pgTable` est supporté et déjà employé : `member-invoice-model.ts:85-96`,
  `member-note-model.ts:81`, `parcel-model.ts:90`, `unpaid-reminder-model.ts:47`.
- **Précédent exact de la migration** : `drizzle/migrations/0069_third_wolfsbane.sql` —
  `ALTER TABLE "member_invoice" ALTER COLUMN "parcel_id" DROP NOT NULL;` puis `ADD CONSTRAINT
  "member_invoice_parcel_required_for_site_check" CHECK (… or "member_invoice"."parcel_id" is not
  null)`, généré par drizzle-kit depuis `check()` du modèle (s19). Même forme pour s50.
- Contrainte unique `menu_item_organization_page_unique` : Postgres traite les `NULL` comme
  distincts par défaut (Drizzle n'appelle pas `.nullsNotDistinct()`) → plusieurs entrées libres
  (`page_id NULL`) par association restent permises sans toucher la contrainte.
- **Aides d'URL existantes** (aucune n'est le helper voulu tel quel) :
  - `isHttpsUrl(value)` — `src/lib/pennylane/pennylane-schemas.ts:26` : `URL.canParse(value) &&
    new URL(value).protocol === 'https:'`. Bonne base pour l'externe, mais rangée dans l'adaptateur
    Pennylane.
  - `RESTRICTED_SANITIZE_SCHEMA.protocols.href = ['http', 'https', 'mailto']` —
    `src/lib/cms/render-page-block.ts:42` : **autorise `http`**, donc non réutilisable.
  - `printableUrlOf` + `SCHEME_PATTERN` — `src/lib/letters/render-letter-body.ts:46-54` (interne,
    non exporté, même liste permissive).
  - Aucune validation de **chemin interne** nulle part dans `src`.
- `isPageSlugReserved` / `RESERVED_PAGE_SLUGS` — `page-block-types.ts:100-132` : précédent d'un
  **prédicat pur rangé dans un type de domaine**, importable par la présentation et le service.
- `canPerformAction(user, organizationId, actionId)` — `action-registry-authorization.ts:18`.
- `withTenant`, `getDb` — `src/db/tenant-scope`.
- `ValidationParsedZodError(err?: ZodError)` (`src/services/errors/validation-error.ts:15`, champ
  `zodErrorFields`) et `isValidationParsedZodError` (l. 39) : de quoi rendre des erreurs par champ
  depuis l'action (précédent : `src/app/[locale]/(bureau)/bureau/reglages/actions.ts`, qui manipule
  `fieldErrors`).
- Formulaires bureau : `board-member-form.tsx` (s06) valide **à la main** (`useState` + erreurs par
  champ + `FormData` vers l'action) ; `contact-form-validation.ts` (`createContactFormSchema(t)`)
  est le gabarit RHF + Zod traduit (`rule-zod-client-server-internationalization`). Les deux formes
  coexistent ; l'écran de navigation n'a aujourd'hui aucun formulaire à champs.
- Composants du socle disponibles (`src/components/ui/`) : `radio-group`, `input`, `label`, `form`,
  `tabs`, `dialog`, `sheet`, `popover`, `command`, `alert`, `badge`, `switch`, `sortable-list`.
  Design system : `radio-group` pour 2-3 options courtes (§2.1, §3.1) ; **option de `radio-group` à
  contenu révélé** (§3.14, gap 2 de s27, généralisé par s36) — champ révélé en retrait de 48 px en
  bureau, pleine largeur sous 640 px, à la suite de l'option dans l'ordre de tabulation ; erreur =
  bordure `destructive` 2 px + message sous le champ + résumé en tête (§3.1) ; libellé au-dessus,
  « Facultatif » en clair, validation au _blur_ puis à la soumission.
- Design de s04b : `docs/designs/s04b-navigation-publique.{md,html}` (+ brief). **Aucun design s50**
  dans `docs/designs/` : `/ks-design` reste à faire (story UI).

## Traps & constraints

1. **`innerJoin` → `leftJoin`** dans `getMenuItemsByOrganizationDao` : sans ce changement, une
   entrée libre (sans page) **disparaît silencieusement** de l'écran bureau et du menu public — le
   symptôme « zéro résultat » ressemble à un oubli de scope RLS, ce n'en est pas un. Les champs
   `pageTitle/pageSlug/pageStatus` deviennent nullables dans `MenuItemRow`, et le filtre public
   `row.pageStatus === 'published'` écarterait aussi toute entrée libre : il doit distinguer les deux
   types.
2. **Les types de page se propagent jusqu'au client** : `MenuItemDTO.pageId/pageTitle/pageSlug/pageStatus`
   sont non nullables et utilisés par `STATUS_DOT_CLASS[item.pageStatus]`, `t(\`status.${…}\`)`,
   `getLabel={item.pageTitle}`, `addablePages` (`item.pageId`), `removedBanner` (`pageTitle`),
   `undoRemoval` (`addAction(removed.pageId)`). Une union discriminée (`kind: 'page' | 'link'`) fait
   remonter chaque usage au typecheck ; un simple passage en nullable les laisserait compiler en
   rendant `undefined`.
3. **Annuler le retrait d'une entrée libre** : `undoRemoval` recrée l'entrée par
   `addAction(removed.pageId)` — pour une entrée libre il faut recréer libellé + adresse (autre
   action) ; sinon l'annulation échoue ou recrée une entrée de page vide.
4. **Le `href` est construit dans deux composants** (`layout.tsx` et `public-mobile-menu.tsx`) en
   `/${entry.slug}` : les deux doivent passer au `href` du DTO et porter le même `rel` — oublier le
   tiroir mobile est le défaut probable (tests existants : `public-mobile-menu.test.tsx`,
   `(public)/layout.test.tsx`).
5. **Validation au rendu** (note agentique) : le filtre public s'exécute dans le scope `'use cache'`
   (`readPublicSiteNavigationCached` → `getPublicSiteNavigationService`). Un prédicat pur de chaîne
   (ou `URL.canParse`) y est permis ; aucune horloge, aucun `logger`, aucun `headers()` dans ce
   chemin.
6. **Pièges de la liste blanche** (vérifiés sur le parseur WHATWG, à couvrir par test) :
   - `/\hôte` et `\\hôte` : le navigateur lit `\` comme `/` → **relatif au protocole**. « Commence
     par `/` et pas par `//` » ne suffit pas : refuser tout `\` (au moins en 2ᵉ position) ;
   - espaces et caractères de contrôle en tête (`" //hôte"`, `"\t/x"`) : le navigateur les retire
     avant d'analyser → valider la valeur **après `trim()`** et refuser les contrôles ;
   - `https:/hôte` ou `https:\\hôte` sont normalisés en `https://hôte/` par `new URL` : sûrs (reste
     `https`), mais la valeur stockée diffère de ce que le navigateur suivra — normaliser ou refuser
     est un choix du plan ;
   - `HTTPS://` en majuscules : `new URL().protocol` est déjà en minuscules.
7. **CHECK en base** : générée depuis `check()` du modèle, jamais écrite à la main (AGENTS.md). La
   contrainte doit accepter toutes les lignes existantes (`page_id` non nul, adresse nulle) : un
   `ADD CONSTRAINT CHECK` échoue sur une ligne violante — ici aucune ne peut l'être. La liste blanche
   d'adresse elle-même reste applicative (la story demande en base le seul « jamais à la fois »).
8. **Aucune nouvelle table** : l'inventaire RLS (`src/db/rls-inventory.test.ts`, qui lit
   `docs/architecture.md` et compte les `FORCE ROW LEVEL SECURITY`) ne bouge pas, ni la section
   `menu_item` de `docs/architecture.md:421`. ⚠️ `docs/architecture.md` a des modifications non
   commitées d'un autre agent dans l'arbre partagé : n'y toucher que si nécessaire, en stageant
   chemin par chemin.
9. **Modification d'entrée** : le critère 6 dit « ajouter, **modifier** ou retirer » — il n'existe
   aujourd'hui ni DAO, ni service, ni action, ni bouton de modification. C'est du neuf, pas une
   réutilisation. La DAO doit filtrer `id` **et** `organization_id`, comme les autres.
10. **Piège s34 aujourd'hui vide, demain réel** : aucune des cinq routes citées n'est un module ;
    seuls `vote`, `voirie`, `annonces` le sont, et aucun n'a d'écran. Si le plan choisit de
    **masquer** les liens vers un module désactivé, ce filtre ne peut pas vivre dans la lecture
    cachée sous `siteNavigationTag` : l'activation d'un module n'invalide que `TENANT_CACHE_TAG`
    (`admin/organizations/actions.ts:279`), le menu resterait périmé jusqu'à `cacheLife('hours')`.
    Il vivrait hors du cache (layout, à partir de `tenant.enabledModules` et `isModuleEnabled`), ou
    l'action d'activation invaliderait aussi les tags de navigation. Et la correspondance « chemin →
    module » n'existe nulle part : elle serait à créer (ou à reporter à s34, qui livrera la première
    route de module).
11. **Mise en page publique** : la `nav` d'ordinateur est en `hidden sm:flex`, sans retour à la ligne
    prévu au-delà de quelques entrées ; des libellés libres longs l'élargissent. Une longueur maximale
    du libellé est à fixer (aucune n'existe ; `page.title` n'en a pas non plus côté menu).
12. **Tests existants à garder verts** : `src/services/__tests__/site-navigation-service.test.ts`
    (26 cas : bureau, refus métier, membre simple, public, pied de page — les mocks de
    `getMenuItemsByOrganizationDao` construisent des `MenuItemRow` à champs de page obligatoires),
    `navigation/actions.test.ts` (10), `navigation/page.test.tsx` (2),
    `site-navigation-manager.test.tsx` (9), `public-mobile-menu.test.tsx` (3),
    `(public)/layout.test.tsx` (6), `action-registry-authorization.test.ts` (bloc s04b).
13. **e2e** : `e2e/site-navigation.spec.ts` (s04b, `serial`) porte déjà le gabarit à reprendre —
    `TENANT_A = http://localhost:${PORT}` (TechCorp), `TENANT_B = http://127.0.0.1:${PORT}`
    (Marketing Pro), `login()` par `/login/prestataire`, `OWNER_A = user-owner@gmail.com`,
    `MEMBER_A = user@gmail.com` (non-bureau), `openNavigation`, `publicMenu =
    getByRole('navigation', {name: 'Menu du site'})`, réessais `toPass` contre l'hydratation. Le test
    croisé du critère 5 se fait là (une entrée libre posée sur A, absente sur B), pas dans
    `tenant-isolation.spec.ts` (qui ne traite pas le menu). La RLS n'est pas testable en unitaire.
    **e2e en CI uniquement** (machine locale trop juste ; montage 9p lent pour vitest).
14. **Rien en dur** : libellés et messages d'erreur dans `messages/fr.json`
    (`BureauNavigationPage.*`) ; le message `MANAGE_DENIED` du service est la seule chaîne en dur
    existante (journal, jamais affichée).

## Open questions

1. **Piège s34 : avertir ou masquer ?** Aujourd'hui aucun lien libre plausible (`/contact`,
   `/actualites`…) ne vise un module. Options : (a) ne rien faire en s50 et reporter à s34, qui livre
   la première route de module et la correspondance chemin → module ; (b) masquer au rendu, hors cache
   (trap 10) ; (c) avertir le bureau sur la ligne de l'entrée. Recommandation de la recherche : (a),
   avec une note dans s34 — c'est la seule option qui n'invente pas une table de routes de modules
   qui n'existent pas.
2. **Une entrée de page a-t-elle son propre libellé ?** Aujourd'hui elle affiche `page.title`. Soit
   la colonne libellé ne sert qu'aux entrées libres (CHECK « libellé requis ssi adresse »), soit elle
   devient un libellé facultatif de remplacement pour toute entrée (élargissement non demandé).
   Recommandation : libres seulement — le critère 4 veut les entrées de page « inchangées ».
3. **La modification peut-elle changer le type d'une entrée** (page ↔ adresse) ? Le critère 6 ne
   parle que d'entrée libre. Recommandation : modifier libellé et adresse d'une entrée libre
   seulement ; changer de type = retirer puis ajouter.
4. **Forme du formulaire** : `radio-group` « Une page / Une adresse » à contenu révélé (§3.14) dans
   le `Popover` actuel, ou dans un `dialog`/`sheet` (le design s04b prévoyait un `sheet` en mobile,
   non livré) ? Où se loge la modification (même formulaire pré-rempli) ? À trancher par
   `/ks-design`.
5. **Validation client** : RHF + Zod traduit (`createXSchema(t)`, règle zod i18n) ou validation à la
   main comme `board-member-form.tsx` ? Dans les deux cas le serveur rend des erreurs **par champ**
   (critère 3), ce que les actions de navigation ne font pas encore.
6. **Normaliser l'adresse externe** (stocker `new URL(x).href`) ou la stocker telle que saisie après
   `trim()` ? Et les chemins internes avec `?` / `#` (ex. `/actualites?page=2`, `/#contact`) sont-ils
   permis ? La story ne les exclut pas.
7. **Longueur maximale** du libellé et de l'adresse (aucune aujourd'hui) — à fixer au plan, en
   constante de validation comme `SITE_FOOTER_MAX_LENGTH`.
8. **Où ranger le prédicat d'adresse sûre** partagé écriture/rendu/client : dans
   `site-navigation-types.ts` (précédent `isPageSlugReserved`), ou un helper `src/lib/helper/`
   générique dont `isHttpsUrl` de Pennylane pourrait ensuite dépendre ? Ne pas importer
   `src/lib/pennylane/*` depuis la navigation.
9. **ADR** : la story change la forme de `menu_item` décidée par ADR 021 (« page cible » seule). Un
   ADR 078 qui le complète (ADR immuables) paraît dû ; à confirmer au plan.
