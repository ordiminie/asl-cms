> **Recherche faite le 23/10/2026 pour s15-inviter-membre, fondue dans s42 le même jour.** Elle couvre
> l'invitation individuelle ; `/ks-research s42` la complète (lancement de masse, s25 à s28, budget de
> s26) avant le design.

# Research — Story s15-inviter-membre

> Recherche menée le 23 octobre 2026 sur `main` à `e7227836` (s12d mergée, PR 45). Tout ce qui est
> nommé ci-dessous a été ouvert dans le dépôt ou dans `node_modules/better-auth` (1.7.1) ; rien n'est
> affirmé de mémoire.

## Target story

**s15-inviter-membre — Inviter un membre à rejoindre son espace** (complexité 2, bloc B).
Dépendances : s02, s03, s03c, s12, s12d — toutes livrées.

En tant que membre du bureau, je veux envoyer à un membre son invitation à se connecter, afin qu'il
sache qu'il a un espace et puisse y entrer sans explication au téléphone.

Critères d'acceptation (verbatim, numérotés pour la suite) :

1. Depuis la fiche d'un membre disposant d'une adresse email, le bureau déclenche l'envoi d'une
   invitation ; le membre reçoit un email portant un lien de connexion valide.
2. L'email d'invitation part par le même canal transactionnel que le lien magique (s03), dont il
   reprend l'en-tête au logo de l'association (s01b, ou son nom à défaut), et porte le nom de
   l'association.
3. Le texte de l'invitation est un paramètre de tenant : le modifier change l'email suivant, sans
   redéploiement.
4. La fiche membre affiche l'état de l'invitation : jamais invité, invité le <date>, ou connecté au
   moins une fois le <date>.
5. Inviter un membre marqué « joignable par courrier uniquement » est refusé avec un message
   expliquant qu'il relève du courrier, et non par une erreur technique.
6. Réinviter un membre déjà invité est possible et remplace l'invitation précédente ; l'ancien lien
   cesse de fonctionner.
7. Le bureau d'une association ne peut inviter aucun membre d'une autre.
8. Le lien de l'invitation pointe vers le domaine de l'association du membre et y ouvre la session —
   vérifié sur deux associations.

Notes de la story qui engagent le plan :

- **Elle n'implémente ni compte ni lien magique** : elle déclenche ceux de s03 depuis la fiche de s12.
  « Une seconde implémentation du lien de connexion serait un défaut de review. »
- Email **transactionnel**, pas une campagne : pas le gabarit de s25.
- « Connecté au moins une fois » se déduit de la **première connexion réussie**, pas d'un clic sur le
  lien (un antivirus clique).
- À vérifier en review : le texte par défaut n'énumère aucune fonctionnalité livrée après s15.
- La rédaction de l'email se traite en `/ks-design` (public âgé) — la story a donc de l'UI : fiche
  (bouton, état, refus) **et** gabarit d'email.
- s42 (lancement) réutilisera ce mécanisme « ni second gabarit d'invitation, ni seconde génération
  de lien », depuis une tâche différée, **hors de toute requête** (notes de s03c et s42).

## Current state of the code

### Comptes des membres (s12d) — `src/services/member-account-service.ts`

