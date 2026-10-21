# Research — Story s12d-comptes-membres

> Recherche menée le 2 octobre 2026 sur `main` à `be960b9` (s12 mergée le jour même). Tout ce qui est
> cité avec un chemin et une ligne a été ouvert ; ce qui ne l'a pas été est marqué **non vérifié**.
> Aucun test n'a été lancé, aucune base touchée. Versions lues : Next 16.3.0, Better Auth 1.7.1.

## Target story

**Ouvrir et fermer le compte d'un membre** — une fiche dotée d'une adresse email a un compte
connectable, qui se referme quand l'adresse est retirée ; chaque propriétaire joignable par email
accède à son espace, et à lui seul. Complexité 3. Dépendances : s03, s03c, s12 (toutes livrées).
Scindée de s12 le 30 septembre 2026 : elle porte ses ex-critères 9 et 10.

Critères d'acceptation (`docs/stories.md:1414-1418`) :

1. Renseigner une adresse email sur une fiche « courrier uniquement » lui ouvre un compte
   connectable sur cette association ; la retirer referme l'accès sans supprimer la fiche ni son
   historique.
2. Une fiche créée avec une adresse email a un compte connectable dès sa création, **y compris les
   fiches qui avaient déjà une adresse avant cette story**.
3. Une adresse déjà connue du produit (même personne dans une autre association) réutilise son
   compte au lieu d'en créer un second ; fermer l'accès ici ne touche pas à son accès ailleurs.
4. Un membre ne voit que ses propres parcelles, **actuelles et passées**, dans son espace ; l'accès à
   la fiche d'un autre membre est refusé.
5. Retirer l'adresse d'une fiche dont le compte a une session ouverte coupe l'accès **à la requête
   suivante**, sans attendre l'expiration de la session.

Notes agentiques structurantes (réf. `V5 §5.1`) :

- La capacité « ouvrir / fermer un compte de membre » **se crée ici, une seule fois**, en service
  réutilisable : s13 (import), s15 (invitation) et s42 (lancement) l'appellent, aucune ne la
  réimplémente.
- `user.email` est unique sur toute la plateforme : ouvrir réutilise le `user` existant (précédent
  `provisionOrganizationService`). Fermer retire la ligne `member` de **cette** association, jamais
  le `user`, et **jamais une ligne dont le rôle n'est pas `member`**.
- Ouvrir un compte **n'envoie rien** (invitation = s15, lancement = s42).
- **Aucune coupure automatique** liée à la cotisation, aucune purge (arbitrage RGPD en attente).
- Design : `docs/designs/s12-membres-parcelles.md`, écran 6 et états `2f`, `3f`, `3g`, `3h`.

Ce que les stories suivantes attendent de s12d (lu dans `docs/stories.md`, survolé) :

| Story                        | Ce qu'elle suppose                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| s13 (import)                 | un service d'ouverture appelable par le SuperAdmin, en lot, idempotent (« relancer le même import ne duplique rien ») ; 300 comptes pour 400 fiches   |
| s14 (rôles)                  | une fiche avec email a une ligne `member` dont on change le rôle ; fermer ne doit pas retirer un `board` / `owner`                                    |
| s15 (invitation)             | le compte existe déjà ; elle ne fait qu'envoyer le lien. Elle affichera « connecté au moins une fois » (hors s12d)                                    |
| s16, s19, s22, s23, s32, s40 | « la fiche du membre connecté » se résout depuis la session et le domaine appelé ; « une requête visant l'identifiant d'un autre membre est refusée » |
| s31, s35                     | un espace membre où accrocher des entrées, sans lien mort                                                                                             |
| s42                          | aucun compte à créer au lancement : ils le sont tous depuis s12d / s13                                                                                |

## Current state of the code

### Ce que s12 a livré (vérifié dans le code, pas dans le plan)

