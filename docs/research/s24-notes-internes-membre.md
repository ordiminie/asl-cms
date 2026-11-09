# Research — Story s24-notes-internes-membre

Recherche du 9 novembre 2026, sur `main` à `b12eed8a` (s22 mergée, PR 61). `docs/reviews/stories.md` : `Stories ready: yes`.
Dépendance s12 : livrée. Aucun `docs/research/s24*`, `docs/plans/s24*`, `docs/designs/s24*` ni branche `feature/s24-*` n'existe.

## Target story

**Tenir les notes internes sur un membre** — complexité 2, **story avec écran** (la fiche membre du bureau). Le bureau consigne des notes et
l'historique des échanges sur un membre, pour que le suivi survive au renouvellement du bureau.

Critères d'acceptation (docs/stories.md l. 1919-1966) :

1. Le bureau ajoute une note **datée et signée** sur la fiche d'un membre, et la retrouve à la consultation suivante.
2. Le bureau consigne un **échange** : date, canal (téléphone, courrier, en personne, email), résumé libre.
3. La fiche affiche notes et échanges dans **un fil chronologique unique**, chaque entrée portant auteur, date et type.
4. Un membre n'a **aucun** accès aux notes internes, ni les siennes ni celles d'un autre, ni par une page ni par un appel serveur côté membre
   (**test d'autorisation explicite**). Leur présence dans sa copie de données relève de s40.
5. Une note peut être modifiée ou supprimée par le bureau ; **l'auteur et la date de dernière modification restent visibles**.

Notes agentiques qui contraignent : un « échange » est une **saisie manuelle** du bureau, jamais une agrégation automatique des signalements,
questions ou campagnes (extension explicitement exclue). Sensible RGPD : l'étanchéité côté membre est **un test**, pas une intention ; les notes
doivent entrer dans l'export d'association (s38) et dans la copie du membre (s40), « à noter dans le plan de s38 ». **Ne pas exposer ces notes
dans une réponse d'API partagée avec la présentation membre — le risque est le DTO trop large réutilisé.**

## Current state of the code

**Rien n'existe pour les notes.** `grep` sur `note|échange` côté modèle/service/DAL ne rend rien de relatif à un membre. Tout est à créer ; ce
qui existe, c'est la fiche sur laquelle on se branche et trois patrons récents à suivre.

- **Fiche membre** — table `member_profile` (`src/db/models/member-profile-model.ts`) : `id` uuid (seule identité), `organization_id`, `name`,
  `email`, coordonnées, `user_id` (compte ouvert, `ON DELETE SET NULL`), `pennylane_customer_id`, `mail_only` générée. RLS forcée.
  **Aucune suppression de fiche n'existe** dans le code (ADR 049 l'écrit : « aucune suppression de fiche n'existe encore »).
- **Écran de la fiche, côté bureau** — `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx` : RSC derrière `<Suspense>`, qui lit
  `canManageCurrentMemberProfilesDal`, `getMemberProfileForBureauDal(tenant.id, id)` puis `getMemberParcelsForBureauDal`, et rend
  `MemberProfileDetail` (`src/components/features/member-profile/member-profile-detail.tsx`, composant client) avec les Server Actions
  passées en props. Cartes existantes : coordonnées, accès à l'espace membre (s12d), rôle (s14, `member-role-card.tsx`), parcelles. Un
  composant `DetailCard` (`member-profile-detail-card.tsx`) sert de cadre de carte.
- **Actions du segment** — `.../proprietaires/actions.ts` (fichier unique pour liste, fiche, vente, rôle). Patron : `requireCurrentTenantDal` →
  `getTranslations('BureauMemberProfilesPage')` → `requireActionAuth()` → schéma Zod de formulaire → facade → `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')`
  **après** succès ; erreurs rendues en résultats (`toFailure`, `AuthorizationError` → `errors.forbidden`).
- **Service** — `src/services/member-profile-service.ts` : `requireMemberProfileManager(organizationId)` (`canPerformAction` avec
  `ActionIdConst.MEMBER_PROFILE_MANAGE`, sinon `AuthorizationError`), puis `withTenant(organizationId, …)`. Le DTO sort de
  `toMemberProfileDto` (`src/services/rules/member-profile-rules.ts`) qui **recopie champ par champ** : une colonne ajoutée à `member_profile`
  ne fuirait donc pas ; mais ce n'est pas ici qu'on mettrait les notes (voir Traps).
- **Côté membre (s12d, s22)** — `member-space-service.ts` et `incident-report-service.ts` résolvent la fiche par **session + domaine** via
  `getMemberProfileByUserIdDao`, sans aucun identifiant de fiche en entrée (`readForMyProfile`). Aucune de ces fonctions ne touche aux notes.

## Anchor points

- **Nouveau modèle** `src/db/models/…` (nom à fixer au plan) + migration `drizzle/migrations/0041_*` générée par `pnpm db:generate`, plus une
  migration RLS **custom** (`drizzle-kit generate --custom`) calquée sur `0036_member_role_event_rls.sql` / `0038_impersonation_event_rls.sql`.
  Dernière migration existante : `0040_great_grim_reaper.sql` (s22). Dernier ADR : `049`, donc le prochain est **050**.
- **Repository** `src/db/repositories/…` : `getDb()`, jamais `db` (modèle `incident-report-repository.ts`).
- **Service** + **facade** + **intercepteur de logs** (trois fichiers par domaine : `src/services/*-service.ts`,
  `src/services/facades/*-service-facade.ts`, `src/services/facades/interceptors/*-logger-interceptor.ts`) + validation
  `src/services/validation/*` + types de domaine `src/services/types/domain/*`.
- **Autorisation** : `src/services/types/domain/action-registry-types.ts` (`ActionIdConst` + `ACTION_REGISTRY`) et
  `src/services/authorization/*`. `canPerformAction` (`action-registry-authorization.ts`) est le point d'accroche unique.
- **DAL** `src/app/dal/…` sans `'use cache'` (données personnelles, streamées sous `<Suspense>`).
- **UI** : nouvelle carte sur `MemberProfileDetail`, nouvelles actions dans `proprietaires/actions.ts` (ou fichier voisin), libellés dans
  `messages/fr.json` sous `BureauMemberProfilesPage` (l. 2956).
- **Seed** `src/db/scripts/seed.ts` / `tenant-member-profiles-seed.ts` si des tests e2e lisent des notes d'amorce.

## Verified APIs / functions

Toutes ouvertes dans le code, pas déduites des docs.

| Élément                                                           | Signature / contenu                                                                                                                                                                         | Où                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `canPerformAction`                                                | `(user: User \| undefined, organizationId: string, actionId: string) => boolean` ; SuperAdmin passe, sinon rôle d'org dans les `defaultRoles` ; action absente du registre = refus          | `src/services/authorization/action-registry-authorization.ts`                                |
| `ActionIdConst.MEMBER_PROFILE_MANAGE`                             | `'member.profile.manage'`, `defaultRoles: ['owner','board']`                                                                                                                                | `action-registry-types.ts`                                                                   |
| `ActionIdConst.MEMBER_ROLE_ASSIGN`                                | précédent d'une entrée **à part** de `MEMBER_PROFILE_MANAGE` « parce que s37 la réglera seule »                                                                                             | idem                                                                                         |
| `effectiveAuthor`                                                 | `(viewer: {id; name}, impersonator?) => TraceAuthor` → `{authorUserId, authorName, onBehalfOfUserId, onBehalfOfName}`                                                                       | `src/services/types/domain/impersonation-types.ts`                                           |
| `getActingContext` / `getAuthUser`                                | lus **avant** `withTenant` (la session passe par le pool que le scope retient)                                                                                                              | `src/services/authentication/auth-service`, voir `authorOf` dans `member-profile-service.ts` |
| `withTenant(organizationId, cb)` / `getDb()`                      | scope de transaction + `set_config('app.organization_id', …, true)`                                                                                                                         | `src/db/tenant-scope.ts`                                                                     |
| `getMemberProfileByIdDao(id)`                                     | sous `withTenant`                                                                                                                                                                           | `src/db/repositories/member-profile-repository.ts`                                           |
| Patron trace auteur                                               | colonnes `author_user_id` (`SET NULL`), `author_name` (copie), `on_behalf_of_user_id`, `on_behalf_of_name`, `organization_id`, `created_at`                                                 | `incident-report-model.ts`, `member-role-event-model.ts`                                     |
| Patron RLS                                                        | `ENABLE` + `FORCE` + policy `tenant_isolation` `USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid OR current_setting('app.bypass_rls', true) = 'on')` | `0036_member_role_event_rls.sql`, `0038_…`                                                   |
| `calendarDayOf`                                                   | `(instant: Date) => string` (jour calendaire de Paris, ISO)                                                                                                                                 | `src/services/types/domain/water-analysis-types.ts` l. 155                                   |
| Colonne de jour                                                   | `date('sampled_on', {mode: 'string'})`                                                                                                                                                      | `src/db/models/water-analysis-model.ts` l. 39                                                |
| `isoToFrenchDate` / `frenchDateToIso` / `DateField`               | champ de date français du back-office                                                                                                                                                       | `src/components/ui/date-field(-format).tsx`                                                  |
| `MEMBER_PROFILES_ROUTE_PATTERN`                                   | `'/[locale]/(bureau)/bureau/proprietaires'`, à passer à `revalidatePath(…, 'layout')`                                                                                                       | `member-profile-paths.ts`                                                                    |
| `NotFoundError`, `AuthorizationError`, `ValidationParsedZodError` | erreurs de service                                                                                                                                                                          | `src/services/errors/*`                                                                      |

Non vérifié par exécution (je n'ai lancé ni test ni migration) : le comportement réel de `getAuthUser()` sous une session « à la place d'un
compte » (s48) pour un compte membre simple — le code de `effectiveAuthor` dit que « le compte vu » est celui que l'autorisation juge.

## Traps & constraints

1. **Fuite par DTO élargi — le risque que la story nomme.** `MemberProfileDTO` est lu par la fiche du bureau, et `toMemberProfileDto` est une
   liste blanche. Ne **pas** y ajouter les notes : un service et un DTO **séparés** (`MemberNote…DTO`), lus par leur propre fonction DAL, que
   seul l'écran du bureau appelle. Aucune route `src/app/api/*` ne touche aux fiches (vérifié : `grep` vide), donc pas d'API partagée aujourd'hui.
2. **Étanchéité côté membre = test.** Deux niveaux à prévoir : unitaire (service refuse un compte `member`, un anonyme, et un `board` d'une
   **autre** association — `__tests__/member-role-authorization.test.ts` est le modèle) et **e2e Playwright** pour la RLS, seul niveau où elle
   se prouve (`db.ts` refuse toute connexion en test, les repositories sont mockés ; ADR 002, `e2e/tenant-isolation.spec.ts` attaque la base en
   direct sous le **rôle applicatif**, jamais le propriétaire/superuser). Chaque story doit prouver l'isolation par accès croisé entre deux tenants
   (TechCorp `localhost`, Marketing Pro `127.0.0.1`).
3. **`ACTION_REGISTRY` est épinglé par des tests** (`src/services/__tests__/action-registry-authorization.test.ts` : `.some(... === ID)` et
   `.filter(... ) toEqual([...])`). Ajouter une action impose d'écrire le test d'entrée de registre sur ce modèle.
4. **Une fiche n'est jamais supprimée aujourd'hui.** Le choix de la clé étrangère `note → member_profile` (`CASCADE` / `RESTRICT` / `SET NULL`)
   tranche en réalité la suppression future d'un membre et l'effacement RGPD. ADR 049 a pris `RESTRICT` pour `incident_report.member_id` ;
   `member_role_event` a pris `SET NULL` avec nom copié. Les deux précédents divergent : à trancher au plan (voir Open questions).
5. **Auteur : copie du nom, jamais de jointure.** Un auteur dont le compte est supprimé ou renommé doit rester lisible (`author_user_id` `SET NULL`
   - `author_name`). Et **pendant une imitation (s48)** l'auteur est le SuperAdmin avec `on_behalf_of_*` : utiliser `effectiveAuthor`, lu **avant**
     `withTenant` (piège écrit dans `authorOf`). Ne pas écrire un auteur à la main.
6. **Modification/suppression (critère 5) : « l'auteur et la date de dernière modification restent visibles ».** Ce n'est pas la même chose que
   « qui a modifié en dernier ». Une colonne `updated_at` seule ne dit pas qui a modifié. Voir Open questions.
7. **Deux dates de nature différente.** La date d'une **note** est un instant de saisie (`created_at timestamptz`) ; la date d'un **échange** est
   un jour **choisi par le bureau, souvent passé** (« appelé M. X le 12 mars ») : un `date` en `mode: 'string'` + `calendarDayOf` pour « aujourd'hui »
   et pour refuser une date future, comme le rattachement de parcelle (e2e « date future »). Le fil « chronologique unique » mélange les deux : il
   faut décider quelle clé de tri s'applique à une note (création) et à un échange (jour choisi) et comment départager deux entrées d'un même jour
   (tri stable avec l'`id`, comme `INCIDENT_REPORT_ORDER`).
8. **Notes = modèle unique ou deux ?** Le critère 3 parle d'un fil unique et d'un « type » par entrée : une table avec `kind` (`note` | `exchange`)
   et `channel` nullable évite une union de deux requêtes, mais impose une contrainte `CHECK` (canal obligatoire ssi échange). C'est un choix de
   plan, pas de recherche ; je le consigne, je ne le tranche pas.
9. **Texte libre sur des personnes physiques, rédigé par des bénévoles** : borne de longueur côté Zod **et** côté service (le schéma de formulaire
   n'est pas la garde, cf. règle form-front-and-back), rendu en texte (pas de HTML/markdown interprété), jamais dans les logs. Les intercepteurs de
   service loggent les **arguments en mode debug** (`rule-logger.md`) : vérifier que le corps d'une note n'y passe pas en clair.
10. **Rien en dur (ADR 010).** Les canaux « téléphone, courrier, en personne, email » sont une liste fermée **de code** (comme `ReportStatus`,
    « texte fermé par le code ») ou un paramètre d'association ? Le CDCT ne le dit pas ; la liste est donnée par le critère lui-même, donc probablement
    du code — à confirmer au plan. Les libellés vont dans `messages/fr.json`, pas dans le code.
11. **Cache** : aucune donnée par utilisateur n'est cachée ; pas de `'use cache'`, `<Suspense>` + stream (déjà le cas de la page). La page lit déjà la
    session ; ne rien ajouter au niveau supérieur d'un layout. Ne pas appeler `logger` dans un scope `'use cache'` (sans objet ici).
12. **Architecture en couches** : la présentation n'importe rien de `src/db/*` ; un type d'UI vit dans `src/services/types/domain/`. Un service
    n'importe jamais sa facade.
13. **Migrations** : jamais de SQL écrit à la main dans `drizzle/migrations/` ni de modification du journal/snapshots ; `pnpm db:generate`, puis
    `--custom` pour la RLS. Un fichier qui touche `member_profile` n'est pas nécessaire (les notes référencent la fiche, ne la modifient pas).
14. **Export (s38) et copie membre (s40)** : ces stories **n'existent pas encore dans le code** (aucun export de données). s24 ne livre ni l'un
    ni l'autre ; elle doit seulement ne pas rendre l'ajout oublié possible. s39 (« complétude de l'export ») est la story qui garantit qu'aucune
    table n'échappe — la table de notes devra y être déclarée. À noter dans le plan de s38 (consigne explicite de la story), pas à implémenter ici.
15. **Règles qui parlent de `projects`** : `rule-react-query.md` et `rule-seed-usersroles-and-organization.md` citent un exemple retiré ; sans effet
    sur s24, mais ne pas s'en inspirer (AGENTS.md).
16. **e2e : jamais en local** (mémoire projet : « e2e sur GitHub, pas en local ») ; le plan doit prévoir que la preuve RLS tourne en CI. Tests
    unitaires : `pnpm test --run` (le mode watch ne rend pas la main).
17. **Concurrence entre agents** : l'arbre est partagé ; à l'exécution, stager chemin par chemin. `docs/designs/s22.zip` est un fichier non suivi
    étranger à s24 (ne pas le committer).

## Open questions

1. **Action d'autorisation : réutiliser `member.profile.manage` ou en déclarer une propre** (`member.note.manage`) ? Précédent s14 : entrée à
   part dès qu'un futur réglage par rôle (s37) pourrait diverger. Une note interne est plus sensible qu'une coordonnée — mais aucun critère de s24
   ne distingue les rôles. À trancher au plan ; le défaut sûr est `['owner','board']` dans les deux cas.
2. **Clé étrangère `member_profile` : `RESTRICT`, `CASCADE` ou `SET NULL` + nom copié ?** (Trap 4.) Lié à l'arbitrage RGPD sur la rétention, déjà
   noté « en attente » dans `docs/architecture.md` l. 92 (rétention des données d'un ex-propriétaire, s12 livre un modèle daté sans purge).
3. **Qui a modifié en dernier ?** Faut-il `updated_by_*` (utilisateur + nom copié, + `on_behalf_of`) en plus de `updated_at`, ou une table
   d'historique des versions ? Le critère 5 ne demande que « l'auteur et la date de dernière modification » : **auteur d'origine + `updated_at`**
   est la lecture littérale ; la lecture « auteur de la dernière modification » coûte des colonnes de plus. À confirmer.
4. **Suppression : physique ou logique ?** Critère 5 dit « supprimée » sans précision. Une suppression logique conserve un récit pour la
   continuité du bureau et pour s38 ; une physique est plus simple et plus conforme à l'effacement. Aucune trace de suppression n'est demandée.
5. **Un échange est-il modifiable/supprimable comme une note ?** Le critère 5 ne vise que « une note » ; le critère 3 range échanges et notes dans le
   même fil. Probable (même traitement), mais non écrit.
6. **Un membre du bureau voit-il les notes qui le concernent lui-même ?** Le critère 4 interdit l'accès au rôle `member`. Un compte `board`/`owner`
   qui a aussi une fiche passerait `member.profile.manage` pour sa propre fiche. Aucun critère ne dit de l'exclure ; à décider (probablement
   « oui, il voit », la Présidence et le Bureau étant le périmètre de la fonction) ou à écarter explicitement.
7. **Le SuperAdmin « à la place d'un membre simple »** ne doit pas lire les notes (il est jugé comme le compte vu). Hypothèse tirée de la lecture de
   `effectiveAuthor`/`ActingContext`, **non exécutée** : à couvrir par un test d'autorisation qui pose une session imitée.
8. **Mise en page du fil dans la fiche** : emplacement (nouvelle carte sous « Parcelles » ? onglet ?), pagination éventuelle d'un fil long, état
   vide, formulaire d'ajout en ligne ou en boîte de dialogue, distinction visuelle note / échange. `docs/designs/s12-membres-parcelles.md` ne prévoit
   aucune carte de notes. C'est le rôle de `/ks-design s24` (design system existant : `docs/design-system.md`). Tout besoin non couvert est un
   « design system gap » à rapporter, pas à inventer.
9. **Longueurs maximales** (note, résumé d'échange) et **nombre d'entrées affichées** : aucune valeur dans la story ni dans l'architecture ; à
   poser au plan comme constante de code nommée (ou paramètre si ADR 010 l'exige).
10. **Seed** : faut-il des notes d'amorce pour les e2e et la recette, ou chaque spec crée-t-elle les siennes ? Les specs existantes de fiches
    (`e2e/member-profiles.spec.ts`) créent leurs données ; à confirmer au plan.
