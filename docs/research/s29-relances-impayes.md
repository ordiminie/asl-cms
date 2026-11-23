# Research — Story s29-relances-impayes

> Recherche du 2026-11-23, chemin `/ks-orchestrator`. Méthode : `codebase-analysis` — fil suivi de bout en
> bout : une campagne « membres en impayé » (composeur → `sendCampaignService` → `scheduled_job` →
> `deliverCampaignPartService` → `sendEmailService` → budget s52), puis son courrier (s28).

## Target story

**En tant que** membre du bureau **je veux** que les impayés soient relancés automatiquement **afin de** ne
pas suivre à la main des dizaines de relances.

1. Relance automatique activée pour le tenant : un membre dont une facture est « impayée » (prédicat s19)
   reçoit jusqu'à 3 relances, ancrées sur la **date d'échéance** de cette facture.
2. Désactivée : aucune relance automatique ; le reste des campagnes fonctionne normalement.
3. Une facture réglée entre deux relances interrompt la série.
4. Jamais deux fois la même relance, même si le traitement est rejoué (test explicite).
5. Passage par l'adaptateur d'envoi, décompte du budget quotidien (s52) : reportée, jamais perdue.
6. Toutes les adresses actives de la fiche (s54) ; une adresse portée par plusieurs fiches (s53) ne reçoit
   qu'une relance par échéance.
7. Seuls les impayés au sens du prédicat ; ni membre à jour, ni statut « à classer ».
8. Nature déclarée dans le mécanisme s27b, seed `statutaire` ; vérifiée sur `statutaire` **et**
   `facultative` (désinscrit en impayé).
9. Page de back-office : par impayé — nom, parcelle, date de la facture, nombre et dates des relances.
10. Impayés sans email : présents, marqués « courrier », avec une action qui génère leur publipostage (s28) ;
    ni relancés par email, ni omis.

Amendement du 15/11 : échéance identique pour tous (une facture par terrain et par an) → les trois relances
tombent aux mêmes dates pour tous ; **test de volume** (200 impayés le même jour) et vérifier que le report
ne télescope pas la relance suivante. Un propriétaire de plusieurs terrains : une relance par adresse et
par échéance, qui regroupe ses factures.

### Le calendrier « 3, 2 puis 1 semaine »