| Élément                      | État                                                                                                                                                                                                                                                                  | Emplacement                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `member_profile`             | `id` uuid, `organization_id` (cascade), `name`, `email` nullable, téléphone, adresse en quatre colonnes, `mail_only` **générée** (`"email" IS NULL`), index unique partiel `(organization_id, lower(email)) WHERE email IS NOT NULL`. **Aucune colonne vers `user`.** | `src/db/models/member-profile-model.ts:31-63`, migration `0029_famous_serpent_society.sql` |
| `parcel`, `parcel_ownership` | période demi-ouverte `[starts_on, ends_on)`, FK en `RESTRICT`, `CHECK (ends_on > starts_on)`                                                                                                                                                                          | `src/db/models/parcel-model.ts`, même migration                                            |
| RLS                          | forcée sur les trois tables, policy `tenant_isolation`                                                                                                                                                                                                                | `drizzle/migrations/0030_member_profile_parcel_rls.sql`                                    |
| Service des fiches           | `createMemberProfileService`, `updateMemberProfileContactService`, `getMemberProfileService`, `getMemberProfilePageService`, `canManageMemberProfilesService` — toutes derrière `member.profile.manage`. En-tête : « s12 n'ouvre ni ne ferme aucun compte »           | `src/services/member-profile-service.ts:36-42`                                             |
| Service des parcelles        | `attachParcelService`, `recordSaleService`, `getParcelOwnerAtService`, `getMemberParcelsService`, `getSaleContextService` — **toutes** derrière `member.profile.manage`                                                                                               | `src/services/parcel-ownership-service.ts`                                                 |
| Écrans du bureau             | liste, ajout, fiche, vente sous `/bureau/proprietaires` (**pas** `/bureau/membres` comme l'écrit le design : le libellé retenu est « Propriétaires »)                                                                                                                 | `src/app/[locale]/(bureau)/bureau/proprietaires/`                                          |
| Fiche                        | cartes « Coordonnées » et « Parcelles ». **La carte « Accès à l'espace membre » n'existe pas** (commentaire : « s12 n'ouvre aucun compte (s12d) »)                                                                                                                    | `src/components/features/member-profile/member-profile-detail.tsx:105-110`                 |
| Libellés                     | espace de noms `BureauMemberProfilesPage`, **dans `messages/fr.json` seulement** (absent de `en.json` et `es.json`). L'aide du champ email a été réécrite sans mention du compte : « Sans adresse, ce propriétaire reçoit tout par courrier. »                        | `messages/fr.json`                                                                         |
| Seed                         | 7 fiches fictives sur deux tenants ; **trois ont un email** (deux chez TechCorp, une chez Marketing Pro) et **aucune n'a de `user`**                                                                                                                                  | `src/db/scripts/tenant-member-profiles-seed.ts:57-119`, `seed.ts:592-660`                  |

L'email d'une fiche est validé mais **pas mis en minuscules** : `optionalContact(z.string().email())`
(`src/services/validation/member-profile-validation.ts:24-37`). Il est stocké tel que saisi ; seule
l'unicité est insensible à la casse.

### L'identité aujourd'hui (s01, s03, s03b, s03c)

- **`user`** (`src/db/models/auth-model.ts:27-45`) : `email text NOT NULL UNIQUE` — unique sur la
  plateforme, **sensible à la casse** ; `name NOT NULL` ; `email_verified` faux par défaut.
- **`member`** (`auth-model.ts:213-230`) : pivot `(organization_id, user_id, role)`, unique sur le
  couple, `role` énuméré `board | member | owner` (défaut `member`), `created_at NOT NULL` **sans
  défaut**. Exemptée de RLS (ADR 014).
- **`session`** (`auth-model.ts:48-63`) : rattachée à `user_id` seul. **Aucune colonne
  d'association** (hors `active_organization_id`, héritée) : une session n'appartient pas à un tenant,
  c'est le cookie, propre à l'hôte, qui la borne à un domaine (ADR 022).
- **Ce qui rend un compte « connectable » sur une association** : un `user` dont l'email en
  minuscules est celui demandé, **et** une ligne `member` pour l'association du domaine appelé.
  `sendMagicLink` s'arrête sinon, sans rien envoyer
  (`src/lib/better-auth/magic-link-integration.ts:189-190`, `isMemberOf` l. 223-229).
- **s03 n'a livré aucune ouverture de compte** : `magicLinkOptions.disableSignUp = true`
  (`magic-link-integration.ts:203-208`), et `/sign-in/magic-link` en HTTP est fermé. Un lien ne
  crée jamais de `user`.
- **Les seuls chemins de création existants** :
  - `provisionOrganizationService` (`src/services/organization-service.ts:669-735`) — le modèle
    canonique : `getUserByEmailDao(adminEmail)`, sinon `createUserDao({email, name: email})`, puis
    `createOrganizationMemberDao({userId, organizationId, role, createdAt: new Date()})`. Son schéma
    met l'email en minuscules (`organization-validation.ts:110`).
  - `createOrganizationMemberService` (`organization-service.ts:239-267`) et
    `removeUserFromOrganizationService` (`:269-306`) — fonctions **anciennes** : autorisation CASL
    (`canInviteToOrganization`, qui applique en plus les **plafonds de membres du plan Stripe**,
    `organization-authorization.ts:224-246`), ordre validation / autorisation du boilerplate. À ne
    pas réutiliser.
  - L'inscription Better Auth, dont le hook `user.create.after` appelle
    `initializeRegisterUserDataService` (`src/lib/better-auth/auth.ts:310-320`) : réglages
    utilisateur, email de suivi, et **création d'une organisation personnelle** si l'utilisateur n'en
    a aucune (`src/services/user-service.ts:189-254`). `createUserDao` écrit en base directement et
    **ne déclenche pas** ce hook.

### L'espace membre aujourd'hui

- `(app)/dashboard/page.tsx` rend `DashboardPage` sous `withAuth` : c'est **le tableau de bord du
  boilerplate**, composant client aux données factices en dur (revenus, ventes, transactions —
  `src/components/features/dashboard/dashboard.tsx`). C'est là qu'arrive un membre : la demande de
  lien pose `callbackURL: '/dashboard'` (`src/app/[locale]/(auth)/action.ts:235`).
- `(app)/layout.tsx` monte la coquille du boilerplate : `AppSidebar` avec `TeamSwitcher`, « Compte »,
  « Projets », « Facturation », « Modèles », « Documentation »
  (`src/components/features/layouts/sidebar/app-sidebar.tsx`). **Aucun en-tête d'association** :
  `AssociationMark` n'est monté que par les layouts `(public)`, `(auth)` et `(bureau)`. La planche
  `0b` du design écrit pourtant « En-tête existant, non redessiné ».
- **Rien ne vérifie l'appartenance au tenant** dans `(app)` : `withAuth` contrôle le rôle global
  (`src/components/features/auth/with-auth.tsx`), le proxy contrôle la présence du cookie
  (`src/proxy.ts:53`). Un compte sans ligne `member` sur ce domaine, mais porteur d'une session,
  atteint `/dashboard`. La seule fonction « ce compte appartient-il à cette association » est
  `isMemberOf`, privée au module du lien magique.
- Le marqueur §3.4 (`Lock` + « Espace personnel ») n'existe nulle part dans `src/` (recherche du
  libellé : zéro occurrence).

### Ce que le design de s12 a déjà dessiné pour s12d

`docs/designs/s12-membres-parcelles.md` et la maquette `.html` (textes extraits et relus) :

| État       | Contenu                                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2f`       | après création avec email : « Fiche créée. » puis « Compte ouvert : … peut se connecter avec … »                                                                                                                                                                                                                                    |
| `3e`       | aide du champ email : « Avec une adresse, le membre peut se connecter à son espace. Sans adresse, il reçoit tout par courrier. »                                                                                                                                                                                                    |
| `3f`       | email vidé, **avant** enregistrement : avertissement `warning` sous le champ (« … ne pourra plus se connecter à son espace. Sa fiche, ses parcelles et son historique sont conservés. Il recevra les envois par courrier. »). Pas d'`alert-dialog` : l'acte est réversible                                                          |
| `3g`       | après retrait : « Coordonnées enregistrées. » + « Accès à l'espace fermé. » ; carte **« Accès à l'espace membre »** : « Joignable par courrier uniquement. Aucun compte : ajoutez une adresse email pour lui ouvrir son espace. »                                                                                                   |
| `3h`       | email ajouté : « Compte ouvert : … peut désormais se connecter avec … » ; carte : « Compte ouvert. … peut se connecter à son espace avec … »                                                                                                                                                                                        |
| `6a`, `6d` | `/dashboard`, `max-w-[1000px]`, une colonne : marqueur `Lock` + « Espace personnel » + « Parcelles 12 et 13 », `h1` « Bonjour … », carte « Mes parcelles » (une ligne de 56 px par parcelle, « Propriétaire depuis le 3 février 1998 », date en clair, pas de tableau), « Une erreur ? Écrivez au bureau. » + lien « Page Contact » |
| `6b`       | ancien propriétaire, accès non coupé : « Aucune parcelle actuelle », et une phrase (« Vous n'êtes plus propriétaire d'une parcelle du domaine depuis le … »). **Aucune liste de parcelles passées**                                                                                                                                 |
| `6c`, `6e` | accès refusé : « Cette page ne vous est pas accessible », « Elle concerne un autre membre de l'association. », bouton « Revenir à mon espace » — ni nom, ni parcelle, ni code, ni marqueur personnel                                                                                                                                |

Le vocabulaire de la maquette (« membre », `/bureau/membres`) a été remplacé à l'exécution par
« propriétaire » : les phrases ci-dessus sont à réaccorder. Le document de design liste comme **non
dessinés** : l'ouverture à partir d'une adresse déjà connue, le changement d'email d'un membre qui a
un compte, le rattachement des fiches du bureau et de la présidence.

## Anchor points

- **Service d'ouverture / fermeture** : nouveau, dans `src/services/` (+ façade et intercepteur de
  journalisation, patron `member-profile-service-facade.ts`). Il s'appuie sur des DAO existants
  (`getUserByEmailDao`, `createUserDao`, `createOrganizationMemberDao`, `getUserOrganizationDao`,
  `deleteUserOrganizationDao`). Tous passent par `getDb()` : appelés dans `withTenant`, ils écrivent
  dans **la même transaction** que la fiche (`user` et `member` ne sont pas sous policy).
- **Points d'appel** : `createMemberProfileService` et `updateMemberProfileContactService`
  (`src/services/member-profile-service.ts:86` et `:107`) — un service peut appeler un autre service,
  jamais une façade (`rule-architecture`). s13 appellera le même service en lot.
- **Lien fiche ↔ compte** : aujourd'hui inexistant. S'il devient une colonne de `member_profile`,
  c'est `src/db/models/member-profile-model.ts` + `pnpm db:generate` (prochaine migration `0031`) ;
  le classement RLS de `docs/architecture.md` ne bouge pas (aucune table nouvelle), sa ligne
  `member_profile` si.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts`
  (`ActionIdConst`, `ACTION_REGISTRY`) si l'ouverture / fermeture devient une action distincte de
  `member.profile.manage` ; test `src/services/authorization/__tests__/action-registry-authorization.test.ts`.
- **Fiche côté bureau** : `member-profile-detail.tsx` (carte « Accès à l'espace membre », alertes
  `3g` / `3h`, avertissement `3f` dans `ContactForm`), `member-contact-fields.tsx` (aide du champ
  email), `member-profile-form.tsx` et la page `[id]/page.tsx` (`2f`, via `?cree=1`),
  `proprietaires/actions.ts` (`toActionResult`), `MemberProfileDTO` / `MemberProfileWriteResult`
  (`src/services/types/domain/member-profile-types.ts`) pour porter l'état du compte.
- **Espace membre** : `src/app/[locale]/(app)/dashboard/page.tsx` (section « Mes parcelles ») ; un
  DAL sans `'use cache'` (patron `src/app/dal/member-profile-dal.ts`) ; un service de lecture
  **côté membre**, distinct de `getMemberParcelsService`.
- **Garde d'appartenance au tenant** pour `(app)` : à créer (aucune n'existe), à partir de
  `getAuthUser()` et `requireCurrentTenantDal()`.
