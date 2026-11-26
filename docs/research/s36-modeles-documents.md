# Research — Story s36-modeles-documents

## Target story

**s36 — Générer un document depuis un modèle** (complexité 3, `docs/stories.md` l. 2804). **En tant
que** membre du bureau **je veux** générer une convocation ou un courrier type pré-rempli **afin de**
ne pas repartir d'une page blanche à chaque AG. Dépendances : s27, s28, s32 (toutes livrées sur
`main` : PR s28, PR 86 pour s32). La revue du découpage est passée (`docs/reviews/stories.md` l. 135 :
`Stories ready: yes`).

Critères d'acceptation :

1. Le bureau crée un modèle de document avec des variables (nom, parcelle, date, association) et le
   retrouve dans une liste réutilisable.
2. Générer un document depuis un modèle pour un membre remplace les variables par ses valeurs et
   produit un fichier téléchargeable.
3. Une génération en lot pour un groupe (s27) produit un document par membre, déposable directement
   dans les dossiers nominatifs (s32).
4. Une variable inconnue est signalée à l'enregistrement du modèle, pas laissée telle quelle dans le
   document produit.
5. Les modèles d'une association ne sont jamais visibles d'une autre.

Notes agentiques impératives :

- Réf. PRD l. 97 (« Modèles de documents réutilisables », inspiré de Lotisoft) : convocation, PV,
  courrier type — **au-delà des modèles d'email (s25), qui restent un système distinct**.
- Le lot est **la forme d'usage** de la ligne du périmètre, obtenue en composant s27 (cibles), s28
  (moteur PDF) et s32 (dossiers nominatifs) « sans rien inventer ».
- **Réutiliser le moteur de variables et de génération PDF de s28.** « Si cette story réintroduit un
  second moteur, le découpage a échoué. »
- Le dépôt en lot passe par le mécanisme de s32 — **ne pas écrire dans le stockage en contournant sa
  couche de cloisonnement**.
- Sauvegarde : **si** un document généré est conservé, déclarer sa colonne de clé de fichier dans
  l'inventaire de s12c.

Règles transverses applicables (`docs/stories.md` l. 38-87) : table métier avec `organization_id` +
RLS forcée + test d'accès croisé e2e ; rien en dur (ADR 010) ; couches strictes ; Cache Components ;
`pnpm test --run` ; migrations par `pnpm db:generate` ; identité d'un membre = clé primaire de la
fiche ; **registre d'actions** : toute action soumise à autorisation se déclare au registre de s03b.

Aval : **s38** (export) exige « les documents : partagés, nominatifs, **et modèles de documents**,
avec leurs fichiers d'origine » (`docs/stories.md` l. 2932), piloté par l'inventaire des tables
scopées. Une table de modèles doit donc être une table scopée ordinaire.

## Current state of the code

### Moteur PDF et variables de s28 (`src/lib/letters/`, ADR 066)

- **Moteur** : `pdfkit` `^0.21.0` (`package.json:106`), déclaré dans `serverExternalPackages`
  (`next.config.ts:49`) ; `pdfjs-dist` en dev (`package.json:164`) pour relire les PDF en test.
