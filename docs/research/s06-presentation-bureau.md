# Research — Story s06-presentation-bureau

## Target story

**En tant que** membre du bureau **je veux** tenir à jour l'organigramme et les fiches du bureau
**afin que** la page de présentation reste juste après chaque renouvellement.

Complexité 2. Dépend de **s04** (livrée, mergée : `94b4906`, PR #21). Réf. `V5 §4.1` (« organigramme
et présentation de chaque membre, mis à jour dynamiquement »), `CDCT §4.1`, PRD l. 71 « Présentation
du bureau (fiches listables et éditables) » : « explicitement pas une page statique : sous-modèle
nom / rôle / photo / bio, réordonnable ». En appui du « Why kill it » n° 2 (vitrine publique
éditable, PRD l. 29) et du critère « le bureau doit pouvoir tout éditer sans intervention du
prestataire ».

### Acceptance criteria (docs/stories.md l. 720-754)

1. Le bureau crée, modifie, réordonne et supprime des fiches (nom, rôle, photo, biographie courte)
   depuis le back-office.
2. La page publique affiche les fiches dans l'ordre défini par le bureau, avec la photo
   redimensionnée et un texte alternatif.
3. Retirer une fiche la fait disparaître de la page publique ; les fiches restantes se renumérotent
   sans trou dans l'ordre d'affichage.
4. Une fiche sans photo affiche un visuel de repli, pas une image cassée.

### Notes de la story à tenir

- À ne **pas** confondre avec la fiche membre propriétaire (s12) ni avec la page « Contacts utiles »
  (contenu CMS ordinaire, s04). Trois choses distinctes.
- **Nombre de membres** affiché sur la page de présentation (calculé ou saisi) : question ouverte du
  `CDCT §4.1`, à trancher en `/ks-design`, saisie manuelle en repli « si la base membres n'existe pas
  encore à ce stade ».
- Deuxième des trois modèles répétables (s05 actualités, s06 fiches, s09 analyses d'eau) : la note de
  s05 demandait de factoriser tout motif commun **avant** s09 — c'est l'objet de l'ADR 023 (voir
  Trap 1).
- Règles transverses (`docs/stories.md` l. 36-70) : multi-tenant + test d'accès croisé, rien en dur,
  couches, Cache Components, **registre d'actions**.
- `docs/reviews/stories.md` : `Stories ready: yes`.

---

## Current state of the code

Vérifié le 22 septembre 2026 dans `/workspace`, `HEAD` = `0b328a2` (s03c, identique à `main`), branche
courante `feature/s05-actualites` **sans aucun fichier de code modifié** (seuls des documents s05
non suivis : ADR 023, design, recherche, plan). ⚠️ D'autres agents travaillent dans le même arbre
(s07, s08, s09) : l'état ci-dessous est celui lu à cette date.

**Aucune trace de la fonctionnalité** : `grep -rniE "board_member|boardMember|organigramme|fiche.{0,5}bureau"`
sur `src`, `messages`, `e2e`, `drizzle` ne rend rien. Les seules mentions sont documentaires :
ADR 007 (l. 15, 23 — fiches du bureau = modèle à **champs fixes**), `docs/architecture.md` l. 200
(`board_member` listé parmi les modèles à champs fixes), ADR 023, design system §9 (gap « photo
manquante », l. 922).

### s05 — pas encore dans le code, mais structurant pour s06

`docs/plans/s05-actualites.md` (`validated: yes`) coche les tâches 1 à 5, **mais aucun des fichiers
qu'il crée n'existe dans cet arbre** : ni `src/db/models/news-model.ts`, ni
`src/services/types/domain/content-file-types.ts`, ni `src/app/api/files/`. L'exécution a lieu
ailleurs ou n'est pas commitée. L'**ADR 023** (non suivi, `accepted`) décide pour s06 :

- une **chaîne de fichiers de contenu partagée** : module isomorphe `content-file-types.ts` décrivant
  des **portées** (`pages`, `news` ; « s06 et s09 y ajouteront la leur »), clé
  `{organizationId}/{portée}/{ownerId}/{slotId}-{uuid}.{ext}`, route publique unique
  `GET /api/files/[...key]` ; `/api/pages/files` gardée par le même gestionnaire ;
