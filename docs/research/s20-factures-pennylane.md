# Research — Story s20-factures-pennylane

> 19/11/2026, orchestrateur. Code sur `main` (`7c3a1e50`, s27 mergée). API Pennylane v2 relue en lecture
> seule les 18 et 19/11 avec le jeton du cabinet (`PENNYLANE_API_KEY`, `.env.local`, hors git) ; seuls des
> noms de champs et des comptes sont consignés ici, aucune donnée personnelle.

## Target story

**s20 — Remonter les factures depuis Pennylane.** En tant que membre propriétaire, je veux que mes
factures Pennylane apparaissent automatiquement, afin de ne pas dépendre d'une saisie manuelle du bureau.
Complexité 3. Dépendances s02, s19. Réf. `V5 §5.2`, `CDCT §5.2`, `Annexe A`.

Critères :

1. L'implémentation Pennylane s'active par configuration de tenant et remplace la saisie manuelle sans
   modification de l'interface membre.
2. Factures remontées avec leur statut Pennylane d'origine, statuts intermédiaires compris.
3. Un compte non rapproché est signalé au bureau plutôt que silencieusement vide.
4. Rapprochement par l'identifiant client Pennylane de la fiche (ADR 048) ; le bureau peut le renseigner
   sur une fiche créée à la main.
5. Brouillons jamais remontés ; avoirs traités explicitement (affichés comme tels ou écartés, choix
   consigné en recherche), jamais présentés comme une facture à payer.
6. Une facture remontée de Pennylane est en lecture seule sur le site (s19).
7. Quand l'API fournit un PDF, un bouton de téléchargement le sert au membre.
8. Sans PDF : la ligne dit que le PDF n'est pas disponible, sans bouton — jamais un lien mort.
9. Indisponibilité de l'API : dernières données connues + date de dernière synchronisation, sans page en
   erreur.
10. Schéma de facture et appels sortants sans aucun champ de moyen de paiement (carte, IBAN, mandat) —
    test sur la forme des données échangées.

## Relevé de l'API (v2, 18-19/11/2026)

- **Accès** : `GET /me`, `/customers`, `/customer_invoices` → 200. Base
  `https://app.pennylane.com/api/external/v2`, `Authorization: Bearer`, en-tête
  `X-Use-2026-API-Changes: true` (ancien comportement retiré le 01/07/2026). **25 requêtes / 5 s**, au-delà
  429 avec `retry-after` et `ratelimit-*`.
- **Volume** : 858 factures, 9 pages de 100 (`has_more`, `next_cursor`) ; 407 clients facturés ;
  factures par client : 1 (47), **2 (304)**, 3 (43), 4 (9), 5 (3), 7 (1). Années de `date` : 2024 (2),
  2025 (414), 2026 (440), vide (2) → une facture par client Pennylane et par an.
