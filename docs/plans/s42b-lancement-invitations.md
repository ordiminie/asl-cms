---
validated: yes
---

# Plan — Story s42b-lancement-invitations

Branch: `feature/s42b-lancement-invitations`, créée depuis `main` à jour (`ec162488` ou suivant ; vérifier
`origin/main..main` vide avant de brancher). Ne pas embarquer `docs/logs/`. Le commit de story embarque la
recherche, le design (`.md` + `.html`), ce plan, l'ADR 072, puis la revue au ship.

Sources : `docs/stories.md` (s42b), `docs/research/s42b-lancement-invitations.md` (dont « Arbitrages du
24/11/2026 »), `docs/designs/s42b-lancement-invitations.md` + `.html`, `docs/reviews/s42a-invitation-individuelle.md`
(m4, m5), [ADR 071](../decisions/071-lien-d-invitation-par-le-generateur-du-lien-magique.md),
[ADR 070](../decisions/070-relances-impayes-campagnes-automatiques-par-echeance-et-rang.md),
[ADR 065](../decisions/065-fiches-du-courrier-figees-a-la-creation-de-la-campagne.md),
[ADR 072](../decisions/072-lancement-des-invitations-par-le-moteur-de-campagnes.md) (nouveau, écrit avec
ce plan). Règles : `rule-architecture`, `rule-service`, `rule-authorization-service`, `rule-persistence`,
`rule-safe-server-action`, `rule-server-actions-internationalization`, `rule-presentation`,
`rule-safe-route`, `rule-react-cache-next-cache`, `rule-table-ui-ux-pagination`, `rule-translation`,
`rule-services-tests`, `rule-logger`.

## Target story

Le bureau annonce le site à toute l'association d'un seul geste. Chaque adresse active reçoit une
invitation avec son propre lien de connexion, et chaque fiche sans adresse reçoit un courrier. Le bureau
suit ensuite l'adoption et relance les jamais connectés. Critères, numérotés dans l'ordre de la story :

1. Campagne d'invitation vers tous les membres avec email, un lien propre par destinataire.
2. Même opération : publipostage PDF (s28) pour les sans-email, texte = réglage distinct, ni lien ni
   promesse d'accès.
3. Lancement et relance déclarent leur nature (s27b), seed `statutaire`. En `statutaire`, la relance
   atteint un désinscrit du lancement jamais connecté. En `facultative`, elle l'exclut.
4. Habillage s25 (logo, pied, désinscription), mention statutaire en `statutaire`. Texte et lien = ceux
   de s42a.
5. Aucune fiche omise des deux canaux, décompte **en fiches** (cas s53 et s54).
6. Chaque adresse active de la fiche, un lien chacune. Une adresse sur plusieurs fiches = une invitation.
7. Suivi **par adresse** : invitations envoyées, connectées, liste des jamais connectées avec leur
   fiche, adresse non active marquée, un seul état par adresse partagée. Couverture en fiches.