- **Seed** : `src/db/scripts/seed.ts` (bloc 15) et `tenant-member-profiles-seed.ts` — les trois
  fiches à email doivent avoir un compte après s12d (critère 2).
- **Libellés** : `messages/fr.json`, espace `BureauMemberProfilesPage`, et un espace pour l'espace
  membre.
- **e2e** : `e2e/member-profiles.spec.ts` (à modifier, voir pièges) et une preuve d'accès croisé
  entre deux tenants pour « Mes parcelles ».

## Verified APIs / functions

| Nom                                                             | Signature / comportement                                                                                                                                                                             | Emplacement                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `getUserByEmailDao`                                             | `(email: string) => Promise<User \| undefined>` ; compare à `email.toLowerCase()` ; rend le `user` **avec** `organizations` (ses lignes `member` + organisation)                                     | `src/db/repositories/user-repository.ts:74-101`                                                                               |
| `createUserDao`                                                 | `(user: AddUserModel)` ; n'écrit **que** `email` et `name`, **sans** mise en minuscules                                                                                                              | `user-repository.ts:31-37`                                                                                                    |
| `getUserByIdDao`                                                | `(uid) => Promise<User \| undefined>`, avec `organizations`, `settings`, `notifications`                                                                                                             | `user-repository.ts:39-67`                                                                                                    |
| `createOrganizationMemberDao`                                   | `(userOrganization: AddMemberModel) => Promise<MemberModel>` ; `createdAt` à fournir                                                                                                                 | `src/db/repositories/organization-repository.ts:178-183`                                                                      |
| `getUserOrganizationDao`                                        | `(userId, organizationId) => Promise<MemberModel \| undefined>`                                                                                                                                      | `organization-repository.ts:185-197`                                                                                          |
| `deleteUserOrganizationDao`                                     | `(userId, organizationId) => Promise<void>` ; **aucune condition sur le rôle**                                                                                                                       | `organization-repository.ts:212-221`                                                                                          |
| `UserOrganizationRoleConst`                                     | `OWNER: 'owner'`, `ADMIN: 'board'`, `MEMBER: 'member'`                                                                                                                                               | `src/services/types/domain/auth-types.ts:43-47`                                                                               |
| `provisionOrganizationService`                                  | précédent « réutiliser le `user` par email, sinon le créer, puis poser `member` »                                                                                                                    | `src/services/organization-service.ts:669-735`                                                                                |
| `withTenant` / `getDb`                                          | `withTenant<T>(organizationId, callback)` ; `getDb()` rend la transaction du scope ; un scope imbriqué réutilise la transaction                                                                      | `src/db/tenant-scope.ts:128`, `:122`, `:96-116`                                                                               |
| `getAuthUser`                                                   | `cache(async () => User \| undefined)` ; lit `auth.api.getSession` ; `user.organizations[]` porte `organizationId` et `role`                                                                         | `src/services/authentication/auth-service.ts:15-20`                                                                           |
| `customSession` (Better Auth)                                   | remplace `GET /get-session` et **rappelle sa fonction à chaque appel**, après la session de base : ici `getUserByIdDao(session.userId)`, donc les appartenances sont relues en base à chaque requête | `src/lib/better-auth/auth.ts:282-289`, `node_modules/better-auth/dist/plugins/custom-session/index.mjs`                       |
| `session.cookieCache`                                           | activé, 5 min : la session de base est servie depuis le cookie signé, **sans lecture en base**                                                                                                       | `auth.ts:68-73`, `node_modules/better-auth/dist/api/routes/session.mjs:48-90`                                                 |
| `findUserByEmail` (Better Auth)                                 | cherche `email.toLowerCase()` en égalité stricte                                                                                                                                                     | `node_modules/better-auth/dist/db/internal-adapter.mjs:566-572`                                                               |
| `/magic-link/verify`                                            | consomme le jeton, trouve le `user` par email, **ne vérifie aucune appartenance**, ouvre la session ; si `emailVerified` est faux, appelle `revokeUnprovenAccountAccess`                             | `node_modules/better-auth/dist/plugins/magic-link/index.mjs:145-195`                                                          |
| `revokeUnprovenAccountAccess`                                   | pour un `user` non vérifié : supprime ses lignes `account` et **toutes ses sessions**, puis pose `emailVerified = true`                                                                              | `node_modules/better-auth/dist/db/revoke-unproven-account-access.mjs:33-56`                                                   |
| `membershipLimit: 10`                                           | plafond appliqué par les routes **Better Auth** d'ajout de membre et d'acceptation d'invitation, pas par une écriture directe en base                                                                | `auth.ts:161`, `node_modules/better-auth/dist/plugins/organization/routes/crud-members.mjs:62-66`, `crud-invites.mjs:275-279` |
| `canPerformAction`                                              | `(user \| undefined, organizationId, actionId) => boolean` ; SuperAdmin toujours vrai ; ne connaît que les rôles, pas la propriété d'une fiche                                                       | `src/services/authorization/action-registry-authorization.ts:18-32`                                                           |
| `requireActionAuth`                                             | `cache(async (options?) => User)` ; lève `AuthorizationError` sans session                                                                                                                           | `src/app/dal/user-dal.ts:41-60`                                                                                               |
| `getCurrentUserDal`                                             | `'use cache: private'`, `cacheLife('minutes')` : contexte de présentation, **gardé dans le navigateur**                                                                                              | `user-dal.ts:138-158`                                                                                                         |
| `requireCurrentTenantDal`, `getCurrentTenantDal`                | tenant du domaine appelé (`TenantDTO`), ou page introuvable                                                                                                                                          | `src/app/dal/tenant-dal.ts:93`, `:71`                                                                                         |
| `getCurrentParcelsByMemberDao`, `getFormerParcelsByMemberDao`   | `(memberProfileId) => CurrentParcelRow[]` / `FormerParcelRow[]` (cette dernière porte `buyerId`, `buyerName`)                                                                                        | `src/db/repositories/parcel-ownership-repository.ts:152`, `:174`                                                              |
| `getMemberParcelsService`                                       | `(organizationId, memberProfileId) => MemberParcelsDTO` ; **exige `member.profile.manage`** ; `former[].soldTo` = `{memberProfileId, name}`                                                          | `src/services/parcel-ownership-service.ts:271-307`                                                                            |
| `getMemberProfileByEmailDao`                                    | `(organizationId, email)`, sans casse                                                                                                                                                                | `src/db/repositories/member-profile-repository.ts:126-140`                                                                    |
| `createMemberProfileTxnDao`, `updateMemberProfileContactTxnDao` | écrivent dans un **point de sauvegarde** (`getDb().transaction`) et rendent `email_taken` au lieu de lever                                                                                           | `member-profile-repository.ts:79-113`                                                                                         |
| `associationOriginOf`                                           | origine d'une association depuis son domaine, sans requête (pour s15 / s42)                                                                                                                          | `src/lib/better-auth/association-origin.ts:25-35`                                                                             |
| `formatContentDate`                                             | `(isoDate, locale = 'fr-FR')` → « 3 février 1998 », en UTC                                                                                                                                           | `src/lib/cms/format-content-date.ts:10`                                                                                       |
| `lastOwnershipDayOf`, `calendarDayOf`                           | veille d'une fin de période ; jour calendaire de Paris                                                                                                                                               | `src/services/rules/parcel-ownership-rules.ts:127`, `src/services/types/domain/water-analysis-types.ts:155`                   |
| `BureauAccessDenied`                                            | écran de refus du back-office (texte de `BureauIdentityPage.denied`, bouton vers `/`) — **pas** l'écran `6c`                                                                                         | `src/components/features/association/bureau-access-denied.tsx`                                                                |
| `AUTHENTICATED_SEGMENTS`                                        | `/account`, `/admin`, `/bureau`, `/dashboard`, `/team` — liste partagée par le proxy et `robots.txt`                                                                                                 | `src/lib/routing/authenticated-segments.ts:9-15`                                                                              |
| `incident_report_event.author_user_id`                          | précédent d'une table métier sous RLS qui référence `user` en `ON DELETE SET NULL`                                                                                                                   | `src/db/models/incident-report-model.ts:83-85`                                                                                |

