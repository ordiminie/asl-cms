# Research — Story s14-attribuer-roles

État du code lu sur `main` au commit `e7227836` (s12d mergée). Chaque nom de fichier, de fonction ou
de signature ci-dessous a été ouvert ; rien n'est cité de mémoire.

## Target story

**s14 — Désigner les membres du bureau** (complexité 2, dépendances s03b, s12, s12d).

En tant que membre du bureau, attribuer et retirer les rôles sur la fiche d'un membre, pour que le
bureau nouvellement élu administre le site sans le prestataire.

Critères d'acceptation :

1. Depuis la fiche d'un membre, un membre du bureau (Bureau ou Président(e)) lui attribue le rôle
   Bureau ou Président(e), ou le lui retire ; le changement prend effet à la connexion suivante du
   membre concerné.
2. Un membre promu Bureau accède au back-office ; le même membre, rôle retiré, y reçoit un refus —
   vérifié en interface **et** sur l'appel serveur direct.
3. Une association a toujours au moins un compte capable d'attribuer les rôles : retirer le dernier
   est refusé avec un message explicite.
4. Chaque attribution et chaque retrait est tracé avec son auteur, sa date, le membre visé et le rôle.
5. Un membre du bureau ne peut attribuer de rôle qu'aux membres de sa propre association.
6. Le rôle SuperAdmin n'est jamais attribuable depuis cet écran.

Notes de la story à retenir : le verrou du « dernier compte » est le pendant de celui de s37 sur la
matrice ; la trace entre dans l'export de s38 ; ne pas confondre avec s41 (simulation de rôle).
L'ADR 037 dit explicitement : « s14 change le rôle de la ligne `member`, jamais le lien »
(`member_profile.user_id`).

## Current state of the code

### Les rôles, tels qu'ils existent

- **Rôles d'association** = colonne `member.role`, énuméré Postgres `organizationRoleEnum`
  (`src/db/models/auth-model.ts:207-226`) : `member` | `board` | `owner`. Contrainte
  `unique(organization_id, user_id)` : une ligne par compte et par association.
- **Correspondance produit** : `member` = Membre, `board` = Bureau, `owner` = Président(e)
  (`src/lib/better-auth/organization-roles.ts` ; `UserOrganizationRoleConst` dans
  `src/services/types/domain/auth-types.ts:49-53`, où **`ADMIN` vaut `'board'`** — homonymie
  héritée).
- **Rôles globaux** = `user.role` : seulement `user` et `super_admin` depuis s47 (ADR 035 ;
  `RoleConst`, `auth-types.ts:56-58`). Le SuperAdmin n'est **pas** un rôle d'association : il
  n'existe pas dans `organizationRoleEnum`. Le critère 6 est donc d'abord tenu par le type — reste
  à ne jamais accepter de valeur hors `board | owner | member` côté serveur.
- `member` est une table du **plan identité, exemptée de RLS** (ADR 014, `docs/architecture.md`
  « Classement RLS ») : l'isolation entre associations y est **applicative**, pas Postgres.

### La fiche d'un membre (point d'entrée de l'écran)

- Route : `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx` → `MemberProfileSection`
  vérifie `canManageCurrentMemberProfilesDal()` puis lit `getMemberProfileForBureauDal(tenant.id,
  id)` ; une fiche d'une autre association donne `notFound()` (RLS sur `member_profile`).
- Composant : `src/components/features/member-profile/member-profile-detail.tsx`. La carte
  « Accès à l'espace membre » est `AccessState` (l. ~377-407) : **lecture seule**, affiche
  `account.loginEmail` et, si le compte a un rôle du bureau, le libellé
  `BureauMemberProfilesPage.detail.access.board|owner` (« Membre du bureau : son adresse peut être
  modifiée, pas supprimée. » / « Président(e) : … »). Son JSDoc dit « Aucune action : l'accès se
  pilote par l'adresse email » — c'est là que s14 ajoutera l'action de rôle.
- DTO : `MemberProfileAccountDTO` (`src/services/types/domain/member-profile-types.ts:52-54`) :
  `{status: 'open'; loginEmail; boardRole: 'board' | 'owner' | null} | {status: 'mail_only'}`.
  Le rôle du compte lié est **déjà lu** pour l'écran.
