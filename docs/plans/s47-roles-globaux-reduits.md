---
validated: yes
---

# Plan — Story s47-roles-globaux-reduits

Branch: `feature/s47-roles-globaux-reduits`

Sources : `docs/research/s47-roles-globaux-reduits.md` (lu le 16/10, sur `main` à `97a18a8b`) et
[ADR 035](../decisions/035-roles-globaux-reduits-et-controle-des-migrations-sur-la-base-de-main.md).

## Target story

Ne garder que deux rôles **globaux**, `user` et `super_admin`. `admin`, `moderator`, `redactor` et
`public` disparaissent du code, de l'énuméré Postgres `role_type`, du seed et des règles. Les rôles
d'association (`member` / `board` / `owner`, `UserOrganizationRoleConst`) ne bougent pas. Pas
d'écran nouveau, donc pas de design.

Critères d'acceptation :

1. Seul le SuperAdmin accède à `/admin` et à ses actions serveur. Un compte `user` est refusé côté
   interface et côté serveur, avec un test pour chaque action serveur de `/admin`.
2. Le formulaire utilisateurs de `/admin` ne propose que `user` et `super_admin`. Le serveur refuse
   toute autre valeur, preuve par un test unitaire sur la validation. Les rôles d'association ne
   changent pas.
3. La migration passe sur une base qui contient des comptes `admin` / `moderator` / `redactor` /
   `public`. Ces comptes passent à `user` et gardent leurs lignes `member`. Contrôle en CI sur le
   Postgres éphémère : seed de `main`, puis migrations de la branche.
4. Le seed ne crée plus aucun compte de ces rôles. Les e2e et tests unitaires qui s'en servaient
   sont réécrits ou retirés, jamais désactivés.
5. Aucune règle `.claude/rules/` ni `.cursor/rules/` ne cite plus ces rôles, et `pnpm check:rules`
   passe.

## Choix faits au plan (questions ouvertes de la recherche)

- **Q1, contrôle de migration** : un job CI générique « migrations sur la base de `main` »
  (worktree `origin/main` → `db:migrate && db:seed`, puis `db:migrate` de la branche, puis les
  contrôles s47). C'est la lettre du critère. Voir l'ADR 035.
- **Q2, comptes du seed** : `admin@gmail.com`, `admin-owner@gmail.com` et
  `moderator-member@gmail.com` **gardent leur adresse** et passent à `user`. Ils portent des
  appartenances dont dépendent `magic-link.spec.ts` et `incident-report.spec.ts`, et les renommer
  toucherait une vingtaine de fichiers sans rien prouver de plus. `moderator@`, `redactor@` et
  `public@` n'ont ni appartenance ni usage e2e : ils sont **supprimés** du seed, avec leurs lignes
  `account`, `user_settings` et notifications éventuelles.
- **Q3, doublon e2e** : dans `association-settings.spec.ts` et `association-identity.spec.ts`,
  l'itération `admin@gmail.com` est **retirée**. Une fois passé à `user`, ce compte a le même
  profil que `user@gmail.com` sur TechCorp (membre ici, bureau ou présidence ailleurs). L'itération
  `user@gmail.com` garde le cas réel.
- **Q4, actions sans garde** : `deleteOrganizationAction` reçoit une garde `[SUPER_ADMIN]` dans
  l'action. Le service autorise aussi la présidente, mais la console `/admin` est réservée au
  SuperAdmin. `deleteUserAction` (placeholder) reçoit la même garde et reste un placeholder.
  L'implémenter ou la retirer est hors périmètre.
- **Q5, Better Auth** : `admin({adminRoles: ['super_admin'], roles: {user: userAc, super_admin: adminAc}})`.
  Le même `roles` (et `ac: defaultAc`) est passé à `adminClient()` si son typage l'exige.
- **Q6, nommage et code mort** : `withAuthAdmin`, `isUserAdmin` et `isAuthAdmin` (de
  `user-authorization.ts`) **gardent leur nom**, avec une JSDoc qui dit « SuperAdmin ». Le code mort
  qui cite les rôles retirés est **supprimé** : `src/lib/api-auth.ts`, `useAuthUserRole`,
  `isAdmin` de `auth-util.ts`, `isAuthAdmin` de `auth-service.ts` et `buildAdminAbilities`.
- **Q7, ADR** : ADR 035 écrit.

## Tasks (ordered)

