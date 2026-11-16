# Research — Story s54-adresses-email-multiples

## Target story

**En tant que** membre du bureau **je veux** qu'un membre puisse avoir plusieurs adresses email, dont
chacune permet de se connecter **afin que** les enfants d'un propriétaire âgé gèrent son espace avec leur
propre adresse. Complexité 4. Dépendances : s03, s12d, s16, s25, s26, s53 (toutes mergées sur `main`, s53
en #70).

Critères d'acceptation (docs/stories.md, l. 4006), résumés :

1. Une fiche porte une ou plusieurs adresses ; chaque adresse **active** se connecte et ouvre le même espace.
2. Toutes les adresses actives se connectent, sans paramètre de coupure. Adresse **titulaire** = celle déjà
   reliée à un compte avant la story, ou la première saisie/importée d'une fiche nouvelle ; les autres sont
   **supplémentaires**, mêmes droits dans l'espace. Vérifié sur une fiche à deux adresses.
3. Campagnes (s25, s26) et emails déjà émis vers un membre : à **toutes** les adresses actives de la fiche.
4. Depuis son espace, une personne connectée **ajoute** des adresses (supplémentaires), **ne modifie que la
   sienne**, ne retire pas la sienne (elle le demande au bureau). Elle annule ou corrige une adresse qu'elle
   a ajoutée tant qu'elle n'est pas confirmée ; expiration après un délai **paramétré du tenant** (seed :
   7 jours). Le bureau ajoute, modifie, supprime toutes les adresses. Test d'autorisation sur l'appel
   serveur direct : supplémentaire → titulaire refusé, et l'inverse.
5. Adresse **active d'office** si elle vient du fichier (s13, s56) ou est saisie par le bureau. Ajoutée **ou
   modifiée** par le membre : active seulement après **confirmation par lien** envoyé à cette adresse ;
   pendant la confirmation d'une modification, l'ancienne reste active. Une adresse non active ne reçoit
   rien et ne se connecte pas.
6. **Non-régression** : toutes les adresses présentes à la livraison sont actives et titulaires. Un membre
   connecté avant se connecte encore et reçoit les campagnes (fiche + compte créés avant la migration).
7. Le membre ne peut pas ajouter une adresse déjà portée par une fiche de l'association **non reliée à son
   compte** : refus explicite (« adressez-vous au bureau »). Seul le bureau relie, par la confirmation de
   s53. Aucun compte fusionné.
8. **Rôle propre à chaque fiche** : une adresse sur plusieurs fiches a un rôle sur chacune. Le bureau qui
   ajoute une adresse déjà portée par une autre fiche choisit son rôle sur la fiche visée ; l'import applique
   la règle de la cellule. Testé : titulaire d'une fiche, supplémentaire d'une autre.
9. **Succession de la titulaire** : une fiche à au moins une adresse active a **exactement une** titulaire.
   Modifier/remplacer la titulaire (bureau, s56, ou la titulaire elle-même après confirmation) transfère le
   titre. Le bureau ne supprime la titulaire qu'en désignant la remplaçante dans la même opération (nouvelle
   adresse saisie, ou adresse active choisie) ; sans remplaçante, refus — sauf dernière adresse active : la
   fiche repasse « courrier uniquement » (s12d). Fiche sans adresse active qui en reçoit une → titulaire. Le
   bureau peut désigner une autre adresse active comme titulaire (l'ancienne devient supplémentaire). Aucune
   promotion d'office (sauf s56). Création par import : première adresse de la cellule titulaire ; fiche
   existante : l'ordre de la cellule ne déplace pas le titre. Chaque cas testé.
10. Retirer une adresse d'une fiche ferme son accès **à cette fiche** à la requête suivante (ADR 038), sans
    toucher les autres adresses ni l'historique ; ses autres fiches restent ouvertes (s53).
11. L'import de s13 reprend **toutes** les adresses d'une cellule ; la remarque « adresse ignorée » disparaît.
12. Les adresses s'affichent dans la fiche du bureau, avec leur **origine** (fichier Pennylane / saisie sur
    le site).

