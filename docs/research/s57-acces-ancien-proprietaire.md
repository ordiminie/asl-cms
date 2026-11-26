# Research — Story s57-acces-ancien-proprietaire

## Target story

**En tant que** membre du bureau **je veux** que le vendeur d'un terrain garde son accès six mois puis le
perde, son espace restant consultable par le bureau **afin que** le vendeur récupère ses documents sans que
l'accès reste ouvert indéfiniment. Complexité 3. Dépendances : s12, s12d, s19, s32, s53, s54 — toutes
mergées sur `main` (s12 #37, s12d #45, s53 #70, s54 #71, s19 #73, s32 #86).

Critères d'acceptation (docs/stories.md:4273) :

1. Membre qui n'est plus propriétaire d'aucun terrain (toutes ses périodes closes) : l'accès de **toutes**
   les adresses et de tous les comptes reliés à ses fiches (titulaire et proche compris) reste ouvert
   pendant un **délai paramétré du tenant**, seed six mois, à partir de la fin de la dernière période.
2. Passé le délai, accès fermé **sans rien supprimer** ; le bureau consulte l'espace inactif depuis la fiche
   du back-office (factures, relevés, documents, comme pour un membre actif). Aucune adresse reliée ne se
   connecte plus **à ces fiches** ; ses fiches restantes ailleurs ne sont pas touchées.
3. Contrôle **à chaque lecture de session** (ADR 038), sans tâche planifiée ; testé avec une horloge doublée
   un jour avant et un jour après l'échéance.
4. Un propriétaire qui vend un terrain mais en garde un autre conserve son accès.
5. Une adresse supplémentaire (proche) sur la fiche du vendeur perd l'accès à **cette** fiche au même délai ;
   ses fiches où elle est titulaire, ou dont le propriétaire n'a pas vendu, ne sont pas touchées.
6. Pendant le délai, le vendeur voit factures et documents **d'avant la vente** (s19, s32), pas ceux d'après ;
   une facture impayée reste visible (aucune action sur la dette).
7. Rachat : le membre retrouve son accès sans intervention.
8. Le bureau voit sur la fiche la **date de fin d'accès prévue**.

Notes agentiques retenues : délai = paramètre de tenant, jamais une constante ; **aucune purge** ; réutiliser
`canOpenSessionOn` (ADR 038) étendu d'une condition « propriétaire, ou dans le délai après sa dernière
propriété » ; fermer l'accès ne retire jamais un rôle autre que `member` (s12d : un membre du bureau qui vend
garde le bureau) ; aucun prorata ni solde dans le site.

## Current state of the code

### Règle d'accès à la session (ADR 034, ADR 038)

- `src/lib/better-auth/association-membership.ts` :
  - `organizationOfRequest(host)` (l. 17) : association du domaine, façade chargée par `import()` dynamique
    (cycle `auth.ts` → façade → `auth-service` → `auth.ts`, gardé par
    `src/lib/better-auth/magic-link-integration-imports.test.ts`).
  - `isMemberOf(user, organization)` (l. 30) : une ligne `member` dans `user.organizations`.
  - `canOpenSessionOn(user, organization)` (l. 43) : **pure et synchrone** — SuperAdmin partout, sinon
    `isMemberOf`. Ne lit que `user.role` et `user.organizations[].organizationId`. **Aucune** notion de fiche,
    de période, de date ni de paramètre.
- Cinq appelants :
  | Appelant                                                                           | Moment                                                                                                  | Contexte                                                 |
  | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
  | `src/services/authentication/auth-service.ts:33` `getAuthUser` (`cache()`)         | chaque lecture de session (pages via `withAuth`, Server Actions via `requireActionAuth`, DAL, services) | `headers()` de Next                                      |
  | `src/lib/better-auth/association-session-guard.ts:38` `openSessionOnRequestDomain` | `databaseHooks.session.create.before` (toute ouverture de session)                                      | hook Better Auth, `getUserByIdDao`, en-têtes du contexte |
  | `src/lib/better-auth/magic-link-integration.ts:272` `sendMagicLink`                | demande de lien                                                                                         | rien n'est envoyé si refus                               |
  | `src/lib/better-auth/magic-link-integration.ts:208` `issueInvitation`              | lien d'invitation (s42a, ADR 071)                                                                       | « aucun lien » si refus                                  |
  | (import) `association-session-guard.ts:7`                                          | —                                                                                                       | —                                                        |
- `getAuthUser` (`auth-service.ts:26`) : `getSessionAuth()` → `organizationOfRequest(requestHostOf(headers()))`
  → `canOpenSessionOn(session.user, organization)` ; refus = `undefined` (traité comme non connecté).
  `session.user` vient de `customSession` (`src/lib/better-auth/auth.ts:316`), qui relit `getUserByIdDao`
  **à chaque appel** (le `cookieCache` de 5 min ne sert que la session de base) : la coupure est donc
  immédiate à la requête suivante, sans délai de cache serveur.
