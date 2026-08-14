# Research — Story s000-cache-components-migration

> ⚠️ Hors pipeline killer-saas : `docs/stories.md` et `docs/prd.md` n'existent pas encore.
> Ce sujet n'a pas passé `/ks-stories-review` — il n'est rattaché à aucun périmètre PRD validé.
>
> **v2** — révisé après challenge adversarial (5 angles, 36 agents, 20 objections confirmées).
> Source de doc : `node_modules/next/dist/docs/` (Next **16.3.0** installé), pas nextjs.org (16.3.1).

## Target story

Résoudre le warning de build `⚠ experimental.useCache is deprecated. Please use the top-level cacheComponents option instead` (`next.config.ts:37`).

## Current state of the code

### Le fait décisif : le flag est activé mais totalement inutilisé

| Primitive Cache Components | Occurrences dans `src/` |
| -------------------------- | ----------------------- |
| `'use cache'`              | **0**                   |
| `cacheLife()`              | **0**                   |
| `cacheTag()`               | **0**                   |

`experimental.useCache: true` n'autorise qu'une directive que personne n'utilise.

### Le modèle de cache réellement en place

| API                        | Occurrences  | Emplacement                                          |
| -------------------------- | ------------ | ---------------------------------------------------- |
| `revalidatePath`           | 65           | tous les `actions.ts`                                |
| `revalidateTag(tag, prof)` | **4**        | `admin/plans/actions.ts:40,95,140,177`               |
| `unstable_cache`           | 3            | `app/dal/post-dal.ts`, `app/dal/subscription-dal.ts` |
| React `cache()`            | ~tout le DAL | `app/dal/*`                                          |

⚠️ Le `✅ déjà conforme Next 16` des `revalidateTag` masque un **bug actuel** : `'max'` =
stale-while-revalidate (`docs/…/revalidateTag.md:23`, `max.expire = 1 an` via
`config-shared.js:179-183`), pas expiration immédiate. Les tags `plans` sont posés par
`subscription-dal.ts:49,69` et consommés par `(public)/pricing/page.tsx:20-25` + les 5 actions
checkout — que `revalidatePath('/admin/plans')` ne couvre pas. **Les pages publiques de pricing
peuvent servir un ancien tarif après modification admin.** Primitive correcte : `updateTag('plans')`.
Ce bug est **indépendant du flag**.

## Anchor points

**64 pages, 8 layouts, 9 route handlers** (dont `sitemap.ts` et `robots.ts`, Special Route Handlers), 3 locales.

### Route segment configs qui casseraient le build

9 `dynamic = 'force-static'` : `[locale]/page.tsx:17`, `(public)/privacy:6`, `terms:6`, `contact:8`,
`blog/page:19`, `blog/page/[page]:17`, `blog/category/[category]:18`,
`blog/category/[category]/page/[page]:19`, `blog/[slug]:16`.
3 `dynamicParams = false` : `privacy:7`, `terms:7`, `contact:9` — tous déjà porteurs de `force-static`,
donc bloquants de toute façon.

> Sur `dynamicParams`, la doc 16.3.0 **se contredit** :
> `migrating-to-cache-components.md:593` dit « `dynamicParams: false` is unchanged », alors que
> `route-segment-config/dynamicParams.md:22` dit « not available when Cache Components is enabled ».
> La chaîne d'erreur citée en v1 de ce document n'existe pas dans le 16.3.0 installé — elle venait de
> la doc en ligne 16.3.1. Mécanisme non établi.

### `generateStaticParams` retournant `[]` → `empty-generate-static-params`

Pas seulement quand le feature flag blog est coupé — **2 des 4 retournent `[]` avec le flag activé,
sur le contenu livré** : `blog/page/[page]:24,28` et `blog/category/[category]/page/[page]:26,32`
partent d'un tableau rempli par `for (page = 2; page <= totalPages; page++)`. Avec 4 MDX et
`BLOG_POSTS_PER_PAGE = 10` (`blog-dal.ts:25`), `getTotalPagesDal` → 1 → boucle jamais exécutée.
`blog/[slug]/page.tsx:30` a en plus un `return []` dans un `catch`.

### Accès runtime — surface réelle bien plus faible qu'annoncé en v1

**30 `await headers()` exactement, dont 22 dans des fichiers `'use server'`** (jamais prerendered).
Chemin de prerender réel : **7** — `auth-service.ts:24,31,47`,
`(app)/account/invitations/[id]/page.tsx:17`, `docs/[...slug]/page.tsx:186`, `lib/api-auth.ts:29,76`
(atteints depuis des `export const GET`, qui prerendent sous cacheComponents).
v1 surestimait d'un facteur ~4.

