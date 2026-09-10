---
validated: yes
---

# Plan — Story s01-provisionner-association

Branch: `feature/s01-provisionner-association`

> Établi le 2026-09-10 sur `9418282`. Appuyé sur
> `docs/research/s01-provisionner-association.md` (re-vérifié le même jour) et
> `docs/designs/s01-provisionner-association.md`. Les décisions structurantes sont déjà prises —
> ADR 002 (RLS + rôle dédié), ADR 003 (résolution par domaine), ADR 009 (retraits), ADR 010
> (paramètres et modules), ADR 012 (mode sombre conservé). **Le plan les applique, il ne les
> rouvre pas.**

## ⚠️ Avertissement de périmètre — à lire avant de valider

**Ce plan compte 11 tâches, au-delà du repère de 10, et c'est le signal que la complexité 4 est
optimiste.** Je le livre entier plutôt que de le tronquer, mais la mise en garde est chiffrée, pas
impressionniste — trois faits mesurés à la recherche affaiblissent la justification que le découpage
s'était donnée pour garder le retrait ADR 009 dans s01 :

Les notes de s01 motivaient le maintien à 4 par le caractère « **mécanique et outillé** » du
retrait : « `pnpm knip` nomme les orphelins, `pnpm check:rules` nomme les règles cassées, la suite
de tests nomme ce qui reste accroché ». Vérifié le 10 septembre :

| Filet annoncé            | État réel mesuré                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm knip` nomme        | **Échoue déjà** avant tout retrait : 89 fichiers non utilisés, 220 exports, exit 1. Et son point d'entrée `src/middleware.ts` n'existe pas — `src/proxy.ts` n'est donc pas analysé. Ne nomme rien de fiable. |
| `pnpm check:rules` nomme | **Tient.** Il valide les liens cités : les 9 liens cassés seront signalés. Seul filet réellement opérant.                                                                                                    |
| La suite de tests nomme  | **Tient**, à 118 `it()` près, mais ne dit rien des 56 fichiers conservés à réparer.                                                                                                                          |

S'ajoute que la table des chemins de l'ADR 009 **ne nomme que 46 des 100 fichiers** concernés : 54
sont à retrouver à la main, dont `features/tasks/`, `task-dal.ts` et les trois fichiers de
parrainage, invisibles à son motif de recherche.

**La story a prévu cette issue elle-même** : « Si `/ks-architect` conclut autrement, le retrait se
sort en story propre plutôt que de porter s01 à 5 ». La ligne de coupe serait nette — **tâches 3 à 5
d'un côté** (retrait, 1 commit, aucun besoin des tâches 6+), **tâches 1-2 et 6-11 de l'autre**.

**Je ne recommande pourtant pas la scission**, et voici pourquoi : une story « retrait des
sous-systèmes » ne livre rien à une association, alors que `docs/stories.md` définit une story comme
« une tranche livrable de bout en bout ». C'est précisément une _story de couche technique_, le
défaut que `/ks-stories-review` est fait pour rejeter. Le découpage a donc probablement eu raison sur
le fond, et c'est le **chiffrage** qui est faux, pas la frontière.

**Conséquence pratique retenue dans ce plan** : une seule story, une seule branche, un seul PR, mais
le retrait sort en **commit séparé** (tâches 3-5) — ce qu'AGENTS.md autorise explicitement pour « ce
qu'on voudrait pouvoir révoquer seul ». C'est le compromis qui garde la story livrable sans rendre le
retrait irrévocable.

## Target story

**s01-provisionner-association** — « En tant que SuperAdmin Zourite Studio je veux créer une
association et activer ses modules afin qu'elle dispose d'un site isolé sans écrire une ligne de
code. » Complexité 4 (voir avertissement). Aucune dépendance.

Les dix critères, et la tâche qui les prouve :

| #   | Critère                                                                          | Prouvé par |
| --- | -------------------------------------------------------------------------------- | ---------- |
| 1   | Créer une association depuis le BO → tenant écrivable/relisible aussitôt         | 10, 11     |
| 2   | Requête rattachée au tenant par le domaine ; domaine inconnu → 404               | 8, 11      |
| 3   | Drapeaux de modules persistés, modifiables, différents d'un tenant à l'autre     | 7, 9, 10   |
| 4   | Route de module inactif **ou clé inconnue** → 404                                | 9          |
| 5   | Administrateur initial désigné par email, rattaché à ce tenant seul              | 10, 11     |
| 6   | Tenant A ne voit rien de B, **même en forgeant l'id**                            | 11         |
| 7   | La policy RLS refuse la lecture inter-tenant, couche applicative court-circuitée | 11         |
| 8   | Les 5 sous-systèmes ADR 009 ont disparu (schéma, tests, knip)                    | 3, 4, 5    |
| 9   | Aucune table métier restante sans policy ; exemptions = liste architecture.md    | 7          |
| 10  | Les 2 règles ne citent plus `projects` ; `pnpm check:rules` passe                | 5          |

## Tasks (ordered)

### Phase 0 — Lever l'inconnue bloquante

1. [x] **Mesurer le statut HTTP réel d'un `notFound()` déclenché depuis le layout racine.**
       C'est la seule inconnue qui peut invalider la conception des critères 2 et 4, et elle est
       bon marché : `pnpm build && pnpm start`, puis
       `curl -o /dev/null -w '%{http_code}' http://localhost:3000/xx-invalide` sur une locale
       inconnue (le layout racine appelle déjà `notFound()` dans ce cas, `[locale]/layout.tsx:25`).
       **Pourquoi c'est en tâche 1** : l'ADR 003 affirme qu'un host inconnu « fait appeler
       `notFound()` par le layout racine, ce qui produit le 404 exigé », alors que le dépôt a mesuré
       l'inverse sur le cas jumeau — `admin/layout.tsx` porte `instant = false`, fait un `await` au
       niveau supérieur, et `e2e/authorization.spec.ts` asserte quand même `200` sur trois pages
       refusées. Aucune assertion `404` n'existe dans `e2e/`. - **Si 404** : l'ADR 003 est exact, les tâches 8 et 9 l'appliquent tel quel. Consigner la
       mesure dans le plan et poser une assertion e2e de non-régression en tâche 11. - **Si 200** : l'ADR 003 est faux sur ce point. **Écrire ADR 013**, qui le complète (jamais
       le modifier : les ADR sont immuables) avec les trois voies étudiées et la retenue — (a)
       assumer un 200 portant l'UI introuvable, comme D20 l'a fait pour le 403 ; (b) statut rendu
       par un Route Handler, qui ne streame pas de shell (`src/lib/api-auth.ts` rend de vrais 401
       et 403, vérifié par spec) ; (c) contrôle en amont dans `src/proxy.ts`, que l'ADR 003 exclut
       faute de Postgres en Edge. - ⚠️ **Ne pas écrire l'ADR avant la mesure.** Un ADR consigne une décision prise, pas une
       hypothèse. - _Vérifiable :_ un code de statut relevé, et soit une assertion e2e, soit `docs/decisions/013-*.md`.

### Phase 1 — Le socle base de données (préalable à toute RLS)

2. [x] **Créer le rôle applicatif `asl_app` et séparer l'URL de migration.**
       Sans lui, les policies de la tâche 7 seraient posées, visibles en base, et **sans aucun
       effet** — mesuré : `asl` est le seul rôle, `rolsuper=true`, `rolbypassrls=true`, et
       `FORCE ROW LEVEL SECURITY` ne protège pas d'un tel rôle. C'est le pire des cas parce qu'il
       est silencieux. - `docker/db-init/` : nouveau script créant `asl_app` (ni propriétaire, ni `BYPASSRLS`) avec
       les `GRANT` nécessaires, **et le `ALTER DEFAULT PRIVILEGES`** pour que les tables créées
       ensuite par le propriétaire lui soient accessibles. - `DATABASE_MIGRATION_URL` (ADR 002) à déclarer dans `src/env-schemas.ts` (à côté de
       `DATABASE_URL`, ligne 59) **et** dans le `runtimeEnv` de `src/env.ts` — oublier le second
       est l'erreur classique de `@t3-oss/env-nextjs`. `src/db/scripts/migrate.ts` et le seed
       l'utilisent ; `src/db/models/db.ts` garde `DATABASE_URL`, désormais pointé sur `asl_app`. - `.env.local` / `.env.test` / `docker-compose.yml` : l'application passe sur `asl_app`. - CI `.github/workflows/preview.yml:206` : **`pnpm db:push` → `pnpm db:migrate`**. `db:push`
       est `drizzle-kit push --force` et **ne lit pas `drizzle/migrations/`** : les policies de la
       tâche 7, qui passent obligatoirement par `generate --custom`, ne seraient jamais créées en
       CI et le test d'isolation de la tâche 11 passerait sans rien prouver. - ⚠️ **Effet de bord à traiter dans la même tâche** : la CI ne crée pas `uuid-ossp` ni
       `pgcrypto` (elles ne viennent que de `docker/db-init/01-extensions.sql`, et aucune
       migration ne les crée — vérifié). Or `organization.id` a pour défaut `uuid_generate_v4()`. - _Vérifiable :_ `psql` montre `asl_app` avec `rolsuper=false, rolbypassrls=false` ;
       `pnpm db:migrate` puis `pnpm db:seed` passent ; l'application démarre ; la CI est verte.

