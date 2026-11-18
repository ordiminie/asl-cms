# Research — Story s27-groupes-destinataires

Branche : `feature/s27-groupes-destinataires` (depuis `main` à `991f6834`, après le merge de s19, PR 73).
`docs/reviews/stories.md` : `Stories ready: yes`. Dépendances s19, s25, s54 : livrées.

## Target story

**Choisir la cible d'une campagne** — complexité 3. Le bureau choisit qui reçoit une campagne : tous
les membres (s25), les membres en impayé, ou un groupe qu'il a composé.

Critères (`docs/stories.md` l. 2227-2284), numérotés pour la suite :

1. Cible « membres en impayé » proposée à côté de « tous les membres », **calculée au moment de
   l'envoi** à partir du prédicat « impayé » de s19, jamais saisie ni redérivée d'un statut.
2. La cible « impayés » fonctionne avec la saisie manuelle comme avec une implémentation externe :
   changer d'implémentation ne change pas la cible.
3. Le bureau crée un groupe nommé et y ajoute / retire des membres **depuis la liste des membres**.
4. Un groupe est sélectionnable comme cible, à la place de « tous » ou des impayés.
5. Le nombre de destinataires du groupe est affiché avant l'envoi, **compté en fiches** : celles qui ont
   au moins une adresse active, celles qui n'en ont pas ; le nombre d'adresses destinataires (s54) à part.
6. Supprimer un groupe n'affecte ni les membres ni les campagnes déjà envoyées.
7. Un membre désinscrit (s25) est exclu des deux nouvelles cibles comme de « tous » : exclusion **au
   calcul de la cible**, quel qu'en soit le type.
8. Un groupe est propre à son association, jamais visible d'une autre.

Notes de la story : le calcul de la cible est **le point de passage unique** des trois cibles (s27b y
ajoutera la réintégration statutaire) ; la distinction avec / sans email prépare s28 (publipostage d'un
groupe) ; s29 réutilise le même calcul ; pas de segmentation dynamique au-delà des deux cibles standard.

## Current state of the code

### Le calcul de la cible aujourd'hui (s25, s26, s53, s54)

- **Lecture** `getCampaignTargetRowsDao(organizationId)` (`src/db/repositories/campaign-repository.ts:142`) :
  toutes les `member_profile` de l'association, `LEFT JOIN member_profile_email` sur les adresses
  `active` ; une ligne par (fiche, adresse active), une ligne `email: null` par fiche sans adresse
  active ; `unsubscribed` = `unsubscribed_at is not null` de l'adresse ; `accountName` ; parcelles
  actuelles via `getCurrentParcelNumbersForMembersDao`. **Aucun paramètre de filtre.**
- **Règle pure** `computeCampaignTarget(rows)` (`src/services/rules/campaign-rules.ts:123`) : groupe les
  lignes par adresse (minuscule, bords retirés), un destinataire par adresse porté par la première fiche
  dans l'ordre ADR 054 (`carrierOf`), une adresse désinscrite désinscrit le groupe ; rend
  `{recipients, withoutEmail (fiches), unsubscribed (adresses)}`. Le commentaire dit déjà « Point de
  passage unique que s27 étend et que s27b réintègre ».
