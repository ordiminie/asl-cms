# Research — Story s11-seo

## Target story

**Rendre le site référençable** — un visiteur trouve le site de l'association dans un moteur de
recherche. Complexité 2. Dépendances : s02, s04, s05, s09 (toutes livrées).

Critères d'acceptation (docs/stories.md) :

1. Le sitemap liste toutes les pages publiées du tenant et aucune page en brouillon ; publier une
   page l'y ajoute.
2. Chaque page publique expose un titre, une description et des métadonnées de partage renseignés
   par le bureau, avec un repli sur les valeurs du tenant si le champ est vide.
3. `robots.txt` autorise l'indexation des pages publiques et exclut toute route authentifiée,
   back-office compris, par un préfixe qui couvre aussi les routes ajoutées ensuite.
4. Le code de vérification Search Console est un paramètre de tenant, saisissable en back-office.
5. Chaque association sert son propre sitemap et ses propres métadonnées sur son propre domaine.

Note agentique : « Le boilerplate a déjà `src/app/sitemap.ts` et `src/app/robots.ts` : les rendre
conscients du tenant et du cycle de publication, ne pas repartir de zéro. » « Aucune logique
propre — c'est du réglage par tenant. »

## Current state of the code

**`src/app/sitemap.ts`** — sitemap du boilerplate, **sans aucune notion de tenant** :

- base : `env.NEXT_PUBLIC_APP_URL || 'https://example.com'` — une seule URL pour toute la
  plateforme, jamais le domaine de l'association (viole le critère 5) ;
- routes statiques codées en dur : `''`, `/pricing`, `/faq`, `/blog`, `/terms`, `/privacy` —
  `/pricing` et le blog sont le produit **Zourite/boilerplate**, pas le site d'une association ;
  `/faq` n'existe même pas sous `src/app/[locale]/(public)/` ;
- lit le **blog hérité** (`getAllUnifiedBlogSlugsDal`, `getTotalPagesDal`,
  `getAllBlogCategoriesDal`, `getCategoryTotalPagesDal` de `src/app/dal/blog-dal.ts`) — tables
  `posts`/`categories` exemptées de RLS, « hors produit » (ADR 023) ;
- produit une entrée **par locale** de `routing.locales` avec `alternates.languages` et un préfixe
  `/${locale}` hors locale par défaut ;
- ne lit **ni `page`, ni `news`, ni `water_analysis`**.

**`src/app/robots.ts`** :

```ts
rules: {userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/(app)/']},
sitemap: `${baseUrl}/sitemap.xml`,   // baseUrl = env.NEXT_PUBLIC_APP_URL
```

`/(app)/` est un **groupe de route** : il n'apparaît jamais dans une URL, cette ligne n'exclut
rien. `/bureau`, `/account`, `/dashboard`, `/team`, `/login`… sont aujourd'hui **indexables**.

**Métadonnées des pages publiques** (`generateMetadata`) :

| Route | Aujourd'hui |
| --- | --- |
| `src/app/[locale]/layout.tsx:70` | `title`/`description` tirés de `messages` (`LocaleLayout`) — textes génériques du boilerplate, pas de l'association ; `icons` = favicon du tenant. Pas de `metadataBase`, pas d'`openGraph`, pas de `verification`. |
| `src/app/[locale]/(public)/layout.tsx:16` | `title`/`description` de `PublicLayout` (messages), identiques pour tous les tenants. |
| `src/app/[locale]/(public)/[slug]/page.tsx` | page CMS : `{title: page.title}` seulement ; `{}` si non trouvée. |
| `src/app/[locale]/(public)/actualites/[slug]/page.tsx:38` | `{title: news.title}` seulement. |
| `actualites/page.tsx`, `analyses-eau/page.tsx`, `le-bureau/page.tsx`, `contact/page.tsx` | chacune son `generateMetadata` (titres de `messages`). |
| `src/app/[locale]/page.tsx` | **page d'accueil marketing du boilerplate** (`APP_NAME`, `/next.svg`, `vapour-text-effect`, bouton dashboard), métadonnées `HomePage.metadata.*`. Ce n'est pas une page d'association. |