- **Domaine (précisé par l'utilisatrice le 19/11)** : un **terrain** = **1 compteur d'eau + au moins 1
  parcelle** ; une facture **par compteur** ; un client Pennylane (une référence client) **par terrain**.
  Deux parcelles qui partagent un compteur = un terrain, une facture ; deux terrains à compteurs distincts =
  deux clients Pennylane au nom du propriétaire, deux factures. Avec s53 (une fiche par client Pennylane),
  **fiche = terrain = compteur**.
- **Statuts** (7) : `paid` 733, `archived` 27, `partially_paid` 28, `late` 26, `incomplete` 22,
  `cancelled` 21, `credit_note` 1. Codes anglais.
- **`paid` (booléen) ne suit pas `status`** (34 `paid` à `false`, 19 `cancelled` à `true`) ;
  `remaining_amount_with_tax > 0` sur 75 `paid`. Seul `status` fait foi (ADR 011, ADR 059 §4).
- **Brouillons** : `draft = true` sur 3 factures (l'unique `credit_note`, 2 `archived`).
- **Avoirs** : `status = credit_note` (1) ; `credited_invoice` non nul sur 12 factures.
- **Champs utiles** : `id`, `invoice_number`, `date` (856/858), `deadline` (856/858), `amount`
  (chaîne décimale, euros), `currency`, `status`, `draft`, `customer {id, url}` (**absent sur 16**),
  `credited_invoice`, `public_file_url`, `filename`, `updated_at`.
- **PDF** : `public_file_url` renseigné sur les 858, forme `app.pennylane.com/public/invoice/pdf?…`,
  **expire au bout de 30 minutes** (doc) : à relire au clic (`GET /customer_invoices/{id}`), jamais stocké.
- **Terrain — corrigé le 19/11** (l'utilisatrice, sur 4 factures d'exemple) : la facture **nomme** son
  terrain, sur une ligne au-dessus du tableau : « Numero parcelle : <parcelle(s)> - Compteur : <compteur> -
  Index … - Consommation : … m3 ». Elle vient du champ **`pdf_invoice_free_text`** (texte libre), présent
  sur **401 / 437 factures 2026** et **0 / 414 factures 2025** (texte vide). Formes de la parcelle : une
  seule (`A 9`, 368), plusieurs en abrégé (`A 9-9`, 25), quelques formes isolées (`A 9 A`, `A 9-9-9`,
  `A 9-A 9`…). Sur 394 factures comparables, parcelle **et** compteur sont identiques à la « Référence
  Client » du client dans **386** cas (parcelle seule 387, compteur seul 389) — la référence dont l'import
  s13 a tiré les parcelles et le compteur de la fiche. Ni `custom_header_fields` ni `custom_fields` ne sont
  renseignés. Les lignes (`invoice_lines`, 1 ou 3 : cotisation, eau…) ne nomment pas la parcelle.
- **Clé de rapprochement — vérifiée le 19/11** : `member_profile.pennylane_customer_id` (l'« Identifiant
  Client » de l'export importé par s13) est un **UUID**, égal au champ **`external_reference`** du client de
  l'API — 413 / 413 identifiants de l'export s'y retrouvent, **0** dans `id` (entier). Or une facture ne porte
  que `customer {id, url}` : la synchronisation lit d'abord `/customers` (413 clients, 5 pages) pour
  construire `id → external_reference`, puis rattache. 386 `reference` distinctes pour 413 clients (28 vides) :
  la « Référence Client » n'est **pas** une clé.
- **Client** (`/customers`) : expose **`billing_iban`, `mandates`, `pro_account_mandates`** — moyens de
  paiement. Le site ne lit jamais `/customers` en entier dans un objet du domaine : liste blanche.
- **Lien de paiement** : aucun champ, aucun lien dans les PDF relus (voir s21).
- **Droits du jeton** : 30, presque tous en écriture. Besoin réel : `customers:readonly`,
  `customer_invoices:readonly`. Clé limitée à obtenir avant la production (`docs/stories.md`, dépendances
  externes).

## Current state of the code

- **Contrat** — `src/services/billing/member-billing-provider.ts` : `{id, canWrite, listInvoicesOf}` ;
  `resolve-member-billing-provider.ts` : `PROVIDERS = [manualMemberBillingProvider]`, défaut fermé (valeur
  sans implémentation → erreur).
- **Manuel** — `manual-member-billing-provider.ts` : lit `member_invoice` sous `withTenant`
  (`listInvoicesByProfileIdsDao`), `canWrite: true`, `toMemberInvoice` (sans `externalId`).
- **Modèle** — `src/db/models/member-invoice-model.ts` : `source` (`site | pennylane`, déjà prévu pour
  « écrite par la synchronisation (s20) »), `external_id` (unique par association), **`parcel_id` NOT NULL**
  (FK `RESTRICT`), `year`, `issued_on`, **`due_on` NOT NULL**, `amount_cents` (> 0), `status` opaque.
  Écriture de s19 : propriétaire à la date d'émission vérifié (`getParcelOwnerAtService`, ADR 059 §3).
- **Statut inconnu** — `signalUnknownInvoiceStatuses` (ADR 059 §5) : toute écriture d'une implémentation
  doit y passer ; un email par statut nouveau.
- **Fiche** — `member_profile.pennylane_customer_id` (texte, unique par association quand non nul, ADR 048,
  posé par l'import s13). Validation `member-profile-validation.ts:97,142`. **Le formulaire du bureau ne
  l'expose pas** (aucun composant ne le rend) → critère 4 à construire.
- **Réglage** — `billing.provider` (`choice`, option unique `manual`, `editableBy: 'super_admin'`).
- **Planificateur** — table `scheduled_job` + `runDueScheduledJobsService` (`scheduled-job-service.ts`),
  gestionnaires par `kind` (`campaign.deliver_part`, `email.deliver_deferred`), script
  `src/db/scripts/run-scheduled-jobs.ts` lancé toutes les 5 min par `asl-cms-planificateur.timer` (ADR 006).
  ⚠️ La minuterie n'est pas encore installée sur le VPS (rappel s26).
- **Écrans** — membre : `my-invoices-card.tsx` (s19, « aucune action par ligne ») ; bureau :
  `member-invoices-card.tsx` et `member-invoice-read-only.tsx` (lecture seule déjà prévue pour `source
  = pennylane`).
- **Secrets** — `env.ts` ne déclare pas encore `PENNYLANE_API_KEY`.

## Anchor points

- `pennylaneMemberBillingProvider` (`src/services/billing/pennylane-member-billing-provider.ts`) :
  `canWrite: false`, `listInvoicesOf` = lecture de `member_invoice` (les factures synchronisées), jamais un
  appel réseau à l'affichage (critère 9).
- Synchronisation : nouveau `kind` `billing.sync_pennylane` (tâche planifiée qui se reprogramme),
  client HTTP fonctionnel dans `src/lib/pennylane/` (pagination, 429, en-tête 2026, **liste blanche** des
  champs lus), upsert par `(organization_id, external_id)` avec `source = pennylane`, passage par
  `signalUnknownInvoiceStatuses`.
- Horodatage de dernière synchronisation par association (et résultat : rapprochés, non rapprochés).
- PDF : action serveur (ou route) qui relit `public_file_url` à la demande et redirige ; aucun stockage.
- Bureau : champ « Identifiant client Pennylane » sur la fiche ; signalement des non-rapprochés.
- `billing.provider` : option `pennylane` ; `env.ts` : `PENNYLANE_API_KEY` (serveur, facultatif).

## Verified APIs / functions

- `resolveMemberBillingProvider(settings)` — `resolve-member-billing-provider.ts:20`.
- `listInvoicesByProfileIdsDao(memberProfileIds)` — `member-invoice-repository.ts`.
- `signalUnknownInvoiceStatuses` — ADR 059 §5 (service s19).
- `runDueScheduledJobsService({handlers, now, organizationId?})` — `scheduled-job-service.ts:119`.
- `withTenant`, `getDb()` ; aucun `withRlsBypass` nécessaire : la tâche s'exécute par association.

## Traps & constraints

1. **`parcel_id` NOT NULL + contrôle du propriétaire** : une facture Pennylane ne nomme pas de parcelle,
   et un terrain peut en compter deux (un compteur commun). Le terrain se déduit de la fiche rattachée :
   ses parcelles **à la date d'émission** (propriété datée), et son compteur. `parcel_id` devient
   facultatif pour `source = pennylane` (obligatoire pour `site`) ; l'ADR 059 §3 (« terrain déduit de la
   fiche seule » rejeté) visait une fiche à plusieurs terrains, cas que le modèle s53 a supprimé. Nouvel
   ADR.
2. **`due_on` NOT NULL** et **`date`** : 2 factures sans `date` ni `deadline`. Règle à fixer (écartées et
   signalées, ou échéance = émission).
3. **Statuts en anglais** (`late`, `partially_paid`…) : **arbitré le 19/11** — réglage de libellés
   « statut = libellé », une ligne par statut, repli sur le statut brut ; le statut reste transporté tel
   quel (ADR 011) et seul lui sert au classement.
4. **Avoirs** : **arbitré le 19/11** — écartés de la synchronisation (`status = credit_note`, comme les
   brouillons) ; la facture créditée garde son propre statut.
5. **`customer` absent sur 16 factures** : non rapprochables, à compter dans le rapport.
5b. **Rapprochement par `external_reference`**, jamais par `id` ni par `reference` (voir relevé) : un test
    pinne le champ.
6. **Moyens de paiement dans `/customers`** (`billing_iban`, `mandates`) : le client HTTP ne type et ne
   renvoie que les champs listés ; test de forme (critère 10).
7. **URL de PDF expirante** (30 min) : ne jamais la stocker, ni la mettre en cache (`'use cache'` interdit).
8. **Pas d'appel réseau à l'affichage** : le critère 9 l'impose ; l'espace membre lit la base.
9. **Débit** : 25 req / 5 s ; 9 pages suffisent pour tout relire. Une synchronisation complète par passage
   reste sous la limite ; gérer 429 (`retry-after`).
10. **Saisie manuelle « remplacée »** (critère 1) : `canWrite: false` sous Pennylane. Les factures `site`
    déjà saisies restent lues (même table), en lecture seule. Le bureau ne peut plus en créer.
11. **Changement de fournisseur** : `billing.provider` est réservé au SuperAdmin ; passer à `pennylane`
    sans clé configurée doit échouer clairement (défaut fermé), pas vider l'espace.
12. **Secret** : la clé vit dans `@/env`, jamais en base ni côté navigateur. Une clé **par association**
    (multi-tenant) n'existe pas encore : avec un seul client, une clé globale ; à rouvrir au deuxième
    client (cf. Brevo).
13. **Tests** : pas de réseau en unitaire (client HTTP mocké) ; pas d'appel Pennylane en CI : l'e2e simule
    la source (fixture ou faux serveur), jamais le vrai compte.
14. **Minuterie absente du VPS** : sans elle, aucune synchronisation en production. À installer au
    prochain déploiement.
15. **Présentation** : notes agentiques — « si cette story touche à la présentation, le découpage a
    échoué ». Or les critères 3, 4, 7, 8, 9 ajoutent des éléments d'écran (bouton PDF, date de
    synchronisation, champ de la fiche, signalement). Ce sont des ajouts, pas une refonte : design requis.

## Open questions

1. ~~Terrain d'une facture Pennylane~~ — réglé par le domaine (piège 1).
2. ~~Libellés des statuts~~ — arbitré : réglage de libellés.
3. ~~Avoirs~~ — arbitré : écartés.
4. **Fréquence de synchronisation** — technique : toutes les heures (proposé au plan).
5. **Factures sans date ni échéance** — technique : écartées de la synchronisation et comptées dans le
   rapport du bureau (proposé au plan).
6. **Forme du signalement des non-rapprochés** (critère 3) — en design : carte « Synchronisation
   Pennylane » côté bureau (dernière synchro, fiches sans identifiant, clients Pennylane sans fiche).

Sources : [Rate limiting v2](https://pennylane.readme.io/docs/rate-limiting-1),
[2026 API changes](https://pennylane.readme.io/docs/2026-api-changes-guide),
[Get a customer invoice](https://pennylane.readme.io/v2.0/reference/getcustomerinvoice).
