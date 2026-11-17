# ADR 059 — Factures des membres : modèle, contrat `MemberBillingProvider` et classement des statuts

- Status: accepted
- Date: 2026-11-17
- Scope: story s19-factures-liste

## Context

L'ADR 011 pose le principe d'un contrat `MemberBillingProvider` interchangeable, choisi par association,
avec deux implémentations (`manuel`, `pennylane`). s19 livre le contrat et `manuel` ; s20 livrera
`pennylane` sans toucher la présentation. La recherche de s19 (17/11) laisse ouverts la forme du modèle,
la représentation du montant, le rattachement au terrain, le classement des statuts et le déclenchement
du signalement d'un statut inconnu. Quatre de ces points ont été arbitrés par l'utilisatrice le 17/11
(classement par deux réglages texte, signalement une fois par statut, parcelle facturée, objet composé
par un modèle de tenant) ; les autres sont techniques.

Contraintes : statut opaque (ni booléen ni énumération, ADR 011, CDCT §5.2) ; prédicat « impayé » dérivé
de la configuration du tenant et consommé tel quel par s21, s27, s29 ; aucune valeur de statut livrée
(amendement du 15/11) ; rattachement au membre facturé, jamais à la parcelle (règle transverse) ; rien en
dur (ADR 010) ; aucun moyen de paiement dans le contrat.

## Decision

1. **Table `member_invoice`** (table métier, RLS forcée, policy `tenant_isolation`) : `id`,
   `organization_id`, `member_profile_id` (FK `RESTRICT`, **clé de rattachement**), `parcel_id` (FK
   `RESTRICT`, **descriptive** : le terrain facturé), `source` (`pgEnum` `site | pennylane` — ensemble
   fermé du produit, pas un statut de fournisseur), `external_id` (texte facultatif, identifiant chez la
   source, unique par association quand non nul), `year` (entier), `issued_on` et `due_on`
   (`date`, mode chaîne, `due_on >= issued_on`), `amount_cents` (entier, `> 0`), `status` (`text`, sans
   `CHECK` de valeurs), `created_at`, `updated_at`.
2. **Montant en centimes entiers, euro implicite** : aucune devise stockée (une ASL française facture en
   euros) ; la conversion et le format « 412,50 € » vivent dans une règle pure.
3. **La parcelle facturée n'est pas une clé de rattachement** : à l'écriture, le service vérifie par
   `getParcelOwnerAtService(organizationId, parcelId, issuedOn)` que le propriétaire à la date d'émission
   est le membre facturé, sinon refus. La visibilité ne lit que `member_profile_id` : une vente ne
   déplace aucune facture.
4. **Classement des statuts par deux réglages `text` multilignes** du registre (ADR 016) :
   `billing.unpaid_statuses` et `billing.settled_statuses`, un statut par ligne, comparaison exacte après
   suppression des espaces de bord, vides par défaut, modifiables par le bureau. Un statut présent dans
   les deux listes est refusé à l'enregistrement des réglages. Règle pure
   `classifyInvoiceStatus(status, classification) → 'unpaid' | 'settled' | 'unclassified'` et prédicat
   `isUnpaidInvoice` : **seul `unpaid` est impayé ; `unclassified` n'est ni réglé ni impayé** et reste
   hors de toute cible de relance.
5. **Signalement une fois par statut** : table `invoice_status_alert` (`organization_id`, `status`,
   `notified_at`, unique `(organization_id, status)`, RLS forcée). Toute écriture de facture par une
   implémentation passe par `signalUnknownInvoiceStatuses` : un statut `unclassified` sans ligne d'alerte
   déclenche un email (nature `board_notification`) au réglage `billing.alert_email` (repli
   `{fromKey: contact.email}`), puis la ligne est posée. Un échec d'envoi ne fait pas échouer l'écriture
   et ne pose pas la ligne (nouvel essai à la prochaine écriture).
6. **Objet composé** : réglage `text` `billing.invoice_subject` (« Cotisation et eau {année} » en seed
   du premier tenant, à valider avec le bureau), rendu par la règle pure `composeInvoiceSubject`. Le
   libellé brut de la source n'est jamais affiché.
7. **Contrat `MemberBillingProvider`** (couche service, fonctionnel, sans classe) :
   `listInvoicesOf(organizationId, memberProfileIds) → MemberInvoice[]` et `canWrite: boolean`.
   L'implémentation est choisie par le réglage `choice` `billing.provider` (option unique `manual` en
   s19, `pennylane` ajoutée par s20 ; `editableBy: 'super_admin'`) via `resolveMemberBillingProvider`.
   L'**écriture** manuelle vit dans un service à part (`member-invoice-service`), gardé par
   `canWrite` du fournisseur actif : le contrat reste un contrat de lecture, comme l'ADR 011 le décrit.
   Une facture `source = pennylane` est refusée en écriture **par le service**, quel que soit l'appelant.
8. **Statuts proposés à la saisie manuelle** : l'union des deux listes ; le service refuse un statut
   hors de cette union. Un statut devient « à classer » quand il vient d'une source externe (s20) ou
   quand il sort de la configuration.

## Considered options

- **Statut en énumération ou booléen** — rejeté : contraire à l'ADR 011 et à la story.
- **Table de classement dédiée** (statut → classe + libellé) — rejeté par arbitrage : sans écran de
  classement en V1, elle ne se modifie que par script ; deux réglages se rendent avec le composant existant.
- **Nouveau type « liste » au registre** — rejeté : un `textarea` à une valeur par ligne couvre le besoin
  sans toucher le générateur ni ses tests.
- **Signalement à chaque facture** — rejeté par arbitrage : un lot Pennylane portant un statut nouveau
  consommerait le budget quotidien (300 emails).
- **Terrain déduit de la fiche seule** — rejeté par arbitrage : ambigu quand une fiche a eu plusieurs
  parcelles, faux après une vente si l'on lit les parcelles actuelles.
- **`numeric(12,2)`** — rejeté : arrondi et conversion décimale côté JavaScript ; l'entier est exact.
- **Écriture dans le contrat** — rejeté : Pennylane est en lecture seule ; un contrat à deux faces
  obligerait s20 à implémenter une écriture qui refuse tout.
- **Choix du fournisseur par variable d'environnement** — rejeté par l'ADR 011.

## Consequences

- s21, s27 et s29 importent `isUnpaidInvoice` / `classifyInvoiceStatus` et n'interprètent jamais un statut.
- s20 ajoute l'option `pennylane` au réglage `billing.provider`, une implémentation du contrat, l'écriture
  de synchronisation (`source = pennylane`, `external_id`) et réutilise `signalUnknownInvoiceStatuses`.
- Libellés « en mots simples » par statut : non livrés ; s20 les ajoutera quand la liste réelle sera connue.
- À surveiller : la comparaison exacte des statuts est sensible à la casse ; c'est voulu (le statut est
  opaque), et le bureau recopie les statuts tels que l'email les cite.
