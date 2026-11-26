---
validated: yes
---

# Plan — Story s36-modeles-documents

Branch: `feature/s36-modeles-documents`

Sources : `docs/research/s36-modeles-documents.md` (la section « Arbitrages (25/11/2026) » fait foi),
`docs/designs/s36-modeles-documents.md` (+ `.html`, référence visuelle seulement),
[ADR 074](../decisions/074-modeles-de-documents-table-dediee-moteur-s28-et-depot-s32.md). Appuis : ADR 060,
066, 067, 073, 010, 018.

## Target story

**En tant que** membre du bureau **je veux** générer une convocation ou un courrier type pré-rempli **afin de**
ne pas repartir d'une page blanche à chaque AG.

1. Le bureau crée un modèle de document avec des variables (nom, parcelle, date, association) et le retrouve
   dans une liste réutilisable.
2. Générer un document depuis un modèle pour un membre remplace les variables par ses valeurs et produit un
   fichier téléchargeable.
3. Une génération en lot pour un groupe (s27) produit un document par membre, déposable directement dans les
   dossiers nominatifs (s32).
4. Une variable inconnue est signalée à l'enregistrement du modèle, pas laissée telle quelle dans le document
   produit.
5. Les modèles d'une association ne sont jamais visibles d'une autre.

**Arbitrages (25/11/2026)** : document unitaire toujours téléchargé, une case le dépose en plus dans le dossier
de la fiche (sans la case, rien n'est conservé) ; lot sur les trois cibles de s27 (tous, impayés, groupe),
**dépôt seul**, un document par fiche, pas de PDF regroupé ; `{date}` saisie à la génération, aujourd'hui par
défaut ; Markdown restreint (`RestrictedMarkdownEditor`, rendu par `letterBodyBlocksOf`) ; gabarit = lettre de
s28 ; variable inconnue → enregistrement refusé ; unité du lot = la fiche ; un appel serveur par fiche,
séquentiel depuis le navigateur ; action dédiée, le dépôt revérifie `member.document.manage` ; catégorie, titre
et date saisis au lancement ; créer, modifier, supprimer, aucun modèle seedé ; `{association}` = nom affiché,
variable propre aux documents.

**Décidé au plan (ADR 074)** :

- **Champs du modèle** : nom (interne, non imprimé, 80 car.), **objet conservé** (imprimé après « Objet : »,
  variables permises, obligatoire, 150 car.), texte (Markdown restreint, `CAMPAIGN_BODY_MAX` = 20 000 car.).
  Le moteur exige un objet ; l'imprimer vide laisserait « Objet : » seul (manque 2 du design, tranché ainsi).
  Pas d'unicité du nom (non dessinée).
- **Variables** : `DOCUMENT_TEMPLATE_VARIABLES = [...CAMPAIGN_VARIABLES, 'association']`. Vérifiées par
  `findUnknownVariables(text, ['association'])` dans l'objet **et** le texte. Remplacées par le moteur grâce à
  un paramètre optionnel `extraValues` (voir tâche 2), jamais avant le moteur.
- **Pied du document** : phrase propre aux documents (`DocumentTemplatesBureau.pdf.footer`, « Document établi
  par le bureau de l'association. »), mentions légales dessous comme en s28. Pas de changement du moteur pour
  le pied (manque 3 du design, tranché ainsi).
- **Date** : la date choisie sert à la fois `{date}`, la ligne de date de la lettre et `document_date` du dépôt.
- **Unitaire** : sans case, route `GET` → PDF en mémoire, rien de stocké. Avec case, Server Action → dépôt par
  `depositMemberDocumentService` **d'abord**, puis le navigateur télécharge le fichier déposé par la route de s32
  (mêmes octets) sous le nom `document-jj-mm-aaaa.pdf`. Un refus de dépôt ne télécharge rien (manque 8 du design,
  confirmé).
- **Autorisation** : `document.template.manage` (owner, board) pour les modèles, le téléchargement unitaire et la
  lecture de la cible ; tout dépôt (case de l'écran 3, lot) exige aussi `member.document.manage`, vérifié d'emblée
  par s36 et revérifié par s32. Sans cette seconde action : case non rendue, écran 4 en `BureauAccessDenied`.
- **Routes** : `/bureau/modeles-documents` (liste), `/nouveau`, `/[id]` (éditeur), `/lot` ;
  `/bureau/proprietaires/[id]/documents/generer` ; `GET /api/document-templates/[id]/document?fiche=…&date=…`.

## Tasks (ordered)

1. [x] **Types de domaine, règles pures, registre.**
   - `src/services/types/domain/document-template-types.ts` : `DOCUMENT_TEMPLATE_EXTRA_VARIABLES = ['association']`,
     `DOCUMENT_TEMPLATE_VARIABLES`, plafonds (`…_NAME_MAX_LENGTH = 80`, `…_SUBJECT_MAX_LENGTH = 150`, corps
     `CAMPAIGN_BODY_MAX`), DTO (`DocumentTemplateListItemDTO` avec variables employées et `updatedAt`,
     `DocumentTemplateDTO`), résultats d'enregistrement (`saved` | `rejected` avec enjeux par champ, dont
     `{code: 'unknownVariables', variables}`), résultats de génération (`ready` | `not_found` | `invalid_date` |
     `unknown_variables` | `render_failed`), résultat d'une ligne de lot (`deposited` | `failed` + raison),
     `DocumentLotTarget` = `CampaignTarget` (`campaign-types.ts:88`), DTO de portée du lot (fiches triées par nom
     avec `hasCurrentParcel`), `documentTemplateFileNameOf(date)` → `document-jj-mm-aaaa.pdf` (aucune donnée
     nominative).
   - `src/services/rules/document-template-rules.ts` : `unknownTemplateVariablesOf({subject, bodyMarkdown})`
     (s'appuie sur `findUnknownVariables`, `src/services/rules/campaign-rules.ts:38`, avec
     `DOCUMENT_TEMPLATE_EXTRA_VARIABLES`), `usedTemplateVariablesOf(...)` (colonne « Variables » de la liste),
     `uniqueProfilesOf(rows)` (dédoublonnage des lignes de `getCampaignTargetRowsDao` par `memberProfileId`,
     patron `letterProfilesOf` de `campaign-letter-service.ts:99`).
   - Registre `src/services/types/domain/action-registry-types.ts` : `DOCUMENT_TEMPLATE_MANAGE:
     'document.template.manage'` (commentaire : modèles, téléchargement, cible ; le dépôt reste sous
     `MEMBER_DOCUMENT_MANAGE`), entrée `ACTION_REGISTRY` `['owner', 'board']`.
   - Tests : `{association}` acceptée, `{adresse}` et `{date_ag}` refusées et nommées une fois chacune dans
     l'ordre, `{factures}` refusée (propre à s29), objet et texte vérifiés tous deux ; dédoublonnage (trois
     lignes d'une fiche → une) ; nom du fichier ; rôles de l'action dans `action-registry-types.test.ts`
     (owner, board oui ; member non).

2. [x] **Extension minimale du moteur de s28 : `extraValues`.** Aucun second moteur, aucun changement de
   gabarit.
   - `substituteVariables(text, values, escape, extra = {})` (`campaign-rules.ts:70`) : remplace en plus les
     noms présents dans `extra` ; défaut vide.
   - `letterBodyBlocksOf(markdown, values, extra = {})` (`src/lib/letters/render-letter-body.ts:206`) : `extra`
     propagé jusqu'aux nœuds texte et `code` (substitution **après** l'analyse, comme aujourd'hui).
   - `RenderLettersInput.extraValues?: Readonly<Record<string, string>>`
     (`src/lib/letters/render-letters-pdf.ts:44`) passé à l'objet (l. 544) et au corps (l. 552) dans
     `drawLetter`.
   - Tests (Vitest `node`, PDF relu par `pdfjs-dist`) : avec `extraValues: {association: 'Clos-Fleuri'}`,
     objet et corps impriment la valeur ; une valeur `**gras**` reste littérale ; **sans** `extraValues`,
     `{association}` reste telle quelle (comportement actuel) ; `campaign-rules.test.ts`,
     `render-letter-body.test.ts`, `render-letters-pdf.test.ts`, `campaign-letter-service` tests,
     `render-campaign-body` / `campaign-text` tests verts **sans modification**.

3. [x] **Modèle, migrations, inventaires, repository.**
   - `src/db/models/document-template-model.ts` : table `document_template` (`id` uuid
     `uuid_generate_v4()`, `organization_id` FK `organization` `cascade`, `name`, `subject`, `body_markdown`,
     `created_at`, `updated_at`), index `(organization_id, lower(name))` non unique ; patron
     `src/db/models/recipient-group-model.ts`. Export dans `src/db/models/db.ts`. **Aucune colonne `*_key`.**
   - `pnpm db:generate` (→ `0084_*`), puis `drizzle-kit generate --custom` pour `0085_document_template_rls.sql`
     (ENABLE + FORCE + policy `tenant_isolation` sur `organization_id`, patron `0083_member_document_rls.sql`).
     Jamais de SQL ni de journal écrits à la main.
   - `docs/architecture.md` : « Classement RLS des 58 tables » → 59, liste d'origine complétée (« plus
     `document_template` de s36, ADR 074 »), bloc « Scopée » 39 → 40 avec sa ligne de tableau.
   - `src/db/repositories/document-template-repository.ts`, tout par `getDb()` : `listDocumentTemplatesDao(org)`
     (tri `lower(name)`, `id`), `getDocumentTemplateByIdDao(id)`, `createDocumentTemplateDao`,
     `updateDocumentTemplateDao(id, fields)` (`updated_at` = maintenant, `returning`),
     `deleteDocumentTemplateDao(id)` (`returning`).
   - Tests : `src/db/document-template-model.test.ts` (colonnes, clé, `cascade`, pas de colonne `_key`) ;
     `src/db/rls-inventory.test.ts` et `src/db/file-key-inventory.test.ts` verts **sans ajout à
     `FILE_KEY_COLUMNS` ni à `NOT_FILE_KEY_COLUMNS`** ; forme des requêtes du repository (patron s32).

4. [x] **Service des modèles.** `src/services/validation/document-template-validation.ts` (ids uuid, champs
   `trim`) ; `src/services/document-template-service.ts` (`server-only`) : `canManageDocumentTemplatesService`,
   `listDocumentTemplatesService`, `getDocumentTemplateService` (`undefined` hors tenant),
   `createDocumentTemplateService`, `updateDocumentTemplateService`, `deleteDocumentTemplateService`. Ordre :
   `safeParse` → `canPerformAction(…, DOCUMENT_TEMPLATE_MANAGE)`
   (`src/services/authorization/action-registry-authorization.ts:18`) → nom (vide, trop long), objet (vide, trop
   long, variables), texte (vide, trop long, variables) **avant toute écriture** → `withTenant(org, …)`
   (`src/db/tenant-scope.ts:128`). Refus rendus `{status: 'rejected', issues}` (patron s29
   `unknownVariable`, `association-settings-service.ts:205`). Façade
   `src/services/facades/document-template-service-facade.ts` + intercepteur
   `…/interceptors/document-template-service-logger-interceptor.ts` (`shouldLogDetails: () => false`).
   Tests par rôle (owner, board, member, SuperAdmin, invité) : refus sans écriture ; `{adresse}` dans le texte ou
   l'objet → `rejected` qui la nomme, aucune écriture (critère 4) ; modèle d'une autre association →
   introuvable ; suppression d'un modèle absent → `NotFoundError`.

5. [x] **Génération d’un document et dépôt.** Dans `document-template-service.ts` :
   - export de `readLetterAssociation` (`src/services/campaign-letter-service.ts:293`, aujourd'hui privée, sans
     changement de comportement) pour lire nom, mentions et réglages ;
   - privée `renderTemplateDocument(org, template, profileId, date)` : fiche par `getMemberProfileByIdDao`
     (`src/db/repositories/member-profile-repository.ts:146`) et parcelles par
     `getCurrentParcelNumbersByProfileDao` (l. 590) sous `withTenant` ; lettre par
     `lettersOf([profile], 'per_land', parcels)` (`src/services/rules/campaign-letter-rules.ts:254`) ;
     `renderLettersPdf({association, subject, bodyMarkdown, sendDate: date, letters: [letter], offset:
     getLetterAddressOffset(settings), extraValues: {association: association.name}, texts})`, textes de
     `getTranslations({locale: PRODUCT_LOCALE, namespace: 'DocumentTemplatesBureau.pdf'})` (`subjectLabel`,
     `dateLine` avec `formatCampaignDate`, `footer`, `continuation`) ; modèle contenant une variable inconnue →
     `unknown_variables` sans rendu (défense du critère 4) ; erreur du moteur → `render_failed` ;
   - `renderTemplateDocumentService({organizationId, templateId, memberProfileId, documentDate})` →
     `DOCUMENT_TEMPLATE_MANAGE` → PDF en mémoire, **rien n'est stocké** ;
   - `depositTemplateDocumentService({…, categoryId, title})` → `DOCUMENT_TEMPLATE_MANAGE` **et**
     `MEMBER_DOCUMENT_MANAGE` d'emblée → rendu → `new File([pdf], documentTemplateFileNameOf(date), {type:
     'application/pdf'})` → `depositMemberDocumentService` (`src/services/member-document-service.ts:334`, appel
     service → service, jamais `createStorage` ni le stockage privé de s32) ; rend le résultat de s32.
   - Coquille : le commentaire de `depositMemberDocumentService` (l. 328) dit « s33, s57 » → « s36, s57 ».
   - Route `src/app/api/document-templates/[id]/document/route.ts` : `getCurrentTenantDal()` (404 sans tenant)
     → façade → `pdfAttachment(pdf, documentTemplateFileNameOf(date))`, sinon `emptyResponse` 404 / 422 et
     `refusalResponseOf` (`src/app/api/campaigns/letter-pdf-response.ts`).
   - Tests : la fiche, ses parcelles « 12 et 13 », la date choisie et le nom de l'association arrivent au moteur
     (moteur mocké : entrée exacte) ; fiche ou modèle d'une autre association → `not_found` ; fiche sans parcelle
     → `{parcelle}` vide, pas d'échec ; dépôt sans `member.document.manage` → `AuthorizationError` **sans
     rendu** ; dépôt refusé par s32 (catégorie inactive) → `rejected` rendu tel quel ; le `File` transmis est un
     PDF au nom sans donnée nominative ; route — 404 (id non uuid, inconnu, autre tenant), 422 (date invalide),
     403, en-têtes `no-store` / `nosniff` / `attachment`.

6. [x] **Cible d’un lot et ligne de lot.**
   - `getDocumentLotReachService({organizationId, target})` → `DOCUMENT_TEMPLATE_MANAGE` et
     `MEMBER_DOCUMENT_MANAGE` → sous `withTenant` : `getCampaignTargetRowsDao(org)`
     (`src/db/repositories/campaign-repository.ts:178`) dédoublonné par `uniqueProfilesOf` ; groupe :
     `getRecipientGroupByIdDao` (introuvable → `NotFoundError`, jamais « tous ») +
     `getRecipientGroupMemberIdsDao` (`src/db/repositories/recipient-group-repository.ts:64`, `:169`) ;
     impayés : `resolveMemberBillingProvider(settings).listInvoicesOf` +
     `unpaidProfileIdsOf(invoices, getInvoiceStatusClassification(settings))`
     (`src/services/rules/member-invoice-rules.ts:134`, `:62`, patron `unpaidPredicateOf` de
     `campaign-service.ts:327`), échec de lecture → `CampaignTargetUnavailableError`
     (`src/services/errors/campaign-errors.ts`), jamais de repli. Rend les fiches triées par nom (id, nom,
     `hasCurrentParcel`) et les décomptes. Pas de désinscription : non pertinente pour un document.
   - `listDocumentLotGroupsService(org)` → `DOCUMENT_TEMPLATE_MANAGE` → `listRecipientGroupsDao` sous le tenant
     (précédent du composeur sous sa propre action, `campaign-service.ts:544`).
   - La ligne de lot **est** `depositTemplateDocumentService` (tâche 5), un appel par fiche ; aucun nouveau
     chemin de dépôt.
   - Tests : trois cibles ; une fiche à deux adresses compte une fois ; groupe d'une autre association →
     `NotFoundError` ; fournisseur de factures en échec → erreur typée, pas « tous » ni « vide » ; rôle sans
     `member.document.manage` → refus ; fiche sans parcelle comptée dans « dont sans parcelle actuelle ».

7. [x] **Écrans 1 et 2 — liste et éditeur.**
   - DAL `src/app/dal/document-template-dal.ts` (`cache()` seul, aucun `'use cache'`) :
     `canManageCurrentDocumentTemplatesDal`, `getDocumentTemplatesForBureauDal`,
     `getDocumentTemplateForBureauDal`.
   - Pages `src/app/[locale]/(bureau)/bureau/modeles-documents/page.tsx`, `nouveau/page.tsx`, `[id]/page.tsx`
     (`requireCurrentTenantDal`, `BureauAccessDenied`, `notFound()` hors tenant, contenu derrière `<Suspense>`,
     patron `bureau/groupes/` et `bureau/actualites/`).
   - Actions `modeles-documents/actions.ts` : `createDocumentTemplateAction`, `updateDocumentTemplateAction`,
     `deleteDocumentTemplateAction` (tenant → `getTranslations` → `requireActionAuth()` → façade →
     `revalidatePath` → `redirect` hors du `try`).
   - Composants `src/components/features/document-templates/` : `document-template-list.tsx` (tableau trié, une
     action « Modifier », cartes sous 640 px, états 1b-1e), `document-template-form.tsx` (RHF + Zod traduit,
     `RestrictedMarkdownEditor` de `src/components/features/pages/blocks/restricted-markdown-editor.tsx`, liste
     des variables sur le patron du composeur `campaign-composer.tsx:778`, résumé d'erreurs ancré qui nomme les
     variables fautives — états 2b-2e, suppression par `alert-dialog`), schéma client
     `document-template-form-validation.ts`.
   - `NAV_GROUPS` (`src/components/features/association/bureau-sidebar.tsx:30`) : « Modèles de documents » juste
     après « Documents nominatifs », `matchesSubroutes: true`.
   - Libellés `messages/fr.json` : namespace `DocumentTemplatesBureau` (liste, éditeur, variables, erreurs,
     succès, `pdf.*`), clé de la barre latérale.
   - Tests : composant du formulaire (refus serveur `unknownVariables` → message de champ qui nomme `{adresse}`
     et `{date_ag}`, focus sur le résumé), liste (vide, rempli), actions (refus sans session, sans action,
     redirection), pages (accès refusé).

8. [x] **Écran 3 — générer un document pour une fiche.**
   - `MemberDocumentsSection` (`src/components/features/member-documents/member-documents-section.tsx`) :
     action `outline` « Générer un document » avant « Déposer un document », rendue seulement si le compte porte
     `document.template.manage`.
   - Page `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/documents/generer/page.tsx` :
     `getMemberProfileForBureauDal` / `getMemberParcelsForBureauDal` (`src/app/dal/member-profile-dal.ts`),
     modèles du DAL de la tâche 7, `canManageCurrentMemberDocumentsDal` et `getMemberDocumentCategoryChoicesDal`
     (`src/app/dal/member-document-dal.ts`) seulement si le dépôt est permis ; aperçu de l'adresse par un DTO du
     service (ADR 067), date du jour par `calendarDayOf`
     (`src/services/types/domain/water-analysis-types.ts:155`).
   - Action `depositTemplateDocumentAction` dans `modeles-documents/actions.ts` (façade →
     `revalidatePath` de la fiche) ; composant client `template-document-generator.tsx` : sans case, `fetch` de
     la route puis enregistrement du blob (patron `campaign-letter-download.tsx`) ; avec case, action d'abord,
     puis téléchargement de `memberDocumentDownloadPathOf(id)` sous `document-jj-mm-aaaa.pdf` ; états 3c-3g.
   - Tests : sans case, aucune action appelée et la route reçoit fiche + date ; avec case, l'action passe
     **avant** le téléchargement, un refus ne télécharge rien ; case non rendue sans `member.document.manage` ;
     aucun modèle → 3f ; aucune catégorie → 3g.

9. [x] **Écran 4 — génération en lot.**
   - Page `src/app/[locale]/(bureau)/bureau/modeles-documents/lot/page.tsx` (`BureauAccessDenied` sans l'une des
     deux actions ; `?modele=` présélectionne).
   - Actions `getDocumentLotReachAction(target)` (décompte) et réutilisation de `depositTemplateDocumentAction`
     pour chaque fiche, raison d'échec traduite côté serveur.
   - Composant client `document-template-lot.tsx` sur le patron de
     `src/components/features/member-documents/member-document-batch.tsx` : `radio-group` des trois cibles,
     décompte, **un appel par fiche, séquentiel**, `progress` déterminée, « n fiches traitées sur N »
     (`aria-live`), garde `beforeunload` pendant le lot seulement, rapport échecs en tête, lot interrompu (4f),
     lecture de cible en échec sans repli.
   - Tests : appels séquentiels, un par fiche, jamais deux en vol ; rapport fidèle aux résultats du serveur ;
     arrêt sur erreur réseau → 4f avec le décompte exact ; cible vide → 4d, aucun appel ; garde posée puis
     retirée.

10. [x] **e2e et documentation.**
    - `e2e/tenant-isolation.spec.ts` : bloc `s36 — modèles de documents : RLS de document_template (ADR 074)` sur
      le patron du bloc `member_document` (l. 753) : hors scope → 0 ligne, scope A → lignes de A seules,
      écriture pour B refusée.
    - `e2e/document-templates.spec.ts` (série, `TENANT_A = localhost`, `TENANT_B = 127.0.0.1`) : critère 1 —
      le bureau crée un modèle et le retrouve dans la liste ; critère 4 — `{adresse}` refusée et nommée, rien
      d'enregistré ; critère 2 — téléchargement pour une fiche du seed : `200`, `application/pdf`, `%PDF-`,
      `no-store`, nom `document-jj-mm-aaaa.pdf` ; dépôt coché → un `member_document` sur la bonne fiche,
      téléchargeable par la route de s32 ; critère 3 — lot sur un groupe de deux fiches créé par la spec →
      deux documents, chacun sur sa fiche ; critère 5 — owner de B : `/bureau/modeles-documents/{idA}` → 404,
      la liste de B ne montre pas le modèle de A, `GET /api/document-templates/{idA}/document` sur le domaine
      de B → 404. Données créées et retirées par la spec.
    - `docs/design-system.md` : §5.6 variables des documents (`{nom}`, `{parcelle}`, `{date}`,
      `{association}`) ; §3.14 champ révélé par une `checkbox` ; entrée « Modèles de documents » ; §6.3 marqué
      cible non réalisée (manque 1) ; manques 7 et 9 consignés au §9.

## Taille du plan

Dix tâches : c'est le seuil de la règle. Pas de découpage recommandé — le lot (critère 3) n'ajoute ni table ni
chemin de dépôt, il rappelle `depositTemplateDocumentService` de la tâche 5 ; le séparer coûterait une story
lettrée et une seconde PR pour deux tâches (6 et 9). **Repli si l'orchestrateur préfère découper** :
`s36a-modeles-documents` (tâches 1 à 5, 7, 8 et la partie RLS / critères 1, 2, 4, 5 de la tâche 10) puis
`s36b-lot-documents` (tâches 6, 9 et le critère 3 de la tâche 10), à inscrire dans `docs/stories.md` avant
`/ks-execute`.

## Files touched

- `src/services/types/domain/document-template-types.ts`, `action-registry-types.ts` (+ test)
- `src/services/rules/document-template-rules.ts` (+ test), `src/services/rules/campaign-rules.ts` (+ test)
- `src/lib/letters/render-letter-body.ts`, `src/lib/letters/render-letters-pdf.ts` (+ tests)
- `src/db/models/document-template-model.ts`, `src/db/models/db.ts`, `src/db/document-template-model.test.ts`,
  `drizzle/migrations/0084_*.sql`, `0085_document_template_rls.sql` + `meta/` (générés)
- `src/db/repositories/document-template-repository.ts` (+ test)
- `src/services/validation/document-template-validation.ts`, `src/services/document-template-service.ts`
  (+ tests), `src/services/facades/document-template-service-facade.ts`,
  `src/services/facades/interceptors/document-template-service-logger-interceptor.ts`
- `src/services/campaign-letter-service.ts` (export de `readLetterAssociation`),
  `src/services/member-document-service.ts` (commentaire « s33 » → « s36 »)
- `src/app/api/document-templates/[id]/document/route.ts` (+ test)
- `src/app/dal/document-template-dal.ts` (+ test)
- `src/app/[locale]/(bureau)/bureau/modeles-documents/` (`page.tsx`, `nouveau/`, `[id]/`, `lot/`, `actions.ts`,
  tests)
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/documents/generer/page.tsx` (+ test)
- `src/components/features/document-templates/*` (liste, formulaire, schéma client, générateur, lot, chemins)
- `src/components/features/member-documents/member-documents-section.tsx`,
  `src/components/features/member-profile/member-profile-detail.tsx` (drapeau d'action),
  `src/components/features/association/bureau-sidebar.tsx`
- `messages/fr.json`
- `e2e/tenant-isolation.spec.ts`, `e2e/document-templates.spec.ts`
- `docs/architecture.md`, `docs/design-system.md`, ADR 074

**Non touchés, vérifiés** : `src/lib/files/file-key-inventory.ts` (aucune nouvelle clé : les dépôts passent par
`member_document.file_key`, déjà inventoriée l. 32 ; le téléchargement unitaire ne conserve rien),
`e2e/backup-restore.spec.ts`, `src/db/scripts/seed.ts` (aucun modèle seedé, Q13), stockage de s32.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`, sur copie en disque local si le montage 9p fait expirer les
  workers — un timeout n'est jamais compté vert)** : règles de variables et de dédoublonnage ; extension du
  moteur avec PDF relu par `pdfjs-dist` et non-régression des suites s28 / s29 / s42b ; services par rôle
  (repositories, moteur, fournisseur de factures et dépôt s32 mockés), ordre « refus avant écriture » et « dépôt
  avant téléchargement » ; route (codes, en-têtes) ; composants (formulaire, générateur, lot séquentiel) ;
  actions ; gardes `rls-inventory.test.ts`, `file-key-inventory.test.ts`, `action-registry-types.test.ts`.
- **e2e (Playwright, en CI seulement, jamais en local)** : RLS de `document_template` et accès croisé du
  critère 5 (la RLS n'est pas testable en unitaire), parcours des critères 1 à 4 sur la base seedée.
- Gardes existantes à garder vertes : `e2e/campaign-letters.spec.ts`, `e2e/member-documents.spec.ts`,
  `e2e/member-invitation-launch.spec.ts`, `e2e/unpaid-reminders.spec.ts`, `e2e/backup-restore.spec.ts`.

## Definition of Done

- Une PR `feature/s36-modeles-documents`, un commit (plus un pour la migration si utile), recherche, design,
  plan, ADR 074 et revue embarqués.
- Les cinq critères couverts chacun par un test nommé ; l'accès croisé et la RLS en e2e, verts en CI.
- Un seul moteur PDF : `renderLettersPdf` étendu d'un paramètre optionnel, suites de s28 / s29 / s42b vertes
  sans modification.
- Aucun dépôt hors de `depositMemberDocumentService` ; aucun `createStorage` ni `withRlsBypass` nouveau dans le
  code applicatif ; aucune nouvelle colonne de clé de fichier.
- Action `document.template.manage` déclarée au registre avec son test ; tout dépôt revérifié par s32.
- Aucune donnée nominative dans un journal, un `'use cache'` ou un nom de fichier ; libellés dans
  `messages/fr.json`, rien en dur (ADR 010).
- Revue passée (`Ship allowed: yes`), aucune régression.

## Questions ouvertes

Aucune question produit ouverte : les arbitrages du 25/11/2026 et l'ADR 074 couvrent les choix. Deux décisions
de forme prises au plan, à confirmer seulement si elles déplaisent à la validation : l'**objet** reste un champ
obligatoire du modèle (plutôt qu'imprimer le nom du modèle) ; le **pied** du document est la phrase « Document
établi par le bureau de l'association. » suivie des mentions légales (plutôt que les mentions seules, qui
demanderaient de toucher au moteur).
