# Revue — Story s47-roles-globaux-reduits (seconde revue)

> Revue faite le 16/10/2026 dans un contexte neuf, par le sous-agent `reviewer`. Chaque problème est
> classé critical, major ou minor.
> Diff relu : `git diff main...feature/s47-roles-globaux-reduits`. La branche est à jour de `main` :
> merge-base `97a18a8b` = `main`. Elle porte trois commits :
> - `2a77ba79` : le code ;
> - `e7d6d006` : la migration ;
> - `ab507cc1` : les correctifs de la première revue.
>
> Le correctif a été relu comme du code neuf, puis tout le diff de la story a été jugé de nouveau.
>
> La première revue (même jour) bloquait sur un critical (C1) et six mineurs (m1 à m6) ; son suivi
> est le tableau ci-dessous.

## Suivi de la première revue

| Constat | Statut | Ce qui a été vérifié |
| --- | --- | --- |
| **C1** (critical), script CI non exécutable | **Corrigé** | `git ls-tree feature/s47-roles-globaux-reduits scripts/ci/` donne `100755 … check-global-roles-migration.sh`. `ci.yml` l'appelle directement (`before` / `after`), ce qui fonctionne désormais. |
| m1, commentaires périmés | Corrigé | `post-authorization.ts`, `subscription-authorization.ts:173,185` et `organization-authorization.ts:34,474` sont réécrits, plus un commentaire du seed. La nouvelle justification de `canProvisionOrganization` est juste : `buildUserAbilities` accorde bien `create ORGANIZATION`, ce que CASL ne distingue pas d'un provisionnement. |
| m2, `api-auth.ts` décrit comme existant | Corrigé | `rule-safe-route.md` (et son jumeau) ne présente plus le fichier comme vivant et donne la commande de récupération. Le hash `97a18a8b` est bien `main`, où le fichier existe. L'ADR 035 ajoute une conséquence qui note la suppression ; l'ADR 013, immuable, reste intact. |
| m3, quatre listes non synchronisées | Corrigé | `GLOBAL_ROLES` est désormais l'unique source, dans `auth-types.ts`. `roleHierarchy` en est un alias, et les deux `z.enum` de `user-validation.ts` comme `userRoleSchema` en dérivent. `auth-types.test.ts` vérifie l'égalité avec `roleEnum.enumValues` et avec `Object.values(RoleConst)` : la dérive serait détectée. |
| m4, `'Rôle invalide'` en dur | Corrigé | La clé `AdminUsers.validation.roleInvalid` existe dans `messages/fr.json`, vérifié par lecture du JSON. `getTranslations` est appelé dans la branche d'erreur, comme dans les actions `(bureau)`. Le test mocke `next-intl/server` et vérifie `message` et `errors[0]`, qui portent la clé attendue. |
| m5, `RULES-INDEX.md` hors format Prettier | Corrigé | `prettier --check` passe sur `.claude/rules/RULES-INDEX.md` **et** sur le jumeau `.cursor/rules/RULES-INDEX.md`. La réserve de l'implémenteur sur le jumeau n'a donc pas d'objet : les deux passent. |
| m6, e2e SuperAdmin sans preuve de contenu | Corrigé | Le test exige désormais le titre « Dashboard Administration » (`AdminPages.dashboard`, rendu en `<h1>` par `admin/page.tsx`). Il exige aussi l'absence de « Accès non autorisé » (`NotAuthorizedPage.title`). Les deux textes existent bien. |

**Le correctif lui-même.** Il n'introduit pas de défaut nouveau :

- **Import de `@/services/types/domain/auth-types` dans `user-form-validation.ts`, chargé par le
  composant client `user-detail-form.tsx`.** Ce module n'importe du modèle Drizzle que des
  **types** : `OrganizationRoleEnumModel` et `Roles`, ce dernier via `user-types`. Avec
  `isolatedModules`, ces imports sont effacés à la compilation. Le composant client
  `edit-member-role-dialog.tsx` importe déjà ce module sur `main`. Le bundle client ne change donc
  pas.
- **Import de `roleEnum` depuis `@/db/models/auth-model` dans `auth-types.test.ts`.** C'est une
  valeur, mais dans un test, et la couche domaine en dépend déjà en type. Cela ne contredit pas
  `rule-architecture` : l'interdiction vise la présentation. Le test passe sans connexion.

## Conformité au plan

- [x] Le code fait ce que le plan demande, sans rien de plus.
  - **Tâches 1 à 9 présentes.** Les écarts jugés acceptables à la première revue restent valables :
    - 20 actions `/admin`, et non 22 ;
    - 8 actions qui convertissent le refus en `{success:false}` ;
    - `adminClient()` inchangé : `tsc` est vert et il n'existe aucun appel `authClient.admin.*` ;
    - 5 règles réécrites en plus du plan, exigées par le critère 5.
  - **Ajouts du correctif.** Ce sont des réponses directes aux constats m1 à m6, sans dérive de
    périmètre.

