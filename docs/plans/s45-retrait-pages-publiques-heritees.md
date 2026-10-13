---
validated: yes
---

# Plan — Story s45-retrait-pages-publiques-heritees

Branch: `feature/s45-retrait-pages-publiques-heritees`, **créée depuis `origin/main`** (qui porte s44,
fusionnée le 13 octobre 2026 : l'accueil `(public)/page.tsx`, plus de vitrine). Le `main` local doit
être réaligné avant l'exécution.

Recherche : `docs/research/s45-retrait-pages-publiques-heritees.md` (relevée le 7 octobre, **avant** s44
et avant les arbitrages sur le mode clair et les mentions légales). Le plan a revérifié sur
`origin/main` les points qui ont bougé : thème, liens légaux, inventaire des suppressions, specs e2e.

## Target story

Un visiteur du site d'une association ne trouve que les pages de cette association, en clair. **Aucun
code produit ajouté** : la story retire (suppression du code, pas masquage), sans migration.

Critères d'acceptation (condensés, voir `docs/stories.md`) :

1. `/blog…`, `/docs…`, `/pricing`, `/pricing_old`, `/checkout/…`, `/privacy`, `/terms` répondent 404
   sur un domaine d'association, quelle que soit `NEXT_PUBLIC_ENABLED_PAGES`.
2. `/admin/blog` et sous-pages : 404 et hors navigation ; le reste de `/admin` reste accessible.
3. Aucune page servie ne lie une adresse retirée (e2e).
4. `/modules/<module>` reste ; `e2e/tenant-isolation.spec.ts` passe **sans modification**.
5. Sitemap et `robots.txt` ne citent aucune adresse retirée.
6. Stripe plateforme intact : webhook, `/admin/plans`, `/admin/subscriptions`.
7. `blog` et `docs` quittent `NEXT_PUBLIC_ENABLED_PAGES` (schéma, `.env.development`, CI) ; le build
   ne génère aucune page retirée.
8. Clair seul : aucun sélecteur de thème, un navigateur en mode sombre voit du clair (e2e).
9. Aucune règle, copie `.cursor` ni note de story ne cite un fichier ou une route retirés ;
   `pnpm check:rules` passe.

## Décisions de plan

| #   | Décision                                                                                                                                                                                                                                                | Pourquoi / voie de retour                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Thème forcé, pas retiré** (ADR 033, remplace 012) : `forcedTheme="light"`, rien en base ni en CSS.                                                                                                                                                    | Évite la migration et le seed (rejetés en 012). `git revert` rend tout.                                                                                                                                                                     |
| B   | **`/modules/[module]` reste** (sonde de s01, ADR 020).                                                                                                                                                                                                  | Elle porte une preuve d'isolation (`tenant-isolation.spec.ts`). Déjà corrigé dans la story.                                                                                                                                                 |
| C   | **Slugs réservés inchangés** (`blog`, `docs`, `pricing`, `pricing_old`, `checkout`, `privacy`, `terms`, `modules`).                                                                                                                                     | Si le bureau pouvait publier une page `privacy`, `/privacy` répondrait 200 et le critère 1 serait faux. Les mentions légales s'écrivent sous un autre nom (`mentions-legales`, `confidentialite`). `page-block-types.test.ts` ne bouge pas. |
| D   | **Chaîne `posts` conservée** : modèle, repository, service, façade, intercepteur, autorisation, types, branche `file-authorization`, fonctions `file-service`, sujet CASL `Post`, seed. Seuls partent les écrans, DAL, helpers, composants et contenus. | Les tables restent (ADR 023) ; retirer la chaîne toucherait l'autorisation des fichiers et le seed pour du code que rien n'atteint. **Dette notée**, retirable plus tard sans migration.                                                    |
| E   | **Page publique de référence des e2e : `/actualites`** (au lieu de `/privacy`).                                                                                                                                                                         | Toujours 200, même habillage (en-tête, bandeau, navigation, pied), vide ou non. Indépendante des pages désignées comme accueil par d'autres specs.                                                                                          |
| F   | **Liens « conditions / confidentialité » supprimés** (connexion, réinitialisation, OTP, TOTP, inscription), avec leur phrase « En continuant, vous acceptez… » et les clés de messages.                                                                 | Pas de redirection : les mentions légales sont des pages du CMS (s04) que le bureau publie. Le texte légal devient un sujet d'association, pas de produit.                                                                                  |
| G   | **Proxy : le calcul du thème part** (en-tête `x-theme`, cookie `theme`).                                                                                                                                                                                | `x-theme` n'a plus de lecteur après le retrait des docs ; le cookie n'est lu que par le proxy.                                                                                                                                              |
| H   | **Dépendances npm MDX retirées** (tâche 7) après vérification qu'aucun importeur ne reste ; `remark` et `remark-html` **gardés** (CMS, ADR 019).                                                                                                        | Surface d'attaque et temps d'installation. Réversible par `pnpm add`.                                                                                                                                                                       |
| I   | **Docs de sous-système héritées** (`docs/stripe-better-auth-integration.md`, etc.) laissées, sauf les deux lignes de `docs/authentication-system.md` (m7 de s43).                                                                                       | AGENTS.md : elles appartiennent au boilerplate.                                                                                                                                                                                             |

## Tasks (ordered)

Les e2e ne tournent qu'en CI (consigne du dépôt) : la tâche 1 les écrit d'abord, leur « rouge » est
établi par lecture ; l'exécuteur les valide par `tsc`, ESLint et Prettier, la CI par exécution.

1. [x] **Épreuves e2e d'abord.** Nouveau `e2e/legacy-routes.spec.ts`, sur les deux domaines
       (`TENANT_A`, `TENANT_B`) :
       (a) chaque adresse retirée répond 404 (`/blog`, `/blog/x`, `/blog/category/x`, `/blog/page/2`,
       `/docs`, `/docs/x/y`, `/pricing`, `/pricing_old`, `/checkout/x`, `/checkout/success`,
       `/privacy`, `/terms`) ; `/modules/<clé inconnue>` garde son comportement actuel ;
       (b) `/admin/blog` et `/admin/blog/new` : 404 pour le SuperAdmin, et le menu de `/admin` ne
       contient plus « Blog » alors que « Plans » et « Abonnements » restent ;
       (c) sur `/`, `/actualites`, `/login/prestataire`, `/reset-password`, `/bureau`, `/admin`,
       aucun `a[href]` ne pointe vers `/blog`, `/docs`, `/pricing`, `/checkout`, `/privacy`,
       `/terms` ;
       (d) `sitemap.xml` et `robots.txt` ne contiennent aucune de ces adresses ;
       (e) contexte Playwright `colorScheme: 'dark'` : `<html>` n'a pas la classe `dark`, aucun bouton
       de thème (`getByRole('button', {name: /thème|mode/i})`) sur le site public, la connexion,
       `/bureau` et `/admin`, et le fond calculé du `body` est clair.
       Dans la même tâche, **remplacer `/privacy` par `/actualites`** dans `association-identity`,
       `association-settings`, `site-alert`, `site-navigation` ; retirer `/admin/blog` de
       `smoke-authenticated.spec.ts` et `/blog`, `/pricing` de `styles.spec.ts` ; supprimer les
       assertions `a[href="/pricing"]` devenues sans objet de `homepage.spec.ts` et `mobile.spec.ts`
       (elles passent à `legacy-routes`). `tenant-isolation.spec.ts` n'est **pas** touché.
2. [x] **Mode clair seul** (ADR 033). Test d'abord : `theme.test.tsx` / `app-providers` exigent
       `forcedTheme="light"`, `enableSystem` absent, `defaultTheme="light"`. Puis :
       `AppProviders` ; `Toaster` (`theme="light"` fixe, sans `useTheme`) ; retirer `ModeToggle`
       (`theme-toggle.tsx` + test) de `(public)/layout.tsx`, la bascule de `nav-user.tsx` et
       `nav-user-admin.tsx` ; retirer `UserPreferencesSync` (composant, test, montage) ; retirer le
       champ « apparence » de `edit-user-settings.tsx` (schéma, valeurs par défaut, messages
       `appearance.theme.*`) et la ligne de thème de `admin/users/user-detail-form.tsx` ; retirer le
       bloc de thème de `src/proxy.ts` et ses assertions (`proxy.test.ts`) ; clés `ThemeToggle`.
       **Conservés** : enum, colonne, `.dark`, `dark:`, `themeSchema` côté serveur (le champ
       `theme` de `updateUserSettingsAction` reste accepté, inerte).
3. [x] **Vitrine de la plateforme.** Tests d'abord : tests de `login`, `register-form`, `reset`,
       `otp`, `totp` n'attendent plus aucun lien légal ; `stripe-utils` compile avec `PriceRecap`
       déclaré chez lui. Puis : déplacer le type `PriceRecap` dans `src/lib/stripe/stripe-utils.ts`
       (3 importeurs conservés à vérifier : `email-service`, `subscription-service`, tests) ;
       supprimer `(public)/{pricing,pricing_old,checkout,privacy,terms}`,
       `features/checkout-stripe/`, `features/payment/` ; retirer les cinq liens légaux et la phrase
       qui les porte (décision F) avec les clés `terms`, `termsLink`, `and`, `privacyLink` ; espaces
       de noms `Pricing`, `CheckoutPlans`, `Checkout`, `PrivacyPage`, `TermsPage`. Vérifier que
       `src/lib/better-auth/auth.ts` ne référence aucune URL retirée (relevé : aucune).
4. [x] **Blog public et blog admin.** Tests d'abord : `sitemap.test.ts` ne mocke plus `blog-dal` ;
       `locale-defaults.test.ts` perd ses assertions `post-form-validation` et `blog.server` (les
       autres restent) ; test de la navigation `/admin` (sidebar, `nav-admin`) sans « Blog ». Puis :
       supprimer `(public)/blog/**`, `admin/blog/**`, `app/dal/blog-dal.ts`, `app/dal/post-dal.ts`,
       `features/blog/`, `features/admin/blog/`, `lib/helper/blog{,.server,.client}.ts`,
       `content/blog/`, `public/images/blog/` ; l'entrée « Blog » de `admin-sidebar.tsx` et
       `nav-admin.tsx` ; la carte « blog » éventuelle de `admin/page.tsx` ; espaces de noms
       `BlogPage`, `BlogListPage`, `BlogPostPage`, `BlogLayout`, `AdminBlog`, clé `admin.blog`.
       **La chaîne `posts` reste** (décision D).
5. [x] **Documentation héritée et rendu MDX.** Tests d'abord : retirer le test
       `docs/layout — aucun ancetre ne neutralise sticky` de `ui/sidebar.test.tsx` (il lit le
       fichier supprimé) ; le reste du fichier garde ses assertions. Puis : supprimer
       `src/app/[locale]/docs/**` (dont `_files/` : 71 MDX, et `docs-locale.test.ts`),
       `features/docs/`, `public/docs/`, `lib/files/{docs-file-helper,search}.ts`,
       `lib/helper/docs.server.ts`, `components/mdx-content.tsx`, `components/mdx-components.tsx`,
       `createMDX`/`pageExtensions` (`mdx`, `md`) de `next.config.ts`, espaces de noms `DocsPage`,
       `MdxContent`. Vérifier par recherche qu'aucun importeur conservé ne reste (le rendu MDX ne
       sert nulle part ailleurs).
