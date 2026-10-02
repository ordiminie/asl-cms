# Revue s12-membres-parcelles : propriétaires et parcelles (1er passage)

> Revue en contexte neuf. Chaque défaut est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s12-membres-parcelles`, soit le seul commit `b8ce9e3` (70 fichiers) sur `main` à `2d5a6df`.
> Références : `docs/plans/s12-membres-parcelles.md` (`validated: yes`), AGENTS.md, ADR 001 à 030 (dont l'ADR 029 portée par la branche), `docs/design-system.md`, `docs/designs/s12-membres-parcelles.md`.

**Verdict : le ship est autorisé, sous réserve que la CI de la PR montre `e2e/member-profiles.spec.ts` verte avant le merge.** Aucun critique. Les points d'arrêt du projet sont tenus : RLS forcée sur les trois tables, `getDb()` partout, identité par UUID, aucune colonne « propriétaire actuel », période close jamais réécrite. Il reste un majeur (dates futures acceptées, sans voie de correction) et six mineurs. La suite e2e n'a pas été exécutée : la preuve d'isolation et la requête datée réelle restent à constater en CI.

## Vérifications exécutées par le reviewer

Le dépôt `/workspace` n'a pas été modifié (`git status` vide au départ et à la fin). Lint, types, règles, génération et mutations ont tourné sur une copie en disque local (`git archive` de la branche + copie de `node_modules`).

| Contrôle | Exécuté ? | Résultat |
|---|---|---|
| `pnpm test --run` (dans `/workspace`) | Oui | **`Test Files 195 passed \| 2 skipped (197)` ; `Tests 2393 passed \| 8 skipped (2401)`**, sortie 0, aucun timeout de worker. Conforme au chiffre annoncé |
| `pnpm lint` (copie) | Oui | Sortie 0, aucune ligne |
| `tsc --noEmit` (copie, sans `.next/`) | Oui | Sortie 0, rien de masqué par `routes.d.ts` |
| `pnpm check:rules` (copie) | Oui | « Règles et documentation alignées sur le code. » |
| `pnpm db:generate` (copie, `SKIP_ENV_VALIDATION=1`, URL factice) | Oui | « No schema changes, nothing to migrate » |
| Cohérence journal / instantanés | Oui | Chaîne `0028 → 0029 → 0030` cohérente ; `0029` n'ajoute que les trois tables, aucune table existante modifiée ; `0030` identique à `0029` hors identifiants (migration `--custom`) |
| `prettier --check` sur les fichiers du diff | Oui | Code conforme. Cinq docs de la story (`.md`, `.html`) non formatées, comme celles de s10 et s11 sur `main` ; la CI ne lance pas `format` |
| Clés `messages/fr.json` contre les appels `t()` | Oui | Aucune clé manquante (16 fichiers) |
| Mutations (5, sur la copie) | Oui | Quatre tuées, une survit : voir m1 |
| `pnpm build` | **Non** | Consigne |
| Suite e2e Playwright | **Non** | `e2e/member-profiles.spec.ts` relue seulement ; elle tourne en CI |
| Verrou `FOR UPDATE` sous vraie concurrence | **Non** | Aucun Postgres local ; jugé par lecture (voir « Points d'arrêt ») |

**Mutations :**

| Mutation | Résultat |
|---|---|
| `covers` : jour de la vente rendu au vendeur (`<` → `<=`) | Tuée (« rend l'acquéreur le jour de la vente ») |
| `planSale` : vente le jour du début acceptée | Tuée |
| `attachParcelService` : verrou retiré | Tuée (2 tests) |
| `recordSaleService` : verrou posé après la lecture des périodes | Tuée (2 tests) : l'ordre est épinglé |
| `closeOpenPeriodTxnDao` : `WHERE ends_on IS NULL` retiré | **Survit** : 1303 tests verts sur `src/services` et `src/db` |

## Points d'arrêt du projet

- **RLS forcée + `organization_id`** : `drizzle/migrations/0030_member_profile_parcel_rls.sql` pose `ENABLE` + `FORCE` + `tenant_isolation` sur `member_profile`, `parcel`, `parcel_ownership`, au patron de `0025`. Les trois tables portent `organization_id NOT NULL`. `rls-inventory.test.ts` est vert ; `docs/architecture.md` passe à 35 tables, 16 scopées.
- **`getDb()`, jamais `db`** : les deux repositories n'importent que `getDb`. Aucun `db.transaction()` : le point de sauvegarde de l'email pris passe par `getDb().transaction()`, donc dans la transaction du scope.
- **`withRlsBypass()`** : aucune occurrence ajoutée dans `src/`. Le seul bypass est le nettoyage de la spec e2e et le seed (porte existante).
- **Aucune écriture sur `user` ni `member`** : les repositories n'importent que `member_profile`, `parcel`, `parcel_ownership`. Aucune purge, aucune coupure d'accès.
- **Identité** : clé primaire `uuid_generate_v4()`, jamais fournie par le service (test dédié). L'email n'est qu'une contrainte d'unicité, pas une clé.
- **Relation datée (ADR 029)** : aucune colonne « propriétaire actuel ». Le repository n'expose que `openPeriodTxnDao` et `closeOpenPeriodTxnDao` ; ni mise à jour ni suppression d'une période close.
- **Rien en dur (ADR 010)** : libellés dans `messages/fr.json`, plafonds en constantes de domaine, seed fictif (`.test`). Les messages de refus en dur dans les services suivent le patron existant (`incident-report-service.ts`).
- **Concurrence, par lecture** : `withTenant` ouvre `db.transaction()` sans niveau d'isolation, donc READ COMMITTED ; aucun réglage contraire trouvé. La seconde transaction attend le verrou de la ligne `parcel`, puis relit les périodes validées par la première. Deux rattachements simultanés d'une parcelle inconnue : le second `INSERT … ON CONFLICT DO NOTHING` attend le premier, puis relit la ligne. Raisonnement, pas mesure.

## Plan, tâche par tâche

- **Tâche 1** : faite. Modèles, `0029` générée, `0030` en `--custom`, `MEMBER_PROFILE_MANAGE` (`owner`, `board`), types de domaine sans import Drizzle.
- **Tâche 2** : faite. Cas du plan présents et tués par mutation. « Écrit en premier » invérifiable avec un seul commit.
- **Tâche 3** : faite. Rôles testés (`OWNER`, `ADMIN` passent ; `MEMBER`, hors association, `PUBLIC` refusés sans DAO appelé), `email_taken` rendu comme résultat, `shouldLogDetails: () => false`.
- **Tâche 4** : faite. Verrou avant contrôle, refus typés, aucune écriture sur un refus.
- **Tâches 5 à 7** : faites, tests du plan présents (encart courrier, « au 14/06/2026 », même texte dans l'encart et l'`alert-dialog`, acquéreur présélectionné).
- **Tâche 8** : faite. Seed, ADR 029, `architecture.md`, `design-system.md` §3.11.
- **Tâche 9** : spec présente et sérieuse (instantané SQL avant/après la vente, absence de `user`/`member`, RLS depuis l'autre scope, écriture croisée refusée). Non exécutée.

**Écarts déclarés par l'implémenteur :**

- (1) DAL en `requireCurrentTenantDal()` + `withTenant` dans le service : même patron que `incident-report-dal.ts`, garantie équivalente. Accepté.
- (2), (3) phrases réécrites : sans gravité.
- (4) loupe et croix évitées : voir m5.
- (5) ajouts hors plan (`canManageMemberProfilesService`, `getSaleContextService`, `getParcelByIdDao`, nom du porteur de l'email, `?vente=`, `lastOwnershipDayOf`) : tous servent un écran du plan, aucun n'ouvre de surface nouvelle. À dire dans la PR.
- (6) nom non modifiable : voir M1.
- (7) lignes RLS d'`architecture.md` écrites en tâche 1 : sans conséquence.

## Défauts trouvés

### M1 — majeur : une date future est acceptée, et une erreur de saisie n'a aucune voie de correction

- **Où** : `src/services/parcel-ownership-service.ts:100-144` et `:173-216` ; `src/services/validation/parcel-ownership-validation.ts:16` ; `src/db/repositories/parcel-ownership-repository.ts:152-168` ; `src/db/repositories/member-profile-repository.ts:143-161`.
- **Le constat** :
  - `ownershipDateSchema` vérifie que le jour existe, pas qu'il est passé. Un rattachement ou une vente au 15/06/2062 s'enregistre.
  - « Parcelles actuelles », la colonne Parcelles de la liste et la recherche lisent `ends_on IS NULL`, pas la date du jour. Après une vente datée du mois prochain, la fiche du vendeur dit « Aucune parcelle actuelle » et la liste donne la parcelle à l'acquéreur, alors que `getParcelOwnerAtService` rend encore le vendeur.
  - Une faute de frappe sur l'année d'un rattachement (2062 pour 2026) bloque la parcelle : tout autre rattachement chevauche la période ouverte, et une vente doit être postérieure à 2062. Aucun écran ne modifie ni ne retire une période ouverte, ni ne corrige un nom ou un numéro de parcelle. Il faut du SQL.
- **Pourquoi majeur** : défaut réel, limité aux écrans du bureau. Les lignes écrites sont celles que le bureau a saisies et la lecture datée reste juste. Il ne bloque pas le ship.
- **Correctif** : soit refuser une date postérieure à aujourd'hui dans les deux services (et à l'écran), soit définir « actuelle » par la date. La voie de correction d'une période ouverte est une décision de plan : voir « À arbitrer ».

### m1 — mineur : la garde `WHERE ends_on IS NULL` n'est épinglée par aucun test

- **Où** : `src/db/repositories/parcel-ownership-repository.ts:127-139`.
- **Le constat** : c'est la garde de l'ADR 029 §4. La retirer laisse toute la suite unitaire verte, et la spec e2e ne peut pas l'atteindre (`planSale` ne vise jamais une période close). La garde est bien dans le code.
- **Correctif** : un cas e2e en SQL qui rejoue la mise à jour du DAO sur la période close de la parcelle 47 et constate zéro ligne touchée.

### m2 — mineur : la liste casse sur une recherche de plus de 100 caractères, et parle faux hors pagination

- **Où** : `src/app/[locale]/(bureau)/bureau/proprietaires/page.tsx:46-49` ; `src/app/dal/member-profile-dal.ts:32-39` ; `src/components/features/member-profile/member-profile-list.tsx:69-72` et `:114-120`.
- **Le constat** (par lecture) :
  - `?q=` de plus de 100 caractères lève `ValidationParsedZodError`, que le DAL de la liste ne traduit pas : la page part en erreur. Le champ n'a pas de `maxLength`.
  - `?page=99` rend « Aucun propriétaire ne correspond à « ». »
- **Correctif** : `maxLength` et troncature côté page ; ramener une page hors bornes à la dernière.

### m3 — mineur : la spec e2e recharge la page avant de relire

- **Où** : `e2e/member-profiles.spec.ts:385`, `:473`, `:654`, `:683` ; `:748-753`.
- **Le constat** :
  - Après un rattachement ou une modification des coordonnées, la spec fait `reload()` avant de lire. Elle passerait sur un écran qui ne se rafraîchit pas seul après `revalidatePath`.
  - La fiche de A ouverte sur le domaine de B n'est jugée que par l'absence de texte : une page en erreur passerait aussi.
- **Correctif** : lire une fois sans rechargement ; attendre le rendu « introuvable ».

### m4 — mineur : `getParcelOwnerAtService` n'est exécutée par rien

- **Où** : `src/services/parcel-ownership-service.ts:223-243` ; `e2e/member-profiles.spec.ts:189-209`.
- **Le constat** : aucun appelant dans l'application. La spec prouve un SQL recopié à la main, que j'ai comparé au DAO et trouvé équivalent, pas la requête Drizzle. Le plan l'autorise (« ou SQL équivalent au DAO »).
- **Conséquence** : la première story qui l'appellera (s18, s19, s28, s32) en sera le premier test réel.

### m5 — mineur : le contournement de la loupe et de la croix n'est pas consigné

- **Où** : `src/components/features/member-profile/sale-form.tsx:565` (`[&>button]:hidden`) et `:645-658` (`Input` à la place de `CommandInput`) ; `docs/design-system.md` §3.11.
- **Le constat** : l'implémenteur l'annonce « remonté comme gap du design system », mais le §3.11 ne consigne que l'historique daté et le `dialog` mobile. Le masquage par classe dépend de la structure interne de `SheetContent`.
- **Hors constat** : aucun composant, token ni couleur hors système. Les tailles (34, 24, 18, 17, 15 px) sont dans l'échelle, `warning` et `destructive-text` existent dans `globals.css`, l'intention des écrans 1 à 5 est tenue, la carte « Accès à l'espace membre » est bien absente.
- **Correctif** : consigner le gap 5 au design system, ou donner aux primitives une option `showCloseButton` comme `DialogContent`.

### m6 — mineur : ajouts hors de la lettre du plan

- **Où** : écart (5) ci-dessus.
- **Correctif** : les lister dans la PR.

## À arbitrer par l'utilisatrice (hors constats sur le diff)

- **Voie de correction** : le plan validé ne prévoit ni suppression d'une période ouverte, ni correction d'un nom ou d'un numéro de parcelle. Un rattachement à la mauvaise fiche ne se répare que par une « vente » fictive, qui écrit un faux historique.
- **Email unique par association** (décision A du plan, index `member_profile_organization_email_idx`) : deux fiches ne peuvent pas partager une adresse, par exemple une personne et sa SCI. AGENTS.md rappelle que l'email est « partagé dans un foyer ».
- **Tenant d'une période** : rien en base ne lie `parcel_ownership.organization_id` à celui de sa parcelle, et les contrôles de clé étrangère passent sous la RLS. Les deux services relisent la parcelle et la fiche sous RLS avant d'écrire, donc le chemin actuel est sûr. L'import de s13 doit passer par ces services, comme l'écrit l'ADR 029.
- **Parcelles voisines** : « a12 » et « A12 » créent deux parcelles. Le message « ajoutée et rattachée » le dit, sans le prévenir.

## Ce que la CI doit montrer vert avant le merge

- `e2e/member-profiles.spec.ts` en entier : critères 1 à 8, isolation entre TechCorp et Marketing Pro, RLS depuis l'autre scope, écriture croisée refusée.
- `pnpm db:migrate && pnpm db:seed` puis `pnpm db:check` avec `0029` et `0030`.
- Non-régression des specs du back-office : la barre latérale gagne une entrée.

## Checklist de revue

### Respect du plan

- [x] Les neuf tâches sont faites.
- [ ] Rien hors plan : ajouts déclarés, à dire dans la PR (m6).
- [ ] DoD « e2e vert » : non constaté, reporté à la CI.

### Anti-hallucination

- [x] Aucune API inventée. Ouverts et vérifiés : `getDb`/`withTenant` (`src/db/tenant-scope.ts`), `requireCurrentTenantDal`, `requireActionAuth`, `canPerformAction`, `createServiceInterceptor` et son option `shouldLogDetails`, `newsDateSchema`, `calendarDayOf`, `frenchDateToIso`/`isoToFrenchDate`, `ValidationParsedZodError`, `AuthorizationError`, `useIsMobile`, `DialogContent showCloseButton`, les primitives `command`, `popover`, `sheet`, `alert-dialog`.
- [ ] Aucune valeur ni logique plausible mais fausse : dates futures non bornées (M1).
- [x] Le code fait ce qu'il annonce : clôture sur période ouverte seule, vente tout ou rien, `mail_only` générée, `''` normalisée en `NULL`.

### Respect des règles

- [x] Conventions du dépôt : couches respectées, façades, `requireActionAuth` dans chaque action, migrations générées.
- [x] Aucun ADR accepté contredit ; l'ADR 029 suit le gabarit et le code lui correspond.
- [ ] Design system : respecté, un gap non consigné (m5).

### Tests

- [x] Suite unitaire lancée par le reviewer : verte (2393 tests, aucun timeout).
- [x] Les assertions épinglent les critères : quatre mutations sur cinq tuées.
- [ ] Garde d'immuabilité du DAO sans test (m1) ; rechargements dans la spec (m3).
- [ ] Suite e2e : **non exécutée**.

### Régressions

- [x] Fichiers existants touchés : `db.ts`, `action-registry-types.ts`, `bureau-sidebar.tsx`, `seed.ts`, `fr.json`. Ajouts seuls, tests existants verts.
- [ ] Non-régression e2e : à constater en CI.

## Constats

- **majeur** — `src/services/parcel-ownership-service.ts:100-216`, `src/services/validation/parcel-ownership-validation.ts:16` : date future acceptée au rattachement et à la vente ; « parcelle actuelle » lue sur la période ouverte et non sur la date ; une année mal saisie bloque la parcelle sans voie de correction (M1).
- **mineur** — `src/db/repositories/parcel-ownership-repository.ts:127-139` : `WHERE ends_on IS NULL` sans test, la mutation survit (m1).
- **mineur** — `src/app/[locale]/(bureau)/bureau/proprietaires/page.tsx:46-49`, `src/components/features/member-profile/member-profile-list.tsx:69-72` : recherche de plus de 100 caractères en erreur, page hors bornes mal dite (m2).
- **mineur** — `e2e/member-profiles.spec.ts:385,473,654,683,748-753` : rechargements avant lecture, refus croisé jugé par absence de texte (m3).
- **mineur** — `src/services/parcel-ownership-service.ts:223-243` : lecture datée sans appelant, prouvée par un SQL recopié (m4).
- **mineur** — `src/components/features/member-profile/sale-form.tsx:565,645-658`, `docs/design-system.md` §3.11 : contournement de la loupe et de la croix non consigné (m5).
- **mineur** — ajouts hors de la lettre du plan, à dire dans la PR (m6).

## Fichiers concernés

- `docs/plans/s12-membres-parcelles.md`
- `docs/decisions/029-propriete-datee-des-parcelles.md`
- `drizzle/migrations/0029_famous_serpent_society.sql`
- `drizzle/migrations/0030_member_profile_parcel_rls.sql`
- `src/db/models/member-profile-model.ts`, `src/db/models/parcel-model.ts`
- `src/db/repositories/member-profile-repository.ts`, `src/db/repositories/parcel-ownership-repository.ts`
- `src/db/tenant-scope.ts` (lecture seule)
- `src/services/member-profile-service.ts`, `src/services/parcel-ownership-service.ts`
- `src/services/rules/parcel-ownership-rules.ts`
- `src/services/validation/member-profile-validation.ts`, `src/services/validation/parcel-ownership-validation.ts`
- `src/app/dal/member-profile-dal.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/` (`page.tsx`, `nouveau/page.tsx`, `[id]/page.tsx`, `[id]/vente/[parcelId]/page.tsx`, `actions.ts`)
- `src/components/features/member-profile/` (`member-profile-list.tsx`, `member-profile-form.tsx`, `member-profile-detail.tsx`, `attach-parcel-dialog.tsx`, `sale-form.tsx`, `member-contact-fields.tsx`)
- `src/db/scripts/tenant-member-profiles-seed.ts`, `src/db/scripts/seed.ts`
- `e2e/member-profiles.spec.ts`
- `messages/fr.json`

Max severity: major
Ship allowed: yes

---

# Revue s12-membres-parcelles : propriétaires et parcelles (2e passage)

> Revue en contexte neuf. Chaque défaut est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s12-membres-parcelles`, soit `b8ce9e3` (tâches 1 à 9) puis `23fedc5` (tâches 10 et 11, 18 fichiers), sur `main` à `2d5a6df`.
> Le commit `23fedc5` a été relu comme du code neuf ; le verdict porte sur le diff entier.
> Références : `docs/plans/s12-membres-parcelles.md` (`validated: yes`, section « Ajouts après la première revue »), AGENTS.md, ADR 001 à 030, `docs/design-system.md`, `docs/designs/s12-membres-parcelles.md`, rapport du 1er passage.

