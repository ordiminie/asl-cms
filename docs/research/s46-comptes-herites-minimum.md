# Research — Story s46-comptes-herites-minimum

> Recherche **reprise le 2026-10-13** sur `main` à `02dbbc4` (s44 fusionnée en PR 39, s45 en PR 40). Elle
> remplace celle du 7 octobre, écrite avant ces deux fusions et avant la réécriture de la story
> (sécurité seule, connexion limitée au domaine pour quatre modes, Google sans inscription,
> `/dashboard` devenu espace membre). Tout ce qui suit a été relevé **en ouvrant les fichiers** ;
> « NON VÉRIFIÉ » marque ce qui ne l'a pas été. `docs/reviews/stories.md` : `Stories ready: yes`.
> Ordre d'exécution : s44 ✓ → s45 ✓ → **s46** → s47 → s12b.

## Target story

**s46-comptes-herites-minimum — Ne garder que l'essentiel du compte.** Hors du tableau de périmètre du
PRD. Complexité 4. Dépend de s03, s03b, s43 (livrées) et s45 (livrée). Voie de retour : `git revert`,
`upstream/main` (ADR 009). Aucune migration.

Critères d'acceptation (condensés ; texte complet : `docs/stories.md` § s46) :

1. `/account` ne propose que la sécurité (email, mot de passe, double authentification, sessions) ;
   `/account/{settings,api-keys,notifications,organizations,invitations,billing}` et `/team/…`
   répondent 404, aucun menu n'y renvoie.
2. `/dashboard` devient l'espace membre : nom de l'association et lien vers `/account`, rien du tableau
   de bord du boilerplate ; sans session, redirection vers la connexion comme aujourd'hui.
3. Après connexion, **quel que soit le mode** : bureau ou Présidence de l'association du domaine →
   `/bureau` ; SuperAdmin → `/admin` (même s'il a aussi un rôle dans l'association) ; membre
   propriétaire → `/dashboard`.
4. Le menu de `/admin`, sur le domaine d'une association, propose au SuperAdmin un lien vers `/bureau`,
   sans nouvelle connexion.
5. **Un compte ne se connecte que sur le domaine d'une association dont il est membre**, pour les
   quatre modes (mot de passe, lien magique, double authentification, Google) ; même message qu'un
   compte inconnu ; **test d'accès croisé entre deux associations pour chaque mode** ; le SuperAdmin
   fait exception.
6. Inscription libre fermée : `/register` en 404, création de compte par mot de passe refusée par le
   serveur d'authentification, test qui constate qu'aucun utilisateur n'est créé.
7. Un lien magique pour une adresse inconnue ne crée aucun compte (déjà fait par s03, gardé par un test).
8. Google reste proposé, sans création de compte ; Apple et GitHub ne sont plus proposés ni configurés.
9. Les familles `apikey`, `organization`, `invitation`, `subscription`, `notifications` quittent
   `NEXT_PUBLIC_ENABLED_PAGES` (schéma, `.env.development`, CI).
10. `DEFAULT_LOCALE` de `src/lib/helper/date-helper.ts` vaut `fr`, vérifié par un test.
11. Aucune règle de `.claude/rules/` (ni copie `.cursor`) ni note de story ne cite un écran ou un
    fichier retiré (`rule-form-front.md`, notes de s16…) ; `pnpm check:rules` passe.

## Current state of the code

### Le compte aujourd'hui