6. [x] **Drapeaux d'activation.** Test d'abord : un test de `EnabledPageSchema`
       (`src/env-schemas.test.ts` ou existant) refuse `blog` et `docs`, accepte les autres valeurs
       courantes. Puis, **dans le même commit** (sinon le démarrage échoue, piège 6) : retirer
       `blog`, `docs` de `EnabledPageSchema`, de `PagesConst` (`src/env.ts`), de
       `.env.development`, de `.github/workflows/ci.yml`, de `scripts/init-env.ts` (choix, défauts,
       libellés l. 80-273) ; retirer tout `isPageEnabled(PagesConst.BLOG|DOCS)` restant.
7. [x] **Dépendances npm.** Vérifier par recherche que plus aucun fichier de `src/`, `scripts/` ni
       `*.config.*` n'importe `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx`, `@shikijs/rehype`,
       `gray-matter`, `next-mdx-remote`, `remark-gfm`, `shiki`, `@types/mdx` ; les retirer par
       `pnpm remove`. **Garder** `remark` et `remark-html` (`render-page-block.ts`). Le lockfile
       change ; `tsc`, ESLint et Vitest repassent sans elles.
8. [x] **Règles et documents qui citent des fichiers retirés.** Test d'abord : ajouter à
       `STALE_PATTERNS` de `scripts/check-rules.ts` les chemins retirés (`features/blog`,
       `features/docs`, `checkout-stripe`, `mdx-content`, `blog.server`, `admin/blog`…) — le
       contrôle échoue tant que les règles les citent. Puis corriger : `helper-rules.md`
       (exemple vivant à remplacer par un helper conservé), `top-down-design.md`,
       `rule-upload-file.md` (réf. `file-dropzone`), `rule-react-cache-next-cache.md` (exemple du
       blog ; routes `instant = false` : il n'en reste que `[locale]/layout.tsx` et
       `admin/layout.tsx`), `rule-mdx-rendering.md` **supprimée** avec son entrée de
       `RULES-INDEX.md` ; puis `pnpm check:rules --fix` pour `.cursor/rules`.
       Documents : `docs/architecture.md` (l. 143, 520, rate limiter du blog, flag
       `NEXT_PUBLIC_ENABLED_PAGES`), `docs/design-system.md` (l. 23 « mode sombre conservé », §10,
       l. 1137-1158 : renvoyer à l'ADR 033), `docs/authentication-system.md` l. 392-393 (m7 de
       s43). Passer la ligne `Status` de l'ADR 012 à `superseded by ADR 033`.
