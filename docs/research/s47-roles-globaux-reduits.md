# Research — Story s47-roles-globaux-reduits

Recherche du 16/10/2026, sur `main` à `97a18a8b` (s46b mergée). Tout ce qui suit a été lu dans
le code, pas dans la documentation, sauf mention contraire.

## Target story

Réduire les rôles **globaux** (`user.role`, `RoleConst`) à `user` et `super_admin`. `admin`,
`moderator`, `redactor` et `public` disparaissent. Les rôles **d'association** (`member.role`,
`UserOrganizationRoleConst` : `member` / `board` / `owner`) ne bougent pas. Story hors du tableau de
périmètre du PRD (arbitrage du 7 octobre 2026). Elle passe avant s12b, tant qu'aucune base de
production n'existe. Complexité 3. Dépendances s03b et s46b, livrées toutes les deux.

Critères d'acceptation :

1. Seul le SuperAdmin accède à `/admin` et à ses actions serveur. Un compte `user` est refusé
   côté interface et côté serveur, avec un test par action serveur de `/admin`.
2. Le formulaire utilisateurs de `/admin` ne propose plus que `user` et `super_admin`. Le serveur
   refuse toute autre valeur, preuve par un test unitaire sur la validation. Les rôles
   d'association ne changent pas.
3. Une migration appliquée à une base qui contient des comptes `admin` / `moderator` /
   `redactor` / `public` aboutit. Ces comptes passent à `user` et gardent leurs lignes `member`.
   Contrôle en CI sur le Postgres éphémère : seed de `main`, migrations de la branche, contrôle des
   deux points.
4. Le seed ne crée plus de compte avec ces rôles. Les e2e et tests unitaires qui s'en servaient
   sont réécrits sur un rôle conservé ou retirés, jamais désactivés.
5. Aucune règle `.claude/rules/` (ni sa copie `.cursor/rules/`) ne cite plus ces rôles, et
   `pnpm check:rules` passe.

Pas d'écran nouveau : le seul changement visible est la liste déroulante du formulaire existant.
**Pas de `/ks-design`.**

## Current state of the code

### Définition des rôles globaux (3 sources à garder alignées)

| Fichier | Contenu actuel |
| --- | --- |
| `src/db/models/auth-model.ts:19` | `roleEnum = pgEnum('role_type', ['public','user','redactor','moderator','admin','super_admin'])`, utilisé par **une seule colonne** : `user.role` (`.notNull().default('user')`, l.41). |
| `src/services/types/domain/auth-types.ts:23` | `roleHierarchy = ['public','user','redactor','moderator','admin','super_admin'] satisfies Roles[]` |
| `src/services/types/domain/auth-types.ts:50` | `RoleConst = {PUBLIC, USER, REDACTOR, MODERATOR, ADMIN, SUPER_ADMIN}` |
| `src/services/types/domain/user-types.ts:46` | `type Roles = RoleEnumModel`, dérivé de `roleEnum.enumValues` (`user-model.ts:94`). Réduire l'enum Drizzle réduit le type : `tsc` signalera chaque littéral restant. |
| `src/services/validation/user-validation.ts:43` et `:71` | Deux `z.enum([...6 valeurs])` en dur pour `role` : `updateUserServiceSchema` et `createUpdateUserServiceSchema()`. Rien n'est dérivé de `RoleConst`. |
| `src/components/features/admin/users/user-detail-form.tsx:43` | Schéma Zod client avec les 6 valeurs en dur, et `SelectItem` pour `user`, `redactor`, `moderator`, `admin`, `super_admin` (l.260-276). |
| `src/components/features/admin/users/users-management.tsx:135` | `getUserRoleDisplay` : `switch` sur `admin` / `moderator` / `user` / `redactor` / `super_admin`, et `tCommon('states.public')` quand le rôle est vide. |
| `messages/fr.json:1583` | `roles: {user, admin, super_admin, moderator, redactor}` (namespace `AdminUsers`). |

### Contrôle d'accès à `/admin`

