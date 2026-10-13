# Research — Story s44-page-accueil

> Recherche du 2026-10-07, **reprise le 2026-10-12** sur `main` à `d9d3d4b`. Entre `f31be84` et
> `d9d3d4b`, aucun fichier de `src/`, `e2e/`, `messages/` ni `drizzle/` n'a changé (seuls `docs/` a
> bougé) : les relevés de code ci-dessous ont été revérifiés et tiennent. Ce qui a changé, ce sont
> les arbitrages du 07/10 (thème clair seul, dépublication sans suppression, ordre s44 → s47) ; ils
> sont reportés ci-dessous. `docs/reviews/stories.md` : `Stories ready: yes`, `Max severity: minor`
> (revue du 07/10, qui couvre s44).

## Target story

**s44-page-accueil — Choisir la page d'accueil du site.** Complexité 3. Dépend de s02, s04, s04b,
s05, s07, s11, toutes livrées. Placée avant s12b, avec s45 et s46 (nettoyage des pages héritées,
décidé le 06/10). Arbitrage de l'utilisatrice du 07/10 : `/` sert une page du CMS désignée par le
bureau, avec un accueil minimal par défaut.

Critères d'acceptation :

1. Le bureau désigne une page **publiée** du CMS comme page d'accueil ; `/` affiche son contenu, avec
   la navigation (s04b) et le bandeau d'alerte (s07) du site public.
2. Sans page désignée, ou si elle est dépubliée, `/` affiche un accueil minimal (nom, logo,
   dernières actualités publiées), sans aucun texte, lien ou bouton de la vitrine du boilerplate
   (`/pricing`, « Essayez gratuitement »). La story ne parle plus du sélecteur de thème, et la
   suppression d'une page n'existe pas dans le produit (arbitrage du 07/10).
3. Paramètre d'association : chaque association a le sien ; impossible de désigner la page d'une
   autre association, côté interface comme côté serveur (test d'accès croisé).
4. Seuls le bureau, la Présidence de l'association du domaine appelé et le SuperAdmin changent la
   page d'accueil.
5. Effet à la requête suivante, sans redéploiement.
6. Une seule adresse pour les moteurs : le sitemap liste la page une fois, sous `/`, et `/<slug>`
   déclare `/` comme canonique.

## Current state of the code

### `src/app/[locale]/page.tsx` — la vitrine du boilerplate

- **Hors du groupe `(public)`** : la page vit directement sous `[locale]`. Elle n'hérite donc **pas**
  du layout public `src/app/[locale]/(public)/layout.tsx` (en-tête avec la marque de l'association,
  menu du bureau, bouton « Connexion », tiroir mobile). Elle dessine **son propre en-tête** : logo
  `/next.svg` (`ImageTheme`), `APP_NAME`, liens `#features`, `/pricing`, `/contact`,
  `ButtonConnexionDashboard` (sous `<Suspense>`) et `ModeToggle`.
- Corps : hero (`HomePage.hero.title`, `Component` de `@/components/ui/vapour-text-effect`, bouton
  `hero.cta` « Essayez gratuitement » vers `/register`), image `/images/product-2.avif`, trois cartes
  `features.*`, puis `PublicFooter`.
- Métadonnées (s11) : `publicPageMetadata((association) => resolveFixedPageSeo({path: '/', title:
association.name}, association), {absoluteTitle: true, fallback: {HomePage.metadata.*}})`. Le titre
  est donc **le nom de l'association**, la canonique `${origin}/`, la description celle de
  l'association (`association.description`, s11), l'image l'image de partage de repli.
- `generateStaticParams` sur `routing.locales` (une seule : `fr` depuis s43).
- Le **bandeau d'alerte** (s07) n'est pas dans la page : il est posé par `src/app/[locale]/layout.tsx`
  (`getPublicSiteAlertDal(tenant.id)` → `BaseLayout alert=…`), « seul point commun à toutes les
  pages ». `/` l'a donc **déjà**, quel que soit son groupe. La **navigation** (s04b), elle, n'est que
  dans le layout `(public)`.

### `(public)/[slug]/page.tsx` — rendu d'une page CMS (s04, ADR 020)

- `resolvePage(organizationId, slug)` : `getPublicPageBySlugDal` (publiée ou rien) ; sinon, si
  `canManageCurrentPagesDal()`, aperçu sans cache par `getPageBySlugForPreviewDal`.
- Rendu : `<article>` avec bandeau d'aperçu éventuel, `<h1>` = `page.title`, puis les blocs triés par
  `rank`, chacun rendu par `renderPageBlock(block)` (`@/lib/cms/render-page-block`) en HTML sanitisé ;
  un bloc qui rend `null` est omis.
- Métadonnées : `publicPageMetadata((association) => resolvePageSeo(resolved.page, association))`.
  `resolvePageSeo` (`src/lib/seo/resolve-metadata.ts` l. 110) fixe **`canonical: ${origin}/${slug}`**
  en dur à partir du slug.
- Le corps de la page n'est pas extrait dans un composant : la logique de tri/rendu des blocs et le
  `<article>` sont **dans le fichier de route**.

### Lecture des pages — `src/app/dal/page-dal.ts`

- `pageTag(organizationId, slug)` = `page:${organizationId}:${slug}` ; lecture cachée
  `readPageBySlugCached` (`'use cache'`, `cacheLife('hours')`, `cacheTag(pageTag(...))`) →
  `getPageBySlugService`.
- `getPublicPageBySlugDal(organizationId, slug)` : la page si `status === 'published'`, sinon
  `undefined`.
- **Aucune lecture publique par identifiant.** Les seules lectures par id sont
  `getPageForBureauDal(organizationId, pageId)` → `getPageForBureauService`, qui **exige un
  gestionnaire de pages** (`requirePageManager`) et lève `NotFoundError` : inutilisable pour un
  visiteur.
- Service (`src/services/page-service.ts`) : `getPageBySlugService` (sans autorisation, délibéré),
  `getPageForBureauService`, `getPagesForBureauService`, `canManagePagesService` (→
  `canManageAssociation(authUser, organizationId)`), `createPageService`, `updatePageService`,
  `publishPageService`, `unpublishPageService`.
- Repository (`src/db/repositories/page-repository.ts`) : `getPageByIdDao(pageId)` **ne filtre pas
  sur `organization_id`** — il repose sur la RLS posée par `withTenant`. Sous `withTenant(orgA)`, l'id
  d'une page de l'association B ne rend rien (« un oubli de scope ne fuite pas : il ne retourne
  rien »).
- **Il n'existe aucune suppression de page** : ni service, ni action, ni DAO (`page-repository.ts`
  ne supprime que des `content_block`, l. 133-135). Une page se dépublie (`unpublishPageService`),
  jamais ne disparaît depuis le produit. Seule la suppression d'une association la fait partir
  (`page.organization_id` → `organization.id`, `onDelete: 'cascade'`).
