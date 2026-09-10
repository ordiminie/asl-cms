# Review — Story s01-provisionner-association

> Revue en contexte neuf (subagent `reviewer`), le 2026-09-10.
> Diff jugé : `git diff main...feature/s01-provisionner-association` — 187 fichiers,
> +9404 / −17577. Commit unique `99e9a8f`.
> Tout ce qui suit a été vérifié contre le code et la base de données vivante, **pas** contre le
> journal du plan : les cases cochées et les notes de `docs/plans/s01-provisionner-association.md`
> ont été traitées comme des affirmations à vérifier.

## Ce qui a été exécuté

| Vérification                                     | Résultat                                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`                                | **333 passed, 8 skipped**, 19 fichiers — conforme au journal                                                                                                              |
| `npx tsc --noEmit`                               | propre, sortie 0                                                                                                                                                          |
| `pnpm lint`                                      | propre (seul l'avertissement préexistant sur `.remember/tmp/last-ndc.ts`, non suivi)                                                                                      |
| `pnpm check:rules`                               | ✅ passe — **critère 10 réellement atteint**                                                                                                                              |
| `pnpm knip`                                      | 91 fichiers / 176 exports / 52 types / 7 deps contre une baseline 89 / 220 / 71 / 2 — aucun orphelin nouveau imputable au retrait au-delà des 3 documentés volontairement |
| Base vivante (`asl` / `asl_app` sur l'hôte `db`) | 20 tables, 3 policies, `asl_app` = `rolsuper=f, rolbypassrls=f`                                                                                                           |
| `pnpm test:e2e`                                  | **non exécuté** — exige `pnpm build`, qu'AGENTS.md déconseille, et les preuves SQL ci-dessous tranchent déjà la question                                                  |

## Conformité au plan

- [x] Tâches 1 à 6 réalisées comme spécifié (vérifiées fichier par fichier)
- [ ] **Le code fait ce que le plan spécifie, rien de plus** — la tâche 7 est arrêtée à mi-chemin
      avec sa migration commitée, et les tâches 8 à 11 n'ont jamais été engagées

Vérifiés absents : `src/app/dal/tenant-dal.ts`,
`src/app/[locale]/admin/organizations/new/page.tsx`, `e2e/tenant-isolation.spec.ts`, tout helper de
contrôle de module, toute action de création (le fichier d'actions ne porte toujours que
update/delete/addUser/deleteInvitation). La carte « Modules » de l'écran B est absente de
`[id]/edit/page.tsx` — ce fichier ne perd que ses colonnes d'usage Projets et Crédits.

**Critères d'acceptation : 3 sur 10 atteints** (8, 10, et partiellement 3 — la colonne existe, rien
ne permet de la modifier). Critères 1, 2, 4, 5, 6, 7 et 9 non atteints.

## Constats

### critical 1 — La RLS est active, aucun code ne pose jamais le tenant : lectures **et écritures** d'appartenance cassées dans toute l'application

`drizzle/migrations/0004_rls_tenant_isolation.sql` active `FORCE ROW LEVEL SECURITY` sur `member`,
`invitation` et `user_submissions`, et `docker-compose.yml` repointe l'application sur le rôle
non-bypass `asl_app`. Mais `withTenant` / `withRlsBypass` n'ont **aucun appelant** dans `src/` ni
`e2e/` — `git grep` hors de `tenant-scope.ts` ne retourne rien — parce que la tâche 8, celle qui
aurait enveloppé les requêtes, n'a jamais été engagée.

Mesuré, non déduit :

```
asl_app:  select count(*) from member   ->  0      (le propriétaire asl en voit 11)
asl_app:  insert into member (...)      ->  ERROR: new row violates
                                             row-level security policy for table "member"
