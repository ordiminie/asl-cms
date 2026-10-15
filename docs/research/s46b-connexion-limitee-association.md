# Research — Story s46b-connexion-limitee-association

> Recherche du **2026-10-14** sur `main` à `e73a880` (s46 fusionnée en PR 41). Elle reprend et vérifie
> les parties « connexion » de `docs/research/s46-comptes-herites-minimum.md` (rédigée le 13/10, avant
> la scission et avant la fusion de s46) au lieu de repartir de zéro. Chaque affirmation a été relevée
> **en ouvrant les fichiers** ; « NON VÉRIFIÉ » marque ce qui ne l'a pas été.
> `docs/reviews/stories.md` : `Stories ready: yes`. Better Auth installé : **1.7.1** (`better-auth`,
> `@better-auth/core`, `@better-auth/stripe`, `@better-auth/api-key`).

## Target story

**s46b — Ne se connecter que chez son association** (complexité 4, dépend de s03, s03b, s03c, s46).
En tant que membre du bureau, je veux que seuls les membres de mon association puissent se connecter
sur son site, et arriver directement là où je travaille.

Critères d'acceptation (`docs/stories.md:3322-3328`) :

1. **Destination par rôle**, quel que soit le mode : bureau ou Présidence de l'association du domaine
   appelé → `/bureau` ; SuperAdmin → `/admin` (même s'il a un rôle dans l'association) ; membre
   propriétaire → `/dashboard`.
2. **Connexion limitée au domaine d'une association dont on est membre**, pour les quatre modes (mot de
   passe, lien magique, double authentification, Google). Refus = aucune session et **même message
   qu'un compte inconnu**. Seul le SuperAdmin est exempté. Preuves : e2e d'accès croisé pour le mot de
   passe et le lien magique (jeton émis sur A, ouvert sur B compris) ; test unitaire du **point de
   contrôle unique** (membre de A refusé sur B, accepté sur A, SuperAdmin partout, hôte sans
   association refusé sauf au SuperAdmin). Pas d'e2e pour la double authentification ni pour Google.
3. **Inscription fermée** : `/register` répond 404 ; une création de compte par mot de passe adressée
   directement au serveur d'authentification est refusée (test : aucun utilisateur créé). Le webhook
   Stripe ne crée plus de compte : l'achat « invité » (`metadata.source = 'custom_checkout'`) ne crée
   plus d'utilisateur (test unitaire de `onStripeEvent`).
4. **Lien magique pour une adresse inconnue** : aucun compte créé (fait par s03, gardé par un test).
5. **Google** sur aucun écran ; configuration serveur conservée avec `disableSignUp` ; un compte Google
   inconnu ne crée aucun utilisateur. Apple ni proposé ni configuré ; GitHub retiré. Aucune trace
   d'Apple ni de GitHub dans les écrans, les actions, le schéma d'environnement et la CI.

Notes de la story : solder aussi m6 et les commentaires anglais de m7 dans `e2e/auth.spec.ts` (revue de
s43).

## Current state of the code

### Configuration Better Auth — `src/lib/better-auth/auth.ts` (416 lignes)

- `disabledPaths` (l. 63) : `[...MAGIC_LINK_DISABLED_HTTP_PATHS]` = `['/sign-in/magic-link']`
  (`magic-link-integration.ts:218-220`). `/sign-up/email` est **ouvert** en HTTP.
- `emailAndPassword` (l. 73-85) : `{enabled: true, requireEmailVerification, sendResetPassword}`.
  **Pas de `disableSignUp`.**
- `account.accountLinking` (l. 86-90) : `{enabled: true}`, sans `trustedProviders`.
- `socialProviders` (l. 125-131) : **seul `google`** (`prompt: 'select_account'`, `clientId`,
  `clientSecret`). Pas de `disableSignUp`, `disableImplicitSignUp` ni `redirectURI`. Aucune
  configuration Apple ou GitHub.
- Plugins (l. 132-268) : `bearer()` (133), `twoFactor` (134-152), `magicLink(magicLinkOptions)` (153),
  `admin()` (154), `organization` (155-188), `stripe` (189-267, `createCustomerOnSignUp: true` l. 192).
  `apiKey()` a été retiré par s46, mais le paquet `@better-auth/api-key` reste (`package.json:40`).
  Puis `customSession` (l. 280-287 : `getUserByIdDao(session.userId)`, donc `user.organizations`
  complet) et `nextCookies()` (l. 288).
- `twoFactor.otpOptions.sendOTP` (l. 141) : lien `${env.NEXT_PUBLIC_APP_URL}/verify-request/otp?code=`,
  sur l'URL de la plateforme, pas du domaine de l'association.
- `trustedOrigins` (l. 269) : `trustedOriginsOf` (fonction par requête, ADR 022).
- `hooks.after` (l. 270-272) → `createAuthRedirectMiddleware()` (l. 381-416) :
  - l. 393-396 : `/sign-in/email` avec nouvelle session, `console.log` ; `//throw ctx.redirect('/dashboard')`
    commenté (l. 395) ;
  - l. 399-402 : `/sign-up/email` avec nouvelle session → `/verify-request` ;
  - l. 405-408 : `/sign-out` → `/login` ;
  - l. 411-414 : `/verify-email` avec nouvelle session → **`/dashboard` en dur (l. 413)**.