- **Lecteurs de la cible** dans `src/services/campaign-service.ts`, tous via `readTarget(orgId)`
  (l. 245) ou l'appel direct au DAO :
  - `getCampaignComposerContextService` (l. 304) : décomptes `countsOf(target)` + `reachableMembers`
    (pour le choix du membre de l'aperçu) ;
  - `previewCampaignService` (l. 329) : relit les lignes, choisit le membre, `sameAddressRowsOf(rows, member)` ;
  - `sendCampaignService` (l. 404) : relit la cible **sous `withTenant`**, refuse une cible vide
    (`no_recipient`), planifie les parts (`planCampaignParts`), crée campagne + parts + lignes
    `campaign_recipient` (cible **figée à la création**, ADR 051/052) avec `targetKind: 'all_members'`
    écrit en dur (l. 452) ;
  - `previewCampaignPlanService` (l. 497) : `target.recipients.length` pour le plan des parts.
- **Décomptes** `countsOf` (l. 236) → `CampaignTargetCountsDTO {recipients, withoutEmail, unsubscribed,
total}` : `total` additionne des **adresses** (destinataires, désinscrites) et des **fiches** (sans
  adresse). Le critère 5 demande l'inverse : fiches d'abord, adresses à part.
- **Type de cible** : `CAMPAIGN_TARGET_KINDS = ['all_members']` (`campaign-types.ts:25`) ;
  colonne `campaign.target_kind` en `text` libre (`campaign-model.ts:64`) ; `toCampaignDto` la caste
  (`campaign-rules.ts:344`) ; le détail l'affiche par `detail.targetKinds.${targetKind}`
  (`campaign-detail.tsx:591`, `messages/fr.json` ~l. 4146). Aucune référence à un groupe.
- **Composeur** `RecipientsCard` (`campaign-composer.tsx:661`) : libellé fixe `t('target')` = « Tous les
  membres » (`messages/fr.json` l. 4075), puis `RecipientCounts` (joignables / sans email / désinscrits /
  total). **Aucun choix de cible.**
- **Action** `sendCampaignAction` / `previewCampaignAction` (`bureau/campagnes/actions.ts:99, 128`) :
  lisent les champs du `FormData` par `formData.get(key)`, appellent les services ; le plan d'aperçu est
  calculé dans la même action (l. 120). Schémas `createSendCampaignServiceSchema` /
  `createPreviewCampaignServiceSchema` (`src/services/validation/campaign-validation.ts`) : aucun champ
  de cible.

### Le prédicat « impayé » (s19, ADR 059)

- Règles pures `src/services/rules/member-invoice-rules.ts` : `getInvoiceStatusClassification(settings)`
  (deux réglages multilignes `billing.unpaid_statuses` / `billing.settled_statuses`),
  `isUnpaidInvoice(status, classification)` — **seul `unpaid` est impayé, `unclassified` ne l'est pas**.
  En-tête : « s21, s27 et s29 importent le classement et le prédicat « impayé » ; ils n'interprètent
  jamais un statut eux-mêmes ».
- Contrat `MemberBillingProvider` (`src/services/billing/member-billing-provider.ts`) : `id`,
  `canWrite`, `listInvoicesOf(organizationId, memberProfileIds) → MemberInvoice[]`. **Pas de méthode
  « fiches en impayé »** : le contrat lit les factures de fiches données.
- `resolveMemberBillingProvider(settings)` (`resolve-member-billing-provider.ts`) : choisi par le réglage
  `billing.provider`, une seule implémentation (`manual`) ; valeur inconnue → erreur explicite.
- `manualMemberBillingProvider.listInvoicesOf` ouvre lui-même un `withTenant` ; appelé depuis un
  `withTenant` existant, le scope est imbriqué (`runInNestedScope`, `tenant-scope.ts:101`) — usage déjà
  pratiqué par `getMyInvoicesService` (`member-space-service.ts:299`).
- Patron d'appel à reproduire : `getAssociationSettingsService(orgId)` → `resolveMemberBillingProvider`
  → `listInvoicesOf` → `isUnpaidInvoice(invoice.status, getInvoiceStatusClassification(settings))`.
  `readAssociation` (`campaign-service.ts:200`) lit déjà les réglages : ils peuvent servir aux deux.

### Liste des membres (lieu du critère 3)

- Page `src/app/[locale]/(bureau)/bureau/proprietaires/page.tsx` : RSC, contrôle `canManageCurrentMemberProfilesDal`,
  `getMemberProfilesPageForBureauDal(tenant.id, page, search)`, rend `MemberProfileList`.
- `src/components/features/member-profile/member-profile-list.tsx` (416 l.) : table desktop
  (`ProfilesTable`, l. 137) + cartes mobile (`ProfileCard`, l. 171), recherche, pagination par lien.
  **Aucune sélection de lignes, aucune action groupée.** Le détail d'une fiche :
  `bureau/proprietaires/[id]`.
- Actions serveur des fiches : `bureau/proprietaires/actions.ts` (+ `notes-actions.ts`).

### Ce qui n'existe pas (vérifié par grep)

- Aucune table, modèle, repository, service ou libellé de **groupe de destinataires**. `docs/architecture.md:360`
  cite `recipient_group` parmi les tables prévues de la communication : rien n'existe.
- Aucune cible « impayés » ; aucun appel du fournisseur de factures depuis les campagnes.
- Aucun design de cette story (`docs/designs/` : rien pour s27).

## Anchor points

- **Cible** : `computeCampaignTarget` (règle pure) et ses lecteurs dans `campaign-service.ts` ; le filtre
  par type de cible s'insère **avant** `computeCampaignTarget` (sur les lignes) pour que l'exclusion des
  désinscrits, la déduplication par adresse et le décompte restent un seul passage.
- **Type de cible** : `CAMPAIGN_TARGET_KINDS` (`campaign-types.ts`), `targetKind` écrit par
  `sendCampaignService`, `detail.targetKinds.*` (libellés), schémas de validation des campagnes.
- **Groupes** : nouveau modèle (+ table de membres du groupe) dans `src/db/models/`, migration
  `pnpm db:generate` puis `drizzle-kit generate --custom` pour la RLS (calquer `0064_member_invoice_rls.sql`
  / `0044_campaign_rls.sql`), repository, service + façade + autorisation, DAL, actions.
- **Liste des membres** : `member-profile-list.tsx` (desktop et mobile) et/ou détail de la fiche ;
  `bureau/proprietaires/actions.ts`.
- **Composeur** : `RecipientsCard` / `RecipientCounts` (`campaign-composer.tsx`), `previewCampaignAction`,
  `sendCampaignAction`, `CampaignComposerContextDTO`.
- **Docs vivantes** : classement RLS de `docs/architecture.md` (« 30 tables » aujourd'hui, une ligne par
  table, compteurs : sinon `src/db/rls-inventory.test.ts` échoue) ; mention `recipient_group` l. 360.
- **Autorisation** : registre `ACTION_REGISTRY` (`action-registry-types.ts`) — `CAMPAIGN_MANAGE`
  existe ; la discipline du dépôt (commentaires s14, s19, s24) est une entrée par action que s37 pourra
  régler seule.

## Verified APIs / functions

| Élément                                                                                                            | Où                                              | Constat                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `getCampaignTargetRowsDao(organizationId)`                                                                         | `campaign-repository.ts:142`                    | toutes les fiches, sans filtre ; ordre nom, id, rôle, id d'adresse                    |
| `getCurrentParcelNumbersForMembersDao(ids)`                                                                        | `campaign-repository.ts:182`                    | parcelles actuelles (`ends_on is null`)                                               |
| `computeCampaignTarget(rows)`                                                                                      | `campaign-rules.ts:123`                         | générique sur `Row extends CampaignTargetRow`                                         |
| `sameAddressRowsOf(rows, recipient)`, `addressValuesOf(...)`                                                       | `campaign-rules.ts:150, 166`                    | `{nom}`/`{parcelle}` d'une adresse à plusieurs fiches, lus sur **les lignes passées** |
| `readTarget`, `countsOf`, `readAssociation`                                                                        | `campaign-service.ts:245, 236, 200`             | non exportés                                                                          |
| `getCampaignComposerContextService`, `previewCampaignService`, `sendCampaignService`, `previewCampaignPlanService` | `campaign-service.ts:304, 329, 404, 497`        | les quatre relisent la cible « tous »                                                 |
| `CAMPAIGN_TARGET_KINDS`, `CampaignTargetKind`                                                                      | `campaign-types.ts:25-26`                       | `['all_members']`                                                                     |
| `campaign.targetKind`                                                                                              | `campaign-model.ts:64`                          | `text` non nul, sans `CHECK`                                                          |
| `isUnpaidInvoice`, `getInvoiceStatusClassification`                                                                | `member-invoice-rules.ts:47, 61`                | purs, isomorphes                                                                      |
| `MemberBillingProvider.listInvoicesOf(orgId, ids)`                                                                 | `billing/member-billing-provider.ts:20`         | lecture seule, factures des fiches données                                            |
| `resolveMemberBillingProvider(settings)`                                                                           | `billing/resolve-member-billing-provider.ts:20` | `server-only`, erreur explicite si valeur sans implémentation                         |
| `withTenant` (imbriqué)                                                                                            | `tenant-scope.ts:96-137`                        | un scope courant → `runInNestedScope`, pas de nouvelle transaction                    |
| `canPerformAction(user, orgId, ActionIdConst.CAMPAIGN_MANAGE)`                                                     | `campaign-service.ts:169`                       | via `requireCampaignManager`                                                          |
| `ActionIdConst.MEMBER_PROFILE_MANAGE`, `CAMPAIGN_MANAGE`                                                           | `action-registry-types.ts:107, 133`             | `defaultRoles: ['owner', 'board']` pour les deux                                      |
| Composants `checkbox`, `radio-group`, `select`, `dialog`, `dropdown-menu`, `table`                                 | `src/components/ui/`                            | présents ; design system l. 412 : 2-3 options courtes → `radio-group`                 |

## Traps & constraints

1. **Filtrer avant le regroupement par adresse change `{nom}` et `{parcelle}`.** Une adresse portée par
   deux fiches (s53), dont une seule est dans le groupe ou en impayé : si les lignes sont filtrées avant
   `computeCampaignTarget`, `sameAddressRowsOf` ne voit que la fiche retenue (le message ne cite que ses
   parcelles) ; sinon l'envoi part au nom de fiches hors cible. Et une adresse désinscrite sur la fiche
   hors cible ne désinscrit plus le groupe — or la désinscription est **par adresse** (ADR 055/057), elle
   doit valoir quelle que soit la fiche. Le plan doit trancher l'ordre filtre / regroupement et le tester.
2. **Les quatre lecteurs de la cible doivent recevoir le même type de cible.** Composeur (décompte),
   aperçu (membre choisi, désormais dans la cible choisie), plan des parts (nombre de destinataires),
   création. Un lecteur oublié = un décompte ou un plan faux. La cible reste recalculée sous `withTenant`
   à la création (critère 1 : « au moment de l'envoi »), puis **figée** dans `campaign_recipient` (ADR 051/052) :
   les parts du lendemain (s26) partent à la cible figée, même si une facture est réglée entre-temps.
3. **« Impayé » par fiche** : le contrat ne rend que des factures. Une fiche est en impayé si **au moins
   une** de ses factures est `unpaid` — c'est une lecture, à vérifier contre l'ADR 059 (aucune ligne ne la
   formule explicitement). Lire les factures de **toutes** les fiches de l'association à chaque décompte :
   coût acceptable à 400 fiches en manuel ; à surveiller pour s20 (appel réseau Pennylane à chaque
   ouverture du composeur ?).
4. **Fournisseur indisponible** (s20 plus tard) : `resolveMemberBillingProvider` lève sur une valeur
   inconnue ; un appel réseau peut échouer. La cible « impayés » ne doit jamais se replier sur « tous »
   ni sur « vide » en silence (une relance à tous serait grave).
5. **Décompte du critère 5 en fiches** : aujourd'hui `withoutEmail` est en fiches, `recipients` et
   `unsubscribed` en adresses, `total` les additionne. Le critère veut fiches avec / sans adresse active,
   **puis** adresses destinataires. Changer `countsOf` touche aussi la cible « tous » (même composant) et
   les tests existants du composeur et de `campaign-rules`. Le critère parle du « groupe » ; l'étendre aux
   trois cibles garde un seul affichage.
6. **Suppression d'un groupe (critère 6)** : la campagne ne doit pas porter de clé étrangère en `CASCADE`
   vers le groupe ; ses destinataires sont déjà figés. L'archive doit continuer à dire quelle cible a été
   visée (le détail affiche `targetKinds.*`) : copier le nom du groupe dans la campagne, sur le modèle des
   `author_name` copiés. Les lignes d'appartenance disparaissent avec le groupe ; une fiche supprimée doit
   quitter ses groupes (`CASCADE` côté fiche), pas bloquer sa suppression.
7. **RLS** : deux nouvelles tables métier (groupe, appartenance) → `organization_id` + policy
   `tenant_isolation` **forcée** chacune, lignes au classement de `docs/architecture.md` et compteur « 30 »
   à mettre à jour, sinon `rls-inventory.test.ts` échoue. Une appartenance doit refuser une fiche d'une
   autre association (la RLS filtre la lecture ; l'écriture d'un `member_profile_id` étranger doit être
   refusée par la policy `WITH CHECK` ou par le service). Preuve d'isolation : **e2e Playwright** (la RLS
   n'est pas testable en unitaire), modèle `e2e/campaigns.spec.ts` « critère 9 — accès croisé ».
8. **Ajout depuis la liste** : la liste est paginée côté serveur (lien `?page=`), sans état client ; une
   sélection multi-pages n'existe pas. La forme de l'ajout (action par ligne, cases à cocher sur la page
   courante, menu « Ajouter au groupe ») est un choix d'écran : **design à produire** (`/ks-design`, agent).
   Le design system ne connaît ni sélection de lignes ni action groupée sur `table` : gap probable.
9. **Autorisation** : gérer les groupes = composer une cible de campagne ; `CAMPAIGN_MANAGE` existe,
   mais la discipline du registre est une entrée par action réglable par s37. L'ajout se fait depuis la
   liste des membres, gardée par `MEMBER_PROFILE_MANAGE` : les deux ont aujourd'hui les mêmes rôles.
10. **Validation de la cible** : un `groupId` reçu du formulaire est une entrée non fiable : vérifié sous
    `withTenant` (un groupe d'une autre association ne se lit pas → refus, jamais « tous »). Un groupe
    vide ou sans destinataire joignable tombe dans le refus existant `no_recipient`.
11. **`targetKind`** est un `text` libre : ajouter deux valeurs ne demande pas de migration de type, mais
    `toCampaignDto` caste ; les libellés `detail.targetKinds.*` doivent couvrir les trois valeurs.
12. **Tests existants à faire évoluer** : `campaign-rules.test.ts`, tests de `campaign-service`,
    `campaign-composer.test.tsx`, `campaign-detail.test.tsx`, `bureau/campagnes/actions.test.ts`,
    `campaign-validation.test.ts`, `member-profile-list.test.tsx`, `rls-inventory.test.ts`,
    `e2e/campaigns.spec.ts` (décompte du composeur). Rappel : `pnpm test --run` ; montage 9p lent
    (valider sur copie locale en cas de timeout).
13. **Cache** : pas de `'use cache'` dans le DAL des campagnes (donnée du bureau, test de source) ; les
    groupes sont aussi des données du bureau → même discipline, `<Suspense>`.
14. **Rien en dur** (ADR 010) : aucun seuil ni texte à coder ; les libellés en `messages/fr.json`. Une
    limite du nombre de groupes ou de la longueur du nom, si le plan en pose, est un garde-fou de saisie
    (comme `MEMBER_INVOICE_YEAR_MIN`) ou un paramètre — à justifier.
15. **s27b, s28, s29 consomment ce calcul** : la signature de la fonction de cible doit accepter le type
    de cible comme paramètre unique (s29 : cible « impayés » recalculée à chaque échéance ; s28 : les
    fiches sans adresse d'une cible ; s27b : nature de l'envoi). Ne pas enfouir le filtre dans le composeur.

## Open questions

1. **Ordre filtre / regroupement par adresse** (piège 1) : une adresse partagée par une fiche du groupe
   et une fiche hors groupe — le message cite-t-il les parcelles de la seule fiche ciblée, ou de toutes
   les fiches de l'adresse ? Et la désinscription de l'adresse sur la fiche hors cible exclut-elle
   l'envoi ? (Recommandation à défendre au plan : la désinscription vaut par adresse quelle que soit la
   fiche ; `{parcelle}` ne cite que les fiches ciblées.)
2. **Définition « fiche en impayé »** : au moins une facture `unpaid`, toutes années confondues ?
   (lecture naturelle de l'ADR 059, non écrite.)
3. **Décompte du critère 5 pour « tous » et « impayés » aussi**, ou seulement pour le groupe ? Une fiche
   dont toutes les adresses actives sont désinscrites : comptée « avec adresse active » (oui, au sens
   strict) et visible comme désinscrite à part ?
4. **Où ajoute-t-on un membre au groupe** : depuis la liste (cases à cocher + « Ajouter au groupe »), depuis
   la fiche (carte « Groupes »), ou les deux ? Le retrait : depuis la liste filtrée par groupe, depuis
   l'écran du groupe ? Où vit l'écran « Groupes » (sous Campagnes, ou sous Propriétaires) ? → design.
5. **Action du registre** : réutiliser `CAMPAIGN_MANAGE` ou créer `campaign.group.manage` ?
6. **Nom de groupe unique par association** (sans casse) ? Renommage autorisé ?
7. **Archive** : la campagne envoyée à un groupe supprimé affiche-t-elle « Groupe « Riverains » (supprimé) »
   ou le seul nom copié ?
