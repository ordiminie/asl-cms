---
validated: yes
---

# Plan — Story s05-actualites

Branch: `feature/s05-actualites`, créée depuis `main` (`0b328a2`).

> Validé par Marie-Ève le 2026-09-22 (« considère que j'accepte le plan »), dans la même demande que
> l'enchaînement `/ks-execute` → `/ks-review` jusqu'à une branche shippable.
>
> **Sources** :
>
> - recherche : `docs/research/s05-actualites.md` ;
> - design validé : `docs/designs/s05-actualites.md`, maquette `.html` ;
> - décision structurante : **ADR 023** (`docs/decisions/023-actualites-table-dediee-et-fichiers-de-contenu.md`).

## Target story

**En tant que** membre du bureau **je veux** publier des actualités datées **afin d'**informer les
membres et les visiteurs de la vie de l'association. Complexité 2, dépend de s04 (livrée).

1. Le bureau crée une actualité (titre, date, image, contenu) et la voit apparaître en tête de la
   liste publique une fois publiée.
2. La liste publique est triée par date décroissante et paginée ; chaque actualité a sa page dédiée
   avec une URL stable.
3. Une actualité en brouillon n'apparaît ni dans la liste ni à son URL pour un visiteur.
4. Les actualités d'une association ne sont jamais visibles sur le site d'une autre.

### Décisions tranchées pour ce plan

Voir l'ADR 023 et les hypothèses du design.

- **Modèle** : une table `news` dédiée, à champs fixes. `posts` et le blog hérité ne sont pas
  touchés.
- **Contenu** : un champ markdown unique, rendu par la chaîne sanitisée de s04.
- **Slug** : `null` à la création, fixé au premier enregistrement qui porte un titre, **jamais
  recalculé**. Il est généré côté serveur, translittéré (accents retirés), limité à
  `pageSlugSchema`, et suffixé `-2`, `-3`… s'il est déjà pris dans l'association.
- **Date** : `published_on`, de type `date`. Le service ne lit pas l'horloge : la date du jour est
  proposée par le formulaire. Côté bureau, `input type="date"` natif, affiché `jj/mm/aaaa` en `fr`,
  sans dépendance nouvelle (écart 2 du design).
- **Image** : facultative. Si une image est posée, un texte alternatif non vide est exigé pour
  **publier**, jamais pour enregistrer le brouillon. Le titre est exigé pour publier.
- **Fichiers** : une portée `news` dans une chaîne de fichiers de contenu partagée. Route publique
  unique `/api/files/[...key]`, `/api/pages/files` servie par le même gestionnaire.
- **URL publiques** : `/actualites?page=N` et `/actualites/{slug}`. `actualites` entre dans
  `RESERVED_PAGE_SLUGS` (ADR 020). Vérifié : aucune page du seed ni des e2e ne porte ce slug.
- **Pagination** : constantes d'affichage `NEWS_PUBLIC_PAGE_SIZE = 10` et
  `NEWS_BUREAU_PAGE_SIZE = 25`. Une page hors bornes rend 404, sauf la page 1 d'une liste vide, qui
  affiche l'état vide.
- **Autorisation** : une entrée de registre `NEWS_MANAGE = 'news.manage'`, rôles
  `['owner', 'board']`, sur le précédent de `PAGE_MANAGE`. `canManageAssociation` sert l'affichage.
- **Hors périmètre** : suppression, extrait, menu, accueil, email (s25), SEO (s11), retrait du blog
  hérité.

## Tasks (ordered)

1. [x] **Modèle `news`, RLS, registre, slug réservé.**
   - `src/db/models/news-model.ts` : `news_status` et `news`, avec les colonnes de l'ADR 023, une
     contrainte unique `(organization_id, slug)` et un index `(organization_id, status, published_on)`.
     Le modèle est enregistré dans `src/db/models/db.ts`.
   - Migration générée par `pnpm db:generate`, puis policy par `drizzle-kit generate --custom`, sur
     le patron `0015_menu_item_rls.sql` : `ENABLE` + `FORCE`, `tenant_isolation`.
   - `ActionIdConst.NEWS_MANAGE` et son entrée dans `ACTION_REGISTRY`.
   - `'actualites'` ajouté à `RESERVED_PAGE_SLUGS`.
   - `src/services/types/domain/news-types.ts` : DTO, statuts, résultats de mutation, constantes de
     pagination.
   - **Tests** :
     - l'entrée `news.manage` autorise `owner` et `board`, refuse `member` ;
     - `isPageSlugReserved('actualites')` est vrai ;
     - `pnpm db:generate` ne produit plus de diff après la migration.
2. [x] **Chaîne de fichiers de contenu partagée** (ADR 023, §3).
   - `src/services/types/domain/content-file-types.ts` : registre des portées (`pages`, `news`),
     `buildContentFileKey`, `isContentFileKeyAllowed`, `getContentFileFormatFromKey`. La validation
     par signature et les plafonds de s04 y sont réexportés, sans copie.
   - `buildPageBlockFileKey`, `isPageBlockFileKeyAllowed` et `getPageFileFormatFromKey` deviennent
     des enveloppes.
   - `src/services/content-file-service.ts` : `readContentFileService`, **sans autorisation, et c'est
     délibéré**, avec sa façade et son intercepteur. Le stockage est `createStorage('local', …)` avec
     la configuration de `getPageFileStorage`.
   - Route `src/app/api/files/[...key]/route.ts`. `api/pages/files/[...key]/route.ts` réexporte le
     même `GET`. `readPageBlockFileService` délègue au service partagé.
   - **Écart assumé, tranché en revue (passe 1, constat 5)** : le chemin hérité
     `/api/pages/files` n'est pas le `GET` complet mais `createContentFileGET([PAGES])`, borné à la
     portée `pages` — une clé d'actualité y est refusée avant tout appel au service. Aucune adresse
     rendue par s04 ne change. Documenté dans `docs/architecture.md` (section fichiers de contenu).
   - **Tests** :
     - clé `news` construite et acceptée ;
     - refus d'une clé d'une autre association, d'une portée inconnue, avec `..`, avec un segment vide,
       d'une extension inconnue ;
     - **les clés `pages` existantes restent acceptées** : `page-block-file.test.ts` et
       `page-block-types.test.ts` restent verts sans modification de leurs attentes ;
     - route : 404 `nosniff` hors préfixe ou sans tenant, 200 avec `Content-Type` et cache long, sur le
       patron de `api/identity/[kind]/route.test.ts`.
3. [x] **Validation, repository, service `news`.**
   - `src/services/validation/news-validation.ts` : titre ≤ 160, date ISO `YYYY-MM-DD` valide,
     contenu ≤ 20 000, alt ≤ 300, identifiants UUID, numéro de page entier ≥ 1.
   - `src/db/repositories/news-repository.ts` : toujours `getDb()`. Création, lecture par id et par
     slug, mise à jour des champs, du statut et de l'image, recherche de slug pris, liste du bureau
     paginée avec total, liste publique **publiées seulement**, paginée avec total, dans l'ordre
     `published_on desc, created_at desc, id desc`.
   - `src/services/news-service.ts`, dans l'ordre `safeParse` → `canPerformAction(NEWS_MANAGE)` →
     `withTenant` :
     - `createNewsDraftService` ;
     - `updateNewsService`, qui fixe le slug s'il est encore nul et que le titre est non vide, et ne
       le touche jamais ensuite ;
     - `publishNewsService`, qui rend `{status:'rejected', issues}` si le titre manque, ou si
       l'image n'a pas d'alt ;
     - `unpublishNewsService` ;
     - `getNewsForBureauService` (paginé) et `getNewsItemForBureauService` ;
     - `getPublishedNewsPageService` et `getNewsBySlugService`, lectures publiques **sans
       autorisation, délibérément** ;
     - `uploadNewsImageService` (signature binaire, clé de portée `news`, actualité existante) et
       `canManageNewsService`.
   - Façade et intercepteur (`shouldLogDetails: () => false`, comme les pages).
   - **Tests** dans `src/services/__tests__/news-service.test.ts`, repository mocké :
     - `[ORGANIZATION OWNER]` et `[ORGANIZATION ADMIN]` (board) autorisés ;
     - `[ORGANIZATION MEMBER]`, `[USER NOT IN ORGANIZATION]` et `[PUBLIC]` refusés, avec
       `AuthorizationError` et aucun DAO appelé ;
     - slug translittéré (« Fête de l'étang : merci ! » → `fete-de-l-etang-merci`), dédoublonné,
       **inchangé après un changement de titre** ;
     - publication refusée sans titre ou sans alt, acceptée sans image ;
     - un brouillon incomplet s'enregistre ;
     - la lecture publique ne demande que les publiées ;
     - upload refusé par signature, sans écriture.
4. [x] **DAL `news-dal.ts` et rendu du contenu.**
   - Tags `newsListTag(org)` = `news:{org}` et `newsItemTag(org, slug)` = `news:{org}:{slug}`.
   - Lectures cachées **internes**, en `'use cache'` + `cacheLife('hours')` + `cacheTag` : liste
     publique par `(org, page)` et article par `(org, slug)`. Le filtre `published` est appliqué
     après.
   - Aperçu du bureau sans cache, listes et fiche du bureau sans cache, `canManageCurrentNewsDal`.
   - Aucun `logger`, aucune horloge dans un scope caché.
   - `src/lib/cms/render-page-block.ts` exporte `renderRestrictedMarkdown`, la même fonction que le
     bloc texte : aucun second schéma de sanitisation.
   - `newsImageUrl(key)` construit `/api/files/…`.
   - **Tests** :
     - le DAL public ne rend jamais un brouillon ni une actualité dépubliée, sur le patron de
       `association-settings-dal.test.ts` ;
     - `renderRestrictedMarkdown` retire `<script>`, les tableaux et le style, et garde `h2`/`h3`,
       listes et liens `https`.
5. [x] **Bureau : liste et édition.**
   - Routes `src/app/[locale]/(bureau)/bureau/actualites/page.tsx` et `…/[id]/page.tsx`, derrière
     `<Suspense>`, avec le contrôle d'accès répété (`BureauAccessDenied`).
   - Actions `…/[id]/actions.ts` :
     - `createNewsAction` crée puis redirige ;
     - `saveNewsDraftAction`, `publishNewsAction` (enregistre puis publie), `unpublishNewsAction` et
       `uploadNewsImageAction` ;
     - chacune appelle `requireActionAuth()` et `updateTag(newsListTag)` + `updateTag(newsItemTag)`
       **après** le succès.
   - Composants `src/components/features/news/` :
     - `news-list.tsx`, avec `table` puis cartes sous 640 px, `badge` à point + libellé, pagination
       écrite et état vide « Aucune actualité pour l'instant. → Écrire la première » ;
     - `news-editor.tsx`, avec `<PreviewBar />`, l'adresse en lecture seule, Titre, Date, Image
       (`file-upload`, `progress` indéterminée et nom du fichier, Remplacer/Retirer, Texte
       alternatif), `RestrictedMarkdownEditor`, succès ancré, erreur en 2ᵉ ligne de barre et erreur de
       champ sur l'alt, `alert-dialog` de dépublication.
   - « Actualités » dans `NAV_GROUPS`, groupe `siteGroup`, entre Pages et Navigation.
   - Libellés dans `messages/fr.json` (`BureauNewsPage`, `BureauIdentityPage.nav.news`).
   - **Tests** (jsdom) :
     - liste : état vide avec son lien, trois statuts écrits, un seul lien « Modifier » par ligne ;
     - éditeur : bouton contextuel « Publier l'actualité » / « Enregistrer et mettre à jour »,
       « Dépublier » seulement si publiée, erreur d'alt rendue sous le champ, adresse absente tant
       qu'il n'y a pas de slug ;
     - actions : `updateTag` appelé après succès et pas après échec, façade mockée, sur le patron de
       `bureau/navigation/actions.test.ts`.
6. [x] **Site public : liste et page d'une actualité.**
   - `src/app/[locale]/(public)/actualites/page.tsx` :
     - `h1` « Actualités », liste `max-w-[68ch]` ;
     - date en clair via `Intl.DateTimeFormat('fr-FR', {dateStyle:'long', timeZone:'UTC'})` sur la
       date ISO ;
     - titre `h2` en lien, vignette 4:3 **seulement si image**, « Lire l'actualité » ;
     - pagination « ← Précédent / Page x sur y / Suivant → », avec « Précédent » désactivé et annoncé
       en page 1 ;
     - état vide sans action ;
     - `notFound()` hors bornes.
   - `…/actualites/[slug]/page.tsx` :
     - « ← Toutes les actualités », date, `h1`, `<figure>` limitée à 520 px, contenu en `body-lg` ;
     - aperçu du bureau avec l'encart `role="status"`, lu sans cache ;
     - `notFound()` pour un visiteur sur un brouillon, une actualité dépubliée ou un slug inconnu ;
     - `generateMetadata` donne le titre.
   - Le texte public est **≥ 18 px** et les `h1` suivent le token de 34 px : les écarts 1 à 3 de la
     maquette ne sont pas reproduits.
   - **Tests** (jsdom, DAL mocké) :
     - ordre rendu = ordre reçu ;
     - pas de vignette sans image ;
     - pagination annoncée ;
     - 404 d'un brouillon pour un visiteur, aperçu pour le bureau.
7. [x] **Preuve e2e : `e2e/news.spec.ts`**, sur le patron de `e2e/page-cms.spec.ts` (mêmes tenants A
       et B, mêmes comptes).
   - La Présidente A crée une actualité (titre, date, image PNG, contenu) et la publie : elle paraît
     **en tête** de `/actualites`, et sa page s'ouvre.
   - Deux actualités de dates différentes paraissent dans l'ordre décroissant.
   - Pagination : 11 actualités publiées sur une association (insérées par SQL sous bypass pour la
     vitesse, puis nettoyées) donnent « Page 1 sur 2 », et la plus ancienne est en page 2.
   - Un brouillon est absent de la liste et répond 404 à son URL pour un visiteur, mais reste visible
     en aperçu pour le bureau.
   - Le titre modifié après publication garde la même URL.
   - Un membre simple ne voit pas l'écran de gestion.
   - L'actualité de A est absente de `/actualites` sur B, et son URL répond 404 sur B.
   - La RLS refuse, en SQL direct sous le rôle applicatif, de lire la ligne de A depuis le scope de B.
8. [x] **Documentation d'architecture.**
   - `docs/architecture.md` :
     - classement RLS : `news` ajoutée aux tables scopées, le décompte passe à 25 ;
     - ligne `posts…` réécrite selon l'ADR 023 : blog hérité exempté, hors produit ;
     - Data model : `news` ;
     - fichiers : portées et route `/api/files`.
   - `.claude/rules/01-presentation/rule-upload-file.md` : paragraphe « chaînes qui utilisent le
     stockage » complété de la chaîne de contenu partagée.
   - **Vérifié** par `pnpm check:rules` et par la relecture de revue. Les tâches 1 à 7 échouent si le
     code contredit ces documents.

## Files touched

**Créés** :

- modèle et migrations : `src/db/models/news-model.ts`, `drizzle/migrations/0016_*.sql` (modèle),
  `drizzle/migrations/0017_news_rls.sql` (policy, `--custom`) et leurs snapshots générés ;
- domaine et services : `src/services/types/domain/news-types.ts`,
  `src/services/types/domain/content-file-types.ts` (+ test),
  `src/services/validation/news-validation.ts`, `src/db/repositories/news-repository.ts`,
  `src/services/news-service.ts`, `src/services/content-file-service.ts`,
  `src/services/facades/news-service-facade.ts`,
  `src/services/facades/content-file-service-facade.ts`, leurs intercepteurs,
  `src/services/__tests__/news-service.test.ts`, `src/services/__tests__/content-file.test.ts` ;
- DAL et routes : `src/app/dal/news-dal.ts` (+ test), `src/app/api/files/[...key]/route.ts` (+ test),
  `src/app/[locale]/(bureau)/bureau/actualites/page.tsx`, `…/[id]/page.tsx`, `…/[id]/actions.ts`
  (+ test), `src/app/[locale]/(public)/actualites/page.tsx`, `…/[slug]/page.tsx` (+ tests) ;
- composants : `src/components/features/news/news-list.tsx` et `news-editor.tsx` (+ tests) ;
- e2e : `e2e/news.spec.ts` ;
- **documents de la story** : `docs/research/s05-actualites.md`,
  `docs/designs/s05-actualites{-brief.md,.md,.html}`, `docs/plans/s05-actualites.md`, ADR 023.

**Modifiés** :

- `src/db/models/db.ts` ;
- `src/services/types/domain/action-registry-types.ts` ;
- `src/services/types/domain/page-block-types.ts` : enveloppes et slug réservé ;
- `src/services/page-service.ts` : lecture déléguée ;
- `src/app/api/pages/files/[...key]/route.ts` : réexport ;
- `src/lib/cms/render-page-block.ts` : export ;
- `src/components/features/association/bureau-sidebar.tsx` ;
- `messages/fr.json` ;
- `docs/architecture.md` ;
- `.claude/rules/01-presentation/rule-upload-file.md`.

**Non commité** : `docs/designs/s05-actualites.zip`, l'export brut du canevas, n'entre pas dans le
commit.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** :
  - services : trois rôles globaux plus les rôles d'organisation, DAO mockés, ordre validation →
    autorisation → écriture ;
  - domaine : clés de fichier, slug, validation de publication ;
  - DAL : filtre `published` ;
  - rendu : sanitisation ;
  - composants et actions : états du design et `updateTag` après succès.
- **e2e (Playwright, build de production, base éphémère)** : les critères 1 à 4 de bout en bout. La
  RLS et l'accès croisé ne sont prouvables que là.
- **Non-régression** :
  - les suites de s04 (`page-*`, `render-page-block`, `e2e/page-cms.spec.ts`) et de s04b restent
    vertes sans modification de leurs attentes. C'est la preuve que la factorisation des fichiers
    n'a rien changé pour les pages.
  - `pnpm lint`, `pnpm tsc --noEmit` (voir la mémoire : supprimer `.next/types/routes.d.ts` si tsc
    ne se plaint que de `.next/`) et `pnpm check:rules`.
  - Pas de `pnpm build` automatique (AGENTS.md), sauf pour lancer l'e2e contre le build de
    production, comme le veut la règle CI.

## Definition of Done

- Un seul commit de story sur `feature/s05-actualites`, plus un second pour la migration si
  l'implémenteur la juge à isoler. Il porte la recherche, le design, le plan, l'ADR 023 et le code.
- Les quatre critères sont couverts par des tests verts : unitaires et `e2e/news.spec.ts`.
- La RLS forcée est en place sur `news`, avec une preuve d'accès croisé en e2e.
- L'action `news.manage` est déclarée au registre.
- `actualites` est réservé, et aucun `withRlsBypass` nouveau n'apparaît hors des e2e.
- Aucune valeur métier en dur. Libellés dans `messages/fr.json`.
- Aucune régression sur s04 et s04b, lint et types propres.
- Revue `/ks-review` passée : `Ship allowed: yes`.
