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

---

# Revue s12-membres-parcelles : propriétaires et parcelles (3e passage)

> Revue en contexte neuf. Chaque défaut est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s12-membres-parcelles`, soit `b8ce9e3`, `23fedc5`, `f3c19c6` (rapport seul) puis `8eb2dcc` (tâche 12, 5 fichiers).
> Le commit `8eb2dcc` a été relu comme du code neuf ; le verdict porte sur le diff entier.
> Références : `docs/plans/s12-membres-parcelles.md` (section « Correctif après la CI de la PR 37 »), AGENTS.md, ADR 001 à 030, `docs/design-system.md`, `docs/designs/s12-membres-parcelles.md`, rapports des deux premiers passages.

**Verdict : le ship reste autorisé, mais la sévérité maximale remonte de mineur à majeur.** Le correctif `8eb2dcc` est juste, complet pour le cas e2e en échec, et la CI de la PR 37 est verte sur ce commit (155 passés, e2e compris). Le majeur est nouveau pour la revue, pas pour le code : l'écran « Ajouter un propriétaire » garde les valeurs de la fiche précédente quand on y revient par navigation cliente (N1). Il vient du premier commit et relève de la même cause que l'échec de la CI. Aucun critique.

## Vérifications exécutées par le reviewer

`/workspace` n'a pas été modifié (`git status` vide au départ et à la fin, HEAD `8eb2dcc`). Les mutations et les sondes ont tourné sur une copie en disque local (`git archive HEAD`, `node_modules` en lien vers celui de `/workspace`), supprimée ensuite.

| Contrôle | Exécuté ? | Résultat |
|---|---|---|
| `pnpm test --run` dans `/workspace` | Oui | `Tests 1 failed \| 2439 passed \| 8 skipped (2448)`, aucun timeout de worker. L'échec est un dépassement de 5 s dans `src/lib/better-auth/magic-link-integration-imports.test.ts` (parcours de fichiers sur le montage 9p, pendant que d'autres commandes tournaient). Fichier hors du diff de la story ; relancé seul : `Tests 2 passed (2)`. Je ne le compte ni vert ni rouge. |
| Même suite sur la copie en disque local | Oui | **`Test Files 196 passed \| 2 skipped (198)` ; `Tests 2440 passed \| 8 skipped (2448)`**, sortie 0. Conforme au chiffre annoncé. |
| Les deux fichiers de test du correctif, dans `/workspace` | Oui | `Tests 54 passed (54)` |
| `tsc --noEmit` (copie) | Oui | Sortie 0, aucune ligne |
| `eslint` sur les 4 fichiers de code de `8eb2dcc` | Oui | Sortie 0 |
| `prettier --check` sur ces 4 fichiers | Oui | Conformes. Le plan `.md` est signalé, mais il l'était déjà avant ce commit et n'est pas couvert par lint-staged. |
| Mutations (5, sur la copie) | Oui | Toutes tuées : voir le tableau |
| Sondes jetables (3, sur la copie, non versées au dépôt) | Oui | Voir N1 et n6 |
| CI de la PR 37 sur `8eb2dcc` (run 37014297624) | Lue | **`success`** : « Lint, règles, tests unitaires » vert (`Tests 2440 passed \| 8 skipped`), « Tests e2e (build de production) » vert, **`155 passed (6.8m)`** |
| CI précédente (run 37010505259) | Lue | Échec confirmé tel que décrit : `member-profiles.spec.ts:452`, attendu « Vente enregistrée… », reçu « Propriétaire enregistré. » |
| `pnpm build`, Playwright en local | **Non** | Consigne |

**Mutations sur `8eb2dcc` :**

| Mutation | Résultat |
|---|---|
| M1 — fiche remise à son état d'avant (`useState` figé) | Tuée (3 tests) |
| M2 — nettoyage du `useLayoutEffect` retiré | Tuée (le test sous `<Activity>`) |
| M3 — focus de l'alerte née dans la page retiré | Tuée |
| M4 — écran de vente remis à son état d'avant | Tuée (1 test) |
| M5 — vente : l'acquéreur de la prop est adopté à chaque nouvel objet, pas à chaque nouvel identifiant | Tuée (« ne remplace pas l'acquéreur choisi ensuite ») |

Six tests ajoutés, quatre échouent sans le correctif (3 sur la fiche, 1 sur la vente) ; les deux autres sont des gardes de non-régression. Le chiffre annoncé est exact.

## Le commit `8eb2dcc`, relu comme du code neuf

Réponses aux questions posées pour ce passage.

- **La cause annoncée est vraie.**
  - `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` : sous Cache Components, Next masque les pages avec `<Activity>` au lieu de les démonter, et en garde trois.
  - `node_modules/next/dist/client/components/layout-router.js:549` calcule la clé avec `createRouterCacheKey(activeSegment, true)`, « no search params » ; `:684-688` enveloppe chaque entrée dans `<Activity>` sous cette clé ; `bfcache-state-manager.js` fixe `MAX_BF_CACHE_ENTRIES` à 3.
  - `next.config.ts:36` porte `cacheComponents: true`.
  - La fiche `?cree=1` et la fiche `?vente=…` ont donc la même clé `__PAGE__` sous `[id]` : même instance, nouvelles props, état conservé.
  - Contre-épreuve par élimination : avec `?vente=` dans l'URL, `created` vaut `false` côté serveur ; « Propriétaire enregistré. » ne pouvait venir que de l'état conservé.
- **Le correctif est complet pour le cas e2e**, lu depuis la navigation de la spec.
  - Création (`goto` puis `router.push` vers `?cree=1`), rattachement, `reload` (l'URL garde `?cree=1`, l'état repart sur « created »), lien vers la vente (fiche masquée), `router.push` vers `?vente=`.
  - Au retour, `notice = pageNotice ?? arrivalNoticeOf(props)` : `pageNotice` est nul, `created` est faux, la vente se lit dans `parcels.former`.
- **`parcels.former` est frais au retour.**
  - `recordSaleAction` attend le service puis appelle `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')`.
  - Côté client, `server-action-reducer.js:218-236` vide alors le cache de données dynamiques (`invalidateBfCache`) et le cache de préchargement.
  - `src/app/dal/member-profile-dal.ts` ne porte aucun `'use cache'` (seulement `cache()` de React, par requête).
  - L'URL `?vente=…` n'a jamais été visitée : `staleTimes.dynamic: 30` ne peut pas servir une ancienne réponse.
