# Research — Story s53-un-acces-plusieurs-terrains

## Target story

**En tant que** propriétaire de plusieurs terrains **je veux** me connecter une seule fois et retrouver
tous mes terrains, leurs factures et leurs relevés **afin de** ne pas gérer autant d'accès que de
compteurs. Complexité 4. Dépendances : s12, s12d, s13, s16, s25 (toutes mergées sur `main`, s25 en
#63, s13 en #59).

Critères d'acceptation (docs/stories.md) :

1. Une même adresse peut figurer sur plusieurs fiches d'une association : une seule personne, un seul
   compte relié à chacune.
2. Après connexion, arrivée sur « Mes terrains » qui liste les terrains (fiche, parcelle, compteur),
   sans changer de compte. Factures et consommation : s19 et s18, pas ici.
3. Le bureau saisit sur une fiche une adresse déjà portée par une autre fiche : le site nomme le
   détenteur du compte existant et demande confirmation. Confirmé → fiche reliée à ce compte ; refusé
   → rien n'est enregistré. Aucun compte fusionné.
4. Un membre ne voit que les fiches reliées à son compte : accès croisé testé en forgeant l'identifiant
   d'une fiche d'un autre membre, même association et autre association.
5. L'import de s13 ne rejette plus une ligne pour adresse déjà portée : fixture anonymisée versionnée
   (25 lignes, 10 adresses partagées), une fiche par client Pennylane, reliées au même compte ; chaque
   regroupement signalé au rapport.
6. Retirer l'adresse d'une fiche ne ferme pas l'accès aux autres fiches du même compte : l'accès se
   ferme quand plus aucune fiche ne porte l'adresse.
7. Une campagne n'envoie qu'un message par adresse (dédoublonnage au calcul de la cible de s25).
8. Le bureau voit, dans la liste des membres, le nombre de terrains que porte chaque compte.

Notes à retenir : modèle « une fiche par client Pennylane, donc par terrain » ; relation à introduire =
**table de liaison fiche ↔ compte** (s54 s'en sert dans l'autre sens : une fiche, plusieurs comptes) ;
un nouvel ADR remplace l'ADR 037 ; déclarer les tables à l'inventaire de s12c et à l'export de s38 ;
RLS forcée + test d'accès croisé entre deux associations. « À trancher en `/ks-design` » : s16 corrige
une fiche ou toutes.

## Current state of the code

### Modèle (`src/db/models/member-profile-model.ts`)

`member_profile` : `id` (uuid), `organization_id`, `name`, `email` (nullable), `phone`, `address_line`,
`address_complement`, `postal_code`, `city`, `user_id` (nullable, FK `user` `SET NULL`),
`pennylane_customer_id`, `mail_only` **générée** (`email IS NULL`), `created_at`, `updated_at`.

Trois index uniques partiels, dont **deux contredisent la story** :

- `member_profile_organization_email_idx` : `(organization_id, lower(email)) WHERE email IS NOT NULL`
  — interdit deux fiches à la même adresse (critères 1, 3, 5) ;
- `member_profile_organization_user_idx` : `(organization_id, user_id) WHERE user_id IS NOT NULL`
  (ADR 037) — interdit deux fiches reliées au même compte ;
- `member_profile_organization_pennylane_idx` : reste valable (une fiche par client Pennylane).

`parcel` porte `meter_number` (s13, ADR 048). `parcel_ownership` : relation datée fiche ↔ parcelle.

Dernière migration : `0053_member_question_rls.sql`. Patron RLS d'une nouvelle table : migration
`drizzle-kit generate --custom` qui `ENABLE` + `FORCE ROW LEVEL SECURITY` et crée la policy
`tenant_isolation` sur `organization_id` (copie de `0053`/`0042`).

### Repository (`src/db/repositories/member-profile-repository.ts`)

- `EMAIL_INDEX` + `isEmailTakenViolation` : traduit la violation `23505` de l'index email en
  `{status: 'email_taken'}` dans `createMemberProfileTxnDao` et `updateMemberProfileContactTxnDao`
  (point de sauvegarde `getDb().transaction`).
- `getMemberProfileByEmailDao(organizationId, email)` : rend **une** fiche (`[row]`).
- `setMemberProfileUserIdDao(memberProfileId, userId | null)`.
- `getUnlinkedMemberProfilesWithEmailDao(organizationId)` : fiches à adresse sans `user_id`.
- `getMemberProfileByUserIdDao(organizationId, userId)` : « ma fiche », **singulier** (`[row]`, sans
  `orderBy`) — avec plusieurs fiches liées, rendrait une fiche arbitraire.
- `updateMyMemberProfileContactDao(organizationId, userId, contact)` : `UPDATE … WHERE organization_id
AND user_id` + `.returning()` puis `[row]` — avec plusieurs fiches, **met à jour toutes** les fiches
  du compte et n'en rend qu'une.
- `getMemberProfilePageDao` : liste du bureau (nom, parcelles actuelles via
  `getCurrentParcelNumbersByProfile`), aucun comptage par compte.

### Compte d'une fiche (`src/services/member-account-service.ts`, ADR 037)

- `openMemberAccount` : `findOrCreateUserId` (par email minuscule, `getUserByEmailDao` /
  `createUserIfAbsentTxnDao`), `createMemberIfAbsentTxnDao` (rôle `member`), puis
  `setMemberProfileUserIdDao`. Retrouve déjà le même `user` pour une adresse connue : la mécanique
  « un compte par adresse » existe, seuls les index l'empêchent sur deux fiches.
- `closeMemberAccount` : `deleteMemberWithRoleDao(userId, organizationId, 'member')` **puis** vide le
  lien. Avec un compte partagé, retirer l'adresse d'une fiche **retirerait la ligne `member`** et
  fermerait l'accès aux autres fiches — viole le critère 6.
- `replaceMemberAccount` : verrou des rôles, déplace le rôle vers le compte de la nouvelle adresse,
  retire la ligne `member` de l'ancien compte (`deleteMemberWithRoleDao`) — même problème : l'ancien
  compte peut encore porter d'autres fiches.
- `applyMemberAccountDecision`, `openMemberAccountsForOrganization` (seed, s13), `unlinkMemberAccount`,
  `getLinkedAccountRole`.
- Règle pure `decideMemberAccount` (`src/services/rules/member-account-rules.ts`) : `open` / `close` /
  `unlink` / `replace` / `none` / `refuse_board_removal`, à partir de `savedEmail`, `nextEmail`,
  `linkedRole`. Ne connaît pas l'existence d'autres fiches sur la même adresse.

### Services fiche (`src/services/member-profile-service.ts`)

- `createMemberProfileService` / `updateMemberProfileContactService` : écrivent, traduisent
  `email_taken` via `emailTaken()` (`getMemberProfileByEmailDao` → `{status: 'email_taken',
memberProfileId}`), puis `applyMemberAccountDecision`. Aucune notion de confirmation.
- `toProfileWithAccount` / `readAccount` / `roleCardOf` : carte « Accès à l'espace membre » de la fiche.
- `findMemberProfileIdByPennylaneIdService` : idempotence de l'import.

### Écran bureau (critère 3, 8)

- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` (`toActionResult`) : `email_taken` →
  relit la fiche détentrice (`getMemberProfileService`) et rend `{status: 'email_taken',
memberProfileId, name}`.
- `member-profile-form.tsx` (création) et `member-profile-detail.tsx` (modification des coordonnées) :
  affichent `EmailHolder` (`t('emailTaken', {name})` = « Cette adresse est déjà celle de la fiche de
  {name}. » + lien vers la fiche) — état `2e` du design s12. C'est l'endroit où brancher la
  confirmation du critère 3.
- `member-profile-list.tsx` : tableau + cartes mobiles (`columns.parcels`, `columns.contact`) ; DTO
  `MemberProfileListItemDTO` (`src/services/types/domain/member-profile-types.ts:73`). Le badge de rôle
  vient de `readBoardRoles` (map `userId → rôle`).

### Import (s13, `src/services/member-import-service.ts`)

- `createProfile` appelle `createMemberProfileService` et convertit `email_taken` en rejet
  `ImportRejectionConst.EMAIL_TAKEN` (critère 5 à lever).
- Remarques du rapport : `ImportRemarkConst` = `several_emails`, `postal_code_padded`, `no_meter`,
  `same_name_and_address` (`src/services/types/domain/member-import-types.ts`). Les remarques sont
  calculées **au mapping** (`src/lib/import/pennylane-clients-mapper.ts`, `sameNameAndAddressRemarks`,
  avec `relatedLine`), pas à l'écriture : patron réutilisable pour un regroupement « adresse partagée ».
- `buildReport` filtre les remarques des lignes rejetées.
- Fixture e2e existante : `e2e/fixtures/member-import-fictif.csv` (6 lignes, en-têtes Pennylane). Le
  fichier réel `docs/inputs/Base-adherents-utf8.csv` est **hors git** (données client) : ne jamais le
  versionner ni le copier ; la fixture du critère 5 se construit à la main.

### Lectures « ma fiche » au singulier — inventaire exigé par la story

Tous les appelants de `getMemberProfileByUserIdDao` / `updateMyMemberProfileContactDao` :

| Appelant                                                                   | Story | Usage                                                        |
| -------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `member-space-service.ts` `getMyParcelsService`                            | s12d  | « Mes parcelles » : nom + parcelles actuelles/anciennes      |
| `member-space-service.ts` `getMyContactService`                            | s16   | coordonnées affichées                                        |
| `member-space-service.ts` `updateMyContactService` (via `updateMyMember…`) | s16   | écrit téléphone + adresse postale                            |
| `incident-report-service.ts:488` `createMyIncidentReportService`           | s22   | `memberId: profile.id`, nom/email/téléphone copiés           |
| `incident-report-service.ts:537` `readForMyProfile`                        | s22   | « Mes signalements » (`getMyIncidentReportsDao(profile.id)`) |
| `member-question-service.ts:223` `createMyQuestionService`                 | s23   | `memberId: profile.id`                                       |
| `member-question-service.ts:264` `readForMyProfile`                        | s23   | sujets, identité affichée                                    |
| `member-role-service.ts:148, 395` (passation)                              | s14   | `memberProfileId` de la trace de rôle                        |
| `organization-service.ts:894` `traceMemberRemoval`                         | s14   | `memberProfileId` de la trace de retrait                     |

Non livrées (rien à adapter aujourd'hui, mais à concevoir au pluriel) : s18 (consommation), s19
(factures), s31/s32 (documents) — aucun service `invoice`/`document`/`consumption` dans `src/services`.

### Espace membre (présentation)

- `src/app/[locale]/(app)/dashboard/page.tsx` : `getMyParcelsDal`, `getMyContactDal`,
  `getMyIncidentReportsDal` (`src/app/dal/member-space-dal.ts`, `cache()`, données par utilisateur
  derrière `<Suspense>`), composant `MemberSpace` (`src/components/features/member-space/member-space.tsx`).
- `MyParcelsDTO` (`member-space-types.ts`) = `{name, current: {number, startsOn}[], former: …}` : **une**
  fiche, **pas de compteur**. `getCurrentParcelsByMemberDao` (`parcel-ownership-repository.ts:160`) ne
  sélectionne pas `meter_number`.
- Libellés `messages/fr.json` : « Bonjour {name} », `markerParcels`, `parcels.title`… — le titre
  « Mes terrains » n'existe pas encore.

### Campagnes (s25/s26, critère 7)

- `getCampaignTargetRowsDao` (`campaign-repository.ts:107`) : une ligne **par fiche**
  (`memberProfileId`, `name`, `email`, `unsubscribed`), triée par nom puis id.
- `computeCampaignTarget` (`src/services/rules/campaign-rules.ts:97`) : règle pure, classe sans email /
  désinscrit / destinataire. **Point de passage unique** (`readTarget`, `campaign-service.ts:244`) :
  c'est là que le dédoublonnage par adresse se pose.
- `campaign_recipient` : `UNIQUE (campaign_id, member_profile_id)`, jeton de désinscription par ligne ;
  `getPendingPartRecipientsDao` relit nom, email et désinscription **par la fiche** de la ligne.
- `member_unsubscribe` : **une ligne par fiche, jamais par adresse** (ADR 051).
- Variables de personnalisation : `CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date']`
  (`campaign-types.ts:20`), valeurs lues sur la fiche du destinataire.

### Sauvegarde et export

- s12c : `pg_dump` sous `asl_backup` qui a `pg_read_all_data` (docs/exploitation/README.md:486) : une
  nouvelle table est couverte sans grant. La « déclaration à l'inventaire » = la ligne de la table dans
  `docs/architecture.md` (tableau des tables, compteur « Les 46 tables du schéma… », l. 355) avec la
  mention « s38 devra la déclarer », comme pour `member_note` ou `campaign_recipient`.
- s38 (export) : non livrée.

## Anchor points

- **Modèle** : `src/db/models/member-profile-model.ts` (index à retirer/remplacer) ; nouvelle table de
  liaison dans `src/db/models/` + `db.ts` ; migration générée (`pnpm db:generate`) + migration RLS
  `--custom`.
- **Compte** : `member-account-service.ts` (`openMemberAccount`, `closeMemberAccount`,
  `replaceMemberAccount`, `unlinkMemberAccount`, `openMemberAccountsForOrganization`) et
  `rules/member-account-rules.ts` (`decideMemberAccount`).
- **Écriture bureau** : `member-profile-service.ts` (`createMemberProfileService`,
  `updateMemberProfileContactService`, `emailTaken`) ; actions `bureau/proprietaires/actions.ts` et
  `[id]` ; composants `member-profile-form.tsx`, `member-profile-detail.tsx` (`EmailHolder`).
- **Liste bureau** : `getMemberProfilePageDao`, `getMemberProfilePageService`,
  `MemberProfileListItemDTO`, `member-profile-list.tsx`.
- **Import** : `member-import-service.ts` (`createProfile`), `pennylane-clients-mapper.ts`
  (remarques), `member-import-types.ts`, fixture sous `e2e/fixtures/`, `e2e/member-import.spec.ts`.
- **Espace membre** : `member-space-service.ts`, `member-space-dal.ts`, `member-space-types.ts`,
  `dashboard/page.tsx`, `member-space.tsx`, `parcel-ownership-repository.ts`.
- **Autres lecteurs** : `incident-report-service.ts`, `member-question-service.ts`,
  `member-role-service.ts`, `organization-service.ts` (tableau ci-dessus).
- **Campagnes** : `campaign-rules.ts` (`computeCampaignTarget`), `campaign-service.ts` (`readTarget`),
  `campaign-repository.ts`.
- **Docs** : nouvel ADR (remplace 037 ; numéro suivant : **054**), `docs/architecture.md` (description
  `member_profile`, tableau des tables, compteur).

## Verified APIs / functions

- `getDb()` / `withTenant(organizationId, fn)` : `src/db/tenant-scope.ts` (utilisés partout ci-dessus).
- `getMemberProfileByUserIdDao(organizationId: string, userId: string): Promise<MemberProfileModel | undefined>`.
- `updateMyMemberProfileContactDao(organizationId, userId, contact: MemberPostalContactWrite): Promise<MemberProfileModel | undefined>`.
- `getMemberProfileByEmailDao(organizationId, email): Promise<MemberProfileModel | undefined>`.
- `setMemberProfileUserIdDao(memberProfileId, userId: string | null): Promise<void>`.
- `createMemberProfileTxnDao(input) → {status:'created', row} | {status:'email_taken'}`.
- `updateMemberProfileContactTxnDao(id, contact) → updated | not_found | email_taken`.
- `openMemberAccount({organizationId, memberProfileId, email, name}): Promise<{userId}>`.
- `closeMemberAccount({organizationId, memberProfileId, userId}): Promise<void>`.
- `replaceMemberAccount({…, previousUserId, author}): Promise<{userId}>`.
- `applyMemberAccountDecision({organizationId, author, profile, decision}) → {change, userId}`.
- `decideMemberAccount({savedEmail, nextEmail, linkedRole}): MemberAccountDecision`, `sameEmail(a, b)`.
- `deleteMemberWithRoleDao(userId, organizationId, role)` → nombre de lignes retirées (utilisé
  `removed === 1`) ; `createMemberIfAbsentTxnDao`, `getUserOrganizationDao`, `lockOrganizationRolesDao`
  (`organization-repository.ts`).
- `getUserByEmailDao`, `createUserIfAbsentTxnDao` (`user-repository.ts`).
- `getCurrentParcelsByMemberDao(memberProfileId) → {parcelId, number, startsOn}[]` ;
  `getMemberFormerParcelsDao(memberProfileId) → {number, startsOn, endsOn}[]`.
- `computeCampaignTarget<Row extends CampaignTargetRow>(rows) → {recipients, withoutEmail, unsubscribed}`.
- `getCampaignTargetRowsDao(organizationId) → {memberProfileId, name, email, unsubscribed}[]`.
- `ImportRejectionConst.EMAIL_TAKEN`, `ImportRemarkConst.*` ; `mapPennylaneClients(table)`.
- `canOpenSessionOn` (`src/lib/better-auth/association-membership.ts`) : l'ouverture et chaque lecture
  de session (ADR 034/038) se fondent sur la **ligne `member`**, pas sur la fiche : un compte partagé
  garde l'accès tant que sa ligne `member` existe.

## Traps & constraints

- **Les deux index uniques** (email, `user_id` par association) sont la barrière actuelle et aussi la
  protection contre les **courses** (ADR 037 « violation d'unicité absorbée dans un point de
  sauvegarde »). Les retirer supprime `email_taken` côté base : la détection d'une adresse déjà portée
  et la confirmation du critère 3 doivent être **refaites côté service**, et la confirmation doit être
  revérifiée au serveur (un appel direct sans confirmation ne doit pas relier une fiche).
- **Fermeture d'accès** : `closeMemberAccount` et `replaceMemberAccount` retirent la ligne `member`
  sans regarder les autres fiches du compte → violation directe du critère 6. Il faut « retirer la
  ligne `member` seulement quand plus aucune fiche du compte ne porte l'adresse ».
- **`updateMyMemberProfileContactDao` écrit déjà toutes les fiches du compte** dès que le lien est
  plusieurs-à-un ; c'est peut-être le comportement voulu (question s16 à trancher en design), mais il
  est aujourd'hui accidentel.
- **`getMemberProfileByUserIdDao` sans `orderBy`** : un appelant oublié affiche/attache une fiche
  arbitraire (s22, s23 attachent `memberId`). Le test d'accès croisé (critère 4) doit couvrir tout
  point d'entrée qui prendrait un identifiant de fiche du navigateur — aujourd'hui **aucun** chemin
  membre n'en prend ; s'il en apparaît un (choix du terrain), il doit être vérifié contre les fiches
  reliées au compte.
- **Rôle du bureau** : `decideMemberAccount` refuse de vider l'adresse d'un compte `board`/`owner`
  (`refuse_board_removal`). Avec plusieurs fiches, vider l'adresse d'une fiche d'un membre du bureau
  qui en garde une autre ne retire pas le rôle : la règle peut s'assouplir, ou non — à décider.
- **Traces de rôle** (`member_role_event.member_profile_id`) : une seule fiche par trace ; avec
  plusieurs fiches, le choix doit être déterministe (ou nul).
- **Campagnes** : `campaign_recipient` est unique par `(campaign_id, member_profile_id)` et relit nom,
  parcelles et désinscription **par fiche** ; dédoublonner par adresse implique de choisir la fiche
  « porteuse » de la ligne d'envoi et de définir `{nom}` / `{parcelle}` pour une adresse à plusieurs
  fiches. La désinscription est par fiche (ADR 051) : une adresse dont une fiche est désinscrite et
  l'autre non est un cas à trancher. Le budget d'envoi (s52) compte les envois : dédoublonner le réduit.
- **Import** : une transaction de tenant par membre ; la deuxième fiche d'une adresse s'écrit dans une
  transaction suivante, après l'ouverture du compte de la première — `findOrCreateUserId` retrouvera le
  `user`. Le rapport doit signaler chaque regroupement (pas seulement le compter). Ne pas confondre avec
  `same_name_and_address` (déjà existante).
- **Migration** : `user_id` est peuplé sur ~300 fiches en recette/production ; passer à une table de
  liaison demande une migration de données `--custom` (copie des liens existants) avant de retirer la
  colonne, journal/snapshots générés par drizzle-kit (jamais de SQL à la main hors `--custom`).
- **RLS non testable en unitaire** : `db.ts` refuse la connexion en test ; l'isolation (critère 4,
  deux associations) se prouve en **e2e Playwright** — lancé en CI GitHub, pas en local.
