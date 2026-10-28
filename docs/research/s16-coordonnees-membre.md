# Research — Story s16-coordonnees-membre

Recherche du 23/10/2026, sur `main` à `e7227836` (s12d mergée, PR 45). Tout ce qui suit a été lu dans
le code ; les chemins et signatures sont ceux du dépôt à cette date.

## Target story

**En tant que** membre propriétaire **je veux** corriger mes informations de contact **afin que** le
bureau puisse me joindre correctement. Complexité 1. Dépendances : s12, s12d (toutes deux livrées).

Critères d'acceptation (`docs/stories.md:1644`) :

1. Un membre connecté modifie ses coordonnées (adresse postale, téléphone, email de contact) et voit
   la valeur enregistrée après rechargement.
2. Une saisie invalide affiche les erreurs par champ et n'enregistre rien.
3. Un membre ne peut modifier que ses propres coordonnées : une requête visant l'identifiant d'un
   autre membre est refusée.
4. Le bureau voit les coordonnées à jour dans la fiche du membre.

Notes de la story : CRUD sur ses propres données, autorisation écrite en test d'abord ; s'inspirer du
formulaire de s12 (`member-profile-form.tsx`, `member-contact-fields.tsx`), ne pas le réimplémenter :
« même modèle, deux points d'entrée — pas deux modèles » (`docs/stories.md:1087`). **« Changer l'email
de contact ne doit pas changer silencieusement l'identifiant de connexion (s03) — trancher
explicitement en `/ks-design` et écrire le test correspondant. »**

Engagements hérités, à respecter :

- **Arbitrages du 20/10/2026** (brief s12d, `docs/designs/s12d-comptes-membres-brief.md:28-41`, « pas à
  rediscuter ») : changer l'adresse d'une fiche qui a un compte ferme l'accès lié à l'ancienne adresse
  et en ouvre un sur la nouvelle, **les autres associations ne sont jamais touchées** ; l'adresse d'un
  membre du bureau / de la présidence est modifiable, jamais supprimable, et son rôle suit ; **seul le
  bureau supprime une adresse : un propriétaire peut modifier la sienne, jamais la supprimer — « cet
  écran-là appartient à s16 »**.
- **Plan s12d, décision du piège 14** (`docs/plans/s12d-comptes-membres.md:54-57`) : le changement
  d'adresse hérité de `/account` (Better Auth `changeEmail`) est **fermé** ; « s16 le rouvrira en
  synchronisant fiche et compte ». Même phrase dans le commentaire du schéma d'env
  (`src/env-schemas.ts:153-157`).
- **ADR 037** : « s16 prévoit que l'adresse de contact puisse diverger de l'identifiant de
  connexion » (contexte) ; « s16 (profil du membre) s'appuie sur ce lien `user_id` » (conséquences).
- **Design system §9** (`docs/design-system.md:1138`), manque ouvert attribué à s16 : « Changement
  d'adresse email par le membre : lui-même (avec validation de la nouvelle) ou via le bureau ? »

## Current state of the code

### Trois adresses email, une seule colonne métier

| Adresse                       | Où                                                                    | Portée                                       | Ce qu'elle pilote                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Identifiant de connexion      | `user.email` (Better Auth)                                            | **toute la plateforme**, unique              | le lien magique (s03), la connexion dans **toutes** les associations de la personne                                                       |
| Adresse de la fiche           | `member_profile.email` (`src/db/models/member-profile-model.ts:44`)   | **une association**, unique sans casse       | `mail_only` (colonne générée `email IS NULL`), **l'ouverture / fermeture / remplacement du compte** (ADR 037), les envois futurs (s15, s25, s28) |
| « Email de contact » (story)  | **n'existe pas comme colonne distincte**                              | —                                            | —                                                                                                                                         |

Il n'y a **qu'une** colonne email sur la fiche. Le critère 1 dit « email de contact » ; dans le code
actuel, c'est `member_profile.email`, qui est aussi le levier d'accès. Le modèle ne sait pas
représenter « une adresse de contact différente de l'adresse de connexion » sans nouvelle colonne
(donc migration + ADR qui amende 037). Voir questions ouvertes 1 et 2.

### Le chemin d'écriture actuel (bureau, s12 + s12d)

