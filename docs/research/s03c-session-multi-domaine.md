# Research — Story s03c-session-multi-domaine

Recherche du 2026-09-22, sur `main` à `4cccf5b` (s04b et PR 23 mergées), branche
`feature/s03c-session-multi-domaine`. Base : `docs/research/s03-connexion-lien-magique.md` (sections
« Multi-domaine » et « Pièges »), **revérifiée sur le code actuel** — s03, s03b, s04 et s04b ont modifié
`magic-link-integration.ts`, `auth.ts` et l'e2e depuis.

## Target story

**En tant que** membre propriétaire **je veux** que le lien de connexion me ramène sur le site de mon
association **afin d'**ouvrir mon espace là où je l'ai demandé, quelle que soit l'association.
Complexité 3, dépend de s03 (livrée).

Critères d'acceptation :

1. Le lien de connexion pointe vers le domaine de l'association à laquelle il donne accès, jamais vers une
   adresse de configuration unique : demandé sur le domaine de A, il mène au domaine de A et y ouvre la
   session ; demandé sur celui de B, il mène à B — **vérifié sur deux domaines**.
2. La session est scopée à l'association du membre : elle ne donne accès à aucune donnée d'un autre tenant.

Contraintes des notes : domaine du lien **lu en base** (s15 et s42 génèrent aussi ces liens, s42 hors
requête) ; origines de confiance et cookie de session acceptent chaque domaine **sans redéploiement** pour
une nouvelle association ; **le choix du mécanisme mérite un ADR** ; preuve e2e sur `localhost` /
`127.0.0.1` ; s12b vérifiera ensuite que le déploiement ne le défait pas.

## Current state of the code

### Le défaut est bien présent aujourd'hui

`auth.ts` ne passe **aucun `baseURL`** à `betterAuth()` (lignes 61-275) : Better Auth le lit dans
`BETTER_AUTH_URL` (`http://localhost:3000` en `.env.test` et en CI). Le plugin construit le lien sur
cette valeur :

```js
// node_modules/better-auth/dist/plugins/magic-link/index.mjs:85-90
const realBaseURL = new URL(ctx.context.baseURL)
const url = new URL(
  `${pathname}${basePath}/magic-link/verify`,
  realBaseURL.origin
)
url.searchParams.set('callbackURL', ctx.body.callbackURL || '/')
```

Donc un lien demandé sur `127.0.0.1` (Marketing Pro) part vers `http://localhost:3000/api/auth/magic-link/verify?...`
(TechCorp). Le cookie de session, sans attribut `domain`, est posé **sur l'hôte qui sert `/verify`**,
c'est-à-dire `localhost` : la session s'ouvre sur le mauvais site. C'est exactement le critère 1 en échec.

### Ce que s03 a déjà rendu multi-domaine

`src/lib/better-auth/magic-link-integration.ts` (233 lignes) :

- `requestOriginOf(headers)` (l. 51-61) lit `x-forwarded-host` puis `host`, et le protocole dans
  `x-forwarded-proto`, **sinon celui de `BETTER_AUTH_URL`**.
- `organizationOfRequest(host, services)` (l. 110-119) résout l'association par
  `getOrganizationByDomainService(normalizeTenantHost(host))` ; sans association sur le domaine → rien
  n'est envoyé (l. 184-189).
- L'email (nom, teinte, logo PNG en URL absolue `${origin}/api/identity/logo?v=…`) est donc **déjà**
  celui de l'association du domaine appelé. **Seul le lien lui-même (`url`, fourni par le plugin) reste
  sur `BETTER_AUTH_URL`.**
- `sendMagicLink` passe `url` tel quel à `sendMagicLinkEmailService` (l. 207-212).

### La demande de lien

`requestMagicLinkAction` (`src/app/[locale]/(auth)/action.ts:209-255`) appelle
`auth.api.signInMagicLink({headers: await headers(), body: {email, callbackURL: '/dashboard',
errorCallbackURL: '/login/lien-invalide', metadata: {locale}}})`. `callbackURL` et `errorCallbackURL`
sont **relatifs** ; le plugin les résout contre `ctx.context.baseURL` à l'ouverture du lien
(`index.mjs:147-148`) puis `ctx.redirect(callbackURL)`.

