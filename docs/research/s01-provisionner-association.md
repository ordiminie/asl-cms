# Research — Story s01-provisionner-association

> Contexte vérifié le 2026-09-08 sur `main` (`e672c3e`), Postgres 17 du `docker-compose`,
> Next 16.3.0 / React 19.2.8 / Better Auth 1.7.1 / Drizzle 0.45.2.
> Aucune ligne de code écrite. Les affirmations ci-dessous ont toutes été ouvertes ou exécutées ;
> ce qui n'a pas pu l'être est en « Questions ouvertes », pas deviné.

## Story cible

**s01-provisionner-association** — « En tant que SuperAdmin Zourite Studio je veux créer une
association et activer ses modules afin qu'elle dispose d'un site isolé sans écrire une ligne de
code. » Complexité 4. Aucune dépendance : première story du projet.

Sept critères d'acceptation, qui se regroupent en quatre chantiers :

| #   | Critère (abrégé)                                                                           | Chantier     |
| --- | ------------------------------------------------------------------------------------------ | ------------ |
| 1   | Créer une association depuis le BO SuperAdmin → tenant immédiatement écrivable/relisible   | Provisioning |
| 3   | Drapeaux d'activation de modules, persistés, modifiables, différents d'un tenant à l'autre | Modules      |
| 4   | Route d'un module inactif **ou clé inconnue** → **404** (pas un lien masqué)               | Modules      |
| 2   | Requête rattachée au tenant par le **domaine appelé** ; domaine inconnu → **404**          | Routage      |
| 5   | **Administrateur initial** désigné par email, rattaché à ce tenant seul, droits vérifiés   | Provisioning |
| 6   | Requête authentifiée tenant A ne voit rien de B, **même en forgeant l'id**                 | Isolation    |
| 7   | La policy RLS refuse la lecture inter-tenant **couche applicative court-circuitée**        | Isolation    |

`docs/reviews/stories.md` se termine par `Stories ready: yes` (max severity: major). Le découpage a
passé la revue ; les réserves `major` qui concernent s01 portent sur sa largeur assumée, pas sur son
contenu.

**Un cinquième chantier n'est dans aucun critère mais est imposé par l'ADR 009** : le retrait des
cinq sous-systèmes du boilerplate est explicitement daté « dans s01 », et AGENTS.md le répète. Il
pèse plus lourd que les quatre autres réunis (voir « Surface du retrait »).

Les décisions structurantes que s01 demandait de trancher en `/ks-architect` **le sont déjà** :
ADR 002 (RLS + rôle dédié), ADR 003 (résolution par domaine), ADR 010 (paramètres + modules),
ADR 009 (retraits). Le plan les applique, il n'a pas à les rouvrir.

## État actuel du code

### Ce qui existe et sert de socle

- **`organization`** — `src/db/models/auth-model.ts:152`. Colonnes : `id` (uuid), `name`, `slug`
  (unique), `description`, `createdAt`, `updatedAt`, `logo`, `metadata` (text), `limitOverrides`
  (json `Record<string, number>`). **Ni domaine, ni drapeaux de modules.**
  `src/db/models/organization-model.ts` ne contient que les `relations` Drizzle et les types
  `OrganizationModel` / `AddOrganizationModel` / `MemberModel`.
- **`organization-repository.ts`** — 389 lignes, 21 fonctions `*Dao` exportées, dont
  `createOrganizationDao`, `getOrganizationBySlugDao`, `createOrganizationMemberDao`,
  `generateUniqueSlug`. **Pas de `getOrganizationByDomainDao`.**
- **`organization-service.ts`** — 23 fonctions `*Service`. `createOrganizationService`
  (ligne 66) fait déjà : `canCreateOrganization()` → `safeParse` → `createOrganizationDao` →
  `createOrganizationMemberDao(role: OWNER)` **pour l'utilisateur courant**. C'est presque le
  provisioning, à un détail près décisif : l'OWNER créé est le SuperAdmin lui-même, pas
  l'administrateur initial désigné par email (critère 5).