```

Rayon d'impact, chaque maillon ouvert et vérifié :

- `getUserByIdDao` (`src/db/repositories/user-repository.ts:39`) charge `members` via `getDb()` →
  retourne `organizations: []` pour **toute** session. C'est ce que le `customSession` de Better Auth
  exécute à chaque requête : le sélecteur d'organisation, les rôles d'organisation CASL,
  `/account/organizations` et `/team/[slug]` perdent tous leurs données.
- **L'inscription est cassée**, pas seulement dégradée : `auth.ts:302` →
  `createOrganizationForUserService` (`user-service.ts:114`) → `createUserRoleAndOrganizationTxnDao`
  → `insert(member)`, soit exactement l'instruction refusée ci-dessus. `e2e/auth.spec.ts:50`
  (« should successfully register a new user ») ne peut pas passer.
- `e2e/authorization.spec.ts:83` asserte `expect(names.length).toBeGreaterThan(1)` sur le sélecteur
  d'organisation — impossible avec une liste vide.

**Aucun test ne l'attrape** : les tests unitaires mockent tous les repositories, et aucune spec e2e
n'a été ajoutée. Les 333 tests sont verts précisément parce qu'ils ne peuvent pas le voir. Le journal
du plan arrive à la même conclusion (« la branche n'est donc pas livrable en l'état ») et la base le
confirme.

### critical 2 — Story incomplète : 7 des 10 critères non atteints, DoD non satisfaite

Tâches 8 à 11 absentes, tâche 7 arrêtée sur une question ouverte réelle — `member` est-elle une table
métier ou le **pivot identité ↔ tenant** ? **L'arrêt lui-même est un bon jugement** : les trois voies
possibles changent le modèle de sécurité et aucune n'est couverte par un ADR accepté. Mais la branche
conserve la migration `0004` appliquée pendant que la résolution reste pendante, et c'est ce qui
transforme un arrêt honnête en critical 1. La story ne peut pas être livrée en cet état.

### major 3 — Un `withTenant` imbriqué laisse silencieusement la base scopée sur le tenant interne

`src/db/tenant-scope.ts:34-45` utilise `db.transaction()`, que Drizzle implémente en
`savepoint` / `release savepoint` lorsqu'il est imbriqué
(`node_modules/drizzle-orm/node-postgres/session.js:205-222`). Or `set_config(..., true)` a une portée
**de transaction**, pas de savepoint : le réglage survit au `release`. Prouvé en Postgres :

```sql
begin; select set_config('app.organization_id','AAAA',true);
savepoint sp1; select set_config('app.organization_id','BBBB',true); release savepoint sp1;
select current_setting('app.organization_id', true);   -->  BBBB
```

Après la sortie d'un scope imbriqué, `getDb()` rend la transaction externe alors que la base reste
scopée sur le tenant **interne** : les requêtes suivantes du tenant externe lisent silencieusement
les lignes du mauvais tenant. Cela **inverse la garantie** sur laquelle AGENTS.md s'appuie — « un
oubli de scope ne fuite pas : il ne retourne rien ».

Pire, `src/db/tenant-scope.test.ts:116-128` s'intitule « le scope interne remplace le scope externe,
**puis le rend** » et passe — mais seulement parce que le mock crée un nouvel objet JS par appel
imbriqué et ne modélise aucun savepoint. L'assertion épingle le comportement du mock, pas celui de la
base. C'est le helper porteur des 41 stories restantes ; il n'a aucun appelant aujourd'hui, et c'est
la seule raison pour laquelle ce constat est major et non critical.

### major 4 — `docs/architecture.md` désigne un service canonique qui n'existe pas

Le diff remplace la référence à `createProjectService` par « **`provisionOrganizationService` dans
`src/services/organization-service.ts`** » comme modèle canonique de la couche service
(`docs/architecture.md:84`). `git grep provisionOrganizationService -- src` ne retourne **rien** :
c'était le livrable de la tâche 10, jamais commencée. Le document que 41 stories doivent recopier
pointe désormais vers une fonction inventée.

### major 5 — Critère 9 non atteint : 12 tables ni scopées ni exemptées

La liste d'exemption de `docs/architecture.md` est inchangée et couvre toujours 5 tables (`user`,
`session`, `account`, `verification`, `app_settings`). Contre le schéma vivant : 20 tables, 3 avec
policy, 5 exemptées → **12 non classées** : `apikey`, `categories`, `hashtags`, `notifications`,
`organization`, `post_hashtags`, `posts`, `posts_translation`, `subscription`, `subscription_plan`,
`two_factor`, `user_settings`. Le critère exige que l'ensemble exempté soit **exactement** la liste
documentée.

### major 6 — L'ADR 013, accepté, affirme un garde-fou e2e qui n'existe pas

La section Decision de l'ADR 013 énonce que le statut mesuré « est **asserté strictement en e2e**
(`toBe(200)`) … le test tombe le jour où la situation change ».
`grep -rniE '404|not-?found' e2e/` ne retourne **rien**. L'ADR est marqué `accepted` alors que la
sauvegarde qu'il promet n'est pas écrite — et le même diff supprime les specs 401/403 de
`/api/projects` sur lesquelles reposait à l'origine sa réserve « Route Handler ». Le travail de
mesure est solide et le raisonnement juste ; c'est l'**application revendiquée** qui est fictive.

### major 7 — Rien ne garantit le rôle applicatif en environnement déployé : la RLS y serait silencieusement inerte

`resolveMigrationUrl` (`src/db/scripts/db-url.ts:26`) retombe sur `DATABASE_URL` quand
`DATABASE_MIGRATION_URL` est absente, et ni `preview.yml` ni `production.yml` ne change le secret
`DATABASE_URL` déployé. Si ce secret pointe encore sur le rôle propriétaire/superuser — l'état dont
ce diff hérite — `FORCE ROW LEVEL SECURITY` ne le contraint pas et **toutes les policies sont posées
et sans effet**. C'est mot pour mot l'échec que le plan appelait « le pire des cas parce qu'il est
silencieux ». `src/db/scripts/check.ts` est inchangé et n'asserte rien sur `rolsuper` /
`rolbypassrls` : aucun garde-fou n'existe. Le repli est défendable pour la compatibilité ; le livrer
sans assertion de privilège ne l'est pas.

### minor 8 — Configuration d'environnement morte pour des sous-systèmes retirés

`src/env-schemas.ts:103-112` et `src/env.ts:73-80` conservent `CHAT_PROVIDER`, `OLLAMA_BASE_URL`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` et `MAILCHIMP_API_KEY` / `_SERVER_PREFIX` / `_AUDIENCE_ID`,
tous non référencés hors de ces deux fichiers. La clé d'affiliation a été retirée ; celles du chat et
de la newsletter non. Le critère 8 étant atteint sur le schéma, les tests et knip, c'est un résidu
cosmétique.