Deux autres appels de `signInMagicLink` existent dans le même fichier (l. 143 — `callbackURL: '/dashboard'` —
et l. 468, action d'inscription héritée avec `isEmailAvailableService`) : à inventorier au plan, ils
subissent le même `baseURL`.

### Le reste de l'authentification

- `trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS` (`auth.ts:270`), liste d'environnement
  (`TrustedOriginsSchema`, `src/env-schemas.ts:43-51`). **Better Auth relit aussi
  `process.env.BETTER_AUTH_TRUSTED_ORIGINS` de lui-même** et l'ajoute (`context/helpers.mjs`,
  `getTrustedOrigins`, fin de fonction) : la variable compte deux fois, sans conséquence mais à savoir.
- `advanced` ne porte que `database.generateId` (`auth.ts:105-109`) : **pas** de `trustedProxyHeaders`,
  pas de `crossSubDomainCookies`, pas de `defaultCookieAttributes`. Cookies propres à l'hôte.
- `session.cookieCache` 5 min (l. 67-72).
- Liens construits sur `env.NEXT_PUBLIC_APP_URL` dans `auth.ts` : OTP 2FA (l. 142) et invitation
  d'organisation (l. 163). Hors critères de s03c, mais même défaut ; l'invitation est le lien de **s15**.
- `src/lib/better-auth/auth-client.ts:28-29` : `createAuthClient({baseURL: env.NEXT_PUBLIC_APP_URL, …})`.
  Sur `127.0.0.1`, le client appelle `http://localhost:3000/api/auth/*` : requête inter-origines, avec les
  cookies de `localhost`. 16 fichiers `.tsx` l'appellent (abonnement, invitations, `organization.setActive`,
  `listSessions`, `revokeSession`, 2FA, clés d'API, `useSession`).
- `src/proxy.ts:62` : gating grossier par `getSessionCookie(request)` (`better-auth/cookies`), sans appel
  base. Nom du cookie : préfixe `__Secure-` en HTTPS — dépend du protocole résolu.

### Tenant et session

- Le tenant vient du **domaine appelé** (ADR 003) : `getCurrentTenantDal` / `requireCurrentTenantDal`
  (`src/app/dal/tenant-dal.ts:71-110`), `x-forwarded-host` puis `host`, normalisés par
  `normalizeTenantHost` (`src/lib/helper/tenant-helper.ts`).
- Le groupe `(bureau)` croise tenant et droits : `BureauShell` (`src/app/[locale]/(bureau)/layout.tsx`)
  attend `requireCurrentTenantDal()` et `canManageCurrentAssociationIdentityDal()` ; les actions passent
  par le registre (`canPerformAction`, s03b).
- Le groupe `(app)` (`dashboard`, `account/*`, `team/[slug]`) est **hérité du boilerplate et n'est pas
  scopé au domaine** : `team/[slug]/page.tsx:22` charge l'organisation **par slug** ; `getCurrentUserDal`
  (`src/app/dal/user-dal.ts:151-155`) expose `activeOrganization` issue de
  `session.activeOrganizationId` ; `customSession` charge **toutes** les organisations de l'utilisateur à
  chaque requête (`auth.ts:281-288`, ADR 014).

## Anchor points