- `databaseHooks` (l. 273 → `createDatabaseHooks()`, l. 296-335) :
  - `user.create.before` (300-307) : `name` par défaut = préfixe de l'email ;
  - `user.create.after` (308-318) : `initializeRegisterUserDataService(user.email)`
    (`user-service.ts:189-252`), qui crée les `user_settings`, appelle
    `triggerInngestWelcomeFollowUpEmail` (l. 229) et crée une **organisation personnelle**
    (`createOrganizationForUserService`, l. 243-246) si l'utilisateur n'en a aucune ; puis
    `sendInternalEmailService` (« Nouvel utilisateur enregistré », erreur avalée) ;
  - **`session.create.before` (l. 321-333)** : `before: async (session: {userId: string}) => {…}`,
    **un seul paramètre**. Il lit `getUserByIdDao`, lève `APIError('FORBIDDEN', {message:
    buildBannedMessage(user)})` si `isUserBanned`, et renvoie `{data: session}`. **Il ne contrôle que
    le bannissement.**
- `sendInvitationEmail` (l. 161-187) : lien `${env.NEXT_PUBLIC_APP_URL}/account/invitations/${data.id}`
  (l. 162), une route retirée par s46 (idem `notification-service.ts:239`). Dette I du plan de s46, hors
  périmètre ici.

### Actions de connexion — `src/app/[locale]/(auth)/action.ts` (633 lignes, inchangé depuis la recherche de s46)

| Lignes  | Action                    | Ouverture de session / destination                                                                                                                                                  |
| ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 78-184  | `loginCredentialAction`   | `auth.api.signInEmail({body: {…, callbackURL: '/dashboard'}})` l. 139-146 (callbackURL l. 143), **sans `headers`** ; redirection `Location ?? url ?? '/404'` (l. 166) ; 2FA → `/verify-request/otp` (170) ou `/totp` (172) |
| 208-250 | `requestMagicLinkAction`  | `headers` passés (l. 232), `callbackURL '/dashboard'` (235), `errorCallbackURL '/login/lien-invalide'` (236), `metadata: {locale}`                                                  |
| 255-360 | `registerCredentialAction`| `signUpEmail` sans headers (l. 307-317), puis `signInEmail` avec headers (325-326), `redirect('/verify-request')` (344)                                                             |
| 365-413 | `loginProviderAction`     | `signInSocial({headers, body: {provider, callbackURL: '/dashboard'}})` (387-390) ; union de type `google`/`apple`/`github` (366-369)                                                |
| 418-490 | `registerMagicLinkAction` | headers (469), `callbackURL '/dashboard'` (472), message `emailAlreadyUsed`                                                                                                         |
| 495-513 | `registerProviderAction`  | délègue à `loginProviderAction` (l. 507) ; union de type (496)                                                                                                                      |
| 515-520 | `logoutAction`            | —                                                                                                                                                                                   |
| 525-574 | `verifyBackupCodeAction`  | headers (544), `redirect('/dashboard')` (552)                                                                                                                                       |
| 579-633 | `verifyOTPAction`         | `verifyTwoFactorOTP({headers, body: {code, trustDevice: true}})` (601), `// callbackURL: '/dashboard'` (605), `redirect('/dashboard')` (612)                                        |

- **Aucune résolution du tenant** : ni `getCurrentTenantDal` ni `requestHostOf` ne sont importés
  (imports l. 3-25).
- **Deux messages distincts** dans `loginCredentialAction` : `t('userNotFound')` (l. 120, quand
  `getUserByEmailService` ne trouve rien, bloc 115-122) = « Aucun compte trouvé avec cet email »
  (`messages/fr.json:732`) ; `t('invalidCredentials')` (l. 151, `!response.ok`) = « Identifiants
  invalides » (`fr.json:733`). Le bannissement redirige vers `/auth-error?error=banned` (l. 131-133).
- Autres destinations `/dashboard` en dur : `verify-request/otp/otp.tsx:99` et
  `verify-request/totp/totp.tsx:72` (`router.push('/dashboard')`), `auth.ts:413`. Liens (pas des
  destinations de connexion) : `(app)/account/page.tsx:28`, `logout-form.tsx:40`.

### Lien magique et domaine

- `magic-link-integration.ts` (229 lignes, inchangé) :
  - `requestHeadersOf(ctx)` (l. 48-49) : `ctx?.headers ?? ctx?.request?.headers` ;
  - `organizationOfRequest(host, services)` (l. 95-104), **privée** : `normalizeTenantHost`, puis
    `getOrganizationByDomainService` chargé par `import()` (l. 75-90, pour éviter un cycle d'imports,
    garanti par `magic-link-integration-imports.test.ts`), et exige `organization.domain` ;
  - `sendMagicLink({email, url, token, metadata}, ctx?)` (l. 162-200) : hôte (167), organisation (169),
    quota (178-187), puis `getUserByEmailDao` et `if (!user || !isMemberOf(user, organization)) return`
    (189-190), révocation des liens précédents (193), envoi avec `rebaseMagicLinkUrl` (196) ;
  - `magicLinkOptions` (l. 203-208) : `{expiresIn, disableSignUp: true, rateLimit, sendMagicLink}` ;
  - `isMemberOf` (l. 222-229), **privée**, ne regarde pas le rôle et **n'exempte pas le SuperAdmin**.
- **Rien ne revérifie l'appartenance à l'ouverture du lien** (`GET /api/auth/magic-link/verify`) : un
  jeton émis sur A et ouvert sur B ouvre une session sur B (déduit du code, aucun test ne le prouve).
- `association-origin.ts` : `requestHostOf(headers)` (l. 8-11 : premier élément de
  `x-forwarded-host`, sinon `host`), `associationOriginOf` (25-35), `rebaseMagicLinkUrl` (56-66,
  réécrit `callbackURL`, `errorCallbackURL` et `newUserCallbackURL`), `trustedOriginsOf` (76-88).
- **Mot de passe, double authentification, Google : aucune vérification d'appartenance.**

### Écrans `(auth)`