**11 composants client `useSearchParams`** (et non 13 : 2 hits étaient des `.mdx`).

## Traps & constraints

Les 4 traps ci-dessous ont été **découverts par le challenge** et absents de la v1. Deux sont bloquants.

### T1 — IO synchrone au prerender : bloquant, non contournable

`src/app/dal/blog-dal.ts:392` → `Math.floor(Math.random() * (i + 1))` dans `shuffleArray`, appelé
`:419-420` par `getRelatedPostsDal`, consommé par `(public)/blog/[slug]/page.tsx:103` — page en
`force-static`, route réellement générée.

Sous cacheComponents : `io-utils.js:24-34` case `'prerender'` → `abortOnSynchronousPlatformIOAccess`
→ `StaticGenBailoutError`, message E1432. Les modes actuels (`prerender-ppr`, `prerender-legacy`) sont
exemptés (`io-utils.js:88-93`) — **le build passe aujourd'hui et casserait après migration**.
`instant = false` ne le neutralise pas (`dynamic-rendering.js:1013-1014`). Correctif : `'use cache'`.

Autres sites : `ui/sidebar.tsx:605` (E1434), `sitemap.ts:73,151,176,224,261` (`new Date()`).

### T2 — `sitemap.ts` : régression SEO silencieuse

5 `new Date()` + 4 accès DAL non cachés (`:106,163,190,233`). Le bail-out est un **throw attrapé par
le `try/catch` existant** (`sitemap.ts:272` → `console.error`) → **build vert, sitemap amputé de
toutes les URLs blog**. Aucune échappatoire : `instant` n'existe que pour `layout.tsx`/`page.tsx`.
Exactement le type de régression que le filet « build seul » ne verrait jamais.

### T3 — `AuthProvider` client à la racine : le poste le plus lourd

`auth-provider.tsx` (`'use client'`) utilise `useRouter`, `usePathname:35`, `useParams:36`, et enveloppe
les 64 pages via `[locale]/layout.tsx:29` → `base-layout.tsx:24` → `app-providers.tsx:26`.
Ces hooks suspendent quand la route a des params non résolus. **Aggravant** : le
`generateStaticParams` de `[locale]/layout.tsx:51-53` est **commenté**, donc `locale` est fallback
param sur **40 des 64 pages**.

Au total **7 composants** utilisent des hooks de route (`lang-toggle:20,22`, `auth-provider:35,36`,
`app-breadcrumb:23`, `docs-breadcrumb:68`, `docs-sidebar:60`, `use-table-of-contents:15`,
`post-form:111`), montés dans des layouts qui contiennent **0 `Suspense`**.

**Mitigation à 3 lignes** : décommenter `[locale]/layout.tsx:51-53` (`routing` déjà importé l.7).
Réduit fortement la surface sans l'éliminer. À vérifier : pourquoi ça avait été désactivé (commit
`0b30ca9`, non documenté).

### T4 — `withAuth` : l'await précède tout JSX

`with-auth.tsx:17` `await getAuthUser()`, `:24` `redirect()`, `:27` `forbidden()`, `:30` premier JSX.
Appliqué à `(app)/layout.tsx:62`, `admin/layout.tsx:49` et 17 pages. Envelopper `{children}` de
`<Suspense>` est inutile, l'await est en amont. Et sous streaming, `forbidden()` change de sémantique :
« the response has already begun streaming as a `200`, and the status can't change… run that check in
`proxy` instead ». Or `src/proxy.ts` ne fait **aucune** auth. Cela contredit
`.claude/rules/01-presentation/rule-safe-route.md:21` → **règle projet à réécrire**.

### T5 — `searchParams` awaité au-dessus de la frontière Suspense

7 pages : `admin/blog:17` (vs Suspense `:22`), `admin/organizations:25/:30`, `admin/plans:21/:26`,
`admin/submissions:27/:32`, `admin/subscriptions:25/:30`, `admin/users:21/:26`,
`(public)/checkout/[priceId]:18` (aucun Suspense). La présence de `Suspense` dans le fichier ne suffit
pas : la promesse doit être passée en prop au composant enveloppé.

### T6 — `use cache` ne persiste pas entre déploiements

Contrairement à `unstable_cache`. Convertir le cache des plans Stripe (1 h) le ferait repartir froid à
chaque déploiement et chaque instance serverless.

### T7 — `<Activity>` : état préservé, et un point sécurité