| Besoin                                   | Où                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lien sur le domaine de l'association     | `baseURL` de `betterAuth()` (`auth.ts:61`), et/ou `url` reconstruite dans `sendMagicLink` (`magic-link-integration.ts:175-213`) à partir de `organization.domain` lu en base |
| Redirection après ouverture du lien      | `callbackURL` / `errorCallbackURL` de `requestMagicLinkAction` (`action.ts:235-236`), résolus contre `ctx.context.baseURL`                                                   |
| Origines de confiance sans redéploiement | `trustedOrigins` (`auth.ts:270`) — accepte une fonction `(request) => Awaitable<string[]>`                                                                                   |
| Cookie de session par domaine            | `advanced` de `auth.ts` (aujourd'hui rien : cookie propre à l'hôte, ce qui est le comportement voulu)                                                                        |
| Proxy du VPS                             | `advanced.trustedProxyHeaders` (absent) — voir pièges                                                                                                                        |
| Client navigateur                        | `auth-client.ts:29` (`baseURL`)                                                                                                                                              |
| Critère 2                                | `(bureau)` déjà scopé ; `(app)` à examiner (`team/[slug]`, `account/organizations`, `activeOrganizationId`)                                                                  |
| Preuve                                   | `e2e/magic-link.spec.ts` (TechCorp sur `localhost` seulement aujourd'hui), patron deux domaines de `e2e/tenant-isolation.spec.ts`                                            |
| ADR                                      | prochain numéro libre : **022**                                                                                                                                              |

## Verified APIs / functions

Better Auth **1.7.1** (`node_modules/better-auth/package.json`), lu dans `dist/` :

- **`baseURL` dynamique** : `{allowedHosts: string[], fallback?: string, protocol?: 'http' | 'https' | 'auto'}`
  (`isDynamicBaseURLConfig`, `utils/url.mjs:113-115`). `allowedHosts` vide → `BetterAuthError` au démarrage
  (`context/create-context.mjs:60-61`). Motifs à joker (`matchesHostPattern`, `utils/url.mjs`, `*` et `?`).
- **Résolution par requête** : `resolveDynamicBaseURL(config, source, basePath, trustedProxyHeaders)`
  (`utils/url.mjs:206-215`) — hôte dans `allowedHosts` → `${proto}://${host}${basePath}` ; sinon `fallback` ;
  sinon **exception** `Host "…" is not in the allowed hosts list`.
- **Les deux chemins résolvent** : le routeur HTTP (`auth/base.mjs:21`, `resolveRequestContext(ctx, request, …)`)
  **et** l'appel direct `auth.api.*` (`api/to-auth-endpoints.mjs:17-22`, `pickSource(input)`).
  `pickSource` (`context/helpers.mjs:93-100`) accepte `input.request` ou `input.headers` **à condition
  qu'ils portent `host` ou `x-forwarded-host`** — donc `auth.api.signInMagicLink({headers: await headers()})`
  de l'action est bien résolu par requête, et **un appel hors requête (s42) peut fournir
  `headers: {host: organization.domain}`** pour obtenir le lien d'une association lue en base.
- `resolveRequestContext` (`context/helpers.mjs:116-…`) clone le contexte par requête : `baseURL`,
  `trustedOrigins`, et **« cookies rehydrated for the resolved host »** (commentaire l. 110-114).
- **Proxy** : `x-forwarded-host` / `x-forwarded-proto` ne sont lus que si `advanced.trustedProxyHeaders: true`
  (`resolveDynamicTrustedProxyHeaders`, `context/helpers.mjs:102-110` ; `getHostFromSource`,
  `getProtocolFromSource`, `utils/url.mjs`). Sans lui : `host`, puis l'URL de la requête ; protocole `http`
  forcé pour une boucle locale (`isLoopbackForDevScheme`), `https` sinon.
- **Origines de confiance en mode dynamique** (`getTrustedOrigins`, `context/helpers.mjs:59-85`) : chaque
  motif de `allowedHosts` devient `https://<hôte>` (+ `http://` si `protocol` `http`/`auto` ou hôte de
  boucle locale), + `fallback`, + `options.trustedOrigins` (tableau **ou fonction appelée avec la requête**),
  - `process.env.BETTER_AUTH_TRUSTED_ORIGINS`.
- **Ouverture du lien** (`plugins/magic-link/index.mjs:116-195`) : trois `originCheck` sur `callbackURL`,
  `newUserCallbackURL`, `errorCallbackURL` ; résolution contre `ctx.context.baseURL` ; `setSessionCookie`
  sur la réponse de `/magic-link/verify` ; `ctx.redirect(callbackURL)`.
- **Application** :
  - `sendMagicLink({email, url, token, metadata}, ctx?)` — `magic-link-integration.ts:175`.
  - `getOrganizationByDomainService(domain)` — façade `organization-service-facade`, chargée à l'appel
    (`loadServices`, l. 90-105 ; import dynamique **obligatoire**, garde
    `magic-link-integration-imports.test.ts`).
  - `normalizeTenantHost(host: string | null | undefined): string | undefined` — `tenant-helper.ts`.
  - `getCurrentTenantDal`, `requireCurrentTenantDal(): Promise<TenantDTO>` — `tenant-dal.ts:71, 93`.
  - `organization.domain` : `text('domain').unique()` — `src/db/models/auth-model.ts:186`.
- **Seed** (`src/db/scripts/seed.ts:274-275`) : TechCorp Solutions ↔ `localhost` (module `voirie`),
  Marketing Pro ↔ `127.0.0.1`. Membres utiles : `user-owner@gmail.com` (owner TechCorp),
  `user-admin@gmail.com` (board Marketing Pro), `admin-owner@gmail.com` (owner Marketing Pro),
  **`admin@gmail.com` membre des deux** (member TechCorp, board Marketing Pro), `user@gmail.com`
  (member TechCorp, **pas** Marketing Pro).

## Traps & constraints

- **`allowedHosts` est statique**, les domaines vivent en base. Un joker large (`*`) respecte « sans
  redéploiement » et déplace la défense sur la résolution du tenant (domaine inconnu → aucune association,
  `sendMagicLink` n'envoie rien, pages en 404 — ADR 003, ADR 013). Une liste d'environnement oblige à
  redéployer pour chaque association : **contraire aux notes**. Et un `allowedHosts: ['*']` fait entrer
  `https://*` dans les origines de confiance calculées (`getTrustedOrigins`) : à mesurer contre la
  protection CSRF (`originCheck`, `formCsrfMiddleware`) — c'est le cœur de l'ADR.
- **Hôte hors liste sans `fallback` = exception** dans `resolveDynamicBaseURL`, **sur toute route
  `/api/auth/*`**, y compris la lecture de session. Un `fallback` renvoie au contraire vers un domaine unique :
  exactement le défaut que la story supprime. Le comportement pour un domaine inconnu est à décider.
- **« Lu en base, pas dans l'en-tête »** : avec un `baseURL` dynamique, l'origine du lien vient de l'en-tête
  `Host`. Aujourd'hui `sendMagicLink` n'envoie de toute façon que si ce `Host` correspond à une
  `organization.domain` : les deux coïncident dans une requête. La contrainte vise s42 (hors requête) :
  `pickSource` permet d'y fournir `headers: {host: organization.domain}`. Reconstruire l'URL dans
  `sendMagicLink` à partir de `organization.domain` est l'autre voie ; elle ne suffit pas seule, car la
  **redirection après ouverture** (`callbackURL` relatif) reste résolue contre `ctx.context.baseURL`.
- **Proxy du VPS** : `requestOriginOf` et `getCurrentTenantDal` lisent `x-forwarded-host` sans condition ;
  Better Auth ne le lit qu'avec `advanced.trustedProxyHeaders: true`. Derrière le reverse proxy de
  production, un `baseURL` dynamique sans cette option résoudrait l'hôte interne. Le protocole non plus
  (`https` par défaut hors boucle locale). **Pas testable en local ni en CI** (pas de proxy) : à noter pour
  s12b, qui vérifie le déploiement.
- **Nom du cookie** : le préfixe `__Secure-` dépend du protocole résolu. Un protocole mal résolu derrière le
  proxy change le nom et `getSessionCookie` de `src/proxy.ts` ne voit plus la session. Même périmètre s12b.
- **Client** : `auth-client.ts` construit sur `NEXT_PUBLIC_APP_URL`. Sans `baseURL`, `createAuthClient`
  prend l'origine courante (constat de la recherche s03, non revérifié ici dans `better-auth/client`) : à
  confirmer au plan. Le laisser en l'état casse, sur B, tout ce qui passe par le client (2FA, sessions,
  invitations, abonnement) ; aucun parcours e2e actuel ne l'exerce sur `127.0.0.1`.
- **`NEXT_PUBLIC_APP_URL` a d'autres usages** hors authentification (`robots.ts`, `sitemap.ts`, pages du blog
  hérité, docs) : périmètre SEO de **s11**, pas celui-ci. Ne pas élargir.
