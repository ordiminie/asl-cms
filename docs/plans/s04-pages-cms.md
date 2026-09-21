---
validated: yes
---

# Plan — Story s04-pages-cms

Branch: `feature/s04-pages-cms` (déjà créée ; `HEAD` == `main` au commit `aadaf85`, s03b déjà mergé —
l'Open question 1 de la recherche est donc résolue, rien à attendre).

## Target story

**En tant que** membre du bureau **je veux** créer, modifier, publier et dépublier une page composée
de blocs **afin de** faire vivre le site sans intervention du prestataire.

Acceptance criteria (`docs/stories.md`) :

1. Le bureau crée une page (titre, slug, contenu riche, images) et la voit rendue à l'URL publique une
   fois publiée.
2. Une page en brouillon n'est pas accessible publiquement (404 pour un visiteur) mais reste
   prévisualisable par le bureau.
3. Dépublier une page la retire du site public sans la supprimer ; la republier la restaure à
   l'identique.
4. L'insertion d'une image dans une page l'enregistre dans le stockage de fichiers et l'affiche dans le
   rendu public.
5. Un slug déjà utilisé dans la même association est refusé avec un message de champ ; deux
   associations peuvent avoir le même slug.
6. Un membre non-bureau ne peut ni créer ni modifier de page.
7. Une page est une **liste ordonnée de blocs typés** : insertion à un rang précis, réordonnancement,
   le rendu public respecte l'ordre après rechargement.
8. Le réordonnancement est atteignable **sans glisser-déposer** — au clavier seul, même résultat qu'à
   la souris.
9. Un type de bloc inconnu dans une page enregistrée ne casse pas le rendu : la page s'affiche, le bloc
   est ignoré et signalé au bureau.

Décisions structurelles prises pour ce plan (voir ADR) :

- **ADR 019** — `content_block.data` en `jsonb`, typé par un schéma Zod discriminé, rendu par une
  fonction pure et synchrone (`render-page-block.ts`), pas par `MDXContent` (incompatible `'use
cache'`). Sanitisation par une chaîne `remark` → `rehype-sanitize` minimale, restreinte aux balises de
  la barre réduite.
- **ADR 020** — page publique servie à la racine (`/{slug}`, conforme au design déjà validé), protégée
  par une liste de slugs réservés vérifiée à l'écriture.
- **Registre d'actions** : une entrée unique `PAGE_MANAGE` (`ActionIdConst`, rôles `['owner','board']`)
  couvre créer/modifier/publier/dépublier — même granularité que le précédent
  `ASSOCIATION_IDENTITY_UPDATE` (s01b) ; rien dans les critères ne distingue les rôles entre ces quatre
  verbes.
- **Statuts** : `page.status` persiste seulement `draft | published | unpublished` (3 valeurs). Les
  statuts `dirty`, `publishing`, `error` du composant `<PreviewBar />` (§2.2 du design system) sont des
  états **client, non persistés**, dérivés de l'état du formulaire et de la requête réseau en cours —
  résout l'Open question 7 : les six valeurs de l'énuméré du composant ne sont pas six valeurs de
  colonne.
- **Publier vs enregistrer** : les champs « obligatoires pour publier » (`alt` d'une image ou d'une
  vignette de galerie, titre d'un document PDF — design system §4, brief §écran 2) ne bloquent **que**
  `publishPageService`, jamais `updatePageService` (le bureau doit pouvoir enregistrer un brouillon
  incomplet).

## Tasks (ordered)

1. [x] **Schéma & persistance — `page` et `content_block`.**
       `src/db/models/page-model.ts` (`page` : `organization_id` FK cascade, `slug`, `title`, `status`
       pgEnum `draft|published|unpublished`, timestamps ; contrainte unique composite
       `(organization_id, slug)` — jamais l'unicité globale de `posts_translation.slug`, Trap 6) et
       `src/db/models/content-block-model.ts` (`content_block` : `page_id` FK cascade, `type` (texte),
       `rank` (integer), `data` (`jsonb`)). Enregistrement dans `src/db/models/db.ts`. Migration
       `pnpm db:generate`, puis policy RLS forcée par `drizzle-kit generate --custom` sur le gabarit de
       `drizzle/migrations/0007_organization_setting_rls.sql` (forcée sur les deux tables — `content_block`
       hérite du tenant via `page_id`, pas de colonne `organization_id` dupliquée : la policy y joint
       `page`). Mise à jour de `docs/architecture.md` (§ Classement RLS : 21 → 23 tables, section « Scopée
       par une policy RLS forcée » passe de 2 à 4 lignes).
       Vérifiable par : `pnpm db:generate` sans erreur, migration appliquée proprement en local
       (`postgres-local-dev`) ; pas de test unitaire direct (RLS non testable en unitaire, ADR 002) — la
       preuve vient de la tâche 9.

2. [x] **`page-block-types.ts` + `render-page-block.ts` (ADR 019).**
       `src/services/types/domain/page-block-types.ts` : schéma Zod discriminé par `type` pour les cinq
       blocs (texte riche, image + légende, PDF, galerie, encart), liste exportée des slugs réservés
       (ADR 020). `src/lib/cms/render-page-block.ts` : fonction pure et synchrone, un bloc → HTML sanitisé
       ou `null` (type inconnu, jamais une exception). Ajout de la dépendance de sanitisation retenue à
       l'implémentation (`rehype-sanitize` ou équivalent le plus léger couvrant le besoin), chaîne
       `remark` → `remark-html` → sanitisation, restreinte aux balises de la barre réduite (gras, italique,
       `h2`/`h3`, listes, liens).
       Tests unitaires : chaque type de bloc rend le HTML attendu ; un `<script>` injecté dans un champ
       texte est neutralisé ; un `type` absent du schéma retourne `null` sans lever ; un slug de la liste
       réservée est bien exporté et non vide.

3. [x] **`page-service.ts` + registre d'actions.**
       Déclarer `ActionIdConst.PAGE_MANAGE` (rôles `['owner','board']`) dans
       `src/services/types/domain/action-registry-types.ts`. `src/db/repositories/page-repository.ts`
       (`getDb()`, jamais `db`) : CRUD page, recherche par `(organization_id, slug)`,
       `reorderPageBlocksTxnDao` (transaction, gabarit `rule-transaction-dao.md`). `src/services/validation/
page-validation.ts` (schémas `createPageServiceSchema`, `updatePageServiceSchema` incluant les blocs).
       `src/services/page-service.ts` : `createPageService`, `updatePageService`, `publishPageService`,
       `unpublishPageService` — ordre `safeParse` → `getAuthUser()` →
       `canPerformAction(user, organizationId, ActionIdConst.PAGE_MANAGE)` → slug non réservé (ADR 020) et
       unique par organisation (critère 5) → `withTenant(organizationId, ...)`. `publishPageService`
       applique en plus la validation « obligatoire pour publier » (alt image/galerie, titre PDF) et refuse
       sinon, sans toucher à `updatePageService`.
       Tests unitaires (patron `rule-services-tests.md`, rôles OWNER/BOARD/MEMBER/PUBLIC) : bureau
       (owner/board) autorisé sur les quatre verbes, membre simple refusé (`AuthorizationError`), slug
       dupliqué dans la même organisation refusé, même slug accepté dans une autre organisation, slug
       réservé refusé, réordonnancement produit le même tableau qu'on lui passe l'ordre obtenu à la souris
       ou au clavier (une seule fonction, donc critère 8 prouvé par construction), bloc de type inconnu
       accepté par `updatePageService` (pas de refus silencieux) mais absent du rendu (tâche 2),
       publication refusée si une image/vignette sans `alt` ou un PDF sans titre, publication acceptée
       sinon.

4. [x] **Stockage des fichiers de bloc.**
       `uploadPageBlockFileService` dans `page-service.ts` (ou fichier voisin) : réutilise
       `createStorage('local', {...})` (gabarit `association-identity-service.ts`), clé serveur
       `{organizationId}/pages/{pageId}/{blockId}-{uuid}.{ext}`, validation par **signature binaire**
       (jamais l'extension ni le type déclaré). Route `src/app/api/pages/files/[...key]/route.ts` : tenant
       résolu par le domaine appelé, clé validée contre le préfixe `{organizationId}/pages/` de
       l'organisation courante (404 sinon — jamais un chemin pris tel quel dans la requête, contrairement à
       `file-service.ts`, Trap 5), `X-Content-Type-Options: nosniff`.
       Tests unitaires : rejet d'un fichier dont la signature ne correspond pas au type déclaré ; rejet
       d'une clé hors du préfixe de l'organisation résolue par le domaine ; acceptation d'une clé valide.

5. [x] **DAL + invalidation de cache.**
       `src/app/dal/page-dal.ts` : `pageTag(organizationId, slug)` (exporté), fonction interne non exportée
       `'use cache'` + `cacheLife` + `cacheTag(pageTag(...))` pour la lecture publique par slug (gabarit
       `association-settings-dal.ts`), `getPagesForBureauDal` non cachée (liste de gestion, par tenant).
       `updateTag(pageTag(organizationId, slug))` appelé dans les Server Actions de la tâche 8, après le
       succès de l'écriture (jamais avant), sur `createPageService`/`updatePageService` (le slug peut
       changer) et sur `publishPageService`/`unpublishPageService`. Aucun appel à `logger` dans le scope
       caché (Trap 7).
       Pas de test unitaire direct (lecture derrière `'use cache'`, patron déjà établi) ; vérifié en revue
       de code + par la tâche 8 (le bureau voit son changement de statut immédiatement).

6. [x] **Route publique `/{slug}` (ADR 020).**
       `src/app/[locale]/(public)/[slug]/page.tsx` : tenant résolu par le domaine, `notFound()` si la page
       est absente ou si son statut n'est pas `published` **pour un visiteur** (critère 2), lecture directe
       (sans cache) et bannière d'aperçu pour le bureau qui prévisualise un brouillon. Rendu des blocs dans
       l'ordre (`rank`) via `render-page-block.ts` (tâche 2) ; un bloc incomplet (fichier absent) ou de type
       inconnu est simplement omis (§4 du design system, critère 9).
       Test e2e (Playwright, contre le build de production) : visiteur anonyme → 404 sur un brouillon ;
       bureau connecté → aperçu du même brouillon ; page publiée → 200 avec les blocs dans l'ordre attendu.

7. [x] **Back-office — liste et sidebar.**
       `src/components/features/association/bureau-sidebar.tsx` : nouveau groupe « Le site » (au-dessus de
       « L'association », Trap 8), entrée « Pages » → `/bureau/pages`. `getPagesForBureauDal` +
       `src/app/[locale]/(bureau)/bureau/pages/page.tsx` : `table` triée par dernière modification
       décroissante, `badge` de statut (point + libellé écrit), bouton « Nouvelle page », lien « Modifier »
       unique par ligne (écran 1 du design). États vide/chargement (`skeleton`)/succès.
       Test : rendu de la liste par rôle (bureau voit et agit, membre simple n'a pas accès à la route —
       `canManageAssociation` ou équivalent gate l'affichage, `PAGE_MANAGE` gate les mutations).

8. [x] **Back-office — éditeur de page (écran 2 du design, le cœur de la story).**
       `src/components/ui/preview-bar.tsx` (`status: draft|dirty|live|publishing|error|unpublished`, fond
       `oklch(0.24 0.02 250)`, erreur en 2ᵉ ligne jamais en toast — §2.2), `src/components/ui/sortable-list.tsx`
       (signature exacte §2.4 : `items, getId, onReorder, renderItem, showMoveButtons=true,
undoWindowMs=10000` ; boutons Monter/Descendre toujours visibles, premier élément « Monter » désactivé
       et annoncé, `aria-live="polite"`, annulation en bande ancrée 10 s, `@dnd-kit` en confort
       supplémentaire — jamais le seul chemin), `src/components/ui/block-picker.tsx` (signature §2.5 :
       `types, insertAt, onInsert, trigger, searchable=true`, cinq types, séparateur permanent 44 px). Cinq
       formulaires de bloc (`src/components/features/pages/blocks/*`) : texte riche (variante restreinte de
       `markdown-editor.tsx` — gras/italique/titre 2-3/liste/lien seulement, Trap 4), image + légende
       (`alt` marqué « Obligatoire pour publier »), PDF (titre obligatoire pour publier), galerie (alt par
       image), encart (aperçu teinté in situ). Affichage du bloc de type inconnu : lecture seule,
       suppression uniquement. Server Actions (`src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts`) :
       enregistrer brouillon, publier (avec l'`alert-dialog` de confirmation pour dépublier — irréversible
       pour le visiteur), erreur de slug dupliqué renvoyée comme message de champ (critère 5).
       Test e2e : créer une page de plusieurs blocs, réordonner **au clavier seul** (boutons, jamais de
       glisser-déposer simulé), publier, vérifier que le rendu public (tâche 6) respecte l'ordre après
       rechargement ; dépublier puis republier restaure le contenu à l'identique (critère 3).

9. [x] **Preuve d'isolation multi-tenant + critères transverses.**
       `e2e/page-cms.spec.ts` (patron allégé `association-settings.spec.ts`, tenants seedés) : une page
       publiée dans le tenant A est invisible sur le domaine du tenant B (RLS attaquée en direct, patron
       `tenant-isolation.spec.ts`) ; le même slug est accepté dans les deux tenants (critère 5) ; un membre
       non-bureau reçoit un refus applicatif sur la création/modification (critère 6) ; un bloc de type
       inconnu inséré **directement en base** (hors UI, puisqu'aucun chemin de l'interface ne le produit)
       ne casse pas le rendu de la page et reste signalé côté bureau (critère 9, bouclé en conditions
       réelles — au-delà du test unitaire de la tâche 3).

## Files touched

- `src/db/models/page-model.ts`, `src/db/models/content-block-model.ts`, `src/db/models/db.ts`
- `drizzle/migrations/00XX_page_content_block.sql`, `drizzle/migrations/00XX_page_content_block_rls.sql`
- `docs/architecture.md` (classement RLS)
- `src/services/types/domain/page-block-types.ts`, `src/services/types/domain/action-registry-types.ts`
- `src/lib/cms/render-page-block.ts`
- `src/services/validation/page-validation.ts`, `src/services/page-service.ts`
- `src/db/repositories/page-repository.ts`
- `src/services/facades/page-service-facade.ts`
- `src/app/api/pages/files/[...key]/route.ts`
- `src/app/dal/page-dal.ts`
- `src/app/[locale]/(public)/[slug]/page.tsx`
- `src/components/features/association/bureau-sidebar.tsx`
- `src/app/[locale]/(bureau)/bureau/pages/page.tsx`,
  `src/app/[locale]/(bureau)/bureau/pages/[id]/page.tsx`,
  `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts`
- `src/components/ui/preview-bar.tsx`, `src/components/ui/sortable-list.tsx`,
  `src/components/ui/block-picker.tsx`
- `src/components/features/pages/blocks/*` (5 formulaires + variante restreinte de l'éditeur markdown)
- `package.json` (dépendance de sanitisation — ADR 019)
- `e2e/page-cms.spec.ts`
- `docs/decisions/019-editeur-blocs-modele-et-rendu.md`, `docs/decisions/020-route-page-publique-racine.md`

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : rendu de bloc (tâche 2), service (autorisation par rôle,
  validation, unicité de slug, slugs réservés, obligation « publier » vs « enregistrer », tâche 3),
  stockage (signature binaire, préfixe de clé, tâche 4). Base et auth mockées, comme toute la suite
  existante.
- **e2e (Playwright, contre le build de production, base éphémère seedée)** : parcours bureau complet
  (créer, réordonner au clavier, publier, dépublier, republier — tâche 8), rendu public et brouillon
  404/aperçu (tâche 6), isolation multi-tenant et bloc inconnu en conditions réelles (tâche 9).
- **Pas de test direct sur la RLS elle-même** en dehors de la tâche 9 (ADR 002 : `db.ts` refuse toute
  connexion en test unitaire).

## Definition of Done

- Les 9 critères d'acceptation sont couverts par au moins un test qui échouerait sans l'implémentation.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` passent ; `pnpm test:e2e --project=chromium` passe
  sur `e2e/page-cms.spec.ts` (build de production, base éphémère).
- `docs/architecture.md` reflète les deux nouvelles tables RLS (21 → 23) ; les deux ADR sont présents et
  non contredits par le code livré.
- Aucun `console.log`/`logger` dans un scope `'use cache'` (`page-dal.ts`).
- Une seule action au registre (`PAGE_MANAGE`) couvre les quatre verbes, aucun contrôle de rôle écrit à
  la main en doublon.
- Revue (`/ks-review`) : aucun `withRlsBypass` introduit, aucune valeur en dur qui aurait dû être un
  paramètre d'association, mockup non copié tel quel (composants réels du socle + les trois nouveaux
  du design system).
