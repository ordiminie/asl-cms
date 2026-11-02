# Research — Story s48-connexion-a-la-place

État du code lu sur `main` au commit `f63eb200` (s14 mergée, s48 ajoutée au découpage). Chaque nom de
fichier, de fonction ou de numéro de ligne ci-dessous a été ouvert, y compris dans
`node_modules/better-auth` (version installée **1.7.1**, `package.json:89` et
`node_modules/better-auth/package.json:3`) ; rien n'est cité de mémoire.

`docs/reviews/stories.md` se termine par `Stories ready: yes` (l. 178). La story s48 est marquée
**hors du tableau de périmètre du PRD**, ajoutée hors revue le 28/10/2026 (arbitrage de
l'utilisatrice) : elle n'a pas été relue par le stories-reviewer.

## Target story

**s48 — Agir à la place d'un compte, en garde-fou** (complexité 3, dépendances s03, s03c, s12d, s14,
s46b, s47 — toutes livrées).

En tant que SuperAdmin Zourite Studio, se connecter à la place de n'importe quel compte d'une
association, sans son mot de passe, pour réaliser en son nom une action qu'il ne peut pas ou plus
faire (passer la présidence, nommer le bureau, corriger sa fiche).

Critères d'acceptation :

1. Depuis l'écran SuperAdmin des membres d'une association, le SuperAdmin choisit un compte et ouvre
   une session à sa place, **sur le domaine de cette association**, sans mot de passe ni lien
   magique ; il voit et fait exactement ce que ce compte voit et fait.
2. Une **bannière permanente, sur toutes les pages**, dit à la place de qui il agit et permet d'en
   sortir ; la sortie rend la session SuperAdmin d'origine.
3. Seul `super_admin` peut ouvrir une telle session, côté interface **et** côté serveur ; un compte
   `user`, quel que soit son rôle d'association, est refusé — prouvé par un test, **y compris par un
   appel direct à la route HTTP du plugin**.
4. Pas d'imitation d'un autre SuperAdmin, pas d'enchaînement de deux sessions à la place.
5. Chaque ouverture et chaque sortie sont tracées (SuperAdmin, compte visé, association,
   horodatage) dans une table scopée `organization_id`, RLS forcée, test d'accès croisé.
6. Une écriture faite pendant la session est **attribuée au SuperAdmin** dans les traces existantes
   (au minimum `member_role_event` de s14 et `incident_report_event` de s10), et la trace dit pour le
   compte de qui il a agi.
7. La session expire d'elle-même (**durée paramétrée, pas en dur**) et ne permet pas de changer le
   mot de passe, l'adresse email ni la double authentification du compte visé.
8. La table de trace entre dans l'inventaire des tables scopées (`docs/architecture.md`,
   `src/db/rls-inventory.test.ts`) ; s38 l'exportera ou la déclarera exclue.

À ne pas confondre avec **s41-simulation-role** (`docs/stories.md:2900`) : s41 navigue avec les droits
**d'un rôle**, sans personne derrière, et dépend de s37/s38/s39 ; s48 agit **en tant qu'une personne
précise**. Les deux partagent la bannière et le piège d'attribution ; la note de s48 prévoit de revoir
s41 (fusion ou retrait) à sa recherche.

Règle transverse posée par l'arbitrage : aucune règle métier ne limite le SuperAdmin acteur.

## Current state of the code

### La brique Better Auth, montée et inutilisée

- `src/lib/better-auth/auth.ts:177-180` : `admin({adminRoles: ['super_admin'], roles: {user: userAc,
super_admin: adminAc}})`. Aucune option d'imitation (`impersonationSessionDuration`,
  `allowImpersonatingAdmins`) n'est passée.
- `src/lib/better-auth/auth-client.ts` : `adminClient()` est monté, donc
  `authClient.admin.impersonateUser` / `stopImpersonating` existent côté navigateur.
- `disabledPaths` (`auth.ts:68-71`) = `MAGIC_LINK_DISABLED_HTTP_PATHS` +
  `ORGANIZATION_MEMBERSHIP_DISABLED_HTTP_PATHS` (`organization-roles.ts:44-52`). **Aucune route
  `/admin/*` n'est fermée** : `/api/auth/admin/impersonate-user` et `/admin/stop-impersonating` sont
  ouvertes aujourd'hui.
- `src/db/models/auth-model.ts:55` : `session.impersonatedBy: text('impersonated_by')` (créée par
  `drizzle/migrations/0000_calm_maddog.sql:196`). Type `text`, **sans FK** vers `user`.