- `updateMemberProfileContactService(input: UpdateMemberProfileContactInput):
  Promise<MemberProfileWriteResult>` — `src/services/member-profile-service.ts:169`. Ordre :
  Zod (`updateMemberProfileContactServiceSchema`) → `requireMemberProfileManager` (action
  `member.profile.manage`, rôles `owner`/`board`) → `withTenant` → lit la fiche par **son id**
  (`getMemberProfileByIdDao`) → `decideMemberAccount` → `updateMemberProfileContactTxnDao` →
  `applyMemberAccountDecision` → `toProfileWithAccount` (qui appelle `readAccount`, gardé par
  `canReadMemberAccount` = encore `member.profile.manage`).
- Conséquence : **ce service n'est pas réutilisable tel quel par un membre** — il lève
  `AuthorizationError` deux fois (manager, puis lecture du compte), prend un `memberProfileId` venu du
  formulaire, et rend un `email_taken` porteur de l'id de la fiche qui détient l'adresse.
- Règle pure `decideMemberAccount({savedEmail, nextEmail, linkedRole})` —
  `src/services/rules/member-account-rules.ts:26` : `nextEmail === null` → `unlink` / `close` /
  `refuse_board_removal` ; sinon sans compte lié → `open` ; même adresse (sans casse) → `none` ;
  adresse différente → **`replace`** avec le rôle lié.
- `replaceMemberAccount` — `src/services/member-account-service.ts:141` : **trouve ou crée** le `user`
  de la nouvelle adresse (`getUserByEmailDao` puis `createUserIfAbsentTxnDao`), pose sa ligne `member`
  (`ensureMembership`, rôle reporté), **retire la ligne `member` de l'ancien compte** dans cette
  association (si le rôle correspond), puis réécrit `user_id`. Aucune vérification de l'adresse, rien
  n'est envoyé.
- Server Action bureau : `updateMemberProfileContactAction(_prev, formData)` —
  `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts:166`. `requireCurrentTenantDal()` →
  `getTranslations('BureauMemberProfilesPage')` → `requireActionAuth()` →
  `createMemberContactFormSchema(t).safeParse(...)` → service avec
  `memberProfileId: readField(formData, 'memberProfileId')` → `toActionResult` (qui, pour
  `email_taken`, relit **le nom** de la fiche détentrice via `getMemberProfileService`) →
  `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')`.

### Le formulaire du bureau

