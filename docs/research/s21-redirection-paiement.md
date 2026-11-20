# Research — Story s21-redirection-paiement

> 20/11/2026, orchestrateur. Exploration du code sur `main` (`2560a44c`, s20 mergée, PR 76).
> Remplace la recherche du 19/11, périmée par l'amendement de la story le même jour.

## Target story

**s21 — Payer sa facture.** En tant que membre propriétaire, je veux être redirigé vers la page de
paiement de ma facture afin de la régler sans quitter mon parcours. Complexité 2. Dépendances s02, s19,
s20. Réf. `V5 §5.3`, `CDCT §5.3`. **Amendée le 19/11/2026** : le lien vient de Pennylane, facture par
facture, quand l'association a activé le paiement en ligne ; sinon virement.

Critères :

1. Une facture impayée dont le fournisseur donne un lien de paiement affiche un bouton qui ouvre ce lien.
2. Le lien vient du fournisseur, facture par facture (contrat `MemberBillingProvider`), jamais d'une
   constante ni d'un réglage ; le fournisseur manuel (s19) n'en donne aucun.
3. Une facture impayée sans lien : aucun bouton ; une phrase dit que le règlement se fait par virement et
   renvoie au bureau.
4. Le parcours se réduit à un lien sortant : aucun formulaire de paiement rendu, aucun champ de moyen de
   paiement dans le schéma (test sur le formulaire et sur le schéma).
5. Une facture qui n'est pas « impayée » au sens du prédicat de s19 : ni bouton ni phrase de virement.
6. Un lien qui n'est pas une adresse `https` n'est jamais rendu : la facture se comporte comme sans lien.

Enjeu réglementaire (PRD angle n°4, `docs/prd.md:121`) : la frontière tient le projet hors DSP2/PCI.

## Current state of the code

- **Contrat** — `src/services/billing/member-billing-provider.ts` : `{id, canWrite, listInvoicesOf}`.
  Docstring : « Aucun moyen de paiement dans le contrat. » Deux implémentations, toutes deux lisent
  `member_invoice` sous `withTenant` et mappent par `toMemberInvoice`
  (`manual-member-billing-provider.ts:15`) :
  - `manualMemberBillingProvider` (`canWrite: true`) ;
  - `pennylaneMemberBillingProvider` (`canWrite: false`) — **aucun appel réseau à l'affichage**
    (critère 9 de s20) : il lit ce que la synchro planifiée a écrit.
- **Domaine** — `MemberInvoice` (`src/services/types/domain/member-invoice-types.ts:32`) : `hasPdf`, mais
  aucun champ de paiement (commentaire de tête : « le paiement (s21) sera une redirection »).
- **API Pennylane** — `src/lib/pennylane/pennylane-schemas.ts` : schémas Zod à **liste blanche**
  (ADR 062 §9) ; tout champ ajouté passe par la revue. `pennylaneInvoiceSchema` ne lit aucun champ de
  paiement — et l'API v2 n'en a pas (relevé du 19/11 sur 858 factures, `docs/stories.md` notes de s20).
  `public_file_url` est réduit à `hasPdf`.
- **Service** — `getMyInvoicesService` (`src/services/member-space-service.ts`), `toMyInvoice`
  (~l. 300) : compose `statusClass: classifyInvoiceStatus(invoice.status, classification)`, `hasPdf`,
  `pdfRef`. Le PDF se relit **au clic** par une action (`l. 451` : garde `isHttpsUrl`).
- **DTO** — `MyInvoiceDTO` / `MyInvoicesDTO` (`member-space-types.ts:106-140`) : rien sur le paiement.
- **Écran** — `src/components/features/member-space/my-invoices-card.tsx` (client) : tableau ≥ 640 px,
  colonne « Facture » (PDF) sous Pennylane seulement ; cartes empilées sous 640 px ; pied de carte
  « Une facture vous semble fausse ? Écrivez au bureau depuis la page Contact. » (`/contact`).
- **Prédicat** — `src/services/rules/member-invoice-rules.ts` : `classifyInvoiceStatus`, `isUnpaidInvoice`.
  ADR 059 : jamais d'interprétation d'un statut hors de ce module.

## Anchor points

