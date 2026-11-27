# Research — Story s56-import-annuel-coordonnees

Lue sur `main` à `f28db2cf` (s57 mergée, #88). Toutes les dépendances sont livrées : s13 (#59, import
initial), s20 (#76, factures Pennylane, identifiant sur la fiche), s53 (#70), s54 (#71), s55 (#72). Aucune
ligne de code n'est écrite ici.

## Target story

**En tant que** présidente **je veux** déposer chaque année le fichier clients de Pennylane **afin que** les
coordonnées des membres soient à jour sans ressaisie ni passage par le prestataire. Complexité 3.
Dépendances : s13, s20, s53, s54, s55 (docs/stories.md:4221).

Critères d'acceptation (docs/stories.md:4232-4243) :

1. La présidente dépose le fichier depuis le back-office **de son association**, sans le SuperAdmin ;
   l'action est **déclarée au registre**, avec **Président(e) par défaut**.
2. Rapprochement par l'identifiant client Pennylane (ADR 048) ; adresses postales, téléphone et adresses
   email mis à jour, **sauf une valeur modifiée sur le site après le dernier import**, conservée et
   signalée au rapport (défaut à confirmer avec La Fourche).
3. Le fichier **remplace** l'adresse titulaire (s54) : la nouvelle devient titulaire (la première de la
   cellule s'il y en a plusieurs), l'ancienne n'est plus active ; le propriétaire se connecte avec la
   nouvelle. Le rapport signale le remplacement.
4. Titulaire **absente** du fichier sans adresse nouvelle qui la remplace : elle n'est plus active ; le site
   **désigne arbitrairement** une autre adresse restée active (présente dans le fichier, ou ajoutée sur le
   site). Le bureau est notifié de chaque désignation (fiche, ancienne et nouvelle titulaire) **au rapport et
   dans les notifications du back-office, sans email**. Sans autre adresse active : fiche sans adresse,
   courrier (s12).
5. Une adresse **venue d'un fichier précédent**, non titulaire, absente du nouveau fichier n'est plus active
   (défaut à confirmer avec La Fourche).
6. Comme s13 : toutes les adresses d'une cellule (s54) ; domicile et terrain depuis leurs colonnes (s55).
7. Identifiant inconnu : **pas** de création ; la ligne est listée « membre à créer à la main ».
8. L'import ne change **jamais** la propriété d'une parcelle (ventes saisies par le bureau, s12).
9. Une adresse **ajoutée sur le site** (s54) n'est pas supprimée par un fichier qui ne la contient pas.
10. Lignes invalides rejetées une à une, listées au rapport éphémère (ADR 047) ; **réimporter le même
    fichier ne change rien**.

Notes de la story retenues : réutiliser lecteur et mappage de s13 (ADR 047, 048), ajouter la voie « mise à
jour » (s13 ne fait que créer). Une fiche créée à la main n'a pas d'identifiant Pennylane : le bureau le
renseigne (s20), sinon l'import annuel ne la retrouve pas. Le terrain par défaut
(`member.default_land_postal_code` / `member.default_land_city`) est appliqué aux fiches **créées** : « à
décider ici » s'il s'applique à une mise à jour.

Réponse de La Fourche déjà consignée (hors git, `docs/Admin-MEL/questions-import-membres-la-fourche.md`,
tableau « Suites données (15 novembre 2026) », question 6) : « Le fichier n'écrase que les données jamais
modifiées sur le site depuis le dernier import. Les nouveaux membres se créent à la main. » — c'est la règle
du critère 2, formulée comme une suite donnée par la prestataire ; la story la tient encore pour « à
confirmer ».

Stories en aval qui lisent s56 : s58 (adresse votante, docs/stories.md:4332-4340 : la notification de
désignation doit nommer la nouvelle adresse votante), s42b (badge « Désactivée par l'import » prévu,
docs/designs/s42b-lancement-invitations.md:161, 180, 337 ; docs/design-system.md:1478).

## Current state of the code

### L'import de s13 (motif ADR 047, clé ADR 048)

| Couche | Fichier | Rôle aujourd'hui |
| --- | --- | --- |
| Lecteur CSV | `src/lib/import/csv-reader.ts` | `readCsv(bytes: Uint8Array): CsvReadResult` (l. 156), `normalizeHeader` (l. 43), types `CsvRecord` (l. 15, `line`, `values`, `wellFormed`), `CsvTable` (l. 22). UTF-8 strict puis Windows-1252, séparateur détecté, guillemets. Pur. |
| Mappage | `src/lib/import/pennylane-clients-mapper.ts` | `mapPennylaneClients(table): PennylaneMappingResult` (l. 323). Colonnes `PENNYLANE_COLUMNS` (l. 31-46) : requises `Identifiant Client`, `Dénomination`, `Référence Client`, `Liste d’e-mails`, `Adresse`, `Code Postal`, `Ville` ; facultatives `Pays`, `Téléphone`, `Adresse/Code Postal/Ville/Pays de Livraison`, `Type de Client`. Pur, aucune horloge, aucun paramètre lu. |
| Service | `src/services/member-import-service.ts` | `importMembersService(input: ImportMembersInput): Promise<ImportMembersResult>` (l. 391). |
| Façade | `src/services/facades/member-import-service-facade.ts` | `importMembersService` via `memberImportServiceInterceptor` (`interceptors/member-import-service-logger-interceptor.ts`). |
| Autorisation | `src/services/authorization/member-import-authorization.ts:8` | `canImportMembers(): Promise<boolean>` = `authUser?.role === RoleConst.SUPER_ADMIN`. **Hors registre**, SuperAdmin seul. |
| Validation | `src/services/validation/member-import-validation.ts:4` | `importMembersServiceSchema` : `{organizationId: uuid, content: Uint8Array}`. |
| Types | `src/services/types/domain/member-import-types.ts` | codes de refus (`ImportFileRefusalConst` l. 25), de rejet (`ImportRejectionConst` l. 38), de remarque (`ImportRemarkConst` l. 55) ; `ImportMemberCandidate` (l. 100), `ImportPlan` (l. 126), `ImportReportDTO` (l. 133), `ImportMembersResult` (l. 152) ; `OWNERSHIP_BEFORE_IMPORT_DATE = '1900-01-01'` (l. 15), `MEMBER_IMPORT_MAX_LINES = 2000` (l. 22), `MEMBER_IMPORT_MAX_FILE_BYTES` 16 Mo (l. 165), extension `.csv`. |
| Action | `src/app/[locale]/admin/membres-import/actions.ts` | `importMembersAction(_prevState?, formData?)` (l. 130) : `requireActionAuth({roles: [RoleConst.SUPER_ADMIN]})` (l. 137), `organizationId` **lu du formulaire** (l. 145), contrôle `.csv` et poids, appel façade, `revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN, 'layout')` (l. 168), `toState` (l. 97) ; messages `getTranslations('AdminMemberImport')` (`messages/fr.json:1636`). |
| Page | `src/app/[locale]/admin/membres-import/page.tsx` | `withAuthAdmin(MemberImportPage)` (l. 48) ; liste des associations (`getAllOrganizationsWithPaginationDal`, 500 max), paramètre `?association=`. `loading.tsx`, `error.tsx`. |
| Composants | `src/components/features/admin/member-import/` | `member-import-screen.tsx` (81 l.), `member-import-form.tsx` (303 l., sélecteur d'association + dépôt), `member-import-report.tsx` (413 l.), `member-import-state.ts` (`MemberImportFormState`, `importedAt`), `member-import-paths.ts` (`MEMBER_IMPORT_PATH = '/admin/membres-import'`), `organization-members-card.tsx` (point d'entrée sur la fiche de l'association). |

Déroulé de `importMembersService` (l. 391-429) : validation Zod → `canImportMembers()` sinon
`AuthorizationError(IMPORT_DENIED)` → `getOrganizationByIdService` → `planImport` (l. 357 : `readCsv`, plafond
de lignes, `mapPennylaneClients` ; refus du fichier entier **avant toute écriture**) →
`getDefaultLandAddress(await getAssociationSettingsService(organizationId))` (l. 410) → **une transaction de
tenant par membre** (`importMember`, l. 267 : `withTenant(organizationId, () => writeMember(...))`, une
`MemberRejected` levée annule tout le membre ; une `ValidationParsedZodError` d'un service est traduite en
motif par `rejectionOfValidation`, l. 115, table `FIELD_REJECTIONS` l. 79) → `buildReport` (l. 312) → journal
**en comptages seulement** (l. 422).

`writeMember` (l. 240) — **le seul point de bifurcation création / existant** :

```ts
const existingId = await findMemberProfileIdByPennylaneIdService(organizationId, member.pennylaneCustomerId)
if (existingId) {
  return {kind: 'already_present', parcels: await attachParcels(organizationId, existingId, member)}
}
```

- Fiche existante : **aucune coordonnée n'est touchée**, mais `attachParcels` (l. 211) **rattache** les
  parcelles du fichier (nouvelle période `starts_on = 1900-01-01`) ; une parcelle détenue par une autre fiche
  rejette **tout le membre** (`PARCEL_TAKEN`). Voir Traps (critère 8).
- Fiche nouvelle : `createProfile` (l. 137 ; `createMemberProfileService`, rejoue avec
  `confirmedAccountUserId` si `email_shared`), `addCellEmails` (l. 180 ; adresses 2…n par
  `addMemberProfileEmailService`, rôle par `importedEmailsPlan([], cell)`, origine `file`), `attachParcels`.
  Le terrain par défaut ne s'applique qu'ici (`landOf`, l. 97).

Rejet d'une ligne au mappage (`rejectionOf`, mapper l. 205) : `malformed_line`, `missing_customer_id`,
`missing_name`, `no_contact` (ni domicile ni email), `missing_reference`. Au service : `parcel_taken`,
`invalid_email`, `invalid_postal_code`, `invalid_phone`, `invalid_field`. Remarques :
`postal_code_padded` (4 chiffres + `FR`), `no_meter`, `same_name_and_address`, `shared_email`,
`shared_email_existing`.

Regroupement (`groupByCustomer`, mapper l. 265) : plusieurs lignes du même identifiant = un candidat ;
**coordonnées de la première ligne**, une parcelle par ligne.

Règle domicile / terrain (`homeAndLandOf`, mapper l. 194, arbitrage du 17/11, ADR 058) : `Adresse de
Livraison` renseignée → livraison = domicile, `Adresse` = terrain ; sinon `Adresse` = domicile, **pas de
terrain** (`land` undefined). `Type de Client = Entreprise` → `companyName = Dénomination` (l. 202, 253). Le
fichier **n'a aucune colonne de complément d'adresse**.

Emails de la cellule (`cellEmails`, mapper l. 125) : séparateurs `/[,;\s]+/`, dédoublonnés sans casse,
**ordre conservé** ; la première = `email`, les suivantes = `additionalEmails`.

### Fiche membre et identifiant Pennylane (ADR 048, s20)

- `src/db/models/member-profile-model.ts` : `phone` (l. 43), `home_address_line|complement|postal_code|city`
  (l. 44-47), `land_…` (l. 48-51), `company_name` (l. 52), `pennylane_customer_id` (l. 53, texte nullable),
  `created_at`, `updated_at` (l. 54-59). Index unique partiel `member_profile_organization_pennylane_idx`
  `(organization_id, pennylane_customer_id) WHERE pennylane_customer_id IS NOT NULL` (l. 62-64). **Aucune
  colonne de date d'import, aucun horodatage par champ, aucune origine des coordonnées postales.**
- Recherche par identifiant :
  - `findMemberProfileIdByPennylaneIdService(organizationId, pennylaneCustomerId)`
    (`src/services/member-profile-service.ts:295`) → `getMemberProfileByPennylaneIdDao`
    (`src/db/repositories/member-profile-repository.ts:576`) : **égalité stricte, sensible à la casse**.
  - `listMemberProfilesByPennylaneIdIgnoringCaseDao` (même fichier l. 666) : `lower(...) = lower(...)`,
    utilisé par `updateMemberProfilePennylaneIdService` (`member-profile-service.ts:324`) qui refuse un
    identifiant déjà porté **à la casse près** (saisie du bureau, s20 critère 4).
  - La synchro des factures de s20 rapproche en **ignorant la casse** (`matchKey`,
    `src/services/rules/pennylane-invoice-mapping.ts:78`).
- Écriture des coordonnées par le bureau : `updateMemberProfileContactService(input)`
  (`member-profile-service.ts:171`) → `updateMemberProfileContactTxnDao(memberProfileId, contact)`
  (repository l. 130, `set({...contact, updatedAt: now()})`). Schéma
  `updateMemberProfileContactServiceSchema` (`src/services/validation/member-profile-validation.ts:103`) :
  `phone`, `home*` (4), `land*` (4), `companyName` ; chaque champ passe par `optionalContact` (l. 26) qui
  transforme **absent ou vide en `null`** → l'appel **écrase tous les champs**, y compris les compléments.
- Écriture par le membre (s16) : `updateMyContactService` (`src/services/member-space-service.ts:244`) →
  `updateMyMemberProfilesContactDao` (repository l. 538) : `phone` + domicile, sur **toutes** les fiches
  liées au compte, `updatedAt = now()`. Le terrain et l'entreprise ne sont jamais écrits par le membre.
- Motifs (`src/services/types/domain/member-profile-types.ts`) : `MEMBER_PROFILE_PHONE_PATTERN =
  /^[0-9 +.\-()]+$/` (l. 32, 30 car. max, l. 31), `MEMBER_PROFILE_POSTAL_CODE_PATTERN = /^\d{5}$/` (l. 35).

### Adresses email d'une fiche (s54, ADR 056)

- Table `member_profile_email` (`src/db/models/member-profile-email-model.ts:52`) : `role`
  (`holder`|`additional`, enum l. 16), `status` (**`active`|`pending` seulement**, enum l. 21), `origin`
  (`file`|`site`, enum l. 26), `added_by_user_id`, `replaces_email_id`, `confirmation_token_hash`,
  `expires_at`, `unsubscribed_at` (ADR 057), `created_at`, `updated_at`. Index : unique
  `(member_profile_id, lower(email))` (l. 85), unique partiel une titulaire active par fiche (l. 89-91),
  `(organization_id, lower(email))` (l. 93). RLS forcée. Aucune autre table ne la référence par FK.
- **Il n'existe aucun état « inactive »** : une adresse « n'est plus active » aujourd'hui seulement en étant
  **supprimée** (`deleteMemberProfileEmailDao`, `src/db/repositories/member-profile-email-repository.ts:181`).
  Le refus des campagnes (`unsubscribed_at`) part avec la ligne.
- Origine : `file` posée par l'import (s13 création, `createMemberProfileService` si la fiche a un
  identifiant Pennylane ; `addCellEmails`) et par la reprise de s54 (titulaire d'une fiche à identifiant) ;
  `site` pour l'ajout du bureau (`addMemberProfileEmailService`, défaut l. 199-200), le remplaçant saisi au
  retrait (`removeMemberProfileEmailService`, l. 395), l'ajout et la modification du membre
  (`src/services/my-email-service.ts:350, 436`). **Une modification par le bureau garde l'origine** :
  `updateMemberProfileEmailService` n'écrit que `email` (+ `unsubscribedAt: null`) via
  `updateMemberProfileEmailDao` (repository l. 154) — une adresse `file` corrigée par le bureau reste `file`.
- Règles pures (`src/services/rules/member-email-rules.ts`) : `roleForNewActiveEmail` (l. 63),
  `planHolderDesignation` (l. 81), `planEmailRemoval` (l. 135 ; titulaire active retirée seulement avec une
  remplaçante, sauf dernière adresse active → courrier), `planReplacementConfirmation` (l. 153),
  `importedEmailsPlan(existing, cellEmails)` (l. 180) : **fiche existante = seules les adresses absentes
  s'ajoutent, supplémentaires, « l'ordre de la cellule ne déplace pas le titre »** — contraire au critère 3.
  En-tête (l. 20-24) : « Aucune promotion d'office ». s54 a acté l'exception s56 (docs/stories.md:4167-4171).
- Services du bureau (`src/services/member-profile-email-service.ts`), tous `member.profile.manage`, une
  transaction de tenant, purge des attentes échues :
  - `addMemberProfileEmailService({organizationId, memberProfileId, email, role?, origin?, confirmedAccountUserId?})` (l. 163) → `saved | already_listed | email_shared | not_found`.
  - `updateMemberProfileEmailService(...)` (l. 221).
  - `removeMemberProfileEmailService({…, emailId, replacementEmailId?, replacementEmail?})` (l. 325) →
    statuts de `planEmailRemoval` + `board_email_required` (adresse d'un membre du bureau sur sa dernière
    fiche, `decideMemberAccount` → `refuse_board_removal`, l. 370-372).
  - `designateMemberProfileHolderService({…, emailId})` (l. 421) : rétrograde puis promeut.
- Comptes (`src/services/member-account-service.ts`) : `closeMemberAccount` (l. 180, délie ce compte de
  cette fiche, ligne `member` retirée seulement sans autre fiche et rôle `member`), `replaceMemberAccount`
  (l. 217, la fiche quitte l'ancien compte pour le nouveau ; **si c'était sa dernière fiche, le rôle bureau
  ou présidence suit la nouvelle adresse**, tracé ADR 039), `applyMemberAccountDecision` (l. 284).
- Support (`src/services/member-profile-support.ts`) : `findEmailHolder` (l. 125, compte d'une autre fiche
  qui porte l'adresse → `email_shared`), `confirmedHolder` (l. 154), `readProfileEmails` (l. 195),
  `activatePendingEmail` (l. 370).
- Adresse partagée : le rôle est **propre à chaque fiche** (seed : Paul Ferrand supplémentaire sur la fiche
  de Claire Meunier) ; une même adresse peut être titulaire d'une fiche et supplémentaire d'une autre.
  Désactiver une adresse sur une fiche ne doit délier que **ce** compte de **cette** fiche (ADR 056 §3).

### Domicile, terrain, terrain par défaut (s55, ADR 058)

- Paramètres `member.default_land_postal_code` / `member.default_land_city`
  (`src/services/types/domain/association-settings-types.ts:302-304`, déclarés au registre l. 633…),
  **sans défaut dans le code**, lus par `getDefaultLandAddress(settings)` (l. 1317) →
  `{postalCode, city}` ou `null`. Commentaire l. 296-301 : appliqués « au terrain d'une fiche **créée** sans
  adresse de terrain ».
- Côté s13, aucune mise à jour : la recherche s55 notait que « le terrain des fiches existantes attend s56 »
  (docs/research/s55-adresses-typees-entreprise.md:173, 205).

### Propriété des parcelles (s12, ADR 029, s53, s57)

- `parcel` / `parcel_ownership` (`src/db/models/parcel-model.ts`), périodes datées ; écritures par
  `attachParcelService` (`src/services/parcel-ownership-service.ts:113`) et `recordSaleService` (l. 193).
  La propriété ne vit que là ; elle conditionne l'accès après la vente (s57, ADR 075).

### Notifications « du back-office »

- `notifications` (`src/db/models/notification-model.ts`) : table **du boilerplate**, rattachée à `user_id`
  seul, **sans `organization_id` ni RLS**, exemptée (docs/architecture.md:471 : « Une notification
  d'association demandera `organization_id`, donc une policy »).
- `createNotificationService` / `createTypedNotificationService` (`src/services/notification-service.ts:144`,
  l. 74 ; façade `notification-service-facade.ts`) : **envoient un email** si les réglages de l'utilisateur
  le permettent (défaut `enableEmailNotifications ?? true`, canal `both`, l. 185-190) ; types
  `NotificationType` du boilerplate. Appelants : Better Auth (`src/lib/better-auth/auth.ts`), le blog hérité
  (`post-service.ts:136`), `components/features/user/action.ts`.
- **Aucun écran ne lit les notifications** : ni le back-office de l'association, ni l'espace membre
  (`getNotificationsByUserIdService` n'a aucun appelant hors tests). Les « notifications au bureau » de s08,
  s10, s22, s23 sont des **emails** à une adresse de fonction + un témoin `notification_failed` sur la ligne
  métier (`contact-message-model.ts:37`, `incident-report-model.ts:52`, `member-question-model.ts:43`).

### État « dernier import » et modifications sur le site

- Rien ne trace un import : ni table, ni paramètre, ni colonne (`grep last_import|imported_at` : seul
  `importedAt` de l'écran, `actions.ts:121`, horodatage d'affichage du rapport).
- Seuls horodatages : `member_profile.updated_at` (bumpé par **toute** écriture : bureau, membre, et le
  serait par l'import lui-même) et `member_profile_email.created_at/updated_at`. Aucune granularité par champ.
- Précédent d'état par association : `billing_sync_state` (`src/db/models/billing-sync-state-model.ts`, s20,
  ADR 062 §7), une ligne par association, RLS forcée, `last_success_at`, comptages et listes en `jsonb`.

### Écran et design

- Écran s13 : `/admin/membres-import` (SuperAdmin), design `docs/designs/s13-import-initial-membres.md`
  (+ `.html`, brief) : écran 1 « Déposer le fichier » (cartes Association / Fichier / « Ce qui va se
  passer »), écran 2 « Rapport d'import » (bilan en six cartes, « Déjà présents », tableaux « Lignes
  rejetées » et « Lignes importées avec une remarque », mention de confidentialité, 25 par page, cartes en
  mobile).
- Back-office de l'association : `src/app/[locale]/(bureau)/layout.tsx` (accès `canManageCurrentAssociationIdentityDal`,
  donc Bureau **et** Présidente) ; barre `src/components/features/association/bureau-sidebar.tsx`, entrées
  **statiques** (`NAV_GROUPS`, l. 30-85), aucune entrée filtrée par rôle. Tenant résolu par le domaine
  (`requireCurrentTenantDal`, `src/app/dal/tenant-dal.ts:93`). Exemple de page bureau avec action et accès
  contrôlé dans la page : `src/app/[locale]/(bureau)/bureau/invitations/page.tsx`.
- Aucun `docs/designs/s56-*`. Le design system porte un manque « Badge “Désactivée par l'import” »
  (docs/design-system.md:1478, forme `outline` proposée par s42b).

## Anchor points

- **Registre** : `src/services/types/domain/action-registry-types.ts` — nouvelle clé dans `ActionIdConst`
  (l. 43-181) et entrée dans `ACTION_REGISTRY` (l. 182-271) avec `defaultRoles: ['owner']`. Contrôle par
  `canPerformAction(user, organizationId, actionId)`
  (`src/services/authorization/action-registry-authorization.ts:18`, SuperAdmin toujours autorisé). Tests à
  compléter : `src/services/types/domain/action-registry-types.test.ts`,
  `src/services/__tests__/action-registry-authorization.test.ts`.
- **Service** : `src/services/member-import-service.ts` — `writeMember` (l. 240) est l'endroit où la voie
  « mise à jour » se branche ; `planImport` (l. 357), `importMember` (l. 267), `buildReport` (l. 312) et les
  types du rapport (`member-import-types.ts:133`) sont à étendre ou à dupliquer pour un mode « annuel ».
  `canImportMembers` (`member-import-authorization.ts:8`) reste la garde de s13.
- **Mappage** : `src/lib/import/pennylane-clients-mapper.ts` réutilisable tel quel (critère 6) ; s'il faut
  distinguer « colonne absente » de « cellule vide », c'est ici (aujourd'hui `cellOf` rend `''` dans les deux
  cas, l. 94-98).
- **Règles pures** à ajouter près de `importedEmailsPlan` (`member-email-rules.ts:180`) : plan de mise à jour
  des adresses d'une fiche (remplacement de titulaire, désignation arbitraire, désactivation des `file`
  absentes, `site` conservées).
- **Écritures** : `updateMemberProfileContactService` (`member-profile-service.ts:171`),
  `addMemberProfileEmailService` (l. 163), `removeMemberProfileEmailService` (l. 325),
  `designateMemberProfileHolderService` (l. 421) — ou un service d'import qui compose les DAO **dans une
  seule transaction par fiche** (ADR 029 : « tout chemin d'écriture passe par le même service »).
- **Présentation** : une page sous `src/app/[locale]/(bureau)/bureau/…` (tenant du domaine, jamais un
  `organizationId` du formulaire) + `actions.ts` ; composants à réutiliser depuis
  `src/components/features/admin/member-import/` (dépôt, rapport) ; entrée de barre dans
  `bureau-sidebar.tsx` ; libellés dans `messages/fr.json`.
- **Notification** : à définir (voir Open questions) ; aucun point d'accroche « back-office » n'existe.

## Verified APIs / functions

| Nom | Signature / comportement vérifié | Fichier |
| --- | --- | --- |
| `readCsv` | `(bytes: Uint8Array) => CsvReadResult` | `src/lib/import/csv-reader.ts:156` |
| `mapPennylaneClients` | `(table: CsvTable) => {ok: true; plan: ImportPlan} \| {ok: false; reason: 'missing_columns'; missingColumns}` | `src/lib/import/pennylane-clients-mapper.ts:323` |
| `importMembersService` | `(input: {organizationId; content: Uint8Array}) => Promise<ImportMembersResult>` ; SuperAdmin seul | `src/services/member-import-service.ts:391` |
| `canImportMembers` | `() => Promise<boolean>`, `role === SUPER_ADMIN` | `src/services/authorization/member-import-authorization.ts:8` |
| `importMembersAction` | `(_prevState?: MemberImportFormState, formData?: FormData) => Promise<MemberImportFormState>` | `src/app/[locale]/admin/membres-import/actions.ts:130` |
| `canPerformAction` | `(user, organizationId, actionId) => boolean` ; SuperAdmin `true` ; rôle de l'org dans `defaultRoles` | `src/services/authorization/action-registry-authorization.ts:18` |
| `isActionAllowedForRole` | `(registry, actionId, role) => boolean`, défaut fermé | `src/services/types/domain/action-registry-types.ts:26` |
| `findMemberProfileIdByPennylaneIdService` | `(organizationId, pennylaneCustomerId) => Promise<string \| undefined>`, `member.profile.manage`, casse stricte | `src/services/member-profile-service.ts:295` |
| `getMemberProfileByPennylaneIdDao` | `(organizationId, id) => Promise<MemberProfileModel \| undefined>` | `src/db/repositories/member-profile-repository.ts:576` |
| `updateMemberProfileContactService` | `(input: UpdateMemberProfileContactInput) => Promise<MemberProfileWriteResult>` ; écrase les 10 champs | `src/services/member-profile-service.ts:171` |
| `createMemberProfileService` | `(input: CreateMemberProfileInput) => Promise<MemberProfileWriteResult>` | `src/services/member-profile-service.ts:103` |
| `addMemberProfileEmailService` | `origin?` accepté ; `saved \| already_listed \| email_shared \| not_found` | `src/services/member-profile-email-service.ts:163` |
| `removeMemberProfileEmailService` | supprime la ligne ; `board_email_required`, `replacement_required`… | `src/services/member-profile-email-service.ts:325` |
| `designateMemberProfileHolderService` | rétrograde puis promeut | `src/services/member-profile-email-service.ts:421` |
| `importedEmailsPlan` | `(existing, cellEmails) => {email; role}[]` ; ne déplace pas le titre | `src/services/rules/member-email-rules.ts:180` |
| `planEmailRemoval` / `planHolderDesignation` | plans purs de succession | `src/services/rules/member-email-rules.ts:135`, `:81` |
| `replaceMemberAccount` | le rôle bureau/présidence suit la nouvelle adresse si dernière fiche | `src/services/member-account-service.ts:217` |
| `closeMemberAccount` | délie ce compte de cette fiche ; ligne `member` si plus aucune fiche | `src/services/member-account-service.ts:180` |
| `getDefaultLandAddress` | `(settings) => {postalCode: string \| null; city: string \| null}` | `src/services/types/domain/association-settings-types.ts:1317` |
| `getAssociationSettingsService` | lecture des paramètres résolus | `src/services/association-settings-service.ts:52` |
| `withTenant` / `getDb` / `withRlsBypass` | `src/db/tenant-scope.ts:128`, `:122`, `:146` | — |
| `createNotificationService` | `(params: CreateNotification, {forceEmail?})` ; email selon réglages utilisateur | `src/services/notification-service.ts:144` |
| `requireCurrentTenantDal` | tenant du domaine appelé | `src/app/dal/tenant-dal.ts:93` |

## Traps & constraints

- **Première action réservée à la Présidente.** Toutes les entrées actuelles du registre sont
  `['owner', 'board']` (ou `+ member`) ; aucune n'est `['owner']` seul (s33, qui devait porter la première
  restriction présidente, n'est pas livrée, docs/stories.md:2701). Le registre et `canPerformAction`
  l'acceptent sans changement (test ad hoc `{id: 'test.action', defaultRoles: ['owner']}` déjà présent,
  `action-registry-types.test.ts:15`). Mais **les services appelés par l'import** (`createMemberProfileService`,
  `add/remove/designate…EmailService`, `updateMemberProfileContactService`, `findMemberProfileIdByPennylaneIdService`)
  rejouent chacun `member.profile.manage` (`requireMemberProfileManager`, `member-profile-support.ts:71`) :
  la Présidente l'a, le Bureau aussi. La garde « owner » doit donc être **en tête du service d'import**, et un
  test doit prouver que le Bureau est refusé à l'appel serveur direct (la barre latérale est statique et le
  layout laisse passer le Bureau).