**Verdict : le ship est autorisé, sous la même réserve qu'au 1er passage — la CI de la PR doit montrer `e2e/member-profiles.spec.ts` verte avant le merge.** Aucun critique, aucun majeur. Le majeur M1 du 1er passage est corrigé dans le périmètre fixé par l'utilisatrice : une date future est refusée côté serveur, avant toute écriture, et le refus ne se contourne pas en appelant l'action directement. La normalisation en majuscules vit bien dans la validation du service. Le second commit n'a rien cassé ni affaibli. Il reste les six mineurs du 1er passage (inchangés, laissés hors périmètre) et quatre mineurs nouveaux. La suite e2e n'a pas été exécutée.

## Vérifications exécutées par le reviewer

`/workspace` n'a pas été modifié (`git status` : seul le rapport non suivi du 1er passage, au départ et à la fin). Lint, types, règles et mutations ont tourné sur une copie en disque local (`git archive HEAD` + copie de `node_modules`, dans le scratchpad de session), supprimée ensuite.

| Contrôle | Exécuté ? | Résultat |
|---|---|---|
| `pnpm test --run` dans `/workspace` | Oui | **`Test Files 196 passed \| 2 skipped (198)` ; `Tests 2434 passed \| 8 skipped (2442)`**, sortie 0, aucun timeout de worker |
| Même suite sur la copie en disque local | Oui | **`Tests 2434 passed \| 8 skipped (2442)`**, sortie 0. Conforme au chiffre annoncé |
| `tsc --noEmit` (copie, sans `.next/`) | Oui | Sortie 0, aucune ligne ; rien de masqué par `routes.d.ts` |
| `eslint` (copie) | Oui | Sortie 0, aucune ligne |
| `pnpm check:rules` (copie) | Oui | « Règles et documentation alignées sur le code. » L'implémenteur ne l'avait pas lancé |
| `prettier --check` sur les fichiers de code de `23fedc5` | Oui | Conformes |
| Mutations (13, sur la copie) | Oui | **Toutes tuées** : voir le tableau |
| `pnpm db:generate` | **Non** | Non rejoué : `23fedc5` ne touche ni modèle, ni migration, ni journal (vérifié par `git show --stat`) |
| `pnpm build` | **Non** | Consigne |
| Suite e2e Playwright | **Non** | `e2e/member-profiles.spec.ts` relue seulement ; elle tourne en CI |