- **`/account`** (`src/app/[locale]/(app)/account/page.tsx`, `withAuth`) : titre, puis
  `UserSecurityFactorSection` (`src/components/features/user/security-section.tsx`), qui n'affiche que
  la sécurité, sous conditions d'`AuthClientAppConfig` : `ChangeEmailForm`, `ChangePasswordForm`,
  `TwoFactorForm`, `ListTokensSection` (**sessions** actives, pas des clés d'API). Test colocalisé
  `account/page.test.tsx`, qui mocke la section : **reste valide**.
- **`/account/settings`** : `EditUserSettingsForm` (`edit-user-settings.tsx`) — langue, canal de
  notification, notifications email/push, digest, marketing. Le champ thème est parti (s45). **Toujours
  présent**, ainsi que son test.
- **`updateUserSettingsAction`** (`src/components/features/user/action.ts:161`) **ne peut pas partir avec
  l'écran** : `two-factor-form.tsx:142` l'appelle pour le type de double authentification, et
  `loginCredentialAction` lit `user.settings?.twoFactorType` (`action.ts:136, 169`) pour choisir
  OTP ou TOTP.
- Lecteurs de `user_settings` hors de l'écran : `notification-service.ts:90-93` (langue, défaut `fr`),
  `:190-191` (email activé, canal `both` par défaut), `admin/users/user-detail-form.tsx:552, 563`
  (affichage). Sans écran de réglages, les défauts s'appliquent : rien ne casse.
- Il n'existe **aucun écran de profil** (retiré en s12a).

### Inventaire de `(app)` (`git ls-files`)

`layout.tsx`, `loading.tsx`, `forbidden.tsx`, `dashboard/page.tsx`, `team/[slug]/page.tsx`,
`account/{page,page.test,loading}`, `account/settings`, `account/api-keys`, `account/notifications/*`
(4), `account/organizations/*` (3), `account/invitations/*` (6), `account/billing/subscription/*` (3).
Rien d'autre.

### Ce qui ne sert qu'aux écrans à retirer

| Élément                                                                                            | Seul importeur                                        | Remarque                                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `features/api-key/`                                                                                | `account/api-keys/page.tsx`                           |                                                                   |
| `features/dashboard/dashboard.tsx`                                                                 | `dashboard/page.tsx`                                  | **maquette statique** (données en dur, recharts), ne lit rien     |
| `features/notifications/*` (5), `app/dal/notification-dal.ts`, `hooks/use-unread-notifications.ts` | `notifications-content.tsx`, `nav-user.tsx`           | le **service** de notifications reste (emails d'authentification) |
| `team-switcher.tsx`                                                                                | `app-sidebar.tsx`                                     |                                                                   |
| `features/team/team-page-content.tsx`                                                              | `team/[slug]/page.tsx`, `organizations/[id]/page.tsx` | pousse vers `/dashboard` (l. 109)                                 |
| `hooks/use-subscription.ts`                                                                        | `nav-user.tsx` (+ 2 tests qui le mockent)             | dépend d'`OrganizationProvider`                                   |
| `features/subscription/limit-reached.tsx`                                                          | **aucun**                                             | code mort déjà (lien l. 123)                                      |
| `register-form.tsx`                                                                                | `(auth)/register/page.tsx:41`                         |                                                                   |
| `register-magic-link-form.tsx`                                                                     | `register-form.tsx:37, 247`                           | `registerMagicLinkAction` (`action.ts:418`) ne sert qu'à lui      |
| `QuickFeedbackButton`                                                                              | `(app)/layout.tsx`                                    | son action alimente `/admin/submissions` (conservé)               |

### Ce qui ne doit **pas** partir (l'ancienne recherche se trompait ou était incomplète)

- **`features/organization/*` en entier** : `organization-members-table.tsx` est importé par
  `admin/organizations/[id]/edit/page.tsx:12` ; il tire `cancel-invitation-button`,
  `edit-member-role-dialog`, `organization-add-member-form`, `remove-member-button` et deux composants
  d'`admin/organizations/` ; `organization/action.ts` est importé par `admin/organizations/actions.ts:7`.
- **`app/dal/organization-dal.ts`** : utilisé par `admin/organizations/organizations-content.tsx`,
  `admin/organizations/[id]/edit/page.tsx` et la table des membres. `lib/helper/organization-helper.ts`
  reste avec lui.
- **`app/dal/subscription-dal.ts`** : `/admin/plans`, `/admin/subscriptions`, `lib/stripe/stripe-utils.ts:3`.
- **`nav-application.tsx` n'est pas orphelin** : `admin-sidebar.tsx:18, 103` le monte ; son entrée
  « Application (front office) » vise `/dashboard` (`admin-sidebar.tsx:85-89`) et son menu déroulant
  porte **cinq liens vers des écrans retirés** (`nav-application.tsx:44-73`).
- **`AppBreadcrumb`** : importé aussi par `admin/layout.tsx:6`.
- **`src/lib/helper/date-helper.ts`** : six composants de `/admin` + `list-tokens-section.tsx` (conservés).
- Plugins Better Auth : `organization()` sert le modèle du tenant (seul le chemin d'email d'invitation
  `/account/invitations/{id}` meurt) ; `stripe()` ; `apiKey()` et `bearer()` n'ont plus d'écran
  (voir questions).

### La coquille `(app)`

`(app)/layout.tsx` monte `AuthProvider`, `OrganizationProvider`, `OrganizationSync`, `SidebarProvider`,
`AppSidebar`, `AppBreadcrumb`, `QuickFeedbackButton` (plus de `UserPreferencesSync` depuis s45).
`OrganizationProvider`/`OrganizationSync` ne sont montés **que là** ; leurs consommateurs
(`useOrganization`) : `app-sidebar`, `team-switcher`, `team-page-content`, `subscription.tsx`,
invitations, `use-subscription`. Une fois ces écrans retirés, il ne reste que `app-sidebar`. Tests :
`context/__tests__/organization.test.tsx`, `noindex-layouts.test.ts:26-34` (mocks).

Entrées de menu vers des routes retirées :

- `app-sidebar.tsx` : `/account/settings` (l. 60), `/account/api-keys` (70), `/account/organizations`
  (80), `/account/invitations` (90), `/dashboard` (105), `/account/billing/subscription` (118), des
  entrées `#`, le `TeamSwitcher` ;
- `nav-user.tsx` : `/account/billing/subscription` (l. 80/86/112), `/account/api-keys` (105),
  `/account/settings` (111), `/account/notifications` (129) ;
- `nav-user-admin.tsx` : `/account/settings` (l. 79) ;
- `admin-sidebar.tsx:87` et `nav-application.tsx:47-72` (ci-dessus).

### La connexion aujourd'hui — serveur d'authentification

Better Auth **1.7.1**. `src/lib/better-auth/auth.ts` :

- `emailAndPassword` (l. 74-86) : **pas de `disableSignUp`**. L'option existe
  (`@better-auth/core/dist/types/init-options.d.mts:665`) et est appliquée par
  `better-auth/dist/api/routes/sign-up.mjs:145` (`BAD_REQUEST`, `EMAIL_PASSWORD_SIGN_UP_DISABLED`).
- `socialProviders` (l. 126-132) : **seul `google`** (`prompt: 'select_account'`). Pas de
  `disableSignUp`/`disableImplicitSignUp` (options existantes : `core/dist/oauth2/oauth-provider.d.mts:
238, 242, 339, 343`, appliquées par `callback.mjs:229` et `link-account.mjs:201-206`). **Apple et
  GitHub n'ont aucune configuration serveur** (ni bloc, ni variable `APPLE_*`/`GITHUB_*`) : ils n'existent
  que dans l'enum `AuthMethodSchema` (`env-schemas.ts:11-17`), les types d'`action.ts:365-373, 495-497`,
  `register-form.tsx:68-69, 177-221`, `messages/fr.json` (l. 591-601, 654-658) et `ci.yml:76`.
- `account.accountLinking: {enabled: true}` (l. 87-91), `trustedProviders` absent.
- Plugins : `bearer()`, `apiKey()`, `twoFactor(...)`, `magicLink(magicLinkOptions)`, `admin()`,
  `organization({... allowUserToCreateOrganization: false, sendInvitationEmail})`, `stripe(...)`.
- `disabledPaths: ['/sign-in/magic-link']`. Pas de `baseURL` : Better Auth lit `env.BETTER_AUTH_URL`.
  `trustedOrigins` est une **fonction par requête** (`trustedOriginsOf`, `association-origin.ts:76`,
  ADR 022). Cookie de session **propre à l'hôte** (aucun `crossSubDomainCookies`).
- `databaseHooks.session.create.before` (l. 325-333) : `async (session: {userId: string})` — **un seul
  paramètre**, ne contrôle que le bannissement (`APIError('FORBIDDEN', buildBannedMessage(user))`).
- `hooks.after: createAuthRedirectMiddleware()` (l. 383-418) : `/sign-up*` avec nouvelle session →
  `/verify-request` (l. 401-404) ; `/sign-out` → `/login` ; `/verify-email` avec nouvelle session →
  **`/dashboard` en dur (l. 415)** ; la branche `/sign-in/email` est commentée (l. 395-398).
- `databaseHooks.user.create.after` (l. 310) : crée l'organisation personnelle, envoie l'email interne et
  déclenche l'email de suivi Inngest (`welcome-follow-up-email.tsx:58`, lien `/dashboard`).

`src/app/[locale]/(auth)/action.ts` (633 lignes) — les six destinations de la story sont **exactes** :

| Ligne            | Action                                               | Ouverture de session                                                                                    |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 78-184           | `loginCredentialAction`                              | `auth.api.signInEmail({body: {…, callbackURL: '/dashboard'}})` (l. 139-146) — **sans `headers`**        |
| 208-250          | `requestMagicLinkAction`                             | `signInMagicLink({headers, body: {callbackURL: '/dashboard', …}})` (l. 235)                             |
| 365-413          | `loginProviderAction(provider)`                      | `signInSocial({headers, body: {provider, callbackURL: '/dashboard'}})` (l. 390)                         |
| 418-490          | `registerMagicLinkAction`                            | `callbackURL '/dashboard'` (l. 472) ; demande un lien pour une adresse **inexistante**                  |
| 255-360, 495-513 | `registerCredentialAction`, `registerProviderAction` | `signUpEmail` (sans headers) ; `registerProviderAction` délègue à `loginProviderAction`                 |
| 525-574          | `verifyBackupCodeAction`                             | `redirect('/dashboard')` (l. 552)                                                                       |
| 579-633          | `verifyOTPAction`                                    | `verifyTwoFactorOTP({headers, body: {code, trustDevice: true}})` puis `redirect('/dashboard')` (l. 612) |

S'y ajoutent `verify-request/otp/otp.tsx:99` et `totp/totp.tsx:72` (`router.push('/dashboard')`),
`auth.ts:415`, `accept-invitation-form.tsx:73`, `team-page-content.tsx:109`.

**Aucune de ces actions ne résout le tenant** : `getCurrentTenantDal` n'est jamais importé dans
`action.ts`.

**Oracles d'existence.** `loginCredentialAction` renvoie `t('userNotFound')` pour une adresse inconnue
(l. 115-122) et `t('invalidCredentials')` pour un mauvais mot de passe (l. 151) : deux messages
distincts. `registerMagicLinkAction` renvoie `emailAlreadyUsed`. La story exige « le même message qu'un
compte inconnu ».

### Ce qui vérifie l'appartenance aujourd'hui

- **Lien magique, à la demande seulement.** `sendMagicLink` (`magic-link-integration.ts:162-200`) résout
  l'association par le domaine (`requestHostOf` → `normalizeTenantHost` →
  `getOrganizationByDomainService`, l. 95-104), puis `if (!user || !isMemberOf(user, organization))
return` (l. 189-190) : rien n'est envoyé, rien n'est visible. `isMemberOf` (l. 223-229) est
  **privée**, ne regarde pas le rôle et **n'exempte pas le SuperAdmin**.
- **Rien ne revérifie à l'ouverture du lien** (`/magic-link/verify`). Un jeton déjà émis pour un compte
  existant non membre ouvrirait une session — déduit du code, non prouvé par un test.
- **Mot de passe, double authentification, Google** : aucune vérification.
- Rien dans `(app)` ne vérifie non plus l'appartenance au tenant (`docs/research/s12d-comptes-membres.md`
  l. 114-120 le signale : un titulaire de session sans ligne `member` atteint `/dashboard`).