1. [x] **Rôles globaux du domaine réduits**, en TDD, unitaire.
   - `auth-types.ts` : `RoleConst = {USER, SUPER_ADMIN}` et `roleHierarchy = ['user','super_admin']`.
   - `auth-util.ts` : plus de repli `?? 'public'`. Un rôle absent ou inconnu ne satisfait aucune
     exigence.
   - `authorization-service.ts` : branches `ADMIN` et `MODERATOR/REDACTOR` retirées. « Aucun rôle »
     donne les droits d'invité, `user` donne `buildUserAbilities`, `super_admin` le bypass.
     `isUserAdmin` ne vaut plus que pour `super_admin`.
   - Suppression du code mort listé en Q6 (`casl-abilities.ts`, `api-auth.ts`, `auth-provider.tsx`,
     `auth-util.ts`, `auth-service.ts`).
   - Tests : `hasRequiredRole(s)`, c'est-à-dire `user` refusé sur `[SUPER_ADMIN]`, `super_admin`
     accepté sur `[USER]`, rôle vide ou `'admin'` refusé ; `defineAbilitiesFor` pour un compte sans
     rôle (droits d'invité) ; `isUserAdmin` (seul `super_admin`).
     _Le modèle Drizzle ne bouge pas encore (tâche 5) : `Roles` reste large et ce n'est que
     `RoleConst` qui rétrécit._
2. [x] **Tests unitaires existants triés**, au cas par cas, sans `skip`. La fixture `userTestAdmin`
   (`service-test-data.ts`, 17 importeurs) est **supprimée**. Chaque usage est réécrit sur
   `userTest` (cas « admin global refusé », par exemple `association-authorization.test.ts:97`) ou
   sur `userTestSuperAdmin` (cas « admin global autorisé », par exemple CASL `MANAGE`). Même
   traitement pour les `RoleConst.ADMIN` directs : `casl-authorization-service`, `admin-dashboard-service`,
   `notification-service`, `user-service`, `user-submission-service`, `action-registry-authorization`.
   Vérification : `pnpm test --run` vert, et le grep
   `(^|[^A-Za-z])RoleConst\.(ADMIN|MODERATOR|REDACTOR|PUBLIC)` vide sous `src/`.
3. [x] **`/admin` réservé au SuperAdmin**, critère 1, en TDD.
   - `withAuthAdmin` → `RoleConst.SUPER_ADMIN`.
   - Les 16 paires `[ADMIN, SUPER_ADMIN]` deviennent `[SUPER_ADMIN]`.
   - Garde `[SUPER_ADMIN]` ajoutée à `deleteOrganizationAction` et `deleteUserAction`.
   - Tests : un fichier `actions.test.ts` par fichier d'actions (7 fichiers, `organizations`
     existe déjà). Pour **chacune des 22 actions**, deux cas. (a) Un compte `user` : l'action
     rejette `AuthorizationError` et n'appelle aucun service. On mocke `getAuthUser`, **pas**
     `requireActionAuth`, pour exercer la vraie garde ; voir le piège `cache()` en stratégie de
     test. (b) Un `super_admin` : l'action atteint son service.
   - Côté interface : test unitaire de `withAuthAdmin` (un `user` déclenche `forbidden()`) et e2e de
     la tâche 7.
4. [x] **Validation et formulaire à deux rôles**, critère 2, en TDD.
   - `user-validation.ts` : les deux `z.enum` dérivent d'une seule liste `['user','super_admin']`.
   - Test unitaire : `admin`, `moderator`, `redactor` et `public` sont refusés par
     `updateUserServiceSchema` et par `createUpdateUserServiceSchema()` ; `user` et `super_admin`
     passent.
   - Test sur `updateUserDetailAction` : un rôle `admin` renvoie `success: false` et n'appelle
     ni `banUser` ni `unbanUser`.
   - `user-detail-form.tsx` (schéma client et `SelectItem`), `users-management.tsx`
     (`getUserRoleDisplay`) et `messages/fr.json` (`AdminUsers.roles` réduit à `user` et
     `super_admin`).
   - Test du formulaire : seules deux options sont proposées.
5. [x] **Better Auth reconnaît `super_admin`**, en TDD.
   - `auth.ts` : `admin({adminRoles: ['super_admin'], roles: {user: userAc, super_admin: adminAc}})`,
     avec `userAc`, `adminAc` et `defaultAc` importés de `better-auth/plugins/admin/access`.
     `auth-client.ts` : `adminClient()` aligné si le typage l'exige.
   - Test dans `auth.test.ts` : `auth` s'initialise sans `BetterAuthError` ; les options du plugin
     `admin` déclarent `adminRoles` et `roles` ; `hasPermission`, ou l'appel du plugin, accorde
     `user:["ban"]` à `super_admin` et le refuse à `user`.