- Invalidation (`src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts`) : `updateTag(pageTag(...))`
  après création (l. 121), modification (l. 150-151, ancien **et** nouveau slug), publication
  (l. 181-185, plus `siteNavigationTag`), dépublication (l. 210-213, plus `siteNavigationTag`).

### Paramètres d'association — registre typé (ADR 010, ADR 016)

- `src/services/types/domain/association-settings-types.ts` : `ASSOCIATION_SETTINGS_REGISTRY`
  (l. 202), huit clés aujourd'hui (`contact.email`, `forage.responsable.email`,
  `identity.accent_hue`, `login.link_requests_per_address_per_day`, `association.member_count`,
  `contact.messages_per_visitor_per_hour`, `association.description`,
  `search.google_verification`).
- Types de paramètre disponibles : **`email`, `number`, `boolean`, `choice`** (options **statiques**,
  `readonly ChoiceSettingOption[]`) et **`text`**. **Aucun type « référence à une page »** ; le
  registre est un module **isomorphe pur** (validation sans accès base), il ne peut pas vérifier
  qu'un identifiant désigne une page publiée de l'association.
- Pages du back-office qui affichent un paramètre : `AssociationSettingPage = 'settings' |
'identity'` ; sections : `'seo'`.
- Service `src/services/association-settings-service.ts` :
  - `getAssociationSettingsService(organizationId)` — sans autorisation (délibéré), sous
    `withTenant`, `resolveSettings(REGISTRY, rows)` ;
  - `updateAssociationSettingsService(organizationId, changes)` — `safeParse` → autorisation
    `canPerformAction(authUser, organizationId, ActionIdConst.ASSOCIATION_SETTINGS_UPDATE)` →
    `validateSettingsChanges` (tout ou rien) → `saveOrganizationSettingsTxnDao` sous `withTenant`.
