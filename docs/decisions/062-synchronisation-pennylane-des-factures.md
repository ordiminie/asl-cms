# ADR 062 — Factures Pennylane : synchronisation planifiée, rapprochement par `external_reference`, terrain lu sur la fiche et contrôlé

- Status: accepted
- Date: 2026-11-19
- Scope: story s20-factures-pennylane
- Amends: ADR 059 §1 et §3 (terrain d'une facture), pour `source = pennylane` seulement

## Context

s19 a livré le contrat `MemberBillingProvider` et l'implémentation `manual` (ADR 059). s20 ajoute
`pennylane`. Relevé de l'API v2 (18-19/11/2026, `docs/research/s20-factures-pennylane.md`) : 858 factures,
413 clients, 7 statuts en anglais, `paid` incohérent avec `status`, `public_file_url` qui expire en 30 min,
moyens de paiement exposés par `/customers` (`billing_iban`, `mandates`), 25 requêtes / 5 s.
Deux faits fixent le modèle :

- **Domaine** (utilisatrice, 19/11) : un terrain = 1 compteur + au moins 1 parcelle ; une facture par
  compteur ; un client Pennylane par terrain ; avec s53, **fiche = terrain**.
- **Clé** : l'« Identifiant Client » importé sur la fiche (`pennylane_customer_id`) est l'**`external_reference`**
  du client de l'API (413/413), pas son `id` (0/413). Une facture ne porte que `customer.id`.
- **Terrain écrit sur la facture** : la ligne « Numero parcelle : … - Compteur : … - Index … » du PDF vient
  du texte libre `pdf_invoice_free_text` — 401/437 factures 2026, **aucune** facture 2025 ; parcelles en
  abrégé quand il y en a plusieurs (`AH 6-7`) ; identique à la « Référence Client » du client (dont l'import
  s13 a tiré parcelles et compteur de la fiche) dans 386 cas sur 394.

Le critère 9 (API indisponible → dernières données connues) interdit l'appel réseau à l'affichage.

## Decision

1. **Synchronisation, pas lecture en direct.** Un service `syncPennylaneInvoicesService(organizationId)`
   relit tout (clients puis factures, pagination `next_cursor`) et écrit `member_invoice` avec
   `source = pennylane`, `external_id` = `id` de la facture Pennylane (upsert par `(organization_id,
external_id)`). L'implémentation `pennylaneMemberBillingProvider` (`canWrite: false`) **lit la base**,
   comme `manual` : l'espace membre ne dépend jamais de la disponibilité de Pennylane.
2. **Rapprochement** : `customer.id` → `external_reference` (table construite à partir de `/customers`) →
   fiche dont `pennylane_customer_id` est égal (comparaison exacte, sans casse). Jamais `id`, jamais la
   « Référence Client » (non unique).
3. **Écartées** (comptées, jamais écrites) : `draft = true` ; `status = credit_note` (avoirs, arbitrage du
   19/11) ; sans `customer`, sans `date` ou sans `deadline` ; montant ≤ 0 ou devise autre que `EUR` ; client
   sans fiche. Une facture déjà écrite et absente d'une relecture **complète et réussie** est supprimée (elle
   a été supprimée ou est redevenue brouillon chez Pennylane). Une relecture partielle (erreur) n'écrit rien.
4. **Terrain** (arbitrage du 19/11 : « fiche + contrôle ») : pour `source = pennylane`, `parcel_id` est
   **nul** ; le terrain **affiché** est celui de la fiche — ses parcelles **à la date d'émission** (propriété
   datée, s12) et leur compteur. Contrainte : `CHECK (source = 'pennylane' OR parcel_id IS NOT NULL)`.
   L'ADR 059 §3 reste vrai pour `site` ; son rejet du « terrain déduit de la fiche seule » visait une fiche à
   plusieurs terrains, que s53 a supprimée. **Contrôle** : quand `pdf_invoice_free_text` porte la ligne
   « parcelle : … - Compteur : … », la synchronisation en extrait parcelle(s) et compteur (règle pure,
   tolérante aux formes relevées) et les compare à la fiche à la date d'émission ; un écart est **compté et
   nommé** dans `billing_sync_state` (facture, fiche, ce que dit la facture) et affiché au bureau. Il ne
   bloque pas l'écriture et ne change pas l'affichage. Le texte libre n'est jamais stocké ni montré au membre.