Le libellé de la story (« déclenchées 3, 2 puis 1 semaine après la date d'échéance ») ne se lit pas
littéralement (21 j, 14 j, 7 j ne sont pas dans l'ordre). Les sources le tranchent :

- CDCT fonctionnel V5 §8.3 : « jusqu'à 3 relances individuelles automatiques, **espacées respectivement de
  3, 2 puis 1 semaine** » ;
- CDCT technique §8.3 : « jusqu'à 3, **espacées** 3/2/1 semaines » ;
- réponse 6 de La Fourche : l'échéance sert « de point de départ aux relances (3, 2 puis 1 semaine
  après) ».

Lecture retenue : **intervalles successifs depuis l'échéance** — R1 = échéance + 3 sem., R2 = R1 + 2 sem.
(échéance + 5 sem.), R3 = R2 + 1 sem. (échéance + 6 sem.). Les trois intervalles sont des **seuils** au
sens de l'ADR 010 : réglages de tenant, seed 3/2/1 pour le premier tenant.

## Current state of the code

Aucune relance automatique n'existe. Tout le reste de la chaîne existe et est éprouvé :

| Brique                        | Où                                                                                              | Ce qu'elle fait aujourd'hui                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facture + échéance            | `src/db/models/member-invoice-model.ts`                                                         | `member_invoice.due_on` (date, `>= issued_on`), `status` opaque, `member_profile_id` clé de rattachement, `parcel_id` descriptif (nul pour Pennylane).                                                    |
| Prédicat « impayé »           | `src/services/rules/member-invoice-rules.ts`                                                    | `isUnpaidInvoice`, `getInvoiceStatusClassification(settings)`, `unpaidProfileIdsOf(invoices, classification)` ; un statut à classer n'est pas impayé.                                                     |
| Fournisseur de factures       | `src/services/billing/resolve-member-billing-provider.ts`, `member-billing-provider.ts`          | `resolveMemberBillingProvider(settings).listInvoicesOf(orgId, profileIds)` → `MemberInvoice[]` (avec `dueOn`, `status`, `parcelNumber`). `manual` ou `pennylane`.                                         |
| Cible « impayés » (s27)       | `src/services/campaign-service.ts` `unpaidPredicateOf` / `readTarget` (l. 302-368)              | Lignes de **toutes** les fiches (`getCampaignTargetRowsDao`, une ligne par adresse active), prédicat, puis `computeCampaignTarget(rows, isTargeted, nature)`. Erreur de lecture → `CampaignTargetUnavailableError`, jamais « tous ». |
| Nature (s27b)                 | `campaign-types.ts`, `association-settings-types.ts` `CAMPAIGN_NATURE_SETTINGS` (l. 339-365)    | Un réglage `campaign.nature.<templateId>` par valeur de `CAMPAIGN_TEMPLATE_IDS`, `facultative` par défaut, `editableBy: 'super_admin'`. Le commentaire l. 337 l'annonce : « s29 et s42 ajouteront les leurs ». |
| Création d'une campagne       | `sendCampaignService` (l. 560-673)                                                              | Session + `campaign.manage` ; sous `withTenant` : cible, `lockCampaignScheduleTxnDao`, `planCampaignParts`, `createCampaignWithRecipientsTxnDao` (campagne, parts, destinataires, fiches courrier), une tâche `campaign.deliver_part` par part. |
| Livraison                     | `deliverCampaignPartService` (l. 1134-1182)                                                     | Sans session ; ligne `pending → sending → sent` ; refus certain / issue inconnue ; report s52 (`deferPartOutcome` fait glisser les parts suivantes) ; désinscrit écarté si `facultative`.                   |
| Planificateur                 | `scheduled_job` (unique `(org, kind, idempotency_key)`), `scheduled-job-service.ts`, `src/db/scripts/run-scheduled-jobs.ts` | Passage toutes les 5 min (`asl-cms-planificateur.timer`) ; registre composé dans `facades/scheduled-job-service-facade.ts`. Issues `completed / retry / failed / released / deferred`.                |
| Tâche récurrente (patron)     | `src/services/pennylane-sync-service.ts` `enqueueNextSync` (l. 270-302)                          | Chaîne auto-reprogrammée : clé d'idempotence = l'instant visé ; garantie au passage du réglage à `pennylane` (`schedulePennylaneSyncService`).                                                             |
| Budget quotidien (s52)        | `email-service.ts` `sendTenantEmail` (l. 378-408), `email-send-types.ts`                        | `TENANT_EMAIL_NATURES` (`login`, `campaign`, `board_notification`, `member_email_confirmation`) — commentaire : « s29 et s42 y ajoutent la leur ». Une campagne reporte elle-même (`isDeferredByCaller`). |
| Courrier (s28)                | `campaign-letter-service.ts`                                                                    | `getCampaignLetterContextService` / `generateCampaignLettersService(orgId, campaignId, grouping)` : lettres des fiches **figées** sur la campagne (`campaign_letter_profile`), contenu figé de la campagne. |
| Réglages                      | `ASSOCIATION_SETTINGS_REGISTRY`, `association-settings-form.tsx`                                | Le type `boolean` est pris en charge par le formulaire (l. 134, 561, 580) mais **aucun réglage booléen n'existe en production** : s29 est le premier.                                                     |
| Textes des modèles            | `messages/fr.json` `email.campaign.templates.reminder`                                          | Modèle de **relance manuelle** (s25), texte provisoire `[Texte provisoire — à remplacer avant l'envoi]`, prérempli dans le composeur et modifié par le bureau avant l'envoi.                               |
| Seed                          | `src/db/scripts/tenant-settings-seed.ts`, `tenant-member-invoices-seed.ts`                      | `campaign.nature.reminder = statutaire` chez TechCorp ; factures de test (dont une « Relance 1 », statut opaque).                                                                                        |
| Barre du bureau               | `bureau-sidebar.tsx` `NAV_GROUPS`                                                               | Groupe « Association » : propriétaires, questions, documents, groupes, campagnes, envois, identité, réglages.                                                                                             |

## Anchor points

- **Moteur d'envoi** : une relance est une **campagne** créée sans session (cible « impayés de cette
  échéance »). Elle hérite gratuitement des parts, du budget et du report s52, de l'idempotence des lignes
  de destinataire, du dédoublonnage par adresse (`sameAddressRowsOf`, `campaign_recipient_profile` — critère
  6), du pied statutaire / facultatif, de l'archive et de la liste des destinataires (s26), du courrier figé
  (s28 — critère 10) et des statistiques (s30). Point d'entrée à extraire : la partie « sous `withTenant` »
  de `sendCampaignService` (cible → plan → `createCampaignWithRecipientsTxnDao` → tâches), appelable par un
  gestionnaire sans session.