8. Relance : chaque adresse **active** jamais connectée (invitée ou non, ajoutée après le lancement
   comprise, proche d'un titulaire connecté compris), jamais une adresse en attente, jamais une adresse
   connectée.
9. Adaptateur d'envoi et budget quotidien (s52) : scission et report comme tout envoi.
10. Lien d'une part reportée au lendemain, hors requête : domaine de l'association, session ouverte,
    deux associations.

**Arbitrages de l'utilisatrice (24/11/2026)** : un lancement unique par association (Q7), puis « Relancer
les jamais connectés ». La relance est un email seul, sans courrier (Q10). Deux types d'envoi, donc deux
natures, seedées `statutaire` (Q1). En `facultative`, une fiche dont toutes les adresses sont désinscrites
ne reçoit ni email ni courrier : elle est comptée à part, et C5 se prouve sous la nature du seed (Q3).

**Choix techniques retenus par ce plan** (recommandations de la recherche, ADR 072) :

- Q2 : le contenu est figé à la création. Le texte de l'invitation va dans `body_markdown`, lu comme texte.
  Le texte du courrier va dans la colonne nouvelle `campaign.letter_text`.
- Q4 : à la livraison, une adresse connectée depuis la création est écartée sans envoi, sous le
  **nouveau statut `superseded`** (pas `settled`, voir ADR 072, options).
- Q5 : à la livraison, une adresse invitée après la création de la campagne est écartée de la même façon.
  S'y ajoute le correctif m5 au rejeu des invitations reportées.
- Q6 : la révocation inter-associations (m4) est documentée et non corrigée. L'e2e C10 utilise des comptes
  distincts par association.
- Q8 : « invitations envoyées » compte les adresses dont `last_invited_at` est non nul.
- Q9 : `campaign.manage` pour lancer, relancer et lire le suivi.
- Q11 (design) : page `/bureau/invitations`, entrée « Invitations » après « Relances », objet sans
  double préfixe.

**Choix du design, confirmé à la validation du 24/11/2026** : tant qu'une part du lancement ou d'une
relance reste à envoyer, « Relancer » laisse la place à une phrase (état 1g). Cela évite deux liens
concurrents pour une même adresse. Le service refuse aussi (`in_progress`), pas seulement l'écran.

**Taille** : dix tâches pour une complexité 4, au seuil du découpage. Une coupe « suivi d'adoption » à
part laisserait un lancement à l'aveugle, ce que la story exclut (le suivi est la raison d'être de C7).
Pas de scission proposée.

## Tasks (ordered)