**Modèle `page`** (`src/db/models/page-model.ts`) : `id`, `organization_id`, `slug`, `title`,
`status` (`draft` par défaut ; `published`, `unpublished`), `created_at`, `updated_at`. **Aucun
champ de description ni de partage.** **`news`** (`news-model.ts`) : `slug`, `title`,
`published_on`, `image_key`, `image_alt`, `content`, `status` — pas de description non plus.

**Paramètres d'association** (`ASSOCIATION_SETTINGS_REGISTRY`,
`src/services/types/domain/association-settings-types.ts:163`) : `contact.email`,
`forage.responsable.email`, `identity.accent_hue`, `login.link_requests_per_address_per_day`,
`association.member_count`, `contact.messages_per_visitor_per_hour`. **Aucune description de
l'association, aucun code de vérification.** Types de valeur possibles : `email`, `number`,
`boolean`, `choice` (lignes 32–54) — **pas de type texte libre**.

## Anchor points

- `src/app/sitemap.ts` et `src/app/robots.ts` : à rendre dépendants du domaine appelé.
- `getCurrentTenantDal()` (`src/app/dal/tenant-dal.ts:71`) : lit `x-forwarded-host` puis `host` —
  c'est le moyen existant de connaître l'association depuis un gestionnaire de route.
- `associationOriginOf(domain)` (`src/lib/better-auth/association-origin.ts`) : origine absolue de
  l'association (protocole et port de `BETTER_AUTH_URL`, hôte = domaine) — candidate naturelle pour
  la base des URL du sitemap et pour `metadataBase`.
- `generateMetadata` des pages publiques ci-dessus, et du layout `[locale]` (pour
  `verification: {google: …}` et `metadataBase`).