- `withAuth` (`src/components/features/auth/with-auth.tsx:30`) : session présente mais `getAuthUser()` vide →
  `/login/acces-ferme` (Route Handler `src/app/[locale]/(auth)/login/acces-ferme/route.ts`, ferme la session
  Better Auth, 307 vers `/login?acces=ferme`), écran D (`Auth.AccessClosedNotice` dans `messages/fr.json` :
  « Votre accès à l'espace membre est fermé. »).
- Rôles d'association (`UserOrganizationRoleConst`, `src/services/types/domain/auth-types.ts:49`) :
  `owner`, `board` (ex-`admin`), `member`. La ligne `member` de Better Auth porte **un** rôle par
  association ; un membre du bureau n'a pas de seconde ligne `member`. Le rôle n'est retiré que par
  `deleteMemberWithRoleDao(userId, organizationId, 'member')` (rôle `member` seulement) dans
  `closeMemberAccount` (`src/services/member-account-service.ts:180`) quand plus aucune fiche n'est reliée.

### Propriété datée (s12, ADR 029)

- Tables (`src/db/models/parcel-model.ts`) : `parcel` (numéro unique par association, `meter_number`),
  `parcel_ownership` (`parcel_id`, `member_profile_id`, `starts_on`, `ends_on` nullable, `date` mode chaîne).
  Périodes **demi-ouvertes** `[starts_on, ends_on)` : `ends_on` = jour de la vente = premier jour de
  l'acquéreur ; l'affichage écrit « au » la veille. **Aucune colonne « propriétaire actuel »**.
- Écritures (`src/services/parcel-ownership-service.ts`) : `attachParcelService` (l. 113, ouvre une période),
  `recordSaleService` (l. 193 : verrou `lockParcelTxnDao`, `planSale`, `closeOpenPeriodTxnDao` pose `ends_on`
  une seule fois, `openPeriodTxnDao` pour l'acquéreur). **Une date de vente postérieure à aujourd'hui est
  refusée** (`isOwnershipDateInFuture(date, today())`) : `ends_on <= aujourd'hui` toujours. Une période close
  est immuable (aucune correction de date de vente possible).
- Lectures (`src/db/repositories/parcel-ownership-repository.ts`) :
  - `getCurrentParcelsByMemberDao(memberProfileId)` (l. 178) : périodes ouvertes (`ends_on IS NULL`).
  - `getFormerParcelsByMemberDao` (l. 201, bureau, avec l'acquéreur) / `getMemberFormerParcelsDao` (l. 277,
    membre, sans acquéreur).
  - `getParcelOwnerAtDao(parcelId, date)` (l. 243) / `getParcelOwnerAtService` (service l. 247).
  - `listOwnershipPeriodsByProfilesDao(memberProfileIds)` (l. 314) → `OwnershipPeriodRow[]`
    (`memberProfileId`, `number`, `meterNumber`, `startsOn`, `endsOn`) : **toutes** les périodes d'un lot de
    fiches en une requête — déjà appelée par « Mes factures » et « Mes documents ».
- « Propriétaire actuel » = existence d'une période `ends_on IS NULL` sur la fiche. Il n'existe **aucune**
  fonction « dernière date de fin d'une fiche » ni « la fiche est-elle encore propriétaire » ; la règle pure
  la plus proche est `parcelsOwnedOn(periods, memberProfileId, date)`
  (`src/services/rules/pennylane-invoice-mapping.ts:283`, type `OwnershipPeriod` l. 267).
- Modèle « une fiche par client Pennylane, donc par terrain » (ADR 048, ADR 054) : une fiche porte en
  général un terrain (une ou deux parcelles partageant un compteur, ex. Meunier 12 + 13 au seed). Un
  propriétaire de plusieurs terrains = plusieurs fiches reliées au même compte (s53).

### Fiches ↔ adresses ↔ comptes (s53 ADR 054, s54 ADR 056)

- `member_profile_account` (`src/db/models/member-profile-account-model.ts`) : `(member_profile_id, user_id)`
  unique, RLS forcée. Un compte par adresse ; une adresse active ouvre (ou retrouve) le `user` de son adresse
  et le relie à la fiche ; une adresse `pending` n'a ni lien ni compte.
- `member_profile_email` : `role` `holder` | `additional`, `status` `active` | `pending`, origine. « Proche » =
  adresse `additional`. Le rôle est **propre à chaque fiche** : une même adresse peut être titulaire d'une
  fiche et supplémentaire d'une autre (seed : Paul Ferrand, supplémentaire sur la fiche de Claire Meunier).
- « Mes fiches » d'une session :
  - `linkedProfileIds(organizationId, userId)` (sous-requête privée,
    `src/db/repositories/member-profile-repository.ts:480`) ;
  - `getMemberProfilesByUserIdDao(organizationId, userId)` (l. 497) → `MyMemberProfileRow[]` (avec
    `currentParcelNumbers`), non trié ;
  - `getMyMemberProfiles(organizationId, userId)` (`member-account-service.ts:416`) = `withTenant` +
    `orderMyProfiles` (`src/services/rules/my-profiles-order-rules.ts:23` : fiches sans parcelle actuelle
    **en dernier**) ; `getFirstMemberProfile` (l. 425).
  - `updateMyMemberProfilesContactDao` (l. 538) écrit **toutes** les fiches liées (par `linkedProfileIds`).
  - `countLinkedProfilesDao(organizationId, userId)` (l. 436).
- Le `user.organizations` lu par `canOpenSessionOn` ne sait rien des fiches : l'accès « à une fiche » n'existe
  aujourd'hui que par la présence du lien `member_profile_account`, et l'accès « à la session » que par la
  ligne `member`.

### Lecteurs de « mes fiches » (tous à revoir, voir Traps)

| Appelant                                                     | Ligne     | Usage                                               | Côté            |
| ------------------------------------------------------------ | --------- | --------------------------------------------------- | --------------- |
| `member-space-service.ts` `getMyLandsService`                | 97 / 111  | « Mes terrains » (actuelles + anciennes parcelles)  | membre          |
| `member-space-service.ts` `getMyContactService`              | 212 / 226 | coordonnées                                         | membre          |
| `member-space-service.ts` `updateMyContactService`           | 239 / 254 | écrit toutes les fiches liées (DAO direct)          | membre          |
| `member-space-service.ts` `getMyInvoicesService`             | 383 / 397 | « Mes factures » (`provider.listInvoicesOf`)        | membre          |
| `member-space-service.ts` `getMyInvoicePdfUrlService`        | 437 / 455 | PDF Pennylane au clic, contrôle de possession       | membre          |
| `member-document-service.ts` `getMyMemberDocumentsService`   | 518 / 532 | « Mes documents »                                   | membre          |
| `member-document-service.ts` `readMemberDocumentFileService` | 572 / 598 | contrôle de possession n° 2 de l'ADR 073            | membre + bureau |
| `my-email-service.ts` `loadMine`                             | 146       | « Mes adresses » (ajout sur toutes les fiches)      | membre          |
| `member-email-pending-authors.ts`                            | 25        | auteurs des adresses en attente                     | membre          |
| `incident-report-service.ts`                                 | 490, 546  | signalement / « Mes signalements » (première fiche) | membre          |
| `member-question-service.ts`                                 | 225, 268  | question au bureau / sujets                         | membre          |
| `member-profile-support.ts` `findEmailHolder`                | 140       | détenteur d'une adresse partagée                    | **bureau**      |
| `member-profile-support.ts` `readAccountView`                | 216       | « Ce compte réunit aussi » (`otherProfiles`)        | **bureau**      |
| `member-role-service.ts`                                     | 153, 400  | trace de passation                                  | bureau          |
| `organization-service.ts` `traceMemberRemoval`               | 895       | trace de retrait                                    | bureau          |

### Factures (s19, s20, ADR 059, ADR 062)

- `member_invoice` (`src/db/models/member-invoice-model.ts`) : `member_profile_id`, `issued_on` (l. 65),
  `due_on`, `year`, `status` (brut, transporté tel quel), `source` (`site` | `pennylane`). ADR 059 §3 : la
  visibilité ne lit que `member_profile_id`, **une vente ne déplace aucune facture**.
- Côté membre : `getMyInvoicesService` lit les factures de **toutes** les fiches liées par
  `resolveMemberBillingProvider(settings).listInvoicesOf(organizationId, profileIds)`
  (`src/services/billing/member-billing-provider.ts:22` ; implémentations `manual-…` l. 43, `pennylane-…`
  l. 25, les deux lisent la base) ; tri `issuedOn` décroissant ; aucun filtre de date. Le terrain d'une
  facture Pennylane se calcule par `parcelsOwnedOn(periods, …, invoice.issuedOn)`.
- Classe de statut : `classifyInvoiceStatus` / `getInvoiceStatusClassification`
  (`src/services/rules/member-invoice-rules.ts`) → `statusClass` `unpaid` | … ; `paymentOf` ne propose un
  règlement que pour `unpaid`.
- `getMyInvoicePdfUrlService` revérifie la possession (`profiles.some(…)`) mais **sans** filtre de date.
- Côté bureau : `listMemberInvoicesService` (`member-invoice-service.ts:277`) et `getMemberInvoicesForBureauDal`
  (`src/app/dal/member-invoice-dal.ts:38`) : toutes les factures de la fiche, sans regard sur la propriété.

### Documents nominatifs (s32, ADR 073)

- `member_document` (`src/db/models/member-document-model.ts`) : `member_profile_id`, `document_date` (l. 49,
  `date` chaîne, **saisie par le bureau**, défaut jour du dépôt), `file_key`, `created_at`. ADR 073 §7 : un
  dépôt daté après la dernière période **n'est pas refusé** ; le délai du vendeur est renvoyé à s57.
- Côté membre : `getMyMemberDocumentsService` liste les documents de toutes les fiches liées
  (`listMemberDocumentsByProfilesDao`), aucun filtre de date. Route fichier `GET /api/member-documents/[id]`
  → `readMemberDocumentFileService` : trois contrôles (RLS ; possession par `getMyMemberProfiles` **ou**
  action `member.document.manage` ; cohérence clé ↔ fiche). 404 pour tout refus.
- Côté bureau : `getMemberDocumentsOfProfileForBureauService` (l. 404) / DAL
  `getMemberDocumentsOfProfileForBureauDal` (`src/app/dal/member-document-dal.ts:45`).

### Relevés (s17, s18)

**Non livrés.** Aucune table, aucun modèle, aucun service de relevé ou de consommation
(`grep meter_reading|consumption` ne trouve que des homonymes dans les campagnes et les analyses d'eau).
s18 porte son propre critère « l'ancien propriétaire conserve les relevés antérieurs à la vente »
(docs/stories.md:1750). Le mot « relevés » du critère 2 de s57 n'a donc rien à brancher aujourd'hui.

### Back-office : fiche membre

- Page `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx` : `canManageCurrentMemberProfilesDal`,
  `getMemberProfileForBureauDal`, puis, en promesses non attendues, notes, désinscription, **factures**
  (`getMemberInvoicesForBureauDal`) et **documents** (`getMemberDocumentsOfProfileForBureauDal`) ; parcelles
  (`getMemberParcelsForBureauDal`), réglages (`getAssociationSettingsDal`) ; `today = calendarDayOf(new Date())`
  lu dans la page. Sous-routes : `factures/[invoiceId]`, `factures/nouvelle`, `documents/nouveau`,
  `documents/generer`, `vente/[parcelId]`.
- **Le bureau consulte déjà factures et documents d'une fiche quelle que soit sa propriété** : la partie
  « consultable par le bureau » du critère 2 est acquise pour ces deux familles (rien n'est supprimé par la
  coupure). Le bureau ne voit pas « l'espace membre » tel que le membre le voit (aucune vue « comme le
  membre » hors connexion à la place d'un compte, s48, réservée au SuperAdmin).
- Composant `src/components/features/member-profile/member-profile-detail.tsx` (1056 l.) : cartes
  coordonnées, adresses (`MemberProfileEmailsCard`), **« Accès à l'espace membre »**
  (`DetailCard title={t('detail.access.title')}`, l. 294, contenu `MemberInvitation` l. 544 et `AccessState`
  l. 495 : phrase `open` / `mailOnly`), rôle (`MemberRoleCard`), parcelles (`CurrentParcels`,
  `FormerParcels`, `ClosedPeriod`), facturation (`MemberBillingCard`), notes. La carte « Accès » est
  l'endroit naturel de la date de fin d'accès prévue (critère 8).
- DTO : `MemberProfileDTO` / `MemberProfileAccountDTO` (`src/services/types/domain/member-profile-types.ts:77`,
  union `{status: 'open', loginEmail, boardRole, accountName, otherProfiles}` | `{status: 'mail_only'}`),
  construit par `readProfileView(authUser, organizationId, row, now)` (`src/services/member-profile-support.ts`,
  `toAccountDto`) ; `now` passé par `getMemberProfileService` (`member-profile-service.ts:200`, `const now =
new Date()` l. 213).
- `messages/fr.json` : `BureauMemberProfilesPage.detail.access` (`title` « Accès à l'espace membre », `open`,
  `mailOnly`, `board`, `owner`, `sharedWith`, `invitation.*`), `BureauMemberProfilesPage.detail.parcels`,
  `.sold`, `.billing`.

### Espace membre

- `src/app/[locale]/(app)/dashboard/page.tsx` (`withAuth(Page)`) : promesses `getMyLandsDal`,
  `getMyContactDal`, `getMyEmailsDal`, `getMyIncidentReportsDal`, `getMyInvoicesDal`, `getMySharedDocumentsDal`,
  `getMyMemberDocumentsDal`, déroulées par `MemberSpace` derrière `<Suspense>`. DAL
  `src/app/dal/member-space-dal.ts` : **aucun `'use cache'`**, `cache()` seulement.
- « Mes terrains » (`getMyLandsService`) : une entrée par fiche liée, parcelles actuelles **et** anciennes
  (`readLand`). Une fiche entièrement vendue y apparaît aujourd'hui avec `current: []`, sans limite de durée.
- Documents de l'association (s31) : `getSharedDocumentsForMemberService` exige l'action
  `SHARED_DOCUMENT_READ` sur `getAuthUser()` ; la coupure de session les ferme d'office.
- `messages/fr.json` : `MemberSpacePage` (`parcels`, `markerLands`, `invoices`, `memberDocuments`,
  `documents`, `contact`, `emails`, `denied`…), `MemberSpaceLayout`.
- Destination après connexion : `postLoginPathOf(user, organizationId)`
  (`src/services/authorization/association-authorization.ts:57`) : SuperAdmin `/admin`, bureau
  `/bureau/pages`, sinon `/dashboard`.

### Paramètres du tenant (ADR 010, ADR 016)

- Registre en code : `ASSOCIATION_SETTINGS_REGISTRY` dans
  `src/services/types/domain/association-settings-types.ts` (1393 l.). Déclaration : `key`, `type: 'number'`,
  `required: false`, `default: {value: '…'}`, `min`, `max`, `integer: true`, `unitKey`, `labelKey`,
  `helpKey`, `errorMessageKeys`, `page: 'settings'`, `section` (union `AssociationSettingSection` l. 33 :
  `seo`, `legal`, `sending`, `campaign_nature`, `billing`, `reminder`, `letter`, `invitation` — **aucune
  section « membres » ou « accès »**). Option `editableBy: 'super_admin'` disponible.
- Lecture : `getAssociationSettingsService(organizationId)` (`src/services/association-settings-service.ts:52`,
  sans contrôle d'autorisation, délibéré) → `ResolvedAssociationSettings`, puis un accesseur pur par clé sur
  `numberSettingOf` (privé, l. 1190 : valeur, sinon défaut du registre, sinon exception).
- Trois exemples numériques de durée / seuil :
  - `MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY = 'member.email_confirmation_days'` (l. 266 ; définition
    l. 606, défaut `7`, `units.days`, section `sending`) → `getMemberEmailConfirmationDays` (l. 1279), lu par
    `email-service.ts:1787` ;
  - `INVITATION_LINK_DAYS_SETTING_KEY = 'invitation.link_days'` (l. 286 ; définition l. 833) →
    `getInvitationLinkDays` (l. 1381), lu par `member-invitation-service.ts:91`, `campaign-service.ts:1222`
    et la page de la fiche ;
  - `MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY` (l. 196 ; définition l. 458, défaut `3`, `min 1`, `max 20`) →
    `getMagicLinkDailyRequestLimit` (l. 1211).
- Unités (`AssociationSettings.units` dans `messages/fr.json`) : `days`, `sendsPerDay`, `attempts`,
  `reminderWeeks1..3`, … — **pas d'unité « mois »**.
- Seed des tenants de test : `TEST_TENANT_SETTINGS` (`src/db/scripts/tenant-settings-seed.ts`), une ligne
  `{organizationSlug: 'techcorp-solutions', key, value}` par valeur de seed du premier tenant (ex.
  `member.email_confirmation_days` = `7`), commentée en tête du fichier.

### Horloge

- Aucun port d'horloge injecté. Patron établi : le **service** lit `new Date()` une fois (ex.
  `member-profile-service.ts:115/181/213`, `member-invitation-service.ts:147`, `my-email-service.ts:230`) et
  passe `now` / un jour calendaire à des **règles pures** (`src/services/rules/*`) ; le jour calendaire de
  l'association est `calendarDayOf(instant)` (`src/services/types/domain/water-analysis-types.ts:155`, fuseau
  `CALENDAR_TIME_ZONE`, Paris) ; `parcel-ownership-service.ts:102` `today()` « l'horloge n'est lue qu'ici ».
- Tests : `vi.useFakeTimers({toFake: ['Date']})` + `vi.setSystemTime(…)`
  (`src/services/__tests__/parcel-ownership-service.test.ts:165`, `rate-limit-service.test.ts:80`, bascule
  minuit Paris l. 138-144). Les règles pures se testent avec un `today` en argument, sans faux minuteur.
- Arithmétique de dates : `addDays(day, days)` (`src/services/rules/campaign-schedule-rules.ts:26`, jours
  calendaires `YYYY-MM-DD`). **Aucune fonction d'ajout de mois** dans le code ; `date-fns` 4 est une
  dépendance (`addMonths` disponible, utilisé aujourd'hui seulement pour `format`/`formatDistanceToNow` en
  présentation).

### Seed et e2e

- `src/db/scripts/tenant-member-profiles-seed.ts` : `TEST_PARCEL_OWNERSHIPS`. Fiche **entièrement vendue** :
  Dubois (parcelle 47, `1998-02-03` → `2026-06-15`, acquéreur Roy) — **sans adresse** (`NO_CONTACT`), donc
  sans compte. Moreau : parcelle 9 vendue en 2019 mais garde la 21. **Paul Ferrand** (`FERRAND_ID`) : fiche
  avec deux adresses actives et **aucune période** du tout. Aucun compte du seed n'est aujourd'hui « vendeur
  sans terrain ».
- Factures du seed (`tenant-member-invoices-seed.ts`) : Lefèvre ×3, Moreau (2019), Laurent (2020), SCI Les
  Pins — aucune sur Dubois.
- e2e : `e2e/member-accounts.spec.ts` (serial ; `localhost` = TechCorp, `127.0.0.1` = Marketing Pro ; client
  `pg` direct pour préparer et nettoyer ; « critère 6 — adresse retirée pendant une session ouverte : coupée
  au rechargement suivant » l. 578, attend `/login?acces=ferme`) ; tests de période écrits en SQL direct
  (`parcel_ownership`, l. 198-219) ; s53 l. 920+, s54 l. 1202+. `e2e/tenant-isolation.spec.ts` pour l'accès
  croisé. Rappel mémoire : e2e en CI GitHub, pas en local.

### Sauvegarde / export

- Inventaire s12c : `src/lib/files/file-key-inventory.ts` (clés de fichier) et tableau des tables de
  `docs/architecture.md`. s38 (export) et s39 (complétude) **ne sont pas livrées**. Une règle calculée à la
  lecture à partir de `parcel_ownership` + un paramètre n'ajoute ni table ni clé de fichier ; une ligne
  `organization_setting` de plus est déjà couverte.

## Anchor points

- **Règle pure du délai** (nouveau, `src/services/rules/…`) : à partir des périodes d'une fiche
  (`OwnershipPeriod[]` ou `OwnershipPeriodRow[]`), du délai et du jour calendaire `today` → état
  `owner` | `grace(until)` | `closed(since)` | `never_owned`. Testable sans faux minuteur (critère 3 : J-1 /
  J+1 de l'échéance).
- **Paramètre** : nouvelle entrée de `ASSOCIATION_SETTINGS_REGISTRY` + accesseur sur `numberSettingOf` +
  ligne de `TEST_TENANT_SETTINGS` + libellés `AssociationSettings.fields.*` (et une unité si « mois »).
- **Accès à la session** : `canOpenSessionOn` / `getAuthUser` (`auth-service.ts:26`) et les trois autres
  appelants (hook de création de session, `sendMagicLink`, `issueInvitation`). La condition nouvelle est
  **asynchrone** (lien fiche ↔ compte, périodes, paramètre, sous `withTenant`) : soit une seconde fonction
  appelée après `canOpenSessionOn`, soit un calcul préalable passé en argument. Ne s'applique qu'aux
  comptes dont le rôle dans l'association est `member` (pas `owner` / `board`, pas SuperAdmin).
- **Accès à une fiche** : `getMemberProfilesByUserIdDao` / `getMyMemberProfiles` ne font aujourd'hui aucune
  différence entre fiche ouverte et fiche close ; c'est là, ou juste au-dessus pour les seuls lecteurs côté
  membre, que s'écarte une fiche close (critères 2 et 5). Voir le tableau des lecteurs.
- **Filtre « avant la vente »** (critère 6) : `getMyInvoicesService` (sur `invoice.issuedOn`, les périodes
  sont déjà chargées par `listOwnershipPeriodsByProfilesDao`), `getMyInvoicePdfUrlService`,
  `getMyMemberDocumentsService` (sur `row.documentDate`) et le contrôle de possession de
  `readMemberDocumentFileService` (branche membre seulement, pas la branche `member.document.manage`).
- **Bureau** (critère 8) : `readProfileView` / `toAccountDto` (`member-profile-support.ts`) pour exposer la
  date prévue dans `MemberProfileDTO`, rendue dans la carte `detail.access` de `member-profile-detail.tsx` ;
  libellés sous `BureauMemberProfilesPage.detail.access`.
- **« Mes terrains »** (`readLand`, `getMyLandsService`) : lieu d'une éventuelle mention du délai côté membre
  (non exigée par la story).

## Verified APIs / functions

| Nom                                                   | Signature                                                                                                 | Emplacement                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `canOpenSessionOn`                                    | `(user: {role?, organizations?: {organizationId}[]}, organization: Organization \| undefined) => boolean` | `src/lib/better-auth/association-membership.ts:43`             |
| `isMemberOf`                                          | `(user, organization: Organization) => boolean`                                                           | idem l. 30                                                     |
| `organizationOfRequest`                               | `(host: string \| undefined) => Promise<Organization \| undefined>`                                       | idem l. 17                                                     |
| `getAuthUser`                                         | `cache(async () => User \| undefined)`                                                                    | `src/services/authentication/auth-service.ts:26`               |
| `getActingContext`                                    | `cache(async () => ActingContext \| undefined)`                                                           | idem l. 86                                                     |
| `openSessionOnRequestDomain` (privé)                  | `(session: {userId}, context) => Promise<boolean \| void>`                                                | `src/lib/better-auth/association-session-guard.ts:29`          |
| `withAuth` / `CLOSED_ACCESS_PATH`                     | HOC ; `'/login/acces-ferme'`                                                                              | `src/components/features/auth/with-auth.tsx:30`, l. 20         |
| `getMemberProfilesByUserIdDao`                        | `(organizationId, userId) => Promise<MyMemberProfileRow[]>`                                               | `src/db/repositories/member-profile-repository.ts:497`         |
| `updateMyMemberProfilesContactDao`                    | `(organizationId, userId, contact) => Promise<MemberProfileModel[]>`                                      | idem l. 538                                                    |
| `countLinkedProfilesDao`                              | `(organizationId, userId) => Promise<number>`                                                             | idem l. 436                                                    |
| `getLinkedAccountsDao`                                | `(memberProfileId) => Promise<LinkedAccountRow[]>`                                                        | idem l. 174                                                    |
| `getMyMemberProfiles`                                 | `(organizationId, userId) => Promise<MyMemberProfileRow[]>` (sous `withTenant`, trié)                     | `src/services/member-account-service.ts:416`                   |
| `closeMemberAccount`                                  | `({organizationId, memberProfileId, userId}) => Promise<void>`                                            | idem l. 180                                                    |
| `orderMyProfiles`                                     | `<P extends {id; currentParcelNumbers}>(profiles: P[]) => P[]`                                            | `src/services/rules/my-profiles-order-rules.ts:23`             |
| `listOwnershipPeriodsByProfilesDao`                   | `(memberProfileIds: readonly string[]) => Promise<OwnershipPeriodRow[]>`                                  | `src/db/repositories/parcel-ownership-repository.ts:314`       |
| `getCurrentParcelsByMemberDao`                        | `(memberProfileId) => Promise<CurrentParcelRow[]>`                                                        | idem l. 178                                                    |
| `getMemberFormerParcelsDao`                           | `(memberProfileId) => Promise<MemberFormerParcelRow[]>`                                                   | idem l. 277                                                    |
| `parcelsOwnedOn` / `OwnershipPeriod`                  | `(periods, memberProfileId, date: string) => TerrainParcel[]`                                             | `src/services/rules/pennylane-invoice-mapping.ts:283`, l. 267  |
| `recordSaleService`                                   | `(input: RecordSaleInput) => Promise<RecordSaleResult>`                                                   | `src/services/parcel-ownership-service.ts:193`                 |
| `getMyLandsService`                                   | `(organizationId) => Promise<MyLandsDTO \| undefined>`                                                    | `src/services/member-space-service.ts:97`                      |
| `getMyInvoicesService`                                | `(organizationId) => Promise<MyInvoicesDTO \| undefined>`                                                 | idem l. 383                                                    |
| `getMyInvoicePdfUrlService`                           | `(organizationId, invoiceId) => Promise<MyInvoicePdfResult>`                                              | idem l. 437                                                    |
| `getMyMemberDocumentsService`                         | `(organizationId) => Promise<MyMemberDocumentDTO[]>`                                                      | `src/services/member-document-service.ts:518`                  |
| `readMemberDocumentFileService`                       | `(organizationId, documentId) => Promise<MemberDocumentFile>`                                             | idem l. 572                                                    |
| `getMemberProfileService`                             | `(organizationId, memberProfileId) => Promise<MemberProfileDTO \| undefined>`                             | `src/services/member-profile-service.ts:200`                   |
| `readProfileView`                                     | `(authUser, organizationId, row, now: Date) => Promise<MemberProfileDTO>`                                 | `src/services/member-profile-support.ts:295`                   |
| `getAssociationSettingsService`                       | `(organizationId) => Promise<ResolvedAssociationSettings>`                                                | `src/services/association-settings-service.ts:52`              |
| `getMemberEmailConfirmationDays` (modèle d'accesseur) | `(settings) => number`                                                                                    | `src/services/types/domain/association-settings-types.ts:1279` |
| `calendarDayOf`                                       | `(instant: Date) => string` (Paris)                                                                       | `src/services/types/domain/water-analysis-types.ts:155`        |
| `addDays`                                             | `(day: string, days: number) => string`                                                                   | `src/services/rules/campaign-schedule-rules.ts:26`             |
| `postLoginPathOf`                                     | `(user, organizationId) => PostLoginPath`                                                                 | `src/services/authorization/association-authorization.ts:57`   |
| `withTenant` / `getDb`                                | `<T>(organizationId, fn) => Promise<T>` (imbrication supportée) ; `() => ScopedDb`                        | `src/db/tenant-scope.ts:128`, l. 122                           |

## Traps & constraints

1. **`canOpenSessionOn` est pure, synchrone et importée par `auth.ts`.** La rendre asynchrone touche les cinq
   appelants et leurs tests (`association-membership.test.ts`, `association-session-guard.test.ts`,
   `auth-service-session-access.test.ts`, `auth-service-acting-context.test.ts`, tests du lien magique). Tout
   import de service ou de repository depuis `association-membership.ts` doit rester **dynamique**
   (`import()`), sinon le cycle `auth.ts` → … → `auth.ts` revient et
   `magic-link-integration-imports.test.ts` échoue.
2. **Lecture RLS dans le chemin de session.** `member_profile_account`, `parcel_ownership`, `member_profile`
   et `organization_setting` sont scopées : la condition doit s'exécuter sous `withTenant(organization.id)`.
   Hors scope, la requête ne rend **rien** (« un oubli de scope ne fuite pas : il ne retourne rien ») — ce qui
   fermerait l'accès de tous les membres, ou l'ouvrirait selon le sens de la règle. Cas à tester
   explicitement. `user`/`member` sont, eux, exemptés (ADR 014).
3. **Coût par requête.** `getAuthUser` est appelé à chaque requête authentifiée ; la condition ajoute au
   moins une lecture (fiches liées + périodes + réglage). `cache()` dédoublonne dans la requête, pas au-delà.
   Ne pas la poser en `'use cache'` : donnée par utilisateur, et `new Date()` est interdit dans un scope caché.
4. **Caches qui pourraient retarder la coupure** : `customSession` relit le compte à chaque `getSession`
   (pas de retard serveur) ; `getCurrentUserDal` (`'use cache: private'`, `cacheLife('minutes')`, admin
   uniquement) et le cache client de Next (`staleTimes`) peuvent montrer un état périmé quelques minutes
   dans l'interface — ADR 038 : aucune décision d'accès ne doit en dépendre, la preuve e2e se fait par
   **rechargement réel**.
5. **Rôles non `member`.** Un membre du bureau ou la présidence n'a qu'une ligne `member` de rôle `board` /
   `owner` : la condition ne doit pas lui refuser la session (il garde le bureau), mais ses fiches closes
   doivent quand même sortir de son espace membre si la règle est par fiche. Le SuperAdmin passe partout, y
   compris en connexion à la place d'un compte (s48 : `getAuthUser` juge le **compte vu**, donc un SuperAdmin
   agissant à la place d'un vendeur hors délai serait refusé — à décider). La coupure ne doit **rien
   supprimer** : surtout pas `closeMemberAccount` / `deleteMemberWithRoleDao` (critère 7 : rachat sans
   intervention ; un lien supprimé ne reviendrait pas).
6. **`getMyMemberProfiles` sert aussi le bureau** (`findEmailHolder`, `readAccountView` → « Ce compte réunit
   aussi », traces de rôle via `getMemberProfilesByUserIdDao`). Filtrer les fiches closes à ce niveau ferait
   disparaître des fiches de l'écran du bureau et fausserait la détection d'une adresse partagée (s53
   critère 3). Le filtre doit viser les lecteurs **côté membre** seulement, ou être une fonction distincte.
7. **Écritures côté membre sur toutes les fiches liées** : `updateMyMemberProfilesContactDao` (coordonnées,
   s16/s53) et l'ajout d'adresse de s54 (`my-email-service`, sur toutes les fiches) continueraient d'écrire
   sur une fiche close si seule la lecture est filtrée. Même question pour la « première fiche » des
   signalements (s22) et questions (s23) — `orderMyProfiles` met les fiches sans parcelle actuelle en
   dernier, mais une fiche close resterait la seule d'un compte en délai.
8. **Contournement par identifiant** : filtrer « Mes factures » / « Mes documents » ne suffit pas ;
   `getMyInvoicePdfUrlService` et `readMemberDocumentFileService` reçoivent un identifiant venu du
   navigateur et ne contrôlent que la possession. Le filtre « avant la vente » et la fermeture de fiche
   doivent s'y appliquer aussi (sinon un vendeur ouvre un document d'après la vente par son id, ou un
   document d'une fiche close s'il garde une session via une autre fiche). La branche
   `member.document.manage` (bureau) ne doit pas être filtrée.
9. **Jour de l'échéance.** Périodes demi-ouvertes : `ends_on` = jour de la vente, premier jour de
   l'acquéreur. « Six mois à partir de la fin de la dernière période » : borne à fixer (`ends_on + délai`
   inclus ou exclu) et calcul en **jour calendaire de Paris** (`calendarDayOf`), comme toutes les dates de
   propriété. Ajouter des mois à un 31 (31/08 + 6 mois) n'a pas de résultat évident ; `addMonths` de
   date-fns ramène au dernier jour du mois.
10. **Fiches sans aucune période** (Ferrand au seed ; fiches créées par le bureau avant le rattachement d'une
    parcelle ; test e2e « C7 — une fiche sans parcelle voit Mes coordonnées », `member-accounts.spec.ts:824`) :
    « toutes ses périodes sont closes » est vrai à vide. Les traiter comme closes casserait les e2e de s16 et
    s54 et fermerait des comptes valides.
11. **Seed à dates fixes = bombe à retardement.** Une fixture « vendeur avec compte » datée en dur
    basculerait d'état avec le temps réel (Dubois, vendu le 15/06/2026, aurait atteint six mois le
    15/12/2026). Les e2e doivent poser leurs périodes **relativement à aujourd'hui** (SQL direct, patron de
    `member-accounts.spec.ts:198-219`) et nettoyer. Le serveur e2e tourne sur l'horloge réelle : l'horloge
    doublée du critère 3 se prouve en **unitaire** sur la règle pure (et le service avec `vi.setSystemTime`).