- **Tenant : du domaine, pas du formulaire.** L'action de s13 lit `organizationId` dans le `FormData`
  (`actions.ts:145`) — acceptable pour le SuperAdmin, pas pour la Présidente : côté bureau, le tenant vient de
  `requireCurrentTenantDal()` (ADR 003). Ne pas réutiliser l'action de s13 telle quelle.
- **Critère 8 contredit la voie existante.** Pour une fiche déjà présente, s13 **rattache** les parcelles du
  fichier (`writeMember` → `attachParcels`, `member-import-service.ts:249-253`), et rejette tout le membre si
  une parcelle est à une autre fiche (`PARCEL_TAKEN`). Après des ventes saisies par le bureau, le fichier de
  l'année porterait des `Référence Client` divergentes : la voie annuelle doit **ignorer** les parcelles
  (aucun appel à `attachParcelService`), sans quoi elle changerait la propriété ou rejetterait à tort.
  `Référence Client` est une colonne **requise** du mappage et une ligne sans elle est rejetée
  (`missing_reference`) : à garder ou non pour l'annuel (voir questions).
- **`updateMemberProfileContactService` écrase tout.** Les dix champs passent par `optionalContact` →
  `null` si absents : appelé avec les seuls champs du fichier, il effacerait `home_address_complement`,
  `land_address_complement` (que le fichier n'a pas), le `companyName` d'un particulier saisi par le bureau,
  et le terrain quand la ligne n'a pas d'`Adresse de Livraison` (`land` undefined dans le mappage). Il faut
  fusionner avec la fiche lue, champ par champ.
- **« N'est plus active » n'existe pas.** `status` ∈ {`active`, `pending`} ; le seul moyen est la
  suppression (qui emporte `unsubscribed_at`, ADR 057). Le badge « Désactivée par l'import » prévu par s42b
  suppose une adresse **conservée et visible** : soit nouvelle valeur d'enum (migration générée par
  `pnpm db:generate`, ADR à écrire, et tous les lecteurs de `status` à revoir : invitations s42b, campagnes,
  `my-emails-card.tsx`, `member-email-rules`), soit suppression. Choix structurant.