- Registre des paramètres : une nouvelle clé pour le code Search Console (et une éventuelle
  description par défaut de l'association), page `settings` → écran « Réglages »
  (`src/app/[locale]/(bureau)/bureau/reglages/`).
- Formulaire d'édition d'une page CMS : `src/app/[locale]/(bureau)/bureau/pages/[id]/`
  (`actions.ts`, `page.tsx`) si les champs SEO vivent sur la page.
- `AUTHENTICATED_SEGMENTS` (`src/proxy.ts:13`) : `/account`, `/admin`, `/bureau`, `/dashboard`,
  `/team` — la liste existante des préfixes authentifiés, à rapprocher du critère 3.

## Verified APIs / functions

| Nom | Signature / comportement | Emplacement |
| --- | --- | --- |
| `getCurrentTenantDal` | `cache(async () => TenantDTO \| undefined)`, via `headers()` | `src/app/dal/tenant-dal.ts:71` |
| `TenantDTO` | `{id, name, slug, domain, enabledModules, logoKey, faviconKey}` | `tenant-dal.ts:18` |
| `associationOriginOf` | `(domain) => string \| undefined` | `src/lib/better-auth/association-origin.ts` |
| `getPublicPageBySlugDal` | `(organizationId, slug) => Promise<PageWithBlocksDTO \| undefined>`, cachée `'use cache'` + `cacheTag(pageTag(org, slug))`, ne rend que `published` | `src/app/dal/page-dal.ts:62` |
| `pageTag` | `` `page:${organizationId}:${slug}` `` | `page-dal.ts:22` |
| `getPagesByOrganizationDao` | liste des pages d'une association (tous statuts) | `src/db/repositories/page-repository.ts:45` |
| `getPagesForBureauService` / `getPagesForBureauDal` | liste **pour le bureau** (autorisée par `PAGE_MANAGE`) — pas une liste publique | `src/services/page-service.ts:310`, `page-dal.ts:86` |
| `publishPageService` / `unpublishPageService` | cycle de publication | `page-service.ts:242/284` |
| `getPublicNewsPageDal`, `getPublicNewsPageCountDal`, `newsListTag` | liste publique paginée des actualités | `src/app/dal/news-dal.ts:55/79/28` |
| `getPublicWaterAnalysesPageDal`, `waterAnalysisListTag` | liste publique des analyses | `src/app/dal/water-analysis-dal.ts:55/30` |
| `isPageSlugReserved`, `RESERVED_PAGE_SLUGS` | segments racine réservés | `src/services/types/domain/page-block-types.ts:94` |
| Next `MetadataRoute.Sitemap` / `MetadataRoute.Robots` | déjà typés dans les deux fichiers | — |
| Next `metadata.verification` | `verification: {google: '…'}` rend `<meta name="google-site-verification">` | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:756` |
| Next `metadataBase` | préfixe des champs d'URL relatifs ; un champ d'URL relatif **sans** `metadataBase` est une erreur de build | `generate-metadata.md:392-429` |
| Next `sitemap.js` / `robots.js` | « Route Handler spécial, **caché par défaut** sauf s'il utilise une API de requête » | `…/01-metadata/sitemap.md:44`, `robots.md:22` |

## Traps & constraints

- **L'ADR 008 n'est pas appliqué.** `src/i18n/routing.ts` déclare encore
  `locales: ['en', 'fr', 'es']`, `defaultLocale: 'en'`, sans `localePrefix: 'never'`, et
  `messages/en.json` / `es.json` existent. Le sitemap actuel émet donc, pour chaque URL, trois
  entrées dont `/fr/…` et `/es/…` (la locale par défaut `en` est sans préfixe). Le plan de s01 l'a
  consigné (« aucune story ne le porte… à trancher hors de cette story ») et la revue de s04 le
  relève aussi. L'ADR 008 cite **s11** comme raison de la forme des URL : un sitemap multilingue
  sur un site monolingue, ce sont des URL en double pour les moteurs.
- **Le sitemap est caché par défaut** tant qu'il n'utilise pas d'API de requête. Lire le tenant
  (donc `headers()`) le rend dynamique — c'est nécessaire (critère 5), sinon la première
  association servie figerait le sitemap de toutes les autres. Même raisonnement pour `robots.ts`
  (ligne `Sitemap:` absolue sur le domaine appelé).
- **Le proxy ne passe pas sur `/sitemap.xml` ni `/robots.txt`** : le matcher de `src/proxy.ts:116`
  exclut tout chemin contenant un point (`.*\\..*`). Aucune réécriture de locale ne s'y applique ;
  `getCurrentTenantDal` lit directement les en-têtes de la requête.
- **Domaine inconnu** : `getCurrentTenantDal` rend `undefined`. Le comportement du sitemap et du
  robots pour un hôte qui ne sert aucune association est à décider (sitemap vide ? robots qui
  interdit tout ?).
- **`robots.ts` : `/(app)/` n'exclut rien** (groupe de route). Le critère 3 demande un
  « préfixe qui couvre aussi les routes ajoutées ensuite » : aujourd'hui les routes authentifiées
  sont dispersées à la racine (`/bureau`, `/account`, `/dashboard`, `/team`, `/admin`, plus
  `/login`, `/register`, `/verify-request`…). Aucun préfixe commun unique n'existe. Robots.txt
  n'accepte que des préfixes de chemin ; une liste de segments ne couvre pas « les routes ajoutées
  ensuite ».
- **Le sitemap lit aujourd'hui le blog hérité hors scope** (architecture : « `sitemap.ts` lit ces
  tables hors de tout scope : les scoper les viderait sans erreur »). Le garder publie dans le
  sitemap de chaque association le blog **de la plateforme** ; le retirer touche une consommation
  que l'architecture cite nommément.
- **Toute lecture de `page` / `news` / `water_analysis` doit passer par `withTenant`** : hors scope,
  RLS forcée ⇒ **zéro ligne, sans erreur**. Un sitemap vide en test est d'abord un oubli de scope.
  Aucune fonction existante ne liste **les pages publiées** d'une association pour un visiteur :
  `getPagesForBureauService` est gardée par l'autorisation du bureau.
- **Critère 1 « publier une page l'y ajoute »** : si la liste est cachée (`'use cache'` +
  `cacheTag`), `publishPageService` / l'action de publication doivent l'invalider par `updateTag`
  (précédent : `updateTag(newsListTag(...))` dans `bureau/actualites/[id]/actions.ts:61`). Une
  lecture non cachée n'a pas ce problème.
- **Pas de type « texte » dans le registre des paramètres** (`email`, `number`, `boolean`,
  `choice`) : un code Search Console ou une description de l'association demandent un nouveau type
  de valeur, avec sa validation (`validateSettingsChanges`, `parseSettingValue`) et son rendu dans
  le formulaire « Réglages ». Le code de vérification Google est une chaîne (≈ 43 caractères
  base64url) ; le bureau colle parfois la balise `<meta …>` entière.
- **Champs SEO d'une page** : ni `page` ni `news` n'ont de description ou d'image de partage.
  Les ajouter = migration (`pnpm db:generate`, jamais de SQL à la main) sur des tables **déjà**
  sous policy (`0013`, `0017`) : aucune nouvelle table, donc l'inventaire RLS ne bouge pas.
- **`metadataBase`** : sans lui, un `openGraph.images` relatif (logo servi par
  `/api/identity/logo`, image d'actualité par `/api/files/...`) casse le build. Il doit venir du
  domaine appelé — donc d'une API de requête dans `generateMetadata`, compatible avec
  `instant = false` déjà posé sur le layout `[locale]` (route bloquante assumée, ADR 003).
- **Logger et cache** : ne pas appeler `logger` dans une fonction `'use cache'` (règle du projet) ;
  les façades passent par l'intercepteur qui journalise — voir le commentaire de `page-dal.ts`.
- **Test d'isolation** : critère 5 ⇒ un e2e sur deux domaines (le seed sert deux tenants par
  domaine, `seed.ts:265-272`). Aucun test existant ne couvre sitemap ou robots
  (`grep -rl "sitemap\|robots" e2e src` ne renvoie que les deux fichiers eux-mêmes).
- **La page d'accueil `/` est celle du boilerplate**, pas une page d'association : elle apparaîtra
  dans le sitemap de chaque tenant avec le titre du produit.

## Open questions

1. **ADR 008 : s11 l'applique-t-elle ?** Passer `routing.ts` en `['fr']` / `localePrefix: 'never'`
   et retirer `en.json`/`es.json` dépasse les cinq critères, mais un sitemap propre en dépend.
   Sinon : sitemap limité à la seule forme d'URL sans préfixe, en acceptant que `/fr/…` et `/es/…`
   restent servies (et donc indexables par d'autres liens).
2. **Quelles pages entrent au sitemap ?** Le critère 1 parle des « pages publiées » (CMS). Les
   actualités publiées, `/actualites`, `/analyses-eau`, `/le-bureau`, `/contact` et le futur
   formulaire de signalement (s10) aussi ? Les dépendances s05 et s09 le laissent penser.
3. **Le blog hérité et `/pricing` sortent-ils du sitemap des associations ?**
4. **Où vivent titre / description / partage « renseignés par le bureau » ?** Colonnes sur `page`
   (et `news` ?), ou dérivés (titre de la page, image d'actualité) ? Et pour les pages à route fixe
   (`/analyses-eau`, `/le-bureau`, `/contact`), qui n'ont aucune ligne en base ?
5. **« Valeurs du tenant » de repli** : quelles valeurs ? Le nom de l'association existe
   (`TenantDTO.name`), mais aucune description d'association n'existe — nouveau paramètre ?
   Image de partage de repli = le logo (`/api/identity/logo`) ?
6. **Préfixe unique pour les routes authentifiées (critère 3)** : déplacer les routes sous un
   préfixe commun est un changement d'URL hors périmètre ; lister les segments ne couvre pas « les
   routes ajoutées ensuite ». Faut-il compléter par un `noindex` posé au niveau des layouts
   authentifiés (`(bureau)`, `(app)`, `admin`, `(auth)`), qui couvre par construction toute route
   ajoutée dessous ?
7. **Comportement sur un domaine qui ne sert aucune association** (sitemap / robots).
8. **Module « page d'accueil »** : la page `/` du boilerplate doit-elle rester telle quelle pour
   s11 ? Aucune story livrée ne l'a remplacée.
