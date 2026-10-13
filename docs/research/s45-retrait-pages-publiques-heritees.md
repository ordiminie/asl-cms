# Research — Story s45-retrait-pages-publiques-heritees

> Recherche du 2026-10-07, sur `main` à `f31be84` (s43 livrée, PR 38 ; s44 à s46 inscrites le même
> jour). Tout ce qui suit a été relevé **en ouvrant les fichiers**. `docs/reviews/stories.md` :
> `Stories ready: yes` (revue du 2026-09-20, **antérieure** à l'inscription de s44-s46 : ces trois
> stories n'ont pas encore été revues).

## Target story

**s45-retrait-pages-publiques-heritees — Ne servir que le site de l'association.** Hors du tableau
de périmètre du PRD. Complexité 3, dépend de s43 (livrée) et de s44 (page d'accueil, non faite).
Arbitrages de l'utilisatrice (2026-10-07) : **supprimer le code**, pas masquer ; retirer la vitrine
commerciale de la plateforme des domaines d'association ; pas de migration.

Critères d'acceptation :

1. Blog (`/blog`, `/blog/<slug>`, `/blog/category/…`, `/blog/page/…`), documentation (`/docs`,
   `/docs/…`) et vitrine (`/pricing`, `/pricing_old`, `/checkout/…`, `/modules/…`, `/privacy`,
   `/terms`) répondent 404, même si la configuration active encore ces familles.
2. `/admin/blog` et ses sous-pages répondent 404 et quittent la navigation de `/admin` ; le reste de
   `/admin` reste accessible au SuperAdmin.
3. Aucune page servie ne contient de lien vers une adresse retirée (e2e).
4. Sitemap et `robots.txt` ne mentionnent plus aucune adresse retirée.
5. L'abonnement Stripe plateforme continue de fonctionner : webhook et écrans plans/abonnements de
   `/admin` passent leurs tests.
6. `blog` et `docs` quittent `NEXT_PUBLIC_ENABLED_PAGES` (schéma, `.env.development`, CI) ;
   `pnpm build` passe sans générer de page retirée.

## Current state of the code

### Routes visées (sous `src/app/[locale]/`)

| Famille | Fichiers | Remarque |
| --- | --- | --- |
| Blog public | `(public)/blog/layout.tsx`, `loading.tsx`, `page.tsx`, `[slug]/page.tsx`, `[slug]/actions.ts` (like + `RateLimiterMemory`), `category/[category]/page.tsx`, `category/[category]/page/[page]/page.tsx`, `page/[page]/page.tsx` | 6 gardes `isPageEnabled(PagesConst.BLOG)` |
| Blog admin | `admin/blog/actions.ts`, `page.tsx`, `posts-content.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx` | SuperAdmin, MDX |
| Docs | `docs/layout.tsx`, `page.tsx`, `actions.ts`, `[...slug]/page.tsx`, `docs-locale.test.ts`, `_files/en/**` (71 fichiers MDX) | correctif s43 (`DOCS_CONTENT_LOCALE`) |
| Tarifs | `(public)/pricing/page.tsx` + `loading.tsx`, `(public)/pricing_old/page.tsx` + `loading.tsx` | lisent `subscription-dal` |
| Checkout | `(public)/checkout/[priceId]/page.tsx`, `better-auth/page.tsx`, `better-auth/checkout-better-auth.tsx`, `success/page.tsx` | 2 des 4 `instant = false` restants |
| Légal | `(public)/privacy/page.tsx`, `(public)/terms/page.tsx` | gabarit du boilerplate (« [Nom de l'entreprise] »), `'use cache'` + `cacheLife('max')` |
| `/modules/[module]` | `(public)/modules/[module]/page.tsx` | **pas de la vitrine** — voir piège 1 |

### Code qui ne sert que ces routes (candidats au retrait)

- **Composants** : `src/components/features/blog/` (6), `features/docs/` (11, dont `search-modal`,
  `callout`, `code-block`, `steps`, `tabs`), `features/admin/blog/` (10, dont `post-form-validation.ts`
  et `file-dropzone.tsx`), `features/payment/` (`pricing.tsx` + test), `features/checkout-stripe/`
  (`actions.ts`, `checkout-page.tsx`, `checkout-stripe-util.ts`, `subscription-recap.tsx`, dossiers
  `embed`, `external-checkout`, `installments`, `payment-link`, `react-stripe`).
- **Rendu MDX** : `src/components/mdx-content.tsx` (seuls importeurs : `blog-article.tsx`,
  `docs/[...slug]/page.tsx`, `docs-locale.test.ts`) et `src/components/mdx-components.tsx` (seul
  importeur : `mdx-content.tsx` ; importe 4 composants de `features/docs/`). Les deux deviennent
  orphelins.
- **Helpers** : `src/lib/helper/blog.ts`, `blog.server.ts`, `blog.client.ts` ;
  `src/lib/files/docs-file-helper.ts`, `src/lib/files/search.ts` ; `src/lib/helper/docs.server.ts`
  (lit `.cursor/rules` et `docs/`, référencé seulement par un MDX de `_files`).
- **DAL** : `src/app/dal/blog-dal.ts` (canonical et `hreflang` préfixés, `cacheTag('blog')`),
  `src/app/dal/post-dal.ts` (importé par les seules pages `admin/blog`).
- **Contenus** : `content/blog/` (4 articles, `en.mdx`/`fr.mdx`), `src/app/[locale]/docs/_files/`
  (71), `public/docs/` (58 images), `public/images/blog/article-test.png`.
- **Messages** (`messages/fr.json`) dont aucun usager conservé n'a été trouvé : `BlogPage`,
  `BlogListPage`, `BlogPostPage`, `BlogLayout`, `DocsPage`, `MdxContent`, `Pricing`, `CheckoutPlans`,
  `Checkout`, `PrivacyPage`, `TermsPage`, `AdminBlog`. Les tests `(public)/layout.test.tsx`,
  `public-mobile-menu.test.tsx` et `admin-sidebar.tsx` citent « Blog »/« Docs » comme **libellés
  littéraux** (assertions d'absence ou entrée de menu), pas comme espaces de noms.

### Chaîne de persistance `posts` (tables conservées, ADR 023)

`src/db/models/post-model.ts`, `src/db/repositories/post-repository.ts`,
`src/services/post-service.ts`, `src/services/facades/post-service-facade.ts`,
`src/services/facades/interceptors/post-service-logger-interceptor.ts`,
`src/services/authorization/post-authorization.ts`, `src/services/types/domain/post-types.ts`,
`src/services/__tests__/post-service.test.ts`. Liens **dans du code conservé** :

- `src/db/models/db.ts` enregistre le schéma `post-model` ;
- `src/services/authorization/file-authorization.ts` l. 2 et 142-147 : branche
  `EntityTypeConst.POST` via `getPostByIdDao` ;
- `src/services/file-service.ts` l. 295-321 : `uploadFilePostService`, `listFilesByPostIdService`,
  `deleteFileByPostIdService` (test dédié : `src/services/__tests__/file-service-blog.test.ts`) ;
- `src/services/authorization/casl-abilities.ts` l. 24 et 46 : sujet CASL `'Post'` ;
- `src/db/scripts/seed.ts` l. 341-380 : catégories, hashtags et posts insérés ;
- `src/db/rls-inventory.test.ts` certifie le classement RLS de `docs/architecture.md`, où `posts`
  & co. sont « exemptées, blog hérité hors produit » (l. 380).

## Anchor points

- **Drapeaux** : `EnabledPageSchema` (`src/env-schemas.ts` l. 20-32, `z.enum` puis `.pipe`),
  `PagesConst.BLOG` / `DOCS` (`src/env.ts` l. 23-24), `isPageEnabled` (`src/lib/utils.ts` l. 14-15).
  Valeurs : `.env.development` l. 42, `.github/workflows/ci.yml` l. 44, `scripts/init-env.ts`
  (l. 80, 138, 167 : défaut `'blog,docs,apikey,organization'`).
- **Liens conservés vers `/privacy` et `/terms`** (mentions « En continuant, vous acceptez… ») :
  `src/components/features/auth/forms/login.tsx` l. 38-39,
  `src/app/[locale]/(auth)/reset-password/reset.tsx` l. 153-154,
  `src/app/[locale]/(auth)/verify-request/otp/otp.tsx` l. 233-234,
  `src/app/[locale]/(auth)/verify-request/totp/totp.tsx` l. 140-141,
  `src/components/features/auth/forms/register-form.tsx` l. 365-366 (`/register` : s46).
- **Lien conservé vers `/pricing`** : `src/app/[locale]/page.tsx` l. 75 — c'est la page que s44
  remplace (dépendance déclarée).
- **Navigation `/admin`** : `src/components/features/layouts/sidebar/admin-sidebar.tsx` l. 50-51
  (libellé littéral « Blog ») et `nav-admin.tsx` l. 59-60 (`t('admin.blog')`).
- **Site public** : `(public)/layout.tsx` et `public-footer` ne lient déjà ni blog, ni docs, ni
  tarifs (tests d'absence existants : `(public)/layout.test.tsx` l. 98-101,
  `public-footer.test.tsx` l. 71, `public-mobile-menu.test.tsx` l. 41).
- **Sitemap / robots** : `src/app/sitemap.ts` ne liste déjà ni blog ni vitrine (s11) ;
  `sitemap.test.ts` l. 9 et 19 **mocke et importe** `@/app/dal/blog-dal` pour prouver qu'il n'est pas
  appelé, et l. 95-96 vérifie l'absence de `/blog`, `/pricing`, `/terms`, `/privacy`.
  `src/app/robots.ts` n'interdit que les segments authentifiés et de connexion : aucune adresse
  retirée n'y figure. Les critères 4 sont donc **déjà vrais** ; à maintenir, pas à construire.
- **Proxy** : `src/proxy.ts` l. 71-72 pose l'en-tête `x-theme` « pour Shiki » ; seul lecteur :
  `docs/[...slug]` (coloration). Le cookie `theme` voisin sert ailleurs : ne pas le confondre.
- **Build MDX** : `next.config.ts` l. 4, 15 (`pageExtensions` incluant `mdx`, `md`) et 76-82
  (`createMDX`). Aucune page `.mdx` hors `_files/` dans `src/`.
- **Slugs réservés** : `RESERVED_PAGE_SLUGS` (`src/services/types/domain/page-block-types.ts`
  l. 100-129) contient `blog`, `checkout`, `docs`, `modules`, `pricing`, `pricing_old`, `privacy`,
  `terms` ; `page-block-types.test.ts` l. 80-97 exige `blog`, `docs`, `modules`, `pricing_old`.

## Verified APIs / functions

| Élément | Emplacement | État vérifié |
| --- | --- | --- |
| `requireEnabledModuleDal(module)` | `src/app/dal/tenant-dal.ts`, appelé par `(public)/modules/[module]/page.tsx` | sonde de s01 (ADR 010, 013), `data-testid="module-actif"` |
| `isPageEnabled(page)` | `src/lib/utils.ts:14` | lit `env.NEXT_PUBLIC_ENABLED_PAGES` |
| `PriceRecap` (type) | `src/components/features/checkout-stripe/actions.ts:23` | importé par **`src/lib/stripe/stripe-utils.ts:4`** (conservé) |
| `stripe-utils` | `src/lib/stripe/stripe-utils.ts` | importé par `email-service.ts:42`, `subscription-service.ts:39`, `account/billing/subscription/action.ts` (s46) et 5 tests |
| `subscription-dal` | `src/app/dal/subscription-dal.ts` | importé par `admin/plans/plans-content.tsx`, `admin/subscriptions/subscriptions-content.tsx`, `account/billing/subscription/*` (s46), `stripe-utils.ts` |
| Plugin Stripe Better Auth | `src/lib/better-auth/auth.ts` l. 192-215 | `createCustomerOnSignUp`, `subscription.plans`, `onSubscriptionComplete` : **aucune URL** de succès ou d'annulation ; elles sont passées par l'appelant |
| URLs Checkout | `checkout-better-auth.tsx` l. 69-70, 102-103 ; `checkout-stripe/external-checkout/actions.ts` l. 220-221 ; `embed/action.ts` l. 210 ; `installments/action.ts` l. 391 | toutes vers `/checkout/success` ou `/pricing`, **toutes dans du code retiré** |
| Webhook | `src/app/api/webhooks/stripe/route.ts` | aucune dépendance aux routes retirées (seulement un exemple `curl` en commentaire) |
| Dépendances npm | `package.json` | `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx`, `@shikijs/rehype`, `gray-matter`, `next-mdx-remote`, `remark-gfm`, `shiki`, `@types/mdx` : aucun usager conservé. **`remark` et `remark-html` sont utilisés par `src/lib/cms/render-page-block.ts`** (CMS, ADR 019) : à garder |

## Traps & constraints

1. **`/modules/[module]` n'est pas de la vitrine.** C'est la **sonde d'activation de module de s01**
   (commentaire en tête du fichier : « la preuve du critère 4 de s01 », remplacée par s33-s35). Elle
   est exercée par `e2e/tenant-isolation.spec.ts` l. 93-148 (isolation, module inactif, clé
   inconnue). La retirer casse une preuve d'isolation multi-tenant. Le critère 1 de la story la cite
   par erreur : à corriger (revue du découpage ou plan).
2. **Quatre specs e2e utilisent `/privacy` comme page publique de référence** :
   `association-identity.spec.ts` l. 249 et 339, `association-settings.spec.ts` l. 32
   (`PUBLIC_PAGE`), `site-alert.spec.ts` l. 45 et `site-navigation.spec.ts` l. 35 (`PUBLIC_ROUTE`).
   Elles vérifient l'en-tête, le bandeau, la navigation… sur une page statique. Il faut une autre page
   publique stable (`/contact`, `/actualites`, `/le-bureau`…), en vérifiant qu'elle porte bien le
   même habillage.
3. **Autres specs e2e touchées** : `smoke-authenticated.spec.ts` l. 41 (`/admin/blog` dans
   `ADMIN_ROUTES`), `styles.spec.ts` l. 14 (`ROUTES` contient `/blog` et `/pricing`),
   `seo.spec.ts` l. 173 (assertion d'absence, reste valable).
4. **Tests unitaires qui importent du code retiré** : `src/lib/__tests__/locale-defaults.test.ts`
   l. 12 et 16 (`post-form-validation`, `blog.server` — créé en s43), `src/app/sitemap.test.ts`
   (mock de `blog-dal`), `src/components/ui/sidebar.test.tsx` l. 54-57 (lit le **fichier**
   `docs/layout.tsx` pour un test de `sticky`), `payment/pricing.test.tsx`,
   `docs/docs-locale.test.ts`, `file-service-blog.test.ts`, `post-service.test.ts`. Un import
   résolu dans un `vi.mock` échoue aussi si le module disparaît.
5. **`PriceRecap` vit dans un dossier retiré mais sert du code conservé** (`stripe-utils.ts:4`).
   Supprimer `features/checkout-stripe/` sans déplacer ce type casse `stripe-utils`, donc
   `email-service` et `subscription-service`.
6. **Le schéma d'env refuse une valeur inconnue.** `EnabledPagesSchema` fait `.pipe(z.array(EnabledPageSchema))` :
   retirer `blog`/`docs` de l'enum alors qu'un `.env` les contient encore fait **échouer la validation
   au démarrage et au build** (`src/env.ts`, `onValidationError` → throw). Ordre à respecter :
   `.env.development`, `ci.yml`, `scripts/init-env.ts` et tout `.env` de serveur doivent être
   nettoyés dans le même commit. La recherche de s12b (l. 148, 696) note que la valeur de
   production est figée au build.
7. **Frontière avec s46 côté Stripe.** Après s45, le seul écran qui démarre un abonnement plateforme
   est `/account/billing/subscription` — que s46 retire. Ensemble, s45 et s46 suppriment **tout
   parcours d'achat** dans l'application ; `/admin/plans` et `/admin/subscriptions` gèrent et listent,
   ils ne créent pas d'abonnement. Aucun document (PRD, ADR 011, architecture) ne décrit comment une
   association souscrit ; le webhook et le plugin continuent de fonctionner pour un abonnement créé
   ailleurs (tableau de bord Stripe).
8. **Liens « conditions » et « confidentialité » des écrans de connexion.** Retirer `/privacy` et
   `/terms` laisse 4 écrans conservés (connexion, réinitialisation, OTP, TOTP) avec des liens morts
   — le critère 3 l'interdit. Les supprimer laisse ces écrans sans mention légale.
9. **Règles et docs du dépôt qui pointent vers des fichiers retirés** (précédent s01 : une règle ne
   doit pas citer un fichier absent ; `pnpm check:rules` régénère `.cursor/rules`) :
   - `.claude/rules/00-generals/helper-rules.md` l. 60, 92-139 (exemple vivant : `blog.ts`,
     `blog.server.ts`, `blog.client.ts`) ;
   - `.claude/rules/00-generals/top-down-design.md` l. 88 (référence :
     `checkout-stripe/external-checkout/actions.ts`) ;
   - `.claude/rules/01-presentation/rule-mdx-rendering.md` (toute la règle porte sur le rendu
     blog/docs) + son entrée dans `RULES-INDEX.md` ;
   - `.claude/rules/01-presentation/rule-upload-file.md` l. 375 (référence : `file-dropzone.tsx`
     de l'admin blog) ;
   - `.claude/rules/01-presentation/rule-react-cache-next-cache.md` l. 78 (exemple
     `blog-article.tsx`) et l. 160-163 (les 4 routes `instant = false`, dont 2 checkout et
     `docs/[...slug]` ; il en restera 2 : `[locale]/layout.tsx` et `admin/layout.tsx`).
   - `docs/architecture.md` l. 143 et l. 520 (rate limiter du blog), `docs/design-system.md`
     l. 1153. Les docs de sous-système héritées (`docs/stripe-better-auth-integration.md`,
     `docs/authentication-system.md` l. 392-393, m7 de s43) relèvent du boilerplate (AGENTS.md) :
     à corriger ou laisser, choix à porter au plan.
10. **Cache Components** : les pages retirées portent `'use cache'`, `cacheTag('blog')` et
    `generateStaticParams` ; leur disparition n'en laisse aucun orphelin côté conservé
    (`updateTag('blog')` n'est appelé que dans `admin/blog/actions.ts`). L'avertissement Turbopack
    sur `blog.server.ts:62` (`fs.readFileSync`, vu au build de s43) disparaît avec le fichier.
11. **Le `docs-locale.test.ts` de s43** (test de recherche qui dépasse 5 s sur le montage 9p et fait
    échouer le hook pre-push) part avec la route : le constat m10 et ce flottement disparaissent.
12. **Thème sombre** : l'en-tête `x-theme` du proxy n'a plus de lecteur après le retrait des docs. Le
    calcul du thème et le cookie `theme` restent (le design system a retiré le thème sombre, mais
    c'est hors du périmètre de cette story).
13. **Messages hérités hors périmètre** : `fr.json` contient encore `Tasks`, `Credits`, `Affiliate`,
    `Projects`, `Chat`… (sous-systèmes retirés par s01/ADR 009). Pas dans le périmètre de s45 ; le
    signaler sans l'étendre.

## Open questions

1. **`/modules/[module]`** : sortir du périmètre (recommandé par la lecture du code) — la story doit
   être corrigée avant `/ks-plan`, ou le plan l'acte explicitement.
2. **Mentions légales** : le PRD, les stories et le cahier V5 n'exigent pas de page de mentions
   légales ou de confidentialité sur le site d'une association (V5 ne parle que des mentions des
   emails, l. 159). La loi française (LCEN) en impose pourtant sur tout site édité. Retirer `/privacy`
   et `/terms` (gabarits « [Nom de l'entreprise] ») sans remplaçant est cohérent avec l'arbitrage,
   mais que deviennent les liens des écrans de connexion : supprimés, ou redirigés vers une page CMS
   que le bureau créerait ? À trancher avec l'utilisatrice — éventuellement une story à part.
3. **Parcours d'achat plateforme** : confirmer qu'aucun écran ne doit permettre à une association de
   souscrire (piège 7), et que l'abonnement se crée hors application. Si un parcours doit exister, il
   revient à une story de facturation plateforme, pas à s45 ni s46.
4. **Chaîne `posts` orpheline** : retirer service, façade, repository, autorisation, branche
   `file-authorization`, fonctions `file-service` et sujet CASL `Post`, ou garder la persistance
   (tables conservées) ? Le modèle Drizzle doit rester tant que les tables existent (drizzle-kit les
   suivrait sinon comme à supprimer au prochain `db:generate`). Le seed des posts : garder ou retirer.
5. **Dépendances npm** (`next-mdx-remote`, `shiki`, `@next/mdx`, `gray-matter`…) et `createMDX` /
   `pageExtensions` de `next.config.ts` : les retirer est un changement de dépendances, que AGENTS.md
   range parmi les sujets sensibles. Dans s45 ou dans une story à part ?
6. **Slugs réservés** : une fois les routes retirées, `blog`, `docs`, `pricing`, `privacy`, `terms`…
   peuvent être libérés pour le CMS (le bureau pourrait créer `/confidentialite`… ou `/privacy`) ou
   rester réservés par prudence. `page-block-types.test.ts` exige aujourd'hui `blog`, `docs`,
   `pricing_old`.
7. **Page publique de référence des e2e** (piège 2) : laquelle choisir pour garder des specs
   déterministes — à vérifier sur le seed des deux tenants.
8. **Docs de sous-système héritées** citant blog, docs ou checkout : corriger, supprimer ou laisser
   (AGENTS.md interdit de les implémenter, pas de les toucher).