- Capacité « ouvrir / fermer un compte » créée une fois, **sans façade** (appelée par d'autres
  services, dans leur `withTenant`, après leur contrôle d'autorisation). Le commentaire d'en-tête dit
  explicitement « réutilisée par s13 (import), s15 (invitation) et s42 (lancement) » et « N'envoie
  rien ».
- Un compte ouvert par s12d est un `user` créé par DAO (`createUserIfAbsentTxnDao`,
  `user-repository.ts:400`), **`emailVerified = false`**, plus une ligne `member` de rôle `member`,
  plus `member_profile.user_id` (ADR 037).
- Les 300 comptes membres attendus (s13) seront tous dans cet état : **jamais vérifiés, jamais
  connectés, rien reçu**. s15 est la première story qui leur envoie quelque chose.

### Fiche membre (s12 + s12d)

- Table `member_profile` (`src/db/models/member-profile-model.ts`) : `email` nullable,
  `mail_only` **générée** (`email IS NULL`), `user_id` nullable (FK `user`, `SET NULL`), index uniques
  partiels `(organization_id, lower(email))` et `(organization_id, user_id)`. RLS forcée.
  **Aucune colonne d'invitation ni de première connexion.**
- Service `src/services/member-profile-service.ts` : `requireMemberProfileManager` →
  `canPerformAction(..., 'member.profile.manage')`, puis `withTenant`. `readAccount` (l. 78-95) rend
  `MemberProfileAccountDTO` = `{status: 'open', loginEmail, boardRole} | {status: 'mail_only'}` —
  **`mail_only` y signifie « pas de compte ouvert ici »**, pas forcément « sans email » (une fiche avec
  email mais sans ligne `member` rend aussi `mail_only`).
- Écran : `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx` +
  `src/components/features/member-profile/member-profile-detail.tsx`, qui a déjà une carte
  « Accès à l'espace membre » (`detail.access.title`, composant `AccessState`, l. 228 et 378). C'est
  l'endroit naturel du bouton et de l'état de l'invitation.
- Actions : `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` (patron :
  `requireCurrentTenantDal()` → `getTranslations('BureauMemberProfilesPage')` → `requireActionAuth()`
  → validation → service par façade → `toActionResult` / `toFailure`). Signature
  `(prevState, formData) => Promise<Result>`.

### Lien magique (s03, s03c, s46b) — `src/lib/better-auth/magic-link-integration.ts`

- Le seul générateur de jeton est l'endpoint Better Auth `signInMagicLink`
  (`node_modules/better-auth/dist/plugins/magic-link/index.mjs:58-100`) : il crée la ligne
  `verification` (`identifier` = jeton en clair, `value` = `JSON.stringify({email, name})`,
  `expiresAt = now + opts.expiresIn`), construit l'URL sur le `baseURL` fixe, puis appelle
  `options.sendMagicLink({email, url, token, metadata}, ctx)`.
- Le projet ferme la route HTTP (`MAGIC_LINK_DISABLED_HTTP_PATHS = ['/sign-in/magic-link']`) ; le seul
  appelant est `requestMagicLinkAction` (`src/app/[locale]/(auth)/action.ts:235-275`) via
  `auth.api.signInMagicLink({headers: await headers(), body: {email, callbackURL:
  '/login/destination', errorCallbackURL: '/login/lien-invalide', metadata: {locale}}})`.
- `sendMagicLink` (notre callback) fait, dans l'ordre :
  1. association = celle de **l'hôte de la requête** (`requestHostOf` → `organizationOfRequest`) ;
     origine = `associationOriginOf(organization.domain)` ; sans association → `return` silencieux ;
  2. **quota par adresse** : `consumeMagicLinkRequestQuotaService({organizationId, email})`
     (réglage `login.link_requests_per_address_per_day`, 3/jour par défaut) ; au-delà → `return`
     silencieux ;
  3. `getUserByEmailDao(email)` + `canOpenSessionOn(user, organization)` ; sinon `return` silencieux ;
  4. `emailAssociationOf` (nom, teinte, logo PNG seulement) ;
  5. `revokeEarlierMagicLinks` : supprime par l'adaptateur du contexte toutes les lignes
     `verification` de `value = JSON.stringify({email})` sauf le jeton qui part ;
  6. `sendMagicLinkEmailService({email, url: rebaseMagicLinkUrl(url, origin), association, locale})`.
- Durée de validité : `MAGIC_LINK_EXPIRES_IN_SECONDS = 20 * 60` (`magic-link-constants.ts`),
  passée globalement à `magicLink({expiresIn})`. **Aucune surcharge par appel** dans le plugin.
- Ouverture : `/magic-link/verify` consomme le jeton (usage unique), trouve le `user` par email ; si
  `emailVerified` est faux → `revokeUnprovenAccountAccess` (supprime ses `account` et toutes ses
  sessions, pose `emailVerified = true`) ; puis `createSession` → hook `associationSessionGuard`
  (ADR 034) → cookie sur l'hôte du lien → redirection `callbackURL`.
- Le défaut `verification.id` en `uuid` (relevé à la CI de s12d, qui cassait précisément ce chemin
  pour un compte non vérifié) est **corrigé sur main** : `verification.id` est `text`
  (`src/db/models/auth-model.ts:91-94`).

### Couche email

- Contrat `EmailTransport = {send(message)}` (`src/lib/emails/transport/email-transport.ts`) ;
  implémentations `brevo`, `resend`, `file`, `memory` choisies par `EMAIL_TRANSPORT`.
  **Le contrat n'expose aucun budget ni quota.**
- Point d'envoi unique `sendEmailService(payload, {recipientType})` (`src/services/email-service.ts:139`).
  `recipientType: 'system'` contourne les interrupteurs `app_settings` (`EMAIL_ENABLED…`) ; le lien
  magique l'utilise.
- `sendMagicLinkEmailService` (`email-service.ts:211`) : locale explicite, version texte complète,
  gabarit `MagicLinkMail`.
- Gabarit `src/lib/emails/magic-link-email.tsx` : en-tête teinté avec `AssociationHeader` (logo PNG
  36 px + nom), corps, bouton, URL en clair, pied transactionnel. Textes `email.user.magicLink` dans
  `messages/fr.json` — **rédigés pour une demande** (« Vous n'avez pas demandé ce lien ? »,
  « parce qu'une connexion a été demandée », « valable 20 minutes »). `AssociationHeader` est une
  fonction **privée** du fichier, **dupliquée** dans `contact-message-email.tsx:340` et
  `incident-report-email.tsx:341`.

### Budget quotidien d'envoi (plafond Brevo 300/jour)

- **N'existe pas.** Aucune table, aucun compteur, aucune méthode de contrat (recherche de
  `budget|quota|daily` dans `src/`). La seule table de compteurs est `rate_limit_event` (limitation de
  débit : liens par adresse et par jour, formulaires publics par heure), qui n'est pas un budget
  d'envoi.
- **Propriétaire : s26** (`docs/stories.md:438` dans s03 : « Le budget quotidien par association
  appartient à s26 : ne pas l'anticiper » ; critères de s26 l. 2093-2094 : décompté dans l'adaptateur
  par **tout** email sortant, report au lendemain). ADR 005 cite les invitations (s15) parmi les
  émetteurs décomptés ; ADR 017 note que le budget est celui du compte Brevo.

### Paramètres d'association (ADR 010, ADR 016)

- Registre en code `ASSOCIATION_SETTINGS_REGISTRY`
  (`src/services/types/domain/association-settings-types.ts:202`), valeurs dans
  `organization_setting`. Le type **`text`** existe déjà (`maxLength`, `multiline`, `format?`), utilisé
  par `association.description` (multiline, sans défaut, `whenEmptyKey`) et
  `search.google_verification`. La note de s02 « texte libre (s15) » est donc **déjà couverte** par s11.
- Défaut possible : `{value: string}` (brut, en code) ou `{fromKey}` ; `whenEmptyKey` affiche sous le
  champ vide une phrase qui dit la valeur par défaut.
- Pages : `'settings' | 'identity'` ; sections de la page Réglages : seulement `'seo'` (absente =
  carte des adresses de notification).
- Lecture : `getAssociationSettingsService(organizationId)` (`association-settings-service.ts:39`).

### Better Auth — plugin d'organisation

- `organization({invitationLimit: 10, membershipLimit: 10, sendInvitationEmail})` est toujours branché
  (`auth.ts:177-210`), lien construit sur `NEXT_PUBLIC_APP_URL/account/invitations/<id>` — écran
  **retiré par s46** (aucun fichier `*invitations*` sous `src/app`). Aucun appel
  `inviteMember`/`acceptInvitation` dans `src/`. Les notes de s46 (`stories.md:3292`) tranchent :
  « L'invitation de s15 est un lien magique, pas l'invitation d'organisation de Better Auth ».

## Anchor points

| Où                                                                                   | Ce que s15 y branche                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `member-profile-detail.tsx`, carte « Accès à l'espace membre » (`AccessState`)       | bouton « Envoyer l'invitation » / « Renvoyer », état (jamais / invité le / connecté le), refus `5`   |
| `bureau/proprietaires/actions.ts`                                                    | une nouvelle Server Action d'invitation, sur le patron des actions existantes                        |
| `member-profile-service.ts` (+ façade `member-profile-service-facade.ts`)            | un service d'invitation : autorisation `member.profile.manage`, `withTenant`, refus `mail_only`      |
| `member-account-service.ts` → `openMemberAccount`                                    | rouvrir le compte d'une fiche à adresse sans compte lié, si le plan le décide                        |
| `magic-link-integration.ts` → `sendMagicLink` / `magicLinkOptions`                   | le seul endroit où naît le lien ; distinguer l'invitation de la demande (par `metadata` ?)           |
| `email-service.ts` + `src/lib/emails/`                                               | un envoi et un gabarit d'invitation (en-tête au logo partagé avec le lien magique)                   |
| `association-settings-types.ts` (registre) + `messages/fr.json` (`AssociationSettings`) | la clé du texte de l'invitation                                                                      |
| `association-session-guard.ts` (hook `session.create.before`, plugin en tête)        | candidat pour enregistrer la première connexion réussie (seul point traversé par les quatre modes) |
| `src/db/models/member-profile-model.ts` (ou nouvelle table)                          | persistance de « invité le » et « connecté le » — via `pnpm db:generate`                             |
| `src/db/scripts/seed.ts`                                                             | données d'e2e (fiche invitée, fiche connectée) si les tests en dépendent                             |

## Verified APIs / functions

| Nom                                              | Signature / comportement vérifié                                                                                                                                       | Emplacement                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `openMemberAccount`                              | `({organizationId, memberProfileId, email, name}) => Promise<{userId}>` ; rouvre `withTenant` ; email en minuscules ; pose `member` si absente ; écrit `user_id`        | `src/services/member-account-service.ts:96`                         |
| `openMemberAccountsForOrganization`              | `(organizationId) => Promise<{opened}>` ; idempotente ; pour seed et s13                                                                                                | `member-account-service.ts:226`                                     |
| `getLinkedAccountRole`                           | `(organizationId, userId \| null) => Promise<role \| null>`                                                                                                            | `member-account-service.ts:163`                                     |
| `getMemberAccountDao`                            | `(userId, organizationId) => Promise<{email, role} \| undefined>` (jointure `member`/`user`)                                                                           | `src/db/repositories/organization-repository.ts:531`                |
| `getMemberProfileByIdDao`                        | `(memberProfileId) => Promise<MemberProfileModel \| undefined>` ; à appeler sous `withTenant`                                                                          | `src/db/repositories/member-profile-repository.ts:117`              |
| `setMemberProfileUserIdDao`                      | `(memberProfileId, userId \| null) => Promise<void>`                                                                                                                   | `member-profile-repository.ts:255`                                  |
| `canReadMemberAccount`                           | `(user, organizationId) => boolean` = `member.profile.manage`                                                                                                          | `src/services/authorization/member-account-authorization.ts`        |
| `canPerformAction`                               | `(user \| undefined, organizationId, actionId) => boolean` ; SuperAdmin toujours vrai                                                                                 | `src/services/authorization/action-registry-authorization.ts`       |
| `ActionIdConst.MEMBER_PROFILE_MANAGE`            | `'member.profile.manage'`, rôles `owner`, `board`                                                                                                                      | `src/services/types/domain/action-registry-types.ts:107`            |
| `auth.api.signInMagicLink`                       | `{headers, body: {email, name?, callbackURL?, newUserCallbackURL?, errorCallbackURL?, metadata?}}` ; **`requireHeaders: true`** ; rend `{status: true}` quoi qu'il arrive dans `sendMagicLink` | `node_modules/better-auth/dist/plugins/magic-link/index.mjs:12-19, 58-100` |
| `sendMagicLink`                                  | `({email, url, token?, metadata?}, ctx?)` ; association par l'**hôte de la requête** ; trois `return` silencieux (pas d'association, quota, non-membre)               | `src/lib/better-auth/magic-link-integration.ts:148`                 |
| `revokeEarlierMagicLinks` (privée)               | supprime les `verification` de `value = JSON.stringify({email})` sauf le jeton courant                                                                                | `magic-link-integration.ts:116`                                     |
| `associationOriginOf`                            | `(domain, platformUrl = env.BETTER_AUTH_URL) => string \| undefined` ; sans en-tête, utilisable hors requête                                                         | `src/lib/better-auth/association-origin.ts:25`                      |
| `rebaseMagicLinkUrl`                             | `(url, origin) => string` ; garde chemin + jeton, rend absolus les `callbackURL`                                                                                       | `association-origin.ts:56`                                          |
| `canOpenSessionOn`, `organizationOfRequest`      | règle unique d'ouverture (SuperAdmin ou ligne `member`) ; association d'un hôte (façade chargée à l'appel)                                                            | `src/lib/better-auth/association-membership.ts`                     |
| `associationSessionGuard`                        | plugin local, hook `databaseHooks.session.create.before(session, context)` ; refus = `false`                                                                          | `src/lib/better-auth/association-session-guard.ts`                  |
| `MAGIC_LINK_EXPIRES_IN_SECONDS` / `_MINUTES`     | `1200` / `20`                                                                                                                                                          | `src/lib/better-auth/magic-link-constants.ts`                       |
| `consumeMagicLinkRequestQuotaService`            | `({organizationId, email}) => Promise<{allowed}>` ; sans autorisation (visiteur anonyme)                                                                              | `src/services/rate-limit-service.ts:139`                            |
| `sendEmailService`                               | `(payload: {to, subject, text, from?, react?}, {recipientType?})` ; point d'envoi unique                                                                              | `src/services/email-service.ts:139`                                 |
| `sendMagicLinkEmailService`                      | `({email, url, association: MagicLinkEmailAssociation, locale})`                                                                                                       | `email-service.ts:211`                                              |
| `MagicLinkEmailAssociation`                      | `{name, logoUrl?, hue: AccentHue}`                                                                                                                                     | `src/lib/emails/magic-link-email.tsx:23`                            |
| `getAssociationSettingsService`                  | `(organizationId)` → réglages résolus ; `getAccentHue(settings)` pour la teinte                                                                                        | `src/services/association-settings-service.ts:39`                   |
| `TextSettingDefinition`                          | `{type: 'text', maxLength, multiline, format?}` + base (`default?`, `labelKey`, `helpKey`, `whenEmptyKey?`, `page`, `section?`)                                      | `association-settings-types.ts:74`                                  |
| `requireCurrentTenantDal`                        | `() => Promise<TenantDTO>` (`{id, name, slug, domain, enabledModules, logoKey, faviconKey}`)                                                                          | `src/app/dal/tenant-dal.ts:93`                                      |
| `requireActionAuth`                              | `cache(async (options?) => User)`, lève `AuthorizationError` sans session                                                                                              | `src/app/dal/user-dal.ts:47`                                        |
| `formatContentDate`                              | `(isoDate, locale = 'fr-FR')` → « 3 février 1998 », **en UTC**                                                                                                        | `src/lib/cms/format-content-date.ts:10`                             |
| `/login/destination`                             | Route Handler 307 vers `getPostLoginPathDal()` ; emprunté par lien magique, OTP/TOTP, vérification d'email — **pas** par la connexion par mot de passe              | `src/app/[locale]/(auth)/login/destination/route.ts`                |

Colonnes vérifiées : `user` n'a **aucun** `lastLoginAt` (`auth-model.ts:25-39`) ; `session` a
`createdAt`, `impersonatedBy`, `activeOrganizationId`, **pas d'association** ; `verification` :
`id text`, `identifier`, `value`, `expiresAt`.

## Traps & constraints

**Générer le lien sans le réimplémenter**

- **`sendMagicLink` ne rend rien à l'appelant.** `signInMagicLink` répond `{status: true}` même
  quand le callback a renoncé (pas d'association, quota atteint, compte non membre). Une invitation
  doit savoir si elle est partie, pour écrire « invité le » et pour afficher un échec au bureau. En
  l'état, rien ne le permet : il faudra un chemin d'invitation dans le callback, qui lève au lieu de
  rendre silencieusement.
- **Le quota par adresse (3/jour) s'appliquerait à l'invitation** si elle passe par `sendMagicLink`
  tel quel : le bureau ne pourrait réinviter que trois fois par jour, et chaque invitation
  consommerait une des demandes du membre lui-même. Ce quota protège un formulaire anonyme ; il n'a
  pas de sens pour un geste authentifié du bureau.
- **L'association vient de l'hôte de la requête**, pas de la fiche. Depuis `/bureau` c'est le même
  domaine (le back-office n'est servi que sur le domaine de l'association : `requireCurrentTenantDal`
  rend introuvable ailleurs). Mais s42 enverra **hors requête**, et `signInMagicLink` exige des
  en-têtes (`requireHeaders: true`). Le chemin d'invitation devrait prendre l'association **en
  paramètre** (lue en base, ADR 022) plutôt que de la déduire de l'hôte, pour que s42 le réutilise.
- **Le gabarit change, le lien non.** `sendMagicLink` envoie toujours `MagicLinkMail`. L'invitation
  doit passer par le même jeton, la même révocation et le même rebasage, mais un autre gabarit. Le
  callback reçoit `metadata` intact depuis `signInMagicLink` : c'est le canal disponible pour dire
  « invitation » (aujourd'hui seule `metadata.locale` y circule).
- **Révocation et forme de `value`.** `revokeEarlierMagicLinks` cible `JSON.stringify({email})` : si
  l'invitation passe un `name` au plugin, ou une adresse de casse différente, la valeur diffère et
  l'ancien lien **survit** (contre le critère 6). Envoyer l'adresse **du compte** (`user.email`, déjà
  en minuscules), pas celle de la fiche saisie avec sa casse. Corollaire voulu ou non : une
  invitation révoque un lien que le membre aurait demandé lui-même, et inversement.
- **Durée de vie : 20 minutes, globale.** `opts.expiresIn` est lu une fois pour toutes ; le plugin
  n'offre aucune surcharge par appel. Une invitation lue le soir pour un email reçu le matin sera
  expirée — pour le public que le PRD décrit comme âgé, c'est un vrai risque produit (voir questions).
  Prolonger la seule invitation demanderait de toucher la ligne `verification` après création (par
  l'adaptateur du contexte, comme le fait déjà `revokeEarlierMagicLinks`) : décision structurante,
  à motiver dans un ADR.
- **Cycle d'imports.** `auth.ts` importe `magic-link-integration.ts` ; les façades y sont chargées par
  `import()` dynamique (`loadServices`) pour ne pas fermer `auth.ts → façade → service → auth-service
  → auth.ts`. Garde : `magic-link-integration-imports.test.ts` parcourt le graphe. Tout nouvel import
  de service depuis ce module (ou depuis le plugin de session) doit suivre ce patron.
- **Le plugin d'organisation de Better Auth n'est pas une option** : lien sur `NEXT_PUBLIC_APP_URL`,
  écran d'acceptation retiré par s46, `membershipLimit: 10`, crée la ligne `member` (déjà créée par
  s12d). Ne pas l'utiliser, ni s'en inspirer.

**État « invité » / « connecté au moins une fois »**

- **Rien ne le stocke aujourd'hui.** Les lignes `verification` disparaissent à la consommation ou à
  la révocation ; `session` n'a pas d'association et ses lignes partent à la déconnexion et à
  l'expiration ; `user` n'a pas de date de connexion. Une persistance nouvelle est nécessaire
  (migration générée par `pnpm db:generate`, jamais écrite à la main).
- **Par association, pas par compte.** Un même `user` peut être membre de deux associations (ADR 037).
  « Connecté au moins une fois » sur la fiche de A ne doit pas devenir vrai parce qu'il s'est connecté
  sur B. `emailVerified` est donc un mauvais indicateur : global, sans date, et posé aussi par la
  vérification d'email.
- **Point d'enregistrement de la première connexion.** Seul le hook de création de session est
  traversé par les quatre modes (ADR 034) et connaît l'association (en-têtes). `/login/destination`
  n'est pas emprunté par la connexion par mot de passe. Dans ce hook : la session n'existe pas encore
  au `before` (un `after` serait plus juste) ; **l'imitation** crée aussi une session
  (`impersonatedBy`) et ne doit pas compter ; l'écriture vise une table sous RLS forcée, donc dans
  `withTenant(organizationId, …)`, avec la façade chargée à l'appel (cycle ci-dessus).
- **Pas d'historique antérieur.** Les membres déjà connectés avant s15 (comptes du seed, bureau)
  n'ont aucune trace : l'état partira de « jamais invité » pour eux tant qu'ils ne se reconnectent pas.
- **Fiche dont l'adresse change** (`replaceMemberAccount` relie la fiche à un autre `user`) : l'état
  de l'invitation porte-t-il sur la fiche ou sur le compte ? À trancher (voir questions).
- **Dates** : `formatContentDate` formate en **UTC** ; une invitation envoyée à 0 h 30 heure de Paris
  s'afficherait la veille. Le dépôt a `calendarDayOf` (jour calendaire de Paris,
  `water-analysis-types.ts:155`).

**Refus et autorisation**

- **Critère 5** : « courrier uniquement » = `member_profile.mail_only` (colonne générée). Ne pas se
  fier à `MemberProfileAccountDTO.status === 'mail_only'`, qui vaut aussi pour une fiche avec email
  sans compte lié. Refus métier lisible (résultat typé, message `messages/fr.json`), pas une exception.
- **Fiche à adresse sans compte lié** (cas `unlink` de `decideMemberAccount`, ou ligne `member`
  retirée ailleurs) : l'invitation échouerait au contrôle `canOpenSessionOn`. Le service peut rouvrir
  le compte par `openMemberAccount` avant d'inviter, ou refuser : à trancher au plan.
- **Critère 7** : toute nouvelle lecture de `member` porte son `can*` (ADR 014) ; l'isolation se
  prouve en **e2e** (la RLS n'est pas testable en unitaire, `db.ts` refuse toute connexion en test).
  `getMemberProfileByIdDao` sous `withTenant` ne rend rien pour une fiche d'une autre association.
- **Fiche d'un membre du bureau** : elle a un compte `board`/`owner`. L'inviter est possible et sans
  effet sur le rôle ; aucun critère ne l'exclut.

**Email, budget, paramètres**

- **Budget quotidien : absent, propriété de s26.** s15 n'en pose rien (comme s03). Mais elle doit
  envoyer par `sendEmailService` → `getEmailTransport().send`, le point unique que s26 instrumentera,
  sans aucun appel direct à un fournisseur (ADR 017 : défaut de revue). Conséquence assumée d'ici s26 :
  rien n'empêche le bureau de dépasser 300 envois/jour à coups de clics unitaires.
- **`recipientType`** : le lien magique est `'system'` (jamais coupé par les interrupteurs
  `app_settings`). L'invitation doit sans doute l'être aussi, sinon `EMAIL_ENABLED_FOR_CLIENTS` la
  coupe en silence.
- **Locale** : dans une Server Action, next-intl ne lit que le cookie `NEXT_LOCALE` ; passer la locale
  explicitement (ADR 008 : `fr` seule), comme `sendMagicLinkEmailService`.
- **En-tête au logo** : à réutiliser, pas à recopier une quatrième fois (`AssociationHeader` existe
  déjà en trois exemplaires privés). Logo montré **seulement en PNG** (`pngLogoUrlOf`, design system
  §1.8, §5.2), nom seul sinon.
- **Texte de tenant** : le type `text` multiligne existe ; reste la clé, sa longueur, sa section dans
  « Réglages », et la source du **texte par défaut**. Un défaut `{value: '…'}` est une chaîne
  française en code ; l'ADR 010 veut des défauts « neutres », et les libellés vivent dans
  `messages/fr.json`. Le texte saisi par le bureau doit être rendu **comme texte** (échappé par
  React Email), jamais comme HTML.
- **Le lien n'est pas journalisé** (secret à usage unique) : ni l'URL ni le jeton dans un `logger`,
  et l'intercepteur de façade ne doit pas en logger les arguments.
- **Contradiction de documents à lever en design** : `docs/design-system.md` §5.5 classe
  « Invitation initiale » en nature **statutaire** (trois étapes numérotées, « aucun mot de passe »,
  téléphone du bureau), alors que la story impose un email **transactionnel** sans habillage de
  campagne. Le tableau décrit vraisemblablement l'envoi de lancement de s42. Le « téléphone du
  bureau » n'existe dans aucun paramètre du registre.

**Tests existants à ne pas casser**

- Unitaires : `magic-link-integration.real-i18n.test.ts`, `magic-link-integration-imports.test.ts`,
  `association-session-guard.test.ts`, `src/services/__tests__/member-account-service.test.ts`,
  `member-profile-detail.test.tsx`, `proprietaires/actions.test.ts`, `proprietaires/[id]/page.test.tsx`,
  `magic-link-email.real-i18n.test.tsx`.
- e2e : `e2e/magic-link.spec.ts`, `e2e/member-accounts.spec.ts` (connexion d'un compte non vérifié
  par lien, deux domaines), `e2e/member-profiles.spec.ts`, `e2e/tenant-isolation.spec.ts`. Les specs
  lisent les emails dans la boîte du transport `file` (`EMAIL_OUTBOX_DIR`, patron `contact.spec.ts:76`).
  e2e en CI seulement (machine locale trop juste) ; unitaires avec `pnpm test --run`.

## Open questions

1. **Durée de validité du lien d'invitation (produit, avant design).** Le lien magique vaut 20 minutes,
   réglage global de Better Auth sans surcharge par appel. Une invitation doit-elle garder ces
   20 minutes (le membre redemande ensuite un lien depuis la page de connexion), ou valoir plus
   longtemps (combien ?) ? Prolonger impose de modifier la ligne `verification` après sa création :
   décision à porter dans un ADR.
2. **Le quota « 3 liens par adresse et par jour » s'applique-t-il aux invitations ?** Recommandation
   de la recherche : non (geste authentifié du bureau). Faut-il alors une autre limite contre les
   clics répétés, ou rien jusqu'au budget de s26 ?
3. **Texte par défaut de l'invitation** : où vit-il (défaut du registre en code, `messages/fr.json`
   avec `whenEmptyKey`, ou valeur de seed par tenant) ? Le texte paramétrable est-il **tout** le corps,
   ou un paragraphe inséré dans un gabarit fixe (titre, bouton, URL en clair, durée, pied) ? Peut-il
   contenir des variables (`{nom_association}`, prénom/nom) ? Longueur maximale ?
4. **Contenu de l'email** : le design system (§5.5) décrit une « Invitation initiale » statutaire avec
   trois étapes et le téléphone du bureau ; la story veut un transactionnel. Lequel vaut pour s15 ? Si
   le téléphone du bureau doit y figurer, il n'existe aucun paramètre pour lui.
5. **État de l'invitation : fiche ou compte ?** Quand l'adresse d'une fiche change (compte remplacé),
   l'état « invité le » / « connecté le » repart-il de zéro ? Et une fiche dont l'adresse est retirée
   puis remise ?
6. **« Connecté au moins une fois » prime-t-il sur « invité le »** quand le membre s'est connecté de
   lui-même sans invitation ? Et pour les comptes déjà connectés avant s15 (bureau, seed), pour
   lesquels aucune trace n'existe : afficher « jamais invité » est-il acceptable ?
7. **Fiche avec adresse mais sans compte lié** au moment d'inviter : rouvrir le compte
   (`openMemberAccount`) puis inviter, ou refuser avec un message ?
8. **Lien et destination** : après ouverture, la destination reste-t-elle `/login/destination`
   (« Mes parcelles » pour un membre) ? Quelle page d'erreur pour une invitation expirée ou déjà
   utilisée — l'écran `/login/lien-invalide` de s03 suffit-il, avec un message adapté à une
   invitation ?
9. **Envoi hors requête pour s42** : faut-il dès s15 concevoir le chemin d'invitation pour qu'il
   fonctionne sans requête (association passée en paramètre, en-têtes synthétiques pour
   `signInMagicLink`), ou s42 s'en chargera-t-elle ? Recommandation : dès s15, puisque s42 « ne
   régénère pas le lien ».
10. **Visibilité de l'état dans la liste des propriétaires** : le critère 4 ne parle que de la fiche ;
    s42 voudra mesurer l'adoption. Afficher l'état en liste est-il dans le périmètre ? (Recommandation :
    non, fiche seulement.)