- `ContactForm` est une fonction **non exportée** de
  `src/components/features/member-profile/member-profile-detail.tsx:536` (846 lignes). RHF +
  `zodResolver(createMemberContactFormSchema(t))`, `mode: 'onBlur'`, résumé d'erreurs, refus du
  bureau, `EmailHolder` (lien vers la fiche détentrice + son nom), `EmailAccessWarning` (avertissement
  d'accès qui change, s12d).
- `MemberContactFields({idPrefix, afterEmail?, emailRequired?})`, `MemberTextField`,
  `MemberFormErrorSummary({idPrefix, fields})`, `memberFieldIdOf` — exportés par
  `src/components/features/member-profile/member-contact-fields.tsx`. **Tous lisent en dur le namespace
  `BureauMemberProfilesPage`**, dont les textes parlent du propriétaire à la 3ᵉ personne : aide email
  « Avec une adresse, ce propriétaire peut se connecter à son espace. Sans adresse, il reçoit tout par
  courrier. », encart `mailOnlyNotice` « Sans adresse email, ce propriétaire sera joignable par courrier
  uniquement… » (affiché dès que le champ email est vide), « Facultatif » sur l'email quand
  `emailRequired` est faux.
- Schémas client : `createMemberContactFormSchema(t: Translate)` et `memberContactFormSchema`,
  `MEMBER_CONTACT_FORM_FIELDS` (`email, phone, addressLine, addressComplement, postalCode, city`),
  type `MemberProfileActionResult` — `src/components/features/member-profile/member-profile-form-validation.ts`.
  Messages sous `BureauMemberProfilesPage.validation.*` (`emailInvalid`, `phoneInvalid`, `addressMax`,
  `postalCodeInvalid`, `cityMax`) dans `messages/fr.json` (seul fichier de messages).
- Schéma serveur : `contactShape` / `optionalContact` (non exportés) dans
  `src/services/validation/member-profile-validation.ts` — vide ou espaces → `null`, email **validé mais
  pas mis en minuscules** (la normalisation se fait au moment d'ouvrir le compte).

### L'espace membre (s46 + s12d)

- Page `/dashboard` : `src/app/[locale]/(app)/dashboard/page.tsx`, `withAuth(Page)`, lit
  `getMyParcelsDal()` en promesse derrière `<Suspense>`.
- `getMyParcelsDal = cache(async () => getMyParcelsService(tenant.id))` —
  `src/app/dal/member-space-dal.ts`, **sans `'use cache'`** (données par utilisateur, ADR 038).
- `getMyParcelsService(organizationId: string): Promise<MyParcelsDTO | undefined>` —
  `src/services/member-space-service.ts:31`. **Ne prend aucun identifiant de fiche** : `getAuthUser()`
  (lève `AuthorizationError` sans session) → `withTenant` → `getMemberProfileByUserIdDao(orgId,
  authUser.id)`. Pas d'action au registre : la « propriété » est garantie par la résolution
  session + domaine. **C'est le patron à suivre pour le critère 3.**
- Façade `src/services/facades/member-space-service-facade.ts` (intercepteur sans détails dans les
  journaux, comme celui des fiches).
- `MyParcelsDTO` (`src/services/types/domain/member-space-types.ts`) : `name`, `current`, `former` —
  **aucune coordonnée, aucun id**.
- `MemberSpace` (`src/components/features/member-space/member-space.tsx`) : composants serveur, sans
  état client ; `PersonalMarker`, `Greeting`, `MyParcelsCard` (« Une erreur ? Écrivez au bureau. » →
  `/contact`), `SecurityCard` (lien `/account`). **Une fiche sans aucune parcelle (ni actuelle ni
  ancienne) bascule sur `MemberSpaceWithoutProfile`** (page de s46), comme un compte sans fiche.
- Coquille `src/app/[locale]/(app)/layout.tsx` : identité de l'association + déconnexion, rien d'autre.

### `/account` (s46 « minimum », s12d)

- `src/app/[locale]/(app)/account/page.tsx` : retour vers `/dashboard`, titre, `UserSecurityFactorSection`.
- `src/components/features/user/security-section.tsx` : carte `ChangeEmailForm` affichée seulement si
  `AuthClientAppConfig.changeEmail && shouldShowChangeEmail()` ; puis mot de passe, 2FA, jetons.
- Drapeau `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL` : défaut `'false'` (`src/env-schemas.ts:158`), lu par
  `src/env.ts:87`, `AuthAppConfig.changeEmail` (`src/lib/better-auth/auth.ts:58`) →
  `user.changeEmail.enabled` (`auth.ts:120`), et `AuthClientAppConfig` (`auth-client.ts:24`). À `false`
  dans `env.example:52`, `ops/env.production.example:35`, `scripts/init-env.ts` (96, 137, 182, 224).
  Tests qui l'épinglent à `false` : `src/env-schemas.test.ts:151`, `ops/env-production-example.test.ts:61`,
  `scripts/init-env.test.ts:6-10`, `security-section.test.tsx`.
- Flux Better Auth s'il était rouvert : `changeEmailAction` (`src/components/features/user/action.ts:511`)
  → `changeEmail` → `sendChangeEmailConfirmation` → notification `change_email_verification` →
  `sendEmailChangeEmailVerificationService` **vers l'adresse actuelle** (`notification-service.ts:221`).
  À la confirmation, Better Auth réécrit `user.email`. **Aucun hook ne propage ce changement** :
  `createDatabaseHooks()` (`auth.ts:318`) n'a que `user.create`. Donc `member_profile.email` ne suit
  dans **aucune** association.
- Texte resté : `MemberSpacePage.security.description` = « Votre adresse email, votre mot de passe et
  les appareils connectés à votre compte. » alors que la carte email n'est plus affichée (et épinglé
  par `account/page.test.tsx:58`).

### Isolation

- `member_profile` : RLS forcée, policy `tenant_isolation` seule (`docs/architecture.md:363`). Sous
  `withTenant(org)`, **toute** fiche de l'association est lisible et modifiable : la RLS ne distingue
  pas « ma fiche ». Le « seulement la mienne » est à la charge du service (résolution par `user_id`).
- Unicité `(organization_id, lower(email))` et `(organization_id, user_id)` partielles
  (`member-profile-model.ts:60-67`).

## Anchor points

- **Service** : une nouvelle fonction côté membre, dans le domaine « espace membre »
  (`src/services/member-space-service.ts`) ou dans `member-profile-service.ts` — à trancher au plan —
  avec la signature du patron `getMyParcelsService` : `organizationId` + champs, **jamais** de
  `memberProfileId`. Elle réutiliserait `getMemberProfileByUserIdDao`, `updateMemberProfileContactTxnDao`
  et, selon la réponse à la question 1, `decideMemberAccount` + `applyMemberAccountDecision`.
- **Lecture des coordonnées pour le membre** : `MyParcelsDTO` n'en porte aucune ; il faut une lecture
  (nouveau DTO sans `id`, sans `account`, ou extension) passant par le DAL de l'espace membre
  (`src/app/dal/member-space-dal.ts`), sans `'use cache'`.
- **Façade** : `src/services/facades/member-space-service-facade.ts` (ou celle des fiches) +
  intercepteur déjà sans détails.
- **Server Action** : aucun `actions.ts` n'existe encore sous `src/app/[locale]/(app)/` ; à créer près
  de la route qui portera l'écran (signature `(_prev, formData) => Promise<Result>`, `requireActionAuth`,
  `requireCurrentTenantDal`, `getTranslations`).
