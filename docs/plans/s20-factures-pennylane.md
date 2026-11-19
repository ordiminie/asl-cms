---
validated: yes
---

# Plan — Story s20-factures-pennylane

Branch: `feature/s20-factures-pennylane`

Sources : `docs/research/s20-factures-pennylane.md`, `docs/designs/s20-factures-pennylane.md` (+ `.html`),
[ADR 062](../decisions/062-synchronisation-pennylane-des-factures.md). Appuis : ADR 006, 010, 011, 016, 048,
052, 059.

## Target story

Remonter automatiquement les factures Pennylane des membres, sans changer l'interface membre au-delà des
ajouts prévus (PDF, date de mise à jour), en lecture seule, avec rapprochement par l'identifiant client de la
fiche. Les dix critères sont repris dans la recherche ; arbitrages du 19/11 : libellés des statuts en
réglage, avoirs écartés, terrain affiché depuis la fiche et contrôlé par la ligne « Numero parcelle » de
la facture ; domaine : fiche = terrain = compteur.

## Tasks (ordered)

1. [x] **Modèle et migrations** — `member_invoice` : `parcel_id` facultatif + `CHECK (source = 'pennylane'
       OR parcel_id IS NOT NULL)`, colonne `has_pdf boolean not null default false` ; nouvelle table
       `billing_sync_state` (PK `organization_id`, `last_attempt_at`, `last_success_at`, `last_error` texte
       facultatif, `counts jsonb`, `unmatched_customers jsonb`, horodatages) ; `pnpm db:generate`, puis
       migration RLS `--custom` (ENABLE + FORCE + `tenant_isolation`, patron 0066/0068) ; `db.ts` ;
       `docs/architecture.md` (53 tables, 34 sous RLS, ligne `billing_sync_state`, `member_invoice` amendé) ;
       test de modèle et inventaire RLS. **Vérif** : tests de modèle, `db:generate` sans diff.
2. [x] **Réglages** — option `pennylane` de `billing.provider` (libellé `billingProviders.pennylane`) ;
       nouvelle clé texte multiligne `billing.status_labels` (section `billing`, vide par défaut, plafond
       `BILLING_STATUS_LIST_MAX_LENGTH`), libellés `AssociationSettings.fields.statusLabels.*` ; règle pure
       `parseStatusLabels(text) → Map` et `statusLabelOf(status, labels)` (repli brut, ligne sans « = » ignorée)
       dans `member-invoice-rules.ts`. **Vérif** : tests du registre, des règles, du formulaire des réglages.
3. [x] **Secret** — `PENNYLANE_API_KEY` (serveur, facultatif) dans `env.ts` et `env.example` (sans valeur).
       **Vérif** : typecheck ; aucun `process.env` direct.
4. [x] **Client HTTP Pennylane** `src/lib/pennylane/` — `listCustomers`, `listCustomerInvoices`,
       `getCustomerInvoiceFileUrl(id)` : `GET` seuls, base v2, Bearer, `X-Use-2026-API-Changes: true`,
       pagination `next_cursor`, délai d'attente, 429 → `retry-after` borné puis erreur typée
       (`PennylaneError` : `missing_key | unauthorized | unavailable | rate_limited`). Schémas Zod à **liste
       blanche** : client `{id, external_reference, name, reference}` ; facture `{id, status, draft, date,
       deadline, amount, currency, customer.id, public_file_url présent ou non}`. **Vérif** : tests avec
       `fetch` mocké (pagination, 429, 401, champs hors liste éliminés) ; **test de forme** : aucun champ
       `iban|mandate|card|bic|rum` dans les sorties ni les schémas (critère 10).
5. [x] **Règle pure de mappage** `mapPennylaneInvoices({customers, invoices, profilesByExternalRef})` →
       `{writes, skipped: {draft, creditNote, noCustomer, noDate, notEur, nonPositive, unmatched},
       unmatchedCustomers}` : rapprochement `customer.id → external_reference → fiche` (sans casse),
       `year` = année de `date`, `amount` décimal → centimes exacts. Règle pure `parseInvoiceTerrainLine(text)`
       → `{parcels[], meter} | null` sur `pdf_invoice_free_text` (formes relevées : `AH 6`, `AH 6-7`,
       `AH 6 B`, `AH 6-7-8`, `AH 6-AH 7`, compteur vide) et `compareTerrain(parsed, fiche à la date)` →
       écart ou non (ADR 062 §4, arbitrage « fiche + contrôle »). **Vérif** : tests unitaires (chaque motif
       d'écart, clé `external_reference` pinnée, `id` et `reference` jamais utilisés, chaque forme de ligne,
       ligne absente → aucun contrôle).
6. [x] **Service de synchronisation** `syncPennylaneInvoicesService(organizationId)` sous `withTenant` :
       relit tout ; en cas d'erreur réseau, n'écrit **aucune** facture et note l'échec dans
       `billing_sync_state` ; sinon upsert par `(organization_id, external_id)`, suppression des factures
       `pennylane` absentes de la relecture, `signalUnknownInvoiceStatuses` sur les statuts écrits, état
       mis à jour (compteurs, non-rapprochés, écarts de terrain). Le texte libre n'est ni stocké ni rendu. Repositories `getDb()`. **Vérif** : tests de service
       (succès, échec partiel sans écriture, suppression, clé absente, fournisseur `manual` → rien).
7. [x] **Fournisseur et planification** — `pennylaneMemberBillingProvider` (`canWrite: false`, lit
       `member_invoice`) ajouté à `PROVIDERS` ; tâche `billing.sync_pennylane` (gestionnaire branché au
       planificateur, reprogramme l'heure suivante, clé = heure visée) ; création de la tâche quand le
       réglage passe à `pennylane` ; action « Mettre à jour maintenant » (registre `member.invoice.manage`),
       qui lance la synchronisation et garantit la tâche. **Vérif** : tests du résolveur, du gestionnaire, de
       l'action (droits, bureau d'une autre association refusé).
