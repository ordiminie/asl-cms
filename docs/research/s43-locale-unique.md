# Research — Story s43-locale-unique

> Recherche du 2026-10-06, sur `main` à `be960b9` (s12 livrée). Tout ce qui suit a été relevé **en
> ouvrant les fichiers** — code, `node_modules/next-intl` (4.13.5) et `node_modules/next`
> (16.3.0) — et, pour le comportement réel, en interrogeant le serveur de dev local.
> `docs/reviews/stories.md` : `Stories ready: yes`.

## Target story

**s43-locale-unique — Servir le site en français seul, sans préfixe de langue.** Applique l'ADR 008
(framing, 2026-09-08), qu'aucune story ne portait. Complexité 2, dépend de s11 (livrée). Hors du
tableau de périmètre du PRD, justifiée dans son en-tête. Constat de l'utilisatrice le 2026-10-06 :
en contrôlant l'application en local, elle est « sans cesse redirigée vers `/en/` », texte en
anglais — c'est ce que la story supprime.

Critères d'acceptation :

1. Le routage ne déclare qu'une locale, `fr`, sans préfixe d'URL : toute page publique, du bureau ou
   de l'espace membre est servie à son adresse sans préfixe, en français, avec `<html lang="fr">`.
2. Une adresse préfixée par `/fr`, `/en` ou `/es` ne sert plus aucune page : elle redirige **de
   façon permanente** vers la même adresse sans préfixe.
3. Les routes authentifiées (bureau, espace membre, SuperAdmin) restent protégées par le proxy sans
   préfixe : un visiteur sans session qui ouvre `/bureau` est renvoyé vers la connexion.
4. Les liens écrits dans les emails (lien de connexion, notifications au bureau) et le sitemap (s11)
   ne portent aucun préfixe.
5. `messages/en.json` et `messages/es.json` sont retirés, ainsi que le sélecteur de langue ; aucun
   libellé ne manque en français.

Notes agentiques de la story : point de rupture annoncé dans `src/proxy.ts` (`localeOf`,
`stripLocalePrefix`) → critère 3 à prouver en e2e ; routes physiquement **conservées** sous
`src/app/[locale]/` ; specs et tests qui visitent `/fr/…` ou `/en/…` = l'essentiel du coût ; à faire
de préférence avant s12b.

## Current state of the code

### Routage next-intl

- `src/i18n/routing.ts` — `defineRouting({locales: ['en', 'fr', 'es'], defaultLocale: 'en'})`.
  Pas de `localePrefix` (donc `'always'` par défaut, vérifié dans
  `next-intl/dist/esm/development/routing/config.js`, `receiveLocalePrefixConfig`), pas de
  `localeDetection` (défaut `true`), pas de `localeCookie` (défaut : cookie `NEXT_LOCALE`,
  `sameSite: 'lax'`).
- `src/i18n/navigation.ts` — `createNavigation(routing)` exporte `Link`, `redirect`,
  `usePathname`, `useRouter`, `getPathname`.
- `src/i18n/request.ts` — `getRequestConfig` : 1) locale explicite si `hasLocale` ; 2) sinon
  `rootParams.locale()` ; 3) en Server Action / Route Handler (où root-params jette), cookie
  `NEXT_LOCALE`, sinon `routing.defaultLocale` ; **une valeur non servie → `notFound()`** (l. 48-50).
  Charge `messages/${locale}.json` par import dynamique.
- `next.config.ts` l. 7 : `createNextIntlPlugin` (aucune option de locale dans next.config).

### Proxy

`src/proxy.ts` :

- `intlMiddleware = createMiddleware(routing)` (l. 10).
- `localeOf(pathname)` (l. 12-19) : premier segment s'il est une locale déclarée, **sinon
  `routing.defaultLocale`**.
- `isAuthenticatedPath(pathname, locale)` (l. 21-26) : `stripLocalePrefix` puis comparaison à
  `AUTHENTICATED_SEGMENTS`.
- Gating (l. 52-55) : sans cookie de session, `NextResponse.redirect(new URL(\`/${locale}/login\`,
  request.url))` — **307** (défaut de `NextResponse.redirect`, vérifié dans
  `next/dist/server/web/spec-extension/response.js` l. 99).