6. [x] **Modèle et migrations**, critère 3, partie schéma. C'est le **second commit** de la story
   (ADR 035), pour pouvoir le défaire seul.
   - (1) `pnpm drizzle-kit generate --custom --name=global_roles_to_user`, qui crée `0031`.
     Contenu : `UPDATE "user" SET "role" = 'user' WHERE "role" IN ('admin','moderator','redactor','public');`.
   - (2) `roleEnum` réduit à `['user','super_admin']` dans `auth-model.ts`.
   - (3) `pnpm db:generate`, qui crée `0032` (le `DROP/CREATE TYPE` est **non retouché**).
   - Vérification : `pnpm db:generate` relancé ne produit plus rien, et `tsc` est vert, puisque
     `Roles` rétrécit avec l'enum (les littéraux restants sont signalés). L'application des
     migrations est prouvée en tâche 8.
7. [x] **Seed et e2e**, critère 4.
   - Seed : `admin@`, `admin-owner@` et `moderator-member@` passent à `user` ; `moderator@`,
     `redactor@` et `public@` sont supprimés partout dans `seed.ts`, y compris dans les listes
     `IN (...)` et les résumés `console.log`.
   - Test unitaire du seed, s'il est extractible, sinon contrôle SQL dans le job de la tâche 8 :
     aucun compte hors `user` ou `super_admin`.
   - e2e qui passent sur `superadmin@gmail.com` : `authorization.spec.ts:74`,
     `smoke-authenticated.spec.ts:143`, `legacy-routes.spec.ts:24` et `tenant-isolation.spec.ts:158`.
   - Itérations `admin@` retirées dans `association-settings.spec.ts:362` et
     `association-identity.spec.ts:366` (Q3).
   - Nouveau cas dans `authorization.spec.ts` : `user@gmail.com` sur `/admin` voit l'UI forbidden.
     L'assertion porte sur le contenu, le statut est 200 sous Cache Components (recherche, piège 11).
   - Vérification en CI : e2e verts, aucun `test.skip` ou `fixme` ajouté.
8. [x] **Job CI « migrations sur la base de `main` »**, critère 3, partie preuve. Dans
   `.github/workflows/ci.yml`, un job avec son propre service `postgres:17` et la même étape
   « Rôle applicatif et extensions » que le job e2e :
   - `git worktree add ../main origin/main`, puis `pnpm install --frozen-lockfile`,
     `pnpm db:migrate` et `pnpm db:seed` **dans ce worktree** ;
   - photo avant : `SELECT count(*) FROM member` et la liste des `user_id` dont le rôle est retiré ;
   - `pnpm db:migrate` de la branche ;
   - contrôles : aucun `user.role::text` hors `('user','super_admin')`, chaque `user_id` photographié
     vaut `user`, et le nombre de lignes `member` est inchangé, pour ces comptes comme au total.
   Les contrôles vivent dans un script versionné (`scripts/ci/check-global-roles-migration.sh`, ou
   un `.ts` sous `src/db/scripts/`), pas en ligne dans le YAML. **Vérification** : le job est vert
   sur la PR, et son journal montre au moins un compte converti, sans quoi le contrôle n'a rien
   éprouvé.
9. [x] **Règles, documentation, `check:rules`**, critère 5.
   - Réécriture de `rule-roles-and-organization-roles.md`, `rule-seed-usersroles-and-organization.md`
     (le tableau des comptes et le « bypass global » passent sur `superadmin@`),
     `rule-casl-authorization.md` (section `ADMIN`), `rule-safe-server-action.md` (`[SUPER_ADMIN]`),
     `rule-api-routes.md` (helpers supprimés), `rule-safe-route.md` (le sens de `withAuthAdmin`) et
     `rule-persistence.md` (exemple neutre).
   - `docs/architecture.md:186` : « deux rôles globaux, USER et SUPER_ADMIN ».
   - Commentaire de `canManageAssociation` (`association-authorization.ts:18`).
   - Nouvelle entrée `STALE_PATTERNS` « retiré par s47 » dans `scripts/check-rules.ts`, qui cible
     `RoleConst.(ADMIN|MODERATOR|REDACTOR|PUBLIC)` hors préfixe `UserOrganization`, `moderator`,
     `redactor`, `withAdminAuth`, `withRedactorAuth` et `useAuthUserRole`, **sans** attraper
     `visibility: 'public'` ni le `'admin'` page ou slug.
   - `pnpm check:rules --fix` pour les jumeaux `.cursor/rules/`, puis `pnpm check:rules` vert.

## Files touched