- **Pages** : `withAuthAdmin` (`src/components/features/auth/with-auth.tsx:36`) appelle
  `withAuth(…, RoleConst.ADMIN)`, qui s'appuie sur `hasRequiredRole`, un contrôle **hiérarchique**
  (`index(userRole) >= index(requis)`). Il est utilisé par `admin/layout.tsx:75`, `admin/page.tsx:34`
  et `admin/emails/page.tsx:20`. `admin/organizations/new/page.tsx:28` utilise déjà
  `withAuth(…, RoleConst.SUPER_ADMIN)`.
- **Actions serveur** : `requireActionAuth({roles})` (`src/app/dal/user-dal.ts:47`) appelle
  `hasRequiredRoles`, lui aussi hiérarchique. La paire `[ADMIN, SUPER_ADMIN]` équivaut donc
  aujourd'hui à « `admin` ou plus ».

**Inventaire complet des actions serveur de `/admin`** (7 fichiers `'use server'`, 22 fonctions
exportées) :

| Fichier | Action | Garde actuelle |
| --- | --- | --- |
| `emails/actions.ts` | `sendTestEmailAction` | `[ADMIN, SUPER_ADMIN]` |
| `organizations/actions.ts` | `updateOrganizationAction` | `[ADMIN, SUPER_ADMIN]` |
| | `deleteOrganizationAction` | **aucune garde dans l'action**. Le service appelle `canDeleteOrganization` : CASL `MANAGE ORGANIZATION` **ou propriétaire de l'organisation** |
| | `addUserToOrganizationAction` | `[ADMIN, SUPER_ADMIN]` |
| | `deleteAdminMemberInvitationAction` | `[ADMIN, SUPER_ADMIN]` |
| | `provisionOrganizationAction` | `[SUPER_ADMIN]` |
| | `updateOrganizationModulesAction` | `[SUPER_ADMIN]` |
| `plans/actions.ts` | `createPlanAction`, `updatePlanAction`, `softDeletePlanAction`, `deletePlanAction` | `[ADMIN, SUPER_ADMIN]` ×4 |
| `settings/actions.ts` | `updateSettingsAction` | `[ADMIN, SUPER_ADMIN]` |
| `submissions/actions.ts` | `markAsReadAction`, `archiveSubmissionAction` | `[ADMIN, SUPER_ADMIN]` ×2 |
| `subscriptions/actions.ts` | `cancelSubscriptionAction`, `reactivateSubscriptionAction` | `[ADMIN, SUPER_ADMIN]` ×2 |
| `users/actions.ts` | `updateUserAction`, `updateUserDetailAction`, `fetchUsersAction` | `[ADMIN, SUPER_ADMIN]` ×3 |
| | `deleteUserAction` | **aucune garde**. C'est un placeholder (`console.log`, renvoie `success: true`), appelé par `users-management.tsx:281` |

Il y a **un seul fichier de test** pour ces actions : `admin/organizations/actions.test.ts`. Il ne
couvre que `provisionOrganizationAction` et `updateOrganizationModulesAction`. Son patron :
`requireActionAuth` est mocké, puis on vérifie `toHaveBeenCalledWith({roles: [RoleConst.SUPER_ADMIN]})`
et la remontée de l'`AuthorizationError`.

### Autres consommateurs du rôle global retiré (code hors tests)