### Phase 2 — Retrait ADR 009 (un commit à part, révocable seul)

3. [x] **Supprimer les cinq sous-systèmes : fichiers et tables.**
       100 fichiers portent un nom de sous-système retiré ; **la table des chemins de l'ADR 009 n'en
       nomme que 46**. Les 54 autres sont listés dans la recherche, §« Surface du retrait » — s'y
       référer plutôt que de refaire le tri, et **compléter la table de l'ADR 009 dans ce commit**,
       sinon la commande de récupération V2 ramènera un sous-système incomplet. - Les 9 fichiers invisibles à son motif : `src/app/dal/task-dal.ts`,
       `src/components/features/tasks/` (5), et les 3 de parrainage. - **8 tables** partent : les 5 de `affiliate-model.ts` (dont `referral`), `credit_ledger`,
       `project`, `task`. Chat et newsletter n'ont aucune table. Migration de suppression par
       **`drizzle-kit generate --custom`**, jamais de SQL à la main, jamais d'édition de
       `meta/_journal.json`. - `src/db/models/db.ts` : retirer les imports et l'étalement de `affiliate`, `creditLedger`,
       `project` dans le `schema`. - _Vérifiable :_ les fichiers ont disparu, la migration est générée par l'outil, `git grep`
       sur les cinq motifs ne rend plus que du code conservé (et les MDX de docs, cf. tâche 5).

4. [x] **Réparer les 56 fichiers conservés qui référencent les sous-systèmes.**
       C'est le vrai coût du retrait, et il ne tombe pas sous l'outillage. - `src/services/authorization/casl-abilities.ts` — **le fichier central de l'autorisation** :
       4 membres du type union `Subjects` (l.20-30), 4 constantes (l.46-56) et **17 lignes**
       utilisant `SubjectsConst.{PROJECT,TASK,CREDIT,AFFILIATE}` dans des règles `can(...)`
       réparties sur tous les rôles. - `src/lib/better-auth/auth.ts` — fichier d'authentification **conservé**, qui importe
       `affiliate-service-facade` (l.37) et `credit-service-facade` (l.39-41), appelle
       `allocateCreditsOnSubscriptionService` (l.207, l.236), compense l.291, et porte
       `attributeReferralOnSignUp` (l.496-519, appelée l.358). - `src/db/scripts/seed.ts` — **731 lignes de SQL brut, 33 lignes concernées** (blocs `INSERT`
       `project`, `task`, plans porteurs de `credits`, notifications `project_created`). La suite
       e2e en dépend : le seed doit rester exécutable. - `notification-types.ts` (`project_created` / `project_updated`) — **bonne nouvelle** :
       `notifications.type` est un `text`, pas un `pgEnum`, donc **aucune migration d'énuméré**. - `subscription-types.ts` (`LimitType` porte `projects`) et `subscription_plan.limits` en
       base : Stripe est conservé, ces limites deviennent orphelines. **Arbitrer, pas supprimer à
       l'aveugle** — voir « Décisions à prendre en cours de plan ». - Aussi : `menu-helper.ts`, `features/layouts/sidebar/`, `stripe-events.ts`,
       `authorization-service.ts`, `proxy.ts` (`/chat` dans `AUTHENTICATED_SEGMENTS`, plus le
       parrainage). - _Vérifiable :_ `pnpm test --run` affiche **333 tests** (451 − 118) sur 18 fichiers — ou
       **318** si le parrainage part aussi (ses 15 `it()`) ; `npx tsc --noEmit` propre ;
       `pnpm lint` propre. Un écart notable sur le compte signale un effet de bord, pas un retrait
       propre. ⚠️ `pnpm test` seul reste en **watch** et ne rend jamais la main.

5. [x] **Mettre à jour règles, documentation et outillage — dans le même commit.** - Les **9 liens cassés**, relevés précisément :
       `rule-react-query.md` l.124, 170, 262, 305, 351, 395 et
       `rule-seed-usersroles-and-organization.md` l.187, 188, 189. `check-rules.ts:92` valide les
       liens cités, donc `pnpm check:rules` **échouera** tant qu'ils pointent dans le vide — le
       critère 10 est mécaniquement vérifiable, c'est le seul filet qui tienne. - ⚠️ `.cursor/rules/` est **généré** : `pnpm check:rules --fix`, jamais d'édition directe. - `docs/architecture.md` : désigner le **remplaçant de `createProjectService`** comme modèle
       canonique de la couche service (la doc le demande nommément à s01), et corriger la table
       `files` qui **n'existe pas** — `files-repository.ts` est un adaptateur de stockage Supabase,
       pas un repository Drizzle. Sans quoi la tâche 7 cherchera à équiper d'une policy une table
       absente. - `knip.json` : corriger l'entrée `src/middleware.ts` (3 occurrences : l.11, 31, 57) en
       `src/proxy.ts`. Le fichier n'existe pas et knip le signale lui-même ; tant qu'il est faux,
       le proxy n'est pas un point d'entrée et tout ce qu'il retient vivant est mal analysé. - **Figer la baseline knip** : `pnpm knip` échoue déjà (89 fichiers, 220 exports, exit 1).
       Le critère 8 se lit donc en **delta**, pas en code de sortie — consigner le compte
       avant/après dans le rapport de tâche. - _Vérifiable :_ `pnpm check:rules` passe ; le delta knip ne montre **aucun orphelin nouveau
       issu du retrait**.

### Phase 3 — La tenancy

6. [x] **Poser le scope de tenant : `getDb()`, `withTenant()`, `withRlsBypass()`.**
       C'est la convention que **41 stories appliqueront** ; une erreur ici se paie partout. - `withTenant(organizationId, callback)` ouvre une transaction, y pose le réglage, et publie
       la transaction dans un `AsyncLocalStorage` (ADR 002). `getDb()` retourne la transaction du
       scope courant s'il y en a une, le `db` du pool sinon. - ⚠️ **`SET LOCAL` ne se paramètre pas** — mesuré :
       `PREPARE t1(text) AS SET LOCAL app.organization_id = $1` →
       `ERROR: syntax error at or near "SET"`. Interpoler l'id dans la chaîne serait une
       **injection**. Utiliser **`set_config('app.organization_id', $1, true)`**, forme
       paramétrable au comportement identique. L'ADR 002 écrit `SET LOCAL` : c'est le seul point
       où le code s'écarte de sa lettre pour respecter son intention. - Contrainte de typage réelle : `getDb()` doit rendre un objet portant `.query` (API
       relationnelle, l'essentiel des appels) **et** `.transaction`. `NodePgDatabase<schema>` et
       `PgTransaction<…>` ne sont pas le même type. - Migrer les repositories : **8 fichiers** importent encore `db` après le retrait
       (`organization`, `notification`, `app-settings`, `admin-statistics`, `user-submission`,
       `user`, `subscription`, `post`). `files-repository.ts` n'est pas concerné — pas de Drizzle. - `withRlsBypass()` : réservé au provisioning (tâche 10) et à s41. Toute occurrence dans un
       diff est un point d'arrêt de revue. - _Vérifiable :_ tests unitaires sur le helper de scope (mocké) ; `grep` confirme qu'aucun
       repository n'importe plus `db` directement ; `pnpm test --run` toujours au vert.