- **Succession de la titulaire.** `importedEmailsPlan` refuse de déplacer le titre (s54) ; le critère 3 l'exige.
  La promotion arbitraire du critère 4 est l'**unique** exception à « aucune promotion d'office »
  (docs/stories.md:4167-4171). L'index unique partiel impose de **rétrograder avant de promouvoir** (patron de
  `designateMemberProfileHolderService`). L'invariant « au moins une active ⇒ exactement une titulaire » est
  tenu par le code seul.
- **Comptes et rôles qui suivent l'adresse.** Remplacer la titulaire passe par le chemin
  `replaceMemberAccount` : si la fiche était la dernière de l'ancien compte, **le rôle Bureau ou Présidence
  suit la nouvelle adresse** (tracé). L'import peut donc déplacer la présidence de la personne qui importe, ou
  couper son propre accès. `removeMemberProfileEmailService` refuse de retirer l'adresse d'un membre du bureau
  sur sa dernière fiche (`board_email_required`) : la voie annuelle rencontrera ce refus et doit le rapporter,
  pas lever.
- **Adresse partagée entre fiches** (s53) : désactiver une adresse sur la fiche A ne touche pas son rôle ni son
  compte sur la fiche B ; une adresse nouvelle déjà portée par une autre fiche passe par `email_shared` →
  confirmation implicite de l'import (patron `createProfile` / `addCellEmails`, l. 155-161, 196-203).