- DAL `src/app/dal/association-settings-dal.ts` : `associationSettingsTag(organizationId)`,
  `getAssociationSettingsDal` (`'use cache'` + `cacheTag`), `getCurrentAssociationSettingsDal`.
  Invalidation par `updateTag(associationSettingsTag(tenant.id))` dans
  `src/app/[locale]/(bureau)/bureau/reglages/actions.ts` l. 104.
- **Précédent hors registre (ADR 021)** : le pied de page de s04b vit dans `organization_setting`
  sous `SITE_FOOTER_SETTING_KEY = 'site.footer_content'`, **lu et écrit directement** par le
  repository générique (`getOrganizationSettingsDao`, `upsertOrganizationSettingsDao`), avec sa
  propre validation dans `site-navigation-service.ts`. `resolveSettings` n'itère que les clés du
  registre : une ligne hors registre lui reste invisible.
- **Précédent de référence à une page (ADR 021)** : `menu_item.page_id` est une vraie **FK**
  (`src/db/models/menu-item-model.ts` l. 40, `onDelete: 'cascade'`), avec `organization_id` direct et
  une policy RLS forcée.

### Actualités (s05, ADR 023) — pour l'accueil minimal

- `src/app/dal/news-dal.ts` : `getPublicNewsPageDal(organizationId, page)` (cachée,
  `cacheTag(newsListTag(organizationId))`), `getPublicNewsPageCountDal`, `newsImageUrl(key)`.
- `NEWS_PUBLIC_PAGE_SIZE = 10` (`src/services/types/domain/news-types.ts` l. 53) ; tri public
  `published_on desc, created_at desc, id desc` (ADR 023). La page 1 de la liste = les plus récentes.
- `src/app/[locale]/(public)/actualites/page.tsx` rend la liste **inline** (pas de composant de
  carte extrait) et formate les dates par `formatContentDate` (`@/lib/cms/format-content-date`).

### Marque de l'association

- `AssociationMark` (`@/components/features/association/association-mark`), utilisé par le layout
  public avec `name={tenant.name}`, `logoVersion={getIdentityVersionFromKey(tenant.logoKey)}`,
  `size="public"`. Le tenant vient de `requireCurrentTenantDal()`.

### Sitemap (s11)

- `src/app/sitemap.ts` : `{url: ${origin}/}`, puis `FIXED_PUBLIC_PATHS`, puis **toutes** les pages
  publiées (`${origin}/${page.slug}`), puis les actualités. Les pages viennent de
  `getPublishedSitemapEntriesDal` (`src/app/dal/sitemap-dal.ts`, **non caché**, délibéré) →
  `getPublishedSitemapEntriesService` → `getPublishedPagesForSitemapDao(organizationId)` (slug +
  `updatedAt` de toutes les pages publiées, triées par slug). Aucune connaissance d'une page
  d'accueil : aujourd'hui, la page désignée serait listée deux fois (`/` et `/<slug>`).

### Autorisation (s03b, ADR 018)

- Registre d'actions `src/services/types/domain/action-registry-types.ts` : notamment
  `ASSOCIATION_SETTINGS_UPDATE` (l. 45), `PAGE_MANAGE` (l. 52), `SITE_NAVIGATION_MANAGE` (l. 59),
  `NEWS_MANAGE` (l. 65). Contrôle par `canPerformAction(authUser, organizationId, actionId)`
  (`src/services/authorization/action-registry-authorization.ts`) ; `canManageAssociation`
  (`src/services/authorization/association-authorization.ts` l. 21) pour l'interface.

### Tests et données existants qui touchent `/`

- `e2e/homepage.spec.ts` (3 tests : titre `TechCorp Solutions`, `<h1>` « La plateforme SaaS
  moderne pour booster », `nav` visible, texte du hero) et `e2e/mobile.spec.ts` (titre + texte du
  hero) — corrigés en français par le Quick Fix de s43 (`01bcc11`), ils vérifient **la vitrine**.
- `e2e/styles.spec.ts` : `ROUTES = ['/', '/login/prestataire', '/blog', '/pricing']` — `/` y reste
  pertinent ; `/blog` et `/pricing` sont l'affaire de s45.
- `e2e/locale-unique.spec.ts` : `/fr`, `/en`, `/es` → 308 vers `/` (l. 45-52), indépendant du contenu.
- `src/app/__tests__/home.test.tsx` : **`describe.skip`** entier, assertions sur la vitrine (« By Mike
  Codeur », « Recrutement »…) — test mort.