Une première exécution sur la copie a rendu 383 échecs (`Invalid Chai property: toBeInTheDocument`). C'était un défaut de ma copie (`node_modules` copié deux fois, l'un dans l'autre), pas du code : une fois le doublon retiré, la suite est verte. Je ne compte pas ce passage.

**Mutations sur le second commit :**

| Mutation | Résultat |
|---|---|
| A — `attachParcelService` : refus de la date future retiré | Tuée (4 tests) |
| B — `recordSaleService` : refus retiré | Tuée (2 tests) |
| C — règle pure : aujourd'hui refusé (`>` devient `>=`) | Tuée (15 tests, services et écrans) |
| D — `parcelNumberSchema` : `.toUpperCase()` retiré | Tuée (8 tests : schéma et service) |
| E — service : « aujourd'hui » lu en UTC au lieu de Paris | Tuée (« should read today as the calendar day in Paris, not in UTC ») |
| F — `dialog` : refus côté client retiré | Tuée (« sans rien envoyer ») |
| G — écran de vente : refus côté client retiré | Tuée |
| H — `dialog` : majuscule à la saisie retirée | Tuée (2 tests) |
| I — rattachement : refus déplacé après la création de la parcelle et le verrou | Tuée : « avant toute écriture » est épinglé |
| J — rattachement : refus déplacé avant l'autorisation | Tuée (3 tests de rôles) : l'ordre autorisation puis date est épinglé |
| K — action : `future_date` non relayé | Tuée |
| L — `dialog` : refus rendu par le serveur ignoré | Tuée |
| M — écran de vente : refus rendu par le serveur sans message | Tuée |