- **Origine ≠ « modifiée sur le site ».** `origin` dit qui a **créé** la ligne ; une adresse `file` corrigée
  par le bureau reste `file` (`updateMemberProfileEmailDao` ne touche pas l'origine). Les adresses reprises en
  s54 sont `file` si la fiche avait un identifiant Pennylane, sinon `site` (ADR 056 §2) — une titulaire `site`
  absente du fichier tombe à la fois sous le critère 4 (désactivée) et le critère 9 (non supprimée).
- **Détection d'une valeur « modifiée sur le site après le dernier import »** : rien ne l'outille. Il faudrait
  au minimum une **date du dernier import** (par association, à la `billing_sync_state`, ou par fiche) et, par
  champ ou par groupe de champs, soit un horodatage de modification « site » distinct des écritures de
  l'import, soit **la valeur importée la dernière fois** (comparer fichier / valeur importée / valeur
  actuelle). `member_profile.updated_at` ne suffit pas : profil entier, bumpé aussi par l'import et par la
  migration éventuelle. Premier import annuel : les fiches créées par s13 n'ont aucune trace de « dernière
  valeur importée ». Toute nouvelle table = `organization_id` + RLS forcée + test d'accès croisé (ADR 002) et
  inventaire `docs/architecture.md` (s12c, s38).