- **Critère 2 et le groupe `(app)`** : le cookie propre à l'hôte garantit qu'une session ouverte sur A
  n'est pas envoyée à B. Mais sur A, `team/[slug]` charge une organisation par slug et `account/organizations`
  liste toutes les organisations du membre ; `activeOrganizationId` peut désigner B. Un membre de A et B
  (`admin@gmail.com`) connecté sur A peut donc lire des données de B **depuis le domaine de A**. Ce n'est pas
  une fuite vers un tiers, mais c'est une session non « scopée à l'association » au sens strict.
- **Tests existants à ne pas casser** :
  - `e2e/magic-link.spec.ts` suppose TechCorp sur `localhost` ; `linkOf(message)` lit le lien dans la boîte
    de sortie `file` (`EMAIL_OUTBOX_DIR`) — patron réutilisable pour B.
  - `e2e/tenant-isolation.spec.ts` (deux domaines, `127.0.0.2` sans association),
    `association-identity`, `association-settings`, `page-cms`, `site-navigation`, `auth`, `authorization`
    — toutes se connectent **par mot de passe** sur `localhost` ; un `baseURL` dynamique mal configuré les
    casse toutes d'un coup (exception sur `/api/auth/*`).
  - Unitaires : `magic-link-integration.real-i18n.test.ts` (728 l.), `magic-link-integration-imports.test.ts`
    (garde du cycle d'imports), `env-schemas.test.ts`.
  - `e2e/auth.spec.ts` : 2 échecs préexistants (boutons Google / Apple), hors périmètre.
- **Rate limit Better Auth** : stockage en mémoire, clé par IP et chemin ; indifférent au domaine.
- **ADR 003** refuse la session (`activeOrganizationId`) comme source du tenant ; ce principe tient toujours,
  s03c ne doit pas le réintroduire.
- **Build** : le hook `pre-push` lance `pnpm build`, qui dépasse aujourd'hui le délai sur les pages docs
  héritées (`/en/docs/stripe-payments/*`, `/en/docs/email-notifications/*`). Sans rapport avec la story,
  mais il ralentira chaque push.

## Open questions

1. **Mécanisme (ADR 022)** : `baseURL` dynamique `{allowedHosts: ['*'] ou motif, protocol}` avec défense par la
   résolution du tenant, ou `baseURL` fixe avec URL du lien reconstruite depuis `organization.domain` dans
   `sendMagicLink`, **plus** `callbackURL` absolu sur le domaine de l'association et `trustedOrigins` en
   fonction lisant les domaines en base ? La seconde voie exige que `/magic-link/verify` soit servi par le
   domaine de l'association (le lien y pointe) et que le cookie posé soit celui de cet hôte : à vérifier
   que `setSessionCookie` n'utilise pas le `baseURL` fixe pour ses attributs.
2. **Domaine inconnu** : exception de Better Auth (pas de `fallback`), ou `fallback` vers un domaine de
   plateforme ? Et où se connecte le **SuperAdmin**, qui n'a pas d'association (question 5 de s03, toujours
   ouverte) ?
3. **Portée du critère 2** : suffit-il que le cookie soit propre à l'hôte (une session de A n'atteint jamais
   B), ou faut-il aussi fermer, sur le domaine de A, l'accès aux données de B d'un membre des deux
   (`team/[slug]`, `account/organizations`, `activeOrganizationId`) ? La seconde lecture touche au groupe
   `(app)` hérité et pourrait dépasser la complexité 3.