- **Le nettoyage en `useLayoutEffect` est sain.**
  - C'est le patron que donne le guide Next (« Resetting stale status messages »).
  - Sous Strict Mode, le nettoyage rejoué au montage remet `null` sur `null`. Sonde B : l'alerte « Parcelle 52 ajoutée… » reste affichée et focalisée.
  - Au démontage réel, le `setState` est sans effet.
  - Le focus est inchangé : `pageNotice` ne porte que les deux genres qui prenaient déjà le focus. Au retour sur la fiche, l'effet rejoué ne focalise plus rien, ce qui est mieux qu'avant.
  - Une réserve latente : voir n6.
- **Aucune réapparition nouvelle d'une alerte d'arrivée.**
  - Tant que la fiche reste visible, une alerte née dans la page masque l'alerte d'arrivée, même avec `?cree=1` dans l'URL.
  - Il n'existe pas de bouton pour fermer l'alerte.
  - Au rechargement, ou au retour par l'historique sur une URL qui porte encore `?cree=1` ou `?vente=`, l'alerte d'arrivée se redit. C'était déjà le cas avant ce commit, et le plan le demande (« à chaque arrivée »). Pas une régression.
- **`sale-form.tsx` est dans le périmètre de la tâche 12** (« retour de l'écran de vente après création d'un acquéreur, `saleReturn` […] le corriger s'il y est »).
  - Le défaut y était : l'écran de vente reste monté sous `[id]` pendant qu'on est sur `/nouveau`, et l'acquéreur arrive en prop sur la même instance.
  - La logique est juste : l'ajustement d'état pendant le rendu est le patron documenté par React ; la comparaison porte sur l'identifiant, donc un simple rafraîchissement n'écrase pas un choix manuel ; un nouvel acquéreur créé ensuite est bien adopté ; l'absence de `?acquereur=` ne vide pas le choix en cours.
  - La date n'a pas besoin du même traitement : elle vit dans l'état conservé, et un écran évincé se remonte en lisant les props.
  - Les deux tests l'épinglent (M4, M5).
- **Le test sous `<Activity>` est un vrai `Activity`** (`import {Activity} from 'react'`, React 19.2.8). M2 le prouve : sans le nettoyage, il échoue.
- **Aucune des 6 specs non lancées n'a échoué** : la CI sur `8eb2dcc` rend 155 passés. À la lecture, elles n'étaient pas exposées : leurs lectures après une navigation cliente passent par `getByRole` ou sont bornées au `dialog`, et leurs autres étapes partent d'un `goto`.
- **API vérifiées** : `useLayoutEffect`, `Activity` (React 19.2.8) ; `soldParcelPathOf`, `saleReturnPathOf`, `newBuyerPathOf` (`member-profile-paths.ts`) ; `BuyerOption` (`sale-form-validation.ts`) ; clés `detail.created`, `detail.contactSaved`, `detail.sold`, `detail.parcels.attached*` dans `messages/fr.json:3927-3963`.
- **Design** : aucun composant, token ni couleur ajouté. Aucun ADR concerné.

## Défauts nouveaux

### N1 — majeur : « Ajouter un propriétaire » garde les valeurs de la fiche précédente

- **Où** : `src/components/features/member-profile/member-profile-form.tsx:84-118` ; `src/app/[locale]/(bureau)/bureau/proprietaires/nouveau/page.tsx`.
- **Le constat** : après un enregistrement réussi, le formulaire fait `router.push` sans se vider. Next garde `/nouveau` monté (clé `nouveau`, trois entrées au niveau `proprietaires`).
  - Parcours : liste, « Ajouter un propriétaire », enregistrer, fiche, retour à la liste, « Ajouter un propriétaire ». Le formulaire revient avec le nom, l'email, le téléphone et l'adresse du propriétaire précédent, et `submitted` à vrai.
  - Le même effet touche la création d'un acquéreur depuis une vente.
- **Preuves** :
  - Le guide Next décrit ce cas exact (« Resetting form state on submit »).
  - Les clés de route ont été vérifiées dans la source.
  - Sonde sous un vrai `<Activity>` (enregistrer, masquer, réafficher) : `name= Jean Dupont | phone= 0612345678`.
  - **Non observé dans un navigateur.** La spec e2e ne peut pas le voir : `createProfile` ouvre `/nouveau` par `page.goto`.
- **Pourquoi majeur et pas critique** : rien n'est écrit en silence ; les valeurs sont à l'écran et le nom est obligatoire. Mais c'est la boucle de saisie principale de la story, et un téléphone ou un complément d'adresse de la fiche précédente peut partir sur la suivante si on ne le voit pas.
- **Correctif** : vider le formulaire au succès, avant `router.push` (`form.reset()`, `setSubmitted(false)`), avec un test sous `<Activity>` qui échoue avant. Petit, à faire avant le merge si l'utilisatrice le souhaite ; la règle du gate ne l'impose pas.

### n5 — mineur : autres états conservés au retour sur un écran

- **Où** : `src/components/features/member-profile/sale-form.tsx:114-127` ; `member-profile-detail.tsx:121-122` ; `attach-parcel-dialog.tsx:283-288`.
- **Le constat** (par lecture) :
  - L'écran de vente quitté par « Annuler » puis rouvert pour la même parcelle garde la date, l'acquéreur, et surtout un refus ou une erreur périmés.
  - Le `dialog` de rattachement quitté par le lien « Ouvrir la fiche de … » est encore ouvert, avec son refus, quand on revient sur la fiche.
  - L'encart « Ce qui va changer » et la confirmation relisent l'état : aucune vente ne part à l'aveugle.

### n6 — mineur : le nettoyage efface aussi l'alerte si le `Suspense` de la page repasse en repli

- **Où** : `src/components/features/member-profile/member-profile-detail.tsx:136`.
- **Le constat** : React joue les nettoyages de `useLayoutEffect` quand un `Suspense` masque un contenu déjà affiché. Sonde : après un rattachement, un repli visible fait disparaître « Parcelle 52… » et revenir « Propriétaire enregistré. ».
- **Pas atteint aujourd'hui** : le rafraîchissement après une Server Action est une transition (`app-call-server.js:16`), qui garde le contenu affiché. La CI le confirme : les specs lisent l'alerte née dans la page après `revalidatePath`.
- **Correctif possible** : le drapeau `shouldReset` du guide Next ne change rien à ce point ; le noter en commentaire suffit.

### n7 — mineur, non observé : la route de vente devient introuvable avant le retour sur la fiche

- **Où** : `src/components/features/member-profile/sale-form.tsx:257-262` ; `src/services/parcel-ownership-service.ts:335-339`.
- **Le constat** (par lecture) : la revalidation portée par la réponse de l'action rafraîchit la route courante, l'écran de vente, dont le contexte n'existe plus une fois la vente faite (`notFound()`). Le `router.push` suit. Un affichage bref de « introuvable » est possible entre les deux ; je n'ai pas pu trancher à la lecture de React.
- Antérieur à `8eb2dcc`. À regarder une fois à la main sur le build de prod.

### n8 — mineur : deux parcours corrigés ne sont prouvés qu'en jsdom

- **Où** : `e2e/member-profiles.spec.ts:479`.
- **Le constat** : aucun cas e2e ne passe par « créer l'acquéreur depuis la vente, revenir présélectionné », ni par « rattacher puis vendre sans recharger ». Le `reload` de la ligne 479 (m3) évite justement le second. Les tests de composant les tiennent (M2, M4).

## Statut des constats antérieurs

- **m1 à m6, n1 à n4** : inchangés, `8eb2dcc` n'y touche pas.
- **Réserve des deux premiers passages (« la CI doit montrer la spec verte »)** : levée, 155 passés sur `8eb2dcc`.

## Plan, tâche par tâche

- **Tâches 1 à 11** : faites (passages 1 et 2) ; `8eb2dcc` n'en défait aucune.
- **Tâche 12** : faite.
  - Alerte d'arrivée dérivée des props.
  - Alertes nées dans la page conservées, focus compris.
  - `saleReturn` vérifié et corrigé.
  - Test « créée → vente » présent, en échec avant le correctif.
  - Case cochée dans le plan.
- **Hors plan dans `8eb2dcc`** : rien. Le nettoyage au masquage est nécessaire à « l'alerte reflète les paramètres courants » : sans lui, une alerte née dans la page masquerait la vente au retour.
- **Écart déclaré par l'implémenteur** (`MemberProfileForm` non corrigé) : exact, et conforme au « ne rien toucher d'autre » du plan. C'est N1.

## Checklist de revue

### Respect du plan

- [x] Les douze tâches sont faites ; le troisième commit ne contient rien hors plan.
- [ ] Ajouts du premier commit hors de la lettre du plan, à dire dans la PR (m6, inchangé).

### Anti-hallucination

- [x] Aucune API inventée (liste ci-dessus, chaque cible ouverte ; source Next lue).
- [x] Aucune valeur ni logique plausible mais fausse dans `8eb2dcc`.
- [x] Le code fait ce qu'il annonce ; la cause annoncée est vérifiée.

### Respect des règles

- [x] Conventions du dépôt respectées ; aucune migration, aucun libellé en dur.
- [x] Aucun ADR accepté contredit.
- [x] Design system respecté par `8eb2dcc` ; gap non consigné (m5, inchangé).

### Tests

- [x] Suite unitaire lancée par le reviewer : `Tests 2440 passed | 8 skipped (2448)` sur la copie locale et en CI ; un dépassement de délai sans rapport sur le montage 9p.
- [x] Les assertions épinglent la tâche 12 : 5 mutations sur 5 tuées.
- [x] Suite e2e : verte en CI sur `8eb2dcc` (155 passés) ; non exécutée en local.
- [ ] État conservé de `/nouveau` sans test (N1) ; parcours corrigés sans e2e (n8) ; mineurs m1, m3, n1 inchangés.

### Régressions

- [x] Aucune régression introduite par `8eb2dcc`.
- [ ] Défaut du premier commit mis au jour par ce passage : N1.

## Constats

- **majeur** — `src/components/features/member-profile/member-profile-form.tsx:84-118` : le formulaire d'ajout garde les valeurs de la fiche précédente au retour par navigation cliente (N1).
- **mineur** — `src/components/features/member-profile/sale-form.tsx:114-127`, `attach-parcel-dialog.tsx:283-288` : brouillon, refus et `dialog` conservés au retour (n5).
- **mineur** — `src/components/features/member-profile/member-profile-detail.tsx:136` : alerte née dans la page perdue si le `Suspense` repasse en repli ; non atteint aujourd'hui (n6).
- **mineur** — `src/components/features/member-profile/sale-form.tsx:257-262` : route de vente introuvable entre l'action et le retour, non observé (n7).
- **mineur** — `e2e/member-profiles.spec.ts:479` : retour d'acquéreur et vente sans rechargement non couverts en e2e (n8).
- **mineur** — m1 à m6 et n1 à n4 des passages précédents, inchangés.

## Fichiers concernés

- `docs/plans/s12-membres-parcelles.md`
- `src/components/features/member-profile/member-profile-detail.tsx`
- `src/components/features/member-profile/member-profile-detail.test.tsx`
- `src/components/features/member-profile/sale-form.tsx`
- `src/components/features/member-profile/sale-form.test.tsx`
- `src/components/features/member-profile/member-profile-form.tsx`
- `src/components/features/member-profile/attach-parcel-dialog.tsx`
- `src/components/features/member-profile/member-profile-paths.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/vente/[parcelId]/page.tsx`
- `src/app/[locale]/(bureau)/bureau/proprietaires/nouveau/page.tsx`
- `src/app/dal/member-profile-dal.ts`
- `src/services/parcel-ownership-service.ts`
- `e2e/member-profiles.spec.ts`
- `next.config.ts`
- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
- `node_modules/next/dist/client/components/layout-router.js`
- `node_modules/next/dist/client/components/bfcache-state-manager.js`
- `node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js`
- `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js`

Max severity: major
Ship allowed: yes