- **Déclenchement** : un nouveau `kind` du planificateur, chaîne quotidienne auto-reprogrammée par tenant
  (patron `enqueueNextSync`), garantie quand le réglage passe à « activé » (patron
  `schedulePennylaneSyncService`, appelé depuis l'action des réglages).
- **Nature** : `CAMPAIGN_TEMPLATE_IDS` alimente à la fois les natures **et** les choix du composeur ; la
  relance automatique a besoin d'une nature propre sans devenir un modèle sélectionnable.
- **Budget** : `TENANT_EMAIL_NATURES` (le commentaire prévoit l'ajout s29).
- **Réglages** : `ASSOCIATION_SETTINGS_REGISTRY` (activation, intervalles, texte), seed TechCorp.
- **Page de suivi** : `/bureau/relances` (nouveau), entrée dans `NAV_GROUPS`, action `campaign.manage`
  (ou une action dédiée au registre, ADR 018).
- **Courrier** : `generateCampaignLettersService(orgId, campaignId, grouping)` existe déjà par campagne.

## Verified APIs / functions

- `unpaidProfileIdsOf(invoices: readonly {memberProfileId; status}[], classification): Set<string>` —
  `member-invoice-rules.ts:134`.
- `isUnpaidInvoice(status, classification): boolean` — `member-invoice-rules.ts:48`.
- `getInvoiceStatusClassification(settings: ResolvedAssociationSettings)` — `member-invoice-rules.ts:62`.
- `resolveMemberBillingProvider(settings).listInvoicesOf(organizationId, profileIds)` →
  `Promise<MemberInvoice[]>` — `member-billing-provider.ts:22`.
- `computeCampaignTarget(rows, isTargeted, nature)`, `sameAddressRowsOf(rows, row, isTargeted)`,
  `CampaignTargetPredicate` — `src/services/rules/campaign-rules.ts:152, 219, 121`.
- `getCampaignTargetRowsDao(organizationId)` — `src/db/repositories/campaign-repository.ts:171` (jointure
  `member_profile_email.status = 'active'`).
- `createCampaignWithRecipientsTxnDao(campaign, parts, recipients, letterProfileIds)`,
  `lockCampaignScheduleTxnDao`, `getAllottedRecipientsByDayDao`, `planCampaignParts`, `partRunAfter` —
  utilisés par `sendCampaignService` (l. 605-664).
- `enqueueScheduledJobTxnDao({organizationId, kind, idempotencyKey, runAfter, payload})` —
  `scheduled-job-repository.ts` ; `payload: Record<string, string>`, identifiants seulement.
- `ScheduledJobHandler = (job: ScheduledJob, now: Date) => Promise<ScheduledJobOutcome>` —
  `scheduled-job-types.ts`.
- `sendEmailService(payload, {scope: 'tenant', organizationId, nature}, {recipientType: 'client'})` →
  `{status: 'sent' | 'deferred' | 'skipped'}` — `email-service.ts:418`.
- `campaign` : `submission_id uuid not null`, unique `(organization_id, submission_id)` ; `author_user_id`
  et `author_name` **nullables** ; `template_id text` nullable ; `target_kind text` (pas d'enum) —
  `campaign-model.ts:59-127`.
- `uuid` `^14.0.1` est une dépendance (v5 disponible pour une clé déterministe).

## Traps & constraints

1. **Lecture du calendrier** : intervalles cumulés (voir plus haut). Une lecture « 21 / 14 / 7 jours après
   l'échéance » enverrait R3 avant R1.
2. **Pas de session dans le planificateur** : `sendCampaignService` exige `campaign.manage` et l'auteur de
   la session. La création automatique doit réutiliser le cœur sous `withTenant` sans dupliquer la logique
   de cible ni contourner l'autorisation des chemins avec session. Aucun `withRlsBypass()`.
3. **Ciblage recalculé à chaque échéance** (note agentique) : le prédicat est relu au moment de chaque
   relance, jamais figé au lancement de la série — c'est ce qui donne le critère 3. Une part **reportée**
   (budget) part plus tard avec une cible figée à la création : une facture réglée pendant le report
   recevrait quand même la relance. À trancher au plan (relecture du prédicat à la livraison, ou accepté).
4. **Cible plus fine que `unpaid_members`** : `unpaid_members` = « au moins une facture impayée », toutes
   échéances confondues. Une relance porte sur **une échéance** : la cible doit être « fiches dont une facture
   impayée a cette échéance ». Un statut à classer ne relance pas (le prédicat s'en charge).
5. **Idempotence à trois étages** (critère 4, test explicite) : clé de tâche (`org, kind, clé`), unicité
   de la campagne de relance par (échéance, rang), et lignes de destinataire déjà idempotentes (s26). Un
   rejeu après un crash entre la création et l'enregistrement du rang ne doit pas créer une seconde
   campagne : la création et la trace du rang doivent être dans la **même transaction**, ou la soumission
   déterministe (uuid v5 de l'échéance et du rang) doit faire jouer l'unicité existante.
6. **Activation tardive / rattrapage** : activer la relance six semaines après l'échéance ne doit pas
   envoyer R1, R2 et R3 le même jour. Règle à fixer au plan.
7. **Volume** (amendement) : 200 à 400 impayés le même jour. Le plafond des campagnes (`campaign.daily_send_cap`,
   100 par défaut) étale déjà une campagne en parts ; R3 n'est qu'à une semaine de R2 : vérifier par un test
   qu'un report ne fait pas partir R2 après R3 (`deferPartOutcome` fait glisser les parts **de toutes les
   campagnes** sous le plafond).
8. **Nature sans nouveau modèle sélectionnable** : ajouter une valeur à `CAMPAIGN_TEMPLATE_IDS` la ferait
   apparaître dans le composeur (choix, nature affichée, texte provisoire) et sur la page de désinscription
   (liste des envois statutaires — ce qui est plutôt voulu). Séparer « types d'envoi qui portent une nature »
   de « modèles du composeur ».
9. **Texte de la relance** : « rien en dur » (ADR 010, *textes*). Le texte de `messages/fr.json` est un
   **brouillon provisoire** que le bureau remplace avant l'envoi : une relance automatique ne peut pas
   partir avec la ligne « Texte provisoire ». Le texte doit être un réglage du tenant, valeur de seed du
   premier tenant, et la relance ne peut être activée sans texte.
10. **Factures regroupées** : un propriétaire de plusieurs terrains reçoit une seule relance par adresse et
    par échéance ; `{parcelle}` liste déjà toutes les parcelles de la fiche (`joinParcelNumbers`) ; la
    présentation des factures regroupées relève de `/ks-design`.
11. **Réglage booléen** : premier booléen de production ; le formulaire le gère, mais aucun test de bout en
    bout ne l'a encore porté.
12. **RLS** : toute nouvelle table (trace des relances) porte `organization_id`, policy `tenant_isolation`
    forcée, et passe le classement de `docs/architecture.md` (55 → 56) ; accès croisé prouvé en e2e.
13. **Page de suivi** : donnée par utilisateur, aucun `'use cache'` ; liste blanche (ni adresse, ni jeton).
14. **Tests** : `campaign-service.test.ts` (1 296 lignes de service, test associé volumineux) — étendre
    sans casser les mocks existants ; e2e voisins : `campaigns.spec.ts`, `campaign-letters.spec.ts`,
    `email-budget.spec.ts`, `member-invoices.spec.ts`, `tenant-isolation.spec.ts`. E2e en CI seulement.
15. **Planificateur en production** : la minuterie `asl-cms-planificateur` n'est pas encore installée sur
    le VPS (rappel mémoire du 12/11) — sans elle, aucune relance ne part. À rappeler à la livraison.

## Open questions

1. Rattrapage à l'activation tardive (piège 6) : n'envoyer que la relance la plus récente échue, ou ne
   lancer que les relances futures ?
2. Relecture du prédicat à la livraison d'une part reportée (piège 3).
3. Un texte pour les trois rangs, ou un par rang ?
4. Droit d'accès de la page de suivi : `campaign.manage` existant, ou une action dédiée ?