- « s06 et s09 déclarent leur portée de fichier et leur colonne `…_key`. Ils n'écrivent ni validation
  de clé, ni route de lecture » ;
- `renderRestrictedMarkdown` exporté de `src/lib/cms/render-page-block.ts` (tâche 4 du plan s05) ;
- entrée « Actualités » dans `NAV_GROUPS`, groupe `siteGroup`, entre Pages et Navigation.

### La chaîne « pages » de s04 et la navigation de s04b — les gabarits réels

| Couche        | Fichier                                                                | Ce qui sert à s06                                                                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle        | `src/db/models/menu-item-model.ts`                                     | Le plus proche d'une fiche : `organization_id` **direct** (FK cascade), `rank integer NOT NULL`, `created_at`/`updated_at` avec fuseau. **Aucune contrainte d'unicité sur `(organization_id, rank)`.**                                                  |
| Migration RLS | `drizzle/migrations/0015_menu_item_rls.sql`                            | Patron exact : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation` sur `NULLIF(current_setting('app.organization_id', true), '')::uuid` ou `app.bypass_rls = 'on'`. Dernière migration : `0015` (s05 prévoit `0016`/`0017`).               |
| Repository    | `src/db/repositories/menu-item-repository.ts`                          | `getDb()` partout ; `getMenuItemsByOrganizationDao` (tri `asc(rank)`), `addMenuItemDao`, `removeMenuItemDao`, `reorderMenuItemsTxnDao(organizationId, orderedIds)` — rang = **position dans le tableau**, une transaction.                              |
| Repository    | `src/db/repositories/page-repository.ts:116` `reorderPageBlocksTxnDao` | Supprime les blocs absents de la liste puis réécrit chaque rang depuis la position : **seul précédent qui garantit des rangs sans trou** après une suppression.                                                                                         |
| Service       | `src/services/site-navigation-service.ts`                              | Ordre `safeParse` → `requireNavigationManager` (`canPerformAction(..., SITE_NAVIGATION_MANAGE)`) → `withTenant`. `addMenuItemService` pose `rank: existing.length`. Lecture publique `getPublicSiteNavigationService` **sans autorisation, délibérée**. |
| Service       | `src/services/page-service.ts`                                         | Upload : `safeParse` → `requirePageManager` → propriétaire existant → `validatePageBlockFile` (signature binaire) → `buildPageBlockFileKey` → `getPageFileStorage().upload`. `getPageFileStorage` = `createStorage('local', {bucket: 'pages', …})`.     |
| Service       | `src/services/association-identity-service.ts:85-169`                  | **Seul précédent de suppression de fichier** : `storage.delete(previousKey)` après l'écriture en base, nettoyage de la nouvelle clé en cas d'échec.                                                                                                     |
| Façade        | `src/services/facades/{page,site-navigation}-service-facade.ts`        | Réexport des méthodes de `interceptors/*-service-logger-interceptor.ts`.                                                                                                                                                                                |
| DAL           | `src/app/dal/page-dal.ts`, `site-navigation-dal.ts`                    | Lecture interne `'use cache'` + `cacheLife('hours')` + `cacheTag(tag(orgId…))`, liste du bureau **non cachée**, `canManageCurrent…Dal`.                                                                                                                 |
| Actions       | `src/app/[locale]/(bureau)/bureau/navigation/actions.ts`               | `requireActionAuth()` puis service, `updateTag(siteNavigationTag(tenant.id))` **après** succès ; `actions.test.ts` à côté.                                                                                                                              |
| Écran bureau  | `src/app/[locale]/(bureau)/bureau/navigation/page.tsx`                 | `<Suspense>` + contrôle d'accès **répété** (`BureauAccessDenied`) ; actions passées en props au composant client.                                                                                                                                       |
| Composant     | `src/components/features/navigation/site-navigation-manager.tsx`       | Réemploi **tel quel** de `<SortableList />`, écriture immédiate à chaque déplacement (`reorderAction(nextItems.map(id))`), bande d'annulation 10 s pour le retrait, erreur ancrée, jamais en toast.                                                     |
| Primitive     | `src/components/ui/sortable-list.tsx`                                  | Monter/Descendre toujours visibles, annonce `aria-live`, annulation.                                                                                                                                                                                    |
| Primitive     | `src/components/ui/avatar.tsx`                                         | Radix Avatar, **`'use client'`**, `Avatar` / `AvatarImage` / `AvatarFallback`, taille par défaut `size-8`, `rounded-full`.                                                                                                                              |
| Layout public | `src/app/[locale]/(public)/layout.tsx`                                 | Menu = entrées de `menu_item` visibles dont la page est publiée, lien `/${entry.slug}`.                                                                                                                                                                 |
| Layout bureau | `src/app/[locale]/(bureau)/layout.tsx`                                 | Garde `canManageCurrentAssociationIdentityDal()` derrière `<Suspense>`, puis `BureauSidebar`.                                                                                                                                                           |
| Sidebar       | `src/components/features/association/bureau-sidebar.tsx:21-36`         | `NAV_GROUPS` : `siteGroup` (`/bureau/pages`, `/bureau/navigation`) puis `group` (`/bureau/identite`, `/bureau/reglages`), libellés `BureauIdentityPage.nav.*`.                                                                                          |
| e2e           | `e2e/site-navigation.spec.ts`, `e2e/page-cms.spec.ts`                  | Tenants A = `http://localhost:${PORT}`, B = `http://127.0.0.1:${PORT}` ; `user-owner@gmail.com` (Présidente A), `user@gmail.com` (membre simple A) ; mot de passe `Azerty123`.                                                                          |

### Les images aujourd'hui

- Aucune image de contenu n'est redimensionnée. Le rendu public des blocs (`render-page-block.ts`)
  émet un `<img src="/api/pages/files/…" loading="lazy">` brut ; le bureau affiche l'aperçu par
  `next/image` **`unoptimized`** (`image-block-form.tsx:65-70`, `gallery-block-form.tsx:79-84`).
- `next.config.ts` : `images.remotePatterns` (placeholder, unsplash) seulement, **pas de
  `localPatterns`**. `sharp@0.35.3` est présent dans `node_modules/.pnpm` (dépendance de `next`), pas
  en dépendance directe de `package.json`.
- Aucune dépendance de traitement d'image côté serveur n'est utilisée dans `src/`.

---

## Anchor points

- **Modèle + migration** : nouveau fichier `src/db/models/<…>-model.ts`, enregistré dans
  `src/db/models/db.ts` (`schema: {...page, ...contentBlock, ...menuItem, ...}` l. 32-45) ; policy par
  `drizzle-kit generate --custom` sur le patron `0015_menu_item_rls.sql` (organisation portée
  directement, sans jointure). Numéro de migration dépendant de l'ordre de merge de s05/s07/s08/s09.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts` — `ActionIdConst`
  (l. 43-60) et `ACTION_REGISTRY` (l. 62-79). Précédents `PAGE_MANAGE` et `SITE_NAVIGATION_MANAGE`,
  une entrée unique pour tous les verbes, `['owner', 'board']`.
- **Fichier (photo)** : portée à déclarer dans `content-file-types.ts` (ADR 023, **créé par s05**),
  colonne `…_key` sur la table de s06 ; lecture par `/api/files/[...key]`.
- **Service / façade / intercepteur** : gabarit `site-navigation-service.ts` pour la liste ordonnée,
  `page-service.ts` pour l'upload, `association-identity-service.ts` pour la suppression de l'ancien
  fichier.
- **DAL** : gabarit `site-navigation-dal.ts` (un seul tag par association suffit : la page publique
  est une liste unique, non paginée a priori).
- **Back-office** : `src/app/[locale]/(bureau)/bureau/<segment>/{page.tsx,actions.ts}` ; entrée dans
  `NAV_GROUPS` ; libellés dans `messages/fr.json`.
- **Page publique** : segment statique sous `src/app/[locale]/(public)/`, à ajouter à
  `RESERVED_PAGE_SLUGS` **dans le même commit** (ADR 020, commentaire l. 83-86 de
  `page-block-types.ts`).
- **e2e** : nouveau `e2e/<…>.spec.ts` sur le patron de `site-navigation.spec.ts` / `page-cms.spec.ts`.

## Verified APIs / functions

| Nom                                                   | Fichier                                                                          | Signature vérifiée                                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireCurrentTenantDal` / `getCurrentTenantDal`     | `src/app/dal/tenant-dal.ts:93` / `:71`                                           | `() => Promise<TenantDTO>` / `cache(...)` rendant le tenant ou `undefined`                                                                                  |
| `requireEnabledModuleDal`                             | `src/app/dal/tenant-dal.ts:131`                                                  | `(moduleKey) => Promise<TenantDTO>` — **non pertinent** : modules connus `vote`, `voirie`, `annonces` (`auth-model.ts:158`) ; le bureau n'est pas un module |
| `getDb` / `withTenant` / `withRlsBypass`              | `src/db/tenant-scope.ts`                                                         | `getDb(): ScopedDb` ; `withTenant(organizationId, callback)` ; `withRlsBypass(callback)`                                                                    |
| `canPerformAction`                                    | `src/services/authorization/action-registry-authorization.ts`                    | `(user, organizationId, actionId) => boolean`                                                                                                               |
| `canManageAssociation`                                | `src/services/authorization/association-authorization.ts`                        | `(user, organizationId) => boolean` — affichage, pas mutation                                                                                               |
| `ActionIdConst` / `ACTION_REGISTRY`                   | `action-registry-types.ts:43` / `:62`                                            | 4 entrées : `association.identity.update`, `association.settings.update`, `page.manage`, `site.navigation.manage`                                           |
| `reorderMenuItemsTxnDao`                              | `menu-item-repository.ts`                                                        | `(organizationId, orderedIds: string[]) => Promise<void>` — `rank = index`, ne vérifie pas que la liste est complète                                        |
| `removeMenuItemDao` / `removeMenuItemService`         | `menu-item-repository.ts` / `site-navigation-service.ts:123`                     | `DELETE` seul, **sans renumérotation** des rangs suivants                                                                                                   |
| `reorderPageBlocksTxnDao`                             | `page-repository.ts:116`                                                         | `(pageId, blocks: ReorderedPageBlock[]) => Promise<PageBlockRow[]>` — supprime les absents, réécrit les rangs                                               |
| `SortableList`                                        | `src/components/ui/sortable-list.tsx`                                            | props `{items, getId, getLabel, onReorder(nextItems, moved), renderItem(item, {index,total,isDragging}), showMoveButtons?, undoWindowMs?}`                  |
| `Avatar`, `AvatarImage`, `AvatarFallback`             | `src/components/ui/avatar.tsx`                                                   | primitives Radix, composant **client**                                                                                                                      |
| `getAssociationMonogram`                              | `src/services/types/domain/association-identity-types.ts:157`                    | `(name: string) => string` — initiales, mais **ignore un « ASL » en tête** : règle propre au nom d'association                                              |
| `describeFileSize`                                    | `association-identity-types.ts:202`                                              | `(bytes) => {unit, value}` — poids lisible pour les consignes                                                                                               |
| `validatePageBlockFile` / `PAGE_FILE_MAX_BYTES`       | `page-block-types.ts`                                                            | `(kind: 'image' \| 'document', content: Uint8Array) => PageFileValidation` ; image = PNG/WebP/JPEG, **5 Mo**                                                |
| `buildPageBlockFileKey` / `isPageBlockFileKeyAllowed` | `page-block-types.ts`                                                            | liés au préfixe `{org}/pages/` — à envelopper par `content-file-types.ts` selon l'ADR 023                                                                   |
| `RESERVED_PAGE_SLUGS` / `isPageSlugReserved`          | `page-block-types.ts`                                                            | contient déjà **`bureau`** (et `annonces`, `voirie`, `vote`, `blog`…)                                                                                       |
| `StorageOperations`                                   | `src/lib/files/storage/types.ts`                                                 | `{upload(file, path), download(path), delete(path), list(path)}`                                                                                            |
| `renderPageBlock`                                     | `src/lib/cms/render-page-block.ts`                                               | `(block: {type, data}) => string \| null` ; `renderMarkdown` **privé** aujourd'hui (s05 prévoit `renderRestrictedMarkdown`)                                 |
| `updateTag`                                           | `next/cache`                                                                     | usage réel : `bureau/navigation/actions.ts`, `bureau/pages/[id]/actions.ts`                                                                                 |
| `images.localPatterns`                                | `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:512` | requis pour optimiser un chemin local ; un chemin **avec query string** exige `search` (breaking change Next 16, `upgrading/version-16.md:664`)             |

## Traps & constraints

1. **Dépendance réelle sur s05, pas seulement s04.** Le tableau d'ordonnancement dit « s04 » ; l'ADR 023
   fait de s06 un **client** de la chaîne de fichiers partagée (`content-file-types.ts`,
   `/api/files`), qui n'existe pas encore dans le code. Brancher `feature/s06-presentation-bureau`
   depuis `main` avant le merge de s05 obligerait soit à recréer la chaîne (ce que l'ADR 023 interdit),
   soit à retomber sur une route par modèle. Attendre le merge de s05, ou planifier contre les noms
   de l'ADR 023 et rebaser.
2. **`/bureau` est pris.** C'est le back-office (`src/app/[locale]/(bureau)/bureau`), et `bureau` est
   dans `RESERVED_PAGE_SLUGS`. La page publique doit avoir un autre segment (ex. `le-bureau`,
   `equipe`…), à ajouter à `RESERVED_PAGE_SLUGS` dans le même commit ; vérifier qu'aucune page du
   seed ni des e2e ne porte ce slug (le seed ne crée **aucune** page, `seed.ts` vérifié). Le même
   homonyme guette les libellés : une rubrique « Bureau » dans l'**espace bureau** est ambiguë.
3. **« Se renumérotent sans trou » n'a pas de précédent direct.** `removeMenuItemService` supprime sans
   renuméroter (rangs 0, 2, 3 possibles), et `reorderMenuItemsTxnDao` accepte une liste partielle.
   Seul `reorderPageBlocksTxnDao` garantit des rangs contigus, en réécrivant tout. Le critère 3 exige
   que la suppression et la renumérotation soient **atomiques** (une transaction), et le test doit
   vérifier les rangs en base, pas seulement l'ordre affiché. Pas de contrainte d'unicité
   `(organization_id, rank)` dans les précédents : si on en pose une, la réécriture rang par rang
   la viole transitoirement (contrainte `DEFERRABLE` ou passage par des rangs temporaires).
4. **« Photo redimensionnée » : rien ne redimensionne aujourd'hui.** Trois voies, aucune tranchée :
   (a) `next/image` optimisé sur `/api/files/**` — exige `images.localPatterns` dans
   `next.config.ts`, `sharp` en production (présent seulement en dépendance transitive), et
   **l'optimiseur doit rappeler la route de fichier avec l'hôte d'origine**, sans quoi le tenant ne se
   résout pas (non vérifié, voir Open question 3) ; (b) redimensionnement à l'upload côté serveur
   (dépendance directe à `sharp` = changement de dépendance) ; (c) simple contrainte CSS
   (`object-cover` dans un carré) — le poids servi reste celui d'origine, ce qui ne satisfait
   probablement pas l'esprit du critère.
5. **Plafond de corps des Server Actions : 2 Mo, contre 5 Mo pour une image.** `next.config.ts` fixe
   `serverActions.bodySizeLimit: '2mb'` (réglé pour le logo de 1 Mo), alors que `PAGE_FILE_MAX_BYTES.image`
   vaut 5 Mo et que l'upload de bloc passe par une Server Action (`uploadPageBlockFileAction`). Une photo
   de téléphone de 3 Mo est rejetée **par Next avant la validation**, sans le message « Il pèse… ». Défaut
   latent hérité de s04 (et de s05), mais c'est s06 — portraits pris au téléphone — qui le rencontrera
   en premier. À traiter ou à signaler, pas à découvrir en recette.
6. **Texte alternatif** (critère 2) : pour s04, l'alt d'une image est **saisi** et obligatoire pour
   publier. Pour un portrait, il peut être dérivé du nom (« Photo de … ») ou saisi. Dérivé = aucun
   champ en plus, mais un alt identique au nom écrit juste à côté est redondant pour un lecteur
   d'écran (alt vide + nom en légende est l'autre option accessible). À trancher en design.
7. **Visuel de repli** (critère 4) : gap ouvert du design system (§9, l. 922 : « initiales,
   silhouette, ou rien ? »). La règle de §1.8 **interdit la silhouette** pour le logo, pas pour une
   personne. `getAssociationMonogram` n'est pas réutilisable tel quel (il ignore « ASL »). `AvatarFallback`
   est client : il s'affiche aussi quand l'image échoue (fichier absent), ce qui couvre « pas d'image
   cassée » — mais le rendu serveur initial montre le repli jusqu'à l'hydratation, puis bascule sur la
   photo. Un rendu serveur pur (`<img>` seulement si `photo_key` non nul, repli sinon) ne couvre pas le
   cas « clé présente, fichier disparu ». Ne pas inventer de variante : c'est un gap à faire trancher par
   `/ks-design`.
8. **Suppression d'une fiche = suppression du fichier.** Première suppression de contenu du produit avec
   fichier attaché (pages et actualités ne se suppriment pas). Précédent d'ordre :
   `association-identity-service.ts` écrit en base puis supprime l'ancien fichier, et journalise un
   échec de nettoyage sans faire échouer l'opération. Même question au remplacement d'une photo.
   `docs/stories.md` l. 1300-1312 (s12c) attend une colonne `…_key` par famille de fichier : la photo
   d'une fiche doit **avoir sa propre colonne** (convention `_key`, ADR 023).
9. **Pas de statut brouillon/publié dans les critères.** Contrairement aux pages et actualités, rien
   n'exige de publier une fiche : toute fiche existante est publique. Conséquence : une fiche créée à
   moitié (sans photo, sans bio) est visible immédiatement. Décider si c'est voulu (plus simple, conforme
   aux critères) ou s'il faut un statut — sans l'ajouter en silence.
10. **Donnée personnelle publiée.** Nom, photo et biographie de bénévoles, sur un site public référencé
    (angle n° 2 du PRD). Aucun critère ne parle de consentement ; `docs/stories.md` renvoie déjà
    d'autres sujets au conseil RGPD. À signaler, pas à coder sans décision.
11. **Aucun lien avec les comptes.** La fiche ne doit **pas** être une FK vers `user` / `member` : un
    membre du bureau peut ne pas avoir de compte (100 propriétaires sur 400 n'ont pas d'email), et le
    rôle d'organisation technique `board` n'est pas le « rôle » affiché (Président, Trésorière…, texte
    libre ou liste ?). « Rôle » affiché ≠ rôle d'autorisation : homonymie à éviter dans les noms de
    colonnes et de types (mémoire : « deux admin homonymes »).
12. **« Rôle » : texte libre ou liste fermée ?** Une liste fermée serait une catégorie codée en dur
    (interdit, ADR 010) ; un texte libre est le plus simple et reste conforme. Idem pour le libellé de
    l'organigramme éventuel (critère « organigramme » du récit, absent des critères d'acceptation).
13. **Nombre de membres** (note de la story) : la base membres n'existe pas (`member_profile` = s12, non
    livrée, aucun fichier ne la mentionne). Le compter depuis la table Better Auth `member` compterait
    des **comptes**, pas des propriétaires. Si saisie manuelle : un paramètre d'association au registre
    (ADR 016, `association-settings-types.ts:151`, 4 clés aujourd'hui) plutôt qu'une colonne ad hoc.
14. **Cache Components.** Page publique en `'use cache'` + `cacheLife` + `cacheTag(tag par association)`,
    invalidé par `updateTag` **après** chaque création, modification, réordonnancement, suppression et
    changement de photo. Aucun `logger`, aucune horloge dans le scope (compromis de l'intercepteur hérité,
    commenté dans `page-dal.ts`). `Avatar` étant client, le composant public mélange RSC caché et îlot
    client : vérifier que le prerender ne casse pas.
15. **Accès depuis le site.** `menu_item.page_id` est NOT NULL : le menu ne pointe que vers une page CMS.
    Même limite que s05 (Trap 8 de sa recherche) : sans extension de s04b, la page du bureau n'est
    atteignable que par un lien écrit à la main (page, pied de page). Hors critères.
16. **Biographie courte** : texte brut (plus sûr, rendu échappé) ou markdown restreint via
    `renderRestrictedMarkdown` de s05 ? L'ADR 023 veut « une seule liste de balises autorisées pour tout
    le texte riche » : si markdown, **cette** fonction, jamais un second sanitiseur. Longueur maximale à
    fixer.
17. **Design system à réemployer.** `<SortableList />` tel quel (boutons Monter/Descendre = voie
    recommandée, §2.4) ; `file-upload` + `progress` indéterminée + nom du fichier (§2.1, §3.2) ;
    `alert-dialog` pour la suppression, **irréversible**, bouton nommant l'acte (§2.1) ; état vide rédigé
    sur le modèle « Aucune … pour l'instant. → … » (§3.2) ; succès/erreur ancrés, jamais en toast. Aucune
    carte de fiche ni grille de portraits n'est maquettée : `/ks-design s06` compose ou remonte un gap.
18. **Process** : `pnpm test --run` ; migrations par `pnpm db:generate` / `drizzle-kit generate --custom`,
    jamais de SQL ni de journal à la main — le numéro dépendra de l'ordre de merge des stories en
    parallèle (s05 réserve `0016`/`0017`). Branche `feature/s06-presentation-bureau` depuis `main` à jour.
    Ce fichier de recherche voyage avec cette branche.

## Open questions

1. **Ordre avec s05** : attendre le merge de s05 (chaîne `/api/files`, `content-file-types.ts`,
   `renderRestrictedMarkdown`) avant de brancher s06, ou planifier contre les noms de l'ADR 023 et
   rebaser ? Le tableau de dépendances (`docs/stories.md` l. 2954) ne cite que s04.
2. **URL et libellé de la page publique** (`/bureau` est réservé au back-office) : quel segment, quel
   titre, et quel nom de rubrique dans la barre latérale pour éviter « Bureau » dans l'espace bureau ?
3. **Redimensionnement** (critère 2) : `next/image` optimisé sur la route de fichiers (à vérifier :
   l'optimiseur transmet-il l'hôte d'origine, condition de la résolution du tenant ? `sharp` disponible
   sur le VPS ?), redimensionnement à l'upload (nouvelle dépendance directe), ou autre ? Quelles
   dimensions cibles et quel cadrage (carré, `object-cover`) ?
4. **Visuel de repli** (critère 4, gap design system §9) : initiales de la personne, silhouette, ou
   autre — et rendu serveur ou `AvatarFallback` client (qui couvre aussi le fichier disparu) ?
5. **Texte alternatif** : dérivé du nom ou saisi (et alors obligatoire) ?
6. **Plafond 2 Mo des Server Actions** contre 5 Mo d'image : relever `bodySizeLimit`, abaisser le plafond
   des photos, ou uploader autrement ? Le choix touche aussi s04 et s05.
7. **Statut de publication d'une fiche** : aucune (toute fiche est publique, conforme aux critères) ou
   brouillon/publié comme les pages ?
8. **Forme des champs** : rôle en texte libre (recommandé par l'ADR 010) ; biographie en texte brut ou en
   markdown restreint, longueur maximale ; nom obligatoire seul ou nom + rôle obligatoires ?
9. **Organigramme** : le récit parle d'« organigramme », les critères seulement d'une liste ordonnée.
   Une liste ordonnée suffit-elle, ou faut-il des groupes (ex. bureau / conseil syndical) ?
10. **Nombre de membres** (note de la story, `CDCT §4.1`) : affiché sur cette page ou sur la
    présentation de l'association ? Saisie manuelle via un paramètre du registre (ADR 016) en attendant
    s12 ? À trancher en `/ks-design`.
11. **Consentement / RGPD** pour la publication du nom et de la photo des bénévoles : hors produit, ou
    mention à prévoir ?
12. **Accès depuis le menu** (Trap 15) : lien manuel, ou extension de `menu_item` hors de cette story ?
    À signaler, pas à ajouter en silence.
13. **Contrainte d'unicité `(organization_id, rank)`** : la poser (et gérer la réécriture transitoire) ou
    garder la garantie applicative seule, comme `menu_item` ?
