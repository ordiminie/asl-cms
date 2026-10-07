---
validated: yes
---

# Plan — Story s43-locale-unique

Branch: `feature/s43-locale-unique`, à créer depuis `main` à jour (`be960b9` au moment du plan).

> **Sources** :
>
> - recherche : `docs/research/s43-locale-unique.md` (2026-10-06) ;
> - décisions : ADR 008 (locale unique, framing), **ADR 031** (rédigé avec ce plan : redirection des
>   préfixes par `next.config.ts`), ADR 020 (pages CMS à la racine, slugs réservés) ;
> - règles : `rule-architecture`, `rule-translation`, `rule-safe-route`, `rule-ci-cd-devops`,
>   `rule-react-cache-next-cache`.
>
> Pas de design : la story ne crée aucun écran, elle en retire un contrôle (`LangToggle`).

## Target story

**En tant que** visiteur **je veux** que chaque page du site n'ait qu'une adresse, en français
**afin que** les liens partagés par le bureau soient courts, stables, et que les moteurs de recherche
ne voient pas trois fois la même page. Complexité 2, dépend de s11 (livrée). Constat déclencheur du
2026-10-06 : l'utilisatrice est renvoyée sans cesse vers `/en/…` en contrôlant l'application.

1. Le routage ne déclare qu'une locale, `fr`, sans préfixe d'URL : toute page publique, du bureau ou
   de l'espace membre est servie à son adresse sans préfixe, en français, avec `<html lang="fr">`.
2. Une adresse préfixée par `/fr`, `/en` ou `/es` ne sert plus aucune page : elle redirige de façon
   permanente vers la même adresse sans préfixe.
3. Les routes authentifiées restent protégées par le proxy sans préfixe : un visiteur sans session
   qui ouvre `/bureau` est renvoyé vers la connexion.
4. Les liens des emails et le sitemap ne portent aucun préfixe.
5. `messages/en.json` et `messages/es.json` sont retirés, ainsi que le sélecteur de langue ; aucun
   libellé ne manque en français.

### Décision rendue par l'utilisatrice (2026-10-06)

**Écrans hérités : le minimum.** s43 ne retouche le blog, la documentation et les réglages du compte
hérités que pour qu'ils compilent et que les tests passent. Conséquences acceptées jusqu'à la story
de nettoyage des pages héritées (décidée le même jour, à inscrire avant s12b) : un rebond de
redirection par lien `/${locale}/…` du blog ; la documentation héritée, qui n'a de contenu que sous
`docs/_files/en/`, répond 404 ; le choix de langue de `/account/settings` reste affiché mais n'a plus
d'effet.

### Décisions tranchées par ce plan

- **A. Redirection permanente = 308 via `redirects()` de `next.config.ts`** (ADR 031). next-intl ne
  redirige que `/fr` et en 307 ; `/en` et `/es` finiraient en 404. 308 est le statut permanent de
  Next (`permanent: true`) et conserve la méthode et la query string.
- **B. Une liste, trois usages** : `LEGACY_LOCALE_PREFIXES = ['fr', 'en', 'es']` dans
  `src/lib/routing/legacy-locale-prefixes.ts` alimente les redirections, les interdictions
  préfixées de `robots.txt` (on les garde : inoffensives, et elles couvrent un robot qui ne suivrait
  pas la redirection) et `RESERVED_PAGE_SLUGS`.
- **C. Pas de migration** : l'enum `language_type` et la colonne `user_settings.language` restent ;
  la valeur n'est simplement plus lue. Le seed garde `language = 'en'` pour `superadmin@gmail.com` :
  c'est le cas de régression du constat déclencheur.
- **D. `request.ts` ne jette plus `notFound()` sur un cookie `NEXT_LOCALE` non servi** : il retombe
  sur `routing.defaultLocale`. Une Server Action envoyée par un navigateur portant encore
  `NEXT_LOCALE=en` répond en français au lieu d'un 404.
- **E. Les 13 clés `ContactPage.*` présentes seulement en anglais sont mortes** (recherche :
  aucun appel) ; la tâche 3 le prouve avant de retirer `en.json`.

## Tasks (ordered)

1. [x] **Liste des préfixes historiques et redirections permanentes.** Créer
   `src/lib/routing/legacy-locale-prefixes.ts` (aucun import `@/`, aucun `@/env` : il est lu par
   `next.config.ts`) exportant `LEGACY_LOCALE_PREFIXES` et `legacyLocaleRedirects()` qui produit, par
   préfixe, une règle pour l'adresse exacte (`/en` → `/`) et une pour les sous-chemins
   (`/en/:path*` → `/:path*`), toutes `permanent: true`. Brancher dans `next.config.ts`
   (`async redirects()`). Test unitaire colocalisé : trois préfixes couverts, forme exacte et
   sous-chemins, `permanent: true` partout, aucune règle sur un segment voisin (`/english`,
   `/french-page`).
