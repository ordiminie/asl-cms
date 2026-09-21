# Review — Story s03b-roles-registre-actions

> Revue en contexte neuf. Chaque constat est classé critique / majeur / mineur.
> Diff examiné : `git diff main...feature/s03b-roles-registre-actions` (27 fichiers, commit `218ba7c`).
> Références : `docs/plans/s03b-roles-registre-actions.md`, `docs/research/s03b-roles-registre-actions.md`,
> AGENTS.md, ADR 018, ADR 002, ADR 003, `templates/review-checklist.md`.

## Plan compliance

- [x] Le code fait ce que le plan spécifie, dans l'ensemble — avec deux écarts entre ce que les tâches
      3 et 8 annoncent comme prouvé et ce que le diff prouve réellement (voir Findings).
- Les 9 tâches du plan sont présentes dans le diff. Les tâches 1 (migration), 2 (renommage des
  constantes et des littéraux), 4 (seed), 5 (registre), 6 (`canPerformAction`), 7 (migration des
  services), 9 (`docs/architecture.md`) sont fidèlement et correctement implémentées, conformes à la
  liste de fichiers du plan.
- Aucun hors-périmètre : aucun fichier étranger à la story touché, aucun comportement ajouté au-delà
  du plan (`docs/reviews/s12a-retrait-supabase.md` et `docs/research/s04-pages-cms.md`, visibles dans
  `git status`, ne font **pas** partie du diff de cette story — confirmé par `git diff
main...feature/s03b-roles-registre-actions` : changements locaux préexistants, sans rapport avec s03b).

## Anti-hallucination

- [x] Aucune API/fonction/import inventé. Vérifié contre les sources `.d.mts` de `better-auth` dans
      `node_modules` : `createAccessControl` (`better-auth/plugins/access`),
      `adminAc`/`ownerAc`/`memberAc`/`defaultStatements` (`better-auth/plugins/organization/access`)
      existent avec les signatures utilisées. `OrganizationOptions.ac?`/`.roles?` côté serveur,
      `OrganizationClientOptions.ac`/`.roles` côté client, `Role.authorize(...)` retournant
      `{success: boolean}` — tout correspond à l'usage dans `auth.ts`, `auth-client.ts` et
      `organization-roles.test.ts`. `OrganizationRoleEnumModel`, `getUserOrganizationsService`,
      `canManageSubscription`, `canManageAssociation`, `ActionIdConst`, `isActionAllowedForRole`,
      `canPerformAction` : ouverts et vérifiés avec leurs signatures exactes.