Notes : deux nouveaux ADR (l'ADR 040 et l'unicité `(member_profile_id)` de l'ADR 054 sont remis en cause,
sans modifier les anciens) ; la cible des campagnes s'étend (une fiche vaut N destinataires, le budget s52
compte des adresses) ; revoir la durée d'étalement affichée par s26 ; la confirmation par lien est un
critère de **sécurité** ; déclarer les colonnes à l'inventaire de s12c et à l'export de s38.

## Current state of the code

### L'adresse est **une colonne** de la fiche

`src/db/models/member-profile-model.ts` : `member_profile.email` (text, nullable, **non unique** depuis
s53), `mail_only` **générée** (`"email" IS NULL`), index non unique `member_profile_organization_email_idx`
`(organization_id, lower(email)) WHERE email IS NOT NULL`. Une colonne générée Postgres ne peut pas lire une
autre table : si les adresses passent dans une table, `mail_only` ne peut plus rester générée sur
`member_profile.email` sans que cette colonne reste synchronisée.

### Lien fiche ↔ compte (s53, ADR 054)

`src/db/models/member-profile-account-model.ts` : `member_profile_account (id, organization_id,
member_profile_id, user_id, created_at)`, RLS forcée (`0055_member_profile_account_rls.sql`),
**`uniqueIndex('member_profile_account_profile_idx').on(memberProfileId)`** — une fiche a au plus un compte
(« s54 lèvera cette contrainte par son propre ADR »). Index `(organization_id, user_id)`. Dernière
migration : `0056_brainy_stephen_strange.sql`.