Next, lu dans `node_modules/next/dist/docs/` :

- `01-app/02-guides/preserving-ui-state.md` : sous Cache Components, une route quittée est **masquée**
  par `<Activity>`, pas démontée ; état React et DOM conservés ; jusqu'à 3 routes gardées ; section
  « State and authentication » : l'état local survit à un changement d'utilisateur.
- `03-api-reference/04-functions/forbidden.md:185` : un contrôle fait derrière un `<Suspense>` part
  après le début d'un `200`, le statut ne peut plus changer.
- `03-api-reference/01-directives/use-cache-private.md:14` : résultat jamais stocké côté serveur,
  gardé en mémoire du navigateur, perdu au rechargement.

## Traps & constraints

**Ouverture du compte**

- **Casse de l'email — piège silencieux.** `member_profile.email` garde la casse saisie,
  `createUserDao` aussi, alors que `getUserByEmailDao` et Better Auth cherchent la forme en
  minuscules. Un `user` créé avec une majuscule ne reçoit jamais de lien (compte « ouvert » mais
  inconnu à la connexion), et un second appel tente de le recréer. L'email du `user` doit être écrit
  en minuscules, comme le fait le schéma du provisioning.
- **Ne pas créer le `user` par Better Auth.** Le hook `user.create.after` crée une organisation
  personnelle et déclenche un email de suivi ; le plugin Stripe porte `createCustomerOnSignUp: true`
  (`auth.ts:194`, effet sur une création par l'adaptateur **non vérifié**). `createUserDao` évite les
  deux. De même, ne pas ajouter le membre par les routes Better Auth : `membershipLimit: 10`.
- **`createOrganizationMemberService` est inutilisable** : plafond de membres du plan Stripe, et
  ordre autorisation / validation du boilerplate.
- **Atomicité et unicité.** L'écriture de la fiche et celle du compte doivent tenir dans le même
  `withTenant`. Deux associations qui ouvrent la même adresse en même temps, ou deux enregistrements
  rapprochés, produisent une violation d'unicité sur `user.email` ou sur
  `member(organization_id, user_id)` : sans point de sauvegarde, elle condamne la transaction du
  scope (c'est ce que `createMemberProfileTxnDao` évite déjà pour l'email d'une fiche).
- **`member.created_at`** n'a pas de défaut ; **`user.name`** est obligatoire (le nom de la fiche
  existe ; ne pas réécrire celui d'un `user` réutilisé).
- **`emailVerified` reste faux** sur un `user` créé par DAO : à sa première connexion par lien, Better
  Auth supprime ses lignes `account` et ses sessions puis le marque vérifié. Sans effet sur un compte
  neuf. Une adresse saisie par le bureau n'est pas une preuve : ne pas forcer `emailVerified`.
- **Toute lecture nouvelle de `member` porte son `can*`** (ADR 014) : la carte « Accès à l'espace
  membre » lit l'appartenance d'un tiers, c'est du code d'autorisation.
- **Fiche d'un membre du bureau.** Son `user` et sa ligne `member` (`board` / `owner`) existent déjà :
  ouvrir = rattacher, sans toucher au rôle. Le plan de s12 (décision J) renvoie ce rattachement à
  s12d.

**Fermeture du compte**

- **`deleteUserOrganizationDao` supprime quel que soit le rôle.** La règle « jamais une ligne dont le
  rôle n'est pas `member` » doit être tenue par la requête elle-même (condition sur le rôle), pas par
  un « lire puis supprimer » que s14 pourra croiser.
- **Supprimer les sessions ne convient pas**, pour deux raisons vérifiées : `session` n'a pas
  d'association (les supprimer couperait l'accès de la personne **ailleurs**, contre le critère 3), et
  `cookieCache` sert la session depuis le cookie pendant 5 minutes sans relire la base (contre le
  critère 5).
- **Ce qui coupe « à la requête suivante »** : la ligne `member` retirée, parce que `customSession`
  relit les appartenances en base à chaque `getSession`. Encore faut-il qu'un contrôle les regarde :
  **aucun n'existe dans `(app)`** aujourd'hui. Sans garde, le critère 5 n'est tenu par rien.
- **Un lien déjà envoyé reste valable 20 minutes** après la fermeture : `/magic-link/verify` ne
  vérifie pas l'appartenance et ouvre une session. Elle doit buter sur la même garde.
- **`getCurrentUserDal` est un cache privé de plusieurs minutes dans le navigateur** : la barre
  latérale et `useAuth()` peuvent montrer un contexte périmé après la fermeture. La décision d'accès
  et les données de « Mes parcelles » doivent venir de `getAuthUser()`, côté serveur.
- **« Requête suivante » en e2e** : `staleTimes.dynamic: 30` (`next.config.ts:62-65`) et les routes
  gardées par `<Activity>` font qu'une navigation cliente peut ne déclencher aucune requête. La
  preuve du critère 5 passe par un chargement réel (`goto` / `reload`) ou une Server Action.
- **Aucune purge, aucune coupure automatique** : le `user` reste, la fiche reste, l'ancien
  propriétaire sans parcelle garde son accès (`6b`). À écrire dans le plan pour que la revue ne le
  compte pas comme un manque.

**« Mes parcelles » et le critère 4**

- **Les services de lecture de s12 sont fermés aux membres** (`member.profile.manage`). Les ouvrir
  serait une faute : il faut une lecture côté membre qui **ne prend aucun identifiant de fiche** et
  résout la fiche depuis la session et le tenant du domaine appelé.
- **`FormerParcelDTO.soldTo` porte le nom et l'identifiant de l'acquéreur** : réutiliser
  `MemberParcelsDTO` tel quel enverrait au navigateur l'identité d'un autre membre. Le DTO côté
  membre doit l'exclure.
- **L'identité n'est jamais l'email** (AGENTS.md). Résoudre « ma fiche » par égalité d'emails entre
  `user` et `member_profile` contredit la règle, et la note de s16 prévoit que l'email de contact
  puisse diverger de l'identifiant de connexion.
- **Un compte membre de deux associations** (cas du seed : `admin@gmail.com`) doit voir, sur chaque
  domaine, la fiche de **cette** association seulement : la preuve d'isolation de la story est là
  (e2e sur deux tenants, RLS non testable en unitaire).
- **Exposition créée par s12d dans les pages héritées.** Le rôle `member` reçoit de CASL le droit de
  lire les utilisateurs de son organisation (`src/services/authorization/casl-abilities.ts:254-262`),
  et `/team/[slug]` liste alors nom, **email** et rôle de chaque membre
  (`src/app/[locale]/(app)/team/[slug]/page.tsx:31-43`, `OrganizationMemberDTO` dans
  `src/app/dal/organization-dal.ts:24-31`). Aujourd'hui sans conséquence (une poignée de comptes) ;
  après s12d et s13, **chaque propriétaire connecté peut lire la liste des 300 autres**. Contraire à
  « à lui seul ». `docs/architecture.md` (« Reste connu ») signalait déjà ces pages comme non scopées
  au domaine.
- **Comptes sans fiche** : SuperAdmin, comptes du seed (`user@gmail.com` est `member` de TechCorp sans
  fiche), bureau dont la fiche n'est pas rattachée. `/dashboard` doit rendre pour eux aussi.
- **L'écran `6c` n'a pas de route** : s12d n'introduit aucune adresse d'espace membre portant
  l'identifiant d'une fiche, et `/bureau/proprietaires/{id}` répond déjà à un membre par
  `BureauAccessDenied`, dont le texte n'est pas celui de `6c`.

**État conservé entre les navigations — la classe de défauts trouvée par la revue de s12**

Sous `cacheComponents: true`, une route quittée reste montée ; la clé d'une page **ignore les
paramètres de recherche** (`?cree=1` et `?vente=…` sont la même instance de la fiche). Un état
initialisé une fois depuis les props ou l'URL devient faux. Deux de ces défauts n'ont été vus qu'en
e2e sur la CI. Patrons retenus par s12, à reprendre tels quels :

1. **Dériver l'affichage des props courantes, pas d'un état figé au montage** :
   `notice = pageNotice ?? arrivalNoticeOf({created, soldParcelId, parcels})`
   (`member-profile-detail.tsx:123-128`). Les alertes `2f`, `3g`, `3h` tombent exactement dans ce cas.
2. **Nettoyage en `useLayoutEffect`** pour un message né dans la page : il est effacé quand
   `<Activity>` masque l'écran (`member-profile-detail.tsx:134-136`).
3. **Drapeau en `ref` levé au succès + `reset()` au masquage** pour un formulaire de création
   (`member-profile-form.tsx:94-108`) : un `reset()` dans `onValid` est écrasé par react-hook-form.
4. **Ajustement d'état pendant le rendu** quand une prop arrive sur une instance conservée
   (`sale-form.tsx:116-123`).
5. **Tests sous un vrai `<Activity>`** (`import {Activity} from 'react'`) et, en e2e, des sélecteurs
   par rôle (`getByRole` ignore le contenu masqué ; `getByLabel` non).

S'y ajoute, propre à s12d : **l'état local survit à un changement d'utilisateur** (guide Next,
« State and authentication ») — l'espace membre ne doit rien garder en état client qui appartienne
au membre précédent sur le même navigateur.