## Le second commit, relu comme du code neuf

Réponses aux questions posées pour ce passage.

- **Chemins d'écriture de `parcel.number`** : un seul dans `src/`, `findOrCreateParcelTxnDao`, appelé par le seul `attachParcelService`, qui lui passe `parsed.data.parcelNumber` déjà normalisé. L'action transmet la saisie brute ; c'est le service qui normalise, donc un appel direct de l'action avec « a12 » enregistre « A12 ».
  - Le seed écrit en SQL direct, sans passer par le schéma (`src/db/scripts/seed.ts:633`) ; ses numéros sont tous en chiffres, la normalisation n'y change rien.
  - Recherches par numéro : la relecture de `findOrCreateParcelTxnDao` reçoit le même numéro normalisé ; la recherche de la liste et de l'acquéreur est en `ILIKE`. Aucune recherche ne peut manquer la valeur stockée.
  - Aucune contrainte en base : un futur chemin d'écriture (import s13) qui contournerait le service écrirait des minuscules. Le plan le déclare hors périmètre et l'ADR 029 impose déjà le passage par le service.
- **Refus côté serveur, avant toute écriture** : dans les deux services, le contrôle suit la validation et l'autorisation et précède `withTenant` (`src/services/parcel-ownership-service.ts:124` et `:202`). Aucun DAO n'est appelé. Les deux actions n'ont pas d'autre chemin que la façade : pas de contournement. `getParcelOwnerAtService` garde le droit de lire une date future, ce qui est voulu.
- **« Aujourd'hui » serveur contre client** : même fonction `calendarDayOf` (Europe/Paris, fuseau explicite, indépendant de celui du serveur). Le client reçoit le jour calculé au rendu de la page. Les deux ne peuvent diverger que dans un sens : une page ouverte avant minuit et soumise après est **plus stricte** que le serveur, jamais plus laxiste (voir n2). `Europe/Paris` est la constante existante de s09 (`water-analysis-types.ts:149`), pas une valeur introduite ici ; pas de contradiction nouvelle avec l'ADR 010.
- **Tests existants re-datés** : ils épinglent toujours la même chose.
  - Chevauchement (service) : `2027-01-01` devient `2026-09-01`, toujours dans la période ouverte de Roy ; le résultat attendu est inchangé.
  - Clôture de la seule période ouverte : `2030-03-01` devient `2026-09-01`, toujours postérieure au début de Roy.
  - e2e critère 4 : `01/01/2027` devient `01/09/2026`, toujours pendant que Roy possède la 47 ; même message attendu, même comparaison SQL avant/après.
  - e2e, numéros d'essai et nettoyage : préfixe en majuscules des deux côtés ; les motifs `LIKE` correspondent à ce qui est stocké.