2. [x] **Routage en locale unique.** `src/i18n/routing.ts` : `locales: ['fr']`, `defaultLocale:
   'fr'`, `localePrefix: 'never'`. `src/i18n/request.ts` : cookie non servi → `defaultLocale`
   (décision D). Mettre à jour `src/i18n/request.real-i18n.test.ts` (plus d'espagnol ni d'anglais
   par défaut ; nouveau cas : cookie `en` → français, pas de `notFound`) et
   `src/lib/__tests__/locale-helper.test.ts`.
3. [x] **Retrait des catalogues `en` et `es`.** Avant suppression, consigner dans le test (ou le PR)
   la preuve que les 13 clés `ContactPage.*` absentes de `fr.json` ne sont appelées nulle part
   (recherche des clés littérales et des gabarits `t(\`…\`)` du formulaire de contact). Supprimer
   `messages/en.json`, `messages/es.json`. Réécrire les gardes de parité
   `src/services/__tests__/page-i18n.test.ts` et `association-settings-rules.test.ts` sur le seul
   catalogue français (les espaces de noms attendus existent et ne sont pas vides).
4. [x] **Proxy sans locale.** `src/proxy.ts` : retirer `localeOf` ; le gating compare le chemin brut
   à `AUTHENTICATED_SEGMENTS` et redirige vers `/login`. Test unitaire du proxy (nouveau,
   `src/proxy.test.ts`, `NextRequest` construite à la main) : `/bureau` et `/bureau/membres` sans
   cookie → `/login` ; avec cookie → pas de redirection de gating ; `/actualites` sans cookie → pas
   de redirection. `stripLocalePrefix` reste exporté s'il a encore un appelant, sinon retiré avec son
   test.
5. [x] **robots.txt et slugs réservés.** `src/app/robots.ts` : `withLocalePrefixes` lit
   `LEGACY_LOCALE_PREFIXES` au lieu de `routing.locales` ; `robots.test.ts` l. 109-124 continue
   d'exiger `/en/bureau`, `/es/login`, `/fr/tresorerie`. `RESERVED_PAGE_SLUGS` intègre les trois
   préfixes ; test dans `page-block-types.test.ts` (un slug `en`, `FR`, `es` est refusé).
6. [x] **Plus de sélecteur de langue.** Supprimer `src/components/lang-toggle.tsx`, ses montages dans
   `src/app/[locale]/page.tsx` l. 84 et `src/app/[locale]/(public)/layout.tsx` l. 74, et l'espace de
   noms `LangToggle` de `fr.json`. `UserPreferencesSync` : retirer la branche langue, garder le
   thème ; `user-preferences-sync.test.tsx` vérifie qu'un utilisateur `language: 'en'` ne déclenche
   **aucun** `router.replace`, et que le thème s'applique toujours.
7. [x] **Retombées de typage et tests unitaires.** `SupportedLocale` vaut désormais `'fr'` :
   `email-registry.ts` (options et défaut `fr`), `auth-helper.ts` (défaut `'fr'`), `blog.server.ts`
   (dérivé de `routing.locales`) — retouches minimales (décision de l'utilisatrice). Tests à aligner :
   `(auth)/action.test.ts`, `magic-link-integration.real-i18n.test.ts`,
   `magic-link-email.real-i18n.test.tsx`, `sitemap.test.ts`, `metadata-chain.test.ts`,
   `bureau-sidebar.test.tsx`. Porte : `pnpm exec tsc --noEmit --incremental false` sans erreur (hors
   `.next/`, voir mémoire « vérification de types masquée ») et `pnpm lint`.
8. [x] **E2E existants sans préfixe.** Les 17 specs qui visitent `/fr/…` ou `/en/…` passent aux
   adresses sans préfixe ; les attentes de texte anglais passent au français
   (`authorization.spec.ts` l. 52, `toHaveURL(/\/en\/dashboard/)` l. 70, `/\/en\/admin/` l. 79, et
   ce que la relecture de `smoke-authenticated`, `auth`, `styles` révèle).
9. [x] **E2E de la story** — `e2e/locale-unique.spec.ts` :
   - critère 2 : `/fr`, `/en`, `/es` → 308 vers `/` ; `/en/actualites?page=2` → 308 vers
     `/actualites?page=2` ; `/fr/bureau` → 308 vers `/bureau` (lu avec `maxRedirects: 0`) ;
   - critère 1 : `/actualites`, `/login` répondent 200 en français, `<html lang="fr">` ;
   - critère 3 : `/bureau` sans session → URL finale `/login`, sans préfixe ;
   - régression du constat : connecté avec un compte dont la langue enregistrée est `en`, une
     navigation vers `/bureau` puis une page publique ne quitte jamais une adresse sans préfixe.
   - critère 4 : déjà couvert sans préfixe par `contact.spec.ts` l. 328 et le sitemap
     (`seo.spec.ts`) — vérifier qu'ils restent verts après la tâche 8.
10. [x] **Documentation.** `docs/architecture.md` l. 151-153 : l'ADR 008 est **appliqué** (s43,
    ADR 031), plus « contourné ». Vérifier que `rule-translation.md` ne cite pas d'adresse
    préfixée ; sinon corriger. Cocher les tâches dans ce plan.

