# Research — Story s01-provisionner-association

> Contexte **re-vérifié le 2026-09-10** sur `feature/s01-provisionner-association` (`9418282`),
> Postgres 17 du `docker-compose` (interrogé en direct), Next 16.3.0 / React 19.2.8 /
> Better Auth 1.7.1 / Drizzle 0.45.2 / next-intl 4.13.5.
> Aucune ligne de code écrite. Chaque affirmation vient d'un fichier ouvert ou d'une commande
> exécutée ; ce qui n'a pas pu l'être est en « Questions ouvertes », pas deviné.
>
> **Cette révision remplace celle du 2026-09-09**, qui ne valait que pour `main`@`e672c3e` du
> 8 septembre et le disait elle-même (« le reste du document n'a pas été recontrôlé »). Deux
> choses ont bougé depuis : le travail de socle **a été fusionné** (`8201357`), et la mesure du
> retrait ADR 009 a été refaite intégralement — elle était sous-estimée. Tout ce qui suit est
> daté du 10 septembre.

## Story cible

**s01-provisionner-association** — « En tant que SuperAdmin Zourite Studio je veux créer une
association et activer ses modules afin qu'elle dispose d'un site isolé sans écrire une ligne de
code. » Complexité 4. Aucune dépendance : première story du projet.

`docs/reviews/stories.md` se termine par `Max severity: minor` / `Stories ready: yes`. Le découpage
a passé la revue.

**Dix critères d'acceptation** (et non sept : la revue du découpage en a ajouté trois sur le retrait
ADR 009), qui se regroupent en cinq chantiers :

| #   | Critère (abrégé)                                                                         | Chantier     |
| --- | ---------------------------------------------------------------------------------------- | ------------ |
| 1   | Créer une association depuis le BO SuperAdmin → tenant écrivable/relisible aussitôt      | Provisioning |
| 5   | **Administrateur initial** désigné par email, rattaché à ce tenant seul, droits vérifiés | Provisioning |
| 2   | Requête rattachée au tenant par le **domaine appelé** ; domaine inconnu → **404**        | Routage      |
| 3   | Drapeaux de modules persistés, modifiables, différents d'un tenant à l'autre             | Modules      |
| 4   | Route d'un module inactif **ou clé inconnue** → **404** (pas un lien masqué)             | Modules      |
| 6   | Requête authentifiée tenant A ne voit rien de B, **même en forgeant l'id**               | Isolation    |
| 7   | La policy RLS refuse la lecture inter-tenant **couche applicative court-circuitée**      | Isolation    |
| 8   | Les 5 sous-systèmes ADR 009 ont disparu : schéma, tests, `pnpm knip`                     | Retrait      |
| 9   | Aucune table métier restante sans policy RLS ; exemptions = liste `architecture.md`      | Retrait/RLS  |
| 10  | Les 2 règles ne citent plus `projects` ; `pnpm check:rules` passe                        | Retrait      |

**Les décisions que la story demandait de trancher en `/ks-architect` le sont déjà** — le plan les
applique, il n'a pas à les rouvrir :

- **ADR 002** : rôle applicatif `asl_app` (ni propriétaire ni `BYPASSRLS`) + `DATABASE_MIGRATION_URL`
  pour les migrations ; `ENABLE` + `FORCE ROW LEVEL SECURITY` ; policy `tenant_isolation` fail-closed
  sur `current_setting('app.organization_id', true)` avec porte `app.bypass_rls`; helper
  `withTenant(organizationId, callback)` publiant la transaction dans un `AsyncLocalStorage`, lu par
  `getDb()` ; `withRlsBypass()` réservé à s01 et s41.
- **ADR 003** : tenant résolu **côté serveur depuis l'en-tête `Host`**, pas dans le proxy ;
  `getCurrentTenant()` → `getTenantByDomainDal(host)` en `'use cache'` + `cacheLife('hours')` +
  `cacheTag('tenant')`, le host lu **hors** du scope caché ; **un domaine par association**, colonne
  indexée unique sur `organization`.
- **ADR 010** : `organization_setting` en clé composite `(organization_id, key)` + colonnes `value`,
  `type`, `category`, `label`, `description` ; activation de modules en **colonne typée par énuméré**
  sur `organization`, contrôlée par **un helper unique** appelant `notFound()`, clé inconnue traitée
  comme inactive.
- **ADR 009** : périmètre et commandes de récupération du retrait.
- **ADR 012** : le mode sombre est **conservé** (voir Pièges §1).

## État actuel du code

### Ce qui existe et sert de socle

- **`organization`** — `src/db/models/auth-model.ts:152`. Colonnes exactes : `id` (uuid, défaut
  `uuid_generate_v4()`), `name` (notNull), `slug` (**`unique()` mais nullable**), `description`,
  `createdAt`, `updatedAt`, `logo`, `metadata` (text), `limitOverrides` (json
  `Record<string, number>`). **Ni domaine, ni drapeaux de modules.**
  `src/db/models/organization-model.ts` ne porte que les `relations` Drizzle et les types
  `OrganizationModel` / `AddOrganizationModel` / `MemberModel`.
- **`organization-repository.ts`** — 21 fonctions `*Dao`, dont `createOrganizationDao`,
  `getOrganizationBySlugDao`, `createOrganizationMemberDao`, `generateUniqueSlug`.
  **Pas de `getOrganizationByDomainDao`.**
- **`organization-service.ts`** — `createOrganizationService` à la **ligne 66**.
- **`organization-service-facade.ts`** — ré-exporte tout via
  `interceptors/organization-service-logger-interceptor`. C'est la forme à suivre.
- **Rôles** — `src/services/types/domain/auth-types.ts` : `roleHierarchy` =
  `['public','user','redactor','moderator','admin','super_admin']`. Rôles d'organisation :
  pgEnum `organization_role` = `['admin','member','owner']`. **La story a raison : rien à créer.**
- **Back-office SuperAdmin** — `src/app/[locale]/admin/`, dont `admin/organizations/`.
  `admin/layout.tsx` est gardé par `withAuthAdmin` et porte `export const instant = false`.
