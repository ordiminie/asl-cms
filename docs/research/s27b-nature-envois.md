# Research — Story s27b-nature-envois

> 20/11/2026, orchestrateur. Exploration du code sur `main` (`f1566441`, s21 mergée, PR 77).

## Target story

**s27b — Distinguer les envois facultatifs des envois statutaires.** Un membre désinscrit continue de
recevoir convocations, factures et relances, sans subir les envois facultatifs refusés. Complexité 2.
Dépendances s25, s27. Réf. PRD l. 72, règle transverse « Désinscription » (`docs/stories.md:68-78`),
`docs/architecture.md:364-367`.

Critères :

1. Chaque type d'envoi existant porte une nature, `facultative` ou `statutaire`, **lue dans la
   configuration du tenant** : les quatre modèles de s25 et la campagne libre. Le bureau ne choisit pas
   la nature en rédigeant.
2. Sans nature configurée → `facultative`.
3. Un désinscrit est **réintégré** dans les cibles d'une campagne `statutaire` et reste exclu des
   `facultative` — sur les trois cibles (tous, impayés, groupe) et les deux natures.
4. Le pied de page d'un envoi `statutaire` dit qu'il est reçu malgré la désinscription, parce que
   l'appartenance à l'association y engage.
5. L'écran de confirmation de désinscription dit ce que le membre continuera de recevoir, d'après la
   classification.
6. Reclasser un modèle change le comportement **au prochain envoi**, sans redéploiement.

Notes : réintégration **au calcul de la cible** (point de passage unique) ; classification = donnée de
configuration du tenant, jamais une constante ; valeurs du premier tenant = **seed** (convocation AG,
facture, relance manuelle : `statutaire` ; documents post-AG, campagne libre : `facultative`) ; sur-exclure
est le sens sûr ; pas de case « information obligatoire » au moment d'écrire. s29 et s42 déclareront
leurs propres envois dans ce mécanisme (hors story).

## Current state of the code

- **Modèles** — `CAMPAIGN_TEMPLATE_IDS` (`src/services/types/domain/campaign-types.ts:10`) : `free`,
  `reminder`, `invoice`, `general_assembly`, `post_assembly_documents`. Textes dans `messages/fr.json`
  (`email.campaign.templates.*`, libellés `CampaignsBureau` l. ~4254). `campaign.template_id` est stocké
  (texte, nullable).
- **Calcul de la cible** — `computeCampaignTarget(rows, isTargeted)` (`src/services/rules/campaign-rules.ts:136`) :
  groupe les lignes par adresse ; **une adresse dont une fiche est désinscrite est comptée `unsubscribed`
  et n'est pas destinataire** (l. 158). Docstring : « s27b y réintègre les statutaires. » Les lignes
  viennent de `getCampaignTargetRowsDao` (`unsubscribed` = `member_profile_email.unsubscribed_at is not null`,
  ADR 057 : désinscription **par adresse**).
- **Lecteurs de la cible** — `readTarget(orgId, choice, settings)` (`campaign-service.ts:~300`), appelé par
  quatre services : `getCampaignComposerContextService` (décompte du composeur, relu par
  `readCampaignTargetAction` à chaque changement de cible), `previewCampaignService`,
  `sendCampaignService`, `previewCampaignPlanService`. **Aucun ne reçoit le modèle** aujourd'hui, sauf
  aperçu et envoi (dans `data.templateId`).
- **Second filtre, à la livraison** — `deliverToRecipient` (`campaign-service.ts:~854`) : une ligne dont
  l'adresse s'est désinscrite **entre la création et sa part** (envoi étalé, s26) est marquée
  `unsubscribed` et n'est pas envoyée (`PendingRecipientRowModel.unsubscribed`, repository l. ~596).
- **Archive** — `campaign` (`src/db/models/campaign-model.ts`) : `template_id`, `unsubscribed_count`
  (figé), aucune nature.
- **Email** — `src/lib/emails/campaign-email.tsx` et `campaign-text.ts` : pied de page `reason`,
  bouton `unsubscribe`, `notice` = « Se désinscrire ne vous prive d’aucune information obligatoire. »
  (`email.campaign.footer`). En-têtes `List-Unsubscribe` (`listUnsubscribeHeaders`).
- **Désinscription** — page publique `src/app/[locale]/(public)/desinscription/[jeton]/page.tsx`,
  `UnsubscribePanel` (`src/components/features/campaigns/unsubscribe-panel.tsx`) : états
  confirm / unsubscribed / already / invalid / error ; docstring : « aucune phrase sur ce que le membre
  continuera de recevoir ». Service `unsubscribe-service.ts`, DAL `unsubscribe-dal.ts`.