Mineurs laissés ouverts par la revue de s12 dans des fichiers que s12d modifiera
(`docs/reviews/s12-membres-parcelles.md`) :

| Réf.       | Fichier                                                                 | Constat                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n6         | `member-profile-detail.tsx:136`                                         | le nettoyage efface aussi l'alerte si le `Suspense` de la page repasse en repli (non atteint aujourd'hui)                                                               |
| n5         | `member-profile-detail.tsx:121-122`, `attach-parcel-dialog.tsx:283-288` | `dialog` de rattachement et son refus conservés au retour sur la fiche                                                                                                  |
| n10        | `member-profile-form.tsx:100-128`                                       | le drapeau de vidage survit à un second envoi refusé ; `holder` et `failure` ne sont pas vidés — or un double envoi avec email ouvrirait désormais un compte au premier |
| n9, n11    | `member-profile-form.tsx:103`, `member-profile-form.test.tsx`           | remise à zéro du drapeau et parcours `saleReturn` sans test                                                                                                             |
| m3, n1, n8 | `e2e/member-profiles.spec.ts`                                           | rechargements avant lecture, refus croisé jugé par absence de texte, parcours prouvés seulement en jsdom                                                                |
| m4         | `parcel-ownership-service.ts:245-265`                                   | `getParcelOwnerAtService` sans appelant                                                                                                                                 |