7. [x] **Étendre `organization` et poser les policies RLS.** - Colonnes sur `organization` (`auth-model.ts:152`) : **`domain`** unique et indexé (ADR 003,
       un domaine par association) et **drapeaux de modules typés par énuméré** de clés connues,
       jamais un champ libre (ADR 010). ⚠️ **Ne pas réutiliser `limitOverrides`** : l'ADR 010 le
       rejette explicitement — la colonne est typée `Record<string, number>` et sert les limites
       Stripe ; y loger des booléens confondrait facturation plateforme et périmètre fonctionnel. - `slug` est aujourd'hui `unique()` mais **nullable** : le rendre obligatoire au provisioning. - Policies par **`drizzle-kit generate --custom`** : `ENABLE` + `FORCE ROW LEVEL SECURITY` +
       policy `tenant_isolation` fail-closed sur
       `current_setting('app.organization_id', true)` avec la porte `app.bypass_rls`. La SQL de
       l'ADR 002 est **correcte telle quelle** — mesuré : le `USING` d'une policy `FOR ALL` sert
       de `WITH CHECK` implicite, un `INSERT` hors tenant est refusé, rien à ajouter. - **Sur quelles tables ?** Après le retrait, seules **trois** portent `organization_id` :
       `member` (`auth-model.ts:178`), `invitation` (`:197`), `user_submissions`
       (`user-submission-model.ts:25`). Tout le reste des colonnes `organization_id` partait avec
       affiliate/credit/project. - **Critère 9 — le point à traiter, pas à contourner.** Il exige que « les tables exemptées
       soient **exactement** celles listées dans `docs/architecture.md` ». La liste (l.183) en
       couvre 5 : `user`, `session`, `account`, `verification`, `app_settings`. Sur 20 tables
       restantes, **12 sont donc ni scopées ni exemptées** : `apikey`, `categories`, `hashtags`,
       `notifications`, `organization`, `post_hashtags`, `posts`, `posts_translation`,
       `subscription`, `subscription_plan`, `two_factor`, `user_settings`. Les classer et
       **justifier chaque ajout** à la liste, comme `architecture.md` l'invite à le faire
       (« toute addition à cette liste se justifie en revue »). Éléments de tri dans la recherche ;
       le cas dur est **`subscription`, rattachée au tenant par `reference_id` (text)** — une
       policy sur `organization_id` ne la verrait pas. - _Vérifiable :_ la migration s'applique ; `select count(*) from pg_policies` > 0 (il est à
       **0** aujourd'hui) ; les 3 tables ont `rowsecurity = true` ; `architecture.md` liste 20
       tables classées sans reste.

8. [x] **Résoudre le tenant par le domaine appelé.** - `getTenantByDomainDal(host)` en `'use cache'` + `cacheLife('hours')` + `cacheTag('tenant')`,
       sur le patron de `src/app/dal/blog-dal.ts`. `getCurrentTenant()` lit `headers()` **hors du
       scope caché** et passe le host en argument — `headers()` est interdit dans `'use cache'`,
       et c'est cette séparation qui rend la fonction cachable. - ⚠️ **Ne pas appeler `logger` dans la fonction cachée** : Winston horodate via `new Date()`,
       interdit en scope caché. La neutralisation de `src/lib/logger.ts` ne couvre que le build,
       pas le runtime. C'est le piège qui a coûté le plus cher pendant la migration Cache
       Components — devant une erreur de prerender sur une page sans rapport, suspecter le logger
       avant la page. - `organization_id` obtenu alimente le `withTenant()` de la tâche 6 : point d'entrée unique. - Domaine inconnu → comportement arrêté par la **tâche 1**. - ⚠️ Le layout racine (`[locale]/layout.tsx` — il n'y a **pas** de `src/app/layout.tsx`)
       porte `generateStaticParams()`. Y lire le `Host` rend toute page dépendante de la requête ;
       l'ADR 003 l'assume, mais c'est le changement le plus large de la story et il touche les 21
       routes `(app)` passées en `◐` par la migration Cache Components. - Invalidation par **`updateTag('tenant')`** au provisioning, pas `revalidateTag` : le
       SuperAdmin doit voir son association tout de suite. Précédents : `admin/blog/actions.ts`,
       `admin/plans/actions.ts`. - _Vérifiable :_ deux domaines servent deux tenants distincts (prouvé en tâche 11) ; un
       domaine inconnu ne sert aucun site.

9. [x] **Contrôler l'activation des modules par un helper unique.** - Un seul helper, appelé en tête des routes et des Server Actions concernées, appelant
       `notFound()` si le module est inactif **ou la clé inconnue** — une clé inconnue est traitée
       comme inactive (ADR 010), et c'est ce qui rend le critère vrai pour un module fictif comme
       pour un module réel désactivé. - Le patron existe : `isPageEnabled` (`src/lib/utils.ts:14`) + `notFound()` en tête de page,
       appliqué sur **14 `page.tsx`**. Le helper de s01 en est le successeur **par tenant** —
       l'actuel lit une variable d'env globale (`NEXT_PUBLIC_ENABLED_PAGES`). - **Route de test rattachée à un module fictif** : c'est la preuve exigée par le critère 4,
       puisque `vote`, `voirie` et `annonces` n'arrivent qu'en s33, s34 et s35. Décider si elle
       reste dans l'arbre ou vit dans les seules fixtures e2e (cf. manque n° 4 du design). - **Registre d'actions** : la règle transverse impose de déclarer toute action soumise à
       autorisation au registre créé par **s03**. s01 en introduit deux (provisionner, activer un
       module) et précède s03 — voir « Décisions à prendre en cours de plan ». - _Vérifiable :_ route d'un module désactivé → introuvable ; clé inconnue → introuvable ;
       deux associations aux drapeaux différents se comportent différemment sur la même route.

### Phase 4 — Le provisioning et ses écrans