- **Le seed ne crée aucune page CMS** (`src/db/scripts/seed.ts` : pas d'insertion dans `page`) ; les
  specs de s04 (`e2e/page-cms.spec.ts`) créent leurs pages elles-mêmes. Sur une base fraîche, `/`
  tombera donc toujours sur l'accueil minimal.
- `messages/fr.json`, `HomePage` : `title`, `description`, `metadata`, `navigation`, `hero`,
  `features`, `footer`. Utilisé seulement par `src/app/[locale]/page.tsx` et le test sauté.
  `ButtonConnexionDashboard` n'est importé que par cette page.

## Anchor points

- **La route `/`** : `src/app/[locale]/page.tsx`. Pour hériter de la navigation (critère 1), la page
  doit passer sous le layout `(public)` — `(public)/page.tsx` et `[locale]/page.tsx` résolvent la
  même URL et ne peuvent pas coexister (un seul des deux fichiers).
- **Rendu d'une page CMS** : le corps de `(public)/[slug]/page.tsx` (tri des blocs +
  `renderPageBlock` + `<article>`) — à partager entre `/` et `/<slug>` plutôt qu'à recopier.
- **Lecture publique par identifiant** : n'existe pas ; s'accroche à `page-dal.ts` /
  `page-service.ts` / `getPageByIdDao` (sous `withTenant`).
- **Persistance du choix** : `organization_setting` (registre ou hors registre, comme le pied de
  page) ou une colonne/table portant une FK vers `page` (comme `menu_item`). Voir questions ouvertes.
- **Écran du bureau** : `/bureau/reglages` (registre), `/bureau/navigation` (s04b, déjà centré sur
  les pages publiées et le site public), ou `/bureau/pages` (action sur une ligne).
- **Sitemap** : `getPublishedSitemapEntriesService` / `src/app/sitemap.ts` — exclure la page
  désignée de la liste des `/<slug>`.
- **Canonique de `/<slug>`** : `resolvePageSeo` (`canonical` codé sur le slug) — doit savoir si la
  page est l'accueil.
- **Accueil minimal** : `requireCurrentTenantDal`, `AssociationMark`, `getPublicNewsPageDal(id, 1)`.

## Verified APIs / functions

| Fonction / constante                                                | Emplacement                                                    | Signature / rôle                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `getPublicPageBySlugDal`                                            | `src/app/dal/page-dal.ts`                                      | `(organizationId, slug) => Promise<PageWithBlocksDTO \| undefined>`, publiée seulement |
| `pageTag`                                                           | idem                                                           | `(organizationId, slug) => 'page:…:…'`                                                 |
| `getPageForBureauDal`                                               | idem                                                           | `(organizationId, pageId)`, réservée au bureau, `undefined` sur erreur                 |
| `canManageCurrentPagesDal`                                          | idem                                                           | `() => Promise<boolean>`                                                               |
| `getPageByIdDao`                                                    | `src/db/repositories/page-repository.ts` l. 54                 | `(pageId)`, sans filtre d'association (RLS)                                            |
| `getPublishedPagesForSitemapDao`                                    | idem l. 176                                                    | `(organizationId) => {slug, updatedAt}[]`                                              |
| `renderPageBlock`                                                   | `src/lib/cms/render-page-block`                                | bloc → HTML sanitisé ou `null`                                                         |
| `resolvePageSeo`, `resolveFixedPageSeo`                             | `src/lib/seo/resolve-metadata.ts` l. 110, ~155                 | → `ResolvedSeo` (`title`, `image`, `canonical`, description)                           |
| `publicPageMetadata`                                                | `src/lib/seo/public-metadata.ts`                               | `(resolve, {absoluteTitle?, type?, fallback?})`                                        |
| `ASSOCIATION_SETTINGS_REGISTRY`                                     | `association-settings-types.ts` l. 202                         | types `email \| number \| boolean \| choice \| text`                                   |
| `getAssociationSettingsService`, `updateAssociationSettingsService` | `src/services/association-settings-service.ts`                 | lecture sans autorisation ; écriture `ASSOCIATION_SETTINGS_UPDATE`                     |
| `associationSettingsTag`, `getAssociationSettingsDal`               | `src/app/dal/association-settings-dal.ts`                      | lecture cachée + tag                                                                   |
| `SITE_FOOTER_SETTING_KEY`                                           | `site-navigation-types.ts`                                     | précédent hors registre (ADR 021)                                                      |
| `getPublicNewsPageDal`, `newsListTag`                               | `src/app/dal/news-dal.ts`                                      | `(organizationId, page)`, cachée                                                       |
| `NEWS_PUBLIC_PAGE_SIZE`                                             | `news-types.ts` l. 53                                          | `10`                                                                                   |
| `getPublishedSitemapEntriesDal`                                     | `src/app/dal/sitemap-dal.ts`                                   | non cachée                                                                             |
| `canPerformAction`, `ActionIdConst`                                 | `action-registry-authorization.ts`, `action-registry-types.ts` | `ASSOCIATION_SETTINGS_UPDATE`, `PAGE_MANAGE`, `SITE_NAVIGATION_MANAGE`                 |
| `AssociationMark`                                                   | `src/components/features/association/association-mark`         | `name`, `logoVersion`, `size`                                                          |

