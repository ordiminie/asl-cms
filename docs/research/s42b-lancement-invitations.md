# Research — Story s42b-lancement-invitations

> Recherche menée le 24 novembre 2026 sur `main` à `ec162488` (s42a mergée, PR 84). Point de départ :
> `docs/research/s42a-invitation-individuelle.md` (complément du 24/11, « Complément s42 ») et
> `docs/reviews/s42a-invitation-individuelle.md`. Tout ce qui est nommé ci-dessous a été ouvert dans le
> dépôt ; rien n'est affirmé de mémoire. Le découpage a passé `/ks-stories-review`
> (`docs/reviews/stories.md` : `Stories ready: yes`).

## Target story

**s42b-lancement-invitations — Faire entrer les membres dans le service** (complexité 4). Dépendances :
s02, s13, s25, s26, s27, s27b, s28, s42a, s52, s53, s54, toutes livrées (s56 et s38 ne le sont pas : elles
n'en sont pas des dépendances).

En tant que membre du bureau, je veux annoncer le site à tous les propriétaires d'un seul geste, afin que
chacun sache qu'il a un espace, ou à défaut que le site existe.

Critères d'acceptation, numérotés pour la suite :

1. **C1** Une campagne d'invitation part vers tous les membres disposant d'une adresse email, chaque
   destinataire recevant un lien de connexion qui lui est propre.
2. **C2** La même opération produit, pour les membres sans email, un publipostage PDF (s28) annonçant le
   site public et ses contenus consultables sans compte. Son texte est un **paramètre de tenant distinct**
   de celui de l'invitation : ni lien de connexion, ni promesse d'accès.
3. **C3** Le lancement et sa relance déclarent leur nature (s27b), seed `statutaire` pour le premier
   tenant. En `statutaire`, la relance atteint aussi un membre désinscrit depuis l'email de lancement sans
   s'être connecté ; en `facultative`, elle l'exclut (les deux cas vérifiés).
4. **C4** L'email de lancement porte l'habillage commun de s25 (en-tête au logo, pied avec désinscription)
   et, en `statutaire`, la mention de s27b. Son texte et son lien sont ceux de l'invitation individuelle
   (s42a).
5. **C5** Aucune fiche omise : chaque fiche est couverte par au moins une adresse destinataire ou par un
   courrier, jamais par aucun des deux. Décompte **en fiches** (une fiche peut valoir plusieurs adresses,
   s54 ; une adresse plusieurs fiches, s53).
6. **C6** L'invitation part à **chaque adresse active** de la fiche, chacune avec son lien. Une adresse
   portée par plusieurs fiches ne reçoit qu'une invitation.
7. **C7** Suivi d'adoption **par adresse** : invitations envoyées, adresses connectées au moins une fois,
   liste des jamais connectées avec leur fiche ; une adresse non active (en attente, ou désactivée par
   l'import) y est marquée. Une adresse sur plusieurs fiches a un seul état, affiché sur chacune. La
   couverture reste comptée en fiches.
8. **C8** Relancer renvoie une invitation à chaque adresse **active** jamais connectée (jamais une adresse
   en attente ou désactivée), invitée ou non (adresse ajoutée après le lancement comprise), y compris le
   proche d'une fiche dont le titulaire s'est connecté, sans réinviter une adresse déjà connectée.
9. **C9** L'opération passe par l'adaptateur d'envoi et respecte le budget quotidien du tenant (s52) :
   au-delà, scission et report comme tout envoi.
10. **C10** Le lien envoyé par une part reportée au lendemain, donc hors requête, pointe vers le domaine de
    l'association et y ouvre la session — vérifié sur deux associations.

Notes agentiques à retenir : moteur = celui des campagnes (cœur `createCampaignInTenant`, patron de s29,
ADR 070) ; un seul mécanisme d'invitation (ni second gabarit, ni seconde génération de lien) ; le lien est
une variable d'un genre nouveau, **secret à usage unique**, né à la livraison, jamais journalisé, jamais
dans l'archive de campagne, jamais exporté ; le PDF de s28 imprime aujourd'hui le corps de l'email, le
lancement doit lui donner le texte du courrier ; « désactivée par l'import » vient de s56, non livrée ;
« connectée » = trace de première connexion de s42a, pas un clic.

## Current state of the code

### Ce que s42a a posé (réutilisable tel quel)

- **Générateur de lien** `src/lib/better-auth/invitation-link.ts` : `issueInvitationLink({organization:
  {id, domain}, email, expiresInDays})` appelle `auth.api.signInMagicLink` avec `Host` construit, sans
  `Request`, et `metadata.invitation = {organizationId, expiresInDays, deliver}` ; rend `{url, token}` ou
  `null` (association sans domaine, compte inconnu ou non membre). `revokeInvitationLink(token)` supprime
  la ligne `verification` par `internalAdapter.deleteVerificationByIdentifier`. Constantes
  `INVITATION_CALLBACK_URL = '/login/destination'`, `INVITATION_ERROR_CALLBACK_URL =
  '/login/lien-invalide?motif=invitation'`.
- **Branche invitation de `sendMagicLink`** (`magic-link-integration.ts:193`, `issueInvitation`) :
  association lue par identifiant (`getOrganizationByIdDao`, chargé par `import()`), `canOpenSessionOn`,
  puis `revokeEarlierMagicLinks(email, token, ctx)` (l. 122), `extendToken` (J + `expiresInDays`), URL
  rebasée sur l'origine de l'association, rendue par `deliver`. N'envoie rien. **Vérifié le 24/11** : le
  module `auth` se charge dans un processus `tsx` lancé comme le planificateur (`allowServerOnly()` +
  `initDotEnv()` puis `import('@/lib/better-auth/auth')` : `signInMagicLink` et
  `internalAdapter.deleteVerificationByIdentifier` sont des fonctions). Le rejeu hors requête de s42a n'avait
  été prouvé qu'en unitaire.
- **Traces** `member_invitation_state` (`src/db/models/member-invitation-state-model.ts`) : une ligne par
  `(organization_id, user_id)`, `last_invited_at` (dernier envoi **parti**), `first_signed_in_at` (première
  connexion hors imitation, écrite une fois), RLS forcée (migrations `0079`/`0080`). Repository
  `member-invitation-state-repository.ts` : `markInvitedTxnDao({organizationId, userId, at})` (upsert),
  `markFirstSignInTxnDao` (coalesce), `getInvitationStatesByUserIdsDao(organizationId, userIds)`. Règle pure
  `invitationStateOf(traces)` → `{state: 'never'|'invited'|'signed_in', at}`
  (`rules/member-invitation-rules.ts`). Écriture de la première connexion :
  `association-session-guard.ts:55` (`recordFirstSignInOnRequestDomain`, hook `session.create.after`,
  sort sur `impersonatedBy`) → `recordFirstSignIn` (`member-invitation-service.ts`).
- **Invitation individuelle** `inviteMemberProfileService` (`member-invitation-service.ts`) : autorise
  (`requireMemberProfileManager` → `member.profile.manage`), lit les adresses **actives** de la fiche
  (`readProfileEmails` + `accountOfEmail`), contexte (`readInvitationContext` : organisation, association
  d'email, `getInvitationLinkDays`, `getInvitationText`), puis par adresse `inviteTarget` : lien → 
  `sendInvitationEmailService` → `markInvitedTxnDao` si `sent`. Adresse active **sans compte** : `throw`.
- **Email** `sendInvitationEmailService` (`email-service.ts:676`) : gabarit transactionnel `InvitationMail`
  (`src/lib/emails/invitation-email.tsx`), texte du tenant découpé en paragraphes **texte**
  (`invitationParagraphsOf`, jamais du Markdown), bouton + URL en clair + trois étapes + échéance
  (`email.user.invitation.*` dans `messages/fr.json:710`), nature budgétaire `invitation`,
  `recipientType: 'system'`, option `invitationLink: {url, token, expiresOn}`.
- **Report d'une invitation** : `keepDeferredEmail` (l. 360) remplace URL, URL échappée HTML, jeton et
  échéance par `{{lien-invitation}}`/`{{echeance-invitation}}` (`withoutInvitationLink`, l. 1746) puis
  révoque le jeton (`revokeUnsentInvitationLink`). Rejeu `deferredInvitationToSend` (l. 1834) : relit
  compte et adresses actives (`getActiveEmailCarriersDao`), émet un lien neuf, remplace les marques,
  `afterSent` écrit `last_invited_at`. **Ce rejeu ne concerne que la nature `invitation`** : une campagne
  n'est jamais conservée dans `deferred_email` (`isDeferredByCaller`).
- **Réglages** (`association-settings-types.ts`) : `invitation.text` (texte, 2000 car., section
  `invitation`, l. 272/802), `invitation.link_days` (1 à 30, défaut 7, l. 279/814) ; lecteurs
  `getInvitationText` (l. 1356), `getInvitationLinkDays` (l. 1364). Aucun texte de courrier de lancement.

### Le moteur de campagne (s25 → s30), inchangé depuis le complément du 24/11

- `createCampaignInTenant(input)` (`campaign-service.ts:659`) : sous `withTenant`, `readTarget()` injecté,
  `campaignChannelsOf` → `letterProfileIds`, `lockCampaignScheduleTxnDao`, `planCampaignParts` (plafond
  `campaign.daily_send_cap`), `createCampaignWithRecipientsTxnDao` (campagne, parts, lignes
  `campaign_recipient`, fiches figées par ligne, fiches du courrier), une tâche `campaign.deliver_part` par
  part. Options `unpaidReminder`, `acceptsLettersOnly`. **N'autorise rien.**
- **Contenu figé** sur `campaign` : `subject`, `preheader`, `body_markdown`, `template_id` (`text`, libre),
  `target_kind` (`text`), `nature` (enum figé). `body_markdown` est l'**archive** affichée au bureau
  (`campaign-detail.tsx:677`, `renderRestrictedMarkdown`).
- **Cible** `readTarget` (l. 345) → `getCampaignTargetRowsDao` (`campaign-repository.ts:178`) : une ligne
  par (fiche, adresse **active**), une ligne `email: null` par fiche sans adresse active ; colonnes
  `unsubscribed`, `accountName`, domicile/terrain, parcelles. **Ni `userId` ni trace d'invitation.**
  `computeCampaignTarget(rows, isTargeted, nature)` (`rules/campaign-rules.ts:159`) groupe par
  `lower(trim(email))`, retient l'adresse si une de ses fiches est ciblée, réintègre les désinscrits en
  `statutaire`. Le type `CampaignTargetPredicate` est `(row: {memberProfileId: string}) => boolean`
  (l. 128) : il est appelé avec la ligne complète, mais son type ne voit que la fiche.
- **Canaux** `campaignChannelsOf` (`rules/campaign-letter-rules.ts`) : `emailProfileIds`,
  `letterProfileIds` (fiches ciblées sans adresse active), `refusedProfileIds` (fiches dont **toutes** les
  adresses sont exclues d'un envoi facultatif — ni email ni courrier).
- **Livraison** `deliverCampaignPartService(job, now)` (l. 1212), sans session ; par destinataire
  `deliverToRecipient` (l. 999) : désinscrit + non statutaire → `unsubscribed` ; `invoicesOf` (s29) peut
  écarter (`settled`) ou réécrire `bodyMarkdown` ; **compose (`composeRecipientEmail`, l. 899) avant la
  prise** (`claimRecipientForSendTxnDao`) ; `sendEmailService(payload, {scope: 'tenant', nature:
  'campaign'}, {recipientType: 'client'})` ; `deferred` → ligne rendue `pending`, part glissée
  (`deferPartOutcome`) ; `skipped` → `released` ; échec de composition → `'failed'` = **toute la part
  s'arrête** et compte une tentative (`failedAttemptOutcome`, campagne `interrupted` à épuisement).
- **Gabarit** `CampaignMail` (`src/lib/emails/campaign-email.tsx`) : `heading`, `preheader`, `bodyHtml`
  (injecté), pied `getCampaignFooterTexts(locale, association, nature)` avec `statutoryNotice` et libellé
  de désinscription selon la nature (C4 déjà couvert par le gabarit). Corps : `renderCampaignBodyHtml`
  (Markdown, schéma restreint du CMS, variables échappées) ; texte : `renderCampaignText`. Objet :
  `finalSubject(association.name, heading)` préfixe « {association} — ».
- **Variables** : liste fermée `CAMPAIGN_VARIABLES = ['nom','parcelle','date']`, `{factures}` réservée à
  `unpaid_reminder` ; `findUnknownVariables` refuse toute autre `{…}` à la création.
- **Natures** : `CAMPAIGN_SEND_KINDS = [...CAMPAIGN_TEMPLATE_IDS, UNPAID_REMINDER_SEND_KIND]`
  (`campaign-types.ts:27`) ; un réglage `campaign.nature.<kind>` par type est **généré** depuis cette
  liste (`CAMPAIGN_NATURE_SETTINGS`, `editableBy: 'super_admin'`, défaut `facultative`), libellé
  `campaignNature.templates.<kind>` (`messages/fr.json:2315`). `getStatutoryTemplateIds` alimente la page
  publique de désinscription (`unsubscribe-service.ts:79`, `unsubscribe-panel.tsx:85`) : un nouveau type
  statutaire y sera **listé**. Seed : `src/db/scripts/tenant-settings-seed.ts:68+`.
- **Courrier** (`campaign-letter-service.ts`) : `readFrozenLetters` (l. 141) relit la campagne et ses
  fiches figées ; `generateCampaignLettersService` (l. 309) imprime `frozen.subject` et
  `frozen.bodyMarkdown` (l. 352-353) — **le contenu de l'email**. Seule variante : `withReminderInvoices`
  (l. 172), branchée sur `templateId === UNPAID_REMINDER_SEND_KIND`.
- **Patron d'une campagne générée par le système** : `createDueRank` (`unpaid-reminder-service.ts:160`)
  appelle `createCampaignInTenant` avec `submissionId` déterministe, `templateId`, `targetKind`, auteur nul,
  `acceptsLettersOnly: true`, `readTarget` propre (`reminderTargetOf`, l. 140). Écran : `/bureau/relances`
  (`src/app/[locale]/(bureau)/bureau/relances/page.tsx`, entrée de `bureau-sidebar.tsx:69`).
- **Envoi du bureau** : `sendCampaignAction` (`bureau/campagnes/actions.ts:157`) → façade →
  `sendCampaignService` (l. 563 : validation, `requireCampaignManager` → `campaign.manage`, auteur effectif
  s48, `isClientEmailEnabledService`, variables) ; la livraison immédiate est posée dans `after()`
  (`runImmediatePass`).
- **Libellés de type** : `campaign-list.tsx:142,171` et `campaign-detail.tsx:617` lisent
  `templateNames.<templateId>` : un nouveau `templateId` sans libellé casse l'affichage.
- **Statistiques** (s30, ADR 068) : tag `campaign-<id>` sur chaque email ; Brevo réécrit les liens pour
  compter les clics (ADR 068, conséquences) — le lien d'invitation transitera par sa redirection, comme le
  lien magique et l'invitation individuelle aujourd'hui.

### Budget (s52, ADR 053)

`sendEmailService` → `sendTenantEmail` : nature `campaign` reportable, accordée par
`claimReportableSendTxnDao` (budget − réserve `login`), sinon `{status: 'deferred'}` **sans rien
conserver** (l'appelant tient la file). C9 est donc acquis par construction si le lancement passe par
`deliverToRecipient` avec la nature `campaign` ; le plafond par campagne (`campaign.daily_send_cap`) étale
déjà en parts.

## Anchor points

| Critère | Où ça se branche | Existe | Manque |
| --- | --- | --- | --- |
| C1, C6 | `createCampaignInTenant` + un `readTarget` « toutes les adresses actives » (patron `reminderTargetOf`) | cible, dédoublonnage par adresse, parts, fiches figées | service de lancement (autorisation, contenu, `submissionId`), action, émission du lien **par destinataire à la livraison** dans `deliverToRecipient` |
| C1, C4 | `composeRecipientEmail` / `buildCampaignEmail` / `CampaignMail` | habillage, pied, mention statutaire, `List-Unsubscribe`, tag | bloc d'invitation (bouton, URL en clair, trois étapes, échéance) dans le gabarit de campagne et sa version texte ; texte de l'invitation rendu comme **texte** (`invitationParagraphsOf`), pas comme Markdown |
| C1 (trace) | `deliverToRecipient` après `markRecipientSentTxnDao` | `markInvitedTxnDao` | résolution `email → userId` (`getUserByEmailDao`) et écriture de « invitée le » au départ réel |
| C2 | `campaign-letter-service.ts` (`readFrozenLetters`, `generateCampaignLettersService`) | carte « Courrier postal », fiches figées, PDF | branche sur le type de lancement (patron `withReminderInvoices`) imprimant le **texte du courrier** ; nouveau réglage de tenant (registre + `messages/fr.json` + seed) ; où le figer |
| C3 | `CAMPAIGN_SEND_KINDS` (`campaign-types.ts`) + seed `tenant-settings-seed.ts` + `campaignNature.templates.*` + `templateNames.*` | réglage de nature généré par type, réintégration des désinscrits, désinscription par jeton `/desinscription/<jeton>` | un ou deux types (lancement, relance), seed `statutaire` |
| C5 | `campaignChannelsOf` | partition email / courrier / refus | preuve du cas s53/s54 ; décision sur `refusedProfileIds` en `facultative` (voir questions) |
| C7 | nouvel écran bureau (adoption) + lecture service/DAL | `member_profile_email` (tous statuts), `member_profile_account`, `getInvitationStatesByUserIdsDao`, `invitationStateOf`, `readProfileEmails` (masque les attentes échues) | lecture « adresses de l'association avec état » (aujourd'hui seulement par fiche dans `readProfileView`) ; compteurs ; entrée de navigation ; design (`/ks-design`) |
| C8 | `readTarget` « relance » | traces par `user` | prédicat **sur l'adresse** (jointure adresse → compte → trace) ; type `CampaignTargetPredicate` à élargir ou prédicat porté par la ligne ; revérification à la livraison (voir questions) |
| C9 | `sendEmailService` nature `campaign`, `deferPartOutcome` | tout | rien, si le lancement reste une campagne |
| C10 | `deliverCampaignPartService` lancé par `src/db/scripts/run-scheduled-jobs.ts` | `issueInvitationLink` hors requête ; `auth` chargeable sous `tsx` (vérifié) | e2e : part rendue due puis planificateur lancé, lien lu dans l'outbox, ouvert sur `localhost` (TechCorp) et `127.0.0.1` (Marketing Pro) |

## Verified APIs / functions

| Nom | Signature / comportement vérifié | Emplacement |
| --- | --- | --- |
| `issueInvitationLink` | `({organization: Pick<Organization,'id'\|'domain'>, email, expiresInDays}) => Promise<{url, token} \| null>` | `src/lib/better-auth/invitation-link.ts` |
| `revokeInvitationLink` | `(token) => Promise<void>` | idem |
| `revokeEarlierMagicLinks` (privée) | supprime les `verification` dont `value = JSON.stringify({email})` et `identifier ≠ token` — **sans critère d'association** | `src/lib/better-auth/magic-link-integration.ts:122` |
| `inviteMemberProfileService` | `(InviteMemberProfileInput) => MemberInvitationResult` (`mail_only`, `sent`, `deferred`, `partial`) | `src/services/member-invitation-service.ts` |
| `recordFirstSignIn` | `({organizationId, userId, at}) => Promise<void>` | idem |
| `sendInvitationEmailService` | `({organizationId, email, url, token, association, text, expiresAt, locale}) => EmailSendResult`, nature `invitation`, `recipientType: 'system'` | `src/services/email-service.ts:676` |
| `deferredInvitationToSend` (privée) | rejoue sans vérifier `last_invited_at` | `email-service.ts:1834` |
| `markInvitedTxnDao` / `markFirstSignInTxnDao` / `getInvitationStatesByUserIdsDao` | voir plus haut, sous `withTenant` | `src/db/repositories/member-invitation-state-repository.ts` |
| `invitationStateOf` | `(traces?) => MemberInvitationStateDTO` | `src/services/rules/member-invitation-rules.ts` |
| `getInvitationText` / `getInvitationLinkDays` | `(settings) => string \| null` / `number` | `association-settings-types.ts:1356, 1364` |
| `invitationParagraphsOf` | `(text) => string[]` (texte, jamais HTML) | `src/lib/emails/invitation-email.tsx` |
| `createCampaignInTenant` | `(CampaignCreationInput) => {status:'created', campaignId, created} \| {status:'no_recipient'}` | `campaign-service.ts:659` |
| `CampaignCreationContent` | `{submissionId, subject, preheader, bodyMarkdown, templateId: CampaignSendKind, targetKind: string, author…}` | `campaign-service.ts:619` |
| `CampaignTargetReading` | `{rows, target, isTargeted, group, nature}` | `campaign-service.ts:329` |
| `deliverToRecipient` (privée) | `(organizationId, association, sent, part, recipient, invoicesOf) => 'done'\|'failed'\|'deferred'\|'skipped'` | `campaign-service.ts:999` |
| `composeRecipientEmail` (privée) | `(association, campaign, sendDate, recipient) => SendEmailPayload` | `campaign-service.ts:899` |
| `getCampaignTargetRowsDao` | `(organizationId) => CampaignTargetRowModel[]` (adresses actives seules) | `src/db/repositories/campaign-repository.ts:178` |
| `computeCampaignTarget` / `campaignChannelsOf` / `sameAddressRowsOf` | voir plus haut | `rules/campaign-rules.ts:159, 226` ; `rules/campaign-letter-rules.ts` |
| `CampaignTargetPredicate` | `(row: {memberProfileId: string}) => boolean` | `rules/campaign-rules.ts:128` |
| `CAMPAIGN_SEND_KINDS`, `UNPAID_REMINDER_SEND_KIND`, `CAMPAIGN_RECIPIENT_STATUSES` | statuts : `pending, sending, sent, to_verify, failed, unsubscribed, settled` | `src/services/types/domain/campaign-types.ts` |
| `campaignNatureSettingKeyOf` / `getCampaignNature` / `getStatutoryTemplateIds` | `campaign.nature.<kind>` ; `facultative` si absent | `association-settings-types.ts:388, 1283, 1295` |
| `getCampaignFooterTexts` | `(locale, association, nature) => CampaignFooterTexts` | `src/lib/emails/campaign-email.tsx:79` |
| `readFrozenLetters` / `withReminderInvoices` | branchement par `templateId` | `campaign-letter-service.ts:141, 172` |
| `getActiveEmailCarriersDao` | `(organizationId, email) => carriers` | `src/db/repositories/member-profile-email-repository.ts:122` |
| `getUserByEmailDao` | `(email) => User \| undefined` (minuscules) | `src/db/repositories/user-repository.ts:73` |
| `openMemberAccountsForOrganization` | reprise en lot : un compte par adresse active non reliée | `src/services/member-account-service.ts` |
| Planificateur e2e | `execFileSync('pnpm', ['tsx', 'src/db/scripts/run-scheduled-jobs.ts'])`, `makePartDue`, `dropUnpaidReminderJobs` | `e2e/campaigns.spec.ts:827-960` |
| Outbox e2e | `EMAIL_TRANSPORT: file`, `EMAIL_OUTBOX_DIR: /tmp/asl-cms-email-outbox` au niveau du job CI (hérité par le sous-processus) | `.github/workflows/ci.yml:34-35`, `e2e/member-invitations.spec.ts:180` |

## Traps & constraints

**Le lien par destinataire dans une campagne — ordre et révocation**

- **Aujourd'hui une campagne envoie le même contenu à tous**, personnalisé seulement par `{nom}`,
  `{parcelle}`, `{date}` et le jeton de désinscription ; `bodyMarkdown` est l'archive. Le lien ne doit
  **jamais** y entrer (ni dans `subject`/`preheader`), ni dans un journal (`logFailure` ne journalise que des
  noms d'erreur — à garder), ni dans `deferred_email` (une campagne n'y passe pas : bien), ni dans l'export
  (s38, non livrée : rien à faire si rien n'est stocké).
- **Émettre le lien révoque les liens précédents de l'adresse** (`revokeEarlierMagicLinks`) dès
  l'émission, avant tout envoi. Or `deliverToRecipient` **compose avant la prise**. Émettre dans
  `composeRecipientEmail` serait faux : (a) une ligne prise entre-temps par un autre passage (prise perdue)
  ferait révoquer le lien que l'autre passage est en train d'envoyer ; (b) un `deferred` (budget épuisé),
  un `skipped` (envois coupés par les réglages) ou un refus certain laisseraient un jeton vivant 7 jours
  qui n'est parti nulle part, **et** auraient tué le lien encore valide reçu la veille (lancement → relance,
  ou demande du membre). Il faut émettre **après** la prise, et révoquer (`revokeInvitationLink`) le jeton
  sur toute issue autre que `sent` (sauf `to_verify`, issue inconnue). Le chemin de s42a fait la même
  révocation pour sa nature `invitation` (`keepDeferredEmail`) ; pour une campagne, c'est à l'appelant.
- **Un échec d'émission ne doit pas arrêter la part.** Une composition en échec rend `'failed'` et
  interrompt toute la part (tentatives puis `interrupted`). Une adresse active sans compte (invariant s54,
  mais `openMemberAccountsForOrganization` est justement une reprise), un compte qui n'est plus membre ou
  une association sans domaine font rendre `null` à `issueInvitationLink` (et `inviteTarget` lève). Dans
  une campagne de 300 adresses, une seule ligne de ce genre bloquerait les suivantes : la ligne doit être
  écartée (`failed` ou statut dédié), la part continuer.
- **Le lien vit 7 jours après son envoi**, pas après la création de la campagne (durée lue à l'émission,
  ADR 071) : une part partie au jour 3 a ses propres 7 jours. L'échéance affichée se calcule à la
  livraison.
- **m4 (revue s42a) — révocation toutes associations confondues.** `revokeEarlierMagicLinks` filtre sur
  `value = {"email": x}` seul. Un lancement de B sur 300 adresses tue tout lien d'invitation encore valide
  envoyé par A à un compte membre des deux (« Invitée le » reste affiché sur A). Rare avec un seul client,
  mais **piège direct de l'e2e C10** : lancer sur TechCorp puis sur Marketing Pro avec un compte membre des
  deux tuerait le lien de A avant qu'on l'ouvre. Utiliser des adresses distinctes par association, ou
  ouvrir le lien de A avant d'émettre celui de B.
- **m5 (revue s42a) — invitation reportée rejouée malgré un envoi entre-temps.** `deferredInvitationToSend`
  ne compare pas `last_invited_at` à la date du report. Le lancement aggrave le cas : il consomme le budget
  du jour, donc toute invitation individuelle cliquée le même jour est **reportée** ; le lendemain, la
  part du lancement et le rejeu de l'invitation partent tous deux vers la même adresse — deux emails, deux
  unités de budget, et le second révoque le lien du premier (le membre qui clique le premier email tombe
  sur « lien invalide »). Même chose entre une relance et une invitation reportée. Le correctif proposé par
  la revue (sauter le rejeu si `last_invited_at` est postérieur au report ; `deferred_email.created_at`
  existe) devient utile ici ; le symétrique (ligne de campagne alors qu'une invitation individuelle est
  partie depuis la création) est une question ouverte.

**Texte et gabarit**

- Le texte d'invitation (`invitation.text`) est du **texte**, rendu par paragraphes sans interprétation
  (s42a : « une balise reste du texte »). Le passer comme `bodyMarkdown` le ferait lire comme du Markdown
  (`*`, `#`, `[ ](…)` interprétés) et refuser par `findUnknownVariables` dès qu'il contient une accolade.
  Le texte d'invitation doit entrer dans le gabarit de campagne par le même découpage que s42a.
- `CampaignMail` n'a pas d'emplacement pour une action (bouton + URL en clair + trois étapes + échéance) :
  c'est l'objet de `/ks-design` (design system §5.5 « Invitation initiale », statutaire). Le « téléphone du
  bureau » qu'il cite n'existe dans aucun réglage : gap déjà relevé en s42a, à remonter, pas à combler.
- Objet : `email.user.invitation.subject` vaut déjà « {name} — Votre espace membre vous attend » ;
  `finalSubject` préfixe lui aussi « {association} — ». Ne pas doubler le nom.
- `invitation.text` est décrit dans les Réglages comme « l'email qui invite un membre … depuis sa fiche »
  (`messages/fr.json:2377`) : à élargir au lancement.

**Courrier (C2)**

- Le PDF de s28 imprime `campaign.subject` + `campaign.bodyMarkdown`. Sans branche dédiée, les sans-email
  recevraient le texte de l'invitation — la promesse d'accès que la story qualifie de défaut fonctionnel.
- Le texte du courrier est un **réglage de tenant** (tranché par C2), défaut à prévoir (`messages/fr.json`
  ou seed), aucun lien. Son contenu (site public, analyses d'eau consultables sans compte, le bureau
  continue d'écrire) se juge en review, pas en test.

**Cible, couverture, relance**

- **C5 et `facultative`** : `campaignChannelsOf` place dans `refusedProfileIds` une fiche dont toutes les
  adresses actives sont désinscrites : ni email ni courrier. C'est conforme en `statutaire` (seed), mais
  si le SuperAdmin passe le lancement en `facultative`, C5 (« jamais aucun des deux ») est violé.
- Une fiche dont les seules adresses sont **en attente** n'a pas de ligne active : elle part au courrier
  (C5 tenu). Le suivi d'adoption doit pourtant montrer l'adresse en attente (C7), lue hors de
  `getCampaignTargetRowsDao`.
- **Relance (C8)** : le prédicat porte sur l'**adresse** (son compte a-t-il `first_signed_in_at` sur
  l'association ?), pas sur la fiche ; le type `CampaignTargetPredicate` ne le permet pas tel quel. Les
  lignes sans adresse doivent être exclues (sinon `withoutEmailProfileIds` produirait un courrier de
  relance). Avec `acceptsLettersOnly` absent, une relance sans jamais-connecté rend `no_recipient`.
- **Désinscrit et relance (C3)** : en `statutaire`, `computeCampaignTarget` réintègre l'adresse et
  `deliverToRecipient` l'envoie ; en `facultative`, elle est exclue à la création et, si elle se désinscrit
  après, écartée à la livraison (`unsubscribed`). Désinscription de test : jeton de la ligne du lancement,
  `/desinscription/<jeton>` (s25), chemin existant.
- **Pas d'historique** : les comptes connectés avant le déploiement de s42a (bureau, seed) n'ont pas de
  trace et partent « jamais connectés » ; la relance les inclura (note de la revue s42a, à dire au bureau).
- **Imitation** (s48) : ne compte pas comme connexion (déjà dans le hook) ; l'auteur d'un lancement fait
  « à la place » suit `effectiveAuthor`, comme `sendCampaignService`.
- **Une adresse sur plusieurs fiches** = un destinataire (ADR 057) = un compte = une trace : C6 et le
  « seul état affiché sur chacune » de C7 tombent d'eux-mêmes, à prouver sur le cas s53.

**Natures et types d'envoi (C3)**

- Ajouter des valeurs à `CAMPAIGN_SEND_KINDS` crée automatiquement leurs réglages `campaign.nature.*`
  (section `campaign_nature`, SuperAdmin), les ajoute à `templateNaturesOf` du composeur et à la liste
  statutaire de la page de désinscription. Libellés requis : `campaignNature.templates.<kind>`,
  `templateNames.<kind>` (liste et détail des campagnes), et ceux du panneau de désinscription.
- `campaignTemplateIdSchema` n'accepte que `CAMPAIGN_TEMPLATE_IDS` : les nouveaux types ne doivent pas y
  entrer (ils ne se choisissent pas dans le composeur), comme `unpaid_reminder`.

**Tests existants qui vont bouger**

- `src/services/__tests__/association-settings-rules.test.ts` : `expect(CAMPAIGN_SEND_KINDS).toEqual([...])`
  (l. 1756), liste explicite des clés de nature (l. 901-906), décomptes générés (l. 189, 1298, 1497).
- `src/components/features/association/association-settings-form.test.tsx` : « 2a · six réglages… »
  (l. 919) et la section des natures.
- `src/db/scripts/tenant-settings-seed.test.ts` (natures du premier tenant, l. 134-178).
- `src/services/__tests__/campaign-service.test.ts` (livraison mockée de `sendEmailService`),
  `campaign-letter-service` et `campaign-letter-rules` tests, `unsubscribe-service.test.ts`, tests du
  panneau de désinscription et des pages campagnes (libellés).
- `campaign-composer.test.tsx` dépasse déjà 5 s sous charge (revue s42a) : à ne pas compter comme vert.
- Unitaires : `pnpm test --run`, à valider sur une copie en disque local (montage 9p) ; e2e en CI seulement.

**e2e (C10, isolation)**

- Le planificateur se déclenche en e2e : `campaigns.spec.ts` le lance par `execFileSync('pnpm', ['tsx',
  SCHEDULER_SCRIPT])` après `makePartDue(partId)` ; il faut retirer `billing.unpaid_reminders` avant
  (`dropUnpaidReminderJobs`) pour ne pas consommer le plafond abaissé. Le sous-processus hérite de
  `EMAIL_TRANSPORT=file` et `EMAIL_OUTBOX_DIR` : le lien se lit dans l'outbox. `email-budget.spec.ts` ne
  lance pas le planificateur (écart (f) de la revue s42a). Domaines : `localhost` = TechCorp,
  `127.0.0.1` = Marketing Pro.
- Une part « du lendemain » s'obtient par le plafond (`campaign.daily_send_cap` abaissé : part 2
  programmée) ou par le budget (`email.daily_send_limit` : part glissée par `deferPartOutcome`). Les deux
  sont hors requête une fois le planificateur lancé.
- Aucune nouvelle table n'est requise par les critères ; si le plan en ajoute une (ou une colonne sur
  `campaign`), RLS forcée, test d'accès croisé e2e, classement dans `docs/architecture.md` (57 tables) et
  migration par `pnpm db:generate` (jamais à la main).

**Règles transverses**

- Rien en dur (ADR 010) : texte du courrier en réglage ; natures en réglages ; libellés dans
  `messages/fr.json`.
- Mutations par Server Action → façade → service ; lecture d'adoption par le DAL, donnée par utilisateur
  non cachée (derrière `<Suspense>`). Façades existantes : `campaign-service-facade.ts`,
  `member-invitation-service-facade.ts` (intercepteur en `shouldLogDetails: () => false`, à conserver
  pour tout ce qui touche au lien).
- `docs/architecture.md:615` dit encore que les liens d'invitation « (s42) » sont construits sur
  `NEXT_PUBLIC_APP_URL` : périmé depuis s42a (lien rebasé sur l'association), à corriger au passage.

## Open questions

Vérifiées contre la story, le PRD, les ADR 051-071 et le code : aucune n'y est tranchée.

1. **Un type d'envoi ou deux ?** C3 dit que « l'invitation de lancement et sa relance déclarent leur
   nature », sans dire s'il s'agit d'un réglage commun ou de deux. *Recommandation* : deux types
   (`member_invitation_launch`, `member_invitation_reminder`), deux réglages seedés `statutaire`, sur le
   patron « un type par envoi » de s29 (ADR 070 §8). Conséquence : deux lignes dans les Réglages
   SuperAdmin et sur la page de désinscription.
2. **Où vit le contenu d'une campagne de lancement ?** C2 fixe que le texte du courrier est un réglage de
   tenant, et ADR 065 fige les fiches, pas le texte. Rien ne dit si le texte d'invitation et celui du
   courrier sont **figés à la création** (comme tout contenu de campagne) ou relus à la livraison et à la
   génération du PDF. *Recommandation* : figer les deux. Le texte d'invitation dans `body_markdown`,
   marqué comme texte et non comme Markdown (aucun lien), et le texte du courrier dans une nouvelle
   colonne nullable de `campaign` (migration générée et ADR). Le courrier imprimé plus tard reste alors
   celui du lancement, et l'archive de s25 dit ce qui est parti.
3. **C5 quand le lancement est réglé en `facultative`.** Une fiche dont toutes les adresses sont
   désinscrites n'a ni email ni courrier : C5 n'est alors pas tenu. *Recommandation* : ne pas ajouter de
   courrier à ces fiches (elles ont refusé un canal, pas le courrier). Les compter et les afficher à part
   dans le suivi (« ont refusé les envois facultatifs »), et écrire dans le plan que C5 se prouve sous la
   nature du seed. À arbitrer : on peut aussi décider que le lancement ignore la nature pour la
   couverture, ce qui contredirait C3.
4. **Revérifier à la livraison qu'une adresse ne s'est pas connectée.** La cible de la relance est figée
   à la création, alors que ses parts peuvent partir plusieurs jours après. Une adresse connectée entre
   les deux serait réinvitée, contre C8 (« sans réinviter une adresse déjà connectée »). *Recommandation* :
   relire `first_signed_in_at` à la livraison et écarter la ligne sans envoi (patron `settled` de s29).
   Il reste à choisir entre réutiliser le statut `settled`, dont le libellé actuel parle de factures, et
   ajouter une valeur d'enum (migration). Même question pour le lancement : écarter une adresse déjà
   connectée au moment de l'envoi ?
5. **Doublon entre une invitation individuelle et une campagne** (élargit le mineur m5). Aujourd'hui,
   l'invitation individuelle reportée (rejeu) et la ligne d'une part partent toutes deux, et la seconde
   révoque le lien de la première. *Recommandation* : à la livraison d'une ligne de lancement ou de
   relance, l'écarter si `last_invited_at` est postérieur à la création de la campagne. Appliquer en plus
   le correctif m5 au rejeu (`last_invited_at` postérieur à `deferred_email.created_at`).
6. **Révocation inter-associations (m4).** Faut-il borner `revokeEarlierMagicLinks` à l'association ? Il
   faudrait alors porter l'association dans `verification.value`, ce qui touche le format du lien demandé
   de s03 et le plugin. *Recommandation* : ne pas le faire en s42b (un seul client), le documenter dans
   l'ADR de la story, et construire l'e2e C10 sur des comptes distincts par association. À rouvrir au
   deuxième client.
7. **Lancement unique ou répétable ?** C8 couvre les adresses ajoutées après le lancement, ce qui suggère
   un lancement unique suivi de relances. Mais rien n'interdit de relancer le lancement, ce qui renverrait
   le courrier à tous les sans-email. *Recommandation* : un lancement par association. Une fois parti, le
   bouton laisse la place à « Relancer les jamais connectés ». Protection par `submissionId` déterministe
   (uuid v5 de l'association, patron s29).
8. **Que compte « invitations envoyées » (C7) ?** Ce peut être le nombre d'adresses invitées au moins une
   fois (`last_invited_at` non nul, toutes origines confondues : fiche, lancement, relance) ou le nombre
   d'emails partis (lignes `sent` des campagnes plus invitations individuelles, dont aucune n'est
   historisée). *Recommandation* : en adresses, cohérent avec « par adresse » et lisible sans nouvelle
   table.
9. **Quelle autorisation ?** Le lancement est une campagne (`campaign.manage`), alors que l'invitation
   individuelle relève de `member.profile.manage`. *Recommandation* : `campaign.manage` pour lancer,
   relancer et lire le suivi. La liste des adresses est déjà visible du gestionnaire de campagnes par les
   destinataires d'une campagne. s37 pourra séparer les deux droits.
10. **La relance produit-elle un courrier ?** C8 ne parle que d'adresses. *Recommandation* : non. Les
    fiches sans email ont reçu le courrier du lancement, et la relance n'a pas de cible postale.
11. **Où placer le suivi et l'email ?** Écran d'adoption (page dédiée sous « L'association » à côté de
    Campagnes et Relances, ou filtre de la liste des propriétaires), bloc d'invitation dans le gabarit de
    campagne, objet sans double préfixe : à trancher en `/ks-design` (story à UI), dans le design system,
    avec le gap « téléphone du bureau » à remonter.

Research ready in docs/research/s42b-lancement-invitations.md. Next step: /ks-design s42b-lancement-invitations (UI story) or /ks-plan s42b-lancement-invitations

## Arbitrages du 24/11/2026

Tranchés par l'utilisatrice avant le design :

- **Q7** — Un seul lancement par association. Une fois parti, « Lancer » laisse la place à « Relancer les jamais connectés ».
- **Q10** — La relance est un envoi email seul, sans courrier.
- **Q1** — Deux types d'envoi, donc deux réglages de nature (lancement, relance), tous deux seedés `statutaire`.
- **Q3** — En nature `facultative`, une fiche dont toutes les adresses sont désinscrites ne reçoit ni email ni courrier ; le suivi la compte à part (« ont refusé les envois facultatifs »). C5 se prouve sous la nature du seed.

Laissés au plan (choix techniques, recommandations de la recherche retenues) : Q2 contenu figé à la
création, Q4 revérification « jamais connectée » à la livraison, Q5 écart d'une ligne déjà invitée depuis
la création + correctif m5, Q6 révocation inter-associations documentée et non corrigée, Q8 « invitations
envoyées » compté en adresses, Q9 `campaign.manage`. Q11 au design.