- **`organization-service-facade.ts`** — ré-exporte tout via
  `interceptors/organization-service-logger-interceptor`. C'est la forme à suivre.
- **`organization-authorization.ts`** — 17 fonctions `can*`, dont `canCreateOrganization` (ligne 98),
  adossées à CASL (`userCan(authUser, ActionsConst.CREATE, SubjectsConst.ORGANIZATION)`).
- **Rôles globaux** — `src/services/types/domain/auth-types.ts` : `roleHierarchy` =
  `['public','user','redactor','moderator','admin','super_admin']`, `RoleConst.SUPER_ADMIN`
  existe. Rôles d'organisation : `owner`, `admin`, `member` (pgEnum `organization_role`).
  **La story a raison : rien à créer côté rôles.**
- **Back-office SuperAdmin** — `src/app/[locale]/admin/` : 15 sections, dont
  `admin/organizations/` (liste, détail, édition). `admin/layout.tsx` est gardé par
  `withAuthAdmin` (`src/components/features/auth/with-auth.tsx:36`) et porte `export const instant = false`.
  `admin/organizations/actions.ts` expose `updateOrganizationAction`, `deleteOrganizationAction`,
  `addUserToOrganizationAction`, `deleteAdminMemberInvitationAction` — **aucune action de création**.
- **Better Auth** — `src/lib/better-auth/auth.ts` (521 lignes), plugins `magicLink`, `admin()`,
  `organization({invitationLimit:10, membershipLimit:10, allowUserToCreateOrganization: false, …})`,
  `stripe(...)`, `customSession`. `allowUserToCreateOrganization: false` est déjà cohérent avec un
  provisioning réservé au SuperAdmin.

### Ce que l'architecture décrit et qui n'existe pas

C'est le point le plus important de cette recherche. `docs/architecture.md` et AGENTS.md décrivent
les conventions multi-tenant **au présent**, comme si elles étaient en place. Vérification :

```
grep -rn "getDb\|withTenant\|withRlsBypass" src/ drizzle/
→ deux faux positifs seulement (getDbPostBySlug dans blog-dal.ts)
```

- **`getDb()` n'existe pas.** `src/db/models/db.ts` exporte un `db` Drizzle **par défaut**, importé
  directement par les 12 repositories.
- **`withTenant()` et `withRlsBypass()` n'existent pas.**
- **Aucune RLS nulle part** : `grep -ril "ROW LEVEL SECURITY\|CREATE POLICY" drizzle/` ne retourne
  rien. Vérifié aussi en base — les 28 tables de `public` ont toutes `rowsecurity = f`.
- **`organization_setting` n'existe pas.** Le seul magasin de réglages est `app_settings`
  (`src/db/models/app-settings-model.ts`), **global** : `key: text('key').primaryKey()`, sans
  dimension tenant. C'est bien la situation décrite par l'ADR 010.

Ces conventions sont donc **le livrable de s01**, pas son point de départ. Un agent qui lirait
AGENTS.md sans ouvrir le code croirait l'inverse.

### Deux imprécisions de la doc, relevées au passage

- `docs/architecture.md` (Data model) liste `files` parmi les tables fournies par le boilerplate.
  **Il n'y a pas de table `files`** : `src/db/repositories/files-repository.ts` est un adaptateur de
  stockage Supabase (`@supabase/storage-js`, `createStorage`), pas un repository Drizzle. À corriger
  au passage, sinon s01 cherchera une table à équiper d'une policy qui n'existe pas.
- `knip.json` déclare `src/middleware.ts` en entrée ; le fichier réel est `src/proxy.ts`.

## Points d'ancrage

