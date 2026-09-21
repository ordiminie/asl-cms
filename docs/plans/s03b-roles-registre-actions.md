---
validated: yes
---

# Plan — Story s03b-roles-registre-actions

Branch: `feature/s03b-roles-registre-actions`

Sources : `docs/stories.md` §s03b, `docs/research/s03b-roles-registre-actions.md`,
`docs/architecture.md`, **ADR 018** (`docs/decisions/018-registre-actions-en-code.md`, écrit pour ce
plan). Story sans écran propre : pas de `docs/designs/s03b-*`.

## Target story

**En tant que** présidente d'une association **je veux** que chacun n'accède qu'à ce que son rôle
permet **afin que** le back-office reste réservé au bureau sans réglage de ma part. Complexité 3.
Dépend de s01, s01b, s02 — toutes livrées, aucune dépendance ouverte.

Critères d'acceptation :

1. Les quatre rôles Membre, Bureau, Président(e) et SuperAdmin existent et sont attribuables à un utilisateur.
2. Un Membre reçoit un refus sur toute page de back-office, un Bureau y accède, et le refus vaut aussi bien en interface que sur l'appel serveur direct.
3. Une action déclarée au registre avec ses rôles par défaut est refusée à tout rôle absent de cette liste, et autorisée aux autres — vérifié sur une action de test.
4. Les actions posées avant cette story — téléverser le logo et le favicon (s01b), modifier les paramètres de l'association (s02) — sont déclarées au registre avec pour rôles par défaut Bureau et Président(e) : un Membre y reçoit un refus et un Bureau y est autorisé, en interface comme sur l'appel serveur direct.

### Décisions déjà prises (à respecter, pas à rediscuter)

- **Registre d'actions = module de code isomorphe, sans table ni écran** (ADR 018). La table de
  surcharge par tenant reste le problème de s37, non anticipé ici.