| Lieu | Usage |
| --- | --- |
| `authorization-service.ts:61` | `user.role === ADMIN` → `buildAdminAbilities` (CASL) |
| `authorization-service.ts:73` | `MODERATOR \|\| REDACTOR` → `buildUserAbilities` (mêmes droits que `user`) |
| `authorization-service.ts:79` | `!user.role \|\| PUBLIC` → `buildGuestAbilities`. Le cas « aucun rôle » reste après le retrait. |
| `authorization-service.ts:182` | `isUserAdmin` = `ADMIN \|\| SUPER_ADMIN`. Consommateurs : `requireActionAuth` (dérogation `uid`, `user-dal.ts:49`), `app-settings-authorization.ts` (×3), `notification-authorization.ts:107`, `user-authorization.ts` (`isAuthAdmin`, `canManageUsers`). `isAuthAdmin` est lui-même appelé par `organization-authorization.ts:228/456/465` et `subscription-service.ts:422`. |
| `casl-abilities.ts:82` | `buildAdminAbilities`, seul appelant : `authorization-service.ts:62` |
| `auth-util.ts:13,35` | `userConnected?.role ?? 'public'` : repli sur la valeur retirée |
| `auth-util.ts:47` | `isAdmin` : **aucun appelant** (grep `isAdmin(` vide) |
| `auth-service.ts:58` | `isAuthAdmin` = `role === ADMIN`. **Aucun appelant** : homonyme de celui de `user-authorization.ts`, qui est le seul importé. |
| `auth-provider.tsx:47` | `useAuthUserRole` (`isAdmin`, `isPublic`, `isRedactor`, `isModerator`…) : **aucun appelant** |
| `src/lib/api-auth.ts:116-135` | `withAdminAuth`, `withRedactorAuth`, `withDynamicAdminAuth`, `withDynamicRedactorAuth` : **le fichier n'est importé nulle part** |

### Déjà fait par s46b, à ne pas refaire

- `postLoginPathOf` (`association-authorization.ts:57`) : seul `SUPER_ADMIN` arrive sur `/admin`.
  Le commentaire précise que « le rôle global `admin` n'est pas SuperAdmin ».
- `canOpenSessionOn` (`association-membership.ts:46`) : seul `SUPER_ADMIN` ouvre une session hors
  de son association.
- `canManageAssociation` (`association-authorization.ts:21`) : `SUPER_ADMIN` ou Bureau/Présidence.
  Le commentaire l.18 mentionne encore l'« `admin` global » à exclure. À réécrire, puisque ce rôle
  n'existera plus.

### Seed (`src/db/scripts/seed.ts`)

Comptes portant un rôle retiré (l.146-169) : `admin@gmail.com` (admin), `moderator@gmail.com`,
`redactor@gmail.com`, `public@gmail.com`, `admin-owner@gmail.com` (admin), `moderator-member@gmail.com`
(moderator). Ils ont des données rattachées :

- `admin@gmail.com` appartient à **trois associations** : membre de TechCorp, `board` de Marketing
  Pro, `owner` d'Acme (l.293-321). Il est aussi l'auteur des posts et hashtags du seed (l.379-432),
  le destinataire de notifications (l.466-489) et il a des `user_settings` (l.262).
- `admin-owner@gmail.com` est `owner` de Marketing Pro. `moderator-member@gmail.com` est `member` de
  TechCorp. Tous deux ont des notifications.
- Les résumés `console.log` (l.674, 680) listent ces rôles.

## Anchor points

- **Modèle et migration** : `roleEnum` dans `src/db/models/auth-model.ts`, puis `drizzle/migrations/`
  (prochain numéro **0031**, la dernière migration est `0030_member_profile_parcel_rls`).
- **Hiérarchie** : `roleHierarchy` et `RoleConst` dans `auth-types.ts`. Leurs consommateurs
  hiérarchiques sont `hasRequiredRole` / `hasRequiredRoles` (`auth-util.ts`).
- **Gardes `/admin`** : `withAuthAdmin` (pages), les 16 paires `[ADMIN, SUPER_ADMIN]` et les
  2 actions sans garde listées plus haut.
- **Validation** : les deux `z.enum` de `user-validation.ts`, appliqués par `updateUserService`
  (`user-service.ts:92`, via `createUpdateUserServiceSchema()`), et le schéma client de
  `user-detail-form.tsx`.
- **Better Auth** : `admin()` dans `src/lib/better-auth/auth.ts:167`, sans option.
  `auth.api.banUser` et `unbanUser` sont appelés par `updateUserDetailAction`
  (`users/actions.ts:126,144`).
- **Règles** : `scripts/check-rules.ts` (`STALE_PATTERNS`, l.25).

## Verified APIs / functions