| Besoin                             | Fichier / fonction exacte                                                                                                                                                                                                                                                                              | État                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Colonne domaine + drapeaux modules | `src/db/models/auth-model.ts:152` (`organization`)                                                                                                                                                                                                                                                     | à étendre                            |
| Table `organization_setting`       | calquer `src/db/models/app-settings-model.ts` (clé composite au lieu de `key` seule)                                                                                                                                                                                                                   | à créer                              |
| Lecture tenant par domaine         | nouveau `getTenantByDomainDal` — patron : `src/app/dal/blog-dal.ts:174` (`cache()` + `'use cache'` + `cacheLife` + `cacheTag`)                                                                                                                                                                         | à créer                              |
| Invalidation au provisioning       | `updateTag` — précédent réel : `src/app/[locale]/admin/blog/actions.ts:54`, `admin/plans/actions.ts:40`                                                                                                                                                                                                | patron dispo                         |
| 404 sur domaine inconnu            | `src/app/[locale]/layout.tsx:25` appelle déjà `notFound()` (locale invalide). **C'est le layout racine — il n'y a pas de `src/app/layout.tsx`.**                                                                                                                                                       | ancrage naturel, mais voir Pièges    |
| Helper de contrôle de module       | **le patron existe déjà** : `isPageEnabled` (`src/lib/utils.ts:14`) + `notFound()` en tête de page, appliqué sur **17 pages** (ex. `(app)/account/api-keys/page.tsx:10`). Le helper de s01 en est le successeur **par tenant** (l'actuel lit une variable d'env globale, `NEXT_PUBLIC_ENABLED_PAGES`). | patron dispo                         |
| Provisioning                       | `createOrganizationService` (`src/services/organization-service.ts:66`)                                                                                                                                                                                                                                | à étendre (admin initial)            |
| Action de création au BO           | `src/app/[locale]/admin/organizations/actions.ts`                                                                                                                                                                                                                                                      | à créer (les 3 autres verbes y sont) |
| Garde SuperAdmin                   | `requireActionAuth({roles:[RoleConst.SUPER_ADMIN]})` (`src/app/dal/user-dal.ts:41`)                                                                                                                                                                                                                    | prêt                                 |
| Rôle applicatif Postgres           | `docker/db-init/*.sql`, `docker-compose.yml`, `.github/workflows/preview.yml`                                                                                                                                                                                                                          | à créer partout                      |

## APIs / fonctions vérifiées

Ouvertes une par une, signatures relevées dans le fichier :

- `getAuthUser()` — `src/services/authentication/auth-service.ts:15`, `cache(async () => …)`,
  retourne `session.user | undefined`.
- `requireActionAuth(options?: RequireAuthOptions)` — `src/app/dal/user-dal.ts:41`. Lève
  `AuthorizationError` si absent, si `options.uid` ne correspond pas (sauf admin), ou si
  `options.roles` n'est pas satisfait via `hasRequiredRoles`.
- `hasRequiredRole(user?, role?)` / `hasRequiredRoles(user?, roles?)` —
  `src/services/authentication/auth-util.ts`. **Comparaison par index dans `roleHierarchy`**, donc
  `super_admin` (index 5) satisfait une exigence `admin` (index 4). `withAuthAdmin` laisse donc bien
  passer le SuperAdmin.
- `withAuth(Component, requiredRole?)` / `withAuthAdmin(Component)` —
  `src/components/features/auth/with-auth.tsx:12` et `:36`. `redirect('/login')` si pas de session,
  `forbidden()` si rôle insuffisant.
- `createOrganizationService(organizationParams: CreateOrganization)` —
  `src/services/organization-service.ts:66`. Ordre réel : **autorisation puis validation**
  (l'inverse de l'ordre décrit dans `rule-architecture.md`) ; à noter si le plan s'en inspire.
- `getCurrentUserDal()` — `src/app/dal/user-dal.ts:138`, `'use cache: private'`.
- Surface Drizzle utilisée par les 12 repositories, comptée :
  `db.query` ×45, `db.insert` ×15, `db.transaction` ×14, `db.delete` ×14, `db.select` ×5,
  `db.update` ×1. **`getDb()` devra donc retourner un objet portant `query` (API relationnelle) et
  `transaction`** — c'est une contrainte de typage réelle : `NodePgDatabase<schema>` et
  `PgTransaction<…>` ne sont pas le même type, et 45 appels dépendent de `.query`.

### Le mécanisme de l'ADR 002, prouvé en base

