---
validated: yes
---

# Plan — Story s27-groupes-destinataires

Branch: `feature/s27-groupes-destinataires`

Sources : `docs/research/s27-groupes-destinataires.md`, `docs/designs/s27-groupes-destinataires.md`
(+ `.html`), [ADR 060](../decisions/060-cible-de-campagne-groupes-et-impayes.md). Appuis : ADR 051, 052,
055, 057, 059.

## Target story

Le bureau choisit la cible d'une campagne : tous les membres (s25), les membres en impayé (prédicat de
s19, calculé à l'envoi, indifférent au fournisseur de factures — critères 1, 2), ou un groupe nommé qu'il
compose depuis la liste des membres (3, 4). Décompte avant l'envoi en fiches avec / sans adresse active,
puis en adresses (5). Supprimer un groupe ne touche ni les fiches ni les campagnes envoyées (6). Les
désinscrits sont exclus au calcul de la cible, quel qu'en soit le type (7). Un groupe est propre à son
association (8).

**Arbitrages du 18/11/2026** : une adresse partagée dont une seule fiche est ciblée reçoit un message qui ne
cite que la fiche ciblée, et une adresse désinscrite est exclue quelle que soit la fiche (ADR 060 §2) ;
sélection par cases à cocher + barre d'action dans la liste des propriétaires (gap 1 du design) ; entrée de
menu « Groupes », route `/bureau/groupes` (gap 3).

**Décidé au plan** (ADR 060) : type `CampaignTarget` à trois variantes ; filtre **après** regroupement par
adresse ; fiche en impayé = au moins une facture `isUnpaidInvoice` ; tables `recipient_group` et
`recipient_group_member` ; `campaign.target_group_id` (`SET NULL`) + `target_group_name` copié ; action
`campaign.group.manage`. Le décompte du critère 5 vaut pour les trois cibles (un seul affichage). Une
fiche dont toutes les adresses actives sont désinscrites compte « avec adresse active » et ses adresses
dans « désinscrites ». Nom de groupe obligatoire, bords retirés, 1 à 80 caractères (garde-fou de saisie,
comme `MEMBER_INVOICE_STATUS_MAX_LENGTH`), unique sans casse ; renommage permis. Gap 2 du design (option
de `radio-group` à contenu révélé) retenu tel que proposé.

## Tasks (ordered)