- Service : `src/services/member-profile-service.ts` — `readAccount()` lit
  `getMemberAccountDao(userId, organizationId)` sous `canReadMemberAccount` ; `boardRole` vaut
  `null` pour `member`.
- Actions serveur de la rubrique : `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`
  (patron : `getTranslations('BureauMemberProfilesPage')`, `requireActionAuth()`, façade
  `member-profile-service-facade`, `revalidateMemberProfileScreens()` →
  `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')`).

### Le compte d'une fiche (s12d, ADR 037)

`src/services/member-account-service.ts` (sans façade, appelé par d'autres services dans leur
`withTenant`) :

- `openMemberAccount` : trouve/crée le `user` par l'adresse, `createMemberIfAbsentTxnDao` (rôle
  `member` si aucune ligne ; **rôle existant jamais touché**), puis `setMemberProfileUserIdDao`.
- `closeMemberAccount` : `deleteMemberWithRoleDao(userId, orgId, 'member')` — ne retire **jamais**
  une ligne `board`/`owner` — puis vide `user_id`.
- `replaceMemberAccount` : l'adresse change ; pour un `board`/`owner`, **le rôle suit la nouvelle
  adresse** (`ensureMembership` promeut la nouvelle ligne si elle est `member`, puis
  `deleteMemberWithRoleDao(previousUserId, orgId, role)`).
- `getLinkedAccountRole(orgId, userId)` → rôle ou `null`.
- Règle pure `decideMemberAccount` (`src/services/rules/member-account-rules.ts`) : vider l'adresse
  d'un compte `board`/`owner` → `refuse_board_removal` (écran : `board_email_required`).

Conséquence directe pour s14 : **une fiche « courrier uniquement » n'a pas de compte, donc pas de
ligne `member`, donc aucun rôle attribuable**. Le rôle ne se pose que sur une fiche au statut
`open`.

### Le contrôle d'accès au back-office

- Layout `src/app/[locale]/(bureau)/layout.tsx` → `BureauShell` : `canManageCurrentAssociationIdentityDal()`
  → `canManageAssociationIdentityService` → `canManageAssociation(user, orgId)`
  (`src/services/authorization/association-authorization.ts`) : SuperAdmin, ou ligne `member` de
  **cette** association au rôle `owner` ou `board` (`BOARD_ROLES`). Sinon `MemberSpaceAccessDenied`
  (simple membre, écran C4 de s12d) ou `BureauAccessDenied`.
- Chaque service du bureau rejoue `canPerformAction(user, orgId, actionId)`
  (`src/services/authorization/action-registry-authorization.ts`) contre `ACTION_REGISTRY`
  (`src/services/types/domain/action-registry-types.ts`) : 12 actions, **toutes** à
  `defaultRoles: ['owner', 'board']`. C'est ce qui rend le refus « sur l'appel serveur direct » du
  critère 2 vrai sans rien ajouter : un compte rétrogradé à `member` est refusé par chaque service.
- Destination après connexion : `postLoginPathOf(user, orgId)` (même fichier) — `/bureau/pages`
  pour `owner`/`board`, `/dashboard` sinon.

### Fraîcheur du rôle dans la session (critère 1, « à la connexion suivante »)

- `getAuthUser()` (`src/services/authentication/auth-service.ts:24-33`) appelle
  `auth.api.getSession` puis rejoue `canOpenSessionOn(session.user, organisation du domaine)`
  (ADR 038).
- Le `customSession` de `src/lib/better-auth/auth.ts` (l. ~302) appelle
  `getUserByIdDao(session.userId)` **à chaque `getSession`** ; vérifié dans
  `node_modules/better-auth/dist/plugins/custom-session/index.mjs` (Better Auth 1.7.1) : l'endpoint
  `/get-session` remplacé appelle `fn(session.response, ctx)` à chaque appel, même quand la session
  de base vient du `cookieCache` (5 min). `getUserByIdDao` (`src/db/repositories/user-repository.ts:38`)
  recharge `members` → `user.organizations[].role`.
