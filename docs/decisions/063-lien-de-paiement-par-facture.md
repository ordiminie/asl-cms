# ADR 063 — Lien de paiement : un champ du contrat de facturation, facture par facture, sans stockage

- Status: accepted
- Date: 2026-11-20
- Scope: story s21-redirection-paiement
- Amends: ADR 059 §7 (contrat `MemberBillingProvider`)

## Context

s21 (amendée le 19/11/2026) : le lien de paiement vient du fournisseur de factures, **facture par
facture**, quand l'association a activé le paiement en ligne chez Pennylane ; sinon le règlement se fait
par virement. Jamais une constante, jamais un réglage saisi à la main.

Relevé de l'API Pennylane v2 (18-19/11/2026, 858 factures) : **aucun champ** de lien de paiement, et aucun
lien dans les PDF relus. Le fournisseur Pennylane lit `member_invoice` écrite par la synchronisation
(ADR 062 §1) : il ne fait aucun appel réseau à l'affichage. Le fournisseur manuel (s19) n'a pas de lien
par nature. La frontière « simple lien sortant » tient le produit hors DSP2/PCI (PRD angle n°4).

## Decision

1. **`MemberInvoice.paymentUrl: string | null`** — le lien de paiement d'une facture, tel que le
   fournisseur le donne. Chaque implémentation le renseigne **explicitement** : le manuel rend toujours
   `null` ; Pennylane rend `null` tant que l'API n'expose aucun champ. Le mappage partagé
   `toMemberInvoice` ne le décide pas.
2. **Aucune colonne, aucun champ d'API inventé.** Pas de `payment_url` dans `member_invoice`, rien ajouté à
   la liste blanche `pennylaneInvoiceSchema` (ADR 062 §9) tant qu'un champ réel n'est pas relevé sur l'API.
   Aucune URL construite à partir d'un identifiant.
3. **La décision d'affichage est dans le service** (`toMyInvoice`) : `MyInvoiceDTO.payment` vaut
   `{kind: 'link', url}` si la facture est impayée (prédicat de s19) **et** que le lien est une adresse
   absolue `https` (`isHttpsUrl`) ; `{kind: 'transfer'}` si impayée sans lien valable ; `null` sinon. La
   présentation ne relit jamais un lien non gardé ni un statut.
4. **Le bureau ne voit pas le lien** : `BoardInvoiceDTO` l'omet (aucun usage côté bureau).

## Considered options

- **Réglage d'URL par association** (critère d'origine de s21) — rejeté par l'amendement du 19/11 : le
  lien est propre à chaque facture chez Pennylane.
- **Colonne `payment_url` alimentée par la synchronisation** — rejetée : aucune source dans l'API ; une
  colonne toujours vide est du code mort, et un champ inventé dans le schéma Zod serait une hallucination
  d'API. À ouvrir le jour où le champ existe, par une story qui le relève.
- **Méthode du contrat `paymentLinkOf(invoice)`** — rejetée : le lien de Pennylane, s'il vient, arrivera
  avec la facture ; une méthode à part pousserait à un appel réseau à l'affichage (ADR 062 §1).
- **Construire l'URL `/public/view_invoice?encrypted_id=…`** — rejetée : format non documenté, interdit par
  les notes de la story.

## Consequences

- Chez La Fourche aujourd'hui, toute facture impayée affiche la mention de virement ; le bouton n'est
  prouvé qu'en unitaire (fournisseur simulé).
- Le jour où Pennylane expose un lien : un champ dans la liste blanche, une colonne, le mappage de s20 et
  le fournisseur Pennylane — **sans toucher** le service ni l'écran de s21.
- Le contrat ne porte toujours aucun moyen de paiement : un lien sortant n'en est pas un.