- **ADR immuables** : nouvel ADR qui remplace 037 ; l'ADR 040 (adresse modifiée par le bureau seul)
  reste valable pour s53 (s54 le remplacera).
- **Données client** : fixture du critère 5 anonymisée, construite à la main ; ne rien dériver du
  fichier réel hors git (noms, adresses, montants).
- **Tests existants à faire évoluer** : `member-account-service.test.ts`, `member-profile-service.test.ts`,
  `member-import-service.test.ts`, `member-space-service.test.ts`, `campaign-service.test.ts`,
  `incident-report-my-reports.test.ts`, `member-question-service.test.ts`, `member-role-service.test.ts`,
  `organization-member-removal.test.ts`, `pennylane-clients-mapper.test.ts`, composants
  `member-profile-form.test.tsx`, `member-profile-detail.test.tsx`, `member-profile-list.test.tsx`,
  `member-space.test.tsx` ; e2e `member-accounts.spec.ts` (critère 3 de s12d « même adresse sur deux
  associations »), `member-import.spec.ts`, `member-profiles.spec.ts`, `campaigns.spec.ts`,
  `tenant-isolation.spec.ts`.
- Tests unitaires lents sur le montage 9p (`/workspace`) : valider sur une copie en disque local ; un
  timeout n'est jamais un vert. `pnpm test --run`, jamais `pnpm test`.

