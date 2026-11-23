---
validated: yes
---

# Plan — Story s29-relances-impayes

Branch: `feature/s29-relances-impayes`

Sources : `docs/research/s29-relances-impayes.md`, `docs/designs/s29-relances-impayes.md` (+ `.html`),
[ADR 070](../decisions/070-relances-impayes-campagnes-automatiques-par-echeance-et-rang.md).
Arbitrages du 23/11/2026 : calage « une à la fois » ; un seul objet et un seul texte pour les trois rangs.

## Target story

**En tant que** membre du bureau **je veux** que les impayés soient relancés automatiquement **afin de** ne
pas suivre à la main des dizaines de relances.

1. Activée : jusqu'à 3 relances par impayé (prédicat s19), à intervalles successifs depuis la **date
   d'échéance** (seed 3, 2, 1 semaines : échéance + 3, + 5, + 6 semaines).
2. Désactivée : aucune relance ; les campagnes manuelles inchangées.
3. Une facture réglée entre deux relances interrompt la série.
4. Jamais deux fois la même relance, même rejouée (test explicite).
5. Adaptateur d'envoi + budget quotidien s52 : reportée, jamais perdue.
6. Toutes les adresses actives (s54) ; une adresse partagée (s53) une seule fois par échéance.
7. Seuls les impayés ; ni à jour, ni statut à classer.
8. Nature s27b, seed `statutaire` ; désinscrit en impayé : reçoit en `statutaire`, pas en `facultative`.
9. Page de suivi : nom, parcelle, date de facture, nombre et dates des relances.
10. Sans email : listés « Courrier », publipostage de relance (s28) ; ni relancés par email, ni omis.

Amendement du 15/11 : test de volume (200 impayés le même jour), le report ne télescope pas le rang
suivant ; un propriétaire de plusieurs terrains reçoit une relance par adresse et par échéance qui
regroupe ses factures.

Décisions du plan (ADR 070) :

- une relance = une campagne automatique par (échéance, rang), créée sans session par la tâche
  quotidienne `billing.unpaid_reminders` ;
- cible recalculée à chaque rang, relue à l'envoi (statut de ligne `settled`) ;
- calage « une à la fois » ;
- idempotence par `unpaid_reminder` unique `(organization_id, due_on, rank)`, écrite dans la transaction
  de la campagne, et par une soumission uuid v5 ;
- réglages : activation, trois intervalles, un objet, un texte ;
- type d'envoi `unpaid_reminder` avec sa nature ;
- variable `{factures}` ;
- page `/bureau/relances` sous `campaign.manage` ;
- courrier par rang via la carte s28.

## Tasks (ordered)

1. [x] **Types d'envoi et nature.** Séparer dans `campaign-types.ts` les **types d'envoi portant une
       nature** (`CAMPAIGN_SEND_KINDS` = modèles du composeur + `unpaid_reminder`) des **modèles du composeur**
       (`CAMPAIGN_TEMPLATE_IDS`, inchangés) ; `CAMPAIGN_NATURE_SETTINGS` et `templateNaturesOf` / page de
       désinscription (`statutoryTemplateIds`) itèrent les types d'envoi ; libellé « Relance automatique » dans
       `messages/fr.json` (section « Nature des envois », page de désinscription, `EmailSendingBureau.pending`).
       Tests : le composeur ne propose pas `unpaid_reminder` ; le réglage `campaign.nature.unpaid_reminder`
       existe, `facultative` par défaut, réservé au SuperAdmin ; la page de désinscription l'annonce quand il
       est statutaire.