- **Idempotence (critère 10).** Relancer le même fichier ne doit rien changer : ni désignation arbitraire
  rejouée (elle doit être déterministe ou ne s'appliquer qu'à une titulaire encore absente), ni « modifiée sur
  le site » déclenchée par l'écriture de l'import lui-même, ni `updated_at` qui ferait passer les valeurs
  importées pour des modifications du site. Une écriture sans changement réel devrait être évitée.
- **Casse de l'identifiant.** L'import retrouve la fiche par égalité stricte ; s20 rapproche sans casse. Un
  identifiant saisi par le bureau dans une autre casse donnerait « membre à créer à la main » à tort.
- **Notification sans email.** `notifications` n'a pas d'`organization_id`, envoie un email par défaut, et
  aucun écran ne l'affiche. « Notifications du back-office, sans email » n'a **pas de support** aujourd'hui.
- **Rapport éphémère (ADR 047).** Le rapport annuel portera plus de données personnelles (anciennes / nouvelles
  adresses) : jamais stocké ni journalisé ; le journal ne reçoit que des comptages. Une notification persistée
  qui nomme fiche et adresses est une **persistance** de données personnelles à arbitrer.
- **Rien en dur (ADR 010).** Terrain par défaut, libellés, éventuelle politique de conflit fichier/site : en
  paramètres ou `messages/fr.json`, jamais des constantes du premier tenant.
