---
validated: yes
---

# Plan — Story s28-publipostage-pdf

Branch: `feature/s28-publipostage-pdf`

Sources : `docs/research/s28-publipostage-pdf.md`, `docs/designs/s28-publipostage-pdf.md` (+ `.html`),
ADR 065 (fiches figées), ADR 066 (pdfkit), ADR 067 (adresse et calage).

## Target story

**En tant que** membre du bureau **je veux** produire un PDF prêt à imprimer pour les membres sans
email **afin qu'**ils reçoivent la même information que les autres, sans double saisie.

1. Depuis une campagne, un PDF unique, un courrier par fiche sans adresse email de la cible.
2. Homonymes (même nom, même domicile) signalés avant la génération ; le bureau choisit de les
   regrouper ou non. Rien d'office.
3. Variables du destinataire (nom, entreprise, adresse, parcelle, date) issues du contenu de l'email.
4. A4, un courrier par page, bloc adresse pour enveloppe DL fenêtre gauche — **test sur les
   coordonnées du bloc dans le PDF généré**.
5. Aucune fiche sans email dans la cible → « pas de courrier à produire », pas de PDF vide.
6. Complétude : email ∪ courrier = toute la cible, sans intersection ni oubli. **Écrit en premier.**

Arbitrages du 20/11/2026 : pas de campagne « courrier seul » dans s28 ; fiche sans domicile → lettre au
terrain, sinon au nom seul, signalée ; page de calage téléchargeable à part + décalage réglable.

## Tasks (ordered)