- `requireActionAuth(options?: {uid?, roles?})` dans `src/app/dal/user-dal.ts:47`, enveloppé dans
  `cache()` de React. Il lève `AuthorizationError('Accès interdit')` si
  `!hasRequiredRoles(user, roles)`.
- `hasRequiredRole(user?, requestedRole?)` et `hasRequiredRoles(user?, requestedRoles?)` dans
  `src/services/authentication/auth-util.ts:8,27`. Leur comparaison est hiérarchique, sur
  `roleHierarchy`.
- `withAuth(Component, requiredRole?)` et `withAuthAdmin(Component)` dans
  `src/components/features/auth/with-auth.tsx`. Ils appellent `redirect('/login')` sans
  utilisateur et `forbidden()` si le rôle est insuffisant.
- Le plugin `admin` de **better-auth 1.7.1** a été lu dans
  `node_modules/better-auth/dist/plugins/admin/` :
  - options `adminRoles` (défaut `["admin"]`), `roles` (défaut `defaultRoles = {admin: adminAc, user: userAc}`, `access/statement.mjs:47`), `adminUserIds`, `defaultRole` (défaut `"user"`) ;
  - **à l'initialisation** (`admin.mjs:18-21`), si `adminRoles` est fourni, chaque rôle doit être une
    clé de `options.roles` (ou de `defaultRoles`). Sinon le plugin lève
    `BetterAuthError("Invalid admin roles: …")` ;
  - `hasPermission` (`has-permission.mjs`) cherche `acRoles[role]` dans `options.roles || defaultRoles`.
    Un rôle absent de cette table n'a **aucune** permission ;
  - `banUser` et `unbanUser` (`routes.mjs:449,508`) exigent la permission `user: ["ban"]` via
    `hasPermission`.
  - `adminAc`, `userAc` et `defaultAc` sont exportés par `better-auth/plugins/admin/access` (`access/index.mjs`).
- **drizzle-kit 0.31.10**, `AlterTypeDropValueConvertor` (`bin.cjs:23770`). Retirer des valeurs
  d'un enum produit, pour chaque colonne de ce type : `SET DATA TYPE text`, `SET DEFAULT 'user'::text`,
  puis `DROP TYPE`, `CREATE TYPE` avec les valeurs restantes, `SET DEFAULT 'user'::role_type`, et
  enfin `SET DATA TYPE role_type USING "role"::role_type`. Le dernier cast **échoue s'il reste une
  ligne** avec une valeur retirée.
- `pnpm db:migrate` lance `src/db/scripts/migrate.ts`, qui appelle `migrate()` de
  `drizzle-orm/node-postgres/migrator` sur `./drizzle/migrations`.
- Précédent `--custom` : `drizzle/migrations/0022_rate_limit_event_truncate.sql` (s08b), une
  migration de données préparée par `drizzle-kit generate --custom`, suivie de la migration
  générée.

## Traps & constraints

1. **Better Auth : `adminRoles: ['super_admin']` seul fait planter le démarrage.** La note de la
   story (« lui déclarer `super_admin` ») est incomplète. Il faut aussi fournir `roles` avec une
   entrée `super_admin` (et `user`), sinon `BetterAuthError` est levée à l'initialisation. Le client
   `adminClient()` (`auth-client.ts:34`) prend lui aussi `ac` et `roles` dans la documentation du
   plugin. Ce n'est pas vérifié pour la 1.7.1, à contrôler au plan.
2. **Défaut existant, à confirmer à l'exécution.** Aujourd'hui `super_admin` n'est pas dans
   `defaultRoles`, donc `hasPermission` lui refuse `user:["ban"]`. Or `updateUserDetailAction`
   appelle **toujours** `banUser` ou `unbanUser` après `updateUserService`. Pour un SuperAdmin, la
   lecture du code dit que l'enregistrement en base passe, puis que l'action renvoie « Erreur lors
   du débannissement ». Seul l'`admin` global fonctionnait. Déclarer correctement `super_admin`
   corrige ce défaut au passage. Le test du critère 1 doit couvrir le cas.
