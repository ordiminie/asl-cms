---
validated: yes
---

# Plan — Story s21-redirection-paiement

Branch: `feature/s21-redirection-paiement`

Sources : `docs/research/s21-redirection-paiement.md`, `docs/designs/s21-redirection-paiement.md` (+ `.html`),
[ADR 063](../decisions/063-lien-de-paiement-par-facture.md). Appuis : ADR 010, 011, 059, 062.

## Target story

Payer sa facture : une facture impayée dont le fournisseur donne un lien `https` affiche « Payer » (lien
sortant, nouvel onglet) ; sans lien valable, « Par virement » et une phrase qui renvoie au bureau ; rien
pour une facture réglée ou « à classer ». Le lien vient du fournisseur, facture par facture ; le manuel
n'en donne aucun ; Pennylane n'en donne pas tant que l'API ne l'expose pas. Aucun formulaire ni champ de
moyen de paiement. Six critères, repris dans la recherche.

## Tasks (ordered)

1. [x] **Contrat** — `MemberInvoice.paymentUrl: string | null` (`member-invoice-types.ts`, commentaire de
       tête mis à jour : un lien sortant, jamais un moyen de paiement) ; `BoardInvoiceDTO` fondé sur
       `Omit<MemberInvoice, 'paymentUrl'>` et `toBoardInvoice` qui ne le recopie pas ; docstring du contrat
       (`member-billing-provider.ts`). **Vérif** : typecheck.
2. [x] **Fournisseurs** — `manualMemberBillingProvider` et `pennylaneMemberBillingProvider` renseignent
       chacun `paymentUrl: null` explicitement (pas dans `toMemberInvoice`) ; la docstring Pennylane dit
       pourquoi (aucun champ dans l'API v2, relevé du 19/11, ADR 063). Rien dans `pennylane-schemas.ts`,
       aucune colonne. **Vérif** : tests des deux fournisseurs (critère 2 : le manuel ne donne aucun lien).
3. [x] **Service** — `MyInvoiceDTO.payment: MyInvoicePayment | null` avec
       `MyInvoicePayment = {kind: 'link'; url: string} | {kind: 'transfer'}` (`member-space-types.ts`) ;
       `toMyInvoice` : lien si `statusClass === 'unpaid'` et `isHttpsUrl(paymentUrl)`, virement si impayée
       sans lien valable, `null` sinon. **Vérif** : tests de `member-space-invoices.test.ts` — impayée + https
       (lien), impayée sans lien, impayée + `http:` / `javascript:` / chaîne vide (virement, critère 6),
       réglée + lien et « à classer » + lien (`null`, critère 5).
4. [x] **Écran** — `my-invoices-card.tsx` : colonne « Règlement » (après « Statut ») rendue dès qu'une ligne
       a `payment` non nul ; `link` → `Button` `asChild` sur `<a target="_blank" rel="noopener noreferrer">`,
       icône `ExternalLink`, « Payer » (mobile : « Payer cette facture », pleine largeur 56 px, avant le PDF),
       nom accessible « Payer la facture {année}, {terrain} (s'ouvre dans un nouvel onglet) » ;
       `transfer` → « Par virement » `muted` (mobile : « À régler par virement. ») ; `null` → cellule vide.
       Phrase unique (alert neutre `Info`, fond `muted`, sous l'introduction) dès qu'une ligne est
       `transfer`, avec lien vers `/contact`. Libellés dans `messages/fr.json`
       (`MemberSpacePage.invoices.payment.*`, `columns.payment`). Docstring du composant mise à jour.
       **Vérif** : `my-invoices-card.test.tsx` — bouton = `<a>` vers l'URL exacte, `target`/`rel`, nom
       accessible ; virement sans `<a>` de paiement ; phrase présente une seule fois et absente sans
       `transfer` ; aucune colonne ni phrase quand aucune ligne n'est impayée ; aucun `<form>`, `<input>`
       ni champ de carte / IBAN dans la carte (critère 4, côté formulaire).
5. [x] **Garde de schéma** (critère 4, côté schéma) — test `src/db/no-payment-method-schema.test.ts` :
       parcourt toutes les tables `pgTable` exportées par `src/db/models/*` (`getTableConfig`) et refuse
       toute colonne dont le nom évoque un moyen de paiement (`iban|bic|card|pan|cvv|cvc|mandate|rum|
       payment_method|bank`) ; vérifie aussi que `member_invoice` n'a pas de colonne `payment_url`.
       **Vérif** : le test passe ; il échoue si on ajoute une colonne `iban` (vérifié puis retiré).
6. [x] **Design system** — §3.15 (ou §3.16 « Formes retenues par s21 ») : les trois gaps de la maquette
       (une action par colonne, mobile « Payer » puis PDF ; lien sortant en nouvel onglet annoncé +
       `ExternalLink` ajouté au §1.7 ; mention à la place d'une action). **Vérif** : relecture.
7. [x] **e2e** — `e2e/member-invoices.spec.ts` (fournisseur manuel, seed existant) : la facture impayée
       affiche « Par virement » et la phrase avec le lien Contact, sans lien « Payer » ; la facture réglée
       n'a ni l'un ni l'autre. **Vérif** : en CI (pas d'e2e en local).

## Files touched

- `src/services/types/domain/member-invoice-types.ts`, `member-space-types.ts`
- `src/services/billing/member-billing-provider.ts`, `manual-member-billing-provider.ts`,
  `pennylane-member-billing-provider.ts` (+ tests)
- `src/services/member-space-service.ts`, `src/services/member-invoice-service.ts`
- `src/services/__tests__/member-space-invoices.test.ts`
- `src/components/features/member-space/my-invoices-card.tsx` (+ test)
- `messages/fr.json`
- `src/db/no-payment-method-schema.test.ts` (nouveau)
- `e2e/member-invoices.spec.ts`
- `docs/design-system.md`, `docs/decisions/063-lien-de-paiement-par-facture.md`
- Story docs : recherche, design (`.md` + `.html`), plan

Aucune migration, aucune variable d'environnement, aucune dépendance.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : fournisseurs (lien nul), service (`toMyInvoice` : six cas du
  critère 5 et 6), composant (bouton, virement, phrase, absence de formulaire), garde de schéma Drizzle.
- **e2e (Playwright, en CI)** : mention de virement sur une facture impayée du seed, rien sur une réglée.
  Le bouton « Payer » n'a pas de source réelle : il n'est prouvé qu'en unitaire (ADR 063).
- Pas de test d'isolation RLS nouveau : aucune table ni lecture nouvelle (lecture de s19/s20 inchangée).

## Definition of Done

- Les six critères couverts par un test nommé d'après eux.
- Aucun lien non `https` rendu ; aucun formulaire ni colonne de moyen de paiement.
- `pnpm lint`, typecheck et `pnpm test --run` verts ; e2e verts en CI.
- Revue passée (`Ship allowed: yes`), une PR, un commit de story.