- **Route** : `/dashboard` (une carte de plus) ou une page dédiée sous `(app)` — décision de
  `/ks-design`. `withAuth` protège la page ; le layout `(app)` ne contrôle rien.
- **Formulaire** : `MemberContactFields` / `MemberTextField` / `MemberFormErrorSummary` et
  `createMemberContactFormSchema` sont les briques réutilisables ; `ContactForm` ne l'est pas (non
  exporté, chargé de logique bureau).
- **Libellés** : `messages/fr.json`, namespace `MemberSpacePage` (ou nouveau), plus une
  paramétrisation du namespace des champs.
- **Registre** : `src/services/types/domain/action-registry-types.ts` si une action « modifier ses
  coordonnées » y est déclarée (question 5).

## Verified APIs / functions

| Symbole                                    | Signature (lue)                                                                                                               | Fichier                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `getMemberProfileByUserIdDao`              | `(organizationId: string, userId: string) => Promise<MemberProfileModel \| undefined>`                                        | `src/db/repositories/member-profile-repository.ts:293`          |
| `updateMemberProfileContactTxnDao`         | `(memberProfileId: string, contact: MemberProfileContactWrite) => Promise<{status:'updated';row} \| {status:'not_found'} \| {status:'email_taken'}>` — point de sauvegarde, `email_taken` rendu et non levé | `member-profile-repository.ts:96`                               |
| `MemberProfileContactWrite`                | `{email, phone, addressLine, addressComplement, postalCode, city}`, chacun `string \| null`                                   | `member-profile-repository.ts:34`                               |
| `getMemberProfileByEmailDao`               | `(organizationId, email) => Promise<MemberProfileModel \| undefined>`                                                         | `member-profile-repository.ts:128`                              |
| `updateMemberProfileContactService`        | `(input: UpdateMemberProfileContactInput) => Promise<MemberProfileWriteResult>` — bureau seulement                            | `src/services/member-profile-service.ts:169`                    |
| `MemberProfileWriteResult`                 | `saved{profile, accountChange} \| email_taken{memberProfileId} \| not_found \| board_email_required`                          | `src/services/types/domain/member-profile-types.ts:108`         |
| `decideMemberAccount`                      | `({savedEmail, nextEmail, linkedRole}) => MemberAccountDecision` (pure, isomorphe)                                            | `src/services/rules/member-account-rules.ts:26`                 |
| `sameEmail`                                | `(a: string \| null, b: string \| null) => boolean`                                                                           | `member-account-rules.ts:16`                                    |
| `applyMemberAccountDecision`               | `({organizationId, profile:{id,name,email,userId}, decision}) => Promise<{change, userId}>`                                   | `src/services/member-account-service.ts:177`                    |
| `getLinkedAccountRole`                     | `(organizationId, userId: string \| null) => Promise<MemberAccountRole \| null>`                                              | `member-account-service.ts:163`                                 |
| `getMyParcelsService`                      | `(organizationId: string) => Promise<MyParcelsDTO \| undefined>`                                                              | `src/services/member-space-service.ts:31`                       |
| `getMyParcelsDal`                          | `cache(async () => Promise<MyParcelsDTO \| undefined>)`                                                                       | `src/app/dal/member-space-dal.ts`                               |
| `withTenant`                               | `<T>(organizationId: string, callback: () => Promise<T>) => Promise<T>`                                                       | `src/db/tenant-scope.ts:128`                                    |
| `getAuthUser`                              | applique `canOpenSessionOn` à chaque lecture (ADR 038) ; `undefined` si l'accès est fermé                                     | `src/services/authentication/auth-service.ts`                   |
| `requireActionAuth`                        | `cache(async (options?: RequireAuthOptions) => User)` — lève `AuthorizationError` sans session                                | `src/app/dal/user-dal.ts:47`                                    |
| `requireCurrentTenantDal`                  | tenant du domaine appelé                                                                                                      | `src/app/dal/tenant-dal.ts`                                     |
| `withAuth` / `CLOSED_ACCESS_PATH`          | HOC de page ; `'/login/acces-ferme'`                                                                                          | `src/components/features/auth/with-auth.tsx:20,52`              |
| `canPerformAction`                         | `(user, organizationId, actionId) => boolean` — SuperAdmin passe, sinon rôle ∈ `defaultRoles`                                 | `src/services/authorization/action-registry-authorization.ts`   |
| `createMemberContactFormSchema`            | `(t: Translate) => ZodObject` (+ `MEMBER_CONTACT_FORM_FIELDS`)                                                                | `member-profile-form-validation.ts`                             |
| `MemberContactFields`                      | `({idPrefix, afterEmail?, emailRequired?})`, client, namespace `BureauMemberProfilesPage` en dur                              | `member-contact-fields.tsx`                                     |
| `MemberFormErrorSummary`                   | `({idPrefix, fields})`                                                                                                        | `member-contact-fields.tsx`                                     |
| `updateUserSafeByUidDao`                   | exclut `email` des champs écrits (`const {id, email, emailVerified, createdAt, ...rest}`)                                     | `src/db/repositories/user-repository.ts:181`                    |