12. **Tests unitaires existants** : 14 fichiers de `src/services/__tests__/` simulent
    `getMemberProfilesByUserIdDao` / `getMyMemberProfiles` (member-space ×2, member-document, incident-report,
    member-question, my-email, member-role, member-profile, member-email-confirmation…). Un nouveau DAO ou
    un nouvel argument dans ces chemins casse leurs mocks. Les tests qui simulent `getAuthUser` ne verront pas
    la règle de session (ADR 038) : la coupure se prouve en e2e. Vitest sur montage 9p : lancer
    `pnpm test --run <chemin>` ciblé, sur copie en disque local si timeouts.
13. **Envois vers une fiche close** : `issueInvitation` refuse déjà un compte qui ne passe pas
    `canOpenSessionOn` (« aucun lien »), mais le lancement des invitations (s42b,
    `member-invitation-campaign-service.ts`, cible `getCampaignTargetRowsDao`) et les campagnes « tous »
    ciblent toutes les fiches : une fiche close recevrait une invitation sans lien utilisable, ou des
    campagnes. Hors périmètre déclaré de s57, à signaler.
14. **Paramètre** : aucune section de réglages « membres » ; aucune unité « mois ». Une valeur `0` ou vide
    doit être refusée ou définie (`min`). ADR 010 : la valeur de seed (6 mois) va dans le registre (défaut)
    **et** dans `TEST_TENANT_SETTINGS` du premier tenant, avec la mention de l'attente du conseil RGPD.