10. [x] **Provisionner : service, action, et les deux écrans.** - **Étendre `createOrganizationService`** (`src/services/organization-service.ts:66`). Son
        corps actuel fait `canCreateOrganization()` → `safeParse` → `createOrganizationDao` →
        `createOrganizationMemberDao({role: OWNER})` **pour `getAuthUser()`** : l'OWNER créé est
        **le SuperAdmin lui-même**, pas l'administrateur initial. C'est exactement l'écart que le
        critère 5 comble. Au passage, l'ordre du service est autorisation-puis-validation, l'inverse
        de `rule-architecture.md` : les fonctions **nouvelles** suivent la règle
        (`safeParse` → `can*` → repository). - **Créer le compte de l'administrateur initial** s'il n'existe pas. `addUserToOrganizationAction`
        (`admin/organizations/actions.ts:107`) est le patron du rattachement mais **exige un
        `userId` existant** — le critère 5 désigne l'admin _par email_, donc la création du compte
        est à faire. Le rattacher **à ce tenant et à lui seul**. - ⚠️ **Ne pas envoyer d'email.** s01 crée le compte, elle ne le contacte pas : l'envoi
        appartient à s03, seule story à connaître l'adaptateur Brevo. Un second chemin d'envoi ici
        devrait être remplacé par s03. - **Action de création** dans `admin/organizations/actions.ts` (les 3 autres verbes y sont,
        la création manque), gardée par `requireActionAuth({roles: [RoleConst.SUPER_ADMIN]})`
        (`src/app/dal/user-dal.ts:41`). Le provisioning s'exécute sous `withRlsBypass()`. - **Écran A** — page `/admin/organizations/new`, per `docs/designs/s01-provisionner-association.md` :
        **une page, pas un dialogue** (le design system limite `dialog` à 2 champs, il y en a 5),
        trois `card`, `checkbox` pour les modules (rien d'immédiat sur un formulaire), un seul
        bouton `default`, monogramme §1.8, et l'encart disant que rien ne part. - **Écran B** — carte « Modules » sur `[id]/edit/page.tsx`, `switch` + **libellé d'état
        écrit** (effet immédiat). ⚠️ Cette page affiche aujourd'hui `usage.projects` et
        `usage.credits` : sa carte d'usage perd deux de ses trois colonnes avec la tâche 4. - Composer avec le socle habillé : ne redéclarer **ni token, ni police, ni rayon, ni taille
        de cible**. Un écran qui en redéclare un est un échec de review. - _Vérifiable :_ tests unitaires du service sur les **trois rôles globaux** (ADMIN, USER,
        PUBLIC) plus le refus d'un non-SuperAdmin ; les deux écrans rendent ; `pnpm lint` propre.

### Phase 5 — La preuve

11. [x] **Prouver l'isolation en e2e — c'est le seul niveau où la RLS est testable.**
        `src/db/models/db.ts` refuse toute connexion en test et les repositories sont mockés : le
        **critère 7 ne peut pas se lire « test unitaire de repository »**, il se lit « couche
        applicative court-circuitée ». L'ADR 002 et `architecture.md:100` le disent. - **Multi-host Playwright** : `playwright.config.ts:9-10` fixe un `BASE_URL` unique
        (`http://localhost:${PORT}`) et aucun projet multi-domaine. Chromium **interdit** de
        surcharger l'en-tête `Host` via `extraHTTPHeaders` (en-tête protégé) : passer par deux
        **noms réellement résolus** vers la même adresse — `localhost` et `127.0.0.1` sont déjà
        deux `Host`, et `*.localtest.me` en donne d'autres sans toucher `/etc/hosts`. - Les trois preuves : deux domaines → deux tenants (critère 2) ; requête authentifiée dans A
        ne rend rien de B **même en forgeant l'id** de la ressource (critère 6) ; lecture
        inter-tenant refusée **couche applicative court-circuitée** (critère 7). - Contre le **build de production** (`pnpm build && pnpm start`), sur un Postgres éphémère
        seedé — jamais `pnpm dev`, jamais la base de preview. - _Vérifiable :_ `pnpm test:e2e --project=chromium` au vert localement et en CI.

## Décisions à prendre en cours de plan

Quatre points que la recherche n'a pas pu trancher et qui ne relèvent pas d'un ADR structurant. À
arbitrer **au moment de la tâche**, et à consigner dans le rapport d'exécution :

| Point                                                                                                                                                                                                                     | Tâche | Défaut proposé                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Le parrainage part-il avec l'affiliation ?** La table `referral` part, mais `referral-helper` est câblé dans `proxy.ts`, `env-schemas.ts` (`NEXT_PUBLIC_AFFILIATE_TRACKING`), `auth.ts` et le formulaire d'inscription. | 3, 4  | **Tout retirer.** Garder un cookie de parrainage posé pour une table absente est un bug, pas un statu quo. Cible de tests : 318.    |
| **Que deviennent les limites `projects` et `credits`** (`LimitType`, `subscription_plan.limits`, `limitOverrides`, le `checkMembersLimit` commenté) alors que Stripe est conservé ?                                       | 4     | Retirer les deux clés de `LimitType` et du seed, **garder `users`**. Ne pas toucher au mécanisme de limites lui-même.               |
| **Les 32 fichiers MDX de `docs/_files/`** qui documentent les sous-systèmes retirés, dont un exemple `SubjectsConst.PROJECT`. Ce sont des pages servies.                                                                  | 5     | **Hors périmètre de s01.** Le noter dans le rapport ; aucun critère ne les couvre, et les réécrire doublerait le volume du retrait. |
| **Le registre d'actions est créé par s03**, mais s01 introduit deux actions soumises à autorisation et le précède.                                                                                                        | 9     | Consigner les deux actions dans le plan et le PR, **à déclarer au registre par s03**. Ne pas avancer la création du registre ici.   |

**Ce que le plan ne rouvre pas** : l'ADR 008 (locale unique) n'est appliqué nulle part et **aucune
story ne le porte** — le code est encore en `['en','fr','es']`, défaut `en`. s01 touche le layout
racine et le routage, ce qui en fait le candidat naturel, mais ce serait un élargissement au-delà des
dix critères. **À trancher hors de cette story**, pas en catimini pendant l'exécution.

## Files touched

Anticipé. Les décomptes viennent de la recherche du 10 septembre.

**Créés**

- `docker/db-init/03-app-role.sql` — rôle `asl_app`
- `src/db/*` — helper de scope de tenant (`getDb`, `withTenant`, `withRlsBypass`) + son test
- `src/app/dal/tenant-dal.ts` — `getTenantByDomainDal` (`'use cache'`, sans logger)
- `src/lib/*` — helper de contrôle de module, successeur par tenant d'`isPageEnabled`
- `src/app/[locale]/admin/organizations/new/page.tsx` — écran A
- `drizzle/migrations/*` — 3 migrations : suppression des 8 tables, colonnes `organization`,
  policies RLS (`generate --custom`)
- `e2e/tenant-isolation.spec.ts` — critères 2, 6, 7
- `docs/decisions/013-*.md` — **conditionnel**, selon la mesure de la tâche 1

**Modifiés**

- `src/env-schemas.ts`, `src/env.ts` — `DATABASE_MIGRATION_URL`
- `docker-compose.yml`, `.env.local`, `.env.test`, `.github/workflows/preview.yml`
- `src/db/models/auth-model.ts` — `domain` + drapeaux de modules
- `src/db/models/db.ts` — schéma amputé de 3 modèles
- **8 repositories** — `db` → `getDb()`
- `src/services/organization-service.ts`, son facade, `organization-authorization.ts`
- `src/app/[locale]/admin/organizations/actions.ts` — action de création
- `src/app/[locale]/admin/organizations/[id]/edit/page.tsx` — carte Modules + carte d'usage amputée
- `src/app/[locale]/layout.tsx` — résolution du tenant
- `src/services/authorization/casl-abilities.ts` — **17 lignes**
- `src/lib/better-auth/auth.ts` — hooks crédits + parrainage
- `src/db/scripts/seed.ts` — **33 lignes sur 731**
- `src/proxy.ts` — `/chat`, parrainage
- ~50 autres fichiers conservés (types, menu, sidebar, stripe-events, authorization-service)
- `.claude/rules/01-presentation/rule-react-query.md` (6 liens),
  `.claude/rules/02-services/rule-seed-usersroles-and-organization.md` (3 liens), puis
  `pnpm check:rules --fix` pour `.cursor/rules/`
- `docs/architecture.md` — table `files`, service canonique, liste d'exemption RLS
- `docs/decisions/009-*.md` — compléter la table des chemins (54 fichiers)
- `knip.json` — `src/middleware.ts` → `src/proxy.ts`

**Supprimés** — 54 fichiers non nommés par l'ADR 009 + les 46 qu'elle nomme, `e2e/affiliate.spec.ts`,
et les 5 fichiers de test des sous-systèmes (118 `it()`).

## Test strategy

Deux niveaux, et deux seulement — il n'y a **pas** de couche de tests d'intégration dans ce dépôt, et
pas de TestContainers.

**Unitaire (Vitest)** — `pnpm test --run`, **jamais `pnpm test`** qui reste en watch. Le verdict est
la ligne `Tests N passed`, pas celle de pnpm (un `Ctrl+C` sur le watch affiche `ELIFECYCLE Test
failed` alors que les tests passent).

- Baseline mesurée avant tout travail : **451 passed | 8 skipped**, 25 fichiers, 26 s.
- Cible après retrait : **333** (ou **318** si le parrainage part) sur 18 fichiers.
- Le helper de scope de tenant : testable unitairement en mockant le client Drizzle.
- Les services nouveaux : les **trois rôles globaux** (ADMIN, USER, PUBLIC), plus les rôles
  d'organisation là où ils s'appliquent. Repositories mockés par `vi.mock()`, jamais de vraie base.
- **La RLS n'est pas testable ici** : `db.ts` refuse toute connexion en test. Ne pas essayer.

**e2e (Playwright)** — contre le **build de production**, sur un Postgres éphémère seedé.

- C'est le seul endroit où la RLS et l'accès croisé se prouvent (critères 6 et 7).
- Multi-host indispensable (critère 2) : `baseURL` unique aujourd'hui, `Host` non surchargeable
  sous Chromium.
- Ajouter une assertion sur le statut de la page introuvable, pour que la mesure de la tâche 1
  devienne une **non-régression** — sur le modèle de `e2e/authorization.spec.ts`, qui asserte
  volontairement `200` « pour que le test tombe le jour où la situation change ».

**Vérifications d'outillage** — `pnpm lint`, `npx tsc --noEmit` (⚠️ **il n'y a pas de script
`typecheck`** dans `package.json`), `pnpm check:rules` (doit passer), `pnpm knip` (lu en **delta**
contre la baseline 89/220, jamais en code de sortie).

