# Revue — Story s45-retrait-pages-publiques-heritees

> Revue en contexte neuf (sous-agent `reviewer`, en lecture seule). Chaque constat est classé critique / majeur / mineur.
> Diff examiné : `git diff main...feature/s45-retrait-pages-publiques-heritees` (un commit : `ada3033`, 303 fichiers, 1 325 ajouts et 54 727 suppressions).
> Références : `docs/plans/s45-retrait-pages-publiques-heritees.md` (validated: yes, décisions A à I), `docs/research/s45-retrait-pages-publiques-heritees.md`, AGENTS.md, ADR 033 (qui voyage avec la branche), ADR 008, 009, 011, 013, 019, 020, 023, `templates/review-checklist.md`.
> Le critère 1 a été reformulé sur `main` (commit `48386a8`, après la création de la branche) : les adresses à plusieurs segments répondent 404 ; celles à un seul segment (`/blog`, `/docs`, `/pricing`, `/pricing_old`, `/privacy`, `/terms`) affichent « Page non trouvée » en statut 200, comme toute adresse inconnue (ADR 013). La revue juge contre ce texte.
> La story n'a pas d'écran nouveau : pas de fichier de design. Seule la cohérence des en-têtes et menus privés du sélecteur de thème est vérifiée.

**Verdict** : aucun constat critique ni majeur. Un seul mineur, sans effet, ouvert.

## Vérifications exécutées par le relecteur