- Pages : `login` (lien magique, `<MagicLinkLogin requestAction={requestMagicLinkAction}>` l. 41),
  `login/prestataire` (`LoginForm` → `CredentialForm` → `loginCredentialAction`),
  `login/lien-invalide`, **`register` (toujours là)**, `reset-password`, `verify-request` (+ `otp`,
  `totp`, `recovery`), `auth-error`, `logout`.
- `/register` sert `RegisterForm` (`register-form.tsx`), qui appelle `registerProviderAction` (l. 95)
  et `registerCredentialAction` (l. 126). `register-magic-link-form.tsx:27` appelle
  `registerMagicLinkAction` ; qui monte ce composant : NON VÉRIFIÉ.
- **Google n'est proposé que dans `register-form.tsx`** (`hasGoogle` l. 67, bouton l. 193-205).
  `loginProviderAction` n'a qu'un appelant : `registerProviderAction`. `login.test.tsx:25` affirme déjà
  l'absence de Google, Apple et GitHub sur la connexion. **Fermer `/register` retire Google de tous les
  écrans**, mais `loginProviderAction` reste une Server Action exportée, donc appelable sans écran.
- Aucun lien vers `/register` dans l'application (`login.test.tsx:23`, `(public)/page.test.tsx:105`,
  `e2e/auth.spec.ts:42`).

### Rôles

- `canManageAssociation(user: User | undefined, organizationId: string): boolean`
  (`association-authorization.ts:21-33`) : vrai pour `super_admin`, sinon pour une appartenance portant
  `organizationId` avec un rôle de `BOARD_ROLES` = `owner`/`board` (l. 7-10). **Vrai pour le SuperAdmin
  partout.**
- `UserOrganizationRoleConst` (`auth-types.ts:43-47`) : `OWNER 'owner'`, `ADMIN 'board'`,
  `MEMBER 'member'`. `RoleConst` (l. 50-57) : `public`, `user`, `redactor`, `moderator`, `admin`,
  `super_admin`.
- `auth-util.ts` : `isAdmin` (l. 47-50) accepte **`admin` ou `super_admin`** ;
  `isOrganizationAdmin/Owner/Member` (52-83) sont asynchrones. **Aucun helper `isSuperAdmin`.**
- **Aucune route ni fonction d'atterrissage après connexion** (« landing », « after-login »,
  « post-login », « destination » : rien de pertinent dans `src/`).
- `(bureau)/layout.tsx:34-46` : `requireCurrentTenantDal()` puis `canManageCurrentAssociationIdentityDal()` ;
  si l'accès est refusé, `BureauAccessDenied`.

### Webhook Stripe et création de comptes

- `src/lib/stripe/stripe-events.ts` (853 lignes). `onStripeEvent` (l. 20-112), branché par
  `onEvent: onStripeEvent` (`auth.ts:266`, importé l. 36) :
  - `checkout.session.completed` (l. 39-70) : `metadata.source === 'custom_checkout'` (l. 42) →
    `handleGuestCheckoutSessionCompleted` (l. 47-55) ; `installment_checkout` →
    `handleInstallmentCheckoutSessionCompleted` (l. 58-63) ; **appel commenté à la l. 67**
    (`//await handleFullCheckoutSessionCompleted(event)`, et non l. 66 comme le dit la story).
  - Les autres événements ne font que journaliser (l. 29-38, 72-98). Le catch (l. 103-111) relance
    l'erreur si `isCriticalStripeEvent` (l. 114-122), qui n'est vrai que pour l'achat invité.
- `handleGuestCheckoutSessionCompleted` (l. 127-160) : `detectGuestCheckoutMode` (165-180),
  `validateGuestCheckoutData` (185-~233), `createGuestUser` (236-258 → `ensureStripeCustomer` 357-382,
  `ensureDatabaseUser` 387-446 → **`createUserFromStripeService` l. 425**), `updateSubscriptionWithUser`
  (451-481), `warnOnDuplicateSubscription` (271-~315), `sendGuestAccessEmail` (317-352 :
  `hasPasswordCredentialDao`, `auth.api.signInMagicLink` avec `callbackURL:
  '/account/billing/subscription'` l. 342, une route retirée).
- `handleFullCheckoutSessionCompleted` (l. 487-670, `eslint-disable no-unused-vars`) : appelle aussi
  `createUserFromStripeService` (l. 569).
- **Le paiement en plusieurs fois crée lui aussi des comptes** :
  `handleInstallmentCheckoutSessionCompleted` (l. 679-708) appelle `createGuestUser` quand
  `detectGuestCheckoutMode(metadata)` est vrai (l. 689-698), sinon `getAuthenticatedUser` (l. 783-800).
- `createUserFromStripeService` (`user-service.ts:337-418`) : `createUserFromStripeServiceSchema`
  (`user-validation.ts:38-52`), puis `auth.api.createUser({body: {email, name, password: '', role:
  ['user']}})` (l. 391), `initializeRegisterUserDataService` (l. 408), `auth.api.sendVerificationEmail`
  (l. 409). Façade : `user-service-facade.ts:9-10` (l'intercepteur est générique, rien à y retirer).
  Type : `CreateUserFromStripe` (`user-types.ts:59-64`). Seul importeur : `stripe-events.ts:15`.
- **Aucun test unitaire de `onStripeEvent`** : ni `stripe-events.test.ts`, ni aucun test qui l'importe.
- `checkout.sessions.create` n'apparaît dans `src/` qu'en commentaire (`src/app/api/webhooks/stripe/route.ts:32`).
  Ce second webhook, `@deprecated` (l. 1-11) mais toujours routé (`POST` l. 78), traite aussi
  `checkout.session.completed` sans créer d'utilisateur (`createSubscriptionFromStripeService` lève
  « User not found », `subscription-service.ts:153-155`).