- Contrat : un champ `paymentUrl: string | null` sur `MemberInvoice` (le lien, facture par facture),
  renseigné par chaque fournisseur. Manuel : `null` (critère 2). Pennylane : `null` tant que l'API n'expose
  aucun champ — sans colonne en base, sans URL construite (« Ne jamais construire soi-même une URL
  Pennylane à partir d'un identifiant », notes de la story).
- Service : `toMyInvoice` décide du règlement d'une ligne — lien si `statusClass === 'unpaid'` **et** lien
  `https` ; virement si impayée sans lien valable ; rien sinon. Exposé dans le DTO par ligne.
- Écran : bouton-lien sortant sur la ligne impayée avec lien ; mention de virement + renvoi au bureau sinon.
- Garde de schéma (critère 4) : test sur les tables Drizzle via `getTableConfig` (précédent :
  `src/db/billing-sync-state-model.test.ts:16`, « ni URL, ni moyen de paiement »).

## Verified APIs / functions

- `isHttpsUrl(value: string): boolean` — `src/lib/pennylane/pennylane-schemas.ts:26` (déjà importé par
  `member-space-service.ts:17`).
- `classifyInvoiceStatus(status, classification)` — `member-invoice-rules.ts:36`.
- `toMemberInvoice(row)` — `manual-member-billing-provider.ts:15`, partagé par les deux fournisseurs.
- `Button` (`@/components/ui/button`) : `asChild` pour un `<a>` stylé.
- `getTableConfig` (`drizzle-orm/pg-core`) : utilisé dans 10 tests de modèles (`src/db/*-model.test.ts`).
- Seed : `src/db/scripts/tenant-member-invoices-seed.ts` porte des factures impayées (`PENDING`,
  `REMINDED`), réglées et « à classer » → couverture e2e de la phrase de virement possible.

## Traps & constraints

1. **Aucune source réelle de lien aujourd'hui.** Ni l'API v2, ni les PDF (relevé du 19/11). Le bouton ne
   s'affiche donc chez aucune association en production : ses critères 1 et 6 se prouvent en unitaire
   (fournisseur simulé). En e2e, seule la phrase de virement est observable.
2. **Liste blanche Pennylane** : ne pas ajouter de champ « au cas où » à `pennylaneInvoiceSchema` ; un champ
   inventé serait une hallucination d'API.
3. **Pas de colonne** `payment_url` dans `member_invoice` : rien ne l'alimenterait, et le critère 4 interdit
   tout champ de moyen de paiement (un lien n'en est pas un, mais une colonne vide est du code mort).
4. **`javascript:` / `data:`** dans un `href` = injection : la garde `https` (critère 6) vit côté service,
   et le rendu ne relit que la valeur gardée.
5. **Prédicat unique** : afficher sur `statusClass === 'unpaid'`, jamais sur un libellé. « À classer »
   (`unclassified`) : rien (critère 5, comme s27).
6. **Lien sortant** : `rel="noopener noreferrer"` ; aucun paramètre ajouté à l'URL du fournisseur.
7. **« Une seule action par ligne »** (§2.1, tenue par le PDF en s20) : PDF + Payer = deux actions →
   manque du design system à déclarer (précédent ouvert : s48, §9).
8. **Colonne « Facture »** n'existe que sous Pennylane ; la phrase de virement doit aussi s'afficher sous
   le fournisseur manuel (s19, factures impayées saisies par le bureau).
9. **Tests existants** : `my-invoices-card.test.tsx:373` vérifie déjà l'absence d'IBAN / mandat / carte
   dans la carte ; `member-space-service` a ses tests de `toMyInvoice`. e2e : `member-invoices.spec.ts`,
   `pennylane-invoices.spec.ts` — e2e en CI seulement (machine trop juste).
10. **Textes** dans `messages/fr.json` (`MemberSpacePage.invoices`), jamais dans le code.

## Open questions

1. Où placer la mention de virement (par ligne, une fois dans la carte, ou les deux) — à trancher en
   design ; le critère 3 parle d'« une facture impayée sans lien » : la ligne doit porter l'information.
2. Même onglet ou nouvel onglet pour la page de paiement — à trancher en design (le PDF s'ouvre dans le
   même onglet ; une page externe à un autre site est un cas différent).