Repository (`src/db/repositories/member-profile-repository.ts`, 474 l.) :
`linkMemberProfileAccountDao({organizationId, memberProfileId, userId})` (l. 305),
`unlinkMemberProfileAccountDao(memberProfileId)` (l. 320 — **délie par fiche**, donc tous ses comptes si la
contrainte est levée), `countLinkedProfilesDao(organizationId, userId)` (l. 329),
`getUnlinkedMemberProfilesWithEmailDao` (l. 346), `getMemberProfilesByUserIdDao` (l. 391),
`updateMyMemberProfilesContactDao` (l. 431, s16 + s53 : écrit toutes les fiches du compte, jamais l'email),
`getMemberProfilesByEmailDao(organizationId, email)` (l. 129, toutes les fiches d'une adresse),
`getMemberProfileByPennylaneIdDao` (l. 460). Le type `MemberProfileWithAccountRow` porte **un** `userId`.

### Compte (`src/services/member-account-service.ts`, 413 l.)

- `openMemberAccount({organizationId, memberProfileId, email, name})` : `findOrCreateUserId` (adresse en
  minuscules, `getUserByEmailDao` / `createUserIfAbsentTxnDao`) puis `linkToAccount`
  (`createMemberIfAbsentTxnDao` rôle `member` + `linkMemberProfileAccountDao`).
- `closeMemberAccount({organizationId, memberProfileId, userId})` : `unlinkMemberProfileAccountDao(
  memberProfileId)` puis retire la ligne `member` si `countLinkedProfilesDao === 0`. **À rendre ciblé sur
  `(fiche, compte)`** : délier par fiche couperait toutes les adresses de la fiche (critère 10).
- `replaceMemberAccount({…, previousUserId, author, targetUserId?})` : verrou des rôles
  (`lockOrganizationRolesDao`), déplacement du rôle bureau si dernière fiche, traces `email_change`
  (`insertMemberRoleEventDao`, ADR 039).
- `applyMemberAccountDecision({organizationId, author, profile: {id, name, email, userId}, decision})` :
  pilote `open` / `link_shared` / `close` / `unlink` / `replace` à partir d'**une** adresse et d'**un**
  compte.
- `getMyMemberProfiles(organizationId, userId)` (ordre ADR 054 §7, `orderMyProfiles`,
  `src/services/rules/my-profiles-order-rules.ts`) et `getFirstMemberProfile`.

Règle pure `decideMemberAccount({savedEmail, nextEmail, linkedRole, otherLinkedProfiles,
nextEmailAccountUserId})` (`src/services/rules/member-account-rules.ts`, 54 l.) ; `sameEmail(a, b)`.
Raisonne sur une adresse unique de la fiche.

### Écriture du bureau (`src/services/member-profile-service.ts`, 506 l.)

- `createMemberProfileService` / `updateMemberProfileContactService` : validation, `requireMemberProfileManager`
  (`ActionIdConst.MEMBER_PROFILE_MANAGE`), `authorOf` (lu **avant** `withTenant`, s48), `findEmailHolder`
  + `confirmedHolder` (statut `email_shared` avec `MemberAccountHolderDTO`, confirmation revérifiée par
  `confirmedAccountUserId`, s53), `decideMemberAccount` → `refuse_board_removal` →
  `board_email_required`, puis `applyMemberAccountDecision`.
- `readAccount` / `toProfileWithAccount` : carte « Accès à l'espace membre » —
  `MemberProfileAccountDTO = {status:'open', loginEmail, boardRole, accountName, otherProfiles} |
  {status:'mail_only'}` (`src/services/types/domain/member-profile-types.ts`) : **un** compte par fiche.
- `roleCardOf` : `isSelf = authUser.id === row.userId` — un seul compte par fiche.
- Écrans : `src/components/features/member-profile/member-profile-form.tsx` (création),
  `member-profile-detail.tsx` (modification ; `profile.mailOnly`, l. 229), `member-contact-fields.tsx`,
  `member-profile-form-validation.ts`, `member-profile-list.tsx` (`mailOnly`, `incomplete`,
  `accountProfileCount`) ; actions `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` et `[id]`.

### Espace membre (s12d, s16, s53)

`src/services/member-space-service.ts` (226 l.) : `getMyLandsService`, `getMyContactService` (rend
`email: first.email` — l'adresse de la **fiche**, pas celle de la personne connectée),
`updateMyContactService` (cinq colonnes postales/téléphoniques, ADR 040 — « l'email reste un texte,
jamais un champ »). Composant `src/components/features/member-space/my-contact-card.tsx` (`MyContactCard`,
ancre `mes-coordonnees`). Page `src/app/[locale]/(app)/dashboard/page.tsx`, DAL
`src/app/dal/member-space-dal.ts`.

### Session et connexion

- Connexion : Better Auth, plugin `magicLink` (`src/lib/better-auth/auth.ts`, l. 179) + mot de passe.
  `canOpenSessionOn` (`src/lib/better-auth/association-membership.ts`, l. 43) et la relecture à chaque
  requête (ADR 038) reposent sur la **ligne `member`** du compte, pas sur la fiche. Une adresse
  supplémentaire ouvre donc l'espace dès qu'elle a son `user`, sa ligne `member` et son lien
  `member_profile_account` — le mécanisme de s53 suffit, sans changer la session.
- Changement d'adresse Better Auth (`changeEmail`) fermé définitivement (ADR 040) — ne réécrit pas les
  fiches, à ne pas rouvrir : la modification par le membre passe par la fiche.

### Campagnes (s25, s26, s53 — ADR 051, 055)

- `getCampaignTargetRowsDao` (`src/db/repositories/campaign-repository.ts`, l. 120) : une ligne **par
  fiche** (`memberProfileId`, `name`, `email: memberProfile.email`, `unsubscribed`, `accountName` via
  `member_profile_account` → `user`, `currentParcelNumbers`). La jointure sur `member_profile_account`
  **multiplie les lignes** dès qu'une fiche a deux comptes.
- `computeCampaignTarget` (`src/services/rules/campaign-rules.ts`, l. 120) : groupe par adresse, un
  destinataire par adresse porté par la première fiche (`carrierOf`), un groupe dont une fiche est
  désinscrite est désinscrit. `sameAddressRowsOf`, `addressValuesOf` (`{nom}` = nom du compte si plusieurs
  fiches).
- `campaign_recipient` (`src/db/models/campaign-model.ts`, l. 156) : `member_profile_id`, `part_id`,
  `status`, `unsubscribe_token` ; **aucune colonne d'adresse** : `getPendingPartRecipientsDao` (l. 384)
  relit `memberProfile.email` à la livraison. Avec N adresses par fiche, l'adresse d'envoi doit être portée
  par la ligne (ou par une référence à l'adresse).
- `member_unsubscribe` : une ligne par fiche ; `getMemberProfileIdsSharingEmailDao`
  (`member-unsubscribe-repository.ts`, l. 80) étend la désinscription à toutes les fiches de **la même
  adresse** par égalité sur `memberProfile.email`.
- Budget d'envoi (s52, ADR 053) : natures `TENANT_EMAIL_NATURES = ['login', 'campaign',
  'board_notification']` (`src/services/types/domain/email-send-types.ts`) — « s29 et s42 y ajoutent la
  leur ». Le lien de confirmation d'une adresse est un envoi d'association : il doit décompter le budget
  (nature à choisir).
- Variables : `CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date']`.
- Étalement affiché (s26) : calculé à partir du nombre de destinataires de la cible ; il suivra le nouveau
  décompte en adresses si le décompte passe par `computeCampaignTarget`.

### Autres envois vers un membre

Hors campagnes et lien de connexion, **aucun** email n'est aujourd'hui émis vers un membre : les
notifications de s10/s22/s23 vont au bureau (`sendIncidentReportNotificationEmailService`,
`sendMemberQuestionNotificationEmailService`, `src/services/email-service.ts`), et s29 (relances) et s42
(invitations) ne sont pas livrées (`git log` : aucun `feat(s29)` ni `feat(s42)`). Le critère 3 se réduit
donc aux campagnes. Deux lecteurs copient pourtant `profile.email` comme **adresse de la personne** :

- `member-question-service.ts` l. 159 / 290 : `memberEmail` = adresse de la fiche → `replyTo` de la
  notification au bureau (`email-service.ts` l. 1216-1233) ;
- `incident-report-service.ts` l. 502 / 571 : `reporterEmail` = adresse de la fiche.

Avec un proche connecté, c'est l'adresse de **la personne connectée** qu'il faut copier (sinon le bureau
répond au parent au lieu du proche).

### Import (s13, ADR 047, 048)

`src/lib/import/pennylane-clients-mapper.ts` : `firstEmail(emails)` (l. 106) garde la première adresse
(`EMAIL_SEPARATOR`) et pose la remarque `ImportRemarkConst.SEVERAL_EMAILS` (l. 168). Les rejets
`NO_CONTACT` regardent la cellule entière. `member-import-service.ts` (343 l.) : `member.email` (l. 107),
regroupement par adresse (l. 208, `email?.trim().toLowerCase()`), `mailOnly` au rapport (l. 129, 182,
257). Fixtures `e2e/fixtures/member-import-fictif.csv` et celle de s53 ; le fichier réel est **hors git**.

### Paramètres du tenant (ADR 010)

Registre `src/services/types/domain/association-settings-types.ts` : définitions typées (`number` avec
`unitKey`, sections `'seo' | 'legal' | 'sending'`), clés exportées (`CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY`,
`EMAIL_DAILY_SEND_LIMIT_SETTING_KEY`, …) ; service `association-settings-service.ts`. Le délai d'expiration
(seed 7 jours) s'y ajoute comme clé `number`, jamais en constante.

### Pages publiques à jeton

`src/app/[locale]/(public)/desinscription/[jeton]` : patron d'une page publique pilotée par un jeton
(`randomBytes(UNSUBSCRIBE_TOKEN_BYTES).toString('base64url')`, `campaign-service.ts` l. 394). Réutilisable
pour la page de confirmation d'une adresse.

### Autres lecteurs de l'adresse

`isIncomplete` (`src/services/rules/parcel-ownership-rules.ts`, l. 110 : `email === null && …`),
`toMemberProfileDto` (`rules/member-profile-rules.ts`, l. 14-20), `getMemberProfilePageDao` (compte
`incomplete` sur `mailOnly`, l. 294), `member-question-repository.ts` l. 45 (`memberEmail`).

### Sauvegarde et export

s12c : `asl_backup` a `pg_read_all_data` ; une table nouvelle est couverte sans grant. Inventaire =
`docs/architecture.md`, « Classement RLS des 47 tables » (l. 355-358) + tableau des tables (l. 398 pour
`member_profile_account`, mention « s38 devra la déclarer »). s38 non livrée.

## Anchor points

- **Modèle** : nouvelle table d'adresses de fiche dans `src/db/models/` (+ `db.ts`), migration générée +
  migration RLS `--custom` (patron `0055`) + migration de données `--custom` (reprise : chaque
  `member_profile.email` non nul → une adresse active, titulaire, origine à déterminer) ;
  `member-profile-account-model.ts` (unicité `(member_profile_id)` → `(member_profile_id, user_id)`).
- **Compte** : `member-account-service.ts` (fermeture ciblée `(fiche, compte)`, ouverture par adresse),
  `rules/member-account-rules.ts` (décision par adresse), nouvelle règle pure de succession de la titulaire.
- **Bureau** : `member-profile-service.ts`, actions `bureau/proprietaires/*`, `member-profile-detail.tsx`,
  `member-profile-form.tsx`, `member-contact-fields.tsx` → liste des adresses (rôle, statut, origine).
- **Espace membre** : `member-space-service.ts`, `my-contact-card.tsx`, page `dashboard`, nouvelle action
  « ajouter / modifier mon adresse / annuler » ; page publique de confirmation (patron `desinscription`).
- **Envois** : `campaign-repository.ts` (`getCampaignTargetRowsDao`, `getPendingPartRecipientsDao`,
  `getAddressProfilesDao`), `campaign-rules.ts` (`computeCampaignTarget`), `campaign-model.ts`
  (`campaign_recipient`), `member-unsubscribe-repository.ts`, `email-send-types.ts` (nature du lien de
  confirmation).
- **Import** : `pennylane-clients-mapper.ts` (`firstEmail`, `SEVERAL_EMAILS`), `member-import-service.ts`,
  `member-import-types.ts`.
- **Paramètre** : `association-settings-types.ts` + registre + seed (`src/db/scripts/seed.ts`).
- **Copies d'adresse** : `member-question-service.ts`, `incident-report-service.ts`.
- **Docs** : deux ADR (numéros suivants : **056**, **057**), `docs/architecture.md` (tables, compteur 47 →
  48), `docs/design-system.md` §9 (la ligne « Changement d'adresse email par le membre » tranchée par
  l'ADR 040 est remise en cause).

## Verified APIs / functions

- `getDb()` / `withTenant(organizationId, fn)` : `src/db/tenant-scope.ts`.
- `openMemberAccount(input): Promise<{userId}>`, `closeMemberAccount({organizationId, memberProfileId,
  userId}): Promise<void>`, `replaceMemberAccount(input & {previousUserId, author, targetUserId?})`,
  `applyMemberAccountDecision({organizationId, author, profile, decision})`,
  `openMemberAccountsForOrganization(organizationId)`, `unlinkMemberAccount`, `getMyMemberProfiles`,
  `getFirstMemberProfile` — `src/services/member-account-service.ts`.
- `decideMemberAccount(input): MemberAccountDecision`, `sameEmail(a, b)` — `rules/member-account-rules.ts`.
- `linkMemberProfileAccountDao`, `unlinkMemberProfileAccountDao(memberProfileId)`,
  `countLinkedProfilesDao(organizationId, userId)`, `getMemberProfilesByEmailDao(organizationId, email)`,
  `getMemberProfilesByUserIdDao`, `updateMyMemberProfilesContactDao` — `member-profile-repository.ts`.
- `createMemberIfAbsentTxnDao`, `deleteMemberWithRoleDao(userId, organizationId, role)`,
  `getUserOrganizationDao`, `lockOrganizationRolesDao`, `updateMemberRoleFromDao` —
  `organization-repository.ts` ; `getUserByEmailDao`, `createUserIfAbsentTxnDao` — `user-repository.ts`.
- `computeCampaignTarget<Row>(rows) → {recipients, withoutEmail, unsubscribed}`, `sameAddressRowsOf`,
  `addressValuesOf` — `rules/campaign-rules.ts`.
- `getCampaignTargetRowsDao(organizationId)`, `getPendingPartRecipientsDao(partId)` —
  `campaign-repository.ts` ; `getMemberProfileIdsSharingEmailDao(organizationId, memberProfileId)` —
  `member-unsubscribe-repository.ts`.
- `canOpenSessionOn(user, organization)` — `src/lib/better-auth/association-membership.ts`.
- `TENANT_EMAIL_NATURES`, `TenantEmailNature` — `email-send-types.ts` ; `sendEmailService` (nature
  obligatoire, s52).
- `ImportRemarkConst.SEVERAL_EMAILS`, `mapPennylaneClients` — import.

## Traps & constraints

- **`mail_only` est générée sur `member_profile.email`** : retirer la colonne casse la colonne générée et
  tous ses lecteurs (liste, compteur `incomplete`, `isIncomplete`, rapport d'import). Garder la colonne
  comme copie de la titulaire impose une synchronisation stricte (deux sources de vérité, contraire à
  l'esprit de l'ADR 054 §2) ; la retirer impose un calcul par `EXISTS` partout. Choix structurant → ADR.
- **`unlinkMemberProfileAccountDao(memberProfileId)` délie par fiche** : une fois l'unicité levée, le
  réutiliser pour retirer une adresse couperait **toutes** les adresses de la fiche (viole le critère 10).
  Toute fermeture doit viser `(fiche, compte)`.
- **Jointures sur `member_profile_account` qui multiplient les lignes** : `getCampaignTargetRowsDao`,
  `getPendingPartRecipientsDao` (`accountName`), `MemberProfileWithAccountRow.userId`,
  `getMemberProfilePageDao` (`accountProfileCount`), `getUnlinkedMemberProfilesWithEmailDao`,
  `roleCardOf.isSelf`. À inventorier tous : une fiche à deux comptes doit rester **une** ligne.
- **Un compte par adresse, pas par fiche** : deux adresses d'une fiche = deux `user`, deux liens. Un proche
  connecté a sa propre ligne `member` (rôle `member`) ; la retirer à la fermeture seulement quand plus
  aucune fiche ne le porte (règle s53, inchangée).
- **Rôle du bureau** : `refuse_board_removal` (dernière fiche d'un compte board/owner) reste valable par
  **adresse** ; la succession de la titulaire ne doit jamais déplacer un rôle bureau vers l'adresse d'un
  proche (l'ADR 039 déplace le rôle « vers la nouvelle adresse » lors d'un `replace`).
- **Sécurité de la confirmation** : jeton aléatoire, à usage unique, expirant (paramètre du tenant),
  **stocké haché** (le jeton de désinscription ADR 051 est stocké en clair, mais il ne donne pas accès à un
  espace). La confirmation ne doit jamais relier une adresse déjà portée par une fiche d'un autre compte
  (critère 7) : re-vérifier au moment de la confirmation, pas seulement à l'ajout (course).
- **Autorisation membre** : aucun identifiant de fiche venu du navigateur (ADR 040, s53) ; « ma propre
  adresse » se résout par `authUser.email` ↔ adresse de la fiche ; une adresse ajoutée en attente se
  désigne par son identifiant **et** son auteur (`added_by_user_id`). Test serveur direct exigé (critère 4).
- **Le membre et ses fiches** : avec plusieurs fiches (s53), « ajouter une adresse » vise-t-il toutes les
  fiches du compte ou une seule ? (question ouverte 4) — `updateMyContactService` écrit déjà toutes les
  fiches.
- **Budget Brevo** : chaque lien de confirmation décompte le budget (300/jour) ; une file de report (s52)
  retarderait un lien de confirmation au lendemain — acceptable ou nature réservée ? À trancher au plan.
- **Campagnes en cours** : les parts déjà planifiées (s26) ont leurs lignes `campaign_recipient` par fiche ;
  la migration ne doit pas casser leur livraison (relecture de l'adresse à la livraison).
- **Désinscription** (ADR 055) : portée par la fiche, étendue à l'adresse par égalité sur
  `member_profile.email`. Avec N adresses par fiche, une fiche désinscrite par un proche couperait le
  propriétaire, et inversement — à trancher (question ouverte 2).
- **Migration** : ~413 fiches, ~300 comptes en recette. Reprise `--custom` (jamais de SQL à la main hors
  `--custom`, journal/snapshots générés). Origine des adresses existantes : `pennylane_customer_id` non nul
  → « fichier », sinon « site » (heuristique, question ouverte 6).
- **RLS non testable en unitaire** : l'isolation de la nouvelle table et le critère 2 (deux adresses, même
  espace) se prouvent en e2e — exécuté en CI GitHub, jamais en local (machine trop juste).
- **Tests unitaires** sur le montage 9p lents : `pnpm test --run`, valider sur une copie en disque local,
  un timeout n'est jamais un vert.
- **Tests existants à faire évoluer** : `member-account-service.test.ts`, `member-account-rules.test.ts`,
  `member-profile-service.test.ts`, `member-space-service.test.ts`, `campaign-rules.test.ts`,
  `campaign-service.test.ts`, `pennylane-clients-mapper.test.ts`, `member-import-service.test.ts`,
  `member-question-service.test.ts`, `incident-report-*.test.ts`, composants `member-profile-detail`,
  `member-profile-form`, `member-profile-list`, `my-contact-card`, `member-space` ; e2e
  `member-accounts.spec.ts`, `member-profiles.spec.ts`, `member-import.spec.ts`, `campaigns.spec.ts`,
  `tenant-isolation.spec.ts`, `magic-link.spec.ts`.
- **Story UI** : la fiche du bureau (liste d'adresses, rôle, origine, désignation de la titulaire) et
  l'espace membre (ajout, confirmation en attente, annulation, page de confirmation) sont des écrans
  nouveaux → phase Design obligatoire, ancrée sur `docs/design-system.md`.
- **ADR immuables** : deux nouveaux ADR remplacent l'ADR 040 et l'unicité de l'ADR 054 §1 ; les anciens ne
  sont pas modifiés.

## Open questions

1. **Forme du stockage** : table `member_profile_email (id, organization_id, member_profile_id, email,
   role 'holder'|'additional', status 'active'|'pending', origin 'file'|'site', added_by_user_id,
   confirmation_token_hash, expires_at, replaces_id, …)` sous RLS forcée, avec index unique partiel « une
   titulaire active par fiche » et unicité `(member_profile_id, lower(email))` — et que devient
   `member_profile.email` / `mail_only` (retirée, ou conservée comme copie de la titulaire) ? À acter dans
   un ADR.
2. ~~**Désinscription d'une fiche à plusieurs adresses**~~ — **tranché le 16/11/2026 (arbitrage)** :
   **par adresse**. Le proche qui se désinscrit ne coupe pas le propriétaire ; le refus suit l'adresse sur
   toutes les fiches qui la portent (règle de s53 conservée).
3. **Lien du compte à l'adresse** : `member_profile_account` reste `(fiche, compte)` (l'adresse se retrouve
   par `user.email`), ou gagne une référence à l'adresse de fiche qui l'ouvre ? La seconde rend la fermeture
   et la modification sans ambiguïté.
4. ~~**Membre à plusieurs fiches** (s53) qui ajoute une adresse depuis son espace~~ — **tranché le
   16/11/2026 (arbitrage)** : l'adresse est ajoutée, supplémentaire, sur **toutes** les fiches reliées au
   compte, en une fois (même logique que les coordonnées postales de s53). Par cohérence, la modification de
   sa propre adresse vaut aussi sur toutes ses fiches (un compte = une personne), son rôle sur chacune
   conservé (critère 8).
5. **Modification de sa propre adresse par le membre** : la nouvelle adresse confirmée = nouveau `user`
   (compte de la nouvelle adresse), l'ancien compte perd le lien → la personne doit se reconnecter avec la
   nouvelle adresse. Acceptable, ou réécriture de `user.email` (rejetée par l'ADR 040 : touche les autres
   associations) ?
6. **Origine des adresses existantes** à la migration : « fichier » si la fiche a un
   `pennylane_customer_id`, sinon « site » ? Pas de trace plus fiable dans le schéma.
7. **Nature d'envoi du lien de confirmation** : `login` (réserve de connexion, s52) ou nouvelle nature ?
   Le lien est plus proche d'une connexion (sécurité) que d'une campagne.
8. **Variables de campagne** pour une adresse supplémentaire : `{nom}` = nom de la fiche (comme la
   titulaire) ou nom du compte du proche ?
9. **Remarque d'import** : la remarque `several_emails` disparaît ; faut-il signaler au rapport les fiches
   créées avec plusieurs adresses (comptage), ou rien ?