## Open questions

1. **Forme du lien** : table de liaison `member_profile_account (organization_id, member_profile_id,
user_id)` sous RLS forcée, comme le préconise la note de la story (et réutilisable par s54 dans
   l'autre sens), avec reprise des `user_id` existants et retrait de la colonne — ou garder
   `member_profile.user_id` en ne retirant que l'index unique (plus simple, mais s54 devra migrer
   encore). Recommandation de la story : la table. À acter dans l'ADR 054.
2. **« Nombre de terrains que porte chaque compte »** (critère 8) : nombre de **fiches** reliées au
   compte (une fiche = un client Pennylane = un terrain, selon le modèle retenu) ou nombre de
   **parcelles actuelles** cumulées ? La story assimile terrain et fiche ; à confirmer en design.
3. **Coordonnées (s16)** : le membre corrige-t-il une fiche ou toutes ? (à trancher en `/ks-design`,
   dit la story). Le DAO actuel les écrirait toutes.
4. **Signalements (s22) et questions (s23)** : à quelle fiche se rattache une nouvelle déclaration d'un
   compte à plusieurs fiches (choix du terrain par le membre, ou fiche déterminée) ? « Mes
   signalements » liste-t-il ceux de toutes les fiches ?
5. **Campagnes** : quelle fiche porte la ligne `campaign_recipient` d'une adresse partagée ; valeurs de
   `{nom}` et `{parcelle}` (fusion des parcelles ?) ; une désinscription vaut-elle pour toutes les fiches
   de l'adresse, et une adresse dont une seule fiche est désinscrite reçoit-elle la campagne ?
6. **Critère 3 — « le détenteur du compte existant »** : nommer le compte (`user.name`) ou la/les fiches
   qui portent l'adresse ? Et la confirmation s'applique-t-elle aussi à la création d'une fiche
   (écran 2) et à la modification (fiche `[id]`) — oui d'après le critère, à refléter dans le design.
7. **Fiche d'un membre du bureau** : vider l'adresse d'une de ses fiches quand il en garde une autre
   reste-t-il refusé (`refuse_board_removal`) ?
8. **Fiche du bureau, carte « Accès à l'espace membre »** : doit-elle mentionner les autres fiches
   reliées au même compte (utile au bureau pour déceler une erreur) ? Non exigé par les critères.
9. **Signalement au rapport d'import** (critère 5) : une remarque par ligne regroupée (avec
   `relatedLine`, patron `same_name_and_address`) ou une entrée par regroupement ? Calculée au mapping
   (sans base) ou aussi contre les fiches déjà en base (adresse portée par une fiche existante hors
   fichier) ?