1. [x] **Règles pures — canaux, adresse, homonymes** (critère 6 d'abord). Dans
   `src/services/rules/campaign-letter-rules.ts` :
   - `campaignChannelsOf(rows, isTargeted, nature)` → `{emailProfileIds, letterProfileIds,
     refusedProfileIds}` à partir des mêmes lignes que `computeCampaignTarget` ; tests de partition :
     union = fiches ciblées, intersections vides, pour les trois cibles et les deux natures (une fiche
     dont toutes les adresses sont désinscrites en facultatif est `refused`, jamais `letter`) ;
     `computeCampaignTarget` expose les **ids** des fiches sans email (le décompte en dérive).
   - `letterAddressLinesOf(profile)` (ADR 067 §1-2) : domicile → terrain → nom seul, 4 lignes au plus,
     entreprise omise si égale au nom, complément fusionné si dépassement ; `source: 'home' | 'land' |
     'name_only'`.
   - `sameNameAndHomeKeyOf(name, homeAddressLine, homePostalCode)` extraite de
     `src/lib/import/pennylane-clients-mapper.ts:287` (déplacée dans `src/services/rules/`, l'import
     l'appelle) + `homonymGroupsOf(profiles)` ; les tests du mapper restent verts sans changement.
   - `lettersOf(profiles, grouping, parcels)` : une lettre par fiche ou par groupe d'homonymes,
     parcelles en ordre numérique (`joinParcelNumbers`), **triées par nom** (§6.3).
2. [x] **Modèle `campaign_letter_profile`** (ADR 065) dans `src/db/models/campaign-model.ts`, ajouté au
   schéma de `db.ts` ; migration générée par `pnpm db:generate`, puis policy RLS forcée par
   `drizzle-kit generate --custom` sur le patron de `0068_campaign_recipient_profile_rls.sql` ; jamais
   de SQL ni de journal écrits à la main. Test de modèle (`src/db/campaign-model.test.ts`) : colonnes,
   clé primaire, `CASCADE`. `docs/architecture.md` : table classée, compte des tables sous RLS.
3. [x] **Figer à la création** — `getCampaignTargetRowsDao` sélectionne en plus `home_*`, `land_*`,
   `company_name` ; `createCampaignWithRecipientsTxnDao` reçoit `letterProfileIds` et les écrit dans la
   même transaction ; `sendCampaignService` les passe depuis `campaignChannelsOf` (le
   `withoutEmailCount` en reste égal au nombre de lignes figées). Tests repository (appel d'insertion,
   transaction) et service (ids transmis, cible de groupe et d'impayés, `no_recipient` inchangé quand
   aucune adresse email). Aucun changement de comportement d'envoi.
4. [x] **Réglages de calage** (ADR 067 §4) — deux définitions `number` dans le registre
   (`src/services/types/domain/association-settings-types.ts`, patron `campaign.daily_send_cap`) :
   `letter.address_offset_x_mm`, `letter.address_offset_y_mm`, `min: -10`, `max: 10`, `integer`,
   défaut `0`, unité « mm », carte « Courrier » ; getters `getLetterAddressOffset(settings)` ;
   libellés, aides et erreurs dans `messages/fr.json`. Tests : défaut, bornes refusées (`belowMin`,
   `aboveMax`), valeur lue. Valeurs de seed du premier tenant : 0 (rien en dur, ADR 010).
5. [x] **Moteur PDF** (ADR 066) — dépendances `pdfkit` (+ `@types/pdfkit`) et `pdfjs-dist` (dev) par
   `pnpm add` ; module `src/lib/letters/` : `letter-geometry.ts` (constantes §6.1 en mm, conversion en
   points, application du décalage au seul cadre d'adresse), `render-letter-body.ts` (mdast remark +
   schéma restreint → blocs, substitution dans les nœuds texte, liens en clair),
   `render-letters-pdf.ts` (lettres → `Buffer` : en-tête monogramme noir sur blanc + nom, adresse,
   date en clair, objet 13 pt / 600, corps 12,5 pt / 1,7, pied « Courrier envoyé par voie postale,
   faute d'adresse email connue. » + mentions légales) et `render-calibration-pdf.ts`. Vérifier dans
   `node_modules/next/dist/docs/` s'il faut `serverExternalPackages`. **Tests (Vitest `node`, relus
   par `pdfjs-dist`)** : format A4, une page par lettre, première ligne d'adresse dans le cadre
   x 25-115 mm · y 50-75 mm (et décalée exactement du réglage), 4 lignes au plus, une valeur
   `**gras**` substituée reste littérale, aucun texte de désinscription.
6. [x] **Service du courrier** — `src/services/campaign-letter-service.ts` + façade
   `src/services/facades/campaign-letter-service-facade.ts` + intercepteur sans détails (données
   personnelles). Chaque fonction : Zod → `campaign.manage` → `withTenant` :
   - `getCampaignLetterContextService(orgId, campaignId)` → `not_found` | `legacy` (ADR 065 §4) |
     `none` (critère 5) | `ready` avec décomptes, groupes d'homonymes, lettres au terrain, au nom seul ;
   - `generateCampaignLettersService(orgId, campaignId, grouping | null)` → `grouping_required` si des
     homonymes existent sans choix, sinon le PDF (date = `campaign.sendDate`, contenu figé de la
     campagne, parcelles actuelles) ;
   - `getLetterCalibrationPdfService(orgId)`.
   Partage de `readTarget` inutile (ensemble figé). Tests par rôle (invité, membre, bureau,
   SuperAdmin), campagne d'une autre association = `not_found` sans lecture, `legacy`, `none`, les
   deux regroupements, la date et le contenu de la campagne.
7. [x] **Routes de téléchargement** (règle `rule-api-routes`, modèle `api/identity/[kind]`) —
   `src/app/api/campaigns/[id]/courrier/route.ts` (`GET ?lettres=par-personne|par-terrain`) et
   `src/app/api/campaigns/calage/route.ts` : tenant du domaine appelé, `application/pdf`,
   `Content-Disposition: attachment` avec un nom sans donnée nominative (`courrier-<jj-mm-aaaa>.pdf`),
   `Cache-Control: no-store`, `nosniff` ; 403 / 404 / 409 (`grouping_required`) / 422 (`none`,
   `legacy`) sans détail. `route.test.ts` pour chaque statut.
8. [x] **Carte « Courrier postal »** (design s28, composants du socle seulement) — DAL
   `getCampaignLetterContextDal` (par utilisateur : pas de cache, derrière le `Suspense` existant),
   `CampaignLetterCard` dans `campaign-detail.tsx` après « Destinataires » ; partie client
   `campaign-letter-download.tsx` (`RadioGroup` sans valeur par défaut, `Button` `default` + `outline`
   calage, `fetch` → blob → téléchargement) ; états vide, `legacy`, chargement, choix manquant (résumé
   ancré + erreur de champ + focus), erreur, succès ; libellés `CampaignsBureau.letters.*` dans
   `messages/fr.json`. Tests jsdom de chaque état et de la page `[id]/page.test.tsx`.
9. [x] **Seed, e2e, docs** — seed TechCorp (`tenant-member-profiles-seed.ts`) : deux fiches sans
   email de même nom et même domicile sur deux parcelles (en vérifiant les décomptes attendus par
   `e2e/campaigns.spec.ts` et `recipient-groups.spec.ts`) ; e2e `e2e/campaign-letters.spec.ts` :
   campagne créée, carte visible, homonymes signalés, choix obligatoire, PDF téléchargé (type,
   nombre de pages), page de calage, **complétude en base** (`campaign_recipient_profile` ∪
   `campaign_letter_profile` = fiches ciblées, intersection vide), **accès croisé** : la route d'une
   campagne d'une autre association rend 404. Docs : `docs/design-system.md` (§6.1 calage et
   décalage, §3.x carte courrier et `radio-group` sans défaut, §9 « préparer l'envoi papier »
   partiellement couvert) ; `docs/architecture.md` (ADR 065-067, dépendances).

### Correctifs de la revue (tour 1) — arbitrages du 20/11/2026

10. [x] **C1 — lettre plus longue qu'une page : page de suite propre** (arbitrage). Le corps est borné
    à `[début du corps, haut du pied − 4 mm]` sur chaque page ; ce qui déborde continue sur une page
    de suite, créée avec les vraies marges (20/20/15/20 mm), le pied redessiné et un repère en tête
    « <Nom du destinataire> — suite, page n/N ». Aucun texte du corps sous le haut du pied, aucun
    texte hors des marges. Chaque lettre commence sur une nouvelle page (lot = suite de lettres, plus
    « une page par lettre »). Le service connaît le nombre de pages et la carte l'annonce
    (« N lettres, M pages » quand M > N). Tests `pdfjs-dist` avec un corps ≥ 7 000 caractères :
    aucun texte du corps sous le haut du pied, marge haute respectée sur chaque page de suite,
    repère présent, nombre de pages = celui annoncé. L'e2e ne suppose plus `pageCount === letters`.
    Consigner la règle dans `docs/design-system.md` §6.1 (comble le manque).
11. [x] **M1 — ligne d'adresse plus large que le cadre** (arbitrage). Chaque ligne est mesurée
    (`widthOfString`) contre la largeur du cadre (90 mm) : réduction de 12 pt jusqu'à 10 pt au plus
    petit ; si elle ne tient toujours pas, coupure après une virgule, dans la limite de 4 lignes ;
    si cela ne suffit pas, la lettre est signalée dans la carte avec un lien vers la fiche, comme les
    lettres adressées au terrain. Tests : le bord droit de chaque ligne ≤ bord droit du cadre (après
    décalage), réduction, coupure, signalement. Règle consignée au §6.1.
12. [x] **Mineurs m1-m4** de `docs/reviews/s28-publipostage-pdf.md`, s'ils restent locaux : aide
    citant chaque groupe d'homonymes (m1) ; `legacy` distingué des fiches figées toutes supprimées
    (m2) ; cible non recalculée deux fois (m3) ; compte de lettres pris dans la réponse (m4).
    m1, m3, m4 faits ; m2 non traité : il ne reste pas local (aucun chemin du produit ne supprime
    une fiche, et distinguer les deux cas demande un signal en base).

### Correctifs de la revue (tour 2) — arbitrage du 20/11/2026 : corriger avant la PR

13. [x] **M2 — textes du pied, de l'en-tête et du repère bornés à la largeur utile.** Les mentions
    légales (`association.legal_mentions`, jusqu'à 500 caractères) passent à la ligne sur la largeur
    utile (170 mm, marges 20/20) et restent dans la hauteur du pied ; si elles ne tiennent toujours
    pas, réduction jusqu'à un plancher. Le nom de l'association dans l'en-tête et le repère « <nom> —
    suite, page n/N » sont bornés à la largeur utile (mesure, réduction ou coupure contrôlée, sans
    perdre le « page n/N »). Tests `pdfjs-dist` : mentions de 500 caractères et nom de destinataire
    de 70 caractères ; aucun texte hors de x 20-190 mm, pied jamais sous la marge basse ni sur le
    corps. Règle consignée au §6.1 du design system.
14. [x] **m5** — document de mesure des adresses créé avec `fontLayoutCache: false` (ou un document
    par appel), pour ne pas accumuler les mots des adresses dans un cache sans limite.

## Files touched

- `src/services/rules/campaign-letter-rules.ts` (+ test), `src/services/rules/campaign-rules.ts`
- `src/lib/import/pennylane-clients-mapper.ts` (appel de la clé extraite)
- `src/db/models/campaign-model.ts`, `src/db/models/db.ts`, `src/db/campaign-model.test.ts`
- `drizzle/migrations/00xx_*.sql` + `meta/` (générés), `00xx_campaign_letter_profile_rls.sql` (custom)
- `src/db/repositories/campaign-repository.ts` (+ test)
- `src/services/campaign-service.ts` (+ test), `src/services/campaign-letter-service.ts` (+ test)
- `src/services/facades/campaign-letter-service-facade.ts`, intercepteur associé
- `src/services/types/domain/association-settings-types.ts`, `campaign-types.ts` (types du courrier)
- `src/lib/letters/*` (+ tests), éventuellement `src/assets/fonts/*.ttf`, `next.config.ts`
- `src/app/api/campaigns/[id]/courrier/route.ts`, `src/app/api/campaigns/calage/route.ts` (+ tests)
- `src/app/dal/campaign-dal.ts` (+ test), `src/app/[locale]/(bureau)/bureau/campagnes/[id]/page.tsx`
- `src/components/features/campaigns/campaign-detail.tsx`, `campaign-letter-card.tsx`,
  `campaign-letter-download.tsx` (+ tests)
- `messages/fr.json`, `src/db/scripts/tenant-member-profiles-seed.ts` (+ test), `e2e/campaign-letters.spec.ts`
- `package.json`, `pnpm-lock.yaml`
- `docs/design-system.md`, `docs/architecture.md`

## Test strategy

- **Unitaire (Vitest)** — règles pures d'abord (partition des canaux = critère 6, adresse, homonymes,
  lettres) ; moteur PDF relu par `pdfjs-dist` (critère 4 : coordonnées du bloc, décalage, A4, une page
  par lettre) ; service par rôle avec DAO mockés ; routes (statuts, en-têtes) ; composants jsdom par
  état. `pnpm test --run`, jamais le mode watch ; sur le montage 9p, valider sur une copie en disque
  local si des workers expirent (un timeout n'est jamais compté vert).
- **E2E (Playwright, sur la CI GitHub)** — parcours complet, complétude en base, accès croisé entre deux
  tenants (la RLS n'est pas testable en unitaire). Pas d'e2e en local (machine trop juste).
- **Non-régression** — suites campagne existantes (`campaign-*.test.ts`, `campaigns.spec.ts`,
  `recipient-groups.spec.ts`) et import (`pennylane-clients-mapper`).
- **Recette** — impression réelle d'une page de calage dans une enveloppe DL avant le premier lot.

## Definition of Done

- Une PR, un commit de story (plus un commit de migration si utile), description structurée (UI, API,
  DB, dépendances, migration).
- Les six critères couverts par des tests nommés ; le critère 6 par un test unitaire **et** un e2e.
- `campaign_letter_profile` sous RLS forcée, test d'accès croisé e2e vert.
- Aucune valeur métier en dur : décalages en réglages, textes dans `messages/fr.json` ; géométrie de la
  norme en constantes justifiées par l'ADR 067.
- Aucune donnée personnelle dans les journaux, les clés de cache ni le nom du fichier.
- Revue `/ks-review` passée (`Ship allowed: yes`).
- Déploiement : selon la stratégie de livraison (manuelle) ; rappeler la page de calage à la recette.