- **Chemins de création de compte** :

  | Chemin                                                 | Où                                       | Dépend de l'inscription publique ? | Déclenche les hooks Better Auth ? |
  | ------------------------------------------------------ | ---------------------------------------- | ---------------------------------- | --------------------------------- |
  | `registerCredentialAction` → `signUpEmail`             | `action.ts:307`                          | **oui** (même point que `/sign-up/email`) | oui                        |
  | `createUserFromStripeService` → `auth.api.createUser`  | `user-service.ts:391`                    | non (point d'administration)       | oui                               |
  | Provisioning d'une association → `createUserDao`       | `organization-service.ts:701-708`        | non                                | **non** (insertion Drizzle)       |
  | Seed                                                   | `seed.ts:145` (`INSERT INTO "user"`), 173-194 (`account`, mot de passe haché) | non | **non** (SQL brut via `pg`) |
  | Google (callback OAuth), lien magique                  | Better Auth                              | oui, faute de `disableSignUp` (Google) ; fermé (lien magique) | oui |
  | `createUserService` → `createUserDao`                  | `user-service.ts:54-62`                  | — **aucun appelant** (code mort)   | non                               |

### Routage

- `src/lib/routing/authenticated-segments.ts` : `AUTHENTICATED_SEGMENTS` (l. 9-14) = `/account`,
  `/admin`, `/bureau`, `/dashboard` (`/team` retiré par s46) ; `SIGN_IN_SEGMENTS` (l. 17-24) =
  `/login`, **`/register`**, `/verify-request`, `/reset-password`, `/logout`, `/auth-error`.
- `src/proxy.ts` (63 lignes) ne lit que `AUTHENTICATED_SEGMENTS` (sans cookie → `/login`, aucun appel à
  la base). `SIGN_IN_SEGMENTS` n'est lu que par `src/app/robots.ts:7, 60`.

### Environnement et CI

- `NEXT_PUBLIC_AUTH_METHODS` (`env-schemas.ts:180-185`), défaut `'credential,magiclink,google'`,
  découpé par `split` ; `src/env.ts:93`. Enum `AuthMethodSchema` avec `apple` et `github`
  (`env-schemas.ts:15-16`). `GOOGLE_CLIENT_ID/SECRET` optionnels (`env-schemas.ts:105-106`,
  `env.ts:65-66`).
- Valeurs : `.env.development:35` et `.env.test:31` = `credential,magiclink` ; `ci.yml:42` (job
  `qualite`) = `credential,magiclink` ; **`ci.yml:76` (job e2e) = `credential,magiclink,google,apple,github`**
  avec `NEXT_PUBLIC_BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION: 'true'` (l. 77). Le commentaire l. 71-74
  justifie les deux par l'inscription (« boutons Google/Apple attendus », « l'inscription ouvre le
  tableau de bord qui appelle Stripe »). `scripts/init-env.ts:157, 256-257` : défaut
  `credential,magiclink,google`. `env.example:65` : `credential,magiclink,google,apple,github`, et l. 66
  (« un visiteur non connecté va sur /register »).
- Lecteurs : `action.ts:85, 262, 378, 425, 501`, `reset-password/page.tsx:34`, `register-form.tsx:64-72`,
  `auth-helper.ts:4` (`isAuthMethodEnabled`), simulacre dans `locale-defaults.test.ts:8`.

### Seed et domaines des e2e

- Domaines (`seed.ts:277-283`) : `techcorp-solutions` = `localhost` (**A**), `marketing-pro` =
  `127.0.0.1` (**B**) ; `acme-corp` et `evil-corp` sans domaine.
- Comptes (rôle global) et appartenances (`seed.ts:145-168`, 288-338), tous au mot de passe `Azerty123` :

  | Compte              | Rôle global   | A (techcorp)      | B (marketing-pro) | Autres                  |
  | ------------------- | ------------- | ----------------- | ----------------- | ----------------------- |
  | `superadmin@`       | `super_admin` | —                 | —                 | —                       |
  | `admin@`            | `admin`       | member            | board             | acme : owner            |
  | `user@`             | `user`        | member            | —                 | acme : board, evil : owner |
  | `user-owner@`       | `user`        | owner             | —                 | —                       |
  | `user-admin@`       | `user`        | —                 | board             | —                       |
  | `user-member@`      | `user`        | —                 | —                 | acme : member           |
  | `admin-owner@`      | `admin`       | —                 | owner             | —                       |
  | `moderator-member@` | `moderator`   | member            | —                 | —                       |
  | `moderator@`, `redactor@`, `public@`, `user-isolated@` | divers | — | —      | —                       |

- **Double authentification** : seul `user_settings.two_factor_type = 'totp'` est posé pour le
  SuperAdmin (`seed.ts:243`). Ni `user.two_factor_enabled` ni la table `two_factor` ne sont remplis :
  aucun compte n'a la double authentification active.

## Anchor points

- **Point de contrôle unique** : `databaseHooks.session.create.before` (`auth.ts:321-333`), à côté du
  contrôle de bannissement, ou une fonction pure appelée depuis ce hook.