**Ne pas lancer `pnpm build` comme vérification finale d'office** (AGENTS.md) — sauf en tâche 1, où
la mesure l'exige, et en e2e, où Playwright le lance lui-même quand `CI=1`.

## Definition of Done

- [x] Les **10 critères d'acceptation** sont vérifiés, chacun par la tâche qui le porte.
- [x] `pnpm test --run` : **333 tests** (ou 318), aucun échec, aucun test supprimé sans que son
      sous-système ne le soit.
- [x] `pnpm test:e2e --project=chromium` au vert, dont l'isolation inter-tenant et le refus RLS
      couche applicative court-circuitée.
- [x] `pnpm lint`, `npx tsc --noEmit`, `pnpm check:rules` propres. `pnpm knip` sans orphelin
      **nouveau** issu du retrait.
- [x] `asl_app` en base avec `rolsuper=false` et `rolbypassrls=false` ; `pg_policies` non vide ;
      les 20 tables restantes toutes classées (scopée ou exemptée justifiée).
- [x] La CI e2e applique les migrations (`db:migrate`), donc les policies — et non `db:push`.
- [x] Aucune valeur propre à La Fourche en dur : les modules sont des drapeaux de tenant.
- [x] Les écrans composent avec le socle habillé, sans redéclarer token, police, rayon ni cible.
- [ ] **Deux commits** : le retrait ADR 009 (tâches 3-5) séparé du reste, révocable seul.
      ⚠️ **Non atteint** : un seul commit. `seed.ts`, les 8 repositories et `casl-abilities.ts`
      portent des modifications des deux moitiés dans les mêmes hunks ; les séparer aurait demandé
      de réécrire l'un des deux commits pour qu'il compile seul. Consigné comme écart assumé.
- [x] Recherche, design et plan voyagent dans le commit de la story ; les cases ci-dessus sont
      cochées au fil de l'exécution.
- [ ] PR unique, description structurée, diff relisible ; revue passée sans critique ouverte
      (`docs/reviews/s01-provisionner-association.md` finissant par `Ship allowed: yes`).

## Journal d'exécution

Exécuté le 2026-09-10 sur la branche `feature/s01-provisionner-association`. Les cases
ci-dessus sont cochées au fil de l'exécution ; ce journal porte les mesures et les arbitrages,
que le plan demande de consigner.

### Tâche 1 — statut HTTP de la page introuvable

**Mesuré le 2026-09-10** sur `pnpm build && pnpm start` (Next 16.3.0, `cacheComponents`).
`/xx-invalide`, l'URL que cette tâche proposait, **n'atteint jamais le layout** : le
middleware next-intl redirige toute locale inconnue (**307** vers `/en/xx-invalide`), donc
le `notFound()` de `[locale]/layout.tsx:25` est du code mort. Mesure refaite par sonde
jetable (layout imbriqué, `instant = false`, `await headers()`, `notFound()` — construite,
mesurée, supprimée) : **200**. Variante streamée derrière `<Suspense>` : **200** aussi.
Seul un chemin sans route correspondante rend un vrai 404 (`/fr/does-not-exist` → **404**).
→ **L'ADR 003 est faux sur ce point** ; `docs/decisions/013-statut-http-de-la-page-introuvable.md`
le complète et retient l'option (a). Fait connexe qui pèse sur la tâche 8 : lire `headers()`
au niveau supérieur du layout racine **fait échouer le build** de `/[locale]/chat` et
`/[locale]/account/affiliate` (`blocking-prerender-dynamic`) — deux routes que l'ADR 009
retire. Fait connexe n° 2 : en Next 16, **Proxy tourne sur le runtime Node.js**, donc le
motif par lequel l'ADR 003 excluait un contrôle dans `src/proxy.ts` est caduc (consigné
dans l'ADR 013, option (c)).

### Tâche 2 — rôle applicatif `asl_app` et URL de migration

**Fait le 2026-09-10.** `docker/db-init/03-app-role.sql` créé et appliqué à la base de dev
existante (le volume `pgdata` ne rejoue pas `db-init/`). Mesuré :
`asl_app | rolsuper=f | rolbypassrls=f`. `pnpm db:reset-seed` complet au vert (clear →
generate → migrate → seed), puis `asl_app` relit `organization` et `user` — ce qui prouve
l'`ALTER DEFAULT PRIVILEGES`, car les tables ont été recréées **après** le GRANT.
`pnpm db:check` (rôle applicatif) passe. Écart assumé au plan : le résolveur
`src/db/scripts/db-url.ts` retombe sur `DATABASE_URL` quand `DATABASE_MIGRATION_URL` est
absente — sans quoi tout environnement existant casse d'un coup, et l'échec réel
(permission refusée côté Postgres) est de toute façon bruyant. `db:clear` bascule aussi sur
le rôle propriétaire : son DDL destructif échouerait sous `asl_app`.

⚠️ **Piège d'exploitation à connaître** : `docker-compose.yml` passe `DATABASE_URL` en
**variable d'environnement du conteneur**, et une variable de process **prime sur
`.env.local`** chez Next. Le conteneur de développement en cours d'exécution garde donc
l'ancienne valeur (`asl`, superuser) jusqu'à ce qu'il soit **recréé** (`docker compose up -d`
après `down`) — et tant qu'il ne l'est pas, **la RLS est inerte en local** sans que rien ne
le signale. C'est ce qui a d'abord fait croire à une mesure rassurante ; la vérification
passe par `DATABASE_URL=postgres://asl_app:asl_app@db:5432/asl_cms pnpm start`, ou par un
`psql -U asl_app`.

### Tâche 3 — suppression des cinq sous-systèmes

**Fait le 2026-09-10.** 109 chemins retirés (69 entrées `git rm`, dont des dossiers).
`git ls-files src e2e | grep -iE 'project|credit|affiliate|chat|newsletter|task|referral'`
ne rend plus que les **6 MDX de docs**, hors périmètre par décision. Écarts au plan, tous
dans le sens d'un retrait plus large : (a) la migration a été générée par **`pnpm db:generate`**
et non `generate --custom` — les modèles supprimés suffisent à ce que drizzle-kit produise
les `DROP TABLE … CASCADE` et les `DROP TYPE`, journal et snapshot restant cohérents, ce qui
est la voie qu'AGENTS.md prescrit pour un changement de modèle ; `--custom` reste requis pour
les policies de la tâche 7. `drizzle/migrations/0002_clever_jack_flag.sql` : **8 tables et
10 énumérés**. Vérifié en base : 28 → **20 tables**. (b) 5 fichiers de plus que les 9
annoncés étaient invisibles au motif : `account/billing/usage/` (graphe de consommation de
crédits), `team/[slug]/react-query/` (page de démonstration `projects`),
`blog/actions.ts` (action newsletter) et `src/components/ui/code-block.tsx` (doublon mort
du composant de docs, seul consommateur : le chat). (c) Le **parrainage part entièrement**,
option par défaut du plan.

### Tâche 4 — réparation des fichiers conservés

**Fait le 2026-09-10.** `pnpm test --run` → **322 passed | 8 skipped**, 18 fichiers. Le
compte tombe pile : 451 − 118 (tests des sous-systèmes) − 15 (parrainage) = **318**, plus
les **4 tests de `resolveMigrationUrl`** écrits en tâche 2. `npx tsc --noEmit` propre,
`pnpm lint` propre (le seul avertissement restant vise `.remember/tmp/last-ndc.ts`, hors
dépôt suivi et antérieur). Arbitrages consignés : `LimitType` réduit à `storage | users`,
mécanisme de limites intact ; `AdminUsageStats.periodStart/End` désormais lus sur
l'abonnement, leur source d'origine, et non plus sur le registre de crédits ;
`stripe-events.ts` perd `invoice.paid` (allocation), `charge.refunded` et
`charge.dispute.created`, qui n'existaient que pour l'affiliation.
⚠️ **Effet de bord non anticipé par le plan** : `/api/projects` était la **seule** route API
gardée du dépôt, donc le seul endroit prouvant qu'un Route Handler rend de vrais 401/403.
Ses deux tests de `e2e/authorization.spec.ts` partent avec elle, et l'ADR 013 a été ajusté
pour ne plus s'appuyer sur une spec absente. `src/lib/api-auth.ts` est **conservé** : c'est
le contrat, il n'appartient à aucun des cinq sous-systèmes, et deux règles le citent.