- **Le renommage `admin` → `board` ne change que la valeur de l'énuméré et des deux constantes, pas
  leurs clés** (`UserOrganizationRoleConst.ADMIN` reste `.ADMIN`, `OrganizationRoleConst.admin` reste
  `.admin`, seule la chaîne portée change de `'admin'` à `'board'`). Décision de granularité de diff :
  renommer aussi les clés toucherait ~28 fichiers (dont l'écran générique boilerplate
  `edit-member-role-dialog.tsx` et ses traductions `messages/{fr,en,es}.json`, hors du périmètre
  produit de l'association — voir `docs/architecture.md`, `(app)` vs `(bureau)`) pour un gain de
  lisibilité qui n'est pas demandé par les critères. Si la revue juge cette dissonance nom/valeur
  gênante, un renommage des clés reste un `/ks-execute` de reprise ciblé, pas une extension de ce plan.
- **`canManageAssociation` n'est pas retiré.** Elle reste le contrôle grossier « ce membre est-il
  Bureau ou Président(e) de cette association, ou SuperAdmin » utilisé par le portail `(bureau)`
  (critère 2, accès à la page). Le registre introduit un contrôle **fin, par action** (critère 3 et 4),
  utilisé par les services qui déclarent une action précise. Les deux coexistent : le premier décide
  qui voit le tableau de bord du bureau, le second qui peut effectuer telle mutation.
- **Le rôle global `RoleConst.ADMIN = 'admin'` (plateforme) n'est pas touché.** Seul l'énuméré
  `organization_role` (association) est renommé.

## Tasks (ordered)

1. [x] **Migration : renommer la valeur de l'énuméré `organization_role`.** `drizzle-kit generate --custom`
       pour un fichier `drizzle/migrations/00NN_organization_role_board.sql` manuscrit :
       `ALTER TYPE "organization_role" RENAME VALUE 'admin' TO 'board';`. Mettre à jour la liste de
       valeurs dans `organizationRoleEnum` (`src/db/models/auth-model.ts:207-211`,
       `['board', 'member', 'owner']` ou ordre équivalent) pour que le schéma Drizzle et la base
       restent d'accord, sans déclencher une seconde migration au prochain `db:generate`. **Test** :
       `pnpm db:migrate` s'applique proprement sur la base de test (conteneur jetable, skill
       `postgres-local-dev` si la base distante est injoignable) ; une ligne `member.role = 'board'`
       préexistante (via le seed d'avant migration) se relit sans erreur après migration.
2. [x] **Renommer la valeur portée par les deux constantes, et les deux littéraux actifs qui leur
       échappent.** `UserOrganizationRoleConst.ADMIN` (`src/services/types/domain/auth-types.ts:40`)
       et `OrganizationRoleConst.admin` (`src/services/types/domain/organization-types.ts:29`) :
       `'admin'` → `'board'`. Corriger les deux littéraux non couverts par ces constantes, vérifiés en
       recherche : `src/lib/better-auth/auth.ts:364` (branche commentée, à mettre à jour pour rester
       lisible) et `src/services/subscription-service.ts:458` (branche **active**,
       `userOrg?.role === 'owner' || userOrg?.role === 'admin'` → `'board'` — sans quoi un Bureau ne
       pourrait plus gérer l'abonnement Stripe de son association en mode
       `NEXT_PUBLIC_BILLING_MODE=organization`, défaut de `.env.test` et `env.example`). **Test** :
       `association-authorization.test.ts`, les tests CASL (`casl-abilities.test.ts` ou équivalent) et
       les tests de service d'organisation existants passent **sans modification de leurs
       assertions** (`pnpm test --run`) ; un test unitaire nouveau ou étendu sur
       `authorizeReference`/la fonction équivalente de `subscription-service.ts` couvre le rôle `board`.
3. [x] **Rôles personnalisés dans Better Auth, serveur et client.** `organization({...})` dans
       `src/lib/better-auth/auth.ts:152` : ajouter `ac` et
       `roles: {board: adminAc, owner: ownerAc, member: memberAc}` (import de
       `adminAc`/`ownerAc`/`memberAc`/`defaultAc` depuis `better-auth/plugins/organization/access`,
       réutilisés tels quels sous la nouvelle clé). Même déclaration côté
       `organizationClient({ac, roles})` dans `src/lib/better-auth/auth-client.ts:28`. Vérifier que
       `creatorRole` (implicite, `owner` par défaut de la lib) reste inchangé avec des rôles
       personnalisés déclarés. **Test** : test d'intégration ou unitaire sur la création d'une
       organisation (patron des tests de provisioning existants, `organization-provisioning-service.test.ts`)
       — le créateur reçoit `owner` ; ajout d'un membre avec le rôle `board` accepté par le plugin.
4. [x] **Mettre à jour `src/db/scripts/seed.ts` — uniquement les lignes de rôle d'organisation.**
       Lignes vérifiées **290, 296, 301** (le `CASE ... END::organization_role` qui alimente
       `INSERT INTO "member"`) : `'admin'` → `'board'`. **Ne pas toucher les lignes 144 et 158**
       (`INSERT INTO "user" (..., role) VALUES (..., 'admin')` — rôle **global** des comptes
       `admin@gmail.com` et `admin-owner@gmail.com`). **Test** : `pnpm db:seed` (ou
       `pnpm db:reset-seed`) s'exécute sans erreur ; une requête de vérification confirme que
       `user-admin@gmail.com` porte `board` chez `marketing-pro` et que `admin@gmail.com` porte
       toujours le rôle global `admin`.
5. [x] **Registre des actions.** Nouveau module isomorphe
       `src/services/types/domain/action-registry-types.ts` (gabarit `association-settings-types.ts`,
       ADR 018) : un tableau `readonly` de définitions `{id: string; defaultRoles: readonly
 OrganizationRole[]}`, et une fonction pure paramétrée par le registre, du type
       `isActionAllowedForRole(registry, actionId, role)`, qui répond `false` pour un `actionId`
       absent du registre (défaut fermé, jamais un accès implicite). **Test unitaire** : registre ad
       hoc avec une action de test à rôles par défaut `['owner']` seul — un rôle absent (`member`,
       `board`) refusé, `owner` autorisé ; c'est la preuve du critère 3, sans dépendre du registre de
       production.
6. [x] **Fonction d'autorisation générique.** Nouveau fichier
       `src/services/authorization/action-registry-authorization.ts` : combine `getAuthUser()`, le
       bypass `SUPER_ADMIN` (comme `canManageAssociation`), le rôle de l'utilisateur dans
       l'organisation ciblée, et `isActionAllowedForRole` sur le registre de production. Signature du
       type `canPerformAction(user, organizationId, actionId): boolean`. **Test unitaire** :
       SuperAdmin toujours autorisé quel que soit le registre ; rôle absent de la liste refusé ; rôle
       présent autorisé ; organisation à laquelle l'utilisateur n'appartient pas refusée.
7. [x] **Déclarer les actions de s01b et s02, migrer leurs services.** Dans le registre de
       production : deux ou trois entrées (téléverser le logo, téléverser le favicon — ou une entrée
       combinée si le plan d'exécution les juge équivalentes — et modifier les réglages), rôles par
       défaut `['owner', 'board']`. Remplacer l'appel direct à `canManageAssociation(authUser,
 organizationId)` par `canPerformAction(authUser, organizationId, <actionId>)` dans
       `src/services/association-identity-service.ts:131` (mutation logo/favicon — **pas** la ligne
       220, qui reste le contrôle grossier du portail) et `src/services/association-settings-service.ts:72`.
       **Test** : `association-identity-service.test.ts` et `association-settings-service.test.ts`
       existants passent **sans modification de leurs assertions** (critère 4 — « sans changer leur
       comportement »).
8. [x] **Preuve de bout en bout du critère 2.** Couverte par les specs **existantes**, rejouées après
       le renommage plutôt qu'étendues : `e2e/association-settings.spec.ts` (critère 7, refus
       interface + rejeu direct de l'action pour `user@gmail.com` — `member` chez TechCorp — et
       `admin@gmail.com` — global sans rôle d'association ; critère 6, `user-admin@gmail.com`, `board`
       chez Marketing Pro, lit ses réglages) et `e2e/association-identity.spec.ts` (critère 8, même
       refus sur `/bureau/identite` ; critères 5-6, le même `user-admin@gmail.com` téléverse logo et
       favicon sur son domaine). Aucune des deux ne porte de littéral `'admin'` de rôle d'association
       (vérifié par recherche) : rien à casser en silence par le renommage. Pas de nouvelle spec —
       celles-ci couvrent déjà member refusé / board autorisé, sur les deux pages, sur les deux
       domaines, interface et action serveur directe. **Test** : `CI=true pnpm test:e2e
 --project=chromium` sur les deux fichiers, contre le build de production et `asl_cms_test`
       remigrée/reseedée — 21 passed, 1 flaky sans rapport (critère 5, formulaire de provisioning,
       passé au rejeu).
9. [x] **`docs/architecture.md` à jour.** Retirer la formulation qui laisse lire `action_registry`
       comme une table dans la section « Entités ajoutées par ASL-CMS » ; la remplacer par une
       description conforme à l'ADR 018 (module de code). **Vérification** : `pnpm check:rules` (si
       ce script touche la cohérence des docs) sinon relecture manuelle — pas de test automatisé pour
       ce point.

## Files touched

- `drizzle/migrations/00NN_organization_role_board.sql` (nouveau, manuscrit)
- `src/db/models/auth-model.ts` (`organizationRoleEnum`)
- `src/services/types/domain/auth-types.ts` (`UserOrganizationRoleConst`)
- `src/services/types/domain/organization-types.ts` (`OrganizationRoleConst`)
- `src/lib/better-auth/auth.ts` (`organization({ac, roles})`), ligne 364 corrigée
- `src/lib/better-auth/auth-client.ts` (`organizationClient({ac, roles})`)
- `src/services/subscription-service.ts` (ligne 458)
- `src/db/scripts/seed.ts` (lignes 290, 296, 301 seulement)
- `src/services/types/domain/action-registry-types.ts` (nouveau)
- `src/services/authorization/action-registry-authorization.ts` (nouveau)
- `src/services/association-identity-service.ts` (ligne 131 migrée)
- `src/services/association-settings-service.ts` (ligne 72 migrée)
- `e2e/association-settings.spec.ts` ou nouvelle spec courte
- `docs/architecture.md` (section Data model, domaine Autorisation)
- Tests unitaires associés à chaque fichier ci-dessus (`*.test.ts`)

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : c'est le niveau qui porte la preuve des critères 3 et 4.
  Le registre et la fonction d'autorisation générique sont testés en isolation avec un registre ad
  hoc (critère 3). Les services migrés (`association-identity-service.ts`,
  `association-settings-service.ts`) gardent leurs tests existants inchangés (preuve du « sans
  changer leur comportement » du critère 4). Base et authentification mockées, comme partout ailleurs
  dans le projet — la RLS n'est pas concernée ici (`member` est exemptée, ADR 014).
- **e2e (Playwright, contre le build de production)** : seul niveau qui prouve le critère 2 sur de
  vraies pages (`/bureau/identite`, `/bureau/reglages`) après le renommage, refus interface et refus
  serveur direct, avec les comptes réels du seed mis à jour.
- **Migration** : vérifiée par son application sur une base de test jetable (skill
  `postgres-local-dev` si besoin), pas par un test Vitest (RLS/DB hors unitaire par convention du
  projet).

## Definition of Done

- Repris du DoD du dépôt (AGENTS.md) : PR unique, diff lisible, tests de logique métier passants, pas
  de régression sur `association-identity`/`association-settings`/`tenant-isolation`, revue passée
  sans critique ouverte.
- Spécifique à s03b : aucun littéral `'admin'` de rôle d'organisation ne subsiste hors des deux cas
  documentés du rôle global (`admin@gmail.com`, `admin-owner@gmail.com` — rôle **global**, colonne
  `user.role`) ; `docs/architecture.md` ne décrit plus `action_registry` comme une table ; ADR 018
  committé avec la story.