9. [x] **Vérification d'ensemble et commit.** Recherche sans résultat sur les chemins et routes
       retirés dans `src`, `e2e`, `messages`, `scripts`, `.claude`, `.cursor`, `docs/` (hors
       `docs/research`, `docs/plans`, `docs/reviews`, ADR et documents de sous-système cités en
       décision I) ; `pnpm lint`, `tsc --noEmit`, `pnpm test --run`, `pnpm check:rules`, Prettier
       sur les fichiers touchés ; cocher le plan. **Un seul commit**, qui emporte recherche, plan
       et ADR 033.

## Files touched

**Supprimés** (le gros du diff, ~250 fichiers) : `src/app/[locale]/(public)/{blog,pricing,pricing_old,checkout,privacy,terms}/**`,
`src/app/[locale]/admin/blog/**`, `src/app/[locale]/docs/**` (dont 71 MDX), `src/components/features/{blog,docs,payment,checkout-stripe,admin/blog}/**`,
`src/components/{mdx-content,mdx-components,theme-toggle}.tsx` (+ test), `src/components/context/user-preferences-sync.tsx` (+ test),
`src/app/dal/{blog-dal,post-dal}.ts`, `src/lib/helper/{blog,blog.server,blog.client,docs.server}.ts`,
`src/lib/files/{docs-file-helper,search}.ts`, `content/blog/`, `public/docs/`, `public/images/blog/`,
`.claude/rules/01-presentation/rule-mdx-rendering.md` (+ copie `.cursor`).

