# Revue — Story s36-modeles-documents

Round 1, 25/11/2026 — revue en contexte neuf (subagent `reviewer`).

Je n'ai trouvé aucun défaut bloquant : la branche peut partir en PR. Il reste quatre mineurs, détaillés plus bas.

Diff revu : `git diff main...feature/s36-modeles-documents`, un seul commit (3ebf2688), 69 fichiers. Je l'ai confronté au plan (`validated: yes`), à AGENTS.md, à l'ADR 074 et aux ADR 002, 003, 010, 066, 067, 073, ainsi qu'aux arbitrages du 25/11/2026, que je n'ai pas rouverts.

## Tests lancés par le reviewer

- **Suite unitaire** (`pnpm test --run`) : 492 fichiers, 6745 tests passés, 2 en échec, 1 ignoré.
  - Les deux échecs sont des dépassements de délai sur le montage 9p : `src/app/[locale]/fonts.test.ts` (15 s) et `src/lib/better-auth/magic-link-integration-imports.test.ts` (5 s).
  - Relancés seuls, ils passent : 5/5 et 2/2.
  - Bilan réel : 6747 passés, 1 ignoré, 0 échec.
- **Types** : `pnpm exec tsc --noEmit` ne signale aucune erreur, ni dans `.next/` ni ailleurs.
- **Lint** : `eslint` sur tous les fichiers `.ts`/`.tsx` touchés dans `src/` et `e2e/` sort à 0.
- **Non lancés** (consigne) : la suite e2e et `pnpm build`. Les specs `e2e/document-templates.spec.ts` et le bloc s36 de `e2e/tenant-isolation.spec.ts` ne sont donc vérifiés qu'à la lecture ; ils restent à voir verts en CI.

## Checklist

### Conformité au plan

- [x] Les dix tâches sont présentes, y compris le commentaire « s33 » corrigé en « s36 », l'export de `readLetterAssociation` sans changement de comportement, et la mise à jour de `docs/architecture.md` (59 tables, 40 scopées) et de `docs/design-system.md` (§5.6, §3.14, §6.3, manques 6, 7 et 9).
- [x] Les sept écarts déclarés sont justifiés (voir plus bas). Aucun autre écart trouvé.

### Anti-hallucination

Chaque cible a été ouverte et sa signature vérifiée :

- [x] **Accès aux données** : `getCurrentParcelNumbersByProfileDao(string[])`, qui rend `Record<string, string[]>` ; `getMemberProfileByIdDao` ; `getRecipientGroupByIdDao`, `getRecipientGroupMemberIdsDao`, `listRecipientGroupsDao` ; `getCampaignTargetRowsDao`.
- [x] **Règles et moteur** : `lettersOf(profiles, 'per_land', parcels)` ; `letterAddressLinesOf(profile).lines` ; `findUnknownVariables(text, allowed)` ; `formatCampaignDate`.
- [x] **Services et autorisations** : `canPerformAction` ; `depositMemberDocumentService({organizationId, memberProfileId, title, categoryId, documentDate?, file?})` ; `resolveMemberBillingProvider(settings).listInvoicesOf` ; `unpaidProfileIdsOf` ; `getInvoiceStatusClassification`.
- [x] **Schémas, types et intercepteur** : `newsDateSchema` ; `campaignTargetSchema` ; `CampaignTargetUnavailableError({cause})` ; `getLetterAddressOffset` ; `createServiceInterceptor(..., {shouldLogDetails})`.
- [x] **Route** : `emptyResponse`, `pdfAttachment`, `refusalResponseOf` (403 pour une autorisation refusée, 404 pour une erreur de validation).
- [x] **DAL** : `canManageCurrentMemberDocumentsDal`, `getMemberDocumentCategoryChoicesDal`.
- [x] **Composants et chemins** : `NoCategoryNotice` ; `calendarDayOf` ; les motifs `MEMBER_*_ROUTE_PATTERN`.
- [x] **Migrations** :
  - Chaîne de snapshots 0083 → 0084 → 0085 cohérente (`prevId` corrects).
  - 0084 n'ajoute que `public.document_template` ; les autres tables sont identiques en comparaison profonde.
  - 0085 est une migration `--custom` (snapshot identique à 0084) qui suit le patron de `0083_member_document_rls.sql` : ENABLE + FORCE + policy `tenant_isolation`.
  - Le journal a les entrées 84 et 85.
  - Rien n'est écrit à la main.

### Règles

- [x] **Isolation des associations** :
  - Tout passe par `getDb()`, et chaque appel de service est sous `withTenant`, y compris la lecture du groupe et des factures.
  - L'imbrication de `withTenant` est prise en charge (`runInNestedScope`).
  - **Aucun nouveau `withRlsBypass`** dans le code applicatif. Le `bypass_rls` n'apparaît que dans la préparation SQL des specs e2e, comme dans les autres specs.
- [x] **Autorisations** :
  - Chaque Server Action suit le même ordre : association du domaine, puis `requireActionAuth()`, puis façade.
  - Le service exige `document.template.manage`. Le dépôt et la cible d'un lot exigent en plus `member.document.manage`, vérifiée d'emblée, et s32 la revérifie.
  - La route GET passe par l'association du domaine, puis la façade (403, 404 ou 422 selon le cas).
- [x] **Variables inconnues** : refusées à l'enregistrement, dans l'objet comme dans le texte, avant toute écriture ; refusées aussi à la génération (`unknown_variables`, sans rendu).
- [x] **Un seul moteur PDF** :
  - `extraValues` et `extra` sont optionnels et vides par défaut.
  - Les tests existants de s28, s29 et s42b ne sont pas modifiés (ajouts seulement) et passent.
  - Aucun `createStorage` ; le dépôt passe uniquement par `depositMemberDocumentService`.