## Traps & constraints

1. **`/` n'est pas dans le groupe `(public)`.** Sans déplacement, la page ne reçoit ni le menu du
   bureau ni l'en-tête public (critère 1 non tenu). Déplacer revient à supprimer
   `src/app/[locale]/page.tsx` et à créer `(public)/page.tsx` — même URL, les deux ne peuvent pas
   coexister. `(public)/loading.tsx` existe et est un squelette générique (deux cartes de champs, sans rapport avec
   un accueil) : il s'afficherait pendant le chargement de `/`. À examiner au plan, pas à ignorer.
2. **Sélecteur de thème : plus un sujet pour s44.** Le layout `(public)` affiche `ModeToggle` sur
   toutes les pages publiques (`(public)/layout.tsx` l. 10 et 80) ; mettre l'accueil dessous l'y
   fait apparaître jusqu'à s45. La story le dit (note agentique) : s45 passe tout le produit en
   clair et retire le sélecteur, s44 ne le traite pas. Rien à décider ici, mais l'e2e de s44 ne doit
   pas affirmer l'absence du sélecteur (il n'est retiré qu'en s45).
3. **Le registre typé ne sait pas référencer une page.** Pas de type adapté ; `choice` a des options
   statiques ; la validation est pure, sans base. La note de la story (« le paramètre vit dans le
   registre ») se heurte à ce point. Deux précédents existent : hors registre dans
   `organization_setting` (pied de page, ADR 021) ou FK vers `page` (`menu_item`, ADR 021). Choix
   structurant → **ADR** probable.
4. **Pas de lecture publique d'une page par identifiant.** Le cache public est indexé et invalidé
   **par slug** (`pageTag`). Une lecture par id devra soit résoudre id → slug puis passer par
   `getPublicPageBySlugDal` (et rester juste quand le slug change), soit porter son propre tag, que
   les actions de pages devront alors invalider aussi (création, modification, publication,
   dépublication — quatre endroits dans `bureau/pages/[id]/actions.ts`).
5. **Critère 5 et caches.** Le choix se lit dans un cache taggé (`associationSettingsTag` si registre)
   ; l'action qui enregistre doit `updateTag` le bon tag. La page elle-même est cachée par slug, la
   liste d'actualités par `newsListTag` : l'accueil minimal suit déjà les publications d'actualités.
6. **Pas de suppression de page, et c'est voulu** (arbitrage du 07/10 : la dépublication suffit, pas
   de story de suppression). Le cas « page supprimée » n'est donc pas à traiter, sauf la cascade
   de la suppression d'une association. Si le choix est stocké sans FK, une référence pendante
   (id inconnu) doit quand même retomber sur l'accueil minimal, par prudence ; avec une FK,
   `onDelete` doit être `set null` (pas `cascade` sur une ligne de réglage partagée).