**Modifiés** : `src/components/context/app-providers.tsx`, `src/components/ui/sonner.tsx`,
`src/app/[locale]/(public)/layout.tsx`, `sidebar/{nav-user,nav-user-admin,admin-sidebar,nav-admin}.tsx`,
`features/user/edit-user-settings.tsx`, `features/admin/users/user-detail-form.tsx`, `src/proxy.ts`,
les cinq écrans d'authentification à liens légaux, `src/lib/stripe/stripe-utils.ts`,
`src/env-schemas.ts`, `src/env.ts`, `.env.development`, `.github/workflows/ci.yml`,
`scripts/init-env.ts`, `scripts/check-rules.ts`, `next.config.ts`, `package.json`, `pnpm-lock.yaml`,
`messages/fr.json`, tests `sitemap`, `locale-defaults`, `ui/sidebar`, `proxy`, `theme`, règles et
documents de la tâche 8.

**Créés** : `e2e/legacy-routes.spec.ts`, `docs/decisions/033-mode-clair-seul.md`.

**Intouchés par décision** : `tenant-isolation.spec.ts`, `(public)/modules/[module]`, chaîne `posts`,
schéma Drizzle, `globals.css` (`.dark`), classes `dark:`, `RESERVED_PAGE_SLUGS`, webhook Stripe.

## Test strategy

- **Vitrine, blog, docs retirés** : la preuve est **e2e** (404 sur les deux domaines, aucun lien, pas de
  sitemap). Une suppression ne se teste pas en unitaire ; ce qui l'est, c'est qu'aucun test conservé
  n'importe un module disparu (un `vi.mock` d'un module absent échoue aussi).
- **Thème** : unitaire sur la configuration du fournisseur et sur l'absence des bascules ; e2e en
  navigateur sombre pour le rendu réel.
- **Drapeaux** : unitaire sur le schéma (refuse `blog`/`docs`) ; le démarrage de la CI prouve le
  nettoyage des `.env`.
- **Règles** : `pnpm check:rules` avec les nouveaux motifs périmés.
- **Stripe** : suites existantes de `stripe-utils`, `subscription-service`, `email-service`,
  webhook, `admin/plans`, `admin/subscriptions` inchangées et vertes.
- Le timeout de `docs-locale.test.ts` disparaît avec le fichier.

## Definition of Done

- Les 9 critères d'acceptation vérifiés, e2e inclus (CI verte sur la PR).
- `tenant-isolation.spec.ts` passe sans modification.
- Aucune migration, aucune modification du schéma Drizzle.
- Un seul commit de story ; l'ADR 033 et les documents mis à jour voyagent avec la branche.
- Revue passée (`Ship allowed: yes`).
- **Avant le premier déploiement qui contient s45** : retirer `blog` et `docs` de la valeur de
  `NEXT_PUBLIC_ENABLED_PAGES` de **production** (figée au build). Sinon la validation de l'environnement
  refuse la valeur et le build échoue. À rappeler au ship de s46, qui retire d'autres familles de la
  même variable.
- **Voie de retour** : `git revert` du commit de la story ; un écran se récupère aussi depuis l'historique
  de `main` ou `upstream/main` (ADR 009).
- **Hors périmètre, signalé** : messages d'autres sous-systèmes retirés encore dans `fr.json`
  (`Tasks`, `Credits`, `Affiliate`, `Projects`, `Chat`…) ; chaîne `posts` orpheline (décision D) ;
  ~125 classes `dark:` inertes (ADR 033).