## Anti-hallucination

- [x] Aucune API, fonction ni import inventé. Chaque cible a été ouverte :
  - `GLOBAL_ROLES` est exporté par `auth-types.ts` et importé par `user-validation.ts` et
    `user-form-validation.ts`. Aucun importeur ne reste sur l'ancien export de
    `user-validation.ts`.
  - `userRoleSchema` existe, et `getTranslations` vient bien de `next-intl/server`.
  - `adminAc` et `userAc` viennent de `better-auth/plugins/admin/access`, et
    `auth.api.userHasPermission` existe (déjà vérifiés en première revue).
  - `roleEnum.enumValues` est bien l'API Drizzle de `pgEnum`.
- [x] Aucune valeur ni logique plausible mais fausse.
  - `hasRequiredRole(s)` s'arrête sur l'utilisateur absent avant de lire `userConnected.role`.
  - Un rôle inconnu donne les droits d'invité.
  - `isUserAdmin` ne reconnaît que `super_admin`.
  - Sur le formulaire, un rôle hérité inattendu est ramené à `user` dans `defaultValues`.
- [x] Le code fait ce qu'il annonce. La migration a été lue statiquement :
  - `0031` convertit les comptes **avant** que `0032` ne recrée `role_type` à deux valeurs.
  - Aucune policy, vue ou fonction des migrations `0000` à `0030` ne dépend de `role_type` ni de
    `user.role`, donc le `DROP TYPE` ne sera pas bloqué. Les occurrences de `0011` portent sur le
    rôle d'association.
  - Le journal est ordonné : les `when` de `0031` et `0032` sont postérieurs à celui de `0030`.

## Conformité aux règles

- [x] Les conventions du dépôt (AGENTS.md) sont suivies.
  - **Migrations.** `0031` est une migration `--custom` dont seul le SQL est écrit à la main ;
    `0032` est générée sans retouche. La migration forme le second commit (`e7d6d006`), séparé du
    code.
  - **Contrôles de revue.** Aucune nouvelle occurrence de `withRlsBypass`. Aucun `skip`, `fixme` ni
    `only` ajouté.
  - **Grep des rôles retirés.** Le grep `(^|[^A-Za-z])RoleConst\.(ADMIN|MODERATOR|REDACTOR|PUBLIC)`
    est vide sur `src`, `e2e`, `scripts`, `.claude`, `.cursor` et `docs/architecture.md`. Seule
    exception : le motif de `scripts/check-rules.ts` lui-même.
  - **Homonymes intacts** : `UserOrganizationRoleConst.ADMIN` (`board`), `visibility: 'public'`, et
    `admin` comme page activable, slug réservé ou `EmailRecipientType`.
  - **Critère 5.** Les seules mentions « PUBLIC » restantes dans les règles
    (`rule-services-tests.md:131,134,292`) désignent explicitement le « visiteur sans compte ». Les
    gabarits `@/lib/api-auth` de `rule-api-routes.md` sont annoncés comme des gabarits sans code
    vivant, avec la consigne de recréer le fichier sur `user` et `super_admin`. Les deux sont
    acceptables.
- [x] Aucun ADR accepté n'est contredit.
  - ADR 035 est appliqué : deux rôles globaux, migration en deux temps, job générique « migrations
    sur la base de `main` », script de contrôle versionné.
  - ADR 009 (modèle de retrait) : le code retiré est récupérable par `git show 97a18a8b:…`.
  - ADR 013 n'est pas contredit, et sa référence morte est documentée par l'ADR 035.
  - ADR 034 : l'exception SuperAdmin est inchangée.
- [x] Le design system est respecté. Le `Select` existant passe à deux `SelectItem`, sans nouveau
  composant ni token.

## Tests

- [x] Le reviewer a lancé la suite lui-même, sur une copie de la branche en disque local
  (`git archive` de `feature/s47-roles-globaux-reduits`) :

  | Commande | Résultat |
  | --- | --- |
  | `pnpm test --run` | **233 fichiers passés, 2727 tests passés, 1 ignoré**, exit 0. Aucun timeout de worker. Par rapport à la première revue : un fichier et trois tests de plus (`auth-types.test.ts`). Le test ignoré existait déjà sur `main`. |
  | `pnpm lint` | exit 0 |
  | `pnpm check:rules` | « Règles et documentation alignées sur le code », exit 0 |
  | `npx tsc --noEmit` | exit 0 |
  | `prettier --check` sur les fichiers touchés par le correctif (TS, JSON, MD) | conforme |