1. [x] **Modèle et migrations** — `src/db/models/recipient-group-model.ts` (`recipient_group`,
       `recipient_group_member`, contraintes de l'ADR 060 §4) dans `db.ts` ; `campaign.target_group_id`
       (uuid nullable, FK `SET NULL`) et `target_group_name` (text nullable) dans `campaign-model.ts`.
       `pnpm db:generate`, puis `drizzle-kit generate --custom` pour RLS activée **et** forcée + policy
       `tenant_isolation` sur les deux tables (patron `0064_member_invoice_rls.sql`). `docs/architecture.md` :
       deux lignes au classement (30 → 32), mention `recipient_group` l. 360 alignée. **Vérif** :
       `rls-inventory.test.ts` vert ; test de modèle (`src/db/recipient-group-model.test.ts`, patron
       `member-invoice-model.test.ts`) épinglant colonnes, cascades, unicité ; `pnpm db:generate` sans diff.
2. [x] **Registre et autorisation** — `ActionIdConst.CAMPAIGN_GROUP_MANAGE = 'campaign.group.manage'`
       (`owner`, `board`) dans `action-registry-types.ts`, commentaire sur le précédent ; fonction
       d'autorisation du domaine. **Vérif** : tests du registre (entrée présente, rôles par défaut) ;
       `member` refusé.
3. [x] **Règles pures de la cible** — `computeCampaignTarget(rows, isTargeted)` (ADR 060 §2 : regroupement
       sur toutes les lignes, adresse retenue si une fiche ciblée, désinscription par adresse quelle que
       soit la fiche, porteuse et lignes de valeurs parmi les fiches ciblées) ; `sameAddressRowsOf`
       restreint aux fiches ciblées ; décompte `{profilesWithEmail, profilesWithoutEmail, profiles,
recipients, unsubscribed}` ; `unpaidProfileIdsOf(invoices, classification)` (au moins une facture
       `isUnpaidInvoice`) ; type `CampaignTarget` et `CAMPAIGN_TARGET_KINDS = ['all_members',
'unpaid_members', 'group']`. **Vérif** : tests unitaires — adresse partagée fiche ciblée / non ciblée,
       désinscription portée par la fiche hors cible, `{parcelle}` limité, `unclassified` hors impayés,
       fiche à adresses toutes désinscrites, cible « tous » inchangée (non-régression des tests s25/s53/s54).
4. [x] **Groupes : repository, service, façade, DAL** — `recipient-group-repository.ts` (liste avec
       nombre de fiches, lecture, création, renommage, suppression, ajout idempotent `ON CONFLICT DO
NOTHING`, retrait, ids des fiches d'un groupe) ; `recipient-group-service.ts` (validation Zod i18n,
       autorisation `campaign.group.manage`, tout sous `withTenant`, refus d'une fiche non lisible sous le
       tenant, nom pris → refus typé) + façade avec intercepteur sans détails ; `recipient-group-dal.ts`
       (sans `'use cache'`). **Vérif** : tests de service par rôle (SuperAdmin, bureau, membre, invité),
       nom en doublon sans casse, fiche étrangère refusée, suppression sans effet sur les fiches.
5. [x] **Service de campagne : la cible choisie** — `readTarget(orgId, target, settings)` unique : lignes
       de toutes les fiches, prédicat selon le type (fournisseur résolu par les réglages pour
       `unpaid_members`, ids du groupe pour `group`, groupe introuvable → `NotFoundError`) ; appelé par
       `getCampaignComposerContextService`, `previewCampaignService`, `previewCampaignPlanService`,
       `sendCampaignService` ; ce dernier écrit `targetKind`, `targetGroupId`, `targetGroupName`. Schémas
       `createSendCampaignServiceSchema` / `createPreviewCampaignServiceSchema` + `target`. `CampaignDTO`
       porte la cible affichable. **Vérif** : tests de service — changer d'implémentation de facturation
       (fournisseur simulé) ne change pas la cible (critère 2) ; erreur du fournisseur remonte sans rien
       créer ; groupe d'une autre association → refus, jamais « tous » ; désinscrit exclu des trois types
       (critère 7) ; cible vide → `no_recipient`.
6. [x] **Composeur et actions de campagne** — carte « Destinataires » (`radio-group`, `select` du groupe,
       lien « Gérer les groupes », deux `dl` de décompte, états de l'écran 1) ; la cible traverse
       `previewCampaignAction` et `sendCampaignAction` (champs du `FormData`), le changement de cible
       relit le décompte ; libellés `CampaignsBureau.composer.recipients.*`. **Vérif** :
       `campaign-composer.test.tsx` (trois options, `select` révélé, décompte en fiches puis adresses,
       vides, erreur de factures sans envoi) ; `actions.test.ts` (cible transmise, refus mappés).
7. [x] **Liste des propriétaires : filtre et sélection** — `select` « Groupe » (`?groupe=`), colonne de
       `checkbox` + case de page, cartes mobile cochables, barre de sélection (`aria-live`) « Ajouter au
       groupe » / filtrée : « Retirer du groupe » ; actions serveur dans `bureau/proprietaires/actions.ts`
       (façade des groupes) ; succès / erreur ancrés. Filtre lu par le DAL des fiches (jointure
       `recipient_group_member`). **Vérif** : `member-profile-list.test.tsx` (sélection, barre, retrait en
       vue filtrée, aucun groupe) ; tests des actions (refus, succès) ; DAO filtré testé.
8. [x] **Écrans des groupes** — `/bureau/groupes` (liste, vide, `dialog` « Créer un groupe ») et
       `/bureau/groupes/[id]` (breadcrumb, carte Composition avec décompte du critère 5, lien vers la liste
       filtrée, `dialog` « Renommer », `alert-dialog` « Supprimer »), contrôle d'accès répété dans la page,
       404 sur id inconnu ou étranger ; entrée « Groupes » dans `bureau-sidebar.tsx` ; libellés
       `RecipientGroupsBureau.*`. **Vérif** : tests de pages et de la barre latérale.
9. [x] **Archive et design system** — détail d'une campagne : « Cible » = « Tous les membres », « Membres
       en impayé » ou « Groupe « … » » (+ « (supprimé) » si l'id est nul), `detail.targetKinds.*` complets ;
       `docs/design-system.md` : gaps 1 à 3 versés au §3 (« Formes retenues par s27 ») et retirés du §9 s'il
       y figuraient. **Vérif** : `campaign-detail.test.tsx` (trois cibles, groupe supprimé).
10. [x] **e2e** — `e2e/campaigns.spec.ts` (ou `e2e/recipient-groups.spec.ts`) : créer un groupe, y ajouter
        deux fiches depuis la liste, envoyer au groupe → seules leurs adresses dans l'outbox ; cible
        « impayés » avec une facture saisie `unpaid` et une `unclassified` → seule la première fiche reçoit ;
        désinscrit exclu ; supprimer le groupe → archive intacte (nom, destinataires) ; accès croisé : les
        deux tables invisibles depuis l'autre association, id forgé introuvable, ajout d'une fiche étrangère
        refusé (critère 8) ; seed mis à jour si nécessaire. **Vérif** : suite e2e verte **en CI** (pas en
        local, machine trop juste).

## Files touched

- `src/db/models/recipient-group-model.ts` (nouveau), `campaign-model.ts`, `db.ts`, `drizzle/migrations/0065_*`,
  `0066_*` (+ `meta/`), `src/db/recipient-group-model.test.ts`
- `src/db/repositories/recipient-group-repository.ts` (nouveau), `campaign-repository.ts`,
  `member-profile-repository.ts` (filtre groupe)
- `src/services/types/domain/action-registry-types.ts`, `campaign-types.ts`, `recipient-group-types.ts` (nouveau)
- `src/services/rules/campaign-rules.ts`, `member-invoice-rules.ts` (si `unpaidProfileIdsOf` y vit)
- `src/services/recipient-group-service.ts`, `facades/recipient-group-service-facade.ts` (+ intercepteur),
  `authorization/…`, `validation/recipient-group-validation.ts`, `campaign-service.ts`,
  `validation/campaign-validation.ts`
- `src/app/dal/recipient-group-dal.ts`, `member-profile-dal.ts`, `campaign-dal.ts`
- `src/app/[locale]/(bureau)/bureau/groupes/**` (nouveau), `bureau/campagnes/actions.ts`,
  `bureau/campagnes/nouvelle/page.tsx`, `bureau/proprietaires/{page,actions}.tsx`
- `src/components/features/recipient-groups/**` (nouveau), `campaigns/campaign-composer.tsx`,
  `campaign-detail.tsx`, `member-profile/member-profile-list.tsx`, `association/bureau-sidebar.tsx`
- `messages/fr.json`, `docs/architecture.md`, `docs/design-system.md`, `e2e/*.spec.ts`, seed si besoin
- `docs/research/`, `docs/designs/`, `docs/plans/`, `docs/decisions/060-*` (voyagent dans le commit)

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : règles pures de la cible (le cœur : adresse partagée,
  désinscription, impayés) ; services par rôle avec repositories et fournisseur mockés (critère 2 par un
  fournisseur simulé distinct de `manual`) ; composants (composeur, liste, écrans des groupes, détail) ;
  actions ; registre ; modèle et inventaire RLS.
- **e2e (Playwright, en CI)** : parcours bureau complet groupe et impayés lus dans l'outbox du transport
  `file` ; isolation entre deux tenants sur les deux nouvelles tables (la RLS n'est pas testable en
  unitaire).
- Montage 9p lent : en cas de timeout de worker, valider sur une copie en disque local ; un timeout n'est
  jamais un vert.

## Definition of Done

- Les huit critères couverts par au moins un test nommé ; critère 8 par un e2e d'accès croisé.
- Aucune régression : suite unitaire verte, e2e verts en CI, `pnpm lint` et typecheck propres.
- Deux tables sous RLS forcée, classées dans `docs/architecture.md` ; aucune nouvelle occurrence de
  `withRlsBypass`.
- Aucun libellé en dur hors `messages/fr.json` ; aucun statut de facture interprété hors
  `isUnpaidInvoice`.
- Un seul commit de story (+ un commit séparé pour les migrations si utile), revue passée, PR ouverte.