- **Better Auth** — `src/lib/better-auth/auth.ts` (521 lignes), plugins `magicLink`, `admin()`,
  `organization({allowUserToCreateOrganization: false, …})`, `stripe(...)`, `customSession`.
  `allowUserToCreateOrganization: false` est déjà cohérent avec un provisioning réservé au SuperAdmin.

### Ce que l'architecture décrit au présent et qui n'existe pas

C'est le point le plus important de cette recherche, et il est **inchangé** depuis le 8 septembre.
`docs/architecture.md` et AGENTS.md décrivent les conventions multi-tenant comme si elles étaient en
place. Vérifié le 10 septembre :

```
grep -rn 'getDb\|withTenant\|withRlsBypass' src/ drizzle/   → rien (hors getDbPostBySlug)
grep -ril 'ROW LEVEL SECURITY\|CREATE POLICY' drizzle/       → rien
grep -rn 'organization_setting\|organizationSetting' src/    → rien
grep -rn 'app.organization_id' src/                          → rien
```

Et **mesuré en base** (`psql -h db -U asl -d asl_cms`, le 10 septembre) :

```
select rolname, rolsuper, rolbypassrls from pg_roles where rolname not like 'pg\_%';
→ asl | super=true | bypassrls=true          (seul rôle non système)

select count(*), count(*) filter (where rowsecurity) from pg_tables where schemaname='public';
→ tables=28  with_rls=0
select count(*) from pg_policies;  → 0
```

- **`getDb()`, `withTenant()`, `withRlsBypass()` n'existent pas.** `src/db/models/db.ts` fait
  `export default db` (un `NodePgDatabase` sur un `Pool`), importé directement par les repositories.
- **Aucune RLS, aucune policy, nulle part** — ni dans les migrations, ni en base.
- **`organization_setting` n'existe pas.** Le seul magasin de réglages est `app_settings`
  (`key: text('key').primaryKey()`), **global**, sans dimension tenant. Situation exacte de l'ADR 010.
- **`asl_app` n'existe pas** : `asl` est le seul rôle, et c'est le superuser bootstrap de l'image.

Ces conventions sont donc **le livrable de s01**, pas son point de départ.

### Les 28 tables, et lesquelles survivent

`grep` sur les 10 fichiers de `src/db/models/` → **28 `pgTable()`**, ce qui recoupe exactement les
28 tables comptées en base.

**8 partent avec l'ADR 009** : `affiliate`, `affiliate_commission`, `affiliate_payout`,
`affiliate_program_reward`, `referral` (affiliate-model), `credit_ledger` (credit-ledger-model),
`project`, `task` (project-model). Chat et newsletter n'ont **aucune table** — code seul.

**20 survivent** : `account`, `apikey`, `app_settings`, `categories`, `hashtags`, `invitation`,
`member`, `notifications`, `organization`, `post_hashtags`, `posts`, `posts_translation`, `session`,
`subscription`, `subscription_plan`, `two_factor`, `user`, `user_settings`, `user_submissions`,
`verification`.

C'est là qu'il y a une **surprise pour le critère 9**. Après retrait, les tables portant
`organization_id` ne sont plus que **trois** :

| Table              | Emplacement                   |
| ------------------ | ----------------------------- |
| `member`           | `auth-model.ts:178`           |
| `invitation`       | `auth-model.ts:197`           |
| `user_submissions` | `user-submission-model.ts:25` |

Tout le reste des colonnes `organization_id` était dans affiliate / credit / project, qui disparaissent.

La liste d'exemption de `docs/architecture.md:183` en couvre **cinq** : `user`, `session`, `account`,
`verification`, `app_settings` (+ les tables de migration Drizzle).

**Il reste donc 12 tables ni scopées ni exemptées** : `apikey`, `categories`, `hashtags`,
`notifications`, `organization`, `post_hashtags`, `posts`, `posts_translation`, `subscription`,
`subscription_plan`, `two_factor`, `user_settings`.

Le critère 9 est écrit « les tables exemptées sont **exactement** celles listées dans
`docs/architecture.md` ». Lu strictement, il n'est pas satisfiable en l'état : ces 12 tables doivent
être classées, et `architecture.md:183` prévoit d'ailleurs le geste (« toute addition à cette liste
se justifie en revue »). Éléments relevés pour cette classification :