### Le point commun à tous les modes

`databaseHooks.session.create.before(session, context)` — `core/dist/types/init-options.d.mts:1287` :
`(session, context: GenericEndpointContext | null) => Promise<boolean | void | {data}>`, « si le hook
renvoie `false`, la session n'est pas créée ». Il est appelé par `internalAdapter.createSession`
(`db/internal-adapter.mjs:248`, via `createWithHooks`, `db/with-hooks.mjs:6-23` : `false` → `null`, une
exception se propage). Il couvre **mot de passe, lien magique, callback Google, vérification 2FA
(OTP, TOTP, code de secours)** — mais aussi la vérification d'email, l'activation de la 2FA, les
sessions d'**imitation** du plugin `admin` (`admin/routes.mjs`).

Comportement quand la session est refusée, par mode :

- mot de passe : `UNAUTHORIZED FAILED_TO_CREATE_SESSION` (`sign-in.mjs:354-356`) ; une `APIError` levée
  dans le hook montre son propre message (c'est ce que fait le bannissement) ;
- lien magique : `redirectWithError("failed_to_create_session")` → `errorCallbackURL`
  (`magic-link/index.mjs:182-183`) ;
- Google : `{error: 'unable to create session'}` puis redirection avec erreur
  (`oauth2/link-account.mjs:268-272`) ;
- 2FA : `FAILED_TO_CREATE_SESSION`, HTTP 500 (`two-factor/verify-two-factor.mjs:31-35`).

**Pour un compte à double authentification**, la session est créée puis **détruite** à la vérification
du mot de passe (`two-factor/index.mjs:276-286`), puis recréée à la vérification du code
(`verify-two-factor.mjs:31`) : le hook se déclenche deux fois, dont une avant toute connaissance de la
2FA. Avec le cookie « appareil de confiance » (`trustDevice: true`), la 2FA est sautée.

**Résoudre le domaine dans le hook.** `context` est `null` hors d'un appel de point d'entrée ; sinon il
porte `headers`/`request.headers` (`internal-adapter.mjs:249-252` les lit pour l'IP). **Piège :
`loginCredentialAction` n'envoie pas `headers`** à `signInEmail` (l. 139) : le domaine n'est lisible que
si l'action les ajoute. Les autres actions les passent ; le callback de lien magique et celui de Google
sont des GET de navigateur dont `request.headers` est celui du domaine appelé.
`tenant-dal.ts` (`server-only`, `next/headers`, `'use cache'` jusqu'à une heure) **n'est pas utilisable
dans le hook** ; le motif existant est `getOrganizationByDomainService(normalizeTenantHost(
requestHostOf(headers)))` (`magic-link-integration.ts:95`, `trustedOriginsOf`). Better Auth ne fait
confiance à `x-forwarded-host` qu'avec `advanced.trustedProxyHeaders`, **non activé** (ADR 022, « à
vérifier en s12b ») ; `requestHostOf` le lit quand même.

### Google, plusieurs domaines

- L'URI de retour est `${baseURL}/api/auth/callback/google` (`sign-in.mjs:230`, `oauth2/utils.mjs:29`),
  avec `baseURL` = `BETTER_AUTH_URL` : **toujours l'hôte de la plateforme**. Le cookie étant propre à
  l'hôte, une session ouverte par Google le serait **sur la plateforme, pas sur le domaine de
  l'association**. `redirectURI` est surchargeable par fournisseur (`oauth-provider.d.mts:291`), non fait.
- **Aucun écran ne propose Google.** `/login` est l'écran du lien magique, `/login/prestataire` celui du
  mot de passe ; `login.test.tsx:25` affirme l'absence de Google/Apple/GitHub. Le seul appelant de
  `loginProviderAction` est `registerProviderAction`, appelé par `register-form.tsx:95` — c'est-à-dire
  `/register`. **Fermer `/register` supprime la connexion Google de l'application.**
- L'ADR 022 ne traite que le lien magique et la session ; aucun document ne décrit un « domaine commun
  d'authentification » (`docs/research/s03c-*`, ADR 003 : rien). Seules traces : `docs/stories.md:1293-1296`
  (s12b : « Connexion Google sur chaque domaine (reporté de s46) ») et la note de s46.
- `NEXT_PUBLIC_AUTH_METHODS` : défaut `'credential,magiclink,google'` (`env-schemas.ts:190-195`, pas de
  validation par valeur, simple cast) ; `.env.development`, `.env.test` : `credential,magiclink` ;
  `ci.yml:42` idem, mais **`ci.yml:76` (job e2e) : `credential,magiclink,google,apple,github`** ;
  `scripts/init-env.ts:166` défaut `credential,magiclink,google`. Lecteurs : `action.ts:85, 262, 378,
425, 501`, `auth-helper.ts:4`, `register-form.tsx:64-69`, `reset-password/page.tsx:34`.
  Variables serveur : seulement `GOOGLE_CLIENT_ID/SECRET` (`env-schemas.ts:115-116`).

### Le rôle dans l'association du domaine appelé

- `canManageAssociation(user: User | undefined, organizationId: string): boolean`
  (`association-authorization.ts:21-33`) : vrai pour `super_admin`, ou pour une appartenance de
  `user.organizations` portant `organizationId` et un rôle de `BOARD_ROLES` = `owner`/`board`.
  **Elle renvoie vrai pour le SuperAdmin sur tout tenant** : il faut tester `super_admin` **avant**.
- `UserOrganizationRoleConst` : `OWNER 'owner'`, `ADMIN 'board'`, `MEMBER 'member'`
  (`auth-types.ts:43-47`). `RoleConst` : `public`, `user`, `redactor`, `moderator`, `admin`,
  `super_admin`. `isAdmin(user)` (`auth-util.ts:47`) accepte **`admin` ou `super_admin`**.
- `getUserByIdDao` (`user-repository.ts:39-67`) charge `members` avec leur `organization` ; le
  `session.user` de `customSession` est ce résultat complet (`user.organizations[i]` : au moins
  `organizationId`, `role`).
- `/admin` : `withAuthAdmin` = `withAuth(…, RoleConst.ADMIN)` ; passent aussi `admin@gmail.com` (rôle
  global `admin`) et `super_admin`. De nombreuses actions d'`/admin` acceptent `[ADMIN, SUPER_ADMIN]`.
- `/bureau` : le layout `(bureau)` résout le tenant par `requireCurrentTenantDal()` et garde par
  `canManageCurrentAssociationIdentityDal()` → `canManageAssociation`. **Le cookie étant propre à
  l'hôte, `/admin` et `/bureau` d'un même domaine partagent la session** : un lien simple suffit.
- `admin-sidebar.tsx` est statique et client, **non conscient du tenant** ; `data.appNavMain`
  (l. 84-90, `{name, url, icon}`) est l'endroit naturel d'un lien. Comment lui faire savoir qu'on est sur
  un domaine d'association : NON VÉRIFIÉ.

### Inscription

- **Mot de passe : ouverte** côté serveur (aucun `disableSignUp`, `/sign-up/email` hors `disabledPaths`).
- **Lien magique : fermée** (`magicLinkOptions.disableSignUp: true`, l. 205 ; `sendMagicLink` ne fait rien
  pour une adresse inconnue). Tests de s03 : `magic-link-integration.real-i18n.test.ts` l. 170, 448, 465,
  641, 652 ; `e2e/magic-link.spec.ts:391` (adresse inconnue : même écran, aucun email, `userCount == 0`).
- **Google : ouverte** (aucun `disableSignUp`).
- Qui crée des comptes sans passer par l'inscription : le **seed** (SQL direct, `seed.ts:178-194`), le
  provisioning de s01 (`organization-service.ts:704` → `createUserDao`), et s12d (`createUserDao`, écriture
  directe, **déconseille** Better Auth : `docs/research/s12d-comptes-membres.md` l. 85-101).
  `createUserFromStripeService` (`user-service.ts:337`, `auth.api.createUser`) servait le parcours d'achat
  invité retiré par s45 : **état actuel NON VÉRIFIÉ** (peut-être orphelin).

### Protection et référencement

`src/lib/routing/authenticated-segments.ts:9-15` : `AUTHENTICATED_SEGMENTS` = `/account`, `/admin`,
`/bureau`, `/dashboard`, `/team` ; `SIGN_IN_SEGMENTS` (l. 18-25) contient `/register`. Une liste, deux
usages : le proxy (`src/proxy.ts`, redirige vers `/login` sans cookie) et `robots.txt`. Tests :
`proxy.test.ts:19` (it.each qui utilise **`/account/settings`** comme exemple protégé), `robots.test.ts:4,
39, 71, 112`, `e2e/seo.spec.ts:252-256`.

### `date-helper.ts`

`src/lib/helper/date-helper.ts` : `const DEFAULT_LOCALE = 'en'` (l. 6, **non exporté**), table
`{en: enUS, fr, es}`, repli `?? enUS`, docstring périmée (« comme `routing.defaultLocale` »). Exporte
`getDateFnsLocale`, `formatDateString`, `formatDate`, `formatDistanceToNowLocalized`. **Aucun test.**
Tous les appelants passent `useLocale()` (donc `'fr'`), **aucun appelant conservé n'utilise le défaut** :
le test doit appeler les fonctions sans locale. Hors du helper, d'autres écrans conservés formatent sans
locale (`organization-members-table.tsx:145`, `file-upload.tsx:228`, `admin-dashboard.tsx:578, 633`) ou
avec `'fr-FR'` en dur (`pages-list.tsx:150`, `admin/emails/actions.ts`, `auth.ts:315`).

### Familles de `NEXT_PUBLIC_ENABLED_PAGES`

`EnabledPageSchema` (`env-schemas.ts:20-30`) : `none, apikey, organization, invitation, account,
settings, subscription, notifications, admin` (9). `PagesConst` (`env.ts:22-31`). Appels : `apikey` —
`account/api-keys/page.tsx:10`, `app-sidebar:71`, `nav-user:110` ; `organization` —
`account/organizations/page.tsx:28`, `app-sidebar:79` ; `invitation` — `account/invitations/page.tsx:10`,
`app-sidebar:87` ; `subscription` — `account/billing/subscription/page.tsx:15`, `app-sidebar:114`,
`nav-user:84, 122` ; `notifications` — `account/notifications/page.tsx:13`, `nav-user:130` ; `settings`
— `account/settings/page.tsx:10`, `app-sidebar:63`, `nav-user:116`, `nav-user-admin:76`. Valeurs :
`.env.development:42`, `.env.test:38`, `.env.local:37` (ignorés par git), `ci.yml:44`,
`scripts/init-env.ts:138-147, 268-270` (aucun test du script). `env.example` n'a pas la variable.
`src/env-schemas.test.ts:93-115` épingle aujourd'hui les neuf familles.

**`settings` n'est pas dans la liste de retrait de la story**, alors que sa seule page (`/account/settings`)
répond 404 : il resterait une famille sans page.

## Anchor points

- `src/lib/better-auth/auth.ts` : `emailAndPassword`, `socialProviders.google`, `accountLinking`,
  `databaseHooks.session.create.before` (l. 323-335), `createAuthRedirectMiddleware` (l. 383-418).
- `src/lib/better-auth/magic-link-integration.ts` : `isMemberOf` (privée), `sendMagicLink`,
  `organizationOfRequest`, `magicLinkOptions` ; `association-origin.ts` : `requestHostOf`,
  `rebaseMagicLinkUrl`, `trustedOriginsOf`.
- `src/app/[locale]/(auth)/action.ts`, `verify-request/otp/otp.tsx`, `totp/totp.tsx` : destinations.
- `src/services/authorization/association-authorization.ts`, `auth-util.ts`, `auth-types.ts` : le rôle.
- `src/app/[locale]/(app)/layout.tsx`, `app-sidebar.tsx`, `nav-user.tsx`, `nav-user-admin.tsx`,
  `admin-sidebar.tsx`, `nav-application.tsx` : la coquille et les menus.
- `src/lib/routing/authenticated-segments.ts`, `src/proxy.ts`, `src/app/robots.ts`.
- `src/env-schemas.ts`, `src/env.ts`, `.github/workflows/ci.yml`, `scripts/init-env.ts`.
- `src/lib/helper/date-helper.ts`. `scripts/check-rules.ts` (`STALE_PATTERNS`, l. 25-51).

## Verified APIs / functions

| Nom                                                     | Signature / valeur                                                                                                                   | Emplacement                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `databaseHooks.session.create.before`                   | `(session, context: GenericEndpointContext \| null) => Promise<boolean \| void \| {data}>` ; `false` = pas de session                | `@better-auth/core/dist/types/init-options.d.mts:1287` |
| `createWithHooks`                                       | `false` → `null`, objet `{data}` fusionné, exception propagée                                                                        | `better-auth/dist/db/with-hooks.mjs:6-23`              |
| `emailAndPassword.disableSignUp`                        | `boolean`                                                                                                                            | `init-options.d.mts:665` ; appliqué `sign-up.mjs:145`  |
| `disableSignUp` / `disableImplicitSignUp` (fournisseur) | `boolean`                                                                                                                            | `oauth-provider.d.mts:238, 242, 339, 343`              |
| `isMemberOf`                                            | `(user: {organizations?: {organizationId: string}[]}, organization: Organization) => boolean`, **privée**, sans rôle, sans exemption | `magic-link-integration.ts:223`                        |
| `sendMagicLink`                                         | `({email,url,token,metadata}, ctx?) => Promise<void>`                                                                                | `magic-link-integration.ts:162`                        |
| `requestHostOf`                                         | `(headers: Headers \| undefined) => string \| undefined`                                                                             | `association-origin.ts:8`                              |
| `normalizeTenantHost`                                   | `(host?: string \| null) => string \| undefined`                                                                                     | `src/lib/helper/tenant-helper.ts:11`                   |
| `rebaseMagicLinkUrl`                                    | `(url: string, origin: string) => string`                                                                                            | `association-origin.ts:56`                             |
| `trustedOriginsOf`                                      | `(request?: Request) => Promise<string[]>`                                                                                           | `association-origin.ts:76`                             |
| `canManageAssociation`                                  | `(user: User \| undefined, organizationId: string) => boolean`                                                                       | `association-authorization.ts:21`                      |
| `isAdmin`                                               | `(user?: User \| null) => boolean` (`admin` ou `super_admin`)                                                                        | `auth-util.ts:47`                                      |
| `getCurrentTenantDal` / `requireCurrentTenantDal`       | `() => Promise<TenantDTO \| undefined>` / `() => Promise<TenantDTO>` ; `server-only`, `next/headers`                                 | `src/app/dal/tenant-dal.ts:71 / :93`                   |
| `updateUserSettingsAction`                              | utilisé par `two-factor-form.tsx:142`                                                                                                | `src/components/features/user/action.ts:161`           |
| `AUTHENTICATED_SEGMENTS`                                | `readonly string[]` (5 segments)                                                                                                     | `authenticated-segments.ts:9`                          |
| `STALE_PATTERNS`                                        | `{pattern: RegExp; why: string; allow?: RegExp}[]`                                                                                   | `scripts/check-rules.ts:25`                            |

## Traps & constraints

1. **Le contrôle d'appartenance doit vivre en un seul endroit** (note de la story) : le hook
   `session.create.before` est le seul point que les quatre modes traversent. Mais il se déclenche aussi
   pour la vérification d'email, l'activation de la 2FA et l'imitation `admin` ; il reçoit `context`
   possiblement `null` ; et il ne voit le domaine que si l'appelant fournit les `headers`
   (`loginCredentialAction` ne les fournit pas).
2. **Exemption du SuperAdmin** : `isMemberOf` ne l'exempte pas, et `superadmin@gmail.com`, `moderator@`,
   `redactor@`, `public@`, `user-isolated@` n'ont **aucune appartenance** nulle part (`seed.ts:288-311`).
   L'imitation d'un utilisateur par le plugin `admin` ouvre une session sur le domaine courant.
3. **Même message que « compte inconnu »** : `userNotFound` ≠ `invalidCredentials` aujourd'hui ; une
   `APIError` levée dans le hook affiche son propre message (cas du bannissement). Pour le lien magique,
   l'indiscernabilité repose sur « ne rien envoyer » ; au clic d'un jeton existant, l'erreur arrive par
   `errorCallbackURL`.
4. **Le lien magique et Google fixent leur destination avant de savoir qui se connecte.** Une
   destination par rôle exige une **route de passage** résolue après l'ouverture de la session ; le
   `callbackURL` relatif est réécrit sur l'origine de l'association (`rebaseMagicLinkUrl`, ADR 022) et
   doit le rester. `e2e/magic-link.spec.ts:533, 536-538` épinglent `${origin}/dashboard`.
5. **`canManageAssociation` vaut vrai pour le SuperAdmin** : l'ordre de test est `super_admin` →
   `/admin`, puis propriétaire/bureau → `/bureau`, sinon `/dashboard`. Le rôle global `admin` (ex.
   `admin@gmail.com`) n'est pas SuperAdmin mais passe `withAuthAdmin` : la story ne dit pas où il arrive.
6. **`updateUserSettingsAction` et `user_settings.twoFactorType` restent** (double authentification) ; ne
   retirer que l'écran, `EditUserSettingsForm` et leurs messages.
7. **Statut HTTP des routes retirées** : ADR 013 — sous Cache Components un `notFound()` en cours de
   rendu ne change plus le statut quand une route dynamique l'absorbe. Les routes `(app)/account/*` et
   `team/*` sont à plusieurs segments, mais **le statut réel est NON VÉRIFIÉ** ; s45 a observé 200 pour
   les adresses à un seul segment. Si elles disparaissent de `(app)`, `/account/settings` tombe peut-être
   sur la route des pages du CMS (`(public)/[slug]` ne prend qu'un segment) : vraisemblablement 404, à
   éprouver.
8. **`/dashboard`** reste dans `AUTHENTICATED_SEGMENTS` (sans session : redirection vers `/login`, comme
   le dit la story) ; `/team` peut sortir de la liste, mais `robots.test.ts:4, 39` le figent. La page
   doit s'afficher pour un SuperAdmin et pour un compte **sans ligne `member`** (s12d, l. 300, 418-419).
   `/register` : retiré de la page, reste ou non dans `SIGN_IN_SEGMENTS` (robots.txt) ; `seo.spec.ts:256`.
9. **Les specs e2e à changer ne se limitent pas à `auth.spec.ts`** (la note de la story est fausse) :
   - `auth.spec.ts` : l. 20-37 (page d'inscription), 52-107 (« should successfully register »), 225-275
     (validations d'inscription) à retirer ou inverser (« `/register` répond 404, aucun utilisateur
     créé ») ; l. 109-160 (regex de destination) ; l. 42-50 reste valable. m7 = commentaires anglais du
     fichier (+ `docs/authentication-system.md` l. 392-393, **déjà revendiqué par s45**) ; **m6 n'est
     pas dans ce fichier** (c'est `DEFAULT_LOCALE`, `docs/reviews/s43-locale-unique.md:111`).
   - `authorization.spec.ts` : tout le bloc « Changement d'organisation » (l. 84+, sidebar + `TeamSwitcher`)
     à retirer ; l. 66-71 (« atteint son espace ») redevient valide.
   - `magic-link.spec.ts` : l. 358 et 442 (`/dashboard` après lien) — `user-owner@gmail.com` est la
     **Présidence de A** et arrive désormais sur `/bureau` ; l. 533-538 ; l. 549-591 (user-admin sur B,
     user-owner sur A, admin@ sur les deux : tous sur `/bureau`) ; l. 593 reste.
   - `smoke-authenticated.spec.ts` : `USER_ROUTES` (l. 21-31) et `TEAM_ROUTES` (`/team/evil-corp`, l. 33).
   - `seo.spec.ts:252-256`, `proxy.test.ts:19`, `robots.test.ts`.
     Les autres specs se connectent par mot de passe et n'attendent que de **quitter** `/login`.
10. **Les preuves d'accès croisé manquent de fixtures** : aucune e2e pour le mot de passe, la 2FA ni
    Google ; **aucun compte 2FA dans le seed** (secret TOTP : NON VÉRIFIÉ) ; aucun test ni simulacre
    OAuth. Le modèle existant est `magic-link.spec.ts:593` (`user@gmail.com` sur B). Comptes utiles :
    `user@gmail.com` (membre de A, pas de B), `user-owner@` (Présidence de A), `user-admin@` (bureau de
    B), `superadmin@` (aucune appartenance). Domaines : A = `http://localhost`, B = `http://127.0.0.1`.
    `action.test.ts` ne teste pas `loginCredentialAction`, `loginProviderAction` ni les actions 2FA.
11. **`ci.yml:76`** active `google,apple,github` pour le job e2e et `REQUIRE_EMAIL_VERIFICATION=true` : ce
    ne sont que des restes des tests d'inscription ; le commentaire l. 72-75 (« l'inscription ouvre le
    tableau de bord qui appelle Stripe ») sera faux.
12. **Chevauchement avec s47** (rôles globaux réduits, après s46) : `admin@gmail.com` sert dans
    `authorization.spec.ts:75`, `smoke-authenticated` (`ADMIN_ROUTES`), `legacy-routes.spec.ts:24`,
    `magic-link.spec.ts:576` ; s47 retouche `association-settings.spec.ts` et `auth.ts` (plugin
    `admin()`). Modifier ces tests en s46 oblige s47 à suivre.
13. **Règles et documents qui citent des écrans retirés** (le contrôle `checkCitedPaths` de
    `check-rules.ts` échoue tout seul sur un lien `](src/…)` mort) : `rule-form-front.md:51` et
    `rule-form-front-and-back.md:56` (`edit-user-settings.tsx`, « exemple vivant ») ;
    `rule-form-back.md:110, 169, 188` (`register-form.tsx`, `/dashboard`) ; `rules-ux-pagelayout.md:87,
212, 228` ; `rule-translation.md:112, 138, 143` ; `rule-ci-cd-devops.md:101` et
    `docs/e2e-testing.md:129` (`toHaveURL('/dashboard')`, valable) ; `rule-safe-route.md:62-70, 85` et
    `rule-react-cache-next-cache.md:138-140` (exemple `OrganizationProvider`/`OrganizationSync`, seulement
    si les fournisseurs partent). Copies `.cursor` aux lignes voisines. Documents hors recherche :
    `docs/authentication-system.md` (Apple/GitHub l. 11, 116-117, 454-455 ; `register-form` l. 249),
    `docs/inngest.md`, `docs/organizations.md`, `docs/architecture.md:477-479`, `docs/decisions/014:22, 90`,
    `docs/adaptation-socle-design-system.md:65`. Le contrôle de motifs périmés (`STALE_PATTERNS`) ne lit
    **ni `docs/` ni `stories.md`**.
14. **`docs/stories.md` (document de cadrage, à corriger sur `main`)** : la note de **s16**
    (`stories.md:1673`) renvoie à `edit-user-settings.tsx` ; le critère 9 de s46 ne cite pas `settings` ;
    la note « les specs n'ont pas à changer sauf `auth.spec.ts` » est fausse (point 9).
15. **Autres liens vers des routes retirées**, hors menus : `limit-reached.tsx:123` (mort),
    `stripe-events.ts:342` (`callbackURL '/account/billing/subscription'`), `notification-service.ts:239`
    et `auth.ts:164` (`/account/invitations/…`), `subscription.tsx:185-243`, `user/action.ts`
    (`revalidatePath('/account')` : valable ; `callbackURL '/account'` l. 550 : valable),
    `logout-form.tsx:40` (`/dashboard` : valable), `welcome-follow-up-email.tsx:58` (`/dashboard` : valable).
16. **Messages** (`messages/fr.json`) : espaces de noms propres aux écrans retirés — `ApiKeysPage`,
    `AccountSettingsPage`, `Invitations`, `AcceptInvitation`, `Notifications`, `NotificationsPage`,
    `Subscription`, `Dashboard`, `TeamPage`, `TeamSwitcher`, `LimitReached` ; **partagés avec `/admin`,
    à ne pas retirer sans lire** : `Organizations`, `Organization` ; conservés : `AppSidebar`, `NavUser`,
    `AccountPage` (titre, description, section sécurité), `UserSecuritySection.*`. Des clés peuvent être
    passées en variable : NON VÉRIFIÉ. Les sous-systèmes déjà retirés par s01 (`Projects`, `Chat`,
    `Credits`, `Tasks`, `Affiliate`…) sont toujours là, hors périmètre.
17. **Rien en dur (ADR 010)** : `/bureau`, `/admin`, `/dashboard` sont des routes du produit, pas des
    paramètres d'association. `getDb()`/`withTenant` : les lectures du tenant et de `member` passent par
    des services existants ; l'ADR 014 exempte `member` de la RLS (lue entre tenants). La RLS n'est pas
    testable en unitaire : les accès croisés se prouvent en e2e.

## Open questions

1. **Google.** (a) Aujourd'hui **aucun écran ne le propose** hors `/register` : fermer `/register` le
   retire de fait. Faut-il **ajouter un bouton** sur une page de connexion, ou **retirer Google** comme
   Apple et GitHub ? (b) S'il reste, son URI de retour et la session qu'il ouvre sont ceux de
   **l'hôte de la plateforme**, pas du domaine de l'association : `redirectURI` par domaine (console
   Google à autoriser pour chaque domaine), ou domaine commun d'authentification (aucune base dans les
   ADR). La story reporte l'analyse à ce plan et à s12b. Le critère 8 et le critère 5 (« sur le domaine
   de son association ») ne peuvent pas être tenus ensemble avec la configuration actuelle.
2. **Où et comment faire le contrôle d'appartenance** : dans `session.create.before` (avec exemption du
   SuperAdmin, `headers` ajoutés à `signInEmail`, comportement quand `context` est `null`), en excluant
   ou non l'imitation `admin`, la vérification d'email et la réactivation 2FA ? Que faire d'un hôte qui ne
   sert aucune association (hôte de la plateforme) : refus pour tous sauf SuperAdmin ?
3. **Comment obtenir « le même message qu'un compte inconnu »** pour le mot de passe : supprimer le
   message `userNotFound`, et traduire le refus du hook en `invalidCredentials` ? Et à l'ouverture d'un
   lien magique émis avant le changement ?
4. **La route de passage** : adresse (non nommée par la story), qui l'appelle (`callbackURL` des quatre
   modes + `router.push` d'OTP/TOTP + `auth.ts:415`), et que devient `createAuthRedirectMiddleware`
   (branches mortes une fois l'inscription fermée) ?
5. **Le rôle global `admin`** (hors SuperAdmin) : où arrive `admin@gmail.com` après connexion (`/admin`
   puisqu'il le passe, `/bureau`, `/dashboard`) ? Peut-il se connecter sur n'importe quel domaine
   (exemption) ? À arbitrer avec s47.
6. **`settings`** : retirer la famille de `NEXT_PUBLIC_ENABLED_PAGES` avec les cinq autres ? (la story ne
   la cite pas ; `/account/settings` répond 404).
7. **`OrganizationProvider`/`OrganizationSync`, `QuickFeedbackButton`, `AppSidebar`** : que garde la
   coquille `(app)` quand `/account` est le seul écran de compte ? Un menu à une entrée justifie-t-il la
   barre latérale ? (touche `rule-safe-route.md` et `rule-react-cache-next-cache.md`.) Où vit le lien
   « Sécurité » de l'espace membre ?
8. **Plugins Better Auth sans écran** : retirer `apiKey()`/`bearer()` (la note laisse le choix) ? Le chemin
   d'email d'invitation d'organisation (`auth.ts:164`, `notification-service.ts:239`) pointe vers un écran
   retiré mais l'organisation reste utilisée par le tenant.
9. **`createUserFromStripeService`** (`user-service.ts:337`) et le crochet `user.create.after` : encore
   atteignables après s45/s46 ? À vérifier au plan.
10. **Preuves d'accès croisé** : comment éprouver la double authentification (aucun compte 2FA dans le
    seed) et Google (aucun simulacre) ? Test e2e, test de service sur le hook, ou les deux ?
11. **Le lien `/bureau` du menu de `/admin`** : comment la barre latérale statique apprend-elle qu'on est
    sur un domaine d'association, et que devient le lien sur l'hôte de la plateforme (aucun tenant) ?
12. **Taille.** Complexité 4, mais le périmètre touche l'authentification (inscription, contrôle de
    domaine, destination), la suppression d'une dizaine d'écrans, quatre menus, une dizaine de specs et
    des règles. Le plan dira s'il faut scinder (par exemple : retraits d'écrans d'un côté,
    authentification de l'autre).
