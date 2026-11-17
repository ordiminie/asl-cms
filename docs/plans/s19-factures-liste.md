---
validated: yes
---

# Plan — Story s19-factures-liste

Branch: `feature/s19-factures-liste`

Sources : `docs/research/s19-factures-liste.md` (mise à jour du 17/11), `docs/designs/s19-factures-liste.md`
(+ `.html`), [ADR 059](../decisions/059-factures-membres-modele-et-contrat-de-facturation.md), ADR 010, 011, 016,
029, 053, 054.

## Target story

Un membre voit la liste de ses factures et leur statut ; le bureau les saisit à la main derrière le contrat
`MemberBillingProvider` (implémentation `manuel`), Pennylane étant s20.

1. Factures du membre (date, objet, montant, statut), date décroissante ; tous ses terrains au même endroit,
   chacune avec son terrain (parcelle et compteur).
2. Statut affiché tel que fourni, jamais réduit à payé/impayé.
3. Date d'échéance distincte de l'émission.
4. Objet = texte standard composé par le site (nature et année), paramètre de tenant.
5. Le tenant désigne les statuts « impayé » ; prédicat lisible et testable.
6. Statut jamais vu : pas réputé réglé, signalé par email au destinataire paramétré, hors relances.
7. Aucune facture d'un autre membre, identifiant forgé compris.
8. Rattachement au membre facturé ; parcelle vendue : avant la vente au vendeur seul, après à l'acquéreur seul.
9. Saisie et mise à jour par le bureau (action au registre) ; source portée ; Pennylane en lecture seule,
   refusée en interface **et** côté serveur. Pas d'historique.
10. Interface interchangeable, prouvée par un test doublant l'implémentation.

**Arbitrages du 17/11/2026** (AskUserQuestion, tous sur la recommandation) : classement par **deux réglages
texte multilignes** modifiables par le bureau (statut affiché brut, libellés reportés à s20) ; email **une fois
par statut** inconnu ; la facture porte la **parcelle facturée**, vérifiée par lecture datée ; objet = **modèle
de tenant** « … {année} ».

Décidé au design / au plan (ADR 059) : carte sur `/dashboard`, pas de sous-page ; saisie sur une page du
bureau ; « Ajouter une facture » absent quand le fournisseur actif ne permet pas l'écriture (s20 critère 1) ;
montant en centimes ; statuts de saisie = union des deux listes ; nature d'email `board_notification`.

## Tasks (ordered)

1. [x] **Règles pures + réglages** — `src/services/rules/member-invoice-rules.ts` (+ `.test.ts`) :
       `parseStatusList(text)` (une valeur par ligne, bords supprimés, lignes vides ignorées, doublons retirés),
       `classifyInvoiceStatus(status, {unpaid, settled})`, `isUnpaidInvoice`, `composeInvoiceSubject(template,
       year)`, `formatAmountCents` / `parseAmountToCents` (« 412,50 » ↔ 41250, refus ≤ 0 et > 2 décimales).
       Registre `ASSOCIATION_SETTINGS_REGISTRY` : `billing.provider` (`choice`, option `manual`, défaut `manual`,
       `editableBy: 'super_admin'`), `billing.invoice_subject` (`text`, requis, défaut « Facture {année} »),
       `billing.unpaid_statuses` et `billing.settled_statuses` (`text` multilignes, facultatifs, vides),
       `billing.alert_email` (`email`, défaut `{fromKey: CONTACT_EMAIL_SETTING_KEY}`), dans une carte
       « Factures » de la page `settings`. Refus à l'enregistrement d'un statut présent dans les deux listes
       (contrôle croisé dans `updateAssociationSettingsService`, message dans `messages/fr.json`). Seed du premier
       tenant : objet « Cotisation et eau {année} » seulement, **aucun statut** (`tenant-settings-seed.ts`).
       **Vérif** : tests des règles (statut inconnu → `unclassified`, jamais `settled` ; casse respectée) ; tests
       épinglés du registre mis à jour (`association-settings-test-registry.ts`, `tenant-settings-seed.test.ts`,
       `association-settings-dal.test.ts`, formulaire) et verts.