Exécuté sur le Postgres 17 du `docker-compose`, sur une table `rls_probe` jetable (créée, testée,
**supprimée** — `pg_tables` revérifié à 0 après coup) :

| Situation                                                        | Résultat mesuré                                         | Conclusion                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rôle `asl` (propriétaire), `ENABLE` + `FORCE RLS`, aucun réglage | **voit les 2 lignes**                                   | `FORCE` ne protège **pas** d'un superuser/`BYPASSRLS`. Le rôle dédié n'est pas une précaution, c'est la condition.                                  |
| Rôle non-superuser, aucun `app.organization_id`                  | **0 ligne**                                             | fail-closed confirmé                                                                                                                                |
| Rôle non-superuser, tenant A posé                                | **la ligne A uniquement**                               | isolation confirmée                                                                                                                                 |
| Idem + `WHERE organization_id = <id de B>` (forge)               | **aucune ligne**                                        | critère 6 satisfait par la policy seule                                                                                                             |
| Idem + `app.bypass_rls = 'on'`                                   | **les 2 lignes**                                        | porte SuperAdmin confirmée                                                                                                                          |
| `INSERT` d'une ligne du tenant B depuis le scope A               | **`ERROR: new row violates row-level security policy`** | le `USING` d'une policy `FOR ALL` sert d'implicite `WITH CHECK`. **La SQL de l'ADR 002 est correcte telle quelle** — pas de `WITH CHECK` à ajouter. |

Deux points de mise en œuvre également vérifiés :

- **`SET LOCAL` ne se paramètre pas.** `PREPARE t1(text) AS SET LOCAL app.organization_id = $1`
  → `ERROR: syntax error at or near "SET"`. Interpoler l'`organizationId` dans la chaîne SQL serait
  une injection. **`set_config('app.organization_id', $1, true)` est la forme paramétrable** et se
  comporte identiquement.
- **La portée transactionnelle est réelle** : après `COMMIT`,
  `current_setting('app.organization_id', true)` est vide. Aucune fuite vers la requête suivante du
  pool, ce qui est exactement l'argument de l'ADR 002 contre le `SET` de session.

## Surface du retrait (ADR 009)

Chiffré, pas estimé.

- **91 fichiers/dossiers** portent un nom de sous-système retiré
  (`project|credit|affiliate|chat|newsletter`).
- **44 fichiers conservés** référencent au moins un de ces sous-systèmes. Ce sont eux le vrai coût.
  Les plus structurants, ouverts et vérifiés :
  - `src/services/authorization/casl-abilities.ts` — `'Project'`, `'Task'`, `'Credit'`,
    `'Affiliate'` sont des `Subjects` du type union (lignes 20-30), déclarés en constantes
    (46-56) et utilisés dans ~14 règles `can(...)` réparties sur tous les rôles globaux et
    d'organisation. **C'est le fichier central de l'autorisation** : le retrait le réécrit en
    profondeur.
  - `src/lib/better-auth/auth.ts` — le hook `onSubscriptionComplete` du plugin Stripe appelle
    `allocateCreditsOnSubscriptionService`. Retirer les crédits **oblige à toucher le fichier
    d'authentification**, qui est par ailleurs conservé intégralement.
  - `src/services/types/domain/notification-types.ts` — `project_created` / `project_updated` dans
    le type `NotificationType` et dans les metadata typées. **Bonne nouvelle** : la colonne
    `notifications.type` est un `text`, pas un `pgEnum` (`src/db/models/notification-model.ts:20`)
    → aucune migration d'énuméré à générer.
  - `src/services/types/domain/subscription-types.ts:69` — `LimitType = 'projects' | 'storage' | 'users'`
    et `subscription_plan.limits` en base contiennent `projects` et `credits`. Stripe est conservé :
    ces limites deviennent orphelines et doivent être arbitrées, pas supprimées à l'aveugle.
  - `src/db/scripts/seed.ts` — **731 lignes de SQL brut**, avec des blocs `INSERT` complets pour
    `project`, `task`, les plans porteurs de `credits`, et des notifications de type
    `project_created`. Une réécriture substantielle, pas un nettoyage.
  - Aussi concernés : `src/lib/helper/menu-helper.ts`, les 5 fichiers de
    `components/features/layouts/sidebar/`, `src/lib/stripe/stripe-events.ts`,
    `src/services/authorization/authorization-service.ts`, `src/db/models/db.ts` (imports de schéma),
    `src/proxy.ts` (`/chat` dans `AUTHENTICATED_SEGMENTS`).