15. **Vente non corrigeable** : une période close est immuable (ADR 029 §4). Une date de vente saisie par
    erreur fixerait une échéance fausse sans moyen de la corriger dans l'application (hors s57, mais la date
    prévue affichée au bureau rend l'erreur visible).
16. **`docs/architecture.md`** : si une nouvelle donnée est stockée (ex. date de coupure figée), il faut la
    déclarer à l'inventaire s12c ; s38/s39 ne sont pas livrées, rien à compléter de leur côté. Une règle
    purement calculée n'ajoute rien. Tout choix structurant (règle de session asynchrone, filtre par fiche)
    appelle un ADR complétant l'ADR 038.

## Open questions

1. **Échelle de la règle : par fiche ou par personne ?** Le modèle est « une fiche par terrain ». Lecture A
   (par fiche) : une fiche dont toutes les périodes sont closes ferme `délai` après sa dernière fin, pour
   **tous** ses comptes, même si le titulaire garde d'autres fiches ; la session reste ouverte tant qu'une
   fiche liée est ouverte. Lecture B (par compte) : le délai ne part que quand le compte n'a plus aucune fiche
   propriétaire. Le critère 5 (le proche perd **cette** fiche, garde celles où il est titulaire) et le
   critère 2 (« à ces fiches ») penchent pour A ; le critère 4 (« ne s'applique qu'à qui n'a plus aucun
   terrain ») est compatible avec A au niveau de la session mais laisse ouverte la question : **Lefèvre,
   qui vend le terrain de sa fiche 1 et garde les fiches 2 et 3, voit-il encore la fiche 1 (factures,
   documents) au-delà de six mois ?**