« À arbitrer » de la même revue, qui touche s12d : **email unique par association** — tranché depuis
par l'utilisatrice (une fiche par propriétaire, les adresses partagées ne bloquent pas).

**Tests existants que s12d contredit ou touche**

- `e2e/member-profiles.spec.ts` : `accountsBornFrom` (l. 216-229) et l'assertion **« renseigner un
  email n'ouvre aucun compte (s12d) »** (l. 757-760) deviennent fausses ; celle des fiches sans email
  (l. 687-690) reste vraie. `cleanUpRun` (l. 234-248) ne supprime ni `user` ni `member` : les essais
  qui créent une fiche avec email (l. 379) laisseraient des comptes.
- `src/services/__tests__/member-profile-service.test.ts` : `accountDaos()` (l. 108-113) vérifie
  qu'aucun DAO de compte n'est appelé — vrai sans email (l. 186-205), à revoir pour la mise à jour des
  coordonnées (l. 305-341).
- `e2e/authorization.spec.ts` et `e2e/smoke-authenticated.spec.ts` chargent **`/en/dashboard`** avec
  `user@gmail.com` : la première s'appuie sur le sélecteur d'organisation de la barre latérale
  héritée, la seconde refuse toute erreur de console. Remplacer la coquille `(app)` ou rendre
  `/dashboard` avec des libellés absents de `en.json` les casse (`src/i18n/request.ts` charge le seul
  catalogue de la locale, sans repli sur le français ; comportement de next-intl sur une clé
  manquante **non vérifié à l'exécution**).
- `e2e/magic-link.spec.ts` : attend `/dashboard` après ouverture du lien (l. 358, 442) et compte les
  `user` par adresse (l. 196-202).
- `src/app/[locale]/(auth)/action.test.ts`, `association-origin.test.ts`,
  `magic-link-integration.real-i18n.test.ts` épinglent `callbackURL: '/dashboard'`.
- `src/services/__tests__/page-i18n.test.ts` : parité `en` / `es` exigée pour une liste d'espaces de
  noms (s04, s05, s09) ; ceux de s10 et s12 n'y sont pas.
- `src/db/rls-inventory.test.ts` : relit les `pgTable` et les décomptes de `docs/architecture.md` ;
  une colonne ne le touche pas, une table nouvelle si.

**Critère 2 — fiches déjà dotées d'une adresse**

- Les trois fiches à email du seed n'ont pas de compte. En CI, `pnpm db:migrate && pnpm db:seed`
  (`.github/workflows/ci.yml:130`) : au moment des migrations la base est vide, donc une reprise
  écrite **dans une migration** ne verrait aucune fiche du seed.
- Une migration de données lirait `member_profile` sous **RLS forcée** : sans `app.bypass_rls`, elle
  ne trouve rien, sans erreur (le seed pose ce réglage, `seed.ts:526`). Aucune migration existante ne
  fait de reprise de données : pas de précédent.

**Processus**

- `pnpm test --run` uniquement ; montage 9p lent (un timeout de worker n'est ni vert ni rouge) ; build
  et e2e sur la CI de la PR, pas en local.
- Dépôt public : les jeux de test restent fictifs (`*.test`, `example.test`).
- Next 16.3 : lire `node_modules/next/dist/docs/` avant d'affirmer le comportement d'une API.

## Open questions

À trancher par l'utilisatrice (choix de produit) :

1. **Changer l'email d'une fiche qui a un compte** (côté bureau) : fermer l'ancien accès et en ouvrir
   un sur la nouvelle adresse, ou garder le même compte ? Non couvert par les critères, non dessiné ;
   s16 pose la même question côté membre.
2. **Pages héritées qui listent les membres** (`/team/[slug]`, `/account/organizations/…`) : s12d
   donne un rôle `member` à des centaines de propriétaires, qui peuvent alors lire la liste des
   autres. Les fermer dans s12d (périmètre élargi), ou story dédiée avant s13 ?
3. **Coquille de l'espace membre** : la barre latérale du boilerplate (abonnement, clés d'API,
   sélecteur d'organisation) reste-t-elle autour de « Mes parcelles » ? La maquette suppose un
   en-tête d'association qui n'existe pas dans `(app)`.
4. **Ce que voit un membre dont l'accès vient d'être fermé** (session encore ouverte, ou lien cliqué
   après coup) : écran, texte, déconnexion ? Manque déjà listé au design system §9 (« Lien cliqué
   après suppression du compte »).
5. **Parcelles passées** : le critère 4 dit « actuelles et passées », la maquette `6b` n'écrit qu'une
   phrase. Liste des anciennes parcelles avec leur période, ou la phrase seule ? Faut-il un passage
   par `/ks-design` pour l'écran 6 ?
6. **Fiche d'un membre du bureau dont on retire l'email** : sa ligne `board` / `owner` reste, donc
   « Accès à l'espace fermé. » serait faux. Que dit l'écran ?
7. **Existe-t-il un environnement (préproduction) qui porte déjà de vraies fiches avec email ?** Cela
   décide si la reprise du critère 2 est une opération à rejouer, ou seulement le seed.

À trancher au plan (technique) :

8. **Forme du lien fiche ↔ compte** : colonne nullable de `member_profile` vers `user` (précédent
   `author_user_id`, `SET NULL`), unique par association, ou autre. Mérite un ADR. Ce que devient le
   lien à la fermeture (gardé pour une réouverture, ou vidé) en dépend.
9. **Reprise des fiches existantes** (critère 2) : dans le seed, par une opération idempotente du
   service rejouable hors requête, ou par migration `--custom` sous `app.bypass_rls`.
10. **Autorisation** : ouverture / fermeture sous `member.profile.manage`, ou action propre au
    registre (règle transverse : toute action soumise à autorisation s'y déclare).
11. **Où vit la garde d'appartenance** (layout `(app)`, page, service) et ce qu'elle rend pour un
    compte sans appartenance ; quelle route porte l'écran `6c`.
12. **`/dashboard` pour un compte sans fiche** (SuperAdmin, comptes hérités), et le sort du tableau de
    bord factice et des deux specs qui chargent `/en/dashboard`.
13. **Libellés** : `fr.json` seul (pratique de s10 et s12) ou aussi `en` / `es`, puisque `/en/dashboard`
    est servi jusqu'à s43.

## Ajouts du 20/10/2026 (passage par /ks-design)

Arbitrages de produit tranchés par l'utilisatrice, repris dans `docs/designs/s12d-comptes-membres-brief.md` :
questions 1 (changer l'adresse : ancien accès fermé, nouveau ouvert), 4 (accès fermé : déconnexion +
message sur `/login`), 5 (anciennes parcelles listées avec leur période, sans l'acquéreur) et 6 (fiche
du bureau ou de la présidence : adresse modifiable, jamais supprimable, le rôle suit la nouvelle
adresse). Les questions 2, 3, 12 et 13 sont réglées par s43 à s47. Règle ajoutée : **seul le bureau
supprime une adresse** ; un propriétaire peut modifier la sienne, jamais la supprimer (écran en s16).

**Piège à trancher au plan (14)** : `/account` porte déjà un formulaire de changement d'adresse
(`src/components/features/user/change-email-form.tsx`, `changeEmail` de Better Auth derrière
`NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL`, `src/lib/better-auth/auth.ts:120`). Un propriétaire qui
l'utilise change `user.email`, donc son adresse **dans toutes ses associations**, sans que sa fiche
suive : contredit l'arbitrage 1 et désynchronise fiche et compte. Le fermer dans s12d, ou le laisser à
s16 en vérifiant l'état du drapeau en production.