- Puis thème (`x-theme`, cookie `theme`), puis `intlMiddleware(request)`.
- `matcher` : tout sauf `api|trpc|_next|_vercel|monitoring|.*\..*`, plus `/api/auth/error`.

**Cause mesurée de la bascule en `/en`** (serveur de dev, 2026-10-06) : `/` avec
`Accept-Language: fr` → `/fr` (la détection marche) ; mais `/bureau` sans session → `/en/login`
**quel que soit** `Accept-Language` ou le cookie `NEXT_LOCALE=fr`, parce que `localeOf` retombe sur
`defaultLocale: 'en'`. Comme les liens du produit sont déjà écrits sans préfixe (menus, emails,
sitemap), chaque passage par une route protégée fait basculer en anglais.

Seconde cause, côté client : `UserPreferencesSync` (voir plus bas) renvoie l'utilisateur vers la
langue de ses préférences ; le seed donne `language = 'en'` à `superadmin@gmail.com`
(`src/db/scripts/seed.ts` l. 236-239, vérifié en base locale).

### Routes

- Tout vit sous `src/app/[locale]/` : groupes `(app)`, `(auth)`, `(bureau)`, `(public)`, plus
  `admin/`, `docs/`.
- `src/app/[locale]/layout.tsx` : `hasLocale(routing.locales, locale)` sinon `notFound()` ;
  `export const instant = false` (route bloquante assumée, ADR 003) ; `generateStaticParams()`
  dérivé de `routing.locales`.
- `generateStaticParams` dérivé de `routing.locales` aussi dans `[locale]/page.tsx`,
  `(auth)/layout.tsx`, `(public)/layout.tsx`, `contact/page.tsx`, `privacy/page.tsx`,
  `terms/page.tsx` → suivront automatiquement.
- `src/app/[locale]/base-layout.tsx` l. 68 : `lang={locale}` → donnera `fr` sans modification.
- **`src/app/[locale]/(public)/[slug]/page.tsx`** : page CMS attrapant tout segment unique
  (ADR 020), `notFound()` si aucune page publiée.

### Sélecteurs de langue (deux, plus une préférence)

- `src/components/lang-toggle.tsx` — `LangToggle`, `Select` sur `routing.locales`,
  `router.replace(stripLocalePrefix(pathname, currentLocale), {locale})`. Monté dans
  `src/app/[locale]/page.tsx` l. 84 et `src/app/[locale]/(public)/layout.tsx` l. 74. Messages :
  namespace `LangToggle`.
- `src/components/context/user-preferences-sync.tsx` — `UserPreferencesSync` applique le thème
  **et** `router.replace(…, {locale: user.settings.language})` si la langue enregistrée diffère de
  `params.locale`. Test : `src/components/context/__tests__/user-preferences-sync.test.tsx`
  (attend `{locale: 'en'}` et `{locale: 'es'}`, l. 67-82).
