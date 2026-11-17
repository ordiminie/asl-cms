# ADR 057 — Une campagne part à chaque adresse active ; la désinscription est portée par l'adresse de fiche

- Status: accepted — remplace, pour la désinscription et le calcul de la cible, l'[ADR 055](055-desinscription-par-adresse-et-un-envoi-par-adresse.md)
- Date: 2026-11-16
- Scope: story s54-adresses-email-multiples

## Context

Avec s54 (ADR 056), une fiche porte N adresses actives, et « tout le monde reçoit toutes les communications »
(critère 3). L'ADR 055 groupait les **fiches** par leur adresse unique, posait la désinscription sur la
fiche (`member_unsubscribe`) et l'étendait aux fiches de la même adresse ; `campaign_recipient` ne porte
pas d'adresse (relue sur la fiche à la livraison). Arbitrage du 16/11/2026 : **la désinscription suit
l'adresse** — le proche qui se désinscrit ne coupe pas le propriétaire.

## Decision

- **Cible** (`computeCampaignTarget`, point de passage unique) : une ligne par **(fiche, adresse active)** ;
  groupement par `lower(trim(email))` ; un groupe = un destinataire, porté par sa première fiche (ordre ADR
  054 §7). `recipients` et `unsubscribed` comptent des adresses ; `withoutEmail` compte les fiches sans
  adresse active.
- **`campaign_recipient.email`** (nouvelle colonne) : l'adresse visée, écrite à la création de la cible ;
  unicité `(campaign_id, member_profile_id)` remplacée par `(campaign_id, lower(email))`. La livraison
  envoie à cette adresse **si elle est encore active** sur une fiche de l'association, sinon la ligne est
  traitée comme une fiche supprimée (rien n'est envoyé). Les lignes créées avant la migration reçoivent
  l'adresse de leur fiche.
- **Désinscription** : `member_profile_email.unsubscribed_at`. Se désinscrire (par le jeton de la ligne)
  date **toutes** les adresses de l'association égales sans casse à celle de la ligne ; une adresse datée
  ne reçoit plus de campagne. Une adresse ajoutée plus tard, même égale, n'hérite pas du refus (règle de
  l'ADR 055 conservée).
- **`member_unsubscribe` est repris puis retiré** : chaque ligne date l'adresse (unique avant s54) de sa
  fiche, puis la table disparaît (migration générée).
- **Variables** : règle de l'ADR 055 appliquée à l'adresse — une fiche : nom de la fiche ; plusieurs : nom
  du compte de l'adresse ; `{parcelle}` = parcelles actuelles des fiches du groupe.

## Considered options

- **Garder la désinscription par fiche** — rejeté par l'arbitrage : le clic d'un proche couperait le
  propriétaire.
- **Table `email_unsubscribe (organization_id, email)`** — rejeté : ferait de l'adresse une clé de stockage
  détachée de toute fiche (règle d'identité du projet).
- **Relire l'adresse sur la fiche à la livraison** — rejeté : une fiche a N adresses ; la ligne doit dire à
  laquelle elle s'adresse.

## Consequences

- Le nombre d'envois d'une campagne augmente du nombre d'adresses supplémentaires ; le budget (s52) et la
  durée d'étalement affichée (s26) suivent la cible sans autre changement.
- s27 (cible filtrée), s29 (relances) et s42 (invitations) réutilisent ce calcul et cette colonne.
- La page de désinscription (s25) parle de l'adresse, pas de la fiche.