- `grep -ri impersonat src e2e` ne trouve que cette colonne : aucun code ni test ne l'utilise.
- Plugins dans l'ordre (`auth.ts:144-302`) : `associationSessionGuard()` en tête (ADR 034), `bearer`,
  `twoFactor`, `magicLink`, `admin`, `organization`, `stripe`, puis `customSession` et `nextCookies()`
  en dernier (`auth.ts:303-316`).
- `session.cookieCache` activé, `maxAge: 5 * 60` (`auth.ts:74-79`).
- `databaseHooks.session.create.before` de la configuration (`auth.ts:347-357`) : refus d'un compte
  banni (`buildBannedMessage`) — redondant avec celui du plugin `admin()`.

### Session et identité côté projet

- `customSession` (`auth.ts:306-313`) relit le compte de `session.userId` par `getUserByIdDao` et rend
  `{user: fullUser, session}` : la `session` d'origine est transmise telle quelle, donc
  `session.impersonatedBy` y est.
- `getAuthUser()` (`src/services/authentication/auth-service.ts:24-33`) : `getSessionAuth()` puis
  rejoue `canOpenSessionOn(session.user, organisation du domaine)` (ADR 038) et rend
  **`session.user` seul**. L'information `impersonatedBy` est perdue à ce niveau : aucun appelant ne
  peut savoir qu'il agit pour le compte d'un autre.
- `getSessionAuth()` (`auth-service.ts:35-40`) rend la session complète (`session.session.impersonatedBy`
  disponible), mise en cache `cache()` par requête.
- `getCurrentUserDal()` (`src/app/dal/user-dal.ts` § « SESSION COURANTE ») : `'use cache: private'`,
  `cacheLife('minutes')` (stale 5 min, revalidate 1 min), rend `{user, activeOrganization}` — pas
  `impersonatedBy`.
- `requireActionAuth()` (`user-dal.ts:47-66`) et `withAuth`/`withAuthAdmin` passent par
  `getAuthUser()`. `isUserAdmin` ne reconnaît que `super_admin` (ADR 035) : **pendant l'imitation, le
  compte vu est `user`, donc `/admin` est refusé** au SuperAdmin tant qu'il n'est pas sorti.

### Règle d'ouverture de session (ADR 034 / 038)

- `associationSessionGuard` (`src/lib/better-auth/association-session-guard.ts`) : hook
  `databaseHooks.session.create.before` d'un plugin local en tête ; lit le compte de
  `session.userId`, l'hôte dans `context.headers ?? context.request?.headers`, et refuse (`false`)
  si `!canOpenSessionOn(user, organisation)`.
- `canOpenSessionOn` (`association-membership.ts`) : `super_admin` partout, sinon ligne `member` dans
  l'association du domaine ; domaine sans association → SuperAdmin seul.
- L'ADR 034 dit explicitement : le contrôle s'applique à **toute** création de session, « imitation
  comprise », sans exemption ; « le SuperAdmin peut la faire sur le domaine de l'association visée ».

### Domaines et cookies (ADR 022, s03c)

- Cookie de session **propre à l'hôte** (pas de `crossSubDomainCookies`, ADR 022 décision 5). Une
  session ouverte sur `localhost` n'existe pas sur `127.0.0.1`.
- `src/app/[locale]/layout.tsx` : `requireCurrentTenantDal()` — un domaine sans association ne rend
  rien ; « tout domaine servant l'application doit être provisionné, back-office du prestataire
  compris ». Le SuperAdmin travaille donc sur un domaine d'association (dans le seed : `localhost` =
  TechCorp Solutions, `127.0.0.1` = Marketing Pro, cf. `e2e/member-roles.spec.ts:21-32`). Il s'y
  connecte par `/login/prestataire` (mot de passe), accepté partout par `canOpenSessionOn`.
- Le SuperAdmin du seed (`superadmin@gmail.com`, `src/db/scripts/seed.ts:150`) n'a **aucune ligne
  `member`** (absent du bloc `INSERT INTO "member"`, l. ~285-310).

### Écran SuperAdmin des membres

- `src/app/[locale]/admin/organizations/[id]/edit/page.tsx` (`withAuthAdmin`) : carte des modules,
  carte d'usage, puis `OrganizationMembersTable` avec `adminView={true}` derrière un `<Suspense>`.
- `src/components/features/organization/organization-members-table.tsx` (171 l., Server Component) :
  colonnes avatar, nom, email, rôle, date, action ; lit `getMembersAndInvitationsDal(organizationId)` ;
  la colonne action rend `RemoveMemberButton` (membre) ou un bouton d'annulation d'invitation. Seul
  usage : cette page (`grep OrganizationMembersTable`).