- **Cache** : la Server Action invalide la liste des fiches (`revalidatePath(MEMBER_PROFILES_ROUTE_PATTERN,
  'layout')` en s13) ; garder le même effet.
- **Tests existants** à ne pas casser : `src/services/__tests__/member-import-service.test.ts` (25 cas),
  `src/lib/import/pennylane-clients-mapper.test.ts` (25), `src/lib/import/csv-reader.test.ts` (14),
  `src/app/[locale]/admin/membres-import/actions.test.ts` (9), composants `member-import-form|report|screen`
  (8, 7, 1), `src/services/rules/member-email-rules.test.ts` (38),
  `src/services/__tests__/member-profile-email-service.test.ts` (26).
- **E2E** : `e2e/member-import.spec.ts` (605 l., `mode: 'serial'`) — fixtures **fictives** versionnées
  `e2e/fixtures/member-import-fictif.csv`, `member-import-adresses-partagees.csv`,
  `member-import-adresses-multiples.csv` (préfixes d'identifiant / parcelle / domaine dédiés, nettoyés par
  `cleanUpPrefix` sous `app.bypass_rls`) ; preuves SQL sous `set_config('app.organization_id', …)` ; accès
  croisé TechCorp (`localhost`) / Marketing Pro (`127.0.0.1`). Seed : Présidente de TechCorp =
  `user-owner@gmail.com` (`src/db/scripts/seed.ts:306`). Les e2e tournent **en CI**, pas en local ; les
  unitaires par `pnpm test --run`. Aucun fichier réel de La Fourche dans git.