- **Donc un changement de rôle s'applique dès la requête serveur suivante**, pas seulement à la
  connexion suivante : le critère est tenu « au plus tard ». Exceptions d'affichage seulement :
  `getCurrentUserDal` (`src/app/dal/user-dal.ts:144`, `'use cache: private'`, `cacheLife('minutes')`)
  et le `useSession` client peuvent montrer quelques minutes un contexte périmé (ADR 038 l'assume :
  aucune décision d'accès ne doit en dépendre).

### Traçabilité (critère 4)

- **Aucune table d'audit ni de trace des rôles n'existe.** Modèles présents
  (`src/db/models/`) : aucune table `*_audit`, `*_history` ou de journal générique.
- Précédent le plus proche : `incident_report_event` (`src/db/models/incident-report-model.ts:70-96`)
  — porte son propre `organization_id`, `author_user_id` FK `user` en `ON DELETE SET NULL`,
  `author_name` **copié au moment du changement**, `created_at` `defaultNow()`, index ; policy
  `tenant_isolation` **forcée** posée par une migration `--custom`
  (`drizzle/migrations/0027_incident_report_rls.sql`).
- `parcel_ownership` (s12) et `member_profile` suivent le même patron RLS (`0030`).

### Le « dernier compte capable d'attribuer les rôles » (critère 3)

- Aucune règle de ce type n'existe aujourd'hui côté projet. Les seules gardes voisines :
  - `organization-service.ts:294-301` empêche un `OWNER` de se retirer lui-même (chemin hérité) ;
  - Better Auth refuse de laisser une association sans `owner` dans ses propres endpoints (voir
    Pièges) — mais ni l'un ni l'autre ne compte `board`.
- Aucun DAO ne compte les lignes `member` par rôle. `getOrganizationMembersDao(orgId)`
  (`organization-repository.ts:235`) rend toutes les lignes avec leur `user`.

### Comptes du bureau sans fiche

- Le provisionnement (`provisionOrganizationService`, `src/services/organization-service.ts:~702-718`)
  crée l'administrateur initial avec une ligne `member` `owner` **sans aucune fiche
  `member_profile`**.
- L'amorçage (`bootstrapPlatformService`, même fichier, `~830-846`) crée le **SuperAdmin avec une
  ligne `member` `owner`** dans la première association, sans fiche non plus.
- Seed : les comptes du bureau (`user-owner@gmail.com`, `user-admin@gmail.com`, `admin@gmail.com`…,
  `src/db/scripts/seed.ts:~290-310`) n'ont **aucune fiche** ; aucune fiche du seed
  (`src/db/scripts/tenant-member-profiles-seed.ts`) ne porte leur adresse.
- Une fiche créée plus tard avec l'adresse d'un compte du bureau s'y **rattache** sans toucher au
  rôle (`createMemberIfAbsentTxnDao` rend la ligne existante).

## Anchor points

- **Registre** : `ActionIdConst` + `ACTION_REGISTRY` dans
  `src/services/types/domain/action-registry-types.ts` — une nouvelle entrée pour « attribuer les
  rôles » (patron s44 : action distincte pour que s37 puisse la régler à part). L'action est aussi
  ce qui définira, demain sous s37, « un compte capable d'attribuer les rôles ».
- **Écran** : carte `AccessState` de `member-profile-detail.tsx`, sur la fiche
  `/bureau/proprietaires/[id]` ; le DTO porte déjà `boardRole`.
- **Server Action** : `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` (même rubrique,
  même revalidation).
- **Service** : à côté de `member-profile-service.ts` / `member-account-service.ts` ; façade +
  intercepteur de log sur le patron `member-profile-service-facade.ts`.
- **Repository** : `src/db/repositories/organization-repository.ts` (DAO `member`) ; trace dans un
  nouveau repository sous `withTenant`.
- **Modèle + migration** : nouvelle table de trace sous RLS forcée (`pnpm db:generate` puis
  `drizzle-kit generate --custom` pour la policy), à classer dans `docs/architecture.md` et
  `src/db/rls-inventory.test.ts`.
- **i18n** : `messages/fr.json`, namespace `BureauMemberProfilesPage.detail.access.*` (libellés
  `board` / `owner` déjà présents l. ~2963-2964).
- **e2e** : nouveau spec sous `e2e/`, sur le patron de `e2e/member-accounts.spec.ts` (deux tenants
  `localhost` / `127.0.0.1`, client `pg` direct, données suffixées par `RUN`, `mode: 'serial'`).

## Verified APIs / functions

| Fonction | Emplacement | Signature / comportement vérifié |
| --- | --- | --- |
| `canPerformAction` | `src/services/authorization/action-registry-authorization.ts` | `(user: User \| undefined, organizationId: string, actionId: string): boolean` — SuperAdmin toujours vrai ; sinon rôle de la ligne de **cette** org dans `defaultRoles` ; action inconnue refusée |
| `isActionAllowedForRole` | `action-registry-types.ts` | `(registry, actionId, role: OrganizationRole): boolean` |
| `canManageAssociation` | `src/services/authorization/association-authorization.ts` | `(user, organizationId): boolean` — `owner`/`board` de cette org ou SuperAdmin |
| `canReadMemberAccount` | `src/services/authorization/member-account-authorization.ts` | `(user, organizationId)` = `canPerformAction(..., MEMBER_PROFILE_MANAGE)` |
| `getAuthUser` | `src/services/authentication/auth-service.ts:24` | `cache(async () => User \| undefined)` — rejoue `canOpenSessionOn` |
| `requireActionAuth` | `src/app/dal/user-dal.ts` | utilisé en tête de chaque action de la rubrique |
| `getUserOrganizationDao` | `organization-repository.ts:185` | `(userId, organizationId): Promise<MemberModel \| undefined>` |
| `getUserRoleInOrganizationDao` | `organization-repository.ts:304` | `(userId, organizationId): Promise<OrganizationRoleEnumModel \| null>` |
| `updateUserOrganizationRoleDao` | `organization-repository.ts:199` | `(userId, organizationId, role): Promise<void>` — **inconditionnel** |
| `updateMemberRoleFromDao` | `organization-repository.ts:508` | `(userId, organizationId, from, to): Promise<void>` — ne change que si le rôle vaut encore `from` (condition dans la requête) ; ne rend pas le nombre de lignes touchées |
| `deleteMemberWithRoleDao` | `organization-repository.ts:491` | `(userId, organizationId, role)` — supprime seulement si le rôle correspond |
| `createMemberIfAbsentTxnDao` | `organization-repository.ts:467` | `(row: AddMemberModel): Promise<MemberModel>` — point de sauvegarde, absorbe `23505` |
| `getMemberAccountDao` | `organization-repository.ts:531` | `(userId, organizationId): Promise<{email; role} \| undefined>` |
| `getOrganizationMembersDao` | `organization-repository.ts:235` | `(organizationId): Promise<MemberData[]>` (avec `user`) |
| `getLinkedAccountRole` | `member-account-service.ts` | `(organizationId, userId: string \| null): Promise<MemberAccountRole \| null>` |
| `MemberAccountRole` / `MemberAccountRoleConst` | `src/services/types/domain/member-account-types.ts` | `'member' \| 'board' \| 'owner'` |
| `getMemberProfileService` | `member-profile-service.ts` | `(organizationId, memberProfileId): Promise<MemberProfileDTO \| undefined>` — sous `member.profile.manage` + `withTenant` |
| `withTenant` / `withRlsBypass` | `src/db/tenant-scope.ts` | `withTenant` ouvre (ou réutilise) une transaction et pose `app.organization_id` |
| Verrous existants | `parcel-ownership-repository.ts:104` (`.for('update')`), `association-category-repository.ts:93` (`pg_advisory_xact_lock(hashtextextended(key, 0))`) | précédents de sérialisation dans une transaction |
| `customSession` | `src/lib/better-auth/auth.ts:~302` | relit `getUserByIdDao` à chaque `getSession` (vérifié dans Better Auth 1.7.1) |
| `organization({... membershipLimit: 10, invitationLimit: 10, allowUserToCreateOrganization: false})` | `src/lib/better-auth/auth.ts:177-182` | plafond appliqué seulement par les endpoints du plugin (`crud-members.mjs:62-66`) |

## Traps & constraints

1. **Ne pas passer par `auth.api.updateMemberRole` / `authClient.organization.updateMemberRole`.**
   Better Auth 1.7.1 (`plugins/organization/routes/crud-members.mjs:236-310`) : un non-`owner`
   ne peut **ni modifier un `owner` ni attribuer `owner`** (`YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER`),
   ce qui contredit le critère 1 (« Bureau ou Président(e) » attribue « Bureau ou Président(e) ») ;
   il exige une ligne `member` de l'appelant (le SuperAdmin sans ligne reçoit `MEMBER_NOT_FOUND`) ;
   et il ne trace rien. Le précédent s12d écrit la ligne `member` par les DAO du projet, sous
   `withTenant`.
2. **Portes latérales existantes, qui contournent trace et verrou.** `disabledPaths` ne désactive
   que `/sign-in/magic-link` (`magic-link-integration.ts:204`). Les endpoints HTTP du plugin
   organisation restent donc ouverts à tout compte connecté qui en a la permission Better Auth :
   `/organization/update-member-role`, `/remove-member`, `/leave`, `/invite-member` +
   `/accept-invitation`. Le rôle `board` hérite de `adminAc` (permission `member: update`) : un
   membre du Bureau peut aujourd'hui changer le rôle d'un autre membre (hors `owner`) par un appel
   direct, **sans trace**. Côté écran, `/admin/organizations/[id]/edit` (SuperAdmin) utilise
   `edit-member-role-dialog.tsx` → `authClient.organization.updateMemberRole`, et
   `organization/action.ts` ajoute/retire des membres. Le critère 4 (« chaque attribution… est
   tracée ») n'est vrai que si ces chemins sont fermés ou tracés — voir questions ouvertes.
3. **Verrou du dernier compte : concurrence.** Deux membres du bureau qui se retirent mutuellement
   leur rôle au même instant lisent chacun « 2 comptes capables » et passent tous deux → zéro. Le
   décompte et l'écriture doivent tenir dans une même transaction sérialisée (précédents :
   `.for('update')` de `parcel-ownership-repository.ts`, `pg_advisory_xact_lock` de
   `association-category-repository.ts`). `updateMemberRoleFromDao` porte déjà la condition « rôle
   encore égal à `from` » dans la requête mais **ne rend pas** le nombre de lignes modifiées.