- [x] Aucune valeur ou logique plausible-mais-fausse dans les hunks revus. Le bypass SuperAdmin de
      `canPerformAction` (et non l'`admin` global) reproduit le patron existant de
      `canManageAssociation` ; le défaut fermé du registre est correctement implémenté et testé pour
      le cas « action inconnue ».
- [x] Le code correspond à ce qu'il prétend faire : vérifié en direct contre la base de test migrée
      (`asl_cms_test`) — `enum_range(NULL::organization_role)` retourne `{board,member,owner}`, et les
      lignes `member` portent de vraies valeurs `board`/`owner`/`member`, confirmant que la migration a
      réellement été appliquée et que le seed reflète réellement le renommage (pas seulement annoncé).

## Rules compliance

- [x] AGENTS.md : architecture en couches respectée (fonctions pures dans `services/authorization/` et
      `services/types/domain/`, aucun accès DB direct ajouté). Migration écrite à la main conformément
      à la section « Database Migration Safety » (SQL manuscrit, `RENAME VALUE`, journal et snapshots
      restés cohérents — `pnpm db:generate` rapporte « No schema changes, nothing to migrate » après le
      diff, et les snapshots 0008/0009/0010 réécrits sont identiques en contenu à `main`, juste
      reformatés par drizzle-kit).
- [x] Aucun ADR accepté contredit. ADR 018 (registre en code) suivi exactement : module isomorphe, pas
      de table, pas d'écran, `docs/architecture.md` corrigé pour dire explicitement « ⚠️ pas une
      table » (tâche 9 faite, formulation non ambiguë). ADR 002/003 (multi-tenant/RLS) : aucun
      repository touché, aucun appel `db`/`getDb()` ajouté, aucune nouvelle occurrence de
      `withRlsBypass()` — le seul artefact touchant la base est la migration manuscrite de
      renommage d'énuméré, qui ne touche aucune policy RLS.
- N/A Design system — la story n'a pas d'écran (aucun `docs/designs/s03b-*`), correctement ignoré par
  le plan.

## Tests

- [x] `pnpm test --run` exécuté par le relecteur lui-même : **847 passed | 8 skipped (80 fichiers)**,
      0 échec.
- [x] `pnpm check:rules` propre, `pnpm lint` propre (les 2 avertissements rapportés sont dans des
      fichiers de scratch non suivis `.remember`/`.scratch`, sans rapport avec ce diff), `tsc --noEmit`
      propre (0 erreur).
- [x] `pnpm db:generate` confirme que la migration et `organizationRoleEnum` restent cohérents (aucune
      dérive).
- Les assertions épinglent réellement les critères d'acceptation de la logique d'autorisation centrale :
  `action-registry-types.test.ts` et `action-registry-authorization.test.ts` exercent réellement le
  défaut fermé, le bypass SuperAdmin, le refus inter-organisation, et le rôle présent/absent — ce ne
  sont pas des tests sans assertion ni tautologiques.
- Deux écarts réels trouvés entre ce que des tâches précises du plan décrivent comme livré/prouvé et ce
  que le diff contient réellement (voir Findings).

## Regressions

- [x] Aucune régression trouvée sur les chemins de code existants. `association-authorization.test.ts`,
      les tests CASL, `association-identity-service.test.ts` — tous préexistants, tous utilisent
      `UserOrganizationRoleConst`/`OrganizationRoleConst` (jamais un littéral `'admin'` de rôle
      d'association), donc passent sans modification après le renommage, comme promis par le plan.
      `association-settings-service.test.ts` a nécessité deux corrections littéral `'admin'` →
      `UserOrganizationRoleConst.ADMIN` (10 lignes) — nécessaires car le littéral aurait cessé de
      correspondre en silence à la valeur d'énuméré renommée ; les assertions (résultats attendus) sont
      inchangées, seul le littéral d'entrée a été corrigé pour rester significatif. Recherche exhaustive
      dans `src/` de littéraux `'admin'` de rôle d'organisation hors des deux exceptions documentées de
      rôle global (`admin@gmail.com`, `admin-owner@gmail.com`) : aucun trouvé ; chaque consommateur
      (abilities CASL, `edit-member-role-dialog.tsx`, `organization-helper.ts`,
      `organization-authorization.ts`) utilise les constantes et a donc reçu `'board'` automatiquement.

## Findings

- **major** — `src/lib/better-auth/organization-roles.test.ts` — La tâche 3 du plan exigeait
  explicitement « un test d'intégration ou unitaire sur la création d'une organisation... le créateur
  reçoit owner ; ajout d'un membre avec le rôle board accepté par le plugin », précisément pour couvrir
  le risque qu'elle nomme elle-même (« vérifier que `creatorRole` reste inchangé avec des rôles
  personnalisés déclarés »). Le test livré n'appelle jamais le vrai plugin `organization()` de Better
  Auth (aucun appel à `auth.api.createOrganization`/`addMember`) ; il appelle seulement `.authorize()`
  directement sur les objets `adminAc`/`ownerAc`/`memberAc` assemblés dans `organization-roles.ts`.
  `organization-provisioning-service.test.ts` (cité comme patron) n'est pas modifié et n'exerce pas non
  plus le plugin — il insère via les repositories directement, en contournant Better Auth. Aucun test
  e2e ne crée d'organisation ni n'ajoute de membre via l'API réelle du plugin. La case de la tâche 3 est
  cochée `[x]` malgré cette preuve précise non livrée. Comme il s'agit d'un vrai changement de
  configuration sur la plomberie multi-tenant des rôles d'organisation (`auth.ts`/`auth-client.ts`),
  c'est un vrai manque de couverture de test, cadré, sur un risque documenté — pas la preuve d'un défaut
  réel (les types sont corrects, et le typage de Better Auth donne un `creatorRole` par défaut
  indépendant de `roles`), mais la vérification promise manque.

- **major** — `e2e/association-settings.spec.ts` (non modifié, donc cet écart précède et survit à la
  story) — Le critère 4 exige « un Bureau y est autorisé... en interface comme sur l'appel serveur
  direct » pour l'action de modification des réglages. Chaque appel `saveSettings(...)` de la spec est
  effectué par `user-owner@gmail.com` (Présidente/owner) ; le compte Bureau (`user-admin@gmail.com`)
  n'apparaît qu'une fois, au « critère 6 », qui ne fait que **lire** la page des réglages (accès de
  niveau page, déjà accordé avant cette story par `canManageAssociation`) — il ne soumet jamais de
  modification. Le grain fin de l'entrée de registre `ASSOCIATION_SETTINGS_UPDATE` pour `board` n'est
  donc prouvé qu'au niveau unitaire avec service mocké (`association-settings-service.test.ts`,
  `[ORGANIZATION ADMIN] le bureau ... enregistre`), pas « en interface »/« sur l'appel serveur direct »
  comme le critère l'exige littéralement. À l'inverse, `e2e/association-identity.spec.ts` fait
  réellement écrire le compte Bureau (téléversement logo+favicon, « critères 5 et 6 »), donc cette
  asymétrie est spécifique à l'action réglages. Le récit de la tâche 8 du plan concède discrètement ce
  point (« user-admin@gmail.com... lit ses réglages ») sans le signaler comme un manque face au texte
  littéral du critère.

- **minor** — Le tableau « Files touched » du plan liste `e2e/association-settings.spec.ts` comme
  touché ; le diff réel ne touche aucun fichier e2e (le corps de la tâche 8 explique et justifie déjà
  ce choix — réutiliser les specs existantes sans les modifier — donc c'est une ligne obsolète du
  tableau récapitulatif, pas une vraie dérive).

## Verdict

Rationale : le renommage, le registre et la logique d'autorisation centrale sont corrects,
exhaustivement testés en unitaire, vérifiés en direct contre une vraie base de test migrée/seedée, et
passent lint/typecheck/`check:rules`/suite unitaire complète (847/847) sans régression. Les deux
constats « major » sont des manques de couverture de test/de processus par rapport à des promesses
précises du plan (test d'intégration du plugin Better Auth pour la tâche 3 ; preuve e2e « le Bureau
écrit les réglages » pour le critère 4), pas la preuve d'un comportement cassé — à corriger dans un
prochain cycle plutôt qu'à bloquer le ship.

Max severity: major
Ship allowed: yes