## Open questions

1. **Conflit fichier / site (critère 2)** : la règle de La Fourche est consignée hors git (« le fichier
   n'écrase que les données jamais modifiées sur le site depuis le dernier import ») alors que la story la
   tient pour « à confirmer ». Est-elle confirmée ? Le critère 5 porte la même mention.
2. **Comment détecter « modifié sur le site après le dernier import »** : date du dernier import par
   association ou par fiche ? Granularité (champ, groupe « domicile », « terrain », « téléphone », adresse
   email) ? Horodatage « site » ou valeur importée mémorisée ? Nouvelle table (RLS, accès croisé) ou colonnes
   sur `member_profile` / `member_profile_email` ? Que vaut le premier import annuel pour les fiches de s13 ?
   À trancher par ADR.
3. **Terrain par défaut à la mise à jour** : appliquer `member.default_land_*` à une fiche existante sans
   terrain, ou seulement à la création (ADR 058 dit « créée ») ? Et une ligne sans `Adresse de Livraison` :
   efface-t-elle un terrain existant, ou le terrain n'est-il mis à jour que quand le fichier en porte un ?
4. **« N'est plus active »** : suppression de la ligne (perte de `unsubscribed_at`, rien à afficher) ou nouvel
   état conservé (badge « Désactivée par l'import » de s42b, migration d'enum) ? Une adresse désactivée qui
   réapparaît l'année suivante : réactivée ?
5. **Remplacement vs absence (critères 3 et 4)** : quand la titulaire est absente, quelle adresse « remplace » ?
   La première **nouvelle** adresse de la cellule, ou la première de la cellule même si elle existe déjà comme
   supplémentaire ? Ordre de la désignation « arbitraire » (critère 4) : à rendre déterministe pour
   l'idempotence et les tests.
6. **Titulaire d'origine `site` absente du fichier** : critère 4 (désactivée) ou critère 9 (conservée) ?
   Et une adresse `file` modifiée par le bureau (origine restée `file`) : traitée comme « venue du fichier » ou
   comme « modifiée sur le site » ?
7. **Notifications du back-office sans email** : aucun support n'existe (table `notifications` sans tenant,
   avec email, sans écran). Nouveau support (et lequel : liste sur la fiche, encart du tableau de bord,
   table dédiée à RLS) ou rapport seul + autre trace ? Périmètre et design à décider ; s58 en dépend.
8. **Parcelles** : la colonne `Référence Client` reste-t-elle requise pour l'annuel ? Une divergence parcelle
   fichier / propriété en base est-elle signalée au rapport (sans écriture) ou ignorée ?
9. **Adresse d'un membre du bureau ou de la Présidente** désactivée ou remplacée par le fichier : appliquer
   (le rôle suit la nouvelle adresse, `replaceMemberAccount`), refuser et rapporter, ou exclure ces fiches ?
10. **Casse de l'identifiant** : aligner la recherche de l'import sur s20 (sans casse) ?
11. **Écran** : une page bureau dédiée (route, entrée de barre visible au seul rôle `owner` ou à tous avec
    refus) à dessiner par `/ks-design` depuis le design de s13 ; le rapport s'enrichit (fiches mises à jour,
    valeurs conservées, remplacements, désignations, « membres à créer à la main »). L'écran SuperAdmin de s13
    reste-t-il la seule voie de création, ou la Présidente garde-t-elle aussi l'import initial ?
12. **Champs couverts** : le nom (`Dénomination`) et `company_name` sont-ils mis à jour, ou seulement adresses
    postales, téléphone et emails comme le dit le critère 2 ?