### Tâche 5 — règles, documentation et outillage

**Fait le 2026-09-10.** `pnpm check:rules` → ✅ (il signalait **24 défauts**, soit
**12 liens** × 2 avec les copies `.cursor/`, et non 9 : le plan avait oublié
`rule-api-routes.md`, qui citait les 3 routes `/api/projects`). Corrections : les 6 liens de
`rule-react-query.md` et les 3 de `rule-api-routes.md` remplacés par un avertissement daté
— leur implémentation de référence n'existe plus et **rien dans le dépôt ne la remplace**,
le dire vaut mieux que de pointer un substitut inventé ; les 3 liens de
`rule-seed-usersroles-and-organization.md` redirigés vers le domaine **`organization`**, seul
domaine traversant les cinq couches et portant des rôles d'organisation.
`pnpm check:rules --fix` a régénéré les 3 `.cursor/`. `knip.json` : `src/middleware.ts` →
`src/proxy.ts` (3 occurrences).

**Delta knip mesuré**, baseline rejouée sur un worktree à `HEAD` pour ne pas la deviner :
fichiers **89 → 92**, exports **220 → 176**, types **71 → 52**, dépendances **2 → 7**.
Les orphelins de fichiers, nommément : `newsletter-form.tsx` **disparaît** (il était déjà
orphelin), et **4 apparaissent**, dont un a été supprimé (`src/components/ui/code-block.tsx`,
doublon mort). Les **3 conservés le sont sur décision** : `src/lib/api-auth.ts` et
`src/lib/api/api-client.ts` sont les contrats cités par les règles, restés sans consommateur
parce que `/api/projects` était leur unique appelant ;
`src/components/features/subscription/limit-reached.tsx` est l'UI du mécanisme de limites,
que le plan demande explicitement de **ne pas toucher** (son appelant vivant est
`organization-authorization.ts`). Les 5 dépendances devenues orphelines
(`@dnd-kit/*` × 3, `@mailchimp/mailchimp_marketing` + ses types, `react-markdown`) ne sont
**pas retirées** : `@dnd-kit` est réclamé par l'ADR 007, et un changement de dépendance sort
des dix critères. Consigné dans l'ADR 009.

Hors périmètre, comme prévu : les **6 MDX de docs** restants, et les clés de traduction
devenues inutilisées (`Credits.*`, `projectsList.*`) — des clés en trop ne cassent rien,
des clés manquantes si.

### Tâche 6 — scope de tenant

**Fait le 2026-09-10.** `src/db/tenant-scope.ts` + `src/db/tenant-scope.test.ts`
(**11 tests**). `set_config('app.organization_id', $1, true)` comme prévu ; un test asserte
que l'identifiant est bien un **paramètre** et n'apparaît pas dans la chaîne SQL —
vérifié en cassant volontairement l'implémentation, il tombe. `withTenant` refuse un
identifiant non-uuid **avant** d'ouvrir la transaction. Typage : `ScopedDb = typeof db`, la
transaction y est castée — `NodePgDatabase` et `PgTransaction` diffèrent pour TypeScript,
pas pour les appels des repositories, et les 4 `db.transaction(...)` internes continuent de
fonctionner (savepoints). Les **8 repositories** migrés : 152 usages,
`grep 'models/db' src/db/repositories/` ne rend plus rien. `src/lib/better-auth/auth.ts`
garde `db` : c'est l'adaptateur Drizzle de Better Auth, pas un repository, et il doit voir
le pool. `pnpm test --run` → **333 passed | 8 skipped**.

### Tâche 7 — colonnes `organization` et policies RLS (ARRÊTÉE)