- **API vérifiées** : `z.string().trim().toUpperCase()` existe en zod 4.4.3 (installé) et s'applique avant `min`/`max` ; `calendarDayOf` (`src/services/types/domain/water-analysis-types.ts:155`) ; `frenchDateToIso` réexporté par `@/components/ui/date-field` ; option `onChange` de `form.register` ; clé `validation.dateFuture` présente dans `messages/fr.json:3917` ; `vi.useFakeTimers({toFake: ['Date']})`.
- **Design** : le refus passe par la prop `error` de `DateField`, composant existant. Aucun composant, token ni couleur ajouté.

## Statut des constats du 1er passage

| Constat | Statut | Détail |
|---|---|---|
| **M1** — date future acceptée | **Corrigé** | Refus serveur et écran. Comme aucune date future ne s'écrit plus, « parcelle actuelle » (période ouverte) et la lecture datée ne peuvent plus se contredire. La voie de correction d'une période mal saisie reste absente : décision de l'utilisatrice, hors périmètre |
| m1 — `WHERE ends_on IS NULL` sans test | Inchangé | Repository non touché |
| m2 — recherche de plus de 100 caractères, page hors bornes | Inchangé | |
| m3 — rechargements dans la spec e2e | Inchangé | Le nouveau cas ne recharge pas |
| m4 — `getParcelOwnerAtService` sans appelant | Inchangé | |
| m5 — contournement de la loupe et de la croix non consigné | Inchangé | |
| m6 — ajouts hors de la lettre du plan | Inchangé | À dire dans la PR |
| « À arbitrer » — « a12 » et « A12 » créent deux parcelles | **Résolu** par la tâche 10 | |