- **Résolution du domaine dans le hook** : `context?.headers ?? context?.request?.headers` (même lecture
  que `requestHeadersOf`, `magic-link-integration.ts:48-49`), puis `requestHostOf` →
  `normalizeTenantHost` → `getOrganizationByDomainService` (motif d'`organizationOfRequest`).
- **Règle d'appartenance existante** : `isMemberOf` (`magic-link-integration.ts:222-229`, privée), à
  partager plutôt qu'à recopier.
- **Destinations** : `action.ts` l. 143, 235, 390, 472, 552, 612 ; `otp.tsx:99`, `totp.tsx:72` ;
  `auth.ts:413`. La règle de rôle : `canManageAssociation` + le rôle global `super_admin`.
- **Inscription** : `emailAndPassword` (`auth.ts:73-85`), `socialProviders.google` (`auth.ts:125-131`),
  `register/page.tsx`, `register-form.tsx`, `register-magic-link-form.tsx`, les trois actions
  `register*` et `loginProviderAction`, la branche `/sign-up/email` du middleware (`auth.ts:399-402`).
- **Stripe** : `stripe-events.ts` (branches invitée, complète, et le mode invité du paiement en
  plusieurs fois), `createUserFromStripeService` et ses dépendances.
- **Traces** : `env-schemas.ts:15-16, 180-185`, `ci.yml:71-77`, `env.example:65-66`,
  `scripts/init-env.ts:157, 256-257`, `messages/fr.json`.

## Verified APIs / functions

| Nom                                              | Signature / valeur                                                                                                                 | Emplacement                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `databaseHooks.session.create.before`            | `(session, context: GenericEndpointContext \| null) => Promise<boolean \| void \| {data}>` ; `false` = pas de session               | `@better-auth/core/dist/types/init-options.d.mts:1287`                          |
| `createWithHooks`                                | `context = await getCurrentAuthContext().catch(() => null)` ; `false` → `return null` ; `{data}` fusionné ; exception propagée     | `better-auth/dist/db/with-hooks.mjs:6-23`                                       |
| `internalAdapter.createSession`                  | lit `ctx?.headers \|\| ctx?.request?.headers` (pour l'IP), puis `createWithHooks(…, 'session')`                                    | `better-auth/dist/db/internal-adapter.mjs:248-252`                              |
| Hook de bannissement du plugin `admin()`         | `session.create.before(session, ctx)`, `if (!ctx) return`                                                                          | `better-auth/dist/plugins/admin/admin.mjs:33-48`                                |
| `emailAndPassword.disableSignUp`                 | `boolean`                                                                                                                          | `init-options.d.mts:665` ; appliqué `api/routes/sign-up.mjs:145`                |
| `disableSignUp` / `disableImplicitSignUp` (OAuth)| `boolean`                                                                                                                          | `oauth-provider.d.mts:238, 242, 339, 343` ; appliqués `sign-in.mjs:197`, `callback.mjs:229`, `link-account.mjs:201` |
| Lien magique `disableSignUp`                     | erreur `new_user_signup_disabled`                                                                                                  | `plugins/magic-link/index.mjs:161, 175`                                         |
| `isMemberOf`                                     | `(user: {organizations?: {organizationId: string}[]}, organization: Organization) => boolean`, privée, sans rôle ni exemption        | `magic-link-integration.ts:222-229`                                             |
| `sendMagicLink`                                  | `({email, url, token, metadata}, ctx?) => Promise<void>`                                                                           | `magic-link-integration.ts:162-200`                                             |
| `requestHostOf`                                  | `(headers: Headers \| undefined) => string \| undefined`                                                                           | `association-origin.ts:8-11`                                                    |
| `normalizeTenantHost`                            | `(host: string \| null \| undefined) => string \| undefined`                                                                       | `src/lib/helper/tenant-helper.ts:11-28`                                         |
| `rebaseMagicLinkUrl`                             | `(url: string, origin: string) => string`                                                                                          | `association-origin.ts:56-66`                                                   |
| `getOrganizationByDomainService`                 | `(domain: string) => Promise<Organization \| undefined>` ; façade `organization-service-facade.ts:58-59`                            | `organization-service.ts:646-655`                                               |
| `getCurrentTenantDal` / `requireCurrentTenantDal`| `server-only`, `next/headers`, `'use cache'` ; lit `x-forwarded-host ?? host` sans découper la liste (l. 75)                        | `src/app/dal/tenant-dal.ts:71 / :93`                                            |
| `canManageAssociation`                           | `(user: User \| undefined, organizationId: string) => boolean`                                                                     | `association-authorization.ts:21-33`                                            |
| `isAdmin`                                        | `(user?: User \| null) => boolean` (`admin` ou `super_admin`)                                                                      | `auth-util.ts:47-50`                                                            |
| `getUserByIdDao` / `getUserByEmailDao`           | chargent `members` + `organization` et exposent `organizations`                                                                    | `user-repository.ts:39-67 / 74-100`                                             |
| `createUserFromStripeService`                    | `(userParams: CreateUserFromStripe)` ; `auth.api.createUser` l. 391                                                                | `user-service.ts:337-418`                                                       |
| `onStripeEvent`                                  | `(event: Stripe.Event) => Promise<void>`                                                                                           | `stripe-events.ts:20-112`                                                       |
| `AUTHENTICATED_SEGMENTS` / `SIGN_IN_SEGMENTS`    | `readonly string[]` (4 et 6 segments)                                                                                              | `authenticated-segments.ts:9-14 / 17-24`                                        |
| `checkCitedPaths`                                | échoue sur un lien `](src\|docs\|scripts\|e2e/…)` absent du disque, dans `.claude/rules/*.md` et `.cursor/rules/*.mdc`              | `scripts/check-rules.ts:99-116`                                                 |

**Ce que fait un refus du hook, par mode** (vérifié dans `node_modules`, 1.7.1) :

| Mode                         | `createSession` appelé à                       | Effet d'un `false`                                                                                       |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mot de passe                 | `api/routes/sign-in.mjs:353`                   | `UNAUTHORIZED FAILED_TO_CREATE_SESSION` (354-357)                                                        |
| Lien magique (ouverture)     | `plugins/magic-link/index.mjs:182`             | `redirectWithError("failed_to_create_session")` vers `errorCallbackURL` (183)                            |
| Google (callback)            | `oauth2/link-account.mjs:268` ← `callback.mjs:220` | `{error: 'unable to create session'}` (269-273) puis `redirectOnError` (`callback.mjs:243-245`)      |
| 2FA (vérification finale)    | `plugins/two-factor/verify-two-factor.mjs:31`  | `INTERNAL_SERVER_ERROR FAILED_TO_CREATE_SESSION` (32-35)                                                 |
| Autres appels du hook        | 2FA activation/désactivation (`two-factor/index.mjs:119, 141, 228`), `otp/index.mjs:227`, `totp/index.mjs:210`, imitation (`plugins/admin/routes.mjs:596`), vérification d'email (`email-verification.mjs:216, 251, 298`), inscription (`sign-up.mjs:264`) | —                         |

Une `APIError` levée dans le hook (au lieu d'un `false`) affiche son propre message pour le mot de passe
(cas du bannissement) et passe par `redirectOnError` pour Google (`callback.mjs:240`) ; pour l'ouverture
du lien magique, son traitement de bout en bout est NON VÉRIFIÉ.

## Traps & constraints

1. **Le hook se déclenche partout, pas seulement à la connexion** : vérification d'email, activation et
   désactivation de la 2FA, imitation d'un utilisateur par le plugin `admin`, inscription. Pour un
   compte à double authentification, la session ouverte au mot de passe est **détruite** par le hook
   `after` de la 2FA (`two-factor/index.mjs:248-287`) puis recréée à la vérification du code : le
   contrôle tourne deux fois. Avec `trustDevice`, la 2FA est sautée.
2. **`context` du hook** : `createWithHooks` le récupère par `getCurrentAuthContext().catch(() => null)`.
   Il est non nul pour tout appel `auth.api.*` ou HTTP (`api/dispatch.mjs:184-228` passe toujours par
   `runWithEndpointContext`). Mais **`loginCredentialAction` n'envoie pas `headers` à `signInEmail`**
   (l. 139) : sans eux, `context.headers` est `undefined` et l'hôte est illisible. Pour les GET de
   navigateur (`/magic-link/verify`, callback Google), que le routeur remplisse `headers` plutôt que
   seulement `request` est NON VÉRIFIÉ ; le repli `request.headers` couvre les deux cas.
3. **Deux hooks `session.create.before`** : celui du projet (`auth.ts:321-333`) et celui du plugin
   `admin()` (`admin.mjs:33-48`), qui ne fait rien si `ctx` est nul. Ordre d'exécution relatif : NON
   VÉRIFIÉ.
4. **`canManageAssociation` vaut vrai pour le SuperAdmin**, et `isMemberOf` ne l'exempte pas. L'ordre
   des tests pour la destination est donc : `super_admin` → `/admin`, puis `owner`/`board` de
   l'association du domaine → `/bureau`, sinon `/dashboard`. `isAdmin` accepte aussi le rôle global
   `admin` (`admin@`, `admin-owner@`) : ne pas s'en servir pour reconnaître le SuperAdmin. Aucun helper
   `isSuperAdmin` n'existe.
5. **« Même message qu'un compte inconnu »** : aujourd'hui `userNotFound` ≠ `invalidCredentials`, et
   l'action consulte l'existence du compte **avant** d'appeler Better Auth (l. 115-122) : c'est un
   oracle d'existence, indépendant du hook. Une `APIError` levée dans le hook afficherait son propre
   message (comme le bannissement). Pour le lien magique, l'indiscernabilité de la demande repose sur
   « ne rien envoyer » ; à l'ouverture d'un jeton, l'erreur arrive par `errorCallbackURL`
   (`/login/lien-invalide`).
6. **Le lien magique et Google fixent leur destination avant de savoir qui se connecte** (`callbackURL`
   à la demande). Une destination par rôle suppose une route de passage résolue après l'ouverture de
   la session ; son `callbackURL` relatif doit rester réécrit sur l'origine de l'association
   (`rebaseMagicLinkUrl`, ADR 022). Le cookie étant propre à l'hôte, `/admin`, `/bureau` et
   `/dashboard` d'un même domaine partagent la session.
7. **Résolution du tenant hors de Next** : `tenant-dal.ts` (`server-only`, `next/headers`,
   `'use cache'`) n'est pas utilisable dans un hook Better Auth. Le motif existant est celui
   d'`organizationOfRequest`, avec la façade chargée par `import()` pour éviter le cycle
   `auth.ts` → façade → `auth-service` → `auth.ts` (garde : `magic-link-integration-imports.test.ts`).
   `requestHostOf` découpe `x-forwarded-host` ; `getCurrentTenantDal` ne le découpe pas (l. 75) : deux
   lectures du même en-tête qui peuvent diverger derrière plusieurs proxys. Better Auth n'honore
   `x-forwarded-host` qu'avec `advanced.trustedProxyHeaders`, non activé (ADR 022, à vérifier en s12b).
8. **Le paiement en plusieurs fois crée des comptes** (`stripe-events.ts:689-698`) par le même
   `createGuestUser`. La story dit que ce chemin « ne change pas », mais retirer
   `createUserFromStripeService` casse sa branche invitée.
9. **Retirer `createUserFromStripeService` rend orphelins** le type `CreateUserFromStripe`, le schéma
   `createUserFromStripeServiceSchema`, l'import `auth` de `user-service.ts:19` (qui ne sert qu'aux
   l. 391 et 409 ; son retrait coupe un cycle `user-service` → `auth` → façade) et, avec
   `sendGuestAccessEmail`, `hasPasswordCredentialDao` (`user-repository.ts:389`).
   `getBillingContext`, `getSubscriptionByUserIdService` et `updateSubscriptionForWebhookService`
   n'ont plus d'appelant dans `stripe-events.ts` une fois les branches invitée et complète parties ;
   leurs autres appelants (y compris en test) : NON VÉRIFIÉ. `isCriticalStripeEvent` devient sans objet.
10. **Aucun test de `onStripeEvent`** : le harnais (simulacres de Stripe, des DAO et des façades) est à
    créer pour le critère 3.
11. **`user.create.after`** crée une organisation personnelle, déclenche Inngest (remplacé par
    `scheduled_job`, ADR 006) et envoie un email interne, mais seulement pour les créations passant par
    Better Auth. Le provisioning (`createUserDao`) et le seed (SQL) y échappent : fermer l'inscription ne
    les gêne pas.
12. **Specs e2e touchées** (pas de helper partagé : chaque spec redéfinit `login`, qui va sur
    `/login/prestataire` et attend seulement de **quitter** `/login`, donc `/bureau` et `/admin`
    passent) :
    - `auth.spec.ts` : l. 20 (page d'inscription, attend Google et Apple l. 24-25), l. 52 (« should
      successfully register », regex l. 119), l. 223 et l. 247 (validations d'inscription) ; l. 186
      (test l. 123, `user@` = membre) : la regex `/(dashboard|app)|…/` passe toujours ; l. 42 reste
      valable.
    - `magic-link.spec.ts` : l. 358 (test l. 326) et l. 442 (test l. 431), avec `user-owner@`, la
      Présidence de A, qui arrivera sur `/bureau` ; le helper `expectSessionOn` (~l. 525-540) épingle
      `callbackURL === ${origin}/dashboard` et sert aux tests l. 549 (`user-admin@`, bureau de B),
      l. 563 (`user-owner@` sur A) et l. 573 (`admin@` : membre sur A, bureau sur B). **Cinq tests
      cassent.**
    - `seo.spec.ts:256` (`Disallow: /register`), `robots.test.ts:84, 125`.
    - `locale-unique.spec.ts:118` : SuperAdmin sur `localhost`, arrivera sur `/admin`, puis va sur
      `/bureau` par `goto`.
    - Comptes sans ligne `member` qui se connectent en e2e : **seulement `superadmin@`** (exempté)
      (`account-legacy-routes:97, 149, 206, 223`, `association-settings:394, 489`,
      `association-identity:403`) et `test-${ts}@` d'`auth.spec.ts:63`, qui part avec `/register`.
13. **La note de la story sur `admin@` ne correspond pas au seed** : `admin@` est membre de A et bureau
    de B (`seed.ts` l. 294-296, 319-321). `association-settings.spec.ts:366` et
    `association-identity.spec.ts:370` le connectent sur A, où il est membre : il pourra toujours s'y
    connecter. Il arrivera sur `/dashboard` sur A et sur `/bureau` sur B, son rôle global `admin` n'étant
    pas SuperAdmin.
14. **Preuves d'accès croisé** : aucune e2e pour le mot de passe aujourd'hui (le modèle est
    `magic-link.spec.ts:593`, `user@` sur B). Comptes utiles : `user@` (membre de A seulement),
    `user-owner@` (Présidence de A), `user-admin@` (bureau de B), `superadmin@` (aucune appartenance).
    `action.test.ts` ne teste ni `loginCredentialAction`, ni `loginProviderAction`, ni les actions 2FA.
15. **m6 et la partie documentation de m7 sont déjà soldés** (`date-helper.ts:6` = `'fr'` par s46 ;
    `docs/authentication-system.md:389` par s45). Il ne reste que les commentaires anglais
    d'`e2e/auth.spec.ts` (l. 7-270, seules les l. 40-41 sont en français), ses noms de tests (l. 4, 20,
    52, 123, 190, 223, 247) et ses messages de `console.log`/`throw` (l. 91, 95, 105, 114, 181).
16. **Traces Apple et GitHub à retirer** (critère 5) : `env-schemas.ts:15-16` ; `action.ts:363, 366-369,
    377, 493, 496` ; `register-form.tsx:68-69, 92, 177-189, 209-221, 236` ; `messages/fr.json` l. 468,
    470, 475, 477 (`Auth.LoginForm.providers`/`loading`, apparemment plus lues : NON VÉRIFIÉ pour un
    accès par clé dynamique) et l. 531, 533 (`Auth.RegisterForm.providers`) ; `ci.yml:72, 76` ;
    `env.example:65` ; `e2e/auth.spec.ts:25` ; `docs/authentication-system.md` l. 11, 49, 115-117, 135,
    322, 377-382, 453-455. À garder : l'assertion négative `login.test.tsx:25` ; sans rapport avec
    l'authentification : `globals.css:289`, `auth.ts:60`, `stripe-events.ts:73-74`, `ci.yml:15`.
17. **`check:rules`** : supprimer `register-form.tsx` fait échouer `checkCitedPaths` à cause du lien de
    `rule-form-back.md:188` (et de sa copie `.cursor/rules/01-presentation/rule-form-back.mdc:187`).
    Autres mentions sans lien : `rule-form-back.md:30, 169`, `rule-presentation.md:27`.
    `STALE_PATTERNS` (l. 25-55) n'a encore aucun motif pour `/register`, Apple ou GitHub.
18. **Namespaces de messages propres à l'inscription** : `Auth.RegisterPage` (`fr.json:519`),
    `Auth.RegisterForm` (526), `Auth.RegisterMagicLinkForm` (572), `Auth.messages` (lu seulement par
    `register-form.tsx`), `AuthActions.register` (742), `AuthActions.registerMagicLink` (749),
    `AuthActions.registerProvider` (770), et `AuthActions.loginProvider` (766), dont l'action n'est
    appelée que par `registerProviderAction`. Le slug réservé `'register'`
    (`page-block-types.ts:122`) concerne le CMS, pas l'écran.
19. **Rien en dur (ADR 010)** : `/bureau`, `/admin` et `/dashboard` sont des routes du produit, pas des
    paramètres d'association. `member` est exempté de la RLS (ADR 014) et lu entre tenants par
    `customSession` : le contrôle d'appartenance peut lire `user.organizations` sans `withTenant`. La
    RLS n'est pas testable en unitaire : l'accès croisé se prouve en e2e.

## Open questions

1. **Contrôle d'appartenance dans le hook : quels appels exempter ?** Le hook tourne aussi pour la
   vérification d'email, l'activation et la désactivation de la 2FA, l'imitation (plugin `admin`) et
   l'inscription. Faut-il appliquer la règle partout (une imitation par le SuperAdmin d'un membre de A,
   faite depuis l'hôte de la plateforme, serait alors refusée), ou distinguer selon le chemin de
   l'appel (`context.path`) ? Que faire quand `context` est nul (aucun appel connu aujourd'hui) :
   refuser, ou laisser passer ?
2. **`false` ou `APIError` pour refuser ?** `false` donne les erreurs génériques de chaque mode
   (`FAILED_TO_CREATE_SESSION`, `failed_to_create_session`, `unable to create session`) ; une
   `APIError` donne un message choisi. Lequel aboutit, pour chaque mode, au même message qu'un compte
   inconnu ? Pour la 2FA, `false` produit un HTTP 500.
3. **L'oracle d'existence du mot de passe** : faut-il retirer la consultation préalable
   `getUserByEmailService` (`action.ts:115-122`) et son message `userNotFound`, pour que le compte
   inconnu, le mauvais mot de passe et le refus d'association donnent tous `invalidCredentials` ?
   Le bannissement (`/auth-error?error=banned`) dépend aujourd'hui de cette consultation.
4. **La route de passage** : son adresse (la story ne la nomme pas), qui l'utilise (`callbackURL` des
   actions, `router.push` d'`otp.tsx`/`totp.tsx`, `redirect` des actions 2FA, `auth.ts:413`), et ce que
   devient `createAuthRedirectMiddleware` une fois l'inscription fermée (les branches `/sign-up/email`
   et `/verify-email` deviennent-elles mortes ?). Doit-elle être dans `AUTHENTICATED_SEGMENTS` ?
   **`/bureau` lui-même n'a pas de page** : le segment n'a que des sous-dossiers et tombe sur la route
   CMS `(public)/[slug]` (« Page non trouvée »). C'est pour cela que s46 a fait pointer le lien de
   `/admin` vers `/bureau/pages` et renvoyé la destination de `/bureau` à s46b
   (`docs/plans/s46-comptes-herites-minimum.md:47`, décision G). Le critère 1 envoie le bureau sur
   `/bureau` : il faut soit une redirection de `/bureau` vers un écran existant (`/bureau/pages`,
   première entrée de `BureauSidebar`), soit viser directement cet écran.