| Contrôle                                         | Résultat                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`                                | 213 fichiers passés, 2549 tests passés, 1 ignoré, **aucun délai dépassé**                                                         |
| `pnpm lint`                                      | 0 erreur ; 2 avertissements dans `.remember/tmp/last-ndc.ts` et `.scratch/check-migration.mjs`, fichiers locaux hors diff         |
| `tsc --noEmit`                                   | aucune erreur, avec un `tsconfig` temporaire excluant `.next/` (types périmés qui citent les routes supprimées), supprimé ensuite |
| `pnpm check:rules`                               | « Règles et documentation alignées sur le code »                                                                                  |
| `pnpm install --frozen-lockfile --lockfile-only` | ne modifie rien : le lockfile est cohérent avec `package.json`                                                                    |
| `pnpm build`, Playwright                         | **non exécutés** (consigne : build et e2e en CI). Les specs e2e ont été relues, dont `e2e/legacy-routes.spec.ts`.                 |

## Plan compliance

- [x] Les 9 tâches du plan sont présentes et cochées. Rien n'est ajouté hors plan, hormis trois fichiers orphelins supprimés (voir « Écarts »).
- [x] Décisions A à I respectées : thème forcé sans toucher la base, `/modules/[module]` conservé, slugs réservés inchangés, chaîne `posts` conservée, `/actualites` comme page de référence des e2e, liens légaux supprimés, bloc de thème du proxy retiré, dépendances MDX retirées (`remark` et `remark-html` gardées), documents de sous-système laissés.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. `tsc` est vert.
- [x] Plus aucun importeur ni `vi.mock` d'un module supprimé dans `src`, `e2e`, `scripts`, `messages`, `.claude`, `.cursor`, `next.config.ts`, `package.json` ni la CI. Seule exception volontaire : `scripts/check-rules.ts` cite les anciens chemins dans `STALE_PATTERNS`.
- [x] Les occurrences restantes de `x-theme` sont dans l'assertion négative de `src/proxy.test.ts`.

## Les points à risque de la story

1. **Modules supprimés — conforme.** Les trois orphelins `blog-adapters.server.ts`, `mdx-headings.ts` et `blog-types.ts` n'étaient importés, sur `main`, que par des fichiers eux-mêmes supprimés (`blog-dal`, `docs/[...slug]`, `mdx-components`, `features/blog`).
2. **`PriceRecap` — conforme.** Déclaré dans `src/lib/stripe/stripe-utils.ts` avec les mêmes champs. `email-service` et `subscription-service` ne sont pas dans le diff ; le webhook Stripe, `/admin/plans` et `/admin/subscriptions` non plus. L'e2e vérifie que « Plans » et « Abonnements » restent dans le menu de `/admin`.
3. **Drapeaux d'environnement — conformes.** `blog` et `docs` sont retirés de `EnabledPageSchema`, de `PagesConst`, de `ci.yml` et de `scripts/init-env.ts` ; aucun `PagesConst.BLOG` ni `PagesConst.DOCS` ne subsiste. `env-schemas.test.ts` refuse les deux valeurs.
4. **Thème — conforme.** `AppProviders` : `forcedTheme="light"`, `defaultTheme="light"`, sans `enableSystem`. `Toaster` fixé à `theme="light"`. `ModeToggle` retiré de `(public)/layout`, `nav-user` et `nav-user-admin`. `src/proxy.ts` ne calcule plus le thème et ne pose plus ni en-tête ni cookie ; aucun lecteur de `x-theme` ne subsiste. `theme.test.tsx` exige `forcedTheme="light"`, y compris quand le navigateur demande le sombre.
5. **Dépendances npm — conformes.** Les neuf paquets MDX, shiki et gray-matter sont retirés ; `remark` et `remark-html` sont gardés (CMS, ADR 019). `"types": []` dans `tsconfig.json` est sûr : l'ancien `["mdx"]` restreignait déjà l'inclusion automatique, et `tsc` passe.
6. **Parties intouchées — conformes.** `/modules/[module]`, `e2e/tenant-isolation.spec.ts`, `RESERVED_PAGE_SLUGS` (`'blog'` de `page-block-types.ts:109` est le slug réservé, conservé) et la chaîne `posts` ne sont pas dans le diff. Le seul fichier de `src/services` touché est `blog-types.ts`, supprimé. Aucun fichier sous `src/db` ni `drizzle` : pas de migration.
7. **Sitemap et robots — conformes.** `sitemap.test.ts` est mis à jour ; `legacy-routes.spec.ts` contrôle les chemins retirés dans `sitemap.xml` et `robots.txt`.
8. **Règles et documents — conformes.** `check:rules` vert, copies `.cursor` régénérées, `rule-mdx-rendering` supprimée avec son entrée d'index, ADR 012 passé à « superseded by ADR 033 ». `instant = false` ne subsiste que dans `admin/layout.tsx` et `[locale]/layout.tsx`, comme l'annonçait le plan.
9. **Design system — conforme.** Le diff n'ajoute ni composant ni token. L'en-tête reste cohérent sans le sélecteur de thème (`PublicMobileMenu` et le reste sont intacts).
10. **Sécurité et multi-tenant — conformes.** Aucun nouvel `withRlsBypass`, aucune valeur en dur, aucun secret.

## Rules compliance

- [x] Conventions du dépôt respectées (AGENTS.md).
- [x] Aucun ADR accepté contredit : 033 (nouveau), 012 (statut modifié), 008, 009, 011, 013, 019, 020, 023.

## Tests

- [x] Suite lancée par le relecteur, passante, sans délai dépassé.
- [x] Les assertions pinent les critères : `theme.test.tsx`, `proxy.test.ts`, `env-schemas.test.ts`, tests de `login`, `register-form`, `reset`, `otp`, `totp`, `nav-user`, `admin-navigation`, `edit-user-settings`.
- `e2e/legacy-routes.spec.ts`, relu et non exécuté, est conforme au critère 1 reformulé : 404 pour `/blog/x`, `/blog/category/x`, `/blog/page/2`, `/docs/x/y`, `/checkout/x`, `/checkout/success` ; statut 200 et « Page non trouvée » pour les six adresses à un segment. Les sélecteurs sont cohérents avec le code (`[data-sidebar="sidebar"]` existe dans `ui/sidebar.tsx`) et les libellés « Plans » et « Abonnements » existent dans `messages/fr.json`.
- **Risque résiduel, CI seulement** : la détection du fond clair par canvas et le contexte Playwright `colorScheme: 'dark'` sont plausibles mais n'ont pas pu être exécutés.

## Écarts déclarés par l'implémenteur — appréciation

- **Critère 1, adresses à un seul segment en statut 200** : acceptable. Arbitré par la propriétaire du produit (reformulation du critère sur `main`, `48386a8`).
- **`tsconfig.json` `"types": []`** : acceptable, nécessaire au retrait de `@types/mdx`.
- **Trois fichiers orphelins supprimés** : acceptable, aucun importeur.
- **`.env.development`, `.env.test`, `.env.local` corrigés en local seulement** (ignorés par git) : sans objet pour la revue. Toute autre machine ou serveur doit retirer `blog,docs` de `NEXT_PUBLIC_ENABLED_PAGES` ; c'est le rappel de production de la définition de fini.
- **Laissés en l'état, hors périmètre** : `docs/adaptation-socle-design-system.md` (inventaire daté), deux commentaires qui citent encore `MDXContent` et `UserPreferencesSync`, `src/app/__tests__/utils.tsx`, `customRender` qui garde un `ThemeProvider` en mode système (infrastructure de test).

## Findings

- **M1 — ouvert, mineur, non bloquant — `messages/fr.json:1441-1446`** — l'espace de noms `PublicMobileMenu` garde les clés `privacy`, `terms`, `docs` et `blog`, qui désignent des adresses retirées. `public-mobile-menu.tsx` ne les lit plus (il n'utilise que `toggle` et `login`). Libellés orphelins, sans effet. Correction peu coûteuse (quatre lignes), à faire au prochain passage ou en mode correction.

## Verdict

Max severity: minor
Ship allowed: yes