4. **« Adresse connue » sur B** : aujourd'hui un lien part pour **tout** utilisateur existant, membre ou non
   de l'association du domaine (`getUserByEmailDao(email)`, l. 202). `user@gmail.com` (TechCorp seulement)
   demandant un lien sur `127.0.0.1` le reçoit et ouvre une session sur Marketing Pro, où il n'a aucun
   rôle. Est-ce dans le périmètre du critère 2, ou une question de s03 restée ouverte ?
5. **`auth-client.ts`** : retirer le `baseURL` (origine courante) — à confirmer dans le code du client
   Better Auth — ou le calculer ? Et les liens OTP / invitation sur `NEXT_PUBLIC_APP_URL` (`auth.ts:142, 163`) :
   s03c, ou laissés à s15 (invitation) et à la décision sur la 2FA ?
6. **`trustedProxyHeaders`** : l'activer dès s03c (cohérent avec `getCurrentTenantDal`, qui fait déjà
   confiance à `x-forwarded-host`) ou le laisser à s12b ? L'activer sans proxy de confiance permet à un
   client de forger l'hôte vu par Better Auth — ce que `getCurrentTenantDal` accepte déjà aujourd'hui.
7. **Preuve e2e** : `127.0.0.1` sert Marketing Pro ; le plan doit choisir les comptes (`user-admin@gmail.com`
   pour B, `user-owner@gmail.com` pour A, `admin@gmail.com` pour « même adresse, deux domaines ») et
   décider si la spec étend `magic-link.spec.ts` ou en crée une. Les compteurs journaliers de Marketing Pro
   devront être remis à zéro comme ceux de TechCorp (`resetRateLimits`).