- `organization` **est** le tenant : elle ne porte pas `organization_id` par nature.
- `notifications`, `two_factor`, `user_settings` portent `user_id` — scopées par utilisateur.
- `subscription` porte `reference_id` (**text**, polymorphe Better Auth ; avec
  `NEXT_PUBLIC_BILLING_MODE=organization` c'est l'id d'organisation) — donc **de fait** rattachée au
  tenant, mais par une colonne que la policy `organization_id` de l'ADR 002 **ne verrait pas**.
  Piège réel, à trancher.
- `posts`, `categories`, `hashtags`, `post_hashtags`, `posts_translation`, `apikey` ne portent
  aucun rattachement tenant. `posts` (`authorId`, `categoryId`) est la base des actualités s05 :
  c'est s04/s05 qui lui ajoutera `organization_id`.

## Points d'ancrage

| Besoin                             | Fichier / fonction exacte                                                                                                                                                        | État                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Colonne domaine + drapeaux modules | `src/db/models/auth-model.ts:152` (`organization`)                                                                                                                               | à étendre                                |
| Table `organization_setting`       | calquer `src/db/models/app-settings-model.ts` (clé composite au lieu de `key` seule)                                                                                             | à créer                                  |
| Lecture tenant par domaine         | nouveau `getTenantByDomainDal` — patron : `src/app/dal/blog-dal.ts` (`cache()` + `'use cache'` + `cacheLife` + `cacheTag`)                                                       | à créer                                  |
| Invalidation au provisioning       | `updateTag` — précédents réels : `admin/blog/actions.ts`, `admin/plans/actions.ts`                                                                                               | patron dispo                             |
| Layout racine (404 domaine)        | `src/app/[locale]/layout.tsx` — **c'est le layout racine, il n'y a pas de `src/app/layout.tsx`** ; appelle déjà `notFound()` (locale invalide) et porte `generateStaticParams()` | ancrage naturel, **mais voir Pièges §3** |
| Injection de la teinte tenant      | `src/app/[locale]/base-layout.tsx` — c'est lui qui rend `<html>`                                                                                                                 | voir Pièges §2                           |
| Helper de contrôle de module       | **patron existant** : `isPageEnabled` (`src/lib/utils.ts:14`) + `notFound()` en tête de page, sur **14 `page.tsx`**                                                              | patron dispo                             |
| Provisioning                       | `createOrganizationService` (`src/services/organization-service.ts:66`)                                                                                                          | à étendre (admin initial)                |
| Rattacher l'admin initial          | `addUserToOrganizationAction` (`admin/organizations/actions.ts:107`) — **prend un `userId` existant**                                                                            | patron dispo, ne crée pas le compte      |
| Action de création au BO           | `src/app/[locale]/admin/organizations/actions.ts`                                                                                                                                | **à créer** (les 3 autres verbes y sont) |
| Garde SuperAdmin                   | `requireActionAuth({roles: [RoleConst.SUPER_ADMIN]})` (`src/app/dal/user-dal.ts:41`)                                                                                             | prêt                                     |
| Rôle applicatif Postgres           | `docker/db-init/`, `docker-compose.yml`, `.github/workflows/preview.yml`                                                                                                         | **à créer partout**                      |

## APIs / fonctions vérifiées

Ouvertes une par une, signatures relevées dans le fichier :

- **`getAuthUser()`** — `src/services/authentication/auth-service.ts:15`, `cache(async () => …)`.
  Passe par `getSessionAuth()` (`auth.api.getSession({headers: await headers()})`) et retourne
  `session.user` ou `undefined`.
- **`requireActionAuth(options?: RequireAuthOptions)`** — `src/app/dal/user-dal.ts:41`, enveloppé de
  `cache()`. Lève `AuthorizationError` si pas de session, si `options.uid` ne correspond pas (sauf
  admin), ou si `options.roles` n'est pas satisfait via `hasRequiredRoles`. Retourne le `user`.
- **`hasRequiredRole` / `hasRequiredRoles`** — `src/services/authentication/auth-util.ts`.
  **Comparaison par index dans `roleHierarchy`** : `super_admin` (5) satisfait une exigence `admin`
  (4). `withAuthAdmin` laisse donc bien passer le SuperAdmin.
- **`withAuth(Component, requiredRole?)` / `withAuthAdmin(Component)`** —
  `src/components/features/auth/with-auth.tsx:12` et `:36`. `redirect('/login')` sans session,
  `forbidden()` si rôle insuffisant.
- **`createOrganizationService(organizationParams: CreateOrganization)`** —
  `src/services/organization-service.ts:66`. Corps réel, dans l'ordre :
  `canCreateOrganization()` → `createOrganizationServiceSchema.safeParse` → `createOrganizationDao`
  → `createOrganizationMemberDao({role: OWNER})` **pour `getAuthUser()`**.
  → Deux conséquences : (a) l'ordre est **autorisation puis validation**, l'inverse de
  `rule-architecture.md` ; (b) l'OWNER créé est **le SuperAdmin lui-même**, pas l'administrateur
  initial désigné par email. C'est précisément l'écart que le critère 5 doit combler.
- **`addUserToOrganizationAction(organizationId, userId, email, role = member)`** —
  `admin/organizations/actions.ts:107`. Fait `requireActionAuth({roles: [ADMIN, SUPER_ADMIN]})`,
  puis `canInviteToOrganization`, puis `createOrganizationMemberService`. **Exige un `userId`
  existant** : le critère 5 (« désigné par son adresse email ») demande donc en plus la création du
  compte. À noter, un `checkMembersLimit` y est commenté (lié aux limites d'abonnement, cf. Q7).
- **`isPageEnabled(page: EnabledPage)`** — `src/lib/utils.ts:14`, une ligne :
  `env.NEXT_PUBLIC_ENABLED_PAGES.includes(page)`. C'est **une variable d'env globale**
  (`src/env-schemas.ts:198`). Le helper de s01 en est le successeur **par tenant** ; le patron
  d'appel (`if (!isPageEnabled(...)) return notFound()`) est repris tel quel — voir
  `(app)/account/api-keys/page.tsx:10`.
- **`getCurrentUserDal()`** — `src/app/dal/user-dal.ts`, `'use cache: private'`.
- **Surface Drizzle** : `getDb()` devra retourner un objet portant `.query` (API relationnelle) et
  `.transaction`. Contrainte de typage réelle — `NodePgDatabase<schema>` et `PgTransaction<…>` ne
  sont pas le même type, et l'essentiel des appels des repositories passe par `.query`.

### Le mécanisme de l'ADR 002, prouvé en base

Mesuré le 8 septembre sur le Postgres 17 du `docker-compose`, sur une table `rls_probe` jetable
(créée, testée, **supprimée** — `pg_tables` revérifié à 0). Ces mesures **n'ont pas été refaites le
10 septembre**, mais rien dans l'intervalle n'a touché la base ; l'état de départ (`asl` superuser,
0 policy) est en revanche re-mesuré ci-dessus.

| Situation                                                        | Résultat mesuré                                         | Conclusion                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rôle `asl` (propriétaire), `ENABLE` + `FORCE RLS`, aucun réglage | **voit les 2 lignes**                                   | `FORCE` ne protège **pas** d'un superuser/`BYPASSRLS`. Le rôle dédié est la condition, pas un luxe                   |
| Rôle non-superuser, aucun `app.organization_id`                  | **0 ligne**                                             | fail-closed confirmé                                                                                                 |
| Rôle non-superuser, tenant A posé                                | **la ligne A uniquement**                               | isolation confirmée                                                                                                  |
| Idem + `WHERE organization_id = <id de B>` (forge)               | **aucune ligne**                                        | critère 6 satisfait par la policy seule                                                                              |
| Idem + `app.bypass_rls = 'on'`                                   | **les 2 lignes**                                        | porte SuperAdmin confirmée                                                                                           |
| `INSERT` d'une ligne du tenant B depuis le scope A               | **`ERROR: new row violates row-level security policy`** | le `USING` d'une policy `FOR ALL` sert de `WITH CHECK` implicite → **la SQL de l'ADR 002 est correcte telle quelle** |

Deux points de mise en œuvre également vérifiés :

- **`SET LOCAL` ne se paramètre pas.** `PREPARE t1(text) AS SET LOCAL app.organization_id = $1`
  → `ERROR: syntax error at or near "SET"`. Interpoler l'`organizationId` dans la chaîne serait une
  injection. **`set_config('app.organization_id', $1, true)` est la forme paramétrable** et se
  comporte identiquement. ⚠️ L'ADR 002 écrit `SET LOCAL` : c'est le seul point où le plan devra
  s'écarter de sa lettre pour respecter son intention.
- **La portée transactionnelle est réelle** : après `COMMIT`,
  `current_setting('app.organization_id', true)` est vide. Aucune fuite vers la requête suivante du
  pool — exactement l'argument de l'ADR 002 contre un `SET` de session.

## Surface du retrait (ADR 009)

Re-mesurée intégralement le 10 septembre. **Elle est plus large que ce que disait la révision
précédente**, et surtout plus large que ce que nomme l'ADR.

**Baseline avant retrait, exécutée** (`pnpm test --run`) :

```
Test Files  23 passed | 2 skipped (25)
Tests      451 passed | 8 skipped (459)     — 26 s
```

Les **5 fichiers de test qui partent** avec les sous-systèmes contiennent **118 `it()`** :
`project-service` 32, `credit-service` 41, `affiliate-service` 26, `credit-period-helper` 10,
`stripe-affiliate-webhook` 9. **Cible après retrait : ~333 tests, 18 fichiers** (à ajuster de 15 si
`referral-helper.test.ts` part aussi, cf. ci-dessous). Un écart notable signalera un effet de bord,
pas un retrait propre. S'y ajoute **`e2e/affiliate.spec.ts` (9 `test()`)**, bien nommé par l'ADR.

### La table des chemins de l'ADR 009 nomme moins de la moitié du travail

Sur les **100 fichiers** de `src/` + `e2e/` dont le nom porte
`project|credit|affiliate|chat|newsletter` (hors contenu MDX des docs), **45 ne sont couverts par
aucune entrée de la table de l'ADR**. Les plus structurants :

- **Pages et actions du BO et de l'espace utilisateur** :
  `(app)/account/affiliate/` (4 fichiers), `(app)/account/billing/credit/` (3),
  `(app)/team/[slug]/credits-simulator/` (3), `(app)/team/[slug]/projects/` (7),
  `(app)/team/[slug]/react-query/projects-react-query.tsx`, `admin/affiliates/` (3),
  `admin/credits/` (2).
- **Couche service non nommée** : `services/authorization/credit-authorization.ts`, les **4
  interceptors** (`affiliate|credit|newsletter|project-service-logger-interceptor.ts`), les types
  `affiliate-types.ts` / `credit-types.ts` / `project-types.ts`, les validations
  `affiliate-validation.ts` / `credit-validation.ts`.
- **Front React Query** : `src/lib/api/projects-api.ts`, `src/components/hooks/client/project-client.ts`,
  `src/components/features/admin/{affiliates,credits}/`, `features/layouts/sidebar/nav-projects.tsx`,
  `features/blog/newsletter-inline.tsx` (l'ADR ne nomme que `newsletter-form.tsx`).

**Et 9 fichiers de plus sont invisibles au motif de recherche** — l'ADR ne les mentionne pas non
plus (`grep` sur l'ADR : `task-dal|features/tasks` → 0, `referral` → 0) :

- **Tâches (6)** : `src/app/dal/task-dal.ts` et `src/components/features/tasks/`
  (`task-board`, `task-card`, `task-column`, `create-task-modal`, `task-form-validation`).
- **Parrainage (3)** : `src/lib/helper/referral-helper.ts`, `referral-helper.server.ts`,
  `referral-helper.test.ts` (**15 `it()`**). C'est la porte d'entrée du sous-système d'affiliation,
  et elle est câblée dans du code **conservé** : `src/proxy.ts` (lignes 10-13 et 107-118, pose du
  cookie de parrainage), `src/env-schemas.ts:3` et `:185` (`NEXT_PUBLIC_AFFILIATE_TRACKING`,
  `REFERRAL_TRACKING_MODES`), `src/lib/better-auth/auth.ts`, `(auth)/action.ts`,
  `auth-form-validation.ts`. La table `referral` part, elle, avec `affiliate-model.ts`.

**Soit 54 fichiers que le plan doit retrouver lui-même.** L'ADR le prévoit à demi-mot (« les
fichiers satellites se retrouvent par `git ls-tree -r --name-only upstream/main | grep -i
<sous-système>` ») mais ce filet ne rattrape ni `tasks` ni `referral`, dont le nom ne contient aucun
des cinq motifs. **À compléter dans le commit de s01**, sinon la commande de récupération V2 de
l'ADR 009 ramènera un sous-système incomplet.

### Les fichiers conservés qui référencent les sous-systèmes

C'est là qu'est le vrai coût. **56 fichiers conservés** citent au moins un sous-système retiré.
Ouverts et vérifiés :

- **`src/services/authorization/casl-abilities.ts`** — `'Project'`, `'Task'`, `'Credit'`,
  `'Affiliate'` sont des membres du type union `Subjects` (lignes 20-30), déclarés en constantes
  (46-56), et **17 lignes du fichier** utilisent `SubjectsConst.{PROJECT,TASK,CREDIT,AFFILIATE}`
  dans des règles `can(...)` réparties sur tous les rôles. **C'est le fichier central de
  l'autorisation** : le retrait le réécrit en profondeur.
- **`src/lib/better-auth/auth.ts`** — fichier d'authentification **conservé intégralement**, et
  pourtant : imports depuis `affiliate-service-facade` (`attributeReferralForOrganizationService`,
  ligne 37) et `credit-service-facade` (`allocateCreditsOnSubscriptionService`, 39-41) ; appels aux
  lignes 207 et 236 dans le hook Stripe `onSubscriptionComplete`, compensation ligne 291 ; et une
  fonction entière `attributeReferralOnSignUp` (496-519) appelée ligne 358. Retirer crédits et
  affiliation **oblige à toucher l'authentification**.
- **`src/services/types/domain/notification-types.ts`** — `project_created` / `project_updated` dans
  `NotificationType` et les metadata typées. **Bonne nouvelle** : `notifications.type` est un `text`,
  pas un `pgEnum` → **aucune migration d'énuméré à générer**.
- **`src/services/types/domain/subscription-types.ts`** — `LimitType` contient `projects`, et
  `subscription_plan.limits` (json) porte `projects` et `credits` en base. Stripe est conservé : ces
  limites deviennent orphelines et doivent être **arbitrées**, pas supprimées à l'aveugle (cf. Q7).
- **`src/db/scripts/seed.ts`** — **731 lignes de SQL brut**, dont **33 lignes** citent
  `project|credit|affiliate|referral` (blocs `INSERT` pour `project`, `task`, plans porteurs de
  `credits`, notifications `project_created`). Réécriture substantielle, pas un nettoyage. La suite
  e2e en dépend.
- **`src/db/models/db.ts`** — importe et étale `affiliate`, `creditLedger`, `project` dans le
  `schema` du client Drizzle (lignes 6-15 et 32-42).
- **`src/proxy.ts`** — `/chat` dans `AUTHENTICATED_SEGMENTS`, plus tout le parrainage ci-dessus.
- **Documentation du boilerplate** : **32 fichiers MDX** de `src/app/[locale]/docs/_files/`
  référencent un sous-système retiré, dont `en/09-testing/05-service-testing.mdx` qui utilise
  `SubjectsConst.PROJECT` comme exemple. Ce sont des pages **servies** par le site de docs. Non
  relevé par la révision précédente ; à arbitrer (retirer, réécrire, ou assumer).
- Aussi concernés : `src/lib/helper/menu-helper.ts`, les fichiers de
  `components/features/layouts/sidebar/`, `src/lib/stripe/stripe-events.ts`,
  `src/services/authorization/authorization-service.ts`.

### Les deux règles à mettre à jour (critère 10) — et pourquoi c'est mécanique

`scripts/check-rules.ts` **valide les liens cités** : la regex de la ligne 92
(`/\]\(<?(?:mdc:)?((?:src|docs|scripts|e2e)\/[^)>\s]+?)>?\)/g`) vérifie que chaque chemin lié existe.
Le retrait **cassera donc `pnpm check:rules`** tant que les règles ne sont pas corrigées — le
critère 10 est vérifiable mécaniquement, ce qui est une bonne nouvelle.

**Baseline mesurée le 10 septembre : `pnpm check:rules` → `✅ Règles et documentation alignées sur le
code.`** (passe).

Les **9 liens qui casseront**, relevés précisément :

| Fichier                                                              | Lignes                       | Cibles                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `.claude/rules/01-presentation/rule-react-query.md`                  | 124, 170, 262, 305, 351, 395 | `src/lib/api/projects-api.ts`, `src/components/hooks/client/project-client.ts`, `src/components/features/projects/react-query/…` (4) |
| `.claude/rules/02-services/rule-seed-usersroles-and-organization.md` | 187, 188, 189                | `project-authorization.ts`, `project-dal.ts`, `features/projects/projects-management.tsx`                                            |

Rappel : `.cursor/rules/` est **généré** — `pnpm check:rules --fix`, jamais d'édition directe.
`docs/architecture.md` demande par ailleurs à s01 de désigner le remplaçant de
`createProjectService` comme modèle canonique de la couche service (cf. Q5).

### `pnpm knip` : le critère 8 ne peut pas se lire en pass/fail

Mesuré le 10 septembre, **avant tout retrait** :

```
Unused files (89)            Unused exports (220)        Unused exported enum members (3)
Unused dependencies (2)      Unused exported types (71)  Duplicate exports (2)
Configuration hints (18)     →  ELIFECYCLE Command failed with exit code 1
```

**`pnpm knip` échoue déjà aujourd'hui**, avec 89 fichiers non utilisés. Le critère 8 (« `pnpm knip`
ne signale pas d'orphelin issu du retrait ») ne peut donc **pas** se vérifier par un code de sortie :
il se vérifie en **delta contre cette baseline**. À figer au plan.

Knip signale lui-même la cause de son point aveugle :
`src/middleware.ts  knip.json  Refine entry pattern (no matches)`. `knip.json` déclare
`src/middleware.ts` (lignes 11, 31, 57) alors que le fichier réel est `src/proxy.ts` — vérifié,
`src/middleware.ts` n'existe pas. Le proxy n'est donc **pas** un point d'entrée pour knip, et tout ce
qu'il retient vivant (le parrainage, notamment) est mal analysé. Ironie utile :
`check-rules.ts` a un `STALE_PATTERNS` sur `/src\/middleware/` (« ce fichier n'a jamais existé »),
mais il ne scanne pas les JSON — d'où la survie de l'erreur dans `knip.json`.

## Pièges et contraintes

### 1. La vérification d'état d'entrée exigée par la story est caduque — et le socle est désormais fusionné

Les notes agentiques de s01 imposent, **avant toute autre chose** :

> `grep -rl 'dark:' src/` et `grep -rl 'next-themes' src/` ne doivent rien retourner.

**Mesuré le 10 septembre : 34 fichiers portent `dark:` (165 occurrences), 8 importent `next-themes`.**

Ce n'est **pas** le socle à moitié habillé que la story redoute, c'est une décision renversée :
[ADR 012](../decisions/012-mode-sombre-conserve.md) acte que **le mode sombre est conservé**. Le
retrait traversait la base (enum `theme_type`, colonne `user.theme`, SQL brut de `seed.ts` dont
dépend l'e2e), le proxy, les tests et trois règles, pour rhabiller un socle dont aucun écran ASL-CMS
n'existe encore. **Ces deux greps ne doivent donc plus jamais retourner zéro.**

**Nouveau depuis la révision précédente : le travail de socle est fusionné** (`8201357`, « Merge
branch 'chore/adaptation-socle-design-system' »), et il a bien tenu en **10 fichiers de code** comme
l'annonçait l'ADR 012 : `src/app/globals.css` (+216 lignes), `src/app/[locale]/base-layout.tsx`, et
7 composants de `src/components/ui/` (`button`, `card`, `form`, `input`, `select`, `table`,
`textarea`). Le point de séquencement soulevé le 9 septembre est donc **levé** : s01 démarre sur un
arbre qui porte les polices (`Public_Sans`, `Source_Serif_4`, `JetBrains_Mono`) et les deux jeux de
tokens.

Trois textes restent faux et non réécrits — ils ne bloquent pas le code, mais tromperont le prochain
agent :

- les notes agentiques de s01 dans `docs/stories.md`, qui portent le grep ;
- la règle transverse « Socle habillé » de `docs/stories.md`, qui annonce encore « retrait du thème sombre » ;
- `docs/adaptation-socle-design-system.md`, cité par les deux comme cahier des charges et qui décrit
  un programme abandonné.

Le **fond** de « Socle habillé » reste valide (une story ne redéclare ni token, ni police, ni taille
de cible) ; seul son critère mécanique est faux.

Héritage à trier écran par écran, pas ici : les classes `dark:` en dur du boilerplate n'ont pas été
écrites pour cette palette (`src/components/ui/file-upload.tsx` recode toute sa surface sombre en
`neutral-*`, plusieurs badges utilisent `dark:bg-blue-900` / `dark:bg-red-900`). Inventaire dans l'ADR 012.

### 2. Le socle attend déjà une injection serveur par tenant — et c'est s01 qui ouvre la porte

`src/app/globals.css:75` déclare `--accent-hue: 195` dans `:root`, et le bloc `.dark` (lignes 143-148)
porte un commentaire explicite :

> `--accent-hue` n'est volontairement PAS redéclaré ici […] : il est **injecté par le serveur sur
> `<html>` pour le tenant courant** (§1.2). Le redéclarer le figerait à 195 dès que le thème sombre
> est actif, `.dark` et le sélecteur de tenant ayant la même spécificité.

La teinte d'accent est un critère de **s02**, pas de s01. Mais le `<html>` est rendu par
`src/app/[locale]/base-layout.tsx`, que s01 touche déjà pour la résolution par domaine. À savoir au
plan pour ne pas fermer cette porte — et à ne pas implémenter ici.

### 3. Le 404 exigé par les critères 2 et 4 contredit une limite déjà mesurée du dépôt

C'est la question bloquante, et elle est **plus nette** que la révision précédente ne le disait :
**l'ADR 003 affirme un mécanisme que le dépôt a déjà mesuré comme ne fonctionnant pas.**

ADR 003 : « Un host inconnu fait appeler `notFound()` par le layout racine, **ce qui produit le 404
exigé**. »

Or `src/app/[locale]/admin/layout.tsx:23-30` porte, en commentaire, le résultat inverse pour le cas
jumeau — et il est explicite :

> ⚠️ Ce n'est PAS ce qui produit le 403, contrairement à ce qui était écrit ici. Sous Cache
> Components, toute route dynamique streame un shell d'abord, donc `forbidden()` arrive après que le
> statut soit parti : /admin rend un **200** avec l'UI forbidden — mesuré dans
> `e2e/authorization.spec.ts`.

Et c'est effectivement asserté, en connaissance de cause, dans `e2e/authorization.spec.ts`
(3 × `expect(response?.status()).toBe(200)` sur des pages refusées), avec ce commentaire :

> Assertion volontairement stricte : le jour où le contrôle de rôle passe dans le proxy, ce test
> tombe et signale que la situation a changé.

Points durs à retenir :

- **`export const instant = false` ne suffit pas.** `admin/layout.tsx` le porte déjà, fait un `await`
  au niveau supérieur, **et rend quand même 200**. L'option (b) « rendre le layout racine bloquant »
  est donc probablement déjà réfutée.
- **`src/proxy.ts` est le contournement du dépôt, mais l'ADR 003 l'interdit** pour le tenant
  (runtime Edge, pas de `node-postgres`).
- **Contrepoint utile** : les Route Handlers ne streament pas de shell et rendent de vrais statuts
  (`src/lib/api-auth.ts` rend 401 et 403, vérifié par spec).
- **Aucune assertion `404` n'existe aujourd'hui dans `e2e/`** (`grep -rn '404' e2e/` → rien). Le
  comportement de `notFound()` — par opposition à `forbidden()` — n'est donc **pas mesuré dans ce
  dépôt**. Je ne l'ai pas mesuré non plus : il faudrait un `pnpm build && pnpm start`, qu'AGENTS.md
  demande de ne pas lancer d'office. **C'est la première chose à mesurer au plan**, avant de choisir
  une voie.

### 4. « Test au niveau repository » (critère 7) est irréalisable tel qu'écrit

`src/db/models/db.ts` lève `Database connections are not allowed during tests.` dès que
`NEXT_PUBLIC_NODE_ENV === 'test'` (vérifié, lignes 46-48), et la convention du projet
(`rule-services-tests.md`, `setup-mocks.ts`) mocke tous les repositories. `docs/architecture.md:100`
et l'ADR 002 le disent : le test d'isolation est un **e2e Playwright**. Le critère 7 doit se lire
« couche applicative court-circuitée », **pas** « test unitaire de repository ».

### 5. Le rôle Postgres actuel rend la RLS totalement inerte — partout

Mesuré en direct le 10 septembre (voir « État actuel ») : `asl` est le **seul** rôle non système,
`super=true`, `bypassrls=true`, et il possède les 28 tables. Comme démontré §« mécanisme de
l'ADR 002 », `FORCE ROW LEVEL SECURITY` **ne protège pas** d'un tel rôle. Sans `asl_app`, les
policies écrites par s01 seraient posées, visibles en base, et **sans aucun effet** — le pire des
cas, parce que silencieux.

Confirmé par la configuration, en **trois** endroits à traiter, pas un :

- **dev** : `docker-compose.yml:35` → `POSTGRES_USER: asl` (le superuser bootstrap de l'image
  `postgres:17`) ; `.env.local` → `postgres://asl:***@db:5432/asl_cms`. Les deux scripts de
  `docker/db-init/` (`01-extensions.sql`, `02-test-database.sql`) sont l'endroit où `asl_app` s'ajoute.
- **test** : `02-test-database.sql` fait `CREATE DATABASE asl_cms_test OWNER asl` ;
  `.env.test` → `postgres://asl:***@db:5432/asl_cms_test`.
- **CI** : `.github/workflows/preview.yml:147` → `POSTGRES_USER: test`, soit là encore le superuser
  de l'image.

### 6. La CI n'appliquerait jamais les policies — le test d'isolation serait vert pour rien

`.github/workflows/preview.yml:206` (job `e2e`) : `run: pnpm db:push && pnpm db:seed`.

`db:push` est `drizzle-kit push --force` (`package.json:26`) : il diffe le schéma TypeScript contre
la base et applique directement. **Il ne lit pas `drizzle/migrations/`.** Les policies RLS, qui
passent obligatoirement par `drizzle-kit generate --custom` (AGENTS.md, ADR 002), **ne seraient donc
jamais créées dans la base de la CI**. Combiné au piège 5, le test e2e d'accès croisé exigé par les
critères 6 et 7 **passerait sans rien prouver**.

Le job e2e doit basculer sur `pnpm db:migrate` (les jobs `preview.yml:132` et `production.yml:127`
l'utilisent déjà, eux). Effet de bord à anticiper : **la CI ne crée pas les extensions Postgres**.
`uuid-ossp` et `pgcrypto` ne viennent que de `docker/db-init/01-extensions.sql`, et aucune migration
ne les crée (`grep -n 'EXTENSION' drizzle/migrations/*.sql` → rien, re-vérifié). Or
`organization.id` a pour défaut `uuid_generate_v4()`, et le commentaire de `01-extensions.sql` le dit :
« sans ces extensions, `pnpm db:push` échoue avec une erreur de fonction UUID inconnue. »

### 7. Les e2e devront servir deux hosts, et `baseURL` n'en connaît qu'un

`playwright.config.ts:9-10` fixe `const BASE_URL = http://localhost:${PORT}` (3000 par défaut),
utilisé ligne 43, et aucun projet multi-domaine. Les critères 2 et 6 exigent deux domaines distincts.
À savoir : Chromium interdit de surcharger l'en-tête `Host` via `extraHTTPHeaders` (en-tête protégé),
donc la solution passe par deux **noms** réellement résolus vers la même adresse — `localhost` et
`127.0.0.1` sont déjà deux `Host` différents, et des noms en `*.localtest.me` en donnent d'autres
sans toucher `/etc/hosts`. Forme exacte à trancher au plan.

### 8. Le layout racine est prerendu, et la résolution par domaine le rend dépendant de la requête

`src/app/[locale]/layout.tsx` est le layout racine (**il n'y a pas de `src/app/layout.tsx`** —
vérifié) et porte `generateStaticParams()`. Y lire `headers()` pour obtenir le `Host` rend **toute**
page dépendante de la requête. L'ADR 003 l'assume (« aucune page n'est prerendue par tenant au
build », le contenu restant caché par `'use cache'` indexé sur `organizationId`), mais c'est le
changement le plus large de la story et il touche les 21 routes `(app)` passées en `◐` par la
migration Cache Components. Rappel de la règle : le `Host` se lit **hors** du scope caché et se passe
en argument.

### 9. Autres points relevés

- `pnpm test` est `vitest --pool=forks` en **mode watch** — ne rend jamais la main. `pnpm test --run`
  (confirmé : c'est ainsi que la baseline ci-dessus a été obtenue).
- **Le logger casse le prerender dans un scope caché.** L'intercepteur de services émet un
  `logger.info` à chaque appel de méthode et Winston horodate via `new Date()`. Neutralisé pendant
  `NEXT_PHASE=phase-production-build` seulement — donc **ne pas appeler `logger` dans une fonction
  portant `'use cache'`** (le nouveau `getTenantByDomainDal` est exactement ce cas).
- **Pas de table `files`.** `docs/architecture.md:154` la liste parmi les tables du boilerplate ;
  `src/db/repositories/files-repository.ts` est en réalité un adaptateur de stockage Supabase
  (`@supabase/storage-js`, `createStorage`), pas un repository Drizzle. À corriger au passage, sinon
  s01 cherchera à équiper d'une policy une table qui n'existe pas.
- `createOrganizationService` inverse l'ordre autorisation/validation par rapport à
  `rule-architecture.md`. Les nouveaux services de s01 devraient suivre la règle
  (`safeParse` → `can*` → repository), comme le fait `createProjectService` — qui disparaît.
- **L'ADR 008 n'est appliqué nulle part et aucune story ne le porte.** `src/i18n/routing.ts` est
  encore `locales: ['en','fr','es']`, `defaultLocale: 'en'`, avec `messages/{en,es,fr}.json`
  (`grep` sur `docs/stories.md` : aucune story ne le revendique). Cf. Q4.
- `organization.slug` est `unique()` mais **nullable**. Le provisioning devra le rendre obligatoire
  ou vivre avec.
- **`DATABASE_MIGRATION_URL` n'existe pas encore.** `src/env-schemas.ts:59` ne porte que
  `DATABASE_URL: z.string().url()` (et `DATABASE_POOL_MAX` ligne 65). L'ADR 002 l'introduit : à
  déclarer dans `src/env-schemas.ts` **et** dans le `runtimeEnv` de `src/env.ts` (vers la ligne 54).
  Oublier le second est l'erreur classique de `@t3-oss/env-nextjs`.
- ESLint interdit l'accès direct à `process.env` : importer depuis `@/env`.

## Questions ouvertes

À trancher au plan (`/ks-plan`), pas ici.

1. **Comment obtenir un vrai 404 (critères 2 et 4) malgré le streaming ?** La question bloquante, et
   l'ADR 003 se contredit avec le comportement mesuré du dépôt (piège 3). **Premier geste du plan :
   mesurer** si `notFound()` depuis le layout racine rend 404 ou 200 (un `pnpm build && pnpm start`
   plus un `curl -o /dev/null -w '%{http_code}'`) — c'est bon marché et cela tranche entre : (a)
   accepter un 200 portant l'UI not-found, comme D20 l'a fait pour le 403 — mais s01 écrit « pas une
   page vide », ce qui vise probablement exactement ce compromis ; (b) rendre le layout racine
   bloquant, voie déjà affaiblie puisque `admin/layout.tsx` le fait et rend 200 ; (c) un contrôle en
   amont dans `proxy.ts`, que l'ADR 003 exclut faute de Postgres en Edge — sauf à s'appuyer sur une
   source non Postgres, ce qui est un nouvel arbitrage. **Si la mesure confirme le 200, l'ADR 003 doit
   être amendé par un ADR complémentaire** : ce n'est plus un détail d'implémentation.
2. **Classer les 12 tables ni scopées ni exemptées** (critère 9) : `apikey`, `categories`, `hashtags`,
   `notifications`, `organization`, `post_hashtags`, `posts`, `posts_translation`, `subscription`,
   `subscription_plan`, `two_factor`, `user_settings`. Étendre la liste de `architecture.md:183`, ou
   leur ajouter `organization_id` ? Cas particulier à trancher explicitement : **`subscription` est
   rattachée au tenant par `reference_id` (text), que la policy `organization_id` de l'ADR 002 ne
   verrait pas.**
3. **`db:push` → `db:migrate` en CI : dans s01 ou séparément ?** Le changement est petit mais touche
   la CI de tout le projet, et traîne la question des extensions Postgres non créées en CI (piège 6).
4. **Qui porte l'ADR 008 (locale unique) ?** Aucune story ne le revendique, le code est encore en
   trois locales. s01 est le candidat naturel — il touche déjà le layout racine et le routage — mais
   ce serait un élargissement au-delà des critères d'acceptation. À décider explicitement plutôt qu'à
   laisser tomber entre deux stories.
5. **Quel domaine devient l'« implémentation de référence » en remplacement de `projects` ?**
   `docs/architecture.md` le demande à s01, mais s01 ne crée aucun domaine métier CRUD complet — le
   premier candidat réel est s04/s05. Faut-il désigner `organization` / `organization_setting`, ou
   déplacer la tâche à s05 ? La contrainte est dure : `check-rules.ts` valide les liens, donc les deux
   règles doivent pointer vers **quelque chose qui existe** à la fin de s01.
6. **Le registre d'actions est créé par s03**, mais s01 introduit des actions soumises à autorisation
   (provisionner, activer un module). Les déclare-t-on rétroactivement en s03, ou s01 avance-t-il la
   création du registre ? La règle transverse ne tranche pas le cas de la toute première story.
7. **Que deviennent les limites d'abonnement `projects` et `credits`** (`LimitType`,
   `subscription_plan.limits`, `organization.limitOverrides`, et le `checkMembersLimit` commenté dans
   `addUserToOrganizationAction`) une fois les deux sous-systèmes retirés, sachant que Stripe est
   conservé ? Les retirer touche la facturation plateforme ; les garder laisse des limites qui ne
   limitent rien.
8. **Le parrainage part-il avec l'affiliation ?** La table `referral` part avec `affiliate-model.ts`,
   mais `referral-helper` est câblé dans `src/proxy.ts`, `src/env-schemas.ts`
   (`NEXT_PUBLIC_AFFILIATE_TRACKING`), `better-auth/auth.ts` et le formulaire d'inscription. Tout
   retirer touche le proxy et l'authentification ; ne rien retirer laisse un cookie de parrainage
   posé pour une table absente — donc un bug. **Trancher explicitement**, et en tirer la cible de
   tests (~333 si le parrainage reste, ~318 si ses 15 `it()` partent aussi).
9. **Que fait-on des 32 fichiers MDX de docs** (`src/app/[locale]/docs/_files/`) qui documentent les
   sous-systèmes retirés, dont un exemple `SubjectsConst.PROJECT` ? Ce sont des pages servies. Les
   retirer, les réécrire, ou l'assumer pour cette story ?
10. **Comment figer la baseline `knip`** pour que le critère 8 soit vérifiable, sachant que
    `pnpm knip` échoue déjà (89 fichiers non utilisés, exit 1) et que `knip.json` déclare un point
    d'entrée inexistant (`src/middleware.ts`, à corriger en `src/proxy.ts`) ?
11. **Forme du multi-host pour Playwright** (deux projets, deux `baseURL`, `localtest.me` ?) — la
    contrainte est vérifiée (piège 7), la solution reste à choisir.
12. **Forme exacte du couple domaine/tenant** : l'ADR 003 tranche « un domaine par association,
    colonne indexée unique ». Suffit-il pour couvrir domaine de recette **et** domaine définitif
    simultanément (migration LWS), ou faut-il une table `organization_domain` ? L'ADR mentionne les
    sous-domaines de plateforme comme « compatibles », ce qui suggère plusieurs entrées par tenant.

<< IP Mike: exploration method, what a good research always verifies. >>