- `src/lib/letters/render-letters-pdf.ts:562` — `renderLettersPdf(input: RenderLettersInput):
  Promise<RenderedLetters>` (`{pdf: Buffer; pageCount: number}`). Produit **un seul PDF** pour toutes
  les lettres reçues (chacune commence sur une nouvelle page, pages de suite avec repère). Entrée
  (`RenderLettersInput`, l. 44) :
  - `association: {name; legalMentions}` ;
  - `subject`, `bodyMarkdown` (tels qu'écrits, variables non remplacées) ;
  - `bodyBlocks?: LetterBlock[]` — corps déjà mis en blocs, **précédent de réutilisation** par s42b
    (courrier de lancement, texte sans variable) ;
  - `sendDate` (`YYYY-MM-DD`, valeur de `{date}` via `formatCampaignDate`) ;
  - `letters: readonly CampaignLetter[]` ; `offset: AddressOffsetMm` ;
  - `texts: {subjectLabel; dateLine; footer; continuation}` — **tous les libellés viennent de
    l'appelant** (aucun texte en dur dans le moteur).
  - Gabarit fixe par lettre (`drawLetter`, l. 532) : en-tête (monogramme + nom de l'association),
    **bloc adresse pour enveloppe DL**, ligne de date, « Objet : … », corps, pied (phrase + mentions
    légales). Le pied de s28 dit « Courrier envoyé par voie postale, faute d'adresse email connue. »
    (`CampaignsBureau.letters.pdf.footer`) : il est passé par l'appelant, donc remplaçable.
  - `valuesOf(letter, sendDate)` (l. 523, **privée**) construit `{nom, parcelle, date}`.
- `src/lib/letters/render-letter-body.ts` :
  - `letterBodyBlocksOf(markdown, values: CampaignVariableValues): LetterBlock[]` (l. 206) — mdast
    remark + `RESTRICTED_SANITIZE_SCHEMA` du CMS, **substitution dans les nœuds texte** après analyse
    (une valeur n'est jamais lue comme du Markdown), liens imprimés en clair ;
  - `letterTextBlocksOf(text, siteLine)` (l. 226) — texte brut en paragraphes, sans variable (s42b) ;
  - `plainTextOfBlock(block)`.
- Autres modules : `letter-geometry.ts` (A4, marges, fenêtre DL `DL_WINDOW_MM`, cadre d'adresse,
  tailles), `letter-pdf-document.ts` (`createLetterDocument(fonts, {layoutCache?})`,
  `drawAddressBlock`, `pdfBufferOf`), `letter-fonts.server.ts` (`letterFontFilesOf()`, polices lues
  sur disque une fois), `letter-address-fit.ts` / `letter-address-measure.server.ts`
  (`letterAddressFitsWindow(lines)`), `render-calibration-pdf.ts`.
- **Variables** — `src/services/types/domain/campaign-types.ts:66` :
  `CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date'] as const`, `CampaignVariable`,
  `CampaignVariableValues = Record<CampaignVariable, string>`. **Liste fermée de code.** Il n'existe
  **aucune variable « association »** aujourd'hui.
- **Règles** — `src/services/rules/campaign-rules.ts` :
  - `VARIABLE_PATTERN = /\{([\p{L}\p{N}_-]+)\}/gu` (l. 28) ;
  - `isKnownVariable` (l. 30, privée) → **câblée sur `CAMPAIGN_VARIABLES`** ;
  - `findUnknownVariables(text, allowed: readonly string[] = []): string[]` (l. 38) — `allowed`
    ajoute des variables propres à un type d'envoi (`{factures}` de s29) ;
  - `substituteVariables(text, values, escape)` (l. 70) — remplace **les seules variables connues de
    `CAMPAIGN_VARIABLES`** ; une accolade inconnue **reste telle quelle** (le refus est en amont) ;
  - `joinParcelNumbers(numbers)` (l. 85, `Intl.ListFormat` fr), `formatCampaignDate` (l. 490).
- **Traitement actuel d'une variable inconnue** :
  - composeur de campagne : `unknownVariablesOf` (`campaign-service.ts:296`, privée) →
    `{status: 'unknown_variables', variables}` à l'aperçu (l. 581) et à l'envoi (l. 672) ;
    affichage `CampaignsBureau.unknownVariableTitle/Description` (`messages/fr.json:4531`) ;
  - **précédent « refus à l'enregistrement »** (le plus proche du critère 4) : la relance
    automatique de s29, `reminderVariablesErrors` (`association-settings-service.ts:205`) avec
    `REMINDER_ALLOWED_VARIABLES` → erreur de champ `{code: 'unknownVariable'}`
    (`association-settings-types.ts:152`, message `messages/fr.json:2104`).
- Variable de liste spécifique : `substituteInvoicesList` (`rules/unpaid-reminder-rules.ts`) — patron
  d'une variable propre à un type, remplacée avant le moteur (`CampaignLetter.bodyMarkdown`).

### Service courrier de s28 (consommateur du moteur)

`src/services/campaign-letter-service.ts` (`server-only`) : `getCampaignLetterContextService`,
`generateCampaignLettersService(orgId, campaignId, grouping)`, `getLetterCalibrationPdfService`.
Privées utiles comme patron : `readLetterAssociation(orgId)` (nom = `organization.name`, mentions =
réglages `association.legal_name` + `association.legal_mentions`), `textSettingOf`, `letterProfilesOf`.
Façade `src/services/facades/campaign-letter-service-facade.ts`. Le PDF est **produit en mémoire,
jamais stocké** (ADR 066 §5).

Règles du courrier — `src/services/rules/campaign-letter-rules.ts` :
- `LetterProfile` (l. 74 : `id`, `name`, `companyName`, `home*`, `land*`) ;
- `letterAddressLinesOf(profile): LetterAddress` (l. 143 : domicile → terrain → nom seul, ADR 067) ;
- `homonymGroupsOf`, `sameNameAndHomeKeyOf` ;
- `CampaignLetter` (l. 206 : `memberProfileIds`, `name`, `address`, `parcelle`, `bodyMarkdown?`) ;
- `lettersOf(profiles, grouping, parcels): CampaignLetter[]` (triées par nom).

### Cibles et groupes de s27 (ADR 060)

- Type `CampaignTarget = {kind:'all_members'} | {kind:'unpaid_members'} | {kind:'group'; groupId}`
  (`campaign-types.ts:88`).
- Résolution : `readTarget(organizationId, choice, settings, templateId)` —
  `src/services/campaign-service.ts:368`, **privée**, « point de passage unique des quatre lecteurs »,
  à appeler sous `withTenant`. Elle lit `getCampaignTargetRowsDao(orgId)` puis, pour un groupe,
  `getRecipientGroupByIdDao(groupId)` (introuvable → `NotFoundError`, jamais « tous ») +
  `getRecipientGroupMemberIdsDao(groupId)` → prédicat `isTargeted`. Elle est **liée à une nature
  d'envoi email** (`templateId: CampaignSendKind`, désinscriptions) : non pertinent pour un document.
- `src/db/repositories/campaign-repository.ts` : `getCampaignTargetRowsDao(organizationId):
  Promise<CampaignTargetRowModel[]>` — une ligne par (fiche, adresse active) ou une ligne `email:
  null` ; porte `name`, `currentParcelNumbers`, `home*`, `land*`, `companyName`
  (`CampaignLetterAddressRowModel`, l. 62). **Plusieurs lignes par fiche** : dédoublonner par
  `memberProfileId` (patron `letterProfilesOf`).
- `src/db/repositories/recipient-group-repository.ts` : `getRecipientGroupByIdDao` (l. 64),
  `getRecipientGroupMemberIdsDao` (l. 169), `listRecipientGroupsDao` (l. 54).
- Service `src/services/recipient-group-service.ts` : `listRecipientGroupsService(orgId)` (l. 85) et
  `getRecipientGroupService` (l. 97) sont gardés par **`campaign.group.manage`** ; choisir un groupe
  comme cible reste sous `campaign.manage` (`action-registry-types.ts:144-152`).

### Dossiers nominatifs de s32 (ADR 073)

- Modèle `src/db/models/member-document-model.ts`, table `member_document` (`id`,
  `organization_id`, `member_profile_id` RESTRICT, `title`, `category_id` RESTRICT, `document_date`,
  `file_key`, `file_bytes`, `created_at`). Migrations `0082_ordinary_clint_barton.sql` +
  `0083_member_document_rls.sql` (custom, RLS forcée).
- Repository `src/db/repositories/member-document-repository.ts` (`createMemberDocumentDao`, …).
- Service `src/services/member-document-service.ts` :
  - `depositMemberDocumentService(input: {organizationId; memberProfileId; title; categoryId;
    documentDate?; file?: File | null}): Promise<MemberDocumentDepositResult>` (l. 334) —
    commentaire explicite « **Appelable par un service (s33, s57), pas seulement par un formulaire** »
    (s33 est une coquille pour s36, voir Traps). Ordre : `safeParse` → `member.document.manage` →
    fiche lue sous le tenant (`readTargetProfile`, `NotFoundError` sinon) → titre (≤ 120,
    `MEMBER_DOCUMENT_TITLE_MAX_LENGTH`), **catégorie active du domaine `member_document`
    obligatoire**, date (vide → jour du dépôt), **PDF validé par signature binaire, 10 Mo**
    (`validateContentFile('document')`) → fichier puis ligne, fichier effacé si l'insertion échoue.
    Refus rendus `{status:'rejected', issues}` ; succès `{status:'deposited', document}`.
  - `depositMemberDocumentBatchLineService` (l. 650) : rapprochement par référence Pennylane en tête
    de nom de fichier — **non pertinent** pour s36 (la fiche est connue).
  - Stockage cloisonné : `getMemberDocumentStorage(organizationId, memberProfileId)` (l. 104,
    **privée**) → `createStorage('local', {bucket:'member-documents', basePath:
    memberDocumentFolderOf(org, profile)…})` ; clé `buildMemberDocumentFileKey(org, profile, doc)` →
    `{org}/member-documents/{profileId}/{docId}-{uuid}.pdf`.
  - Lecture : `readMemberDocumentFileService(org, id)` (l. 572) — trois contrôles (RLS, possession ou
    `member.document.manage`, cohérence clé ↔ fiche).
- Validation `src/services/validation/member-document-validation.ts`
  (`depositMemberDocumentServiceSchema`).
- Factory disque `src/lib/files/storage/storage-factory.ts` (`createStorage('s3'|'local', config)`),
  adaptateur `src/lib/files/storage/local-storage.ts` (`resolveInsideRoot`, pas de `realpath`).
- Catégories : domaine `CategoryDomainConst.MEMBER_DOCUMENT`, seed « Facture », « Convocation »
  (`src/db/scripts/tenant-categories-seed.ts`), écran `/bureau/documents-nominatifs/categories`.
- **Inventaire s12c** : `src/lib/files/file-key-inventory.ts` — `FILE_KEY_COLUMNS` contient déjà
  `{table:'member_document', column:'file_key'}` ; garde `src/db/file-key-inventory.test.ts` (échoue
  sur **toute colonne `_key`** d'un `pgTable` non déclarée, et sur toute déclaration orpheline) ;
  fixture `e2e/backup-restore.spec.ts` (l. 199, 349, 372).

### Modèles d'email de s25 — système distinct

- Pas de table : les « modèles » sont des **identifiants de code** `CAMPAIGN_TEMPLATE_IDS = ['free',
  'reminder', 'invoice', 'general_assembly', 'post_assembly_documents']` (`campaign-types.ts:10`), au
  contenu provisoire dans `messages/fr.json` (`email.campaign.templates.*`, l. 972-998) ; le bureau
  part du texte et l'édite dans le composeur, le contenu est figé sur `campaign.body_markdown`. Il
  n'existe **aucune table de modèles** éditables par le bureau dont s'inspirer ; le plus proche en
  persistance d'un texte réutilisable du bureau est le réglage `invitation.letter_text` (s42b) ou
  `billing.reminder.body` (s29) — des réglages, pas une liste.

### Éditeur de texte

`src/components/features/pages/blocks/restricted-markdown-editor.tsx` — `RestrictedMarkdownEditor
({value, onChange, label, placeholder})` : **`Textarea` + barre réduite** (gras, italique, titre 2,
titre 3, liste, lien), Markdown restreint au schéma du CMS. Utilisé par le composeur de campagne
(`campaign-composer.tsx:764`), les actualités (`news-editor.tsx:466`), la navigation, les blocs texte
et encart. Le composeur affiche sous l'éditeur la liste des variables
(`CAMPAIGN_VARIABLES.map(…)`, l. 778, libellés `CampaignsBureau.variables.*`). Milkdown
(`src/components/ui/markdown-editor.tsx`) existe mais est **écarté** pour ces usages (GFM complet).
Ce Markdown restreint est exactement ce que `letterBodyBlocksOf` sait imprimer.

### Écrans back-office voisins (patron liste + formulaire + éditeur)

1. **Groupes (s27)** — `src/app/[locale]/(bureau)/bureau/groupes/page.tsx` (liste, `Suspense`,
   `requireCurrentTenantDal` + `canManageCurrentRecipientGroupsDal`, `BureauAccessDenied`),
   `groupes/[id]/page.tsx`, `groupes/actions.ts` (`createRecipientGroupAction(_prev, formData)` :
   tenant → `getTranslations('RecipientGroupsBureau')` → `requireActionAuth()` → schéma Zod traduit
   → façade → `revalidatePath`). DAL `src/app/dal/recipient-group-dal.ts`
   (`getRecipientGroupsForBureauDal`, `getRecipientGroupForBureauDal`,
   `canManageCurrentRecipientGroupsDal`, `cache()` seul). Composants
   `src/components/features/recipient-groups/`.
2. **Actualités (s05)** — `bureau/actualites/page.tsx` (liste) + `actualites/[id]/page.tsx` et
   `[id]/actions.ts` (brouillon, enregistrer, publier ; états `NewsSaveState`…), éditeur
   `src/components/features/news/news-editor.tsx` (RHF + `RestrictedMarkdownEditor`). DAL
   `news-dal.ts` (`getNewsForBureauDal`, `getNewsItemForBureauDal`, `canManageCurrentNewsDal`).
   **Patron le plus proche d'une liste de modèles éditables.**
3. **Campagnes (s25-s28)** — `bureau/campagnes/page.tsx`, `nouvelle/page.tsx` (composeur),
   `[id]/page.tsx` (détail + carte courrier), `actions.ts` ; composants
   `src/components/features/campaigns/` (`campaign-composer.tsx`, `campaign-letter-card.tsx`,
   `campaign-letter-download.tsx` : `fetch` → blob → téléchargement). DAL `campaign-dal.ts`.
4. **Documents nominatifs (s32)** — `bureau/documents-nominatifs/page.tsx`, `lot/page.tsx` (client
   `member-document-batch.tsx` : **un appel serveur par fichier**, progression « n traités sur N »,
   garde de sortie, rapport par ligne), `categories/`, `actions.ts` ; fiche du bureau
   `proprietaires/[id]/page.tsx` → `MemberDocumentsSection` (`member-profile-detail.tsx:340`) et
   `proprietaires/[id]/documents/nouveau`. DAL `member-document-dal.ts`.
- Barre latérale : `src/components/features/association/bureau-sidebar.tsx`, `NAV_GROUPS` (l. 30),
  groupe `group` ; libellés `messages/fr.json` l. ~2010-2032.

### Téléchargement d'un fichier produit

- Helpers `src/app/api/campaigns/letter-pdf-response.ts` : `emptyResponse(status)`,
  `pdfAttachment(pdf: Uint8Array, fileName, extraHeaders?)` (`no-store`, `nosniff`,
  `Content-Type: application/pdf`, `Content-Disposition: attachment`), `refusalResponseOf(error)`
  (403 / 404).
- s28 : `src/app/api/campaigns/[id]/courrier/route.ts` — `GET(request, {params})` :
  `getCurrentTenantDal()` (404 sans tenant) → façade → `pdfAttachment` ; nom sans donnée nominative
  (`courrier-jj-mm-aaaa.pdf`) ; statuts métier → 404/409/422. Aussi `api/campaigns/calage/route.ts`.
- s32 : `src/app/api/member-documents/[id]/route.ts` — 401 sans session, 404 pour tout le reste.
- Le PDF n'est **jamais** servi par une Server Action (binaire) ; `src/proxy.ts` ne garde pas `/api`
  (la route contrôle tout elle-même).

### Multi-tenant (ADR 002, 003)

- `src/db/tenant-scope.ts` : `getDb(): ScopedDb` (l. 122), `withTenant(organizationId, callback)`
  (l. 128, refuse un id non uuid), `withRlsBypass` (l. 146, interdit hors SuperAdmin/ops).
- Migrations RLS : `drizzle-kit generate --custom`, patron `0083_member_document_rls.sql` / `0076`
  (`ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation` sur `organization_id`).
- Gardes : `src/db/rls-inventory.test.ts` (classement de `docs/architecture.md` §« Classement RLS des
  58 tables », l. 389-392 — compteur à passer à 59 / 40 scopées si une table est ajoutée).
- e2e d'accès croisé : `e2e/tenant-isolation.spec.ts` (blocs SQL par table, ex. s31 l. 494, s32
  l. 753 : hors scope → 0 ligne, scope A → lignes de A, écriture pour B refusée) et specs
  fonctionnelles (`e2e/member-documents.spec.ts`, `e2e/campaign-letters.spec.ts` : route d'une
  ressource de A demandée sur le domaine de B → 404 ; `TENANT_A = localhost`, `TENANT_B = 127.0.0.1`).

### Registre d'actions (s03b, ADR 018)

`src/services/types/domain/action-registry-types.ts` : `ActionIdConst` (objet `as const`, une entrée
commentée par action) + `ACTION_REGISTRY` (`{id, defaultRoles}`), `isActionAllowedForRole`.
Contrôle : `canPerformAction(user, organizationId, actionId)`
(`src/services/authorization/action-registry-authorization.ts:18` ; SuperAdmin toujours, sinon rôle
dans cette organisation). Test `action-registry-types.test.ts` (un test par action, ex. l. 233).
Actions existantes concernées : `CAMPAIGN_MANAGE`, `CAMPAIGN_GROUP_MANAGE`, `MEMBER_DOCUMENT_MANAGE`
(`owner`, `board`). Une story déclare son action en **ajoutant une constante + une entrée** au
registre, avec son test.

### Paramètres d'association utiles

`src/services/types/domain/association-settings-types.ts` : `ASSOCIATION_LEGAL_NAME_SETTING_KEY =
'association.legal_name'` (l. 222), `ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY` (l. 227),
`LETTER_ADDRESS_OFFSET_X/Y_SETTING_KEY` (l. 234-236, calage), getter `getLetterAddressOffset`. Le nom
affiché de l'association est `organization.name` (`getOrganizationByIdDao`). Pas de réglage
« adresse de l'association », « signataire » ni « lieu de l'AG ».

### Traductions

Namespaces voisins dans `messages/fr.json` : `CampaignsBureau` (l. 4514, dont `letters.pdf.*`
l. 4851, `variables.*`, `unknownVariableTitle`), `RecipientGroupsBureau` (l. 4914),
`BureauMemberDocuments` (l. 5404), `BureauMemberDocumentCategoriesPage` (l. 3473), `BureauNewsPage`
(l. 2677), `RestrictedMarkdownEditor` (l. 2476), barre latérale (l. ~2010-2032, clé à ajouter).

### Design system (`docs/design-system.md`)

- §2.1 conventions des 37 composants du socle ; §3.1 formulaires ; §3.2 états ; §3.5 tableau sous
  640 px ; §3.14 (s27, cible et groupes) ; §3.17 (s28, carte courrier) ; §3.19 (s32, documents
  nominatifs, rapport de lot, garde de sortie).
- §5.6 « Variables et objets » : liste `{prénom} {nom} · {parcelle} · {montant} · {échéance} ·
  {date_ag} · {lien_magique} · {nom_association}` — **plus large que le code** (`nom`, `parcelle`,
  `date`).
- §6.1 lettre de publipostage (gabarit DL du moteur) ; **§6.3 « Gabarit de document
  institutionnel »** : « un seul gabarit couvre convocation, procès-verbal et courrier type, généré à
  l'unité ou en lot » — en-tête (logo, coordonnées, date et lieu), références (numéro de pièce,
  objet, destinataire si nominatif), titre 16 pt, corps 12,5/1.7, **signature non coupée**, pied
  « page x/y » + date de génération ; en lot « un **seul fichier** PDF … avec un bordereau ».
- §9 manques : « prévisualisation PDF paginée en back-office » (s28, s36).

## Anchor points

- **Moteur** : `renderLettersPdf` (`src/lib/letters/render-letters-pdf.ts:562`) +
  `letterBodyBlocksOf` (`render-letter-body.ts:206`) — appel par document avec `letters: [letter]`
  pour un PDF par membre ; `texts.footer` propre aux documents.
- **Variables** : `CAMPAIGN_VARIABLES`, `findUnknownVariables(text, allowed)`,
  `substituteVariables` — à étendre ou paramétrer pour `{association}` (voir Traps 1).
- **Destinataires** : `getCampaignTargetRowsDao` + `getRecipientGroupByIdDao` /
  `getRecipientGroupMemberIdsDao` sous `withTenant` ; pour un membre, `getMemberProfileByIdDao` +
  `getCurrentParcelNumbersByProfileDao` (`member-profile-repository.ts:146`, `:590`) ou la même
  lecture de cible filtrée ; adresse par `letterAddressLinesOf`.
- **Dépôt** : `depositMemberDocumentService` (appel service → service, sans façade).
- **Livraison** : route `GET` sous `src/app/api/...` avec `pdfAttachment`.
- **Écrans** : nouvelle entrée `NAV_GROUPS` ; routes `bureau/<modeles>/…` sur le patron
  groupes/actualités ; éventuel point d'entrée « Générer un document » sur la fiche
  (`member-profile-detail.tsx`) ou sur le détail d'un groupe.
- **Registre** : nouvelle(s) entrée(s) `ActionIdConst` + `ACTION_REGISTRY`.
- **Persistance** : nouveau modèle sous `src/db/models/`, export dans `src/db/models/db.ts`,
  migration générée + migration RLS custom, `docs/architecture.md` (classement RLS).

## Verified APIs / functions

| Nom | Emplacement | Signature / rôle |
| --- | --- | --- |
| `renderLettersPdf` | `src/lib/letters/render-letters-pdf.ts:562` | `(input: RenderLettersInput) => Promise<{pdf: Buffer; pageCount: number}>` |
| `RenderLettersInput` | idem l. 44 | `{association, subject, bodyMarkdown, bodyBlocks?, sendDate, letters, offset, texts}` |
| `letterBodyBlocksOf` | `src/lib/letters/render-letter-body.ts:206` | `(markdown, values: CampaignVariableValues) => LetterBlock[]` |
| `letterTextBlocksOf` | idem l. 226 | `(text, siteLine: string \| null) => LetterBlock[]` |
| `createLetterDocument` | `src/lib/letters/letter-pdf-document.ts:47` | `(fonts, {layoutCache?}) => LetterDocument` |
| `letterFontFilesOf` | `src/lib/letters/letter-fonts.server.ts:23` | `() => {sans: Buffer; serifSemiBold: Buffer}` |
| `CAMPAIGN_VARIABLES` | `src/services/types/domain/campaign-types.ts:66` | `['nom', 'parcelle', 'date'] as const` |
| `findUnknownVariables` | `src/services/rules/campaign-rules.ts:38` | `(text, allowed: readonly string[] = []) => string[]` |
| `substituteVariables` | idem l. 70 | `(text, values: CampaignVariableValues, escape) => string` — connues seulement |
| `joinParcelNumbers` / `formatCampaignDate` | idem l. 85 / 490 | parcelles « 12, 14 et 16 » ; date `jj/mm/aaaa` en lettres fr |
| `letterAddressLinesOf` | `src/services/rules/campaign-letter-rules.ts:143` | `(profile: LetterProfile) => {source, lines}` |
| `lettersOf` / `CampaignLetter` | idem l. 254 / 206 | lettres triées par nom |
| `getCampaignTargetRowsDao` | `src/db/repositories/campaign-repository.ts` | `(organizationId) => Promise<CampaignTargetRowModel[]>` (plusieurs lignes par fiche) |
| `getRecipientGroupByIdDao` / `getRecipientGroupMemberIdsDao` | `recipient-group-repository.ts:64` / `:169` | sous `withTenant` |
| `readTarget` (privée) | `src/services/campaign-service.ts:368` | liée à la nature d'un envoi email |
| `depositMemberDocumentService` | `src/services/member-document-service.ts:334` | `({organizationId, memberProfileId, title, categoryId, documentDate?, file?: File}) => Promise<MemberDocumentDepositResult>` |
| `getMemberDocumentStorage` (privée) | idem l. 104 | stockage ouvert sur le dossier de la fiche |
| `FILE_KEY_COLUMNS` | `src/lib/files/file-key-inventory.ts` | contient déjà `member_document.file_key` |
| `canPerformAction` | `src/services/authorization/action-registry-authorization.ts:18` | `(user, organizationId, actionId) => boolean` |
| `ActionIdConst` / `ACTION_REGISTRY` | `src/services/types/domain/action-registry-types.ts` | déclaration d'une action |
| `getDb` / `withTenant` | `src/db/tenant-scope.ts:122` / `:128` | scope RLS |
| `pdfAttachment` / `emptyResponse` / `refusalResponseOf` | `src/app/api/campaigns/letter-pdf-response.ts` | réponses PDF `no-store` |
| `RestrictedMarkdownEditor` | `src/components/features/pages/blocks/restricted-markdown-editor.tsx` | `({value, onChange, label, placeholder?})` |
| `getLetterAddressOffset` | `association-settings-types.ts` | décalage de calage du tenant |

## Traps & constraints

1. **Variable « association » absente du moteur.** Le critère 1 cite « nom, parcelle, date,
   association » ; le code n'a que `nom`, `parcelle`, `date`, et `substituteVariables` /
   `isKnownVariable` sont **câblés** sur `CAMPAIGN_VARIABLES`. Ajouter `association` à
   `CAMPAIGN_VARIABLES` la rendrait valide **aussi dans les campagnes email** (composeur, aperçu,
   relances, libellés `CampaignsBureau.variables.*`, `messages/fr.json:2104`), et `CampaignVariableValues`
   deviendrait obligatoire partout (`valuesOf` de `campaign-service.ts:517` et
   `render-letters-pdf.ts:523`). L'autre voie — un jeu de variables propre aux documents passé en
   paramètre (comme `allowed` / `{factures}`) — exige que `substituteVariables` accepte un jeu de
   variables, sinon `{association}` resterait littérale dans le PDF (exactement ce que le critère 4
   interdit). À trancher sans créer un second moteur.
2. **Gabarit du moteur = lettre postale.** `drawLetter` impose bloc adresse DL, ligne « Le {date} »,
   « Objet : » et pied postal. Le design system §6.3 décrit un **autre** gabarit (titre 16 pt, numéro
   de pièce, signature, « page x/y », date de génération). Ajouter un gabarit au moteur est permis
   (même moteur, mêmes primitives), mais il ne doit pas devenir un second rendu Markdown ; et
   inventer les éléments de §6.3 non couverts serait un « design system gap ». Arbitrage de forme à
   faire en `/ks-design`.
3. **§6.3 contredit le critère 3 sur le lot.** §6.3 : « en génération de lot, un seul fichier PDF …
   avec un bordereau » (logique publipostage). Critère 3 : « un document par membre, déposable dans
   les dossiers nominatifs ». Le dépôt impose un PDF par fiche (un `member_document` = un fichier).
4. **Dépôt s32 : contraintes à respecter.** `depositMemberDocumentService` exige un **`File`** (le
   moteur rend un `Buffer` → `new File([pdf], …, {type: 'application/pdf'})`), une **catégorie
   active du domaine `member_document`** (pas de défaut : le bureau doit choisir, ou la story doit
   dire laquelle — rien en dur, ADR 010), un titre ≤ 120 caractères, une date `document_date`, et
   re-vérifie `member.document.manage` : un rôle qui aurait l'action de s36 sans celle de s32 se
   verrait refuser le dépôt (même piège que celui noté pour s37 à propos de s44). Le stockage par
   fiche est **privé** au service s32 : ne jamais l'appeler ni appeler `createStorage` directement
   depuis s36.
5. **Coquille documentaire** : le commentaire de `depositMemberDocumentService` (« s33, s57 »), la
   recherche et le plan de s32 parlent de « s33, modèles de documents » ; c'est s36. Ne pas en
   déduire une dépendance vers s33 (vote).
6. **Cible d'un lot ≠ cible d'une campagne.** `readTarget` est privée et dépend de la nature
   d'envoi (désinscriptions) : pour un document, la désinscription n'a pas de sens. Lire directement
   les membres du groupe (`getRecipientGroupMemberIdsDao`) et leurs fiches. `getCampaignTargetRowsDao`
   rend une ligne **par adresse** : dédoublonner. Un groupe peut contenir une fiche sans parcelle
   actuelle (`{parcelle}` vide) ou supprimée de fait. Autorisation : lister les groupes est sous
   `campaign.group.manage` côté service s27 ; s36 devra soit appeler une lecture sous sa propre
   action, soit hériter de ce croisement (piège s37).
7. **Homonymes / plusieurs terrains** : en s28 le bureau choisit de regrouper. Pour un document
   **déposé** dans le dossier d'une **fiche** (s32, une fiche = un terrain), l'unité naturelle est la
   fiche ; « un document par membre » se lit donc « un par fiche ». À confirmer.
8. **Volume et durée du lot.** ~400 fiches à La Fourche ; chaque document = un rendu pdfkit + une
   écriture disque + une insertion, plus `checkCategory` relu à chaque dépôt. ADR 066 n'a **pas
   mesuré** la mémoire ni le temps sur le VPS (2 vCore / 4 Go). Une génération de 400 PDF dans une
   seule requête risque le délai de la requête ; s32 fait déjà son lot **un fichier par appel** côté
   client (`member-document-batch.tsx`, ADR 073 §8, plafond 16 Mo par requête) ; l'alternative est
   une tâche de fond (`scheduled_job`, ADR 006), plus lourde. Pas d'atomicité : un lot interrompu
   laisse des dépôts partiels, et le relancer crée des **doublons** (aucune unicité sur
   `member_document`).
9. **Nouvelle table de modèles** : `organization_id` + RLS forcée (migration custom
   `drizzle-kit generate --custom`, patron `0083`), compteur de `docs/architecture.md` (58 → 59,
   39 → 40 scopées) vérifié par `rls-inventory.test.ts`, bloc SQL dans `e2e/tenant-isolation.spec.ts`
   + test fonctionnel d'accès croisé (critère 5). **Aucune colonne nommée `*_key`** sauf si c'est une
   clé de fichier (sinon `file-key-inventory.test.ts` échoue, ou la déclarer dans
   `NOT_FILE_KEY_COLUMNS`). Jamais de SQL ni de journal écrits à la main.
10. **Sauvegarde** : si le document généré est déposé via s32, sa clé est déjà inventoriée
    (`member_document.file_key`) — rien à ajouter. Si la story choisit de **conserver** un document
    unitaire hors dossier nominatif, nouvelle colonne de clé → `FILE_KEY_COLUMNS` + fixture
    `e2e/backup-restore.spec.ts` dans le même commit.
11. **Données personnelles** : un document nominatif porte nom, domicile, parcelles. Comme s28 :
    jamais dans un journal (intercepteur `shouldLogDetails: () => false`), jamais dans un
    `'use cache'`, `Cache-Control: no-store`, nom du fichier téléchargé sans donnée nominative (ou
    titre ASCII, `memberDocumentDownloadName`). Le contenu d'un modèle n'est pas nominatif mais reste
    lu par session (DAL `cache()` seul, pas de `'use cache'`).
12. **Budget email** : non concerné — aucune génération ni aucun dépôt n'envoie d'email (s32 :
    « pas de notification email »). Si une notification au membre était ajoutée, elle décompterait
    le budget Brevo (300/jour) : hors critères.
13. **Export s38** : la table des modèles sera exportée par l'inventaire des tables scopées ; rester
    sur une table plate (texte), sans fichier.
14. **Tests existants exposés** : `campaign-rules.test.ts`, `render-letter-body.test.ts`,
    `render-letters-pdf.test.ts` (648 lignes, relus par `pdfjs-dist`), `campaign-letter-service`
    tests, `e2e/campaign-letters.spec.ts`, `campaign-composer.test.tsx` (liste des variables), si le
    moteur ou les variables sont touchés ; `member-document-service` tests si le dépôt change ;
    `action-registry-types.test.ts` ; `rls-inventory.test.ts`, `file-key-inventory.test.ts` ;
    `bureau-sidebar` (pas de test qui énumère `NAV_GROUPS` trouvé). Montage 9p lent : valider
    `pnpm test --run` sur une copie en disque local ; e2e en CI seulement.
15. **Fichiers longs** : `campaign-service.ts` (~1160 l.), `render-letters-pdf.ts` (571 l.),
    `member-document-service.ts` (746 l.) : un service dédié (`document-template-service.ts` +
    façade + intercepteur) respecte mieux `top-down-design` ; un service n'importe jamais une façade.
16. **Story UI** : liste, éditeur avec liste des variables, choix d'un membre ou d'un groupe,
    progression du lot, rapport — `/ks-design` requis avant `/ks-plan`. Composants à prendre au socle
    (§2.1) ; aucune prévisualisation PDF paginée n'existe (manque §9).

## Open questions

1. **Variable « association » : quelle valeur et quel mécanisme ?** Nom affiché
   (`organization.name`) ou raison sociale (`association.legal_name`) ? Ajoutée à
   `CAMPAIGN_VARIABLES` (donc ouverte aux emails) ou jeu propre aux documents ? Nom de la variable
   (`{association}` comme dans le critère, ou `{nom_association}` du design system §5.6) ? — **Non
   tranché** : le critère nomme la variable sans sa valeur ; aucun ADR.
2. **`{date}` = date du jour de la génération, ou date saisie par le bureau ?** En s28 c'est la date
   d'envoi de la campagne. Pour une convocation, une date saisie (celle de l'AG) serait plus utile —
   mais ce serait une variable de plus (`{date_ag}` du §5.6). — **Non tranché.**
3. **Format du modèle** : Markdown restreint (`RestrictedMarkdownEditor`, déjà imprimable par
   `letterBodyBlocksOf`) ou texte simple (`letterTextBlocksOf`) ? — **Non tranché** ; la note « même
   moteur » oriente vers le Markdown restreint, qui couvre les listes numérotées d'un ordre du jour.
4. **Gabarit imprimé** : lettre DL de s28 (bloc adresse, « Objet : ») ou gabarit institutionnel §6.3
   (titre, numéro de pièce, signature, « page x/y ») ? Un PV n'a pas de destinataire. Qui signe
   (aucun réglage « signataire ») ? — **Non tranché** par la story ; §6.3 décrit une cible que le
   moteur ne réalise pas. À arbitrer en `/ks-design`, avec les manques à déclarer.
5. **Le document unitaire est-il conservé ou seulement téléchargé ?** Critère 2 dit
   « téléchargeable » seulement ; la note sauvegarde dit « **si** un document généré est conservé ».
   Option : téléchargement seul (ADR 066 §5, rien stocké) **et** dépôt facultatif dans le dossier de
   la fiche via s32. — **Non tranché.**
6. **Lot : déposé d'office ou téléchargeable aussi ?** « déposable directement » laisse ouverte la
   possibilité d'un téléchargement du lot (un PDF par membre, ou un PDF unique façon §6.3) en plus ou
   à la place du dépôt. — **Non tranché** ; critère 3 et §6.3 divergent (Trap 3).
7. **Catégorie, titre et date du document déposé** : saisis par le bureau au lancement du lot, ou
   portés par le modèle (catégorie par défaut) ? — **Non tranché** ; s32 impose une catégorie active
   du domaine `member_document`.
8. **Cibles du lot** : groupe seul (critère 3) ou aussi « tous les membres » et « impayés » (les
   trois cibles de s27) ? Une convocation d'AG vise tous les membres : sans « tous », il faudrait un
   groupe « tous ». — **Partiellement tranché** : le critère ne cite que le groupe.
9. **Unité du lot** : une fiche (un terrain) ou une personne (regroupement des homonymes comme s28) ?
   Le dépôt est par fiche (ADR 073). — **Non tranché.**
10. **Exécution du lot** : appels séquentiels côté client (patron s32) ou tâche de fond
    (`scheduled_job`) ; reprise et doublons si le lot est relancé ; mesure mémoire/temps sur le VPS à
    faire. — **Non tranché** ; ADR 066 et 073 ne couvrent pas une génération de masse côté serveur.
11. **Autorisation** : nouvelle action (`document.template.manage` ?) seule, ou réutilisation de
    `member.document.manage` ? Avec une action dédiée, la génération en lot croise trois actions
    (modèles, `campaign.group.manage` pour lire les groupes, `member.document.manage` pour déposer).
    — **Non tranché** ; la règle transverse impose seulement de déclarer l'action.
12. **Signalement d'une variable inconnue (critère 4)** : refus bloquant à l'enregistrement (patron
    s29 `unknownVariable`) ou avertissement non bloquant ? « signalée … pas laissée telle quelle »
    tolère les deux, tant que la génération refuse un modèle invalide. — **Partiellement tranché.**
13. **Cycle de vie d'un modèle** : modification et suppression (critère 1 ne dit que « créer » et
    « retrouver ») ; un modèle modifié après un dépôt ne change pas les documents déjà déposés
    (fichiers figés). Modèles de départ seedés (convocation, PV, courrier type) — valeurs de seed du
    premier tenant (ADR 010) ou rien ? — **Non tranché.**