4. **Le verrou doit aussi couvrir s12d.** `replaceMemberAccount` déplace un rôle `board`/`owner`
   d'un compte à l'autre quand l'adresse change ; si le nouveau compte est déjà `owner`/`board`,
   l'ancienne ligne est supprimée et le nombre de comptes capables baisse (sans jamais atteindre
   zéro, puisque le nouveau garde son rôle). Ce déplacement **n'est pas tracé** aujourd'hui.
5. **Comptes du bureau sans fiche.** L'administrateur initial (provisionnement) et le SuperAdmin
   (amorçage, ligne `owner` dans la première association) n'ont pas de fiche ; les comptes du
   bureau du seed non plus. « Depuis la fiche d'un membre » ne les atteint pas tant qu'une fiche à
   leur adresse n'existe pas. Le décompte du « dernier compte » les voit pourtant (ligne `member`).
6. **SuperAdmin titulaire d'une ligne `owner`** (amorçage). S'il est compté comme « compte capable »,
   une association peut se retrouver administrée par le seul SuperAdmin après le retrait du dernier
   vrai bureau — exactement le scénario que la story veut éviter.
7. **Isolation (critère 5) : `member` est sans RLS.** La lecture de la fiche est sous RLS (fiche
   d'une autre association → `notFound`), mais toute écriture sur `member` doit porter
   `organization_id` dans la requête **et** le `user_id` doit venir de la fiche relue sous
   `withTenant`, jamais du navigateur. Un `memberProfileId` d'une autre association ne doit
   produire aucune écriture. Le test d'accès croisé est un **e2e** (la RLS n'est pas testable en
   unitaire, `db.ts` refuse toute connexion en test).