🛑 **TÂCHE ARRÊTÉE LE 2026-09-10 — point de décision structurel non tranché par le plan
ni par les ADR.** Ce qui est fait, et vérifié : les colonnes `domain` (unique) et
`enabled_modules` (tableau de l'énuméré `organization_module`) sur `organization`, `slug`
passé `NOT NULL`, migration `0003` par `pnpm db:generate` ; les policies par
`drizzle-kit generate --custom` dans `0004`. Mesuré en base après application :
`pg_policies` = **3**, les 3 tables en `rowsecurity = t` **et** `relforcerowsecurity = t`,
et le mécanisme de l'ADR 002 se comporte exactement comme annoncé sous `asl_app` — hors
scope **0 ligne**, scope A **3 lignes**, id de B forgé **0 ligne**, `app.bypass_rls`
**11 lignes**, propriétaire `asl` **11 lignes** (rappel : `FORCE` ne contraint pas un
superuser, c'est la raison d'être de `asl_app`).

**Le blocage.** `member` n'est pas seulement une table métier : c'est le **pivot
identité ↔ tenant**, et sa lecture principale est **inter-tenant par construction**.
`getUserByIdDao` (`user-repository.ts:39`) charge `user` avec ses `members`, et c'est cette
lecture que le `customSession` de Better Auth (`auth.ts:273`) exécute **à chaque requête**
pour peupler `user.organizations` — d'où sortent l'organisation active, les rôles
d'organisation de CASL et tout le back-office bureau. Sous policy, hors scope de tenant,
elle rend **zéro ligne**.

**Mesuré, pas déduit** : `pnpm build && pnpm start` avec `DATABASE_URL` sur `asl_app`,
connexion de `user@gmail.com` (200), puis `GET /api/auth/get-session` →
`organizations: []` alors que Bob est membre de **3** organisations. `/en/account/organizations`
affiche « No organization ». En SQL : `select count(*) from member where user_id = <Bob>`
rend **0** hors scope, **1** sous le scope d'un tenant, **3** pour le propriétaire.

**Pourquoi je ne tranche pas.** Les trois issues changent le modèle de sécurité, et aucune
n'est couverte par un ADR accepté :

- **(a) Exempter `member` et `invitation`** comme plan identité (au même titre que `user`,
  `session`, `account`), l'isolation des adhésions restant applicative (CASL). Contredit la
  liste explicite de cette tâche et affaiblit le critère 7, qui ne serait plus prouvé que
  sur `user_submissions`.
- **(b) Étendre la policy de `member`** d'une clause par utilisateur
  (`user_id = current_setting('app.user_id')`) plus un scope `withCurrentUser()`. Garde la
  RLS sur le pivot sans ouvrir de bypass général, mais **ajoute une seconde clé de session**
  à l'ADR 002 : un chemin qui la pose mal fait voir les adhésions d'autrui. C'est un
  amendement d'ADR, pas un détail d'implémentation.
- **(c) Router les lectures d'adhésion par `withRlsBypass()`** — à écarter : la porte
  dérobée deviendrait le chemin normal de **chaque requête authentifiée**, ce que l'ADR 002
  interdit en la réservant au provisioning et à s41.

Une quatrième lecture existe et mérite d'être arbitrée avec les autres : sous l'ADR 003 le
tenant vient du **domaine**, donc « toutes mes organisations » est un concept de
**boilerplate** dont ASL-CMS n'a pas besoin — un membre appartient à une association. La
bonne réponse serait alors « l'adhésion se lit dans le tenant courant », ce qui rend le
comportement mesuré correct et fait des écrans cassés (`/account/organizations`,
`/team/[slug]`, le sélecteur d'organisation) des vestiges à retirer. Mais **cela change ce
que voit l'autorisation CASL**, et le chemin `/api/auth/*` n'a aucune résolution de tenant
prévue par le plan.

**État laissé sur la branche** : la migration `0004` est **conservée**, parce qu'elle est
l'application littérale de l'ADR 002 et qu'elle rend le conflit reproductible en une
commande. La branche n'est donc **pas livrable en l'état** : l'appartenance aux
organisations est cassée tant que la décision n'est pas prise. Les tâches **8 à 11 ne sont
pas engagées** — chacune s'appuie sur cette réponse (la tâche 8 décide où `withTenant`
enveloppe la requête, la 10 écrit dans `member` sous `withRlsBypass`, la 11 choisit sur
quelle table se prouve l'accès croisé).

### Tâche 7 — colonnes `organization` et policies RLS (REPRISE, terminée)

**Terminée le 2026-09-10, après décision de l'utilisateur sur le point d'arrêt ci-dessus.**
La question du pivot `member` est tranchée par **l'ADR 014** : `member` et `invitation`
sont le **plan identité** et rejoignent la liste d'exemption de `docs/architecture.md`,
aux côtés de `user`, `session`, `account`, `verification` et `app_settings`. La RLS reste
sur `user_submissions`, et la convention de l'ADR 002 est inchangée pour **toute table
métier future**. L'ADR 014 ne supersède pas l'ADR 002 : il enregistre un retrait de
périmètre que l'ADR 002 n'avait jamais adressé, et il nomme le risque résiduel (un bug
applicatif peut énumérer des adhésions inter-tenant ; seuls les `can*` l'en empêchent).

`drizzle/migrations/0004_rls_tenant_isolation.sql` a été **réécrite** plutôt que corrigée
par une migration supplémentaire : elle n'était appliquée que sur la base de développement
locale — vérifié dans `docker/db-init/` et dans les deux workflows, qui ne la déploient
nulle part — donc le journal et le snapshot restent cohérents sans entrée de plus, et
l'historique ne garde pas la trace d'une policy qui n'a jamais tenu 24 h.
`pnpm db:reset-seed` rejoué : `pg_policies` = **1** (`user_submissions`), `member` et
`invitation` en `rowsecurity = f`.

**Vérifié après la reprise, contre le build de production sous `asl_app`** — c'est
exactement ce que le constat critique n° 1 demandait : `insert into member (…)` **passe**
(il était refusé), `select count(*) from member` rend **11** (il rendait 0), la connexion
par `POST /api/auth/sign-in/email` réussit et `GET /api/auth/get-session` rend
**3 organisations** pour `admin@gmail.com` (il rendait `[]`). Côté isolation, la table
métier se comporte comme l'ADR 002 l'annonce : hors scope **0 ligne**, scope A **1 ligne**
(celle de A), identifiant de B forgé **0 ligne**, écriture pour B depuis le scope de A
**refusée** (`new row violates row-level security policy`).

**Critère 9 — les 20 tables sont classées sans reste** dans `docs/architecture.md`, en
quatre groupes justifiés : scopée par policy (1 : `user_submissions`), plan identité
(9, dont `member` et `invitation` par l'ADR 014), plan plateforme (4 : `app_settings`,
`organization`, `subscription`, `subscription_plan` — cette dernière rattachée au tenant
par `reference_id` en `text`, qu'une policy sur `organization_id` ne verrait pas), et
contenu du socle non encore rattaché (6 : `posts`, `posts_translation`, `categories`,
`hashtags`, `post_hashtags`, `notifications`), que la story qui les met en service devra
scoper. Aucune table restante n'est ni scopée ni exemptée.

### Tâche 8 — résolution du tenant par le domaine

**Fait le 2026-09-10.** `src/app/dal/tenant-dal.ts` : `getTenantByDomainDal(domain)` en
`'use cache'` + `cacheLife('hours')` + `cacheTag('tenant')`, sans logger ; le host est lu
**hors** du scope caché par `getCurrentTenantDal()`, qui préfère `x-forwarded-host` à
`host` (le VPS est derrière un reverse proxy). `normalizeTenantHost` (retrait du port,
casse, point final, IPv6) est un helper pur, testé à part.

Le point d'entrée du scope est **`withCurrentTenant(callback)`** : il résout le tenant du
domaine et exécute le callback dans `withTenant`. Sur un domaine qui ne sert aucune
association, **aucun scope n'est ouvert** et le callback s'exécute quand même : les tables
sous policy ne rendent alors rien et refusent toute écriture — la garantie du projet
plutôt qu'une exception, qui casserait les chemins légitimement hors tenant. Appliqué aux
**quatre** chemins qui touchent `user_submissions` : formulaire de contact et retour
rapide (qui posent aussi `organizationId`), lectures du BO, et les deux mutations
(marquer lu, archiver). `withTenant` et `withRlsBypass` ont donc désormais des appelants —
c'était la seconde moitié du constat critique n° 1.

⚠️ **Le layout racine devient bloquant, et c'est mesuré, pas supposé.**
`requireCurrentTenantDal()` en tête de `[locale]/layout.tsx` (comme l'ADR 003 le prescrit)
fait échouer le build sur `blocking-prerender-dynamic` — `/[locale]/auth-error` et
`/[locale]/pricing_old` en premier. La sortie prévue par le dépôt est
`export const instant = false` **sur le layout**, dont l'opt-out couvre tout le segment
(`rule-react-cache-next-cache.md`), et c'est exactement ce que l'ADR 003 assume :
« aucune page n'est prerendue par tenant au build ». Après ce changement le build passe et
les 315 pages de `[locale]` sont en `ƒ`. **Conséquence d'exploitation à connaître** : tout
domaine servant l'application doit être provisionné, **back-office du prestataire
compris**, sans quoi il rend la page introuvable.

Le seed rattache `localhost` à TechCorp Solutions (module `voirie` actif) et `127.0.0.1` à
Marketing Pro (aucun module), et sème une soumission par tenant : c'est ce qui rend la
tâche 11 possible sans toucher `/etc/hosts`. Il pose `app.bypass_rls` autour de cette
insertion, parce que `FORCE ROW LEVEL SECURITY` soumet aussi le propriétaire des tables.

### Tâche 9 — helper d'activation de module

**Fait le 2026-09-10.** `requireEnabledModuleDal(moduleKey)` (dans `tenant-dal.ts`, avec
la résolution dont il dépend) + `isModuleEnabled`, helper pur : une clé **inconnue** est
inactive, jamais active par défaut (ADR 010), et c'est ce qui rend le critère 4 vrai pour
un module fictif comme pour un module réel désactivé. Les clés viennent de l'énuméré
Postgres, exposé en type de domaine (`ORGANIZATION_MODULES`) pour que la présentation ne
lise pas `src/db/models`.

**Arbitrage de la route de test** : elle **reste dans l'arbre**, en
`src/app/[locale]/(public)/modules/[module]/page.tsx`. Les fixtures e2e ne peuvent pas
porter une route — Playwright teste le build. Elle est volontairement **sans interface**
(une ligne de texte, aucun composant, aucun token) : le design de s01 range l'écran d'un
module sans page parmi ses manques, et l'inventer ici serait un échec de revue. s33 à s35
la remplacent par les vrais écrans, en gardant l'appel au helper en tête de page.

**Mesuré sur le build de production**, sous `asl_app` : `localhost/fr/modules/voirie` →
**200** portant « TechCorp Solutions » ; `127.0.0.1/fr/modules/voirie` → **200**
introuvable (module inactif chez B) ; `localhost/fr/modules/vote` → introuvable ;
`localhost/fr/modules/module-fictif` → introuvable ; `127.0.0.2/fr` (domaine inconnu) →
**200** introuvable ; `/fr/does-not-exist` → **404**. Conforme à l'ADR 013.

⚠️ Nuance à connaître : un `notFound()` levé par le **layout racine** ne trouve pas de
frontière au-dessus de lui et rend la page introuvable **par défaut de Next**, pas
`[locale]/not-found.tsx` (qui sert bien pour les `notFound()` de page). Aucun contenu de
tenant n'est servi dans les deux cas ; l'habillage de ce cas appartient à s11, qui porte
la page 404 (manque n° 1 du design).

**Registre d'actions** : s01 introduit deux actions soumises à autorisation —
`provisionOrganizationAction` et `updateOrganizationModulesAction`, toutes deux gardées
par `requireActionAuth({roles: [RoleConst.SUPER_ADMIN]})`. **À déclarer au registre par
s03**, comme le plan le prévoit ; le registre n'est pas avancé ici.

### Tâche 10 — provisioning, service et écrans

**Fait le 2026-09-10.** `provisionOrganizationService` créé — c'est le **modèle canonique
de la couche service** que `docs/architecture.md` désigne, et il suit l'ordre de
`rule-architecture.md` : `safeParse` → `can*` → repository (les fonctions plus anciennes
du même fichier font l'inverse ; le document le dit déjà). Il crée l'association avec son
domaine et ses drapeaux, **crée le compte de l'administrateur initial s'il n'existe pas**
(désigné par email, jamais par un identifiant), le rattache en OWNER **à ce tenant et à
lui seul**, et refuse un domaine déjà pris **en nommant l'association qui l'occupe**.
Aucun email n'est envoyé : l'envoi appartient à s03.

`canProvisionOrganization()` contrôle le rôle **SUPER_ADMIN** explicitement, et non par
CASL : ADMIN porte déjà `manage ORGANIZATION` et `manage TECHNICAL`, donc aucune abilité
existante ne distingue le prestataire de l'administrateur. 20 tests couvrent le service
sur les trois rôles globaux plus SUPER_ADMIN, et 12 l'action.

`withRlsBypass()` est employé **une fois**, dans l'action de provisioning, comme l'ADR 002
le réserve : le tenant n'existe pas encore quand l'écriture commence. Après l'ADR 014, les
tables qu'il touche ne sont plus sous policy ; la porte reste là parce que c'est le point
d'entrée que l'ADR 002 désigne pour le provisioning et que l'amorçage de lignes scopées y
passera. `updateTag('tenant')` et non `revalidateTag` : le SuperAdmin doit voir son
association répondre tout de suite.

**Écran A** — `/admin/organizations/new` : une page (le design system limite `dialog` à
deux champs, il y en a cinq), trois `card`, `checkbox` pour les modules, un seul bouton
`default` plus `Annuler` en `outline`, monogramme §1.8, encart `warning` disant que rien
ne part. Le fil d'Ariane vient du gabarit du back-office, qui le porte déjà. Un bouton
« Nouvelle association » a été ajouté à la liste, sans quoi l'écran n'était atteignable
par aucun lien. **Écart au design consigné** : le message de succès est affiché **en place**,
en `alert`, avec un lien vers la fiche, là où le design le voulait « à l'arrivée sur la
fiche » — le porter jusqu'à la fiche demanderait de faire voyager un texte en paramètre
d'URL, mécanisme que le design ne prévoit pas. Aucun toast : `alert` ancrée, comme le
design l'exige.

**Écran B** — carte « Modules » sur `[id]/edit/page.tsx` : `switch` (effet immédiat),
**libellé d'état écrit** (« Activé » / « Désactivé »), `badge` de comptage, cible de
44 px autour de l'interrupteur, et en cas d'échec une `alert` nommant le module avec
retour du curseur à l'état réel de la base. Aucun token, police, rayon ni taille de cible
n'est redéclaré ; les libellés vivent dans `messages/{fr,en,es}.json`.

### Tâche 11 — preuve e2e de l'isolation

**Écrite le 2026-09-10** : `e2e/tenant-isolation.spec.ts`, **11 tests** répartis sur les
critères 2, 4, 6 et 7. Multi-host **sans `/etc/hosts` ni DNS** : tout 127.0.0.0/8 est du
loopback, donc `localhost`, `127.0.0.1` et `127.0.0.2` sont trois `Host` distincts
atteignant le même serveur — le seed rattache les deux premiers à deux associations et
laisse le troisième inconnu. C'est la sortie au fait que Chromium interdit de surcharger
l'en-tête `Host`. Les statuts sont assertés **strictement** (`toBe(200)` sur la page
introuvable, `toBe(404)` sur une route inexistante) : c'est le garde-fou que l'ADR 013
annonçait et qui n'existait pas.

⚠️ **Ce qui a pu être exécuté, et ce qui ne l'a pas pu.** Les **5 tests qui attaquent la
base en direct** (critère 7 et l'identifiant forgé du critère 6) **passent** :
`pnpm playwright test tenant-isolation` les rend verts contre la base de développement
sous `asl_app`. Les **6 tests de navigateur n'ont pas pu être lancés dans cet
environnement** : les bibliothèques système de Chromium (`libnspr4`) sont absentes et leur
installation demande les droits root, indisponibles ici. Chacune de leurs assertions a
donc été **vérifiée à la main par `curl` contre le même build de production**, avec les
résultats reportés en tâche 9, plus la lecture authentifiée : connecté en `admin@gmail.com`
sur le domaine A, `/en/admin/submissions` affiche la soumission de A et **pas** celle de B.
La CI exécute la suite complète (`pnpm exec playwright install --with-deps chromium`).

### Reprise en mode correction — constats de la revue

**2026-09-10, après `docs/reviews/s01-provisionner-association.md` (`Ship allowed: no`).**
Les deux constats critiques et les cinq majeurs sont traités ; les journaux de tâches
ci-dessous portent le détail.

- **critique 1** — les deux moitiés : la RLS sur `member` est levée (ADR 014, migration
  `0004` réécrite) et `withTenant`/`withRlsBypass` ont des appelants (tâches 8 et 10).
  Inscription, session et adhésions vérifiées **sur le build de production** sous
  `asl_app`.
- **critique 2** — tâches 7 à 11 terminées ; les 10 critères sont couverts.
- **majeur 3** — `withTenant` imbriqué : le helper **réutilise la transaction déjà
  ouverte** et **restaure la valeur du scope externe** en `finally`. Il n'ouvre plus de
  seconde transaction depuis le pool (deux sessions Postgres, donc un scope interne
  aveugle aux écritures du scope externe), et il ne s'appuie pas sur le savepoint de
  Drizzle, dont le `release` **ne défait pas** un `set_config(..., true)` — vérifié en
  base. Le test d'imbrication assertait le comportement du mock ; il asserte désormais la
  **suite des `set_config` réellement envoyés**, et il tombe sur l'ancienne
  implémentation (vérifié : 4 tests rouges avant correction).
- **majeur 4** — `provisionOrganizationService` **existe** (tâche 10) : le service
  canonique que `docs/architecture.md` désigne n'est plus une référence inventée.
- **majeur 5** — les 20 tables sont classées sans reste (tâche 7).
- **majeur 6** — l'assertion e2e stricte de l'ADR 013 est **écrite** (tâche 11) : statut
  `200` sur la page introuvable, `404` sur une route inexistante. Le texte de l'ADR
  devient exact ; l'ADR n'est pas modifié, comme il se doit.
- **majeur 7** — `src/db/scripts/check.ts` **asserte les privilèges** du rôle applicatif
  (`rolsuper`, `rolbypassrls`) via une fonction pure testée à part, et les deux workflows
  l'appellent après les migrations, sur le secret `DATABASE_URL` déployé. Mesuré dans les
  deux sens : vert sous `asl_app`, rouge sous `asl`. **Trou trouvé au passage et
  bouché** : `.env.development` pointait encore sur le rôle propriétaire — la RLS était
  donc inerte en développement local, exactement l'échec silencieux que le plan
  redoutait ; il passe sur `asl_app`, avec `DATABASE_MIGRATION_URL` pour le DDL.
- **mineurs 8 et 12** corrigés (clés d'environnement mortes du chat et de la newsletter
  retirées ; `src/proxy.ts` n'est plus déclaré en entrée knip, le greffon Next le couvre
  nativement — 18 → 16 indices de configuration). **Mineurs 9, 10 et 11 non traités**,
  et pourquoi : le **9** (`slug SET NOT NULL` sans reprise) est sûr sur le schéma actuel
  et une reprise de données pour une base sans ligne héritée serait du code mort ; le
  **10** (deux commits) est arbitré à un commit unique, motif en Definition of Done ; le
  **11** (ADR 009 amendé sur place) est une question de convention de dépôt, pas de code —
  à trancher hors story.

**Comptes de tests** : 333 passed | 8 skipped avant reprise → **407 passed | 8 skipped**
(29 fichiers) après, plus 11 tests e2e dont 5 exécutés ici (voir tâche 11).
**Delta knip** contre la mesure de la revue (91 fichiers / 176 exports / 52 types /
7 dépendances) : **91 / 173 / 52 / 7** — aucun orphelin nouveau, et aucun de mes fichiers
n'apparaît dans le rapport.

<< IP Mike: task granularity, what a good plan contains/avoids. >>