Les routes ne sont plus démontées. `preserving-ui-state.md:255` : « Activity preserves local component
state… **including authentication changes** ». Et `:257` recommande `window.location.href` pour le
logout. Le boilerplate fait l'inverse : `logout-button.tsx:21` `router.push('/login/')`, et
`logoutAction()` ne redirige pas (`(auth)/action.ts:524-529`). Une ligne à changer, mais réelle.
À noter : `<Activity>` est **inactif** sans cacheComponents — rester sur l'ancien modèle ne crée
aucun risque de ce type.

### T8 — Le filet de sécurité existe, mais n'est pas branché

Correction de la v1 : **13 tests Playwright existent** (`e2e/auth.spec.ts` 8, `homepage.spec.ts` 3,
`mobile.spec.ts` 2), et `playwright.config.ts:50-54` déclare un `webServer` → suite auto-démarrante.
Ils ne sont simplement **pas en CI** (0 hit playwright dans `.github/workflows/`). Next livre en plus
`@next/playwright` avec un helper `instant()` conçu pour ces régressions.

## Options

| Option                                            | Effort   | Risque               | Warning résolu |
| ------------------------------------------------- | -------- | -------------------- | -------------- |
| **A+.** Supprimer le flag (2 fichiers)            | ~10 min  | Nul                  | Oui            |
| **B.** `cacheComponents` + `instant=false` massif | 2-4 j    | Élevé                | Oui            |
| **C.** Adoption complète                          | 3-6 sem. | Très élevé           | Oui            |
| **D.** Ne rien faire                              | 0        | **Compte à rebours** | Non            |

**Option A+ porte sur 2 fichiers, pas 1** :

1. `next.config.ts:37`
2. `src/app/[locale]/docs/_files/en/10-deployment/01-vercel.mdx:231` — le flag est **prescrit aux
   clients** sous le libellé « Performance optimizations » (l.227), sur une page publiquement
   indexable. Le retirer du repo en le laissant dans la doc serait pire que ne rien faire.

**Option D n'est pas « risque nul »** : `version-16.md:1202` écrit au passé accompli — « The
`experimental.dynamicIO` and `experimental.useCache` flags **have been removed**. » Le jumeau nommé
dans la même phrase est déjà fatal : `dynamicIO` a disparu du schéma et déclenche un throw **E394**
(`config.js:129-131`). `useCache` n'a encore qu'un `warnOnce` (`config.js:1235`). C'est un sursis,
hérité par chaque client ayant forké.

B et C sont **plus chers que la v1 ne l'annonçait** : le poste dominant n'est pas les `headers()`
(surestimés ×4) mais T1 + T3 + T4.

## Questions ouvertes — état

**Q1 — Flag intentionnel ou copié ? → partiellement tranché.** Ce n'est pas un résidu de template : il
est reproduit délibérément dans la doc client (`vercel.mdx:227,231`). Croyance erronée assumée et
documentée. Reste à confirmer par Mike s'il y avait intention d'adopter PPR.

**Q2 — Argument commercial ? → positionnement, pas contrainte.** `unstable_cache.md:7-8` recommande
d'opter pour Cache Components, et l'ancien guide est retitré « Caching and Revalidating (**Previous
Model**) ». Mais **aucune date de retrait** de l'ancien modèle n'existe dans la doc. Le coût de ne pas
migrer est réputationnel (`README.md:3,11` vend « Next.js 16 »), pas technique — hors le flag lui-même.

**Q3 — `staleTimes` survit-il ? → OUI, tranché.** Intégralement, et il alimente déjà `cacheLife` :
`config.js:1016-1020` le normalise sans garde `cacheComponents`, `config.js:1054-1057` backfille
`cacheLife['default'].stale = staleTimes.static`, `stale-time.js:81-85` l'utilise au runtime.
`cacheLife.md:260` : « Updating `staleTimes.static` also updates the `stale` value of the `default`
cache profile. » Vérifié empiriquement : `cacheLife.default.stale = 180`, qui vient de
`next.config.ts:40`. **À retirer de la colonne risque de B et C.**

**Q4 — Cache Stripe froid ? → sans objet pour A+.** Mais voir le bug `revalidateTag`/`updateTag` plus haut.

## Recommandation

**Option A+, immédiatement.** La prescription de la doc s'applique littéralement (0 `use cache`) ;
D n'est pas tenable à terme ; et tous les blocages découverts alourdissent B et C sans affaiblir A+.

Deux chantiers **indépendants du flag**, à ouvrir séparément :

- `revalidateTag('plans','max')` → `updateTag('plans')` : bug de tarification potentiel **aujourd'hui**.
- Brancher les 13 tests Playwright en CI : préalable à toute reprise de B ou C.