3. **La CI applique les migrations.** La story dit que « la CI e2e monte la base par `db:push` et
   n'exécute aucune migration ». C'est **faux aujourd'hui** : `.github/workflows/ci.yml:123` lance
   `pnpm db:migrate && pnpm db:seed` (le commentaire explique que `push` ne crée pas les policies
   RLS). Le job e2e appliquera donc 0031+ sur une base **vide**, avant le seed. Il ne prouve pas le
   critère 3, qui exige des comptes `admin` existants *avant* la migration.
4. **Le « précédent de s12c » n'existe pas.** s12c n'est pas commencée (ni recherche, ni code). Il
   n'existe aucun test ou job CI qui monte une base au seed de `main` puis applique les migrations
   d'une branche. Le mécanisme du critère 3 est **à concevoir** (voir les questions ouvertes).
5. **Ordre des migrations imposé.** Le cast final de drizzle-kit (point 3 des APIs vérifiées)
   impose que la conversion `UPDATE "user" SET role = 'user' WHERE role IN (…)` soit dans une
   migration **antérieure** (0031, `--custom`) à la migration générée (0032). Le migrateur Drizzle
   les applique dans l'ordre du journal. Aucune policy RLS ni aucune autre colonne ne référence
   `role_type` (grep des `.sql` et du snapshot 0030 : une seule colonne). La table `member` n'est
   pas touchée, donc la partie « gardent leurs lignes `member` » du critère 3 tient d'elle-même. Le
   test doit quand même la contrôler.
6. **Le précédent s03b n'est pas celui que la story décrit.** `0011_organization_role_board.sql` est
   un fichier généré puis **réécrit à la main** (`ALTER TYPE … RENAME VALUE`), justement parce que
   le `DROP/CREATE TYPE` de drizzle-kit échouait sur des lignes existantes. s47 doit faire l'inverse :
   migration de données `--custom` d'abord, puis migration générée **non retouchée**, comme l'exige
   AGENTS.md.
7. **Une hiérarchie à deux niveaux reste une hiérarchie.** Avec `['user','super_admin']`,
   `requireActionAuth({roles: [USER]})` laisse passer le SuperAdmin, comme aujourd'hui. Le repli
   `?? 'public'` de `auth-util.ts` doit disparaître. Avec `roleHierarchy.indexOf('public') === -1`,
   le code actuel refuse déjà, mais un rôle vide doit rester « aucun droit ».
8. **Homonymies, à ne pas confondre en review :**
   - `UserOrganizationRoleConst.ADMIN` vaut `'board'` (le Bureau, s03b). Il y en a des dizaines
     d'occurrences légitimes (`casl-abilities.ts:229`, `organization-authorization.ts:278`,
     `subscription-service.ts:334`, `organization-helper.ts:16`, `organization-validation.ts:55`,
     `association-authorization.ts:9`…). Un grep naïf sur `RoleConst.ADMIN` les attrape. Le motif
     correct est `(^|[^A-Za-z])RoleConst\.(ADMIN|MODERATOR|REDACTOR|PUBLIC)`.
   - `'public'` est aussi une valeur de `user_visibility` (`visibility: 'public'`) : seed, règles,
     schémas Zod. Ce n'est pas un rôle, il ne faut pas y toucher.
   - `'admin'` est aussi une page activable (`env.ts:24`, `EnabledPageSchema`), un slug réservé
     (`page-block-types.ts:104`) et un `EmailRecipientType` (`email-service.ts:68`). Aucun n'est
     un rôle.
   - `withAuthAdmin` et `isUserAdmin` portent « Admin » dans leur nom mais visent la console
     plateforme. Les renommer ou non est une décision de plan.