5. **Statut** transporté tel quel ; chaque écriture passe par `signalUnknownInvoiceStatuses` (ADR 059 §5).
   **Libellés** : réglage texte `billing.status_labels` (« statut = libellé » par ligne, vide par défaut,
   arbitrage du 19/11), règle pure `statusLabelOf(status, labels)` avec repli sur le statut brut. Le libellé
   ne sert **jamais** au classement.
6. **PDF** : la synchronisation note seulement `has_pdf` (`public_file_url` non nul). Au clic, un service
   vérifie que la facture appartient aux fiches du compte, relit `GET /customer_invoices/{external_id}` et
   rend `public_file_url`, qui n'est ni stocké, ni mis en cache, ni journalisé.
7. **État de la synchronisation** : table `billing_sync_state` (une ligne par association, RLS forcée) :
   `last_attempt_at`, `last_success_at`, `last_error` (code : `missing_key`, `unauthorized`,
   `unavailable`, `rate_limited`), compteurs (écrites, écartées par motif) et clients Pennylane sans fiche
   (`id`, nom, référence — affichés au bureau, critère 3), écarts de terrain (§4). Les fiches sans
   identifiant se calculent.
8. **Planification** : tâche `billing.sync_pennylane` (ADR 006), toutes les heures, qui programme la
   suivante (clé d'idempotence = l'heure visée). Créée quand `billing.provider` passe à `pennylane` et par
   « Mettre à jour maintenant » (action du bureau sous `member.invoice.manage`, qui lance aussi la
   synchronisation tout de suite). Sous `manual`, la tâche se termine sans rien faire.
9. **Client HTTP** `src/lib/pennylane/` : fonctionnel, `GET` seulement, `Authorization: Bearer`,
   `X-Use-2026-API-Changes: true`, délai d'attente, 429 → attente `retry-after` (bornée), puis échec.
   Chaque réponse est réduite par un schéma Zod à **liste blanche** (aucun champ hors liste ne sort du
   module) ; un test vérifie qu'aucun nom de champ de moyen de paiement (`iban`, `mandate`, `card`, `bic`,
   `rum`) n'apparaît dans les types ni dans les données rendues (critère 10).
10. **Secret** : `PENNYLANE_API_KEY` dans `@/env` (serveur, facultatif). Une clé pour l'instance, tant
    qu'un seul client : une clé par association est à rouvrir au deuxième client. Absente → la
    synchronisation échoue avec `missing_key`, visible au bureau ; les factures déjà écrites restent lues.

## Considered options

- **Lecture en direct à l'affichage** (avec cache) — rejeté : critère 9, débit (25 req / 5 s pour
  9 + 5 pages), et une URL de PDF valable 30 min qu'un cache servirait périmée.
- **Rapprocher par `customer.id`** — rejeté : ce n'est pas la clé importée (0/413).
- **Rapprocher par la « Référence Client »** — rejeté : 386 valeurs pour 413 clients, 28 vides.
- **Une parcelle choisie parmi celles de la fiche** — rejeté : un terrain peut en avoir deux (compteur
  commun) ; en choisir une serait faux.
- **Table de jointure facture ↔ parcelles** — rejeté : la fiche est déjà le terrain ; la propriété datée
  donne les parcelles sans dupliquer.
- **Afficher le terrain lu dans le texte libre** — rejeté par arbitrage : absent des factures 2025 et de
  30 factures 2026, saisi à la main chez Pennylane, formes variables ; il sert de contrôle, pas de source.
- **Libellé de statut dans une table dédiée** — rejeté pour la même raison qu'en ADR 059 : sans écran, un
  réglage texte se rend avec le composant existant.
- **Webhooks Pennylane** — rejeté pour la V1 : point d'entrée public à sécuriser, et une heure de délai est
  acceptable pour une facture annuelle.

## Consequences

- Une table de plus sous RLS (`billing_sync_state`) ; `member_invoice` gagne `has_pdf` et un `parcel_id`
  facultatif sous condition. `docs/architecture.md` à mettre à jour.
- La minuterie du planificateur (absente du VPS au 19/11) devient indispensable : sans elle, plus de mise à
  jour.
- Avant la production : clé **en lecture seule** (`customers:readonly`, `customer_invoices:readonly`).
- s21 : aucun lien de paiement à transporter aujourd'hui (aucun dans l'API ni les PDF) ; si Pennylane en
  expose un, il s'ajoutera à la liste blanche de la facture.
- s29 (relances) lit les mêmes statuts : la relance part d'une base à jour à l'heure près.