- [x] **ADR 010 et libellés** : tous les libellés sont dans `messages/fr.json` (namespace `DocumentTemplatesBureau`, plus `BureauMemberDocuments.section.generate` et la clé de la barre latérale). Le JSON est valide et les clés `depositFailures.issues.*` couvrent tous les codes de refus de s32.
- [x] **Journaux** : l'intercepteur n'enregistre aucun détail. Le journal du moteur ne contient que `templateId`. Le nom de fichier est `document-jj-mm-aaaa.pdf`. Aucun `'use cache'`.
- [x] **Design system** : seuls des composants du système (`alert`, `select`, `checkbox`, `radio-group`, `table`, `badge`, `breadcrumb`, `alert-dialog`, `RestrictedMarkdownEditor`), aucune couleur brute. Une largeur sort du système (mineur 3).

### Tests

- [x] Les assertions fixent bien les critères :
  - Le service compare l'entrée exacte du moteur (parcelles « 12 et 13 », date, `extraValues`).
  - Un refus n'écrit rien.
  - Un dépôt sans `member.document.manage` est refusé avant tout rendu.
  - Le PDF du moteur est relu par `pdfjs-dist`.
  - Le lot ne lance jamais deux appels à la fois (`maxInFlight === 1`).
  - Dans le générateur, le dépôt passe avant le téléchargement.
  - Les codes de la route sont testés, 500 compris.
  - Le bloc RLS e2e vérifie trois choses : rien hors scope, A seul dans le scope de A, écriture pour B refusée.
- [ ] Une assertion e2e passerait même si le code était faux (mineur 1).

### Régressions

- [x] Côté moteur, `substituteVariables`, `letterBodyBlocksOf` et `renderLettersPdf` ne changent pas pour les appelants existants : sans `extra`, l'ancien comportement est conservé et testé.
- [x] `readLetterAssociation` est simplement exportée.
- [x] La fiche, `MemberDocumentsCard` et la barre latérale gagnent un drapeau optionnel, `false` par défaut. Leurs tests sont complétés et passent.

## Les sept écarts déclarés par l'implémenteur

1. **`getTemplateDocumentRecipientService` et son DAL** : accepté. La tâche 8 demandait déjà un aperçu de l'adresse « par un DTO du service (ADR 067) ». Le service exige `document.template.manage`, lit la fiche sous l'association et rend `undefined` hors de celle-ci.
2. **`issues?` dans `DocumentLotLineResult`** : accepté. Les codes permettent d'afficher les messages de champ de l'état 3e. La raison reste traduite par le serveur.
3. **500 `render_failed`** : accepté. C'est une panne du serveur, pas une entrée invalide. La réponse ne contient aucun détail et le cas est testé.
4. **Colonne « Terrain ou raison » sans numéros de parcelle** : écart réel au design 4c, retenu comme mineur 2.
5. **Critère 5 vérifié par l'écran « Page non trouvée »** : accepté avec réserve (mineur 4). Conséquence du patron imposé par le plan (`notFound()` derrière `<Suspense>`) : le statut HTTP reste 200. Pas de fuite : la RLS, le texte absent et le 404 de la route sur le domaine de B sont tous vérifiés.
6. **`proprietaires/[id]/page.tsx` et son test, `bureau-sidebar.test.tsx`** : accepté. La page doit calculer le drapeau prévu au plan (`member-profile-detail.tsx`, « drapeau d'action »). Le test de la barre latérale couvre l'entrée demandée à la tâche 7.
7. **Revalidation de la vue d'ensemble et de l'espace membre** : accepté. Patron des actions de s32 (`documents-nominatifs/actions.ts:67-69`) : un document déposé doit apparaître partout où s32 l'affiche.

## Points relevés

1. **mineur** — `e2e/document-templates.spec.ts`, test « critère 2 — … rien n'est conservé » : la vérification `documentsTitled(DOCUMENT_TITLE)` vaut 0 dans tous les cas. Le téléchargement sans case n'envoie aucun titre, et ce titre n'a encore jamais servi. Il faudrait compter les `member_document` de la fiche avant et après le téléchargement.
2. **mineur** — `src/components/features/document-templates/document-template-lot.tsx` (`LineDetail`) : pour une ligne déposée, la colonne « Terrain ou raison » affiche « — » ou « Aucune parcelle actuelle » au lieu des numéros de parcelle prévus au design 4c. Cause : `DocumentLotProfileDTO` ne porte que `hasCurrentParcel`.
3. **mineur** — `src/components/features/document-templates/document-template-form.tsx` : la largeur `max-w-[76ch]` n'existe nulle part ailleurs dans `src` et n'est pas dans le tableau des gabarits du design system (§1.6). La remplacer par une largeur existante (`max-w-[68ch]` ou `max-w-180`, celle du composeur) ou la déclarer dans le système.
4. **mineur** — `src/app/[locale]/(bureau)/bureau/modeles-documents/[id]/page.tsx` : un modèle d'une autre association rend l'écran « Page non trouvée » avec un statut 200, et non le 404 que le plan annonçait. Pas de fuite de données ; le critère 5 est prouvé par la RLS et par le 404 de la route.

Aucun point critique ni majeur. Les mineurs restent consignés ici pour le tour final des mineurs, à la fin de toutes les stories.

## Verdict

Max severity: minor
Ship allowed: yes