5. **Le paiement en plusieurs fois, mode invité** : il crée des comptes par `createGuestUser`. Faut-il
   retirer ce mode (le paiement passe alors par `getAuthenticatedUser`, qui échoue si le compte
   n'existe pas), ou le garder sous une autre forme ? La story dit seulement que ce chemin « ne change
   pas ».
6. **`loginProviderAction`** : la retirer avec `/register` (son seul appelant), ou la garder pour la V2
   de Google ? Si elle reste, elle est appelable sans écran tant que `NEXT_PUBLIC_AUTH_METHODS`
   contient `google`, ce qui est le **défaut du schéma** (`env-schemas.ts:180-185`) et d'`init-env`.
   Faut-il retirer `google` de ces défauts ?
7. **`ci.yml:76-77`** : sans `/register`, la surcharge du job e2e (`google,apple,github` et
   `REQUIRE_EMAIL_VERIFICATION=true`) n'a plus de justification. Peut-on revenir à l'environnement
   global du job `qualite` ? L'effet de `REQUIRE_EMAIL_VERIFICATION` sur les autres specs est NON
   VÉRIFIÉ.
8. **`/register` dans `SIGN_IN_SEGMENTS`** (donc dans `robots.txt`) : garder l'interdiction (sans
   danger pour une route en 404) ou la retirer (trois tests changent : `robots.test.ts:84, 125`,
   `seo.spec.ts:256`) ? Statut HTTP réel de `/register` une fois la page retirée : une adresse à un
   segment pourrait tomber sur la page CMS de repli (`(public)/[slug]`, ADR 013 : 200 « Page non
   trouvée »), pas sur un vrai 404. NON VÉRIFIÉ ; le critère 3 exige un 404.
