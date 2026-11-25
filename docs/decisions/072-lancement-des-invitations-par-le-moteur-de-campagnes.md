# ADR 072 — Lancement des invitations : une campagne dont chaque destinataire reçoit un lien de connexion né à sa livraison

- Status: accepted
- Date: 2026-11-24
- Scope: story s42b-lancement-invitations
- Complète : ADR 051/052 (campagnes, envoi étalé), ADR 053 (budget quotidien), ADR 057 (une ligne par
  adresse), ADR 064 (nature des envois), ADR 065 (fiches du courrier figées), ADR 070 (campagne créée
  par le système, statut `settled`), ADR 071 (lien d'invitation par le générateur du lien magique)

## Context

s42b annonce le site à toute l'association d'un seul geste : une invitation par adresse active, chacune
avec **son propre lien de connexion**, et un courrier pour les fiches sans adresse. Tout le moteur existe :
cible et dédoublonnage par adresse (s53, s54), parts et budget (s26, s52), nature statutaire (s27b),
courrier figé (s28), campagne créée hors du composeur (s29). s42a a posé le générateur du lien
(`issueInvitationLink`, ADR 071), les traces « invitée le » / « connectée le » et le texte de
l'invitation.

Ce qui n'existe pas : une campagne envoie aujourd'hui **le même contenu** à tous, personnalisé par
`{nom}`, `{parcelle}`, `{date}` et le jeton de désinscription. Le lien de connexion est une variable d'un
genre nouveau : un secret à usage unique, dont l'émission **révoque** les liens précédents de l'adresse.
Et le PDF de s28 imprime le corps de l'email, alors que les sans-email ne doivent recevoir ni lien ni
promesse d'accès.

Arbitrages de l'utilisatrice (24/11/2026) : un lancement unique par association, puis « Relancer les
jamais connectés » autant que voulu ; relance par email seul ; deux types d'envoi, deux natures seedées
`statutaire` ; en `facultative`, une fiche dont toutes les adresses sont désinscrites ne reçoit rien et
se compte à part.

## Decision

1. **Le lancement et la relance sont des campagnes**, créées par le cœur partagé
   `createCampaignInTenant` (ADR 070 §1), avec deux types d'envoi ajoutés à `CAMPAIGN_SEND_KINDS` :
   `member_invitation_launch` et `member_invitation_reminder`. Chacun reçoit son réglage de nature généré
   (`campaign.nature.<type>`, seed `statutaire` pour le premier tenant). Ni l'un ni l'autre ne se choisit
   dans le composeur. Ils apparaissent dans l'archive des campagnes, avec leurs destinataires, leurs parts
   et leurs statistiques.
2. **Un lancement par association** : `submissionId` déterministe (uuid v5 de l'association et du type,
   patron `reminderSubmissionIdOf`). Un second appel retrouve la campagne existante, ne crée rien et
   n'envoie rien. La relance reçoit le `submissionId` de son formulaire, comme le composeur. Elle est
   refusée tant qu'une part du lancement ou d'une relance reste à envoyer.
3. **Le lien naît à la livraison de chaque destinataire, après la prise de sa ligne.** Pour ces deux
   types, `deliverToRecipient` suit cet ordre : écart éventuel sans envoi (§5), prise `pending → sending`,
   émission du lien par `issueInvitationLink` (seul générateur, ADR 071), composition, envoi. Le jeton
   est **révoqué** (`revokeInvitationLink`) sur toute issue autre que `sent` et `to_verify` : report de
   budget, envois coupés, refus certain, échec de composition. Une ligne prise par un autre passage n'émet
   rien, donc ne révoque pas le lien que cet autre passage envoie. « Invitée le » s'écrit au départ réel
   (`markInvitedTxnDao`). L'échéance affichée se calcule à l'émission : chaque part a ses propres jours.
4. **Une ligne sans lien est écartée seule.** Un lien que le générateur ne peut pas émettre (adresse sans
   compte, compte qui n'est plus membre) passe la ligne `failed` et la part continue. Seul un échec de
   composition ou de transport arrête la part, comme pour toute campagne.
5. **Un nouveau statut de ligne, `superseded`** (« Écartée à l'envoi : déjà connectée ou réinvitée »).
   Juste avant la prise, la ligne est relue. Si l'adresse s'est connectée depuis la création
   (`first_signed_in_at` non nul), ou si une invitation est partie vers elle après la création de la
   campagne (`last_invited_at > campaign.created_at`), rien ne part. Le statut n'est ni « reçue » ni « en
   échec ». La valeur s'ajoute à l'enum `campaign_recipient_status` (migration générée, patron de
   `settled` en `0077`).
6. **Le contenu est figé à la création**, comme tout contenu de campagne. `subject` et `preheader`
   sont les textes fixes de l'invitation de masse (`messages/fr.json`), sans le nom de l'association : le
   gabarit de campagne pose le préfixe « {association} — » une seule fois. `body_markdown` reçoit le texte
   de l'invitation (le réglage `invitation.text`, ou le texte par défaut de s42a, résolu à la création).
   Pour ces deux types, il est lu comme **texte** et jamais comme Markdown, par `invitationParagraphsOf`,
   dans l'email comme dans l'archive. Le texte du courrier est figé dans une nouvelle colonne nullable
   `campaign.letter_text` (le réglage `invitation.letter_text`, ou son défaut). Le PDF du lancement
   l'imprime à la place du corps de l'email, sous un objet fixe, suivi de l'adresse publique du site.
7. **Un seul contenu d'invitation, deux enveloppes.** Le bloc de s42a (texte en paragraphes, bouton,
   URL en clair, trois étapes, échéance) est extrait en un composant partagé. `InvitationMail`
   (transactionnel, pied sans désinscription) et `CampaignMail` (habillage de s25, pied selon la nature,
   `List-Unsubscribe`) l'utilisent tous les deux. Il n'y a pas de second gabarit d'invitation.
8. **Rien ne conserve le lien** : ni `campaign` (archive), ni `campaign_recipient`, ni un journal (les
   journaux de livraison ne portent que des noms d'erreur), ni `deferred_email` (une campagne n'y passe
   pas), ni l'export (s38, qui n'aura rien à exclure puisque rien n'est stocké).
9. **La révocation reste inter-associations** (mineur m4 de la revue s42a). Elle n'est pas bornée à
   l'association : `revokeEarlierMagicLinks` filtre sur l'adresse seule. Une invitation de B tue donc un
   lien encore valide envoyé par A à un compte membre des deux. Le corriger toucherait le format de la
   ligne `verification` du lien demandé de s03. Avec un seul client, c'est rare. À rouvrir au deuxième
   client. L'e2e de s42b utilise des comptes distincts par association.
10. **Correctif m5 de s42a** : au rejeu d'une invitation individuelle reportée, rien ne part si
    `last_invited_at` est postérieur au report (`deferred_email.created_at`). C'est le symétrique du §5.

## Considered options

- **Une invitation individuelle (s42a) bouclée sur toutes les fiches.** Rejeté : pas de parts ni de
  plafond par campagne, pas d'archive, pas de courrier, pas de pied de désinscription, alors que la story
  l'exige sur un envoi de masse. Chaque invitation reportée serait conservée dans `deferred_email`, soit
  300 lignes.
- **Émettre le lien dans `composeRecipientEmail`, avant la prise.** Rejeté : une prise perdue ferait
  révoquer le lien qu'un autre passage est en train d'envoyer. Un report laisserait un jeton vivant sept
  jours qui n'est parti nulle part, et aurait tué le lien encore valide de la veille.
- **Arrêter la part sur un lien non émis** (comportement d'un échec de composition). Rejeté : une seule
  adresse sans compte bloquerait les 299 suivantes et finirait en campagne `interrupted`.
- **Réutiliser `settled` pour l'écart à l'envoi.** Rejeté : son libellé (« Réglée avant l'envoi »), son
  compteur et son sens (ADR 070 §3) parlent de factures. Un libellé dépendant du type d'envoi
  disperserait la règle dans les badges, les compteurs et les filtres. Un nouveau statut, lui, est imposé
  par le typage exhaustif (`Record<CampaignRecipientStatus, …>`).
- **Relire le texte de l'invitation et celui du courrier à la livraison et à la génération du PDF.**
  Rejeté : l'archive ne dirait plus ce qui est parti, et un courrier imprimé une semaine plus tard
  pourrait différer de l'email du même lancement (ADR 065 fige déjà les fiches pour cette raison).
- **Passer le texte de l'invitation comme Markdown de campagne.** Rejeté : `*`, `#` et `[ ](…)` seraient
  interprétés, contre le « une balise reste du texte » de s42a, et une accolade ferait refuser l'envoi
  par `findUnknownVariables`.
- **Borner la révocation à l'association dès s42b.** Rejeté pour l'instant (§9).

## Consequences

- Plus simple : le budget, le report, l'étalement, le dédoublonnage par adresse, la désinscription, la
  nature et les statistiques s'appliquent au lancement sans code nouveau (critère 9 acquis par
  construction).
- Plus difficile : `deliverToRecipient` a deux ordres d'opération, celui des campagnes (composer puis
  prendre) et celui des invitations (prendre puis émettre puis composer). Cette branche doit rester
  isolée et testée sur l'ordre des appels.
- À surveiller : Brevo réécrit les liens pour compter les clics (ADR 068). Le lien d'invitation transite
  par sa redirection, comme le lien magique. Les comptes connectés avant s42a n'ont pas de trace : la
  relance les inclut (à dire au bureau). Une adresse active sans compte apparaît « en échec » dans le
  détail du lancement, et sa fiche n'est alors couverte par aucun envoi parti. `openMemberAccountsForOrganization`
  la répare, et le suivi la montre.
- Migration : une colonne nullable et une valeur d'enum, générées par `pnpm db:generate`. Aucune table
  nouvelle, aucune minuterie nouvelle (`asl-cms-planificateur` livre les parts).