- [x] Les assertions vérifient bien les critères :
  - **Critère 1.** Pour les 20 actions, la vraie garde s'exécute (`getAuthUser` mocké, et non
    `requireActionAuth`). Un `user` est refusé sans appel au service ; un `super_admin` atteint son
    service. `withAuthAdmin` appelle `forbidden()` pour `user` et pour `admin`, laisse passer
    `super_admin`, et renvoie vers `/login` sans session.
  - **Critère 2.** Les deux schémas Zod refusent `admin`, `moderator`, `redactor` et `public`, avec
    `path === ['role']`. L'action refuse ces rôles avec le message traduit, sans écrire ni appeler
    Better Auth. Le formulaire ne propose que `['user','super_admin']`.
  - **Better Auth.** `adminRoles` et `roles` sont vérifiés, et `userHasPermission` est réel : le
    bannissement est accordé à `super_admin` et refusé à `user` et à `admin`.
  - **Source unique des rôles.** Les égalités `GLOBAL_ROLES` = `roleEnum` = `RoleConst` sont
    vérifiées par le test.
- ⚠️ **Non vérifié avant la CI** (machine trop juste, consigne respectée) : **les e2e Playwright** et
  **le job `migrations-base-main`**. Lecture statique :
  - **Job `migrations-base-main`.**
    - `DATABASE_MIGRATION_URL` est défini dans l'`env` global du workflow.
    - `psql` est disponible sur `ubuntu-latest` et déjà utilisé par le job e2e.
    - Le script est exécutable (`100755`) et `set -euo pipefail`. `grep -c . || true` donne bien
      `0` sur un fichier vide.
    - La comparaison avant/après des lignes `member` est triée par `u.id` des deux côtés.
    - Le seed de `main` contient 6 comptes à rôle retiré (`admin@`, `moderator@`, `redactor@`,
      `public@`, `admin-owner@`, `moderator-member@`). Le contrôle éprouvera donc réellement la
      conversion.
    - **À confirmer sur la PR** : le journal de l'étape « Photo avant » doit afficher un nombre de
      comptes à convertir supérieur à 0 (tâche 8 du plan).
  - **e2e.** Les sessions `/admin` passent sur `superadmin@gmail.com`. Le cas `admin@gmail.com`
    refusé prouve la conversion du compte. Les titres attendus existent dans `messages/fr.json`.

## Régressions

- [x] Pas d'impact sur les chemins existants.
  - Consommateurs de `isUserAdmin` et `isAuthAdmin` (dérogation `uid` de `requireActionAuth`,
    `app-settings`, `notification`, `organization`, `subscription`) : ils ne voient plus que
    `super_admin`, comme voulu.
  - `postLoginPathOf` et `canOpenSessionOn` (s46b) ne changent pas.
  - Les specs `auth`, `magic-link` et `account-legacy-routes` ne sont pas modifiées.
  - Le plugin Better Auth `admin` reconnaît désormais `super_admin` comme administrateur. Avant, les
    appels `banUser` et `unbanUser` de la console se faisaient avec la session d'un `super_admin`,
    que le plugin par défaut (`adminRoles: ['admin']`) ne reconnaissait pas. C'est une correction,
    pas une régression.
  - Le mode `100755` du script n'a d'effet que sur ce fichier.

## Problèmes relevés

Aucun problème critical, major ni minor.

Observation, sans gravité et sans action demandée : `src/lib/better-auth/association-membership.test.ts:66-73`
(s46b, hors diff) passe encore le rôle `'admin'`, intitulé « rôle global admin ». Ce cas reste
pertinent tel quel : il prouve qu'un rôle inconnu ou retiré n'ouvre pas de session SuperAdmin. Le
plan demandait de ne pas toucher aux specs s46b.

## Fichiers concernés

- `scripts/ci/check-global-roles-migration.sh`
- `.github/workflows/ci.yml`
- `src/services/types/domain/auth-types.ts`
- `src/services/types/domain/auth-types.test.ts`
- `src/services/validation/user-validation.ts`
- `src/components/features/admin/users/user-form-validation.ts`
- `src/app/[locale]/admin/users/actions.ts`
- `src/app/[locale]/admin/users/actions.test.ts`
- `messages/fr.json`
- `e2e/authorization.spec.ts`
- `drizzle/migrations/0031_global_roles_to_user.sql`
- `drizzle/migrations/0032_classy_hellfire_club.sql`

## Verdict

Le constat bloquant C1 est corrigé, de même que les six constats mineurs. Le commit de correctif
n'introduit aucun défaut. Sur l'ensemble du diff, les tests unitaires, le lint, `check:rules` et
`tsc` passent ; le reviewer les a relancés lui-même. Deux preuves restent à obtenir en CI sur la
PR :

- les e2e verts ;
- le job `migrations-base-main` vert, avec au moins un compte converti dans son journal.

Max severity: none
Ship allowed: yes