- `MemberOrInvitationDTO` (`src/services/types/domain/organization-types.ts:61-72`) : `userId`,
  `role` (d'association), `status: 'member' | 'invited'` — **pas le rôle global** : impossible
  aujourd'hui de masquer le bouton pour un compte `super_admin` sans enrichir le DTO.
- Liens de l'admin relatifs (`organizations-management.tsx:172` : `/admin/organizations/${id}/edit`) :
  l'écran d'une association B s'ouvre **sur l'hôte courant** (par ex. celui de A). Rien ne renvoie
  vers le domaine de B.
- Les fiches sans compte (`member_profile.user_id` nul, s12d) n'apparaissent pas dans ce tableau ;
  elles n'ont de toute façon aucun compte à imiter.

### Bannières et chrome existants

- `src/app/[locale]/base-layout.tsx` : `{alert && <AlertBanner …/>}` est le **premier enfant de
  `<body>`** (bandeau d'alerte s07, ADR 027 : « pousse toute la page, barres latérales comprises »).
  C'est le seul point commun à toutes les pages, publiques comme authentifiées.
- `src/app/[locale]/layout.tsx` porte `instant = false` (tenant par `Host`) : tout le site est
  dynamique, mais la règle « jamais d'`await` de session en tête de layout » (rule-react-cache) impose
  un composant de bannière derrière son propre `<Suspense>`.
- `(public)/layout.tsx` ne lit **aucune session** aujourd'hui (bouton « Connexion » statique).
- `(bureau)/layout.tsx` lit l'accès derrière `<Suspense>` (`BureauShell`) ; `(app)/layout.tsx` et
  `admin/layout.tsx` passent `getCurrentUserDal()` à `AuthProvider`.

### Traces existantes et résolution de l'auteur

| Écrivain                                            | Fichier                                                                                                                                                                                                       | Auteur                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Attribution / passation de rôle (s14)               | `src/services/member-role-service.ts` : `requireRoleAssigner` (l. ~231) → `viewer = getAuthUser()` ; `applyDecision` (l. ~197) : `author = {userId: viewer.id, name: viewer.name}` ; `traceRole` (l. ~98-109) | compte de la session                                           |
| Passation : anciennes Président(e)s rétrogradées    | `presidentsToDemote(organizationId, viewer, …)` : met **`viewer.id`** en tête                                                                                                                                 | compte de la session (correct : c'est le compte visé qui cède) |
| Déplacement de rôle par changement d'adresse (s12d) | `member-profile-service.ts:168-171` `authorOf(authUser)` → `member-account-service.ts:104-122`                                                                                                                | compte de la session                                           |
| Retrait d'une ligne `member`                        | `organization-service.ts:~855-877` `traceMemberRemoval` : `getAuthUser()`                                                                                                                                     | compte de la session                                           |
| Acte d'exploitation                                 | `member-role-service.ts:58-59` `OPERATOR_AUTHOR_NAME = 'Zourite Studio'`, `author_user_id` nul ; `pnpm ops:transfer-presidency` (`package.json:40`)                                                           | « Zourite Studio »                                             |
| Statut d'un signalement (s10)                       | `incident-report-service.ts:105-113` `requireReportsManager` → `getAuthUser()` ; l. ~405-406 `authorUserId: author.id, authorName: author.name`                                                               | compte de la session                                           |
| Colonnes `updated_by` (hors critère)                | `association-settings-service.ts:98`, `home-page-service.ts:111`, `site-alert-service.ts:99`, `site-navigation-service.ts:267`, `post-service.ts:127` (`authorId`)                                            | compte de la session                                           |

Schémas :

- `member_role_event` (`src/db/models/member-role-event-model.ts`) : `author_user_id` (`SET NULL`),
  `author_name` copié, **aucune colonne « pour le compte de »**.
- `incident_report_event` (`src/db/models/incident-report-model.ts:70-97`) : `author_user_id`,
  `author_name`, **aucune colonne « pour le compte de »**.

Le critère 6 impose donc une **modification de schéma** des deux tables (colonnes nullables
générées par `pnpm db:generate`) et un changement de chaque écrivain.

### Changement de mot de passe, d'email, de 2FA

- Écran `/account` (`src/app/[locale]/(app)/account/page.tsx`) → `UserSecurityFactorSection`.
- Actions (`src/components/features/user/action.ts`) : `update2FAAction` (l. 243, appelle
  `auth.api.enableTwoFactor` l. 281 / `disableTwoFactor` l. 308), `verifyTotpAction` (l. 341),
  `changePasswordAction` (l. 417, `auth.api.changePassword` l. 454), `changeEmailAction` (l. 511,
  `auth.api.changeEmail` l. 546), `updateUserAction` (l. 77), `updateUserSettingsAction` (l. 161).
- Drapeaux d'environnement (`src/env-schemas.ts:141-161`) : `NEXT_PUBLIC_BETTER_AUTH_2FA_ENABLE`
  (défaut `true`), `…_CHANGE_PASSWORD` (défaut `true`), `…_CHANGE_EMAIL` (défaut **`false`** depuis
  s12d, à rouvrir par s16).
- Routes HTTP Better Auth correspondantes, ouvertes : `/change-password`, `/change-email`,
  `/two-factor/enable`, `/two-factor/disable`, `/two-factor/generate-backup-codes`, `/update-user`,
  `/delete-user`, `/revoke-sessions`, `/link-social`, `/unlink-account`, `/request-password-reset`.

### Paramètres

- `organization_setting` (ADR 016) : registre typé `src/services/types/domain/association-settings-types.ts`,
  valeurs **par association**, page `settings` ou `identity` du **back-office du bureau**.
- `app_settings` (`src/db/models/app-settings-model.ts`) : paramètres **de plateforme**, clé primaire
  `key`, `type`/`category` en énumérés (`category` : `email` | `general`), clés dans
  `AppSettingKeys` (`app-settings-types.ts`), écran `/admin/settings` réservé au SuperAdmin, seed
  `seed.ts:494`.

### Inventaire RLS et export

- `src/db/rls-inventory.test.ts` compare les `pgTable` des modèles, les `FORCE ROW LEVEL SECURITY` des
  migrations et le classement de `docs/architecture.md` (§ « Classement RLS », l. ~337-366 ; 36 tables,
  dernière ajoutée `member_role_event`).
- **Aucun registre d'export ni d'exclusions n'existe** (`grep EXPORT_EXCLUSIONS|export-registry`
  vide) : s38 n'est pas jouée ; le critère 8 se limite au classement et au test d'inventaire.

## Anchor points

- **Configuration Better Auth** — `src/lib/better-auth/auth.ts:177-180` (options d'`admin()`),
  `auth.ts:68-71` (`disabledPaths`) si le choix est de fermer les routes HTTP d'imitation et de passer
  par une Server Action (patron du lien magique : route `/sign-in/magic-link` fermée,
  `auth.api.signInMagicLink` appelé par `src/app/[locale]/(auth)/action.ts:256` avec
  `headers: await headers()`).
- **Lecture « qui agit »** — `auth-service.ts` : un nouveau lecteur à côté de `getAuthUser()`
  (rend le compte vu **et** l'imitateur, depuis `getSessionAuth().session.impersonatedBy`), sans
  changer la signature de `getAuthUser()` utilisée partout.
- **Auteur d'une trace** — un seul helper (ex. « auteur effectif » = SuperAdmin si imitation, sinon le
  compte), branché dans `member-role-service.ts` (`applyDecision`), `member-profile-service.ts`
  (`authorOf`), `organization-service.ts` (`traceMemberRemoval`), `incident-report-service.ts`
  (`changeIncidentReportStatusService`). Colonnes « pour le compte de » ajoutées aux deux modèles.
- **Nouvelle table de trace** — `src/db/models/<nom>-model.ts` (patron `member-role-event-model.ts` :
  `organization_id` cascade, FK `SET NULL` + noms copiés), export dans `src/db/models/db.ts` (patron
  l. 14 / 60), policy `tenant_isolation` par migration `drizzle-kit generate --custom` (patron `0036`),
  ligne dans `docs/architecture.md` § Classement RLS, test d'inventaire, e2e d'accès croisé (la RLS
  n'est pas testable en unitaire, AGENTS.md).
- **Point d'entrée** — colonne action de `organization-members-table.tsx` en `adminView`, plus une
  Server Action dans `src/app/[locale]/admin/organizations/actions.ts` (patron existant,
  `actions.test.ts` à côté).
- **Bannière** — `base-layout.tsx`, à côté d'`AlertBanner`, en composant isolé derrière `<Suspense>`
  qui lit la session ; bouton « Sortir » → `stopImpersonating`.
- **Refus des écritures sensibles** — les actions de `src/components/features/user/action.ts` et les
  routes HTTP listées plus haut (hook `before` Better Auth sur ces chemins quand
  `session.impersonatedBy` est posé, ou fermeture par action).
- **Durée** — option `impersonationSessionDuration` (statique) ou correction de `expires_at` après
  création ; source du paramètre à trancher (voir questions).

## Verified APIs / functions

Tous les chemins sont relatifs à `node_modules/better-auth/dist/`.

### `POST /admin/impersonate-user` — `plugins/admin/routes.mjs:559-614`

- Middleware `adminMiddleware` (l. 17-21) : `getAuthoritativeSessionFromCtx` → session **relue en
  base** (`api/routes/session.mjs:277-281` : `disableCookieCache: true` en déploiement avec base),
  sinon `401 UNAUTHORIZED`.
- Permission : `hasPermission({userId, role: session.user.role, options, permissions: {user:
['impersonate']}})` (l. 579-584) ; échec → `403 YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS`
  (`error-codes.mjs:13`). `hasPermission` (`has-permission.mjs:3-10`) lit `options.roles` (ici
  `{user: userAc, super_admin: adminAc}`).
- `adminAc` (`plugins/admin/access/statement.mjs:26-44`) : `user: [create, list, set-role, ban,
**impersonate**, delete, set-password, set-email, get, update]` — **contient `impersonate`, pas
  `impersonate-admins`**. `userAc` (l. 45-48) : aucune permission. Donc : `super_admin` peut imiter,
  `user` reçoit 403 quel que soit son rôle d'association.
- Cible : `findUserById` (404 `USER_NOT_FOUND`) ; si son rôle est dans `adminRoles` (donc
  `super_admin`) ou dans `adminUserIds`, exige `allowImpersonatingAdmins === true` **ou** la
  permission `impersonate-admins` (l. 587-595), sinon `403 YOU_CANNOT_IMPERSONATE_ADMINS`
  (`error-codes.mjs:23`). Avec la configuration actuelle, **imiter un SuperAdmin est refusé par
  défaut** (critère 4, première moitié).
- Création : `internalAdapter.createSession(targetUser.id, true, {impersonatedBy: <id admin>,
expiresAt: getDate(opts.impersonationSessionDuration ?? 3600, 'sec')}, true)` (l. 596-599).
  **Durée par défaut : 3600 s (1 h)**, lue dans `opts` à la construction du plugin (statique).
  `dontRememberMe = true`, `overrideAll = true` → l'`expiresAt` demandé l'emporte
  (`db/internal-adapter.mjs:248-279`, l. 272 `expiresAt: dontRememberMe ? 1 jour : …` puis l. 278
  `...overrideAll ? rest : {}`).
- La création passe par `createWithHooks` (`db/with-hooks.mjs:6-23`) avec le contexte courant
  (`getCurrentAuthContext`) : **les hooks `session.create.before` s'appliquent**, dans l'ordre des
  plugins puis de la configuration : `associationSessionGuard` (sur le **compte visé** et l'hôte de la
  requête), le contrôle de bannissement d'`admin()` (`plugins/admin/admin.mjs:33-48`), puis celui de
  `auth.ts:347-357`. Un `false` rend `null` → `500 FAILED_TO_CREATE_USER` (l. 600) ; le cookie de
  l'admin n'a pas encore été touché à ce stade (la suppression est l. 602).
- Cookies (l. 601-609) : `deleteSessionCookie(ctx)` ; lit le cookie signé `dont_remember` de l'admin ;
  pose un cookie signé **`<prefix>.admin_session`** = `"<jeton session admin>:<dont_remember ou vide>"`
  avec les attributs du cookie de session (préfixe `__Secure-` en HTTPS, `httpOnly`, `sameSite=lax`,
  `path=/`, pas de `domain` → propre à l'hôte, `cookies/index.mjs:20-45`) ; puis
  `setSessionCookie(ctx, {session, user: targetUser}, true)` (cookie de session sans `maxAge` +
  `dont_remember` + cache de session, `cookies/index.mjs:167-179`). La session de l'admin **reste
  valide en base**.
- Réponse : `{session, user}`.

### `POST /admin/stop-impersonating` — `plugins/admin/routes.mjs:630-652`

- `requireHeaders: true`, **sans `adminMiddleware`** : toute session dont `impersonatedBy` est posé
  peut l'appeler ; sinon `400 "You are not impersonating anyone"` (l. 636).
- Relit le compte `impersonatedBy`, le cookie signé `admin_session` (absent → 500), la session admin
  par son jeton ; exige `adminSession.session.userId === impersonatedBy` (l. 644).
- **Supprime la session d'imitation** (l. 645), repose le cookie de la session admin
  (`setSessionCookie(ctx, adminSession, !!dontRememberMe)`, l. 646), expire `admin_session` (l. 647).
  **La sortie rend bien la session SuperAdmin d'origine** (critère 2), à condition que la session
  admin soit encore valide en base.

### Lecture de la session pendant l'imitation

- Schéma du plugin (`plugins/admin/schema.mjs`) : `session.impersonatedBy` (`string`, `input: false`,
  renvoyé). `getSession` rend donc `session.impersonatedBy` ; `customSession` le laisse passer.
- Cache de session (`cookies/index.mjs:76-99` `setCookieCache`) : `filterOutputFields(session.session,
options.session?.additionalFields)` — `impersonatedBy` n'est pas `returned: false`, il **devrait**
  figurer dans le cookie cache ; à prouver par un test (voir questions).
- `dontRememberMe` → `getSession` **ne prolonge jamais** la session d'imitation
  (`api/routes/session.mjs` l. ~163-169 : retour direct sans `updateSession`) ; le cache de session
  posé sans `maxAge` vaut alors 60 s (`setCookieCache`, l. 97-99). L'expiration est vérifiée sur le
  cache (l. ~65-67) puis en base (l. ~147) : **l'imitation expire bien d'elle-même**.
- Côté client : `plugins/admin/client.mjs:28-32` déclenche le rafraîchissement de la session
  (`$sessionSignal`) sur ces deux chemins.
- Hook `after` d'`admin()` sur `/list-sessions` (`admin.mjs:53-65`) : retire les sessions
  `impersonatedBy` de la liste vue par l'utilisateur (`list-tokens-section.tsx:30`).

### Enchaînement (critère 4, seconde moitié)

Pendant l'imitation, la session authoritative est celle du compte visé, de rôle `user` →
`hasPermission(['impersonate'])` échoue (403). Un SuperAdmin ne peut pas être visé (403 ci-dessus).
**L'enchaînement est donc refusé par la configuration actuelle**, sans code ; il faut le prouver par
un test, et le garder si `allowImpersonatingAdmins` ou `adminUserIds` venaient à être réglés.

### Server Action et cookies

- `disabledPaths` n'agit que sur le routeur HTTP (`api/index.mjs:163-166` : `onRequest` → 404) ;
  `auth.api.*` appelé côté serveur l'ignore (précédent : lien magique).
- `nextCookies()` (`integrations/next-js.mjs`) recopie tous les `Set-Cookie` d'un appel `auth.api.*`
  fait depuis une Server Action (hook `after` sur tous les chemins) : `admin_session`, session et
  cache seraient posés par une action projet.
- `auth.api.*` exige `headers: await headers()` pour que `associationSessionGuard` lise l'hôte (ADR 034,
  conséquences).

### Routes sensibles (critère 7)

- `/change-password` (`api/routes/update-user.mjs:~87-94`) : `currentPassword` **obligatoire**,
  `sensitiveSessionMiddleware`.
- `/two-factor/enable` et `/disable` (`plugins/two-factor/index.mjs:73-113`, `194-212`) :
  `shouldRequirePassword` (`utils/password.mjs:26-30`) rend `true` sans `allowPasswordless` (non
  configuré dans `auth.ts`) → mot de passe exigé. Piège : l'activation OTP recrée une session en
  copiant l'ancienne (`createSession(id, false, ctx.context.session.session)`, l. ~119) — elle
  garderait `impersonatedBy` mais **prolongerait la session à 7 jours** (pas d'`overrideAll`).
- `/change-email` (`update-user.mjs:406-460`) : **aucun mot de passe** ; seulement fermé tant que
  `user.changeEmail.enabled` est faux (l. 440), c'est-à-dire tant que `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL`
  reste `false` — s16 doit le rouvrir.
- Conclusion : aujourd'hui, le SuperAdmin imitant **ne peut pas** changer mot de passe ni 2FA (il ne
  connaît pas le mot de passe) ni l'email (drapeau fermé). Mais ces refus sont **incidents** : un
  compte sans mot de passe (lien magique seul), l'ouverture de `changeEmail` par s16, ou un futur
  `allowPasswordless` les ferait tomber. Le critère demande un refus **explicite**, testé.

## Traps & constraints

1. **Le point d'entrée vit sur le domaine de l'association.** Le guard refuse la session d'un membre
   de B ouverte sur l'hôte de A (500 générique). Le cookie `admin_session` et la session admin doivent
   exister **sur l'hôte de B** : le SuperAdmin doit y être connecté. L'écran
   `/admin/organizations/[id]/edit` s'ouvre aujourd'hui sur l'hôte courant, quel que soit `[id]`.
2. **Attribution.** `getAuthUser()` rend le compte visé ; toutes les traces partent sous son nom
   (« la Président(e) a transmis la présidence »). Il faut un lecteur qui expose `impersonatedBy`, et
   ne **pas** changer ce que voit l'autorisation (critère 1 : « fait exactement ce que ce compte
   fait ») — seules les traces changent d'auteur. Dans la passation, `presidentsToDemote` doit
   continuer d'utiliser l'id du compte visé.
3. **Schéma des traces.** Ni `member_role_event` ni `incident_report_event` n'ont de colonne « pour le
   compte de ». Ajout nullable, généré par `pnpm db:generate` (jamais de SQL à la main). Le job CI
   « migrations sur la base de `main` » (ADR 035) le jouera.
4. **Colonnes `updated_by` / `authorId`** (réglages, accueil, bandeau, navigation, posts) : hors
   critère, mais elles enregistreront le compte visé. À signaler au design / plan (« au minimum » dans
   le critère).
5. **Durée « pas en dur ».** `impersonationSessionDuration` est une option statique lue au chargement
   d'`auth.ts` : elle ne peut pas lire une valeur en base par appel. Un paramètre en base impose soit
   de corriger `session.expires_at` juste après la création (DAO, hors Better Auth), soit un contrôle
   supplémentaire dans le lecteur de session. Le défaut 3600 s du plugin est, lui, une constante.
6. **`cookieCache` 5 min** : sans impact à l'ouverture et à la sortie (les deux routes reposent le
   cache par `setSessionCookie`). Mais une session d'imitation supprimée en base hors de
   `stop-impersonating` (révocation, purge) resterait servie par le cache jusqu'à 60 s
   (`dontRememberMe`). `getCurrentUserDal` (`'use cache: private'`, stale 5 min) et le cache client
   (`staleTimes`) peuvent montrer le chrome de l'ancienne identité après le basculement : prévoir une
   navigation pleine (rechargement) à l'entrée et à la sortie, comme l'ADR 038 le note pour la
   fermeture d'accès.
7. **Déconnexion pendant l'imitation** : `/sign-out` → `deleteSessionCookie` (`cookies/index.mjs:241-255`)
   n'expire **pas** `admin_session`. La session admin reste valide en base, le cookie traîne, la
   bannière disparaît, aucune trace de sortie. Idem à l'expiration naturelle (1 h) : le SuperAdmin se
   retrouve déconnecté, pas rendu à sa session.
8. **Expiration = sortie non tracée** : aucun événement Better Auth ne signale l'expiration. « Chaque
   sortie tracée » ne couvre naturellement que la sortie explicite.
9. **Routes HTTP ouvertes.** Si la trace d'ouverture est écrite dans une Server Action, un appel
   direct `POST /api/auth/admin/impersonate-user` par un SuperAdmin ouvrirait une session **non
   tracée**. Deux formes cohérentes : fermer les deux routes (`disabledPaths`) et passer par
   `auth.api.*` (le test HTTP du critère 3 prouve alors un 404 pour tous), ou garder la route et
   tracer dans un hook Better Auth `after` (matcher sur le chemin, `ctx.context.newSession`) — mais
   l'association doit être résolue depuis l'hôte, comme le guard. Les autres routes `/admin/*`
   (`set-role`, `set-user-password`, `ban-user`…) restent ouvertes au SuperAdmin : hors périmètre.
10. **Cycle d'imports** : `auth.ts` ne peut pas importer statiquement une façade (cycle `auth.ts` →
    façade → `auth-service` → `auth.ts`, garde `magic-link-integration-imports.test.ts`) ; un hook
    de trace dans `auth.ts` devra charger la façade à l'appel, comme `organizationOfRequest`.
11. **Tests existants à garder verts** : `auth.test.ts` (ordre des plugins l. 45-53, options d'`admin`
    l. 56-92 — `toEqual(['super_admin'])` et clés de `roles`), `association-session-guard.test.ts`,
    `association-membership.test.ts`, `organization-members-table.test.tsx` (66 l.),
    `admin/organizations/actions.test.ts`, `rls-inventory.test.ts`. Le harnais **Better Auth réel en
    mémoire** de `email-verification-link.real-auth.test.ts` (`memoryAdapter`, guard monté, origine
    forcée) est le bon patron pour prouver en unitaire : 403 d'un `user`, 403 sur un SuperAdmin visé,
    refus d'enchaînement, guard appliqué à la session imitée, restitution par `stop-impersonating`,
    présence de `impersonatedBy` dans `getSession`/cache.
12. **e2e** : connexion SuperAdmin par `/login/prestataire` + mot de passe `Azerty123`
    (`bureauSession`, `e2e/member-roles.spec.ts:353-366`) ; deux tenants `localhost` / `127.0.0.1` ;
    suite à un seul worker en CI ; e2e jamais en local (mémoire projet). Le test d'accès croisé de la
    nouvelle table et la preuve « auteur = SuperAdmin » dans `member_role_event` sont des e2e.
13. **Bannière et prerender** : lecture de session dans `base-layout.tsx` uniquement dans un composant
    derrière `<Suspense>` ; pas de `logger` dans un scope `'use cache'`. Les pages publiques ne lisent
    aucune session aujourd'hui : y ajouter la bannière ajoute une lecture de session par page
    publique (seulement si un cookie de session est présent, à concevoir).
14. **Ban** : un compte banni visé → `403 BANNED_USER` du plugin `admin()` (le guard passe avant et
    accepte s'il est membre). Message à traduire ou à laisser générique.
15. **Le bouton dans le tableau** : le DTO n'a pas le rôle global ; masquer le bouton pour un
    `super_admin` membre demande d'enrichir `MemberOrInvitationDTO` ou de laisser le serveur refuser.
16. **Fiche ≠ compte** : agir à la place d'un membre du bureau permet de modifier l'adresse **de
    fiches** (s12d), y compris celle du compte visé, ce qui détache le compte de sa fiche
    (`replaceMemberAccount`) sans changer `user.email`. Ce n'est pas un changement d'adresse « du
    compte » au sens du critère 7, mais à trancher.

## Open questions

Techniques (à trancher au plan) :

1. **Où vit la durée ?** `organization_setting` est par association et éditable par le bureau, ce
   qui convient mal à une règle de la plateforme ; `app_settings` (plateforme, `/admin/settings`) est
   le candidat naturel mais suit l'ancien modèle (type/catégorie en base, pas de registre typé) ;
   une variable `@/env` est-elle acceptable au regard de l'ADR 010 (« rien en dur », mais une durée
   n'est ni un texte ni un seuil d'association) ? Et comment l'appliquer, vu que
   `impersonationSessionDuration` est statique (correction d'`expires_at` après création, ou plafond
   statique + contrôle au lecteur) ? Un ADR semble nécessaire.
2. **Route HTTP fermée ou hook de trace ?** (piège 9). Le choix détermine la preuve du critère 3
   (403 du plugin ou 404 de `disabledPaths`) et l'endroit où la trace d'ouverture s'écrit.
3. **Refus explicite des écritures sensibles** : hook `before` Better Auth sur `/change-password`,
   `/change-email`, `/two-factor/*`, `/update-user` (email ?), `/delete-user`, `/revoke-sessions`,
   `/link-social`, `/unlink-account` quand `session.impersonatedBy` est posé, **et** garde dans les
   actions de `user/action.ts` ? Masquer la section sécurité de `/account` pendant l'imitation ?
4. **`impersonatedBy` dans le cookie cache** : non prouvé, seulement déduit de `filterOutputFields`.
   À vérifier par le test en mémoire avant d'en faire dépendre la bannière.
5. **Déconnexion et expiration** (pièges 7-8) : faut-il intercepter `/sign-out` pendant l'imitation
   pour le transformer en sortie (et tracer), purger `admin_session` ? Faut-il tracer l'expiration
   (par exemple à la lecture suivante d'une session expirée) ou accepter que « sortie » = sortie
   explicite ?
6. **Colonnes de trace** : nom et forme (« pour le compte de » = id `SET NULL` + nom copié, sur le
   patron existant) ; les colonnes `updated_by` hors critère sont-elles laissées en l'état (dette
   déclarée) ou traitées ?
7. **Forme de la table d'imitation** : une ligne par ouverture et une par sortie (`kind`), ou une ligne
   par session avec `started_at` / `ended_at` ? L'id de session (`session.id`) y est-il stocké pour
   relier ouverture et sortie ?

Produit (à trancher au design) :

8. **Notifier le compte visé ?** (email, notification interne, ligne visible dans son espace) — rien
   dans les critères ; le budget email de 300/jour compterait l'envoi.
9. **Quels comptes listés ?** Seulement les lignes `member` avec compte (le tableau actuel), ou aussi
   un accès depuis la fiche d'un membre côté bureau ? Les invitations en attente et les fiches sans
   compte sont exclues de fait.
10. **Durée par défaut** (le plugin propose 1 h) et faut-il un compte à rebours dans la bannière ?
11. **Bannière sur les pages publiques aussi ?** Le critère dit « toutes les pages » ; les pages
    publiques ne lisent aucune session aujourd'hui. Et sur `/admin` (inaccessible pendant
    l'imitation, puisque le compte vu est `user`) ?
12. **SuperAdmin sans ligne `member` dans l'association / connecté sur un autre domaine** : le
    SuperAdmin peut ouvrir une session sur tout domaine (canOpenSessionOn), donc la ligne `member`
    n'est pas requise. Mais depuis l'écran de l'association B ouvert sur l'hôte de A, que fait le
    bouton : lien vers `https://<domaine de B>/admin/organizations/<id>/edit` (le SuperAdmin s'y
    connecte s'il ne l'est pas), ou refus avec message ? Le parcours doit être décidé.
13. **Où atterrit le SuperAdmin** à l'ouverture (destination du compte visé : `/dashboard` ou
    `/bureau/pages`, via `postLoginPathOf`) et à la sortie (retour à l'écran des membres de
    l'association ?).
14. **Raison saisie à l'ouverture** (motif du support) dans la trace ? Non demandé, utile pour l'audit.
15. **Sort de s41** : s48 couvre-t-elle le besoin de support de s41 (fusion ou retrait à décider à la
    recherche de s41, pas ici) ?