Aucun constat n'a été aggravé par le second commit.

## Plan, tâche par tâche

- **Tâches 1 à 9** : faites (1er passage) ; le second commit n'en défait aucune.
- **Tâche 10** : faite. Schéma, écran, messages citant le numéro normalisé, tests du plan présents et tués par mutation.
- **Tâche 11** : faite. Refus typé `future_date` dans les deux services, règle pure `isOwnershipDateInFuture` recevant le jour en argument, `ownershipDateSchema` resté sans horloge, message sous le champ de date sur les deux écrans, cas e2e présent.
- **Hors plan dans `23fedc5`** : rien. Les tests en plus (Paris contre UTC, relais par l'action) servent la tâche 11.
- **Deux commits au lieu d'un** : demandé par le plan ; ils seront écrasés au merge.

**Écarts déclarés par l'implémenteur :** tous exacts à la lecture. Les trois premiers font n1 et n2 ; le libellé seulement dans `fr.json` suit l'ADR 008 ; la formulation du refus est claire et dans le ton des autres messages.

## Défauts nouveaux

### n1 — mineur : le refus serveur et la normalisation ne sont prouvés qu'en unitaire

- **Où** : `e2e/member-profiles.spec.ts:602-644` et `:51-52`.
- **Le constat** : le cas e2e « date future » est arrêté par le client ; son contrôle SQL « rien n'est écrit » passerait aussi sur un serveur qui accepterait la date. De même, l'aide `parcelOf` saisit désormais des majuscules : aucun cas e2e ne saisit une minuscule. Les deux règles sont bien tenues par les unitaires (mutations A, B, D, I, J tuées) et ne dépendent pas de la base.
- **Détail** : `nextYear` est calculé avec l'horloge du runner ; le 31 décembre entre 23 h et minuit UTC, le 1er janvier est déjà « aujourd'hui » à Paris et le cas échouerait.
- **Correctif** : un cas qui saisit « a… » et relit le numéro stocké en SQL ; dater le cas futur à plus d'un jour.

### n2 — mineur : « aujourd'hui » de l'écran est figé au rendu de la page

- **Où** : `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx:88`, `…/vente/[parcelId]/page.tsx:104`, `src/components/features/member-profile/attach-parcel-dialog.tsx:144`, `sale-form.tsx:219`.
- **Le constat** : une page laissée ouverte après minuit refuse la date du jour comme « postérieure à aujourd'hui », alors que le serveur l'accepterait. Un rechargement règle le cas. L'inverse n'est pas possible. Sur l'écran de vente, l'encart « Ce qui va changer » reste affiché pour une date future jusqu'à l'envoi.

### n3 — mineur : la majuscule à la saisie réécrit le champ à chaque frappe

- **Où** : `src/components/features/member-profile/attach-parcel-dialog.tsx:129-134`.
- **Le constat** (par lecture, non vérifié sur appareil) : `setValue` puis `setSelectionRange` à chaque frappe est un patron connu pour mal se comporter avec les claviers prédictifs mobiles (texte doublé pendant la composition). Le test jsdom ne peut pas le voir. Le serveur normalise de toute façon.
- **Correctif possible** : `autoCapitalize="characters"` et une mise en majuscules à l'affichage, ou à la sortie du champ. À vérifier sur un téléphone avant de changer quoi que ce soit.

### n4 — mineur : deux règles nouvelles documentées seulement dans le code et le plan

- **Où** : `docs/architecture.md:256-274` ; `src/services/parcel-ownership-service.ts:42`.
- **Le constat** : « aucune date future » et « numéro en majuscules » sont des invariants dont s13 (import) dépendra ; `docs/architecture.md` ne les mentionne pas. Par ailleurs le service des parcelles importe `calendarDayOf` depuis les types du domaine « analyses d'eau » : la fonction sert maintenant deux domaines et mériterait un module commun.
- **Correctif** : deux lignes dans `docs/architecture.md` ; déplacement de `calendarDayOf` à une prochaine occasion.

## Ce que la CI doit montrer vert avant le merge

- `e2e/member-profiles.spec.ts` en entier, dont le critère 4 re-daté et le nouveau cas « date future ».
- `pnpm db:migrate && pnpm db:seed` puis `pnpm db:check` avec `0029` et `0030`.
- Non-régression des specs du back-office.

## Checklist de revue

### Respect du plan

- [x] Les onze tâches sont faites ; le second commit ne contient rien hors plan.
- [ ] Ajouts du premier commit hors de la lettre du plan, à dire dans la PR (m6, inchangé).
- [ ] DoD « e2e vert » : non constaté, reporté à la CI.

### Anti-hallucination

- [x] Aucune API inventée (liste ci-dessus, chaque cible ouverte).
- [x] Aucune valeur ni logique plausible mais fausse : bornes (aujourd'hui accepté, demain refusé), fuseau, ordre des contrôles vérifiés par mutation.
- [x] Le code fait ce qu'il annonce.

### Respect des règles

- [x] Conventions du dépôt : couches respectées, façade, `requireActionAuth`, règle pure sans horloge, libellé dans `messages/fr.json`, aucune migration.
- [x] Aucun ADR accepté contredit.
- [ ] Design system : respecté ; gap non consigné (m5, inchangé).

### Tests

- [x] Suite unitaire lancée par le reviewer : verte, 2434 tests, dans `/workspace` et sur la copie locale.
- [x] Les assertions épinglent les deux tâches : 13 mutations sur 13 tuées.
- [ ] Garde d'immuabilité du DAO sans test (m1) ; rechargements dans la spec (m3) ; refus serveur non atteint en e2e (n1).
- [ ] Suite e2e : **non exécutée**.

### Régressions

- [x] Tests existants modifiés par le second commit : ils épinglent toujours la même chose.
- [ ] Non-régression e2e : à constater en CI.

## Constats

- **mineur** — `e2e/member-profiles.spec.ts:602-644,51-52` : refus serveur et normalisation prouvés en unitaire seulement ; cas « an prochain » fragile une heure par an (n1).
- **mineur** — `src/components/features/member-profile/attach-parcel-dialog.tsx:144`, `sale-form.tsx:219` : « aujourd'hui » figé au rendu, plus strict que le serveur après minuit (n2).
- **mineur** — `src/components/features/member-profile/attach-parcel-dialog.tsx:129-134` : réécriture du champ à chaque frappe, non vérifiée sur clavier mobile (n3).
- **mineur** — `docs/architecture.md:256-274`, `src/services/parcel-ownership-service.ts:42` : invariants nouveaux non documentés, `calendarDayOf` logée dans un autre domaine (n4).
- **mineur** — `src/db/repositories/parcel-ownership-repository.ts:127-139` : `WHERE ends_on IS NULL` sans test (m1, inchangé).
- **mineur** — `src/app/[locale]/(bureau)/bureau/proprietaires/page.tsx`, `src/components/features/member-profile/member-profile-list.tsx` : recherche de plus de 100 caractères en erreur, page hors bornes mal dite (m2, inchangé).
- **mineur** — `e2e/member-profiles.spec.ts` : rechargements avant lecture, refus croisé jugé par absence de texte (m3, inchangé).
- **mineur** — `src/services/parcel-ownership-service.ts:245-265` : lecture datée sans appelant (m4, inchangé).
- **mineur** — `src/components/features/member-profile/sale-form.tsx`, `docs/design-system.md` §3.11 : contournement de la loupe et de la croix non consigné (m5, inchangé).
- **mineur** — ajouts du premier commit hors de la lettre du plan, à dire dans la PR (m6, inchangé).

## Fichiers concernés

- `docs/plans/s12-membres-parcelles.md`
- `docs/decisions/029-propriete-datee-des-parcelles.md`
- `docs/architecture.md`
- `src/services/parcel-ownership-service.ts`
- `src/services/rules/parcel-ownership-rules.ts`
- `src/services/validation/parcel-ownership-validation.ts`
- `src/services/types/domain/parcel-ownership-types.ts`
- `src/services/types/domain/water-analysis-types.ts` (lecture seule : `calendarDayOf`)
- `src/db/repositories/parcel-ownership-repository.ts`
- `src/db/scripts/seed.ts`, `src/db/scripts/tenant-member-profiles-seed.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/vente/[parcelId]/page.tsx`
- `src/components/features/member-profile/attach-parcel-dialog.tsx`
- `src/components/features/member-profile/sale-form.tsx`
- `src/components/features/member-profile/member-profile-form-validation.ts`
- `src/components/features/member-profile/sale-form-validation.ts`
- `src/services/__tests__/parcel-ownership-service.test.ts`
- `src/services/validation/parcel-ownership-validation.test.ts`
- `e2e/member-profiles.spec.ts`
- `messages/fr.json`

Max severity: minor
Ship allowed: yes