- Préférence en base : `src/db/models/user-model.ts` l. 16 `languageEnum = pgEnum('language_type',
  ['fr', 'en', 'es'])`, colonne `language` (défaut `'fr'`) ; formulaire
  `src/components/features/user/edit-user-settings.tsx` l. 147-173 (choix fr/en/es/**de**),
  validation `languageSchema` dans `src/services/validation/user-validation.ts` l. 110. Écran hérité
  (`/account/settings`).

### Messages

`messages/fr.json`, `en.json`, `es.json`. Comparaison des clés aplaties (script node, 2026-10-06) :

- fr : 2 810 clés ; en : 2 429 ; es : 2 429.
- **394 clés de fr absentes de en** — d'où les `MISSING_MESSAGE` vus en `/en` (ex. `ReportPage`).
- **13 clés de en absentes de fr**, toutes `ContactPage.*` (`card.title`, `card.description`,
  `fields.{email,subject,content}.placeholder`, `validation.{subjectMin,subjectMax,contentMin}`,
  `errors.{server,allFieldsRequired,subjectRange,contentRange,emailInvalid}`). Recherche d'appels :
  `contact-form.tsx` n'utilise que `fields.${field}.label` et ses clés fr ; **aucun appel trouvé**
  pour ces 13 clés → reliquat de l'ancien formulaire. À confirmer par le test de rendu, voir Open
  questions.

### Liens écrits (critère 4)

Déjà sans préfixe, vérifié :

- Lien magique : construit par Better Auth sur l'origine de l'association
  (`src/lib/better-auth/association-origin.ts`, `callbackURL` réécrit l. 38) ; la locale de l'email
  vient de `metadata.locale` via `resolveSupportedLocale` (`magic-link-integration.ts` l. 198).
- Notification bureau du formulaire de contact : `${origin}/bureau/messages/${id}`
  (`src/services/contact-message-service.ts` l. 116).
- Hérités : OTP `${NEXT_PUBLIC_APP_URL}/verify-request/otp` (`auth.ts` l. 143), invitation
  (`auth.ts` l. 164, `notification-service.ts` l. 239).
- Sitemap `src/app/sitemap.ts` : sans préfixe ni alternative depuis s11 (test
  `sitemap.test.ts` l. 83).
- Canonique : `src/lib/seo/resolve-metadata.ts` l. 32/55/220, sans préfixe.

Restent préfixés à la main (code hérité du blog et des docs) : `blog/layout.tsx` l. 44,
`blog/page.tsx` l. 62/90, `blog/category/…` l. 89/110/133, `blog/page/[page]` l. 93/109,
`admin/blog/actions.ts` l. 57-59 (`revalidatePath`), `docs/page.tsx` l. 28.

### robots.txt

`src/app/robots.ts` l. 26-37 : `withLocalePrefixes` interdit chaque segment authentifié et de
connexion **sans préfixe et sous chaque `routing.locales`** (revue s11, M2). Test
`robots.test.ts` l. 109-124.

## Anchor points

- `src/i18n/routing.ts` — la décision de l'ADR 008 tient en trois propriétés : `locales: ['fr']`,
  `defaultLocale: 'fr'`, `localePrefix: 'never'`.
- `src/proxy.ts` — gating de session (l. 52-55) et appel de `intlMiddleware` (l. 79) : c'est là que
  se jouent les critères 2 et 3.
- `src/i18n/request.ts` — fallback cookie (l. 43-50).
- `src/lib/helper/locale-helper.ts` — `stripLocalePrefix`, `SupportedLocale` (dérivé de
  `routing.locales`, deviendra `'fr'`), `PRODUCT_LOCALE = 'fr'`, `resolveSupportedLocale`.
- `src/components/lang-toggle.tsx` + ses deux points de montage ; `UserPreferencesSync`.
- `messages/en.json`, `messages/es.json` et les tests qui les importent.
- `src/app/robots.ts`, `src/services/types/domain/page-block-types.ts` (`RESERVED_PAGE_SLUGS`).
- Specs e2e (liste plus bas).

## Verified APIs / functions

**next-intl 4.13.5** (`dist/esm/development/middleware/middleware.js`, lu en entier) :

- Avec `localePrefix: 'never'` : un chemin sans préfixe est **réécrit** (`NextResponse.rewrite`)
  vers `/${locale}${chemin}` (`isUnprefixedRouting`, l. 98-99 et branche `else` finale) ; un chemin
  **préfixé par une locale déclarée** est **redirigé** vers le chemin sans préfixe
  (`effectiveLocalePrefixMode === 'never'` → `redirect(...)`).
- Ce `redirect` interne appelle `NextResponse.redirect(url)` **sans statut** → **307**, pas une
  redirection permanente.
- Un préfixe qui **n'est pas** une locale déclarée n'est pas reconnu (`getPathnameMatch` sur
  `resolvedRouting.locales`) : avec `locales: ['fr']`, `/en/actualites` est traité comme le chemin
  `/en/actualites` et réécrit en `/fr/en/actualites`.
- `syncCookie` : met à jour `NEXT_LOCALE` sur une requête de document si la valeur diffère de la
  locale résolue (`hasOutdatedCookie`) — un cookie `en` resté dans un navigateur sera réécrit en
  `fr` à la première page chargée, pas avant.
- `alternateLinks` (en-tête `Link`) n'est pas émis en mode `'never'`.
- `defineRouting`, `createMiddleware`, `createNavigation`, `hasLocale`, `getRequestConfig`,
  `setRequestLocale`, `getTranslations({locale, namespace})` : présents et utilisés tels quels.

**Next 16.3.0** : `NextResponse.redirect(url, init)` accepte un statut (`typeof init === 'number' ?
init : init?.status ?? 307`), contrôlé contre l'ensemble `REDIRECTS` (301, 302, 303, 307, 308).

**Projet** :

- `stripLocalePrefix(pathname: string, locale: string): string` — `src/lib/helper/locale-helper.ts`.
- `resolveSupportedLocale(value: unknown): SupportedLocale` — idem.
- `AUTHENTICATED_SEGMENTS`, `SIGN_IN_SEGMENTS` — `src/lib/routing/authenticated-segments.ts`
  (`/account`, `/admin`, `/bureau`, `/dashboard`, `/team` ; `/login`, `/register`,
  `/verify-request`, `/reset-password`, `/logout`, `/auth-error`).
- `RESERVED_PAGE_SLUGS` — `src/services/types/domain/page-block-types.ts` l. 95 ; **ne contient ni
  `fr`, ni `en`, ni `es`**.
- `getSessionCookie` — `better-auth/cookies`.

## Traps & constraints

1. **La redirection permanente du critère 2 ne viendra pas de next-intl.** Elle serait 307, et
   seulement pour `/fr/…` ; `/en/…` et `/es/…`, n'étant plus des locales déclarées, seraient
   réécrits vers `/fr/en/…`, attrapés par la page CMS `[slug]` (pour `/en`) ou par aucune route →
   404. Le proxy doit donc traiter lui-même les trois préfixes historiques, **avant** le gating et
   avant `intlMiddleware`, avec un statut explicite (308 ou 301), en gardant la query string.
2. **Le gating doit cesser de construire `/${locale}/login`.** Avec `'never'`, la cible devient
   `/login` ; `localeOf` et `stripLocalePrefix` deviennent sans objet dans le proxy une fois le
   point 1 placé en tête. Le critère 3 se prouve en e2e (la RLS et le proxy ne se testent pas en
   unitaire — `AGENTS.md`).
3. **Conflit possible avec un slug CMS.** Une page d'association de slug `fr`, `en` ou `es` est
   aujourd'hui acceptée (`RESERVED_PAGE_SLUGS`) ; après la story, son adresse serait redirigée et
   la page injoignable. Le test `page-block-types.test.ts` l. 141-142 exige que tout segment servi
   par le socle figure dans la liste.
4. **`request.ts` jette `notFound()` sur une locale non servie.** Une Server Action reçue d'un
   navigateur portant encore `NEXT_LOCALE=en` (cookie posé avant la story, jamais réécrit si aucune
   page de document n'a été chargée depuis) tomberait en 404 au lieu de répondre en français.
5. **`UserPreferencesSync` rebasculerait vers `en`.** Un compte dont `user_settings.language` vaut
   `en` (le SuperAdmin du seed) déclencherait `router.replace(…, {locale: 'en'})` vers une locale
   inexistante. La branche langue doit disparaître ; le thème reste.
6. **Typage.** `SupportedLocale` se resserre à `'fr'` : tout appel passant `'en'`/`'es'` en dur
   casse au typecheck (tests surtout). En dur dans le code non-test : `email-registry.ts` l. 39/63
   (`options: ['en','fr','es']`, `default: 'en'`, écran admin des emails hérité), `auth-helper.ts`
   l. 27 (`locale = 'en'` par défaut pour les dates de bannissement), `blog.server.ts` l. 11
   (`SUPPORTED_LOCALES`). `rate-limit-service.ts` l. 77 (`'en-US'`) est un calcul technique de
   décalage horaire, **hors sujet**.
7. **Pages héritées.** Blog et docs construisent des liens `/${locale}/…` (un rebond 307 par clic
   une fois `'never'` posé) ; les docs n'ont de contenu que sous `docs/_files/en/` (aucun
   `fr/`) ; `edit-user-settings.tsx` propose fr/en/es/de. Leur retrait appartient à la **story de
   nettoyage des pages héritées**, décidée le 2026-10-06 et à placer avant s12b (pas encore inscrite
   dans `docs/stories.md`). Frontière à tenir : s43 ne doit pas faire ce nettoyage, mais ne doit pas
   non plus laisser une erreur de build ou de typecheck dans ce code.
8. **Tests unitaires à revoir** (10 fichiers mentionnent une locale `en`/`es` ou un préfixe,
   plus 2 qui importent `en.json`/`es.json`) :
   - `src/services/__tests__/page-i18n.test.ts` et `association-settings-rules.test.ts` :
     **gardes de parité** fr/en/es — leur raison d'être (« une clé présente d'un seul côté se
     découvre le jour où une locale est rouverte ») disparaît avec les fichiers.
   - `src/i18n/request.real-i18n.test.ts` (attend l'espagnol et l'anglais par défaut),
     `src/lib/better-auth/magic-link-integration.real-i18n.test.ts`,
     `src/lib/emails/magic-link-email.real-i18n.test.tsx`, `src/app/[locale]/(auth)/action.test.ts`
     (l. 145-150, 242-250 : locale `es`).
   - `src/app/robots.test.ts` l. 109-124 (préfixes sous chaque locale, dont `/fr/tresorerie`),
     `src/app/sitemap.test.ts` (l. 12, article en `en`), `metadata-chain.test.ts`,
     `bureau-sidebar.test.tsx`, `user-preferences-sync.test.tsx`, `src/lib/__tests__/locale-helper.test.ts`.
9. **Specs e2e** — 17 fichiers sur 26 contiennent une adresse préfixée (nombre d'occurrences) :
   `smoke-authenticated` 19, `auth` 9, `authorization` 7, `incident-report` 5, `seo` 4,
   `association-settings` 3, `contact` 3, `site-alert` 3, et 1-2 dans `association-identity`,
   `board-members`, `member-profiles`, `news`, `page-cms`, `rate-limit`, `site-navigation`, `styles`,
   `water-analysis`. Les specs en `/en/…` peuvent aussi **attendre du texte anglais** :
   `authorization.spec.ts` l. 52 (`heading` `/unauthorized/i`) et `toHaveURL(/\/en\/dashboard/)`,
   `/\/en\/admin/` (l. 70, 79). Les e2e se valident en CI, pas sur la machine locale.
10. **Montage 9p** : la suite Vitest locale peut produire des timeouts de workers ; un timeout ne
    compte jamais comme vert.

## Open questions

1. **Statut de la redirection permanente** : 308 (conserve la méthode, équivalent moderne) ou 301
   (le plus universellement compris par les moteurs) ? Next en propose les deux.
2. **Portée de « le sélecteur de langue »** (critère 5) : `LangToggle` seul, ou aussi le choix de
   langue des réglages utilisateur (`edit-user-settings.tsx`, écran hérité) et la branche langue de
   `UserPreferencesSync` ? La branche de `UserPreferencesSync` doit partir de toute façon (piège 5).
   Pour le champ de réglages, s43 ou story de nettoyage ?
3. **Colonne et enum `language_type`** : à garder tels quels (aucune migration, la valeur n'est plus
   lue) ou à réduire ? Une migration est hors du périmètre annoncé par la story (complexité 2) ; le
   seed qui écrit `'en'` pour le SuperAdmin reste-t-il ?
4. **Slugs `fr`, `en`, `es`** : les ajouter à `RESERVED_PAGE_SLUGS` ? Si une association de la base
   de recette a déjà une page de ce slug, que devient-elle ? (Vérifiable en base locale seulement ;
   aucune n'existe dans le seed.)
5. **`robots.txt`** : garder les interdictions préfixées (inutiles une fois les préfixes redirigés,
   mais inoffensives) ou revenir aux seuls segments sans préfixe ? La liste dérivée de
   `routing.locales` ne produirait plus que `/fr/…`.
6. **Les 13 clés `ContactPage.*` présentes seulement en anglais** : aucun appel trouvé par recherche
   textuelle, mais `t()` peut recevoir une clé construite. À confirmer par les tests de rendu du
   formulaire de contact avant de les déclarer mortes.
7. **Pages héritées pendant l'entre-deux** (piège 7) : accepte-t-on que le blog fasse un rebond par
   lien et que les docs répondent 404 (pas de contenu `fr`) jusqu'à la story de nettoyage ? Ou s43
   doit-elle au minimum corriger les liens `/${locale}/…` du blog ?
8. **`request.ts`** : en cas de cookie `NEXT_LOCALE` non servi, retomber sur `defaultLocale` plutôt
   que `notFound()` (piège 4) — à trancher au plan, avec un test.