### minor 9 — `slug SET NOT NULL` sans reprise de données

`drizzle/migrations/0003_huge_misty_knight.sql` promeut `organization.slug` en `NOT NULL` sans
backfill ni garde. Tous les chemins d'insertion actuels génèrent un slug (`generateUniqueSlug`,
`user-service.ts:122`) et tsc l'impose, donc c'est sûr aujourd'hui — mais la migration échouera sur
toute ligne héritée dont le slug est nul.

### minor 10 — Un seul commit, là où la DoD du plan en exigeait deux

`git log --no-merges main..HEAD` ne montre qu'un commit (`99e9a8f`), portant à la fois le retrait
ADR 009 et le socle multi-tenant. Le plan faisait du « retrait révocable seul » la raison même de
garder le retrait dans s01 ; tel que commité, il ne peut pas être révoqué séparément. La
justification donnée par l'implémenteur est réelle (`seed.ts` et les 8 repositories portent des hunks
de deux tâches distinctes), mais l'objectif de la DoD n'est pas atteint.

### minor 11 — ADR 009 amendé sur place

AGENTS.md déclare les ADR immuables (« une modification passe par un nouvel ADR qui supersède
l'ancien »). L'ajout de 64 lignes est en append-only, clairement marqué comme écrit par s01,
factuellement exact (chemins vérifiés par échantillon) et explicitement demandé par le plan — mais
cela reste une édition d'un ADR accepté. À confirmer comme convention voulue.

### minor 12 — `knip.json` déclare `src/proxy.ts` à la fois en entrée et en ignore

La correction `src/middleware.ts` → `src/proxy.ts` était nécessaire et est juste, mais knip signale
désormais `src/proxy.ts — Remove redundant entry pattern` parmi ses 18 indices de configuration.

## Anti-hallucination

- [x] **Aucune API inventée dans le code** — chaque import et appel nouveau a été ouvert :
      `resolveMigrationUrl`, `getDb`, `withTenant`, `withRlsBypass`, `organizationModuleEnum`, les 8
      repositories migrés. Tous existent avec les signatures employées, et `getDb()` a bien remplacé
      tous les imports directs de `db` (`git grep 'models/db' src/db/repositories/` → vide).
- [ ] **Références inventées dans la documentation** — constats 4 et 6.
- [ ] **Logique plausible mais fausse** — constat 3 (portée savepoint vs `set_config`).
- [x] `set_config` au lieu du `SET LOCAL` littéral de l'ADR 002 est **correct et correctement
      justifié** ; la non-paramétrabilité de `SET LOCAL` a été confirmée. Intention préservée, écart
      documenté dans le code.

## Tests

- [x] Suite exécutée par le relecteur : 333 passed / 8 skipped
- [x] `tenant-scope.test.ts` et `db-url.test.ts` portent de vraies assertions — le test de
      paramétrage (`expect(statements[0].sql).not.toContain(ORGANIZATION_ID)`) et la garde uuid
      échoueraient réellement sur une implémentation cassée. Bons tests.
- [ ] **Les assertions n'épinglent pas les critères d'acceptation** : rien ne couvre les critères 1
      à 7. Les diffs des tests de service organisation et fichier sont de pures mises à jour de
      fixtures (`domain: null`, `enabledModules: []`), pas une couverture nouvelle. Et le test
      d'imbrication **certifie un comportement que la base n'a pas**.

## Conformité aux règles

- [x] Couches respectées, convention `getDb()`, `pnpm test --run`, aucune occurrence de
      `withRlsBypass` hors de sa définition, aucune valeur en dur (les clés de modules sont un
      énuméré typé, conforme ADR 010), aucun token / couleur / police de design introduit (le diff
      n'ajoute aucune UI — lignes `.tsx` / `.css` ajoutées grepées pour hex, `rgb(`, `hsl(`,
      `font-family`, valeurs Tailwind arbitraires : néant)
- [ ] ADR 003 contredit sur le 404 — correctement mesuré et superseded par l'ADR 013, mais voir
      constat 6
- [ ] ADR 002 appliqué à la lettre alors que son prérequis — un scope de tenant sur tout chemin
      serveur — est absent : constat 1
- [x] Design system : **aucune dérive, parce qu'aucun écran n'a été construit.** Les écrans A et B de
      `docs/designs/s01-provisionner-association.md` sont simplement absents (relève du critical 2).
      ADR 008 correctement laissé hors périmètre.

## Régressions

- [ ] **Appartenance aux organisations, inscription et invitations cassées sur le chemin touché** —
      critical 1.

## Ce qui mérite d'être salué

Le travail de recherche et de mesure de ce diff est d'une honnêteté inhabituelle : la découverte du
307-et-non-404, la non-paramétrabilité de `SET LOCAL`, le piège du volume `pgdata`, l'avertissement
sur la précédence des variables d'environnement du conteneur, la baseline knip **rejouée** sur un
worktree plutôt que devinée, et la décision de s'arrêter à la tâche 7 plutôt que d'inventer un modèle
de sécurité. Le retrait lui-même (critères 8 et 10) est propre et complet. Le problème n'est pas de
la négligence — c'est qu'une migration RLS à moitié appliquée a été laissée sur la branche pendant
que la question qui la bloque reste ouverte.

## Déblocage recommandé

Soit **révoquer la migration `0004`** (en gardant `0003`) pour que la branche redevienne
fonctionnelle pendant que la question `member` part en ADR, soit **trancher la question du pivot puis
poser l'enveloppement `withTenant` de la tâche 8** avant toute autre chose. Puis finir 9 à 11.
Les constats 3, 4, 6 et 7 doivent être corrigés dans le même cycle — le 3 en particulier, parce qu'il
corrompt la convention héritée par 41 stories.

---

Max severity: critical
Ship allowed: no