8. **Nouvelle table = obligations mécaniques.** Policy `tenant_isolation` forcée par migration
   `--custom` ; ajout au classement de `docs/architecture.md` (35 → 36 tables, « Scopée » 16 → 17)
   **et** à `src/db/rls-inventory.test.ts`, qui échoue sinon ; job CI « migrations sur la base de
   `main` » (ADR 035). Jamais de SQL de migration écrit à la main hors `--custom`.
9. **Auteur de la trace** : copier le nom au moment du changement (précédent `author_name`) et
   `author_user_id` en `SET NULL` ; la cible doit survivre elle aussi à une suppression de compte
   ou à un changement d'adresse (le rôle suit l'adresse, s12d) — l'identité du membre n'est jamais
   l'email (AGENTS.md).
10. **Auto-rétrogradation.** Un membre du bureau qui retire son propre rôle perd l'accès dès la
    requête suivante ; la Server Action qui revalide `/bureau/proprietaires/...` le renverra sur
    `MemberSpaceAccessDenied`. À prévoir dans le design.
11. **Plusieurs Président(e)s possibles techniquement** : rien dans l'énuméré ni dans le code
    n'impose un `owner` unique. `creatorRole` du plugin est `owner` (défaut).
12. **Tests unitaires existants à garder verts** : `src/services/__tests__/member-account-service.test.ts`,
    `src/services/__tests__/member-profile-service.test.ts` (mockent `updateMemberRoleFromDao`),
    `member-profile-detail.test.tsx`, `proprietaires/actions.test.ts`, `[id]/page.test.tsx`,
    `(bureau)/layout.test.tsx`. Les tests qui mockent `getAuthUser` ne voient pas la règle de
    l'ADR 038 : la prise d'effet se prouve en e2e (rechargement réel).