Ce qui **n'existe pas** : aucune lecture de coordonnées côté membre, aucune Server Action sous `(app)`,
aucune action « self » au registre (toutes les entrées ont `defaultRoles: ['owner', 'board']`), aucune
colonne d'email de contact distincte, aucun hook de synchronisation `user.email` → fiche.

## Traps & constraints

1. **Changer `member_profile.email` côté membre, c'est changer son accès.** Avec la règle actuelle
   (`replace`), un membre qui saisit une nouvelle adresse : (a) crée ou réutilise le `user` de cette
   adresse, (b) **perd sa ligne `member` sur l'ancien compte**, donc (ADR 038) `getAuthUser()` le rend
   non connecté **à la requête suivante** — il est envoyé vers `/login/acces-ferme` puis
   `/login?acces=ferme` (message « Votre accès à l'espace membre est fermé… écrivez au bureau »), ce
   qui est faux dans ce cas ; (c) doit redemander un lien magique sur la nouvelle adresse ; rien ne
   l'en prévient puisque rien n'est envoyé. Ses autres associations gardent l'ancien compte : la
   personne a désormais **deux** `user`. 2FA, mot de passe, jetons restent sur l'ancien. C'est
   « changer silencieusement l'identifiant de connexion » que la story interdit.
2. **Aucune preuve de possession de la nouvelle adresse.** Côté bureau, c'est la responsabilité du
   bureau. En self-service : une faute de frappe enferme le membre dehors ; pire, saisir l'adresse
   d'**une autre personne déjà inscrite sur la plateforme** (autre association) relie la fiche à son
   compte et **lui ouvre l'espace de ce membre** (parcelles, coordonnées) sans qu'elle l'ait demandé.
   Le manque du design system (« avec validation de la nouvelle ») vise exactement ce point.
3. **Fuite par `email_taken`.** Le chemin bureau rend l'id et le nom de la fiche qui détient déjà
   l'adresse (`EmailHolder`, `toActionResult`). Côté membre, ce serait révéler l'identité d'un autre
   propriétaire et confirmer qu'une adresse est connue : le résultat doit être générique.
4. **Supprimer l'adresse est interdit au membre** (arbitrage). Le schéma partagé accepte un email vide
   (→ `null` → `close`). Le chemin membre doit refuser le vide **côté serveur**, pas seulement en
   masquant « Facultatif » ; et l'encart `mailOnlyNotice` (affiché dès que le champ est vide) n'a pas
   de sens pour lui. Un compte lié implique une adresse non nulle : le membre connecté a toujours un
   email sur sa fiche, sauf incohérence.
5. **Le service bureau n'est pas réutilisable** : double garde `member.profile.manage`, id venu du
   navigateur, `toProfileWithAccount` qui lève pour un membre. La règle « même modèle, pas deux
   modèles » vise les données (`member_profile`, schémas, champs), pas ce service ; mais la logique
   compte (`decideMemberAccount` / `applyMemberAccountDecision`) ne doit pas être dupliquée.
6. **Critère 3 sans identifiant.** Le patron de s12d est qu'**aucune adresse ni aucun champ de
   l'espace membre ne porte l'id d'une fiche**. Le test « requête visant l'identifiant d'un autre
   membre » se traduit donc par : un `memberProfileId` (ou `id`) glissé dans le `FormData` est
   **ignoré**, seule la fiche résolue par `user_id` est écrite (test unitaire du service et de
   l'action) ; et l'isolation entre associations reste un **e2e** (RLS non testable en unitaire,
   ADR 038 : `getAuthUser` mocké ne voit pas la règle).
7. **Rouvrir `changeEmail` de Better Auth ne suffit pas et contredit un arbitrage.** Il change
   `user.email` (donc la connexion **dans toutes les associations**) ; il n'existe aucun hook pour que
   les fiches suivent ; et faire suivre les fiches de toutes les associations toucherait « les autres
   associations », ce que l'arbitrage interdit. Le vérifier « en production » n'a pas d'objet : le
   drapeau est `NEXT_PUBLIC_*`, **figé au build**, `false` par défaut et dans les deux exemples d'env.
   Le rouvrir casse 4 tests qui l'épinglent (voir plus haut) et demande de rééditer les commentaires
   qui renvoient à s16.
8. **Fiche sans parcelle = pas d'espace.** `MemberSpace` bascule sur la page de s46 si la fiche n'a ni
   parcelle actuelle ni ancienne : un formulaire posé dans `MyParcelsCard`/`MemberSpace` serait
   invisible pour ce propriétaire. À prendre en compte au design.
9. **Namespace en dur.** `MemberContactFields` et ses voisins lisent `BureauMemberProfilesPage` (textes
   à la 3ᵉ personne, aide email « ce propriétaire peut se connecter… »). Réutiliser sans paramétrer le
   namespace ou l'aide = textes faux côté membre ; dupliquer les composants = « réimplémenter le
   formulaire ». Toucher à ces composants impose de garder verts
   `member-profile-detail.test.tsx` (891 lignes) et `member-profile-form.test.tsx`.
10. **Messages de validation.** Les messages actuels sont neutres (« Cette adresse email n'est pas
    valide. », « Un code postal compte 5 chiffres. ») mais rangés sous `BureauMemberProfilesPage`.
    `rule-zod-client-server-internationalization` : un schéma traduit partagé client/serveur ; le
    serveur rejoue `createMemberContactFormSchema(t)` puis le schéma de service. Seul `fr.json` existe.
11. **Cache et fraîcheur.** Les DAL de l'espace membre et du bureau sont **sans `'use cache'`** : le
    critère 4 tient par construction (le bureau relit à chaque requête). `staleTimes.dynamic: 30`
    (`next.config`) peut servir une page périmée en navigation cliente : revalider la route du membre
    après succès (le patron bureau fait `revalidatePath(..., 'layout')`). Ne jamais lire les
    coordonnées depuis `getCurrentUserDal` (cache privé, ADR 038).
12. **Journaux.** Les intercepteurs des deux façades ont `shouldLogDetails: () => false` (données
    personnelles) ; toute nouvelle façade doit faire de même.
13. **Le « 0 résultat » multi-tenant.** Toute lecture/écriture de la fiche doit être dans
    `withTenant(tenant.id, …)` ; un oubli rend `undefined` (traité comme « pas de fiche ») au lieu de
    lever.
14. **Membre du bureau qui est aussi propriétaire.** Il passe par la même lecture `user_id` ; si
    l'email est modifiable, `decideMemberAccount` rend `replace` avec son rôle `board`/`owner` (le rôle
    suit, arbitrage s12d) — même risque de coupure qu'au piège 1, pour un compte du bureau.
15. **Texte resté à corriger ?** `MemberSpacePage.security.description` annonce « Votre adresse
    email… » alors que la carte a disparu de `/account` ; selon la décision sur l'email, s16 le rend
    vrai ou devrait le corriger (test `account/page.test.tsx:58` l'épingle).
16. **Seed / e2e.** Le seed a des fiches avec adresse et compte (`tenant-member-profiles-seed.ts`,
    dont « Gérard Pommier » sur deux associations avec la même adresse — le cas « autres associations
    non touchées »). Les helpers de connexion par lien magique de `e2e/member-accounts.spec.ts`
    (`requestLink`, `loginByLink`, `outboxFiles`) sont **locaux au fichier**, pas partagés. e2e sur
    GitHub uniquement.
17. **Arbre partagé** : s14 et s15 sont recherchées en parallèle ; s14 change le rôle de la ligne
    `member`, s15 envoie l'invitation sur l'adresse de la fiche — toutes deux lisent la même colonne
    que s16 modifierait.

## Open questions

À trancher par l'utilisatrice avant `/ks-design` (choix de produit) :

1. **Le membre peut-il modifier lui-même l'adresse email de sa fiche, qui est aussi son identifiant
   de connexion dans cette association ?** Trois réponses possibles, aux conséquences très
   différentes :
   - **(a) Non** : en s16, le membre corrige adresse postale et téléphone ; l'email est affiché en
     lecture seule avec « pour la changer, écrivez au bureau » (le bureau applique déjà l'arbitrage
     « ancien accès fermé, nouveau ouvert »). Le critère 1 cite pourtant « email de contact » : il
     faudrait l'amender.
   - **(b) Oui, avec la règle du bureau** : la nouvelle adresse devient son identifiant ici, l'ancien
     accès se ferme **immédiatement** (déconnexion), il doit se reconnecter par lien magique sur la
     nouvelle adresse ; ses autres associations gardent l'ancienne. Faut-il alors **prouver la
     possession** de la nouvelle adresse (lien de confirmation envoyé dessus, compté dans le budget
     Brevo) avant de basculer — sans quoi une faute de frappe l'enferme dehors et l'adresse d'un tiers
     inscrit ailleurs lui ouvre l'espace ?
   - **(c) Une adresse de contact distincte** de l'identifiant de connexion (ce que suggèrent la note
     de la story et l'ADR 037) : nouvelle colonne, migration, ADR qui amende 037 ; il faut alors dire
     laquelle des deux reçoivent les envois (s15, s25, campagnes) et laquelle pilote `mail_only`.
2. **Que devient la promesse « s16 rouvrira le changement d'adresse de `/account` en synchronisant
   fiche et compte » ?** Le changement Better Auth agit sur toutes les associations de la personne ;
   l'arbitrage du 20/10 interdit de toucher les autres associations. Le laisser fermé définitivement
   (et retirer ou réécrire les commentaires qui renvoient à s16), ou le rouvrir — et dans ce cas,
   qu'arrive-t-il aux fiches des autres associations ?
3. **Si l'email est modifiable et l'adresse déjà portée par une autre fiche de l'association** : quel
   message, sachant qu'il ne doit nommer ni désigner l'autre propriétaire ?
4. **Où vit l'écran** : une carte sur `/dashboard` (« Mes coordonnées »), une page dédiée, ou
   `/account` ? Et l'affiche-t-on à un propriétaire dont la fiche n'a aucune parcelle (aujourd'hui il
   voit la page de s46) ?

À trancher au plan (technique) :

5. **Autorisation** : action « self » déclarée au registre (rôles `member`, `board`, `owner`, donc
   ajustable par s37), ou contrôle par résolution session + domaine seul, comme `getMyParcelsService`
   (aucune action au registre aujourd'hui pour une donnée propre) ?
6. **Où loge le service** : `member-space-service.ts` (domaine « espace membre », pas de façade de
   fiches) ou `member-profile-service.ts` (même domaine que le bureau) ; et comment partager la
   logique compte sans dupliquer `updateMemberProfileContactService`.
7. **Paramétrage des champs** : passer le namespace / les textes d'aide à `MemberContactFields`, ou
   déplacer les libellés communs dans un namespace partagé — sans faire rougir les tests du bureau.
8. **Schéma serveur côté membre** : variante de `contactShape` où l'email est obligatoire (si
   modifiable) ou absent (si en lecture seule), plutôt que le schéma bureau qui accepte le vide.
9. **Revalidation** : quelle route revalider après succès côté membre (et faut-il aussi revalider le
   segment du bureau, inutile tant que ses DAL sont dynamiques).