2. **Unité et sémantique du délai** : en mois (seed `6`, unité « mois » à créer) ou en jours (seed `183`,
   unité `days` existante) ? Échéance incluse ou exclue (dernier jour d'accès = `ends_on + 6 mois − 1` ou
   `ends_on + 6 mois`) ? Bornes `min` / `max` ? Section de la page « Réglages » ? Modifiable par le bureau
   ou par le SuperAdmin seul (`editableBy`) ?
3. **Changement du paramètre** : il s'applique rétroactivement à toutes les fiches (règle calculée), y
   compris pour rouvrir des accès déjà fermés si on l'allonge — acceptable, ou faut-il figer la date au
   moment de la vente ?
4. **Fiche sans aucune période** (jamais propriétaire, ou créée avant rattachement) : hors règle (accès
   ouvert comme aujourd'hui) ? Le texte ne la couvre pas.
5. **« Avant la vente » pour une fiche à plusieurs parcelles vendues à des dates différentes** : la borne
   est la fin de la **dernière** période (après laquelle la fiche ne possède plus rien) ou chaque vente ?
   Et pour un membre qui vend un terrain mais garde l'autre sur la **même** fiche (Meunier 12 + 13), le
   filtre du critère 6 s'applique-t-il dès la première vente ou seulement quand plus rien n'est possédé ?
6. **Facture impayée datée après la vente** : « une facture impayée reste visible » vise-t-il seulement les
   impayées d'avant la vente (déjà visibles par le filtre), ou aussi une impayée émise après la vente sur la
   fiche du vendeur ? Le filtre lit-il `issued_on`, `due_on` ou `year` ?
7. **Document daté après la vente** : `document_date` est saisi librement par le bureau (défaut jour du
   dépôt) ; un document déposé après la vente mais daté d'avant reste visible — c'est la date du document
   qui fait foi, ou la date de dépôt (`created_at`) ?
8. **« Relevés »** : s17/s18 ne sont pas livrées ; aucun relevé n'existe. Le critère 2 est-il réputé
   satisfait pour les relevés par construction (s18 portera son propre filtre), ou s57 doit-il attendre s18 ?
9. **Rachat (critère 7)** : par une nouvelle période sur **la même fiche** (le bureau rattache une parcelle),
   la fiche redevient propriétaire et tout rouvre. Par une **nouvelle fiche** (nouveau client Pennylane,
   import s13, même adresse reliée au compte, s53) : la session rouvre, mais l'ancienne fiche close
   reste-t-elle fermée (lecture A) ou rouvre-t-elle (lecture B) ?
10. **Membre du bureau qui vend tout** : il garde la session (rôle `board`/`owner`) ; ses fiches closes
    sortent-elles de son espace membre passé le délai, comme pour un membre ordinaire ? Et la présidence ?
11. **Écritures côté membre sur une fiche close** pendant qu'une autre fiche garde la session : coordonnées
    (s16/s53, toutes les fiches liées), ajout d'adresse (s54, toutes les fiches), signalement / question
    rattachés à la « première fiche » — exclure les fiches closes, ou les laisser écrire ?
12. **Pendant le délai** : « Mes terrains » doit-il dire au vendeur jusqu'à quand son accès reste ouvert
    (non exigé par les critères ; le critère 8 ne parle que du bureau) ? Faut-il un message de connexion
    distinct de l'écran D (« accès fermé ») pour un vendeur hors délai ?
13. **Date de fin d'accès prévue au bureau** : affichée seulement pendant le délai, ou aussi après (« accès
    fermé depuis le … ») ? Sur la fiche close seule, ou aussi pour les comptes (titulaire et proches) qui la
    portent ? Que montrer pour une fiche courrier uniquement (sans compte) — la date quand même ?
14. **Connexion à la place d'un compte (s48)** : le SuperAdmin peut-il encore ouvrir l'espace d'un vendeur
    hors délai (la règle juge le compte vu) ? La règle « le SuperAdmin peut tout faire » (mémoire) le
    suggère ; à trancher.
15. **Invitations et campagnes vers une fiche close** (s42b, s25/s27) : à exclure dans s57, ou laissé au
    bureau (cible « tous ») ?