- **La table des chemins de l'ADR 009 est incomplète.** Elle cite
  `src/components/features/projects` mais **pas** `src/app/dal/task-dal.ts` ni
  `src/components/features/tasks/` (5 fichiers : `task-board`, `task-card`, `task-column`,
  `create-task-modal`, `task-form-validation`). La commande de récupération de l'ADR les manquerait
  aussi. À compléter dans le commit de s01.

- **Baseline de tests avant retrait, mesurée** : `pnpm test --run` →
  `Test Files 23 passed | 2 skipped (25)`, `Tests 451 passed | 8 skipped (459)`, 32 s.
  Les 5 fichiers de test qui partent avec les sous-systèmes contiennent **118 `it()`**
  (project 32, credit 41, affiliate 26, stripe-affiliate-webhook 9, credit-period-helper 10).
  **Cible attendue après retrait : ~333 tests passants, 18 fichiers.** Un écart notable signale un
  effet de bord, pas un retrait propre.

- Deux règles pointent nommément vers `projects` et doivent être mises à jour **dans le même
  commit** (ADR 009, AGENTS.md) : `.claude/rules/01-presentation/rule-react-query.md` et
  `.claude/rules/02-services/rule-seed-usersroles-and-organization.md`. `docs/architecture.md`
  désigne aussi `createProjectService` comme « modèle canonique » et demande à s01 de nommer son
  remplaçant. Rappel : `.cursor/rules/` est **généré** — `pnpm check:rules --fix`, jamais d'édition
  directe.

## Pièges et contraintes

### 1. Le rôle Postgres actuel rend la RLS totalement inerte — partout

Mesuré (`\du` sur la base de dev) :

```
 asl | Superuser, Create role, Create DB, Replication, Bypass RLS
```

Les 28 tables lui appartiennent. Comme démontré plus haut, `FORCE ROW LEVEL SECURITY` **ne protège
pas** d'un tel rôle. Sans rôle applicatif dédié, les policies écrites par s01 seraient posées,
visibles en base, et **sans aucun effet** — le pire des cas, parce que silencieux.

Trois endroits à traiter, pas un :

- **dev** : `docker-compose.yml` (`POSTGRES_USER: asl`) + `docker/db-init/` (deux scripts existent
  déjà, `01-extensions.sql` et `02-test-database.sql` — c'est là que le rôle applicatif s'ajoute) ;
- **test** : la base `asl_cms_test` est créée `OWNER asl` par `02-test-database.sql` ;
- **CI** : `.github/workflows/preview.yml:147` → `POSTGRES_USER: test`, soit là encore le superuser
  de l'image. `DATABASE_URL: postgresql://test:test@localhost:5432/test`.

### 2. La CI n'appliquerait jamais les policies — le test d'isolation serait vert pour rien

`.github/workflows/preview.yml:205` : `run: pnpm db:push && pnpm db:seed`.

`db:push` est `drizzle-kit push --force` : il diffe le schéma TypeScript contre la base et applique
directement. **Il ne lit pas `drizzle/migrations/`.** Les policies RLS, qui passent obligatoirement
par `drizzle-kit generate --custom` (AGENTS.md, ADR 002), **ne seraient donc jamais créées dans la
base de la CI**. Combiné au point 1, le test e2e d'accès croisé exigé par les critères 6 et 7
passerait sans rien prouver.

Le job e2e doit basculer sur `pnpm db:migrate`. Effet de bord à anticiper : la CI ne crée pas les
extensions `uuid-ossp` / `pgcrypto` (elles ne viennent que de `docker/db-init/01-extensions.sql`, et
aucune migration ne les crée — vérifié : `grep -n "EXTENSION" drizzle/migrations/*.sql` → rien).
`organization.id` a pour défaut `uuid_generate_v4()`. Ce point est à vérifier au plan.