2. [x] **Modèles, migrations, RLS** — `src/db/models/member-invoice-model.ts` (`member_invoice` et
       `invoice_status_alert`, ADR 059 §1 et §5, `pgEnum` `member_invoice_source`), ajoutés à `db.ts` ;
       `pnpm db:generate`, puis `drizzle-kit generate --custom` pour `ENABLE` + `FORCE ROW LEVEL SECURITY` et la
       policy `tenant_isolation` des deux tables (patron des migrations RLS existantes). `docs/architecture.md` :
       les deux tables dans l'inventaire, la ligne Pennylane de l. 446 (« Bloque s20 » → levée le 15/11).
       **Vérif** : `pnpm db:generate` sans diff ; `file-key-inventory.test.ts` vert ; typecheck.
3. [x] **Repository** — `src/db/repositories/member-invoice-repository.ts` via `getDb()` :
       `listInvoicesByProfileIdsDao(profileIds)` (jointure `parcel` pour numéro et compteur, tri `issued_on`
       décroissant puis `created_at`), `getInvoiceByIdDao(id)`, `createInvoiceDao`, `updateSiteInvoiceDao(id, …)`
       (`WHERE source = 'site'`, rend le nombre de lignes), `claimStatusAlertDao(status)` /
       `releaseStatusAlertDao(status)` (`INSERT … ON CONFLICT DO NOTHING RETURNING`), `listInvoicesByMemberDao`.
       **Vérif** : tests unitaires avec `getDb` mocké sur la forme des appels (le comportement réel est couvert par
       l'e2e, tâche 10).
4. [x] **Contrat `MemberBillingProvider` et implémentation manuelle** — `src/services/billing/` :
       `member-billing-provider.ts` (type du contrat, `MemberInvoice` domaine dans
       `src/services/types/domain/member-invoice-types.ts`, **aucun champ de paiement**),
       `manual-member-billing-provider.ts` (lit le repository, `canWrite: true`),
       `resolve-member-billing-provider.ts` (depuis `billing.provider`, défaut fermé : valeur inconnue → erreur
       explicite). **Vérif** : critère 10 — test qui injecte un fournisseur double et montre que le service membre
       (tâche 5) et la carte (tâche 8) rendent ses factures sans changement ; test du résolveur.
5. [x] **Lecture membre** — `getMyInvoicesService(organizationId)` dans `member-space-service.ts` (patron
       `getMyLandsService`) : session → `getMyMemberProfiles` → fournisseur résolu → `listInvoicesOf` → DTO
       `MyInvoiceDTO` (date, objet composé, terrain = parcelle + compteur + nom de fiche s'il diffère du compte,
       montant, échéance, statut brut, classe) trié par émission décroissante ; aucun identifiant en entrée.
       Façade + intercepteur (`shouldLogDetails: () => false`), DAL `getMyInvoicesDal` dans `member-space-dal.ts`
       **sans `'use cache'`**. **Vérif** : tests du service — compte à trois fiches (critère 1), statut brut
       conservé (2), échéance (3), objet composé et jamais le libellé source (4), classe `unclassified` (6),
       sans session → `AuthorizationError`, compte sans fiche → `undefined`, aucune fiche d'autrui demandée (7).
6. [x] **Écriture bureau** — `ActionIdConst.INVOICE_MANAGE: 'member.invoice.manage'` (`defaultRoles: ['owner',
       'board']`, + test du registre) ; `src/services/member-invoice-service.ts` : `listMemberInvoicesService`,
       `getMemberInvoiceService`, `createMemberInvoiceService`, `updateMemberInvoiceService`. Ordre : Zod (montant,
       année, dates, `due_on >= issued_on`) → `canPerformAction` → fournisseur `canWrite` → statut dans l'union des
       listes → `getParcelOwnerAtService(org, parcelId, issuedOn)` = fiche facturée (piège : ce service exige aussi
       `MEMBER_PROFILE_MANAGE` — vérifier l'interaction, refus explicite sinon) → écriture → signalement (tâche 7).
       Mise à jour d'une facture `pennylane` → `AuthorizationError` dédiée, **même si l'appel vient en direct**
       (critère 9). Façade + intercepteur. **Vérif** : tests par rôle (Bureau, Président(e), membre simple refusé,
       autre tenant), facture Pennylane refusée, parcelle d'un autre propriétaire à la date refusée, statut hors
       configuration refusé, échéance antérieure refusée.
7. [x] **Signalement d’un statut inconnu** — `signalUnknownInvoiceStatuses(organizationId, statuses)` (service
       exporté, réutilisé par s20) : pour chaque statut `unclassified`, `claimStatusAlertDao` ; s'il est réclamé,
       `sendInvoiceStatusAlertEmailService` dans `email-service.ts` (contexte `{scope: 'tenant', nature:
       'board_notification', reference: {type: 'invoice_status', id: <alerte>}}`, `recipientType: 'system'`,
       destinataire `billing.alert_email`, gabarit React Email des notifications au bureau + texte brut, design
       écran 4 : statut, nombre de factures, lien vers les réglages, **aucun nom ni montant**) ; échec d'envoi →
       `releaseStatusAlertDao`, journal sans contenu, l'écriture réussit. **Vérif** : premier passage → un envoi ;
       second passage → aucun ; échec → libéré puis renvoyé au passage suivant ; statut classé → aucun envoi ;
       budget épuisé → reporté (pas d'échec).
8. [x] **Écran membre** — `my-invoices-card.tsx` dans `src/components/features/member-space/`, monté dans
       `MemberSpace` après « Mes terrains », derrière `<Suspense>` avec `skeleton` (design écran 1) : `table` +
       cartes empilées sous 640 px, `badge` selon la classe (§3.10), montants et dates en `data`, vide 1b, pied
       vers Contact, pagination au-delà de 25 / 10. Libellés dans `messages/fr.json`. **Vérif** : tests jsdom —
       ordre, colonnes, terrain et compteur, statut brut écrit, variante de badge par classe, vide, singulier /
       pluriel, aucun identifiant dans le DOM.
9. [x] **Écrans bureau** — carte « Factures » sur `bureau/proprietaires/[id]/page.tsx` (écran 2 : Source,
       « Modifier » seulement pour `site`, « Ajouter une facture » seulement si `canWrite`, vide) ; pages
       `factures/nouvelle` et `factures/[invoiceId]` (écran 3 : RHF + Zod partagé client/serveur, aperçu de
       l'objet, champ date §3.9, `select` des parcelles et des statuts ; facture Pennylane = lecture + alerte
       neutre, aucun formulaire) ; Server Actions dans `actions.ts` (`requireActionAuth`, `getTranslations`,
       `revalidatePath`), refus serveur affiché en `alert` destructive (3d). **Vérif** : tests des actions (refus
       Pennylane en appel direct, erreurs de validation traduites), tests jsdom des pages (Modifier absent pour
       Pennylane, bouton absent si `canWrite` faux).
10. [x] **Seed + e2e** — module `tenant-member-invoices-seed.ts` appelé par `seed.ts` (deux tenants) : factures
        `site` et `pennylane`, une facture à statut non classé, et sur une **parcelle vendue** une facture d'avant la
        vente (vendeur) et une d'après (acquéreur) ; réglages de démo du seed de développement seulement. Spec
        `e2e/member-invoices.spec.ts` : membre voit ses factures triées avec terrain (1) ; vendeur/acquéreur (8) ;
        accès croisé — membre de l'autre tenant et identifiant forgé sur la page bureau → rien / refus (7) ;
        bureau ajoute une facture, le membre la voit (9) ; facture Pennylane sans formulaire et POST direct refusé
        (9) ; `tenant-isolation.spec.ts` étendu à `member_invoice`. **Vérif** : `pnpm test --run` vert localement
        (copie sur disque local si le 9p coupe les workers) ; e2e en CI sur la PR.

## Files touched

- `src/services/rules/member-invoice-rules.ts` (+ test)
- `src/services/types/domain/association-settings-types.ts`, `action-registry-types.ts`, `member-invoice-types.ts`
- `src/services/association-settings-service.ts` (contrôle croisé), `src/db/scripts/tenant-settings-seed.ts`
- `src/db/models/member-invoice-model.ts`, `src/db/models/db.ts`, `drizzle/migrations/0063…`, `0064…` (custom RLS)
- `src/db/repositories/member-invoice-repository.ts`
- `src/services/billing/*`, `src/services/member-invoice-service.ts`, `src/services/member-space-service.ts`,
  `src/services/email-service.ts` + gabarit `src/lib/emails/…`
- `src/services/facades/*` + intercepteurs, `src/app/dal/member-space-dal.ts`, DAL bureau des factures
- `src/components/features/member-space/my-invoices-card.tsx`, `member-space.tsx`
- `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`, `actions.ts`, `factures/**`
- `src/components/features/member-invoice/*` (formulaire, carte bureau, validation partagée)
- `messages/fr.json`, `src/db/scripts/seed.ts`, `tenant-member-invoices-seed.ts`
- `e2e/member-invoices.spec.ts`, `e2e/tenant-isolation.spec.ts`
- `docs/architecture.md` (tables, ligne Pennylane)

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : règles pures exhaustives (classement trois états, objet, montant) ;
  services avec repositories mockés — lecture membre multi-fiches, écriture par rôle, refus Pennylane, parcelle à
  la date, signalement une fois ; fournisseur double (critère 10) ; registres ; composants jsdom.
- **E2E (Playwright, en CI)** : isolation RLS entre tenants, accès croisé forgé, parcelle vendue réelle,
  saisie bureau → membre, refus serveur Pennylane.
- Pas de build ni d'e2e en local (machine trop juste).

## Definition of Done

- Un PR, un commit de story (+ un commit séparé pour les migrations si utile), recherche, design, plan, ADR 059
  et revue dans la branche.
- Les dix critères couverts par au moins un test nommé ; `pnpm lint`, typecheck, `pnpm test --run` verts ;
  e2e verts en CI.
- Aucune valeur de statut dans le code ni dans la configuration livrée ; aucun champ de paiement ; rien de
  nominatif dans les journaux.
- Revue `/ks-review` passée (`Ship allowed: yes`).

## Correctifs de revue (tour 1, arbitrés le 17/11 : corriger avant la PR)

- [x] **M1** — Poser une ligne `invoice_status_alert` par tenant (seed ou insertion `asMaintenance` dans la
  spec), puis trois tests e2e d'accès croisé comme pour `member_invoice` : hors scope → 0 ; scope A ne voit
  pas l'alerte de B ; insertion `organization_id = B` sous le scope A → refus `row-level security`.
- [x] **m1** — `member-invoice-dal.ts` : identifiant de facture malformé → `undefined` → 404, comme
  `getMemberProfileForBureauDal` ; test de page.
- [x] **m2** — `'invoice_status'` dans `REFERENCE_TYPES` (`email-budget-rules.ts`) + branche `pendingTexts`
  (« Statut de facture à classer », lien `/bureau/reglages`) + libellés `fr.json` ; test.
- [x] **m4** — Aligner le commentaire et `cleanUpRun` de `e2e/member-invoices.spec.ts` sur ce qui est
  réellement nettoyé (alertes comprises si M1 en crée).

## Correctif CI (PR 73, 17/11)

- [x] **CI-1** — `e2e/association-settings.spec.ts:249` (s02, critère 6) attend que le tenant B ne stocke que
  `contact.email` ; le seed de démonstration de s19 (`TEST_INVOICE_DEMO_SETTINGS`) lui ajoute
  `billing.unpaid_statuses` et `billing.settled_statuses`. Garder le seed (utilisé par `member-invoices.spec.ts`)
  et faire dériver l'attente exacte du jeu seedé (contact + lignes de démonstration de B importées du module de
  seed), sans recopier de valeur de statut en dur. Vérifier aucune autre spec n'affirme le jeu exact des
  réglages d'un tenant.