9. **Hôte sans association** (hôte de la plateforme) : refuser à tous sauf au SuperAdmin, comme le dit
   le critère 2. Où atterrit alors le SuperAdmin, et quels comptes se connectent aujourd'hui sur cet
   hôte en e2e (`locale-unique.spec.ts:118` utilise `localhost`, qui est le domaine de A, pas un hôte
   sans association) ?
10. **Rôle global `admin`** (`admin@`, `admin-owner@`) : il n'est pas SuperAdmin et n'est pas exempté.
    Il arrive selon son rôle dans l'association du domaine. Est-ce voulu jusqu'à s47, qui retire ce
    rôle ?
11. **Comment prouver le contrôle pour la double authentification** : le seed n'a aucun compte avec la
    2FA active. Le critère se contente du test unitaire « appelé tel que l'appellent les quatre
    modes » ; reste à dire comment ce test reproduit le `context` de chaque mode, y compris la double
    exécution de la 2FA.
12. **Ménage associé, dans ou hors périmètre ?** Le second webhook `@deprecated`
    (`src/app/api/webhooks/stripe/route.ts`), `createUserService` (code mort), le paquet
    `@better-auth/api-key` (reporté de s46), le lien `sendGuestAccessEmail` vers
    `/account/billing/subscription`, et les liens OTP construits sur `NEXT_PUBLIC_APP_URL`
    (`auth.ts:141`).