### 3. Le 404 exigé par les critères 2 et 4 se heurte à une limite déjà mesurée du projet

Sous Cache Components, une page streame un shell avant que le rendu décide. Un `notFound()` ou un
`forbidden()` déclenché en cours de rendu part **après** le début d'un `200` et ne peut plus changer
le statut. Ce n'est pas une hypothèse : c'est écrit dans `src/app/[locale]/admin/layout.tsx:23-30`,
documenté en D20 de `docs/plans/cache-components-migration.md`, et **mesuré** par
`e2e/authorization.spec.ts` — trois `expect(response?.status()).toBe(200)` sur des pages refusées.

Or s01 demande explicitement « un domaine inconnu répond **404** » et « une route rattachée à un
module inactif … répond **404** — pas un lien masqué, pas une page vide ». Le contournement habituel
du dépôt est `src/proxy.ts`, mais **l'ADR 003 interdit d'y résoudre le tenant** (runtime Edge, pas de
`node-postgres`). Contrepoint utile relevé en D20 : les **Route Handlers ne streament pas de shell**
et rendent de vrais statuts (`src/lib/api-auth.ts` rend 401 et 403, vérifié par spec). C'est une
tension réelle à arbitrer au plan — voir Questions ouvertes.

### 4. « Test au niveau repository » (critère 7) est irréalisable tel qu'écrit

`src/db/models/db.ts` lève `Database connections are not allowed during tests.` quand
`NEXT_PUBLIC_NODE_ENV === 'test'`, et la convention du projet (`rule-services-tests.md`,
`setup-mocks.ts`) mocke tous les repositories. L'ADR 002 le dit explicitement : le test d'isolation
est un **e2e Playwright**. Le critère 7 doit se lire « couche applicative court-circuitée », pas
« test unitaire de repository ».

### 5. Les e2e devront servir deux hosts, et `baseURL` n'en connaît qu'un

`playwright.config.ts` fixe `baseURL: http://localhost:${PORT}` (3000 par défaut), un seul host, et
aucun projet multi-domaine. Les critères 2 et 6 exigent deux domaines distincts. À savoir :
Chromium interdit de surcharger l'en-tête `Host` via `extraHTTPHeaders` (en-tête protégé), donc la
solution passe par deux **noms** réellement résolus vers la même adresse — `localhost` et
`127.0.0.1` sont déjà deux `Host` différents, et des noms en `*.localtest.me` en donnent d'autres
sans toucher `/etc/hosts`. Forme exacte à trancher au plan.

### 6. Le layout racine est prerendu, et la résolution par domaine le rend dépendant de la requête