8. [x] **Espace membre** — `MyInvoiceDTO` : `statusLabel`, `hasPdf`, `parcelNumbers[]` (parcelles de la fiche
       à la date d'émission pour `pennylane`, la parcelle pour `site`), `meterNumber`, identifiant opaque
       pour le PDF ; `MyInvoicesDTO` : `syncedAt`, `lastSyncFailed`, `unlinked` (Pennylane actif, aucune fiche
       du compte avec identifiant). Action `openMyInvoicePdfAction(invoiceId)` : la facture doit appartenir
       aux fiches du compte et être `pennylane` ; rend l'URL relue, jamais stockée. `my-invoices-card.tsx` :
       colonne « Facture », états 1a, 1d, 1e, 1f (design). Libellés `MemberSpacePage.invoices.*`.
       **Vérif** : tests de service (appartenance, autre membre refusé, URL non stockée), de l'action, du
       composant (bouton seulement si `hasPdf`, « PDF non disponible » sinon, aucune `<form>` ni champ de
       paiement).
9. [x] **Bureau — fiche** — carte « Facturation » avec « Identifiant client Pennylane » dans le formulaire
       de la fiche (validation existante, doublon → message « déjà porté par la fiche « … » ») ; alerte 2b
       sous Pennylane sans identifiant ; carte « Factures » sans « Ajouter » ni « Modifier » sous Pennylane,
       phrase de mise à jour. **Vérif** : tests du formulaire, de l'action, de la carte.
10. [x] **Bureau — réglages** — carte « Synchronisation Pennylane » après « Facturation », sous Pennylane
        seulement (dernière mise à jour ou échec avec motif, compteurs, fiches sans identifiant avec lien,
        clients sans fiche, **écarts de terrain** — facture, fiche liée, parcelle et compteur écrits sur la
        facture —, « Mettre à jour maintenant ») ; `docs/design-system.md` : gaps 1 à 3 du design
        versés au §3. **Vérif** : tests de la carte et de la page.
11. [x] **e2e** — sans jamais appeler Pennylane : faux serveur local ou fixtures injectées par le seed de
        test (le client HTTP lit une base d'URL configurable en test seulement, via `@/env`) ; parcours :
        synchronisation → le membre voit ses factures avec libellés, PDF disponible / non disponible ; fiche
        sans identifiant → message membre et liste du bureau ; bureau ne peut plus saisir ; accès croisé
        sur `billing_sync_state` et sur l'action PDF (facture d'une autre association introuvable). **Vérif** :
        suite e2e verte **en CI**.

## Files touched

- `src/db/models/member-invoice-model.ts`, `billing-sync-state-model.ts` (nouveau), `db.ts`,
  `drizzle/migrations/0069_*`, `0070_*` (+ `meta/`), tests de modèle, `src/db/rls-inventory.test.ts`
- `src/db/repositories/member-invoice-repository.ts`, `billing-sync-state-repository.ts` (nouveau)
- `src/lib/pennylane/**` (nouveau), `env.ts`, `env.example`
- `src/services/rules/member-invoice-rules.ts`, `rules/pennylane-invoice-mapping.ts` (nouveau)
- `src/services/billing/pennylane-member-billing-provider.ts` (nouveau), `resolve-member-billing-provider.ts`
- `src/services/pennylane-sync-service.ts` (nouveau) + façade/intercepteur, `member-space-service.ts`,
  `member-invoice-service.ts`, `scheduled-job-service` (gestionnaire), `scheduled-job-types.ts`
- `src/services/types/domain/association-settings-types.ts`, `member-space-types.ts`, `member-invoice-types.ts`
- `src/app/dal/*` concernés, actions de `/dashboard`, `/bureau/proprietaires/[id]`, `/bureau/reglages`
- `src/components/features/member-space/my-invoices-card.tsx`, `member-invoice/*`, `member-profile/*`
  (champ), `association/*` (carte de synchronisation)
- `messages/fr.json`, `docs/architecture.md`, `docs/design-system.md`, `e2e/*.spec.ts`, seed de test
- `docs/research/s20-*`, `docs/designs/s20-*`, `docs/plans/s20-*`, `docs/decisions/062-*` (dans le commit)

## Test strategy

- **Unitaires (`pnpm test --run`)** : client HTTP (fetch mocké), mappage pur (le cœur : clé de
  rapprochement, motifs d'écart, centimes), service de synchronisation (repositories mockés : succès, échec
  sans écriture, suppression, signalement des statuts), fournisseur, gestionnaire de tâche, actions (droits,
  appartenance), composants (bouton PDF, états), registre ; **test de forme** sans moyen de paiement.
- **e2e (CI)** : Pennylane simulé, jamais le vrai compte ; parcours membre et bureau ; isolation entre deux
  associations sur `billing_sync_state` et sur le PDF.
- Montage 9p : un timeout n'est jamais un vert ; valider sur une copie en disque local.

## Definition of Done

- Les dix critères couverts par au moins un test nommé ; critère 10 par un test de forme.
- Aucun appel réseau à l'affichage ; aucune URL de PDF stockée ou mise en cache ; aucun `withRlsBypass`.
- Aucune valeur de statut ni de libellé en dur (réglages) ; clé dans `@/env` seulement.
- Suite unitaire verte, e2e verts en CI, lint et typecheck propres ; une story = un commit (+ migration à
  part si utile), revue passée, PR ouverte.
- Rappel de déploiement : minuterie du planificateur installée, clé Pennylane en lecture seule.