## Files touched

- **Nouveaux** : `src/lib/routing/legacy-locale-prefixes.ts` (+ test), `src/proxy.test.ts`,
  `e2e/locale-unique.spec.ts`, `docs/decisions/031-redirection-des-prefixes-de-langue-dans-next-config.md`.
- **Modifiés** : `next.config.ts`, `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/proxy.ts`,
  `src/app/robots.ts`, `src/services/types/domain/page-block-types.ts`,
  `src/components/context/user-preferences-sync.tsx`, `src/app/[locale]/page.tsx`,
  `src/app/[locale]/(public)/layout.tsx`, `messages/fr.json` (`LangToggle`),
  `src/lib/emails/email-registry.ts`, `src/lib/helper/auth-helper.ts`, `src/lib/helper/blog.server.ts`,
  éventuellement `src/lib/helper/locale-helper.ts`, `docs/architecture.md`, les tests unitaires
  listés aux tâches 2-7, 19 specs e2e (et non 17 comme estimé à la tâche 8).
- **Modifiés hors plan** (constatés à l'exécution) :
  - `src/services/validation/user-validation.ts` — retombée de typage : `languageSchema` ne dérive
    plus des locales du routage, garde les valeurs de l'enum `language_type` (décision C, minimum sur
    les écrans hérités) ;
  - `src/components/features/admin/blog/post-form-validation.ts` — retombée de typage :
    `LANGUAGE_OPTIONS` réduit au français (minimum sur les écrans hérités) ;
  - `src/lib/__tests__/locale-defaults.test.ts` — test qui motive ces retouches et celles de
    `email-registry.ts`, `auth-helper.ts`, `blog.server.ts`.
  - Échec du build de production constaté au `/ks-ship` (2026-10-07) : sous Cache Components,
    `generateStaticParams` de `docs/[...slug]` ne rendait plus aucun param, la documentation héritée
    n'ayant de contenu que sous `_files/en` alors que le routage ne sert plus que `fr`. Correctif
    (direction validée par l'utilisatrice, révise la conséquence « la documentation héritée répond
    404 ») : la documentation lit son contenu dans une langue fixe, `DOCS_CONTENT_LOCALE`
    (`src/lib/files/docs-file-helper.ts`), indépendante de la locale du routage, et ses params ne
    portent que la locale servie. Fichiers : `src/lib/files/docs-file-helper.ts`,
    `src/app/[locale]/docs/[...slug]/page.tsx`, `src/app/[locale]/docs/actions.ts`,
    `src/app/[locale]/docs/layout.tsx`, `src/components/features/docs/search-modal.tsx`, et le test
    `src/app/[locale]/docs/docs-locale.test.ts`.
- **Supprimés** : `messages/en.json`, `messages/es.json`, `src/components/lang-toggle.tsx`.
- **Non touchés, volontairement** : `src/app/[locale]/**` reste en place (ADR 008) ; schéma de base et
  migrations (décision C) ; blog, docs et réglages hérités au-delà du typage (décision de
  l'utilisatrice).

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : forme des règles de redirection (tâche 1) ; résolution de
  locale de `request.ts` dont le cookie non servi (tâche 2) ; gating du proxy sans préfixe
  (tâche 4) ; robots et slugs réservés (tâche 5) ; `UserPreferencesSync` sans bascule de langue
  (tâche 6). Montage 9p : un timeout de worker ne compte jamais comme vert — rejouer sur une copie en
  disque local si besoin.
- **E2E (Playwright, en CI sur le build de production)** : l'effet réel des `redirects()` (statut 308,
  query conservée), le gating sans préfixe, `<html lang="fr">`, la non-régression du constat
  déclencheur, et la suite existante réécrite sans préfixe. Pas d'e2e en local (mémoire du projet).
- **Typage** : `tsc --noEmit --incremental false` après suppression de `.next/dev/types/routes.d.ts`
  si seules des erreurs `.next/` apparaissent.

## Definition of Done

- Un seul PR `feature/s43-locale-unique`, description structurée : impact UI (sélecteur retiré),
  routage, aucune migration, ADR 031 lié.
- Les cinq critères prouvés : 1, 2, 3 en e2e ; 4 par les specs contact et SEO restées vertes ;
  5 par la suppression des fichiers, la preuve sur les 13 clés et la suite unitaire verte.
- `pnpm lint`, `tsc`, `pnpm test --run` verts ; CI (build + e2e) verte.
- Aucune adresse `/${locale}/…` ajoutée par la story ; celles du blog et des docs hérités restent,
  consignées pour la story de nettoyage.
- Revue `/ks-review` passée (aucun critique), puis `/ks-ship`.