9. **Tests unitaires :** la fixture `userTestAdmin` (`service-test-data.ts:24`, `role: RoleConst.ADMIN`)
   est importée par **17 fichiers**. Une partie l'utilise comme « admin global **refusé** »
   (`association-authorization.test.ts:97`, s01b/s02), à réécrire sur `user`. Une autre l'utilise
   comme « admin global **autorisé** » (CASL `MANAGE`, `organization-service.test.ts:661`…), à
   réécrire sur `super_admin`. Il faut un tri au cas par cas. Autres usages directs de
   `RoleConst.ADMIN` dans les tests : `casl-authorization-service.test.ts:42`,
   `admin-dashboard-service.test.ts:44,78`, `notification-service.test.ts:85`,
   `user-service.test.ts:80`, `user-submission-service.test.ts:55`,
   `action-registry-authorization.test.ts:136`.
10. **e2e qui se connectent avec un compte de rôle retiré :**
    - besoin réel de la console plateforme, à basculer sur `superadmin@gmail.com` :
      `authorization.spec.ts:74` (« un administrateur atteint /admin »), `smoke-authenticated.spec.ts:143`
      (`ADMIN_ROUTES`), `legacy-routes.spec.ts:24` (`PLATFORM_ADMIN`), `tenant-isolation.spec.ts:158`
      (`/admin/submissions` via `/login/prestataire`) ;
    - « admin global refusé », à réécrire sur `user` d'après la story : `association-settings.spec.ts:362`
      et `association-identity.spec.ts:366`. Les deux bouclent sur `['user@gmail.com','admin@gmail.com']`,
      ce qui donne un doublon si `admin@` devient `user` ;
    - le compte est utilisé **pour ses appartenances**, pas pour son rôle global :
      `magic-link.spec.ts:610` (`admin@gmail.com`, « membre des deux »), `incident-report.spec.ts:41`
      (`moderator-member@gmail.com`, membre simple de TechCorp). Ils ne cassent pas si l'adresse
      reste avec le rôle `user`.
    - `superadmin@gmail.com` se connecte déjà dans plusieurs specs (`association-settings.spec.ts:394`,
      `auth.spec.ts:32`, `account-legacy-routes.spec.ts:27`). Son `user_settings.two_factor_type`
      vaut `totp`, mais `user.two_factor_enabled` n'est pas posé par le seed, donc pas de 2FA à la
      connexion.
11. **Le statut de `/admin` refusé est un 200.** `admin/layout.tsx` (commentaire l.21-33) et
    `authorization.spec.ts` le mesurent : `forbidden()` arrive après le shell, l'UI « forbidden »
    est rendue sous un statut 200. Le test « un `user` est refusé côté interface » doit donc porter
    sur le **contenu**, pas sur un 403.
12. **Cache de session Better Auth :** `cookieCache` est actif pour 5 minutes (`auth.ts:70`). Un
    compte converti par la migration peut garder son ancien rôle dans le cookie jusqu'à expiration.
    C'est sans effet réel (aucune production), mais à garder en tête si un e2e enchaîne
    migration et connexion.
13. **`check:rules`** : s45, s46 et s46b ont chacune ajouté une entrée `STALE_PATTERNS`
    (`scripts/check-rules.ts:25-59`). Le script surveille `CLAUDE.md`, `AGENTS.md`, `README.md`,
    `.claude/rules` et `.cursor/rules`, et `--fix` régénère les jumeaux `.cursor/rules/`. Une
    entrée s47 devra éviter les faux positifs du point 8 (`visibility: 'public'`, `'admin'` page ou
    slug, `UserOrganizationRoleConst.ADMIN`).
14. **Règles et docs qui citent les rôles retirés :**
    - `rule-roles-and-organization-roles.md` (l.27-39 `RoleConst` / hiérarchie, l.129 `RoleConst.ADMIN`) ;
    - `rule-seed-usersroles-and-organization.md` (tableaux des comptes, l.21-22, 47-50, 78, 97-100,
      122, 141, 166, 176 : « bypass global » par `admin@gmail.com`) ;
    - `rule-casl-authorization.md` (section `### ADMIN`, l.74) ;
    - `rule-safe-server-action.md:108,261` (`[RoleConst.ADMIN, RoleConst.SUPER_ADMIN]`) ;
    - `rule-api-routes.md:56-63` (`withAdminAuth`, `withRedactorAuth`…) ;
    - `rule-safe-route.md:85-145` (`withAuthAdmin`, à garder ou renommer selon le plan) ;
    - `rule-persistence.md:63` (exemple `pgEnum('user_role', ['user','admin','public'])`, exemple
      générique, pas notre enum) ;
    - `rule-zod-client-server-internationalization.md:291` (`isAdmin` dans un exemple) ;
    - **hors règles** : `docs/architecture.md:186` (« Tester les trois rôles globaux — ADMIN, USER,
      PUBLIC »), à mettre à jour, et `messages/fr.json` `AdminUsers.roles.{admin,moderator,redactor}`.