2. [x] **Réglages des relances.** Dans `ASSOCIATION_SETTINGS_REGISTRY`, section `reminder` (après
       `billing`) : `billing.reminder.enabled` (booléen, défaut `false`), `billing.reminder.delay_weeks.1|2|3`
       (entiers ≥ 1, max 52, sans défaut, unité « semaines »), `billing.reminder.subject` (texte, plafond de
       l'objet reçu), `billing.reminder.body` (texte long, plafond `CAMPAIGN_BODY_MAX`). Contrôle croisé :
       activer exige les cinq autres (code de refus dédié, message « … avant de l'activer »). Lecteurs typés
       (`getUnpaidReminderSettings(settings)`). Seed TechCorp : activé, 3/2/1, objet et texte fictifs, nature
       `statutaire`. Tests : registre, contrôle croisé (chaque réglage manquant refuse l'activation, la
       désactivation passe toujours), seed.
3. [x] **Règles pures du calendrier.** `src/services/rules/unpaid-reminder-rules.ts` :
   - `dueReminderRankOf({dueOn, delays, ranks, today})` → le rang dû ou rien. `ranks` contient les rangs
     créés, chacun avec son état terminé ou non et son jour d'envoi réel. Règle de l'ADR 070 §5 : au plus un
     rang, le précédent terminé, `max(échéance + Σ intervalles, envoi réel précédent + intervalle)` ;
   - `unpaidProfileIdsForDueOn(invoices, classification, dueOn)` ;
   - `formatUnpaidInvoicesList(invoices)` pour `{factures}` : liste Markdown, montant `formatAmountCents`,
     date `jj/mm/aaaa` ;
   - `reminderSubmissionIdOf(orgId, dueOn, rank)` en uuid v5 sous un espace de noms constant.

   Tests :
   - calendrier ponctuel (+3, +5, +6 semaines) ;
   - activation tardive (un seul rang à la fois) ;
   - rang précédent non terminé : rien de dû ;
   - report de R1 de 3 jours : R2 décalé d'autant ;
   - rang 3 créé : plus rien ;
   - un statut à classer n'est jamais impayé ;
   - deux échéances distinctes sont indépendantes ;
   - la soumission est stable.

4. [x] **Modèle et migrations.**
   - `src/db/models/unpaid-reminder-model.ts` : `id`, `organization_id`, `due_on` (date), `rank`
     (1-3, check), `campaign_id` → `campaign.id` (`cascade`), `created_at`, unique
     `(organization_id, due_on, rank)` ;
   - la valeur `settled` dans `campaign_recipient_status` ;
   - export dans `db.ts`, `pnpm db:generate`, puis `drizzle-kit generate --custom` pour la RLS (patron
     `0076_shared_document_rls.sql`) ;
   - `docs/architecture.md` : classement RLS 55 → 56 (37 scopées), ligne justifiée, renvoi à l'ADR 070.

   Tests : `rls-inventory.test.ts`, et `file-key-inventory.test.ts` inchangé.

5. [x] **Repository.** `unpaid-reminder-repository.ts` (`getDb()`) :
   - `listUnpaidRemindersDao(orgId)` : rangs, avec l'état de leur campagne et leur dernier jour d'envoi
     réel ;
   - `insertUnpaidReminderTxnDao`, appelée dans la transaction de création de la campagne ;
   - `getReminderRecipientsByProfileDao(orgId, campaignIds)` : par fiche, les rangs reçus par email (ligne
     `sent`, et sa date) et les rangs adressés par courrier (`campaign_letter_profile`).

   Dans `campaign-repository.ts` :
   - `createCampaignWithRecipientsTxnDao` accepte un `unpaidReminder?: {dueOn; rank}` écrit dans **la même
     transaction**. Un conflit sur la soumission (rejeu) rend `created: false` sans rien écrire ;
   - `markRecipientSettledTxnDao`.

   Les décomptes (`recipientCountsOf`, filtres de destinataires) classent `settled` à part : ni reçu, ni à
   vérifier, ni en échec.

6. [x] **Cœur de création partagé.** Extraire de `sendCampaignService` la séquence sous `withTenant`
       (cible → `campaignChannelsOf` → verrou → `planCampaignParts` → création → tâches), réutilisée sans
       changement de comportement par l'envoi manuel (tests existants de `campaign-service.test.ts` verts,
       inchangés).
7. [x] **Service des relances.** `src/services/unpaid-reminder-service.ts` :
   - `runUnpaidRemindersJobService(job, now)`, gestionnaire **sans session** :
     - désactivé : `completed`, sans se reprogrammer ;
     - activé : lecture des factures par le fournisseur actif. Une erreur de lecture rend `retry`, ne crée
       rien et ne vise jamais « tous » ;
     - pour chaque échéance ayant un impayé : `dueReminderRankOf`. Si un rang est dû et sa cible non vide,
       création de la campagne de type `unpaid_reminder`, avec la nature lue, l'objet et le texte figés et
       la soumission déterministe ;
     - puis programmation du jour suivant (`partRunAfter`). Clé de la tâche : le jour.
   - `scheduleUnpaidRemindersService(orgId, now)`, appelé par l'action des réglages quand
     `billing.reminder.enabled` passe à vrai. Il exige `campaign.manage`.
   - `getUnpaidRemindersOverviewService(orgId, now)`, sous `campaign.manage` :
     - par échéance, les rangs avec leur état et leurs dates (prévue, réelle, report) ;
     - par fiche en impayé : nom, parcelles, factures (date, échéance), rangs reçus avec leurs dates, et le
       canal (email ou courrier) ;
     - le compteur.

     C'est une liste blanche, sans adresse ni jeton. Si les factures sont illisibles, elle rend
     `unavailable`, jamais une liste vide.

   Branchement dans `scheduled-job-service-facade.ts` ; façade et intercepteur (patron des campagnes).

   Tests, avec les repositories mockés :
   - désactivée : rien n'est créé ;
   - activée : la cible ne contient que les impayés de cette échéance, ni à jour ni à classer ;
   - **rejeu** : même jour deux fois, crash simulé après la création puis reprise. Une seule campagne et un
     seul `unpaid_reminder` (critère 4) ;
   - facture réglée entre R1 et R2 : absente de R2 (critère 3) ;
   - nature `statutaire` et `facultative` : la ligne du désinscrit est réintégrée ou exclue (critère 8) ;
   - une adresse portée par deux fiches impayées : une seule ligne (critère 6) ;
   - une fiche sans email va au courrier de la campagne (critère 10) ;
   - par rôle : super_admin, owner, board, member, compte d'une autre association et sans session, pour
     l'aperçu et la programmation.

8. [x] **Envoi d'une relance.** Dans `deliverToRecipient` / `composeRecipientEmail`, pour une campagne de
       type `unpaid_reminder` :
   - relecture des factures des fiches de la ligne : sans impayé d'échéance D, `markRecipientSettledTxnDao`
     et `done`, rien ne part ;
   - sinon, `{factures}` est remplacée par `formatUnpaidInvoicesList`.

   Envoi par `sendEmailService` avec la portée tenant : le budget et le report sont inchangés (critère 5).
   Courrier (`campaign-letter-service.ts`) : même remplacement à la génération ; une fiche sans impayé est
   retirée du PDF et du décompte. La variable `{factures}` n'est reconnue que pour ce type :
   `findUnknownVariables` la refuse dans le composeur et dans le texte des réglages d'une autre clé.

   Tests :
   - réglée pendant un report : `settled`, aucun envoi ;
   - deux factures regroupées dans une seule relance ;
   - `deferred` : la ligne est rendue en attente, jamais perdue ;
   - **volume** : 200 impayés le même jour, 100 envois de campagne par jour. R1 tient en 2 parts, R2 n'est
     pas dû avant la fin de R1, aucun jour ne dépasse le plafond (amendement du 15/11).

9. [x] **Page de suivi et réglages (UI).**
   - `src/app/dal/unpaid-reminder-dal.ts`, sans `'use cache'` ;
   - `src/app/[locale]/(bureau)/bureau/relances/page.tsx`, derrière `<Suspense>`, avec
     `BureauAccessDenied` ;
   - composants `src/components/features/unpaid-reminder/` :
     - bandeau activé (neutre) ou désactivé (`warning`) ;
     - calendrier écrit par échéance, avec les états d'envoi du §3.13, « Non programmée », et les liens
       « Voir l'envoi » et « Courrier postal (n) » vers `/bureau/campagnes/{id}` et l'ancre de la carte s28 ;
     - compteur, tableau paginé à 25 avec cartes empilées sous 640 px, états vide, chargement et
       illisible ;
   - entrée « Relances » après « Campagnes » dans `NAV_GROUPS` ;
   - section « Relances des impayés » des réglages, placée après « Factures ». L'action des réglages appelle
     `scheduleUnpaidRemindersService` à l'activation ;
   - libellés `messages/fr.json`.

   Tests : états 1a à 1e et 2a / 2b, la fiche « Courrier » est présente et marquée, aucun `href` vers un
   chemin de stockage, et la barre latérale.

10. [x] **e2e.**
    - `e2e/unpaid-reminders.spec.ts` :
      - le bureau active la relance (refus sans texte, puis succès) ;
      - avec des factures saisies (statut impayé, échéance passée), un passage du planificateur crée R1 :
        la campagne est visible dans l'archive, ses destinataires ne contiennent que les impayés, et la
        fiche sans email est au courrier ;
      - **rejeu du passage** : toujours une seule R1 (critère 4) ;
      - la page `/bureau/relances` liste nom, parcelle, date, « 1 sur 3 » et la date ;
      - un membre réglé n'apparaît plus ;
      - un membre ne peut pas ouvrir la page.
    - Bloc RLS `unpaid_reminder` dans `e2e/tenant-isolation.spec.ts`.
    - Fixture `e2e/backup-restore.spec.ts` si elle énumère les tables.
11. [x] **Documentation.**
    - `docs/design-system.md` §3.13 : « Non programmée », calendrier des relances, publipostage par rang,
      variable `{factures}` (§5.6) ;
    - §9 : les manques du design ;
    - rappel d'exploitation : la minuterie du planificateur est indispensable aux relances
      (`docs/exploitation/README.md`).

    Lint, typecheck et `pnpm test --run` verts.

## Files touched

- **Nouveaux** :
  - `src/services/rules/unpaid-reminder-rules.ts` (+ test) ;
  - `src/db/models/unpaid-reminder-model.ts` ;
  - `drizzle/migrations/0077_*.sql`, `0078_unpaid_reminder_rls.sql` (+ meta) ;
  - `src/db/repositories/unpaid-reminder-repository.ts` ;
  - `src/services/unpaid-reminder-service.ts` (+ test) ;
  - façade et intercepteur ;
  - `src/app/dal/unpaid-reminder-dal.ts` (+ test) ;
  - `src/app/[locale]/(bureau)/bureau/relances/**` ;
  - `src/components/features/unpaid-reminder/**` ;
  - `e2e/unpaid-reminders.spec.ts`.
- **Modifiés** :
  - `campaign-types.ts`, `association-settings-types.ts`, `campaign-service.ts`,
    `campaign-letter-service.ts`, `campaign-rules.ts`, `campaign-repository.ts`, `campaign-model.ts` ;
  - `scheduled-job-types.ts`, `scheduled-job-service-facade.ts`, `unsubscribe-service.ts` ;
  - l'action des réglages, `bureau-sidebar.tsx`, `messages/fr.json`, `tenant-settings-seed.ts` ;
  - `src/db/models/db.ts`, `e2e/tenant-isolation.spec.ts` ;
  - `docs/architecture.md`, `docs/design-system.md`, `docs/exploitation/README.md`.
- **Voyagent avec la story** : la recherche, le design (.md + .html), l'ADR 070 et ce plan.

## Test strategy

- **Unitaire** (Vitest, `pnpm test --run`) :
  - règles pures : calendrier « une à la fois », cible par échéance, liste `{factures}`, soumission
    déterministe ;
  - service des relances, par rôle et par cas : désactivée, rejeu, réglée entre deux rangs, nature,
    adresse partagée, courrier, factures illisibles ;
  - envoi : `settled`, regroupement, report, volume de 200 ;
  - réglages : contrôle croisé de l'activation ;
  - composants : tous les états du design ;
  - non-régression de l'envoi manuel : tests existants inchangés.
- **e2e** (Playwright, en CI seulement) :
  - activation, passage du planificateur, archive et destinataires ;
  - **rejeu idempotent** ;
  - page de suivi et accès refusé ;
  - preuve RLS de `unpaid_reminder` entre deux tenants.

  La RLS n'est pas testable en unitaire.

- **Montage 9p lent** : un timeout de worker se revalide sur une copie en disque local, et n'est jamais
  compté vert.

## Definition of Done

- Une PR `feature/s29-relances-impayes` et un commit de story (plus un pour la migration si utile).
- Tests unitaires verts, dont le test explicite d'idempotence et le test de volume. e2e verts en CI.
- Aucune valeur propre à La Fourche dans le code : activation, intervalles, objet, texte et nature sont en
  réglages, avec leurs valeurs de seed.
- Aucun `withRlsBypass()` ajouté. `unpaid_reminder` sous RLS forcée, inventaire à jour.
- L'envoi manuel des campagnes est inchangé (critère 2).
- Revue passée (`Ship allowed: yes`).
- À la livraison : rappeler que la minuterie `asl-cms-planificateur` conditionne les relances en
  production.