7. **Accès croisé (critère 3).** Côté lecture, la RLS protège déjà : sous `withTenant(orgA)`, l'id
   d'une page de B ne rend rien. Côté écriture, il faut un **refus** explicite : vérifier dans le
   service, sous le scope de l'association, que la page existe et est publiée. Le test d'isolation
   RLS est un e2e Playwright (AGENTS.md : la RLS n'est pas testable en unitaire).
8. **Désigner une page non publiée.** Critère 1 : « une page publiée ». Refus à l'enregistrement d'un
   brouillon, et dépublication ultérieure → accueil minimal (critère 2), sans effacer le choix
   (republier la page la remet en accueil ?) — à décider.
9. **Canonique et sitemap (critère 6).** `resolvePageSeo` code la canonique sur le slug ; le sitemap
   liste toutes les pages publiées. Les deux doivent connaître la page d'accueil ; le sitemap est non
   caché (pas d'invalidation à ajouter), la métadonnée de `/<slug>` est calculée à chaque requête
   via `publicPageMetadata`.
10. **Métadonnées de `/`.** Aujourd'hui `resolveFixedPageSeo` (titre = nom de l'association,
    `absoluteTitle`). Avec une page désignée : titre/description/image de la page (`resolvePageSeo`)
    ou de l'association ? La canonique doit rester `${origin}/` dans les deux cas.
11. **`<h1>`.** Le rendu d'une page CMS pose `page.title` en `<h1>` ; l'accueil minimal en aura un
    autre. `e2e/homepage.spec.ts` cherche aujourd'hui un `heading` précis : les specs de `/` sont à
    réécrire sur les deux cas, et **le seed n'a aucune page** (l'e2e devra en créer une, comme
    `page-cms.spec.ts`).
12. **Nettoyage limité à l'accueil.** Retirer `HomePage.*`, `ButtonConnexionDashboard`,
    `vapour-text-effect`, `ImageTheme` de cette page et le test sauté `home.test.tsx` si orphelins ;
    vérifier avant chaque retrait qu'aucun autre fichier ne les importe. `/pricing`, `/register`,
    `/blog` relèvent de s45/s46. `PublicFooter` est conservé (pied de page du bureau, s04b).
13. **Ordre d'exécution.** s44 passe avant s45, s46, s47, s12b et s12d. Le bouton « Connexion » du
    layout `(public)` pointe `/login` (l. 74) : s46 en change les destinations, pas s44. Le seed
    ne crée aucune page ni aucun paramètre d'accueil : un nouveau paramètre doit avoir une valeur
    par défaut « aucune page » qui laisse l'accueil minimal.
14. **Slugs réservés.** `isPageSlugReserved` (`page-block-types.ts` l. 131) interdit des slugs comme
    `pricing`, `privacy`, `terms`, `voirie`, `vote` : aucune page CMS ne peut donc occuper une
    adresse de produit. Sans conséquence pour `/` (jamais un slug), à garder en tête si un jour
    `/<slug>` redirige vers `/`.
15. **Logger et `'use cache'`** (rule-logger) : une nouvelle lecture cachée passant par une façade
    hérite du compromis décrit dans `page-dal.ts` ; aucun appel direct à `logger` dans le scope.

## Open questions

1. **Où le bureau choisit-il l'accueil ?** `/bureau/reglages`, `/bureau/navigation` (écran du site
   public, déjà centré sur les pages publiées) ou `/bureau/pages` (« Définir comme accueil » sur une
   ligne). Question de `/ks-design` ; elle conditionne l'action et le droit à contrôler
   (`ASSOCIATION_SETTINGS_UPDATE`, `SITE_NAVIGATION_MANAGE` ou `PAGE_MANAGE` — tous ouverts au bureau
   et à la Présidence, mais ce sont trois actions distinctes du registre).
2. **Persistance** : clé hors registre dans `organization_setting` (précédent du pied de page, pas
   de migration) ou référence avec FK (précédent de `menu_item`, migration) ? À trancher par un ADR.
3. ~~Sélecteur de thème sur l'accueil~~ **Tranchée** : retirée des critères, traitée par s45.
4. **Combien d'actualités** dans l'accueil minimal (les 10 de la page 1, ou moins) ? Constante
   d'affichage (ADR 023, point 4) plutôt que paramètre.
5. **Métadonnées de `/` avec une page désignée** : celles de la page (titre moteur, image de partage)
   ou celles de l'association ?
6. **Une page désignée puis dépubliée** : le choix est-il conservé (et reprend effet à la
   republication) ou effacé ? Et peut-on dépublier la page d'accueil sans avertissement ?
7. **La page désignée reste-t-elle dans le menu** (s04b) ? Elle y pointerait vers `/<slug>`, adresse
   non canonique : lien vers `/` ou entrée inchangée ?
8. **Hors périmètre, pour s45** : l'ADR 020 désigne `/modules/[module]` comme le segment des futurs
   modules (`vote`, `voirie`, `annonces`), alors que s45 prévoit de retirer `/modules/*`.