1. [x] **Types d'envoi, réglages et libellés.**
   - `campaign-types.ts` : `MEMBER_INVITATION_LAUNCH_SEND_KIND = 'member_invitation_launch'` et
     `MEMBER_INVITATION_REMINDER_SEND_KIND = 'member_invitation_reminder'`, ajoutés à
     `CAMPAIGN_SEND_KINDS` après `unpaid_reminder`, jamais à `CAMPAIGN_TEMPLATE_IDS` (ils restent
     absents de `campaignTemplateIdSchema`). Le prédicat `isMemberInvitationKind(templateId)` vit au même
     endroit.
   - Registre (`association-settings-types.ts`) : clé `invitation.letter_text` (`text`, `multiline`,
     `maxLength` 2000, facultative, `whenEmptyKey` qui cite le défaut, section `invitation`, après
     `invitation.text`) et accesseur `getInvitationLetterText(settings): string | null`. Les deux
     natures sont générées par le registre.
   - Seed `tenant-settings-seed.ts` : les deux natures à `statutaire` pour le premier tenant seulement
     (Marketing Pro reste `facultative` par défaut, ce qui sert l'e2e).
   - `messages/fr.json` :
     - `campaignNature.templates.*` et `templateNames.*` (« Lancement du site », « Relance des
       invitations »), plus le panneau de désinscription s'il a sa propre liste ;
     - les textes du réglage `invitationLetterText` (défaut du design, écran 4 : aucun lien, aucune
       promesse d'accès, aucune fonctionnalité non livrée) ;
     - les descriptions élargies de la section et de `invitationText` (écran 5a) ;
     - l'objet et le pré-en-tête figés de l'invitation de masse, **sans** `{name}` ;
     - l'objet fixe du courrier (« le site de {name} est en ligne ») et la ligne « Adresse du site :
       {domain} ».
   - Tests mis à jour (liste de la recherche) : `association-settings-rules.test.ts`
     (`CAMPAIGN_SEND_KINDS`, clés de nature, décomptes générés), `association-settings-form.test.tsx`
     (« six réglages… », section des natures), `tenant-settings-seed.test.ts`. Nouveaux tests :
     accesseur absent → `null`, deux natures `statutaire` au seed, type absent du schéma du composeur.
2. [x] **Modèle : colonne du courrier et statut d'écart.**
   - `campaign-model.ts` : `letterText: text('letter_text')` (nullable, commentaire ADR 072 §6). Valeur
     `superseded` ajoutée en fin de `campaignRecipientStatusEnum`.
   - Migration par `pnpm db:generate` uniquement (`ALTER TYPE … ADD VALUE` + `ADD COLUMN`, patron
     `0077`). Aucune table nouvelle, donc aucune RLS nouvelle : la colonne hérite de la policy de
     `campaign`.
   - `CAMPAIGN_RECIPIENT_STATUSES` et `CampaignRecipientCountsDTO` : ajouter `superseded`. Mettre à jour
     `COUNT_KEY_OF` et `recipientCountsOf` (`campaign-rules.ts`), `campaign-state-badges.tsx` (badge
     « fait », libellé `recipientStates.superseded` « Écartée à l'envoi : déjà connectée ou réinvitée »).
     `CampaignCreationContent` et `createCampaignWithRecipientsTxnDao` acceptent `letterText` (nul par
     défaut).
   - Tests : `campaign-model.test.ts` (enum, colonne), `campaign-rules.test.ts` (décompte du nouveau
     statut), `campaign-state-badges` / `campaign-detail.test.tsx` (libellé). Le typage exhaustif doit
     forcer ces mises à jour : `pnpm tsc --noEmit` vert, sans erreur cachée par `.next/types`.
3. [x] **Un seul contenu d'invitation, deux enveloppes (ADR 072 §7).**
   - Extraire de `invitation-email.tsx` le bloc titre + paragraphes texte (`invitationParagraphsOf`) +
     bouton + URL en clair + trois étapes + échéance, en un composant partagé (par ex.
     `src/lib/emails/invitation-content.tsx`), et sa version texte. `InvitationMail` l'utilise sans
     changer son rendu. `CampaignMail` reçoit une prop optionnelle `invitation: {url, expiresOn, text}` :
     présente, elle remplace `bodyHtml` par ce bloc. L'en-tête et le pied de campagne (nature, mention
     statutaire, désinscription) restent inchangés.
   - `renderCampaignText` reçoit la même variante.
   - `buildCampaignEmail` : pour un type d'invitation, ne passe ni `renderCampaignBodyHtml` ni
     `substituteVariables` sur le texte. L'objet final reste `finalSubject(association.name, subject figé)`,
     préfixé une seule fois.
   - Tests `*.real-i18n.test.tsx` :
     - l'invitation individuelle a un rendu identique (snapshot textuel ou assertions existantes vertes) ;
     - l'email de lancement a l'en-tête au logo, le pied `statutaire` avec sa mention, puis `facultative`
       sans elle, et le lien de désinscription ;
     - le texte du tenant contenant `**gras**`, `# titre`, `[x](https://…)`, `<b>` et `{nom}` ressort
       littéralement ;
     - l'objet est « {association} — Votre espace membre vous attend », sans double nom ;
     - la version texte porte l'URL en clair et les trois étapes.
4. [x] **Lectures et règles pures du lancement, de la relance et du suivi.**
   - Repositories (`getDb()`, sous `withTenant`) :
     - `getInvitationStatesByEmailsDao(organizationId, emails)` : `email → {userId, lastInvitedAt,
firstSignedInAt}` par jointure `user` (minuscules) ↔ `member_invitation_state` de l'association ;
     - `getInvitationAddressesDao(organizationId)` : toutes les adresses de fiche (actives **et** en
       attente), avec leur statut, `created_at`, `expires_at`, fiche, nom, parcelles actuelles et
       compte ;
     - `markClaimedRecipientFailedTxnDao` : `sending → failed`, car `markRecipientFailedTxnDao` ne prend
       qu'une ligne `pending`.
   - Élargir `CampaignTargetPredicate` à `(row: {memberProfileId: string; email: string | null})`, sans
     effet sur les prédicats existants. Règles pures (`src/services/rules/member-invitation-campaign-rules.ts`) :
     - `launchPredicate` : toutes les fiches ;
     - `reminderPredicateOf(states)` : adresse non nulle dont le compte n'a pas `first_signed_in_at`, une
       adresse sans compte comptant comme jamais connectée ;
     - `invitationSkipOf(state, campaignCreatedAt)` : `superseded` si connectée, ou si `last_invited_at >
created_at` ;
     - `invitationOverviewOf(...)` : compteurs du suivi en adresses (Q8), liste des jamais connectées
       triée par nom de fiche et paginée par 25, une ligne par adresse avec toutes ses fiches, adresse en
       attente échue masquée comme `readProfileEmails` le fait, couverture en fiches
       (`campaignChannelsOf` sous la nature du lancement), fiches « ont refusé » ;
     - décomptes de l'écran 1a/1f (fiches email/courrier/refus, adresses, désinscrites, en attente, jamais
       invitées).
   - Tests unitaires des règles, sur les cas de la story :
     - fiche à deux adresses actives (s54) : deux destinataires ;
     - adresse sur deux fiches (s53) : un destinataire, un seul état sur les deux ;
     - fiche aux seules adresses en attente : courrier ;
     - fiche toute désinscrite : email en `statutaire`, rien en `facultative`, comptée « refus » (C5
       sous la nature du seed : aucune fiche à zéro canal) ;
     - relance : proche d'un titulaire connecté inclus, adresse connectée exclue, adresse en attente
       exclue, adresse ajoutée après le lancement incluse, fiche sans email exclue (aucun courrier de
       relance) ;
     - `superseded` dans ses deux cas.
5. [x] **Services de lancement, de relance et de suivi.**
   - `src/services/member-invitation-campaign-service.ts`, façade `member-invitation-campaign-service-facade.ts`
     et intercepteur en `shouldLogDetails: () => false`. Chaque service : validation Zod
     (`src/services/validation/`), `requireCampaignManager` (`campaign.manage`), `effectiveAuthor`
     (s48). Avant toute création, trois refus :
     - `isClientEmailEnabledService` → `delivery_disabled` ;
     - association sans domaine (`associationOriginOf`) → `no_site_address`, aucun lien ne pouvant naître ;
     - lecture impossible → l'erreur remonte, jamais un zéro trompeur.
   - `launchMemberInvitationsService({organizationId})`. `submissionId` = uuid v5 (association, type),
     patron `reminderSubmissionIdOf`. Une campagne existante sous ce `submissionId` rend
     `already_launched` avec sa date, son auteur et son id (critère : rien ne repart). Sinon
     `createCampaignInTenant` est appelé avec :
     - `readTarget` sur toutes les fiches et la nature `member_invitation_launch` ;
     - `subject`/`preheader` figés (tâche 1) ;
     - `bodyMarkdown` = `getInvitationText(settings) ?? défaut` ;
     - `letterText` = `getInvitationLetterText(settings) ?? défaut` ;
     - `targetKind: 'all_members'` et `acceptsLettersOnly: true`.
       Il rend `{status: 'created', campaignId, deliver}` (passage immédiat dans `after()`, comme
       `sendCampaignService`).
   - `remindNeverSignedInService({organizationId, submissionId})`. Refus `not_launched`, puis
     `in_progress` si une part du lancement ou d'une relance n'est pas `sent`/`failed` (choix du design,
     confirmé le 24/11). Prédicat de relance, type `member_invitation_reminder`, même contenu figé que le
     lancement, `letterText` nul, sans `acceptsLettersOnly`. `no_recipient` est rendu `nobody`.
   - `getMemberInvitationsOverviewService({organizationId, page})` : le lancement (campagne, parts,
     décomptes de lignes), les relances, les décomptes 1a/1f, le plan prévisionnel (`planCampaignParts`
     en lecture, sans verrou, patron `previewCampaignPlanService`) et le suivi (tâche 4). DTO de domaine
     seulement.
   - Tests (`rule-services-tests` : invité, membre, bureau, présidence, SuperAdmin, imitation) :
     - refus d'autorisation, puis les trois refus métier ;
     - second lancement = `already_launched` sans `createCampaignInTenant` ;
     - contenu figé (le texte d'invitation dans `bodyMarkdown`, le texte du courrier dans `letterText`,
       l'objet sans nom) ;
     - `in_progress`, `nobody` ;
     - le bureau de A ne lit ni ne lance rien sur B (`organizationId` étranger refusé par l'autorisation).
6. [x] **Livraison avec un lien par destinataire (ADR 072 §3 à §5).**
   - Dans `campaign-service.ts`, sur le patron de `readReminderInvoices` / `invoicesOf` :
     `readInvitationDelivery(organizationId, campaign, settings, recipients)` rend `null` hors des deux
     types. Sinon il rend l'organisation, la durée (`getInvitationLinkDays`) et les états par adresse
     (`getInvitationStatesByEmailsDao`).
   - `deliverToRecipient` reçoit cette branche, isolée dans une fonction dédiée. Ordre pour un type
     d'invitation :
     1. désinscrite et non statutaire → `unsubscribed` ;
     2. `invitationSkipOf` → `superseded` (nouvelle DAO `markRecipientSupersededTxnDao`, `pending` seul) ;
     3. prise `claimRecipientForSendTxnDao` ; une prise perdue rend `done` **sans émettre** ;
     4. `issueInvitationLink({organization, email: compte.email, expiresInDays})` ; un résultat `null` ou
        une adresse sans compte → `markClaimedRecipientFailedTxnDao`, `done` : la part continue ;
     5. composition avec `invitation: {url, expiresOn, text: bodyMarkdown}` ; un échec → révocation,
        libération, `failed` ;
     6. `sendEmailService(…, nature 'campaign', recipientType 'client')` ;
     7. `sent` → `markRecipientSentTxnDao` puis `markInvitedTxnDao({userId, at: now})`. `deferred` ou
        `skipped` → révocation et libération. Refus certain → révocation et libération. Issue inconnue →
        `to_verify`, sans révocation.
   - `logFailure` reste sans adresse, sans URL et sans jeton.
   - Tests (mocks de `issueInvitationLink`, `revokeInvitationLink`, `sendEmailService`) :
     - ordre des appels épinglé : prise avant émission, émission avant composition (`invocationCallOrder`) ;
     - prise perdue : aucune émission ;
     - `deferred`, `skipped`, refus, échec de composition : révocation du jeton émis ;
     - `to_verify` : pas de révocation ;
     - `null` : ligne `failed`, destinataire suivant servi ;
     - trace écrite au seul `sent` ;
     - deux destinataires reçoivent deux URL distinctes ;
     - `statutaire` : un désinscrit reçoit l'email, `facultative` : il passe `unsubscribed` (C3) ;
     - écart `superseded` dans ses deux cas ;
     - aucune URL ni aucun jeton dans les appels du logger, dans `bodyMarkdown` ou dans les arguments
       DAO ;
     - campagne ordinaire inchangée (tests existants de `campaign-service.test.ts` verts) ;
     - report de budget : la part glisse (`deferPartOutcome`), C9.
7. [x] **Courrier de lancement (C2).**
   - `campaign-letter-service.ts` : `readFrozenLetters` rend aussi `letterText`. Une branche dédiée,
     patron `withReminderInvoices`, s'applique quand `templateId === member_invitation_launch` :
     - objet = texte fixe (tâche 1) ;
     - corps = `letterText`, **jamais** `bodyMarkdown` ;
     - sous le texte, l'encart « Adresse du site : {domaine} » (domaine public de l'association lu à la
       génération).
   - `render-letter-body.ts` : `letterTextBlocksOf(text, siteLine)` produit des paragraphes **texte**
     (pas de `remark`) puis un bloc `quote` pour l'encart (cadre 1 pt existant, §6.1).
     `RenderLettersInput` accepte des blocs déjà construits à la place de `bodyMarkdown`.
   - Carte « Courrier postal » du détail : phrase d'usage propre au lancement (écran 6,
     `messages/fr.json`).
   - Tests (`campaign-letter-service.test.ts`, `render-letter-body.test.ts`, `campaign-letter-rules`
     inchangé) :
     - le PDF d'un lancement contient le texte du courrier et l'adresse du site, et ne contient ni le
       texte de l'invitation, ni une URL de connexion, ni « /login » ;
     - Markdown et accolades restent littéraux ;
     - une campagne ordinaire et une relance d'impayés sont inchangées ;
     - la relance d'invitations n'a pas de courrier (`none`).
8. [x] **Correctif m5 au rejeu d'une invitation reportée.** Dans `deferredInvitationToSend`
       (`email-service.ts`), lire la trace du compte. Si `last_invited_at` est postérieur à
       `row.createdAt` (déjà rendu par `claimDeferredEmailForSendTxnDao … returning()`), rendre `gone` :
       rien ne part, aucun lien n'est émis, aucun budget n'est consommé. Tests : rejeu sauté après une
       invitation (individuelle ou de campagne) partie entre-temps ; rejeu inchangé sinon (tests de s42a
       verts).
9. [x] **Écrans.**
   - Route `src/app/[locale]/(bureau)/bureau/invitations/page.tsx` (patron `/bureau/relances`) :
     `canManageCurrentCampaignsDal` puis `BureauAccessDenied` en cas de refus. Lecture par un nouveau
     `src/app/dal/member-invitation-campaign-dal.ts`, donnée par utilisateur, **non cachée**, derrière
     `<Suspense>`, `page` lu de `searchParams`.
   - Server Actions `bureau/invitations/actions.ts` : `launchMemberInvitationsAction` et
     `remindNeverSignedInAction`. Elles suivent `rule-safe-server-action` : tenant, `requireActionAuth`,
     `getTranslations`, façade, résultat typé. La livraison immédiate passe par `after()`, comme
     `sendCampaignAction`.
   - Composants `src/components/features/member-invitation-campaign/`, selon les écrans 1 et 2 du
     design :
     - cartes « Lancement », « Relancer les jamais connectés », « Suivi », « Adresses jamais connectées »
       (table puis cartes sous 640 px, pagination écrite) et « Ont refusé les envois facultatifs » ;
     - `alert-dialog` de confirmation avec le plan écrit ;
     - états 1a à 1l et 2a à 2e, alertes ancrées, jamais un toast, et la phrase 1g à la place du bouton.
       Uniquement les composants du design system. Le mockup est une référence, pas du code.
   - Entrée « Invitations » (`bureau-sidebar.tsx`, après `unpaidReminders`, libellé `messages/fr.json`).
   - Détail de campagne (`campaign-detail.tsx`) : pour un type d'invitation, « Contenu envoyé » rend
     `bodyMarkdown` par `invitationParagraphsOf` (pas `renderRestrictedMarkdown`), suivi de l'alerte
     « Ajoutés à chaque envoi… ». Les libellés de type passent par `templateNames`.
   - Tests de composants et d'actions :
     - chaque état du design, dont le bouton « Lancer » absent après le lancement et la relance absente
       avant ;
     - refus 1i, échec 1j, lecture impossible 1l ;
     - entrée de barre (ordre) ;
     - détail : texte rendu littéral ;
     - tests existants mis à jour : `bureau-sidebar.test.tsx`, `campaign-detail.test.tsx`,
       `campaign-list`, `unsubscribe-panel.test.tsx`.
10. [x] **e2e (CI seulement).** `e2e/member-invitation-launch.spec.ts`, en série, sur le patron de
        `campaigns.spec.ts` (`dropUnpaidReminderJobs`, `makePartDue`, `runSchedulerProcess` :
        `pnpm tsx src/db/scripts/run-scheduled-jobs.ts`) et de `member-invitations.spec.ts` (outbox du
        transport `file`). Partager les helpers par `e2e/support/` plutôt que les copier.
    - **C10, sur TechCorp (`localhost`) puis Marketing Pro (`127.0.0.1`)**, avec des fiches et des
      **adresses propres à chaque association** (m4) :
      1. abaisser `campaign.daily_send_cap` pour qu'au moins une part soit programmée au lendemain ;
      2. lancer depuis `/bureau/invitations` ;
      3. rendre dues les parts restantes, lancer **le vrai planificateur** ;
      4. lire dans l'outbox le lien d'une adresse servie par une part reportée ;
      5. l'ouvrir sur le domaine de son association : la session s'ouvre, et le suivi montre l'adresse
         « connectée ».
    - Fiche à deux adresses = deux emails à deux liens distincts (C6). Adresse sur deux fiches = un seul
      email, et un seul état sur les deux fiches (C6, C7).
    - Fiche sans email : la carte « Courrier postal » du lancement compte la fiche, et le PDF téléchargé
      ne contient ni « /login » ni l'URL du site de connexion (C2, C5).
    - Second lancement : refusé, rien ne repart.
    - Relance :
      - un désinscrit par `/desinscription/<jeton>` depuis l'email de lancement la reçoit sur TechCorp
        (`statutaire`), pas sur Marketing Pro (`facultative`) (C3) ;
      - l'adresse connectée ne la reçoit pas (C8) ;
      - une adresse ajoutée après le lancement la reçoit (C8).
    - Le bureau de A n'atteint pas `/bureau/invitations` de B et ne lance rien par appel direct de
      l'action avec l'id de B.
    - Nettoyage en `afterAll` (`asMaintenance`) : campagnes de lancement et de relance de la spec, tâches,
      traces, plafond et budget du jour restaurés. Sinon, le lancement unique bloque les reprises et
      consomme le budget d'autres specs.

## Files touched

- Docs :
  - `docs/decisions/072-lancement-des-invitations-par-le-moteur-de-campagnes.md` (nouveau) ;
  - `docs/architecture.md` : l. 615, la phrase périmée (« liens d'invitation (s42) construits sur
    `NEXT_PUBLIC_APP_URL` ») corrigée, les liens d'invitation étant rebasés sur l'association depuis s42a ;
    mention de `campaign.letter_text` et du statut `superseded` à la description de `campaign` /
    `campaign_recipient` si le tableau les détaille ;
  - `docs/design-system.md` §9 (gaps 1, 3 à 9 du design, à verser sans les combler), §6.1 (la ligne
    « Lien magique de connexion → Invitation à transmettre une adresse email au bureau » est alignée sur
    la story : rien, ni lien ni promesse d'accès ; gap 2), §5.6 (le gabarit de campagne pose le préfixe).
- `src/services/types/domain/campaign-types.ts`, `association-settings-types.ts`,
  `src/db/scripts/tenant-settings-seed.ts`, `messages/fr.json`.
- `src/db/models/campaign-model.ts`, `drizzle/migrations/*` (générés),
  `src/db/repositories/campaign-repository.ts`, `member-invitation-state-repository.ts`,
  `member-profile-email-repository.ts` (ou un repository voisin pour la lecture des adresses).
- `src/lib/emails/invitation-content.tsx` (nouveau), `invitation-email.tsx`, `campaign-email.tsx`,
  `campaign-text.ts`.
- `src/lib/letters/render-letter-body.ts`, `render-letters-pdf.ts`.
- `src/services/rules/campaign-rules.ts`, `src/services/rules/member-invitation-campaign-rules.ts`
  (nouveau), `src/services/campaign-service.ts`, `campaign-letter-service.ts`, `email-service.ts`,
  `src/services/member-invitation-campaign-service.ts` (nouveau), `src/services/validation/…`,
  `src/services/facades/member-invitation-campaign-service-facade.ts` (nouveau) + intercepteur.
- `src/app/dal/member-invitation-campaign-dal.ts` (nouveau),
  `src/app/[locale]/(bureau)/bureau/invitations/page.tsx` + `actions.ts` (nouveaux),
  `src/components/features/member-invitation-campaign/*` (nouveaux),
  `src/components/features/association/bureau-sidebar.tsx`,
  `src/components/features/campaigns/campaign-detail.tsx`, `campaign-state-badges.tsx`.
- Tests colocalisés de chacun, `e2e/member-invitation-launch.spec.ts` (nouveau), `e2e/support/*`.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** :
  - règles pures : cible du lancement et de la relance, couverture en fiches, suivi, écart `superseded`,
    cas s53 et s54 ;
  - services : six profils, refus, lancement unique, contenu figé ;
  - livraison : ordre prise → émission → composition épinglé, révocation sur chaque issue, ligne sans
    lien isolée, trace au départ réel, nature ;
  - gabarit et courrier (`real-i18n`) : texte littéral, aucun lien dans le PDF, objet sans double
    préfixe ;
  - correctif m5 ;
  - composants et actions.
    Base, Better Auth et transport sont mockés. La preuve sur le vrai Better Auth de l'émission hors requête
    reste celle de s42a (`*.real-auth.test.ts`, inchangés et verts).
- **Tests existants à mettre à jour** (recherche, « Tests existants qui vont bouger ») : réglages
  (registre, formulaire, seed), `campaign-service`, `campaign-letter-*`, `unsubscribe-service`, panneau
  de désinscription, liste et détail des campagnes, barre du bureau. `campaign-composer.test.tsx`
  dépasse déjà 5 s sous charge : un timeout n'y est pas un vert.
- **e2e (Playwright, CI seulement)** : C10 par le vrai planificateur sur deux associations aux comptes
  distincts, C2/C3/C5/C6/C8, isolation entre associations.
- Montage 9p lent : valider la suite unitaire sur une copie en disque local. Un timeout n'est jamais
  compté comme vert. Pas de `pnpm build` local.

## Definition of Done

- Une PR `feature/s42b-lancement-invitations`, un commit de story, plus un pour la migration si elle doit
  pouvoir se défaire seule. Le commit embarque recherche, design, plan, ADR 072 et revue, sans
  `docs/logs/`.
- Les dix critères couverts par un test nommé. Le texte par défaut du courrier est relu en revue : aucune
  promesse d'accès, aucun lien, aucune fonctionnalité non livrée.
- Un seul mécanisme d'invitation : aucun appel à `signInMagicLink` hors de `issueInvitationLink` et de
  l'action de connexion, aucun second gabarit d'invitation.
- Aucun lien ni jeton dans un journal, dans `campaign`, `campaign_recipient`, `deferred_email` ou un
  export. Lien émis après la prise, révoqué sur toute issue non partie.
- Aucune table nouvelle. Colonne et valeur d'enum par `pnpm db:generate`. Aucun `withRlsBypass`, `getDb()`
  et `withTenant` partout. Isolation entre associations prouvée en e2e.
- Rien en dur : texte du courrier et natures en réglages, libellés dans `messages/fr.json`.
- Gaps du design versés au §9 et §6.1 alignée dans le même commit. `docs/architecture.md:615` corrigé.
- Suite unitaire verte, e2e verte en CI, `/ks-review` passée (`Ship allowed: yes`).
- Rappel de déploiement : migration à appliquer. Aucune minuterie nouvelle (`asl-cms-planificateur`,
  dont l'installation sur le VPS reste en attente, livre les parts). Prévenir le bureau que les comptes
  connectés avant s42a comptent « jamais connectés » et seront relancés.