- **Domaine et autorisation** : `src/services/types/domain/auth-types.ts`,
  `src/services/authentication/auth-util.ts`, `src/services/authentication/auth-service.ts`,
  `src/services/authorization/authorization-service.ts`, `src/services/authorization/casl-abilities.ts`,
  `src/services/authorization/user-authorization.ts` (JSDoc),
  `src/services/authorization/association-authorization.ts` (commentaire),
  `src/services/validation/user-validation.ts`.
- **Supprimés** : `src/lib/api-auth.ts`. Retirés : `useAuthUserRole` de
  `src/components/context/auth-provider.tsx`.
- **Présentation** : `src/components/features/auth/with-auth.tsx`,
  `src/components/features/admin/users/user-detail-form.tsx`,
  `src/components/features/admin/users/users-management.tsx`, `messages/fr.json`.
- **Actions `/admin`** : `src/app/[locale]/admin/{emails,organizations,plans,settings,submissions,subscriptions,users}/actions.ts`
  et leurs `actions.test.ts` (6 nouveaux, 1 étendu).
- **Better Auth** : `src/lib/better-auth/auth.ts`, `src/lib/better-auth/auth-client.ts`,
  `src/lib/better-auth/auth.test.ts`.
- **Persistance** : `src/db/models/auth-model.ts`, `drizzle/migrations/0031_*.sql`,
  `drizzle/migrations/0032_*.sql`, `drizzle/migrations/meta/` (générés), `src/db/scripts/seed.ts`.
- **Tests unitaires** : `src/services/__tests__/service-test-data.ts` et les ~20 fichiers listés en
  tâche 2.
- **e2e** : `authorization`, `smoke-authenticated`, `legacy-routes`, `tenant-isolation`,
  `association-settings` et `association-identity` (`.spec.ts`).
- **CI** : `.github/workflows/ci.yml`, et le script de contrôle de la tâche 8.
- **Règles et docs** : les 7 règles `.claude/rules/` de la tâche 9 et leurs jumeaux
  `.cursor/rules/`, `scripts/check-rules.ts`, `docs/architecture.md` et l'ADR 035 (déjà écrit).

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : le cœur de la preuve pour les critères 1, 2 et 4.
  - Actions `/admin` : on mocke `@/services/authentication/auth-service` (`getAuthUser`) et les
    façades, et on laisse **réelle** la chaîne `requireActionAuth` → `hasRequiredRoles`. Ainsi
    le test prouve le refus, pas seulement le paramètre passé.
    ⚠️ `requireActionAuth` est enveloppé dans `cache()` de React. Hors rendu serveur, vérifier dès
    le premier test qu'il ne mémorise pas d'un cas à l'autre. Si c'est le cas, mocker
    `react`.`cache` en passe-plat (`vi.mock('react', …)` partiel), et le dire dans le test.
  - Validation : schémas Zod directement. Better Auth : options du plugin et `hasPermission`.
  - ⚠️ Montage 9p lent : en cas de timeout des workers Vitest, valider sur une copie en disque local.
    Un timeout ne compte jamais comme vert.
- **e2e (Playwright, en CI uniquement, pas en local)** : comptes du seed réécrits, refus de `/admin`
  pour `user` (contenu forbidden, statut 200 attendu).
- **Migration (critère 3)** : job CI de la tâche 8 sur le Postgres éphémère. Il n'existe pas de test
  unitaire possible de la RLS ou des migrations (`db.ts` refuse toute connexion en test).
- **Revue** : le grep `(^|[^A-Za-z])RoleConst\.(ADMIN|MODERATOR|REDACTOR|PUBLIC)` est vide ;
  `roleHierarchy` vaut `['user','super_admin']` ; `UserOrganizationRoleConst.ADMIN` (Bureau) est
  inchangé partout ; aucune nouvelle occurrence de `withRlsBypass`.

## Definition of Done

- Une PR, deux commits squashés au merge : (1) le code, les tests, le seed, la CI et les règles ;
  (2) `roleEnum` dans `auth-model.ts` avec `0031`, `0032` et `meta/`. Le premier compile seul,
  puisque `Roles` reste dérivé de l'ancien énuméré. Défaire le second rend le schéma intact.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run`, et les jobs CI e2e et « migrations sur la
  base de `main` » verts.
- Les cinq critères cochés, chacun avec la preuve nommée ci-dessus. Aucun test désactivé.
- Les rôles d'association et le comportement de s46b (destination après connexion, connexion
  limitée) sont inchangés : les specs `auth`, `magic-link` et `account-legacy-routes` passent sans
  modification.
- Revue `/ks-review` passée (`Ship allowed: yes`).
- Pas de mise en production : elle attend s12b (mémoire « Déploiement juste avant s13 »).