`src/app/[locale]/layout.tsx` est le layout racine (il n'y a pas de `src/app/layout.tsx`) et porte
`generateStaticParams()`. Y lire `headers()` pour obtenir le `Host` rend **toute** page dépendante de
la requête. L'ADR 003 l'assume explicitement (« aucune page n'est prerendue par tenant au build »,
le contenu restant caché par `'use cache'` indexé sur `organizationId`), mais c'est le changement le
plus large de la story et il touche les 21 routes `(app)` passées en `◐` par la migration Cache
Components. Rappel de la règle : le `Host` se lit **hors** du scope caché et se passe en argument.

### 7. Autres points relevés

- `pnpm test` est `vitest --pool=forks` — **mode watch**, ne rend jamais la main. `pnpm test --run`
  (confirmé : c'est ainsi que la baseline ci-dessus a été obtenue).
- `createOrganizationService` inverse l'ordre autorisation/validation par rapport à
  `rule-architecture.md`. Les nouveaux services de s01 devraient suivre la règle
  (`safeParse` → `can*` → repository), comme le fait `createProjectService` — qui disparaît.
- L'i18n est encore en `locales: ['en','fr','es']`, `defaultLocale: 'en'` (`src/i18n/routing.ts`),
  avec `messages/en.json`, `es.json`, `fr.json`. **L'ADR 008 n'est appliqué nulle part** et
  **aucune story ne le porte** (`grep` sur `docs/stories.md` : rien).
- `organization.slug` est `unique()` mais **nullable**. Le provisioning devra le rendre obligatoire
  ou vivre avec.
- ADR 002 introduit `DATABASE_MIGRATION_URL` : à déclarer dans `src/env-schemas.ts` (à côté de
  `DATABASE_URL: z.string().url()`, ligne 59) **et** dans le `runtimeEnv` de `src/env.ts` (ligne 54).
  Oublier le second est l'erreur classique de `@t3-oss/env-nextjs`.
- `pnpm knip` est configuré (`knip.json`) et l'ADR 009 demande de le passer après retrait.
- `pnpm check:rules` vérifie l'alignement `.claude/rules` ↔ `.cursor/rules` et une liste de
  `STALE_PATTERNS` (`scripts/check-rules.ts`) — à faire tourner après mise à jour des deux règles.

## Questions ouvertes

À trancher au plan (`/ks-plan`), pas ici.

1. **Comment obtenir un vrai 404 (critères 2 et 4) malgré le streaming ?** C'est la question
   bloquante. Trois voies apparaissent, aucune évidente : (a) accepter un `200` portant l'UI
   not-found, comme D20 l'a fait pour le 403 — mais s01 écrit « pas une page vide », ce qui semble
   viser exactement ce compromis ; (b) rendre le layout racine bloquant (`instant = false`) pour que
   la décision précède le stream — à vérifier, car `admin/layout.tsx` fait déjà `await` au niveau
   supérieur **et rend quand même 200** ; (c) un contrôle en amont dans `proxy.ts`, ce que l'ADR 003
   exclut pour le tenant faute d'accès Postgres depuis l'Edge — sauf à s'appuyer sur une source non
   Postgres, ce qui est un nouvel arbitrage. **Le point mérite peut-être un ADR complémentaire.**
2. **`db:push` → `db:migrate` en CI : dans s01 ou séparément ?** Le changement est petit mais touche
   la CI de tout le projet, et traîne la question des extensions Postgres non créées en CI.
3. **Forme exacte du couple domaine/tenant** : une colonne `domain` unique sur `organization`
   (ADR 003, « un domaine par association ») suffit-elle, ou faut-il une table `organization_domain`
   pour couvrir domaine de recette **et** domaine définitif simultanément ? L'ADR mentionne les
   sous-domaines de plateforme comme « compatibles », ce qui suggère plusieurs entrées par tenant.
4. **Qui porte l'ADR 008 (locale unique) ?** Aucune story ne le revendique et le code est encore en
   trois locales. s01 est le candidat naturel — il touche déjà le layout racine et le routage — mais
   ce serait un élargissement au-delà des critères d'acceptation. À décider explicitement plutôt
   qu'à laisser tomber entre deux stories.
5. **Quel domaine devient l'« implémentation de référence » en remplacement de `projects` ?**
   `docs/architecture.md` le demande à s01, mais s01 ne crée aucun domaine métier CRUD complet — le
   premier candidat réel est s04/s05 (pages, actualités). Faut-il désigner `organization` /
   `organization_setting`, ou déplacer la tâche à s05 ?
6. **Le registre d'actions est créé par s03**, mais s01 introduit des actions soumises à
   autorisation (provisionner, activer un module). Les déclare-t-on rétroactivement en s03, ou s01
   avance-t-il la création du registre ? La règle transverse ne tranche pas ce cas — celui de la
   toute première story.
7. **Que deviennent les limites d'abonnement `projects` et `credits`** (`LimitType`,
   `subscription_plan.limits`, `organization.limitOverrides`) une fois les deux sous-systèmes
   retirés, sachant que Stripe est conservé ? Les retirer touche la facturation plateforme ; les
   garder laisse des limites qui ne limitent rien.
8. **Forme du multi-host pour Playwright** (deux projets, deux `baseURL`, `localtest.me` ?) — la
   contrainte est vérifiée, la solution reste à choisir.

<< IP Mike: exploration method, what a good research always verifies. >>