15. **Code mort mis à nu** : `src/lib/api-auth.ts` (non importé), `useAuthUserRole`,
    `auth-util.isAdmin` et `auth-service.isAuthAdmin` (sans appelant). On peut les retirer ou les
    réduire. `pnpm knip` existe (`package.json:37`) mais ne tourne ni en CI (`ci.yml`) ni dans les
    hooks Husky : rien ne force ce nettoyage.

## Open questions

1. **Mécanisme du critère 3.** Comment obtenir en CI « base au seed de `main`, puis migrations de
   la branche » ? Pistes à trancher au plan, aucune n'est vérifiée :
   (a) un job ou une étape qui fait `git worktree` / `checkout` de `origin/main`, puis
   `db:migrate && db:seed` dans ce worktree, puis `db:migrate` de la branche et une requête de
   contrôle ;
   (b) un script de test qui injecte lui-même des comptes `admin` / `moderator` / `redactor` /
   `public` avec leurs lignes `member` dans une base migrée jusqu'à 0030, puis applique 0031-0032.
   (a) colle à la lettre du critère, (b) est autonome mais ne joue pas « le seed de `main` ».
   Après le merge, le seed de `main` ne contiendra plus ces comptes, donc le contrôle ne vaut
   qu'une fois. Faut-il le garder dans la CI ou le jouer seulement sur la PR ?
2. **Sort des comptes de seed.** Faut-il garder les adresses (`admin@gmail.com`,
   `admin-owner@gmail.com`, `moderator-member@gmail.com`) avec le rôle `user` (moins de casse :
   magic-link et incident-report en dépendent pour leurs appartenances), ou les renommer pour que le
   nom ne mente plus ? `moderator@`, `redactor@` et `public@` n'ont ni appartenance ni usage e2e :
   ils peuvent être supprimés.
3. **Doublon `['user@gmail.com','admin@gmail.com']`** dans `association-settings.spec.ts` et
   `association-identity.spec.ts`. Une fois `admin@` passé à `user`, la seconde itération
   reprend-elle un vrai cas distinct (par exemple un membre simple d'une **autre** association), ou
   disparaît-elle ?
4. **Deux actions sans garde.** `deleteOrganizationAction` est protégée seulement par le service,
   qui autorise aussi le **propriétaire** de l'organisation, donc un compte `user` présidente
   passe. Le critère 1 exige un refus pour tout `user` : faut-il ajouter `[SUPER_ADMIN]` dans
   l'action ? `deleteUserAction` est un placeholder sans effet : faut-il la garder, puis la tester,
   ou la retirer avec son bouton ?
5. **Better Auth `roles` / `ac`** : faut-il déclarer `roles: {user: userAc, super_admin: adminAc}`
   et `adminRoles: ['super_admin']` côté serveur, et le même `roles` dans `adminClient()` ? La
   signature exacte de `adminClient` en 1.7.1 n'a pas été ouverte.
6. **Nommage** : renommer `withAuthAdmin` / `isUserAdmin` / `isAuthAdmin` en `…SuperAdmin`, ou
   garder les noms et ne changer que leur contenu ? Le renommage élargit le diff, mais supprime une
   homonymie de plus. Faut-il aussi retirer le code mort du point 15 dans cette story ?
7. **ADR** : la story cite l'ADR 009 comme modèle. Le retrait d'un rôle global est-il une décision
   structurelle qui mérite son ADR (035), au même titre que l'ADR 034 de s46b ?