13. **e2e et seed partagé** : `fullyParallel: true` (1 worker en CI). Rétrograder un compte du seed
    (`user-owner@gmail.com`…) casserait les autres specs : créer des comptes propres au run
    (patron `RUN` de `member-accounts.spec.ts`). Les e2e tournent en CI, pas en local.
14. **Cache d'affichage** : `getCurrentUserDal` (`'use cache: private'`, `minutes`) peut montrer un
    rôle périmé quelques minutes dans la chrome ; ne rien décider d'après lui.
15. **Plafond `membershipLimit: 10`** : ne concerne que les endpoints du plugin. Changer un rôle ne
    crée pas de ligne ; il n'interfère que si le plan passait par `auth.api.*`.

## Open questions

1. **Qui compte comme « compte capable d'attribuer les rôles » ?** Hypothèse : toute ligne `member`
   `owner` ou `board` de l'association. Le SuperAdmin (ligne `owner` de l'amorçage) en fait-il
   partie ? Recommandation à confirmer : non, puisqu'il est interne à Zourite Studio.
2. **Un membre du Bureau peut-il retirer le rôle de la Président(e), ou attribuer Président(e) ?**
   Le critère 1 le dit (« Bureau ou Président(e) » attribue « Bureau ou Président(e) ») ; Better Auth
   l'interdit par défaut. Confirmer que le Bureau a bien ce pouvoir sur la présidence.
3. **Président(e) unique ou multiple ?** Attribuer Président(e) à quelqu'un retire-t-il le rôle à la
   présidente en place (passation), ou plusieurs `owner` coexistent-ils ?
4. **Que faire des portes latérales** (endpoints HTTP du plugin organisation, écran
   `/admin/organizations/[id]/edit` du SuperAdmin) qui changent un rôle sans trace ni verrou : les
   fermer dans s14 (`disabledPaths`), les router vers le même service tracé, ou les laisser hors
   périmètre ? Sans cela, le critère 4 n'est vrai que pour l'écran de s14.
5. **Le déplacement de rôle par changement d'adresse (s12d, `replaceMemberAccount`) doit-il être
   tracé** comme une attribution + un retrait ?
6. **Comment atteindre les comptes du bureau sans fiche** (administrateur initial, comptes créés au
   provisionnement) pour leur retirer le rôle ? Créer d'abord leur fiche, ou un écran qui liste les
   titulaires de rôle ? Et la liste des fiches doit-elle montrer un badge de rôle ?
7. **« Le membre visé » dans la trace** : identifié par la fiche (`member_profile_id`), par le compte
   (`user_id`), ou les deux, avec quel nom copié ? Une fiche supprimée ou une adresse changée ne doit
   pas effacer l'historique.
8. **La trace doit-elle être visible dans l'interface** (historique sur la fiche, écran dédié), ou
   seulement stockée pour l'export de s38 ? Le critère ne demande que « tracé ».
9. **Libellé exact de « prend effet à la connexion suivante »** : le code l'applique en réalité dès
   la requête suivante (customSession relu à chaque requête). Accepté tel quel, ou faut-il prévenir
   l'utilisateur sur l'écran (« effet immédiat ») ?
10. **Faut-il une ADR** pour le modèle de trace (table dédiée au rôle vs journal générique réutilisable
    par s37/s38) ? À trancher en design/plan.