## Arbitrages (25/11/2026)

Décidés par l'utilisatrice :

- **Q5 — Document unitaire** : toujours téléchargé ; une case permet en plus de le déposer dans le
  dossier nominatif de la fiche (mécanisme s32). Sans la case, rien n'est conservé.
- **Q8 — Cibles du lot** : les trois cibles de s27 — tous, impayés, un groupe.
- **Q6 — Sortie du lot** : dépôt seul, un document par fiche dans son dossier nominatif. Pas de PDF
  regroupé (l'impression papier reste le rôle du publipostage s28).
- **Q2 — `{date}`** : date saisie au moment de la génération, date du jour proposée par défaut.

Tranchés par l'orchestrateur (story, ADR et précédents du code) :

- **Q3 — Format** : Markdown restreint, éditeur `RestrictedMarkdownEditor`, rendu par
  `letterBodyBlocksOf` (« même moteur »).
- **Q4 — Gabarit** : la lettre de s28 (`renderLettersPdf`), sans second moteur. L'écart avec le
  gabarit institutionnel §6.3 est déclaré comme manque du design system.
- **Q12 — Variable inconnue** : enregistrement refusé (patron s29 `unknownVariable`).
- **Q9 — Unité du lot** : la fiche (le dépôt s32 est par fiche, ADR 073).
- **Q10 — Exécution du lot** : un appel serveur par fiche, séquentiel depuis le navigateur (patron
  du lot s32).
- **Q11 — Autorisation** : action dédiée aux modèles, déclarée au registre ; le dépôt revérifie
  `member.document.manage`.
- **Q7 — Dépôt** : catégorie (active, domaine `member_document`), titre et date saisis au lancement.
- **Q13 — Cycle de vie** : créer, modifier, supprimer ; aucun modèle de départ seedé. Les documents
  déjà déposés restent figés.
- **Q1 — `{association}`** : nom affiché de l'association, variable propre aux documents (les
  variables des emails ne changent pas).