- **Réglages** — registre `ASSOCIATION_SETTINGS_REGISTRY` (`association-settings-types.ts`), type
  `choice` (`radio-group`, §3.1), sections `seo | legal | sending | billing`, `editableBy: 'super_admin'`
  (s52). Seed des tenants de test : `src/db/scripts/tenant-settings-seed.ts` (`TEST_TENANT_SETTINGS`,
  « valeur de seed du premier tenant », TechCorp).

## Anchor points

- **Réglages** : une clé `choice` par type d'envoi (`campaign.nature.<templateId>`), options
  `facultative` / `statutaire`, défaut `facultative` (critère 2) ; accesseur
  `campaignNatureOf(settings, templateId)` qui rend `facultative` pour toute valeur inconnue.
- **Calcul** : `computeCampaignTarget(rows, isTargeted, nature)` — `statutaire` : l'adresse désinscrite
  reste destinataire (décompte « réintégrées ») ; `facultative` : inchangé. `readTarget` reçoit la nature
  → les quatre lecteurs reçoivent le modèle.
- **Archive** : nature **figée** sur `campaign` à la création (colonne + migration), lue par la
  livraison (pas de second filtre en `statutaire`) et par le pied de page.
- **Email** : mention `statutaire` dans le pied (critère 4).
- **Page de désinscription** : liste des types `statutaire` du tenant (critère 5).
- **Composeur** : décompte relu quand le modèle change, plus seulement la cible.

## Verified APIs / functions

- `computeCampaignTarget`, `campaignTargetCountsOf`, `sameAddressRowsOf` — `campaign-rules.ts:136,173,187`.
- `readTarget` / `readAssociationWithSettings` — `campaign-service.ts`.
- `getAssociationSettingsService(organizationId)` — déjà lu par chaque service de campagne.
- `isSuperAdminOnlySetting(definition)` — `association-settings-types.ts:832` (`editableBy`).
- `createCampaignWithRecipientsTxnDao`, `markRecipientUnsubscribedTxnDao` — `campaign-repository.ts`.
- `getUnsubscribePageStateService({organizationId, token})` — `unsubscribe-service.ts:64`.

## Traps & constraints

1. **Deux filtres, pas un.** La note « réintégration au calcul de la cible, pas à l'envoi » vise le
   choix des destinataires. Mais le filtre de livraison (s26) exclurait un membre qui se désinscrit
   pendant l'envoi étalé d'une convocation : en `statutaire`, il doit être sauté, sinon le critère 3
   n'est vrai que le premier jour.
2. **Nature figée à la création.** Lire le réglage à la livraison ferait changer de comportement une
   campagne déjà en cours si le modèle est reclassé (critère 6 : « au prochain envoi »). D'où la colonne.
   Migration via `pnpm db:generate` ; campagnes existantes = `facultative` (c'est ce qu'elles ont fait).
3. **Défaut sûr** : toute valeur inconnue, vide ou mal saisie → `facultative`. Jamais l'inverse.
4. **Pas de nature dans la saisie** : ni case, ni champ dans le composeur ; le service lit la nature du
   modèle dans les réglages, jamais d'une entrée du formulaire (sinon contournement de la désinscription).
5. **Décomptes** : `unsubscribed` = adresses **exclues**. En `statutaire` elles sont destinataires : le
   composeur doit le dire, sans laisser croire qu'elles sont exclues (« Désinscrits exclus » sur la fiche
   de campagne).
6. **Pied de page** : la phrase actuelle « Se désinscrire ne vous prive d’aucune information
   obligatoire » devient vraie avec s27b ; elle reste sur les deux natures, la mention statutaire s'ajoute.
   Le lien de désinscription et `List-Unsubscribe` restent sur un envoi statutaire (il désinscrit des
   facultatifs).
7. **Valeurs de seed** dans `TEST_TENANT_SETTINGS` (TechCorp), jamais dans le registre. En production,
   la classification de La Fourche se saisit dans les réglages (à noter pour la mise en prod).
8. **Page publique** : la désinscription n'a pas de session ; la liste des envois statutaires se lit par
   le tenant résolu au domaine, sans donnée du membre.
9. **e2e** : `e2e/campaigns.spec.ts` compte destinataires / désinscrits par SQL (l. 152-190) ; à étendre
   aux deux natures × trois cibles. e2e en CI seulement.

## Open questions

1. **Qui peut reclasser un type d'envoi** — le bureau (comme les autres réglages d'envoi) ou le
   SuperAdmin seul (`editableBy: 'super_admin'`) ? Ni les critères, ni le PRD, ni l'architecture ne le
   tranchent. Reclasser « Campagne libre » en `statutaire` rendrait la désinscription sans effet.
