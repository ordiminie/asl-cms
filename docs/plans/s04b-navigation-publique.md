---
validated: yes
---

# Plan — Story s04b-navigation-publique

Branch: `feature/s04b-navigation-publique`, à créer depuis `main` (s04 mergée, `94b4906`).

## Target story

**En tant que** membre du bureau **je veux** décider où mes pages apparaissent dans le menu et ce que
dit le pied de page **afin que** le visiteur trouve le site sans connaître les URL.

Acceptance criteria (`docs/stories.md`) :

1. Le bureau compose le **menu du site public** : ajouter une entrée pointant vers une page, la
   retirer, en changer l'ordre. Le menu rendu au visiteur reflète cet ordre.
2. Une page publiée mais absente du menu reste atteignable par son URL ; une entrée de menu pointant
   vers une page dépubliée ou supprimée **ne s'affiche pas** au visiteur, sans casser le rendu du menu.
3. Le bureau modifie le contenu du **pied de page** ; la modification est visible sur toutes les pages
   publiques.
4. Le menu et le pied de page sont **scopés au tenant**.
5. Publier ou dépublier une page depuis s04 met le menu à jour **sans délai de revalidation**.
6. Une entrée de menu porte sa **propre visibilité**, indépendante du statut de publication de sa page
   cible.
7. Un membre non-bureau ne peut modifier ni le menu ni le pied de page.

Décisions structurelles (voir **ADR 021**) :

- `menu_item` : table neuve, `organization_id` **direct** (comme `page`, pas jointe comme
  `content_block`), `page_id` (FK), `rank`, `visible`, unique `(organization_id, page_id)`.
- Pied de page : clé dédiée `site.footer_content` dans `organization_setting` (table existante depuis
  s02), lue/écrite **directement** via `organization-setting-repository.ts`, **hors** du registre typé
  `ASSOCIATION_SETTINGS_REGISTRY` (aucune interférence avec s02 : `resolveSettings` n'itère que ses
  propres clés).
- Une seule action au registre : `ActionIdConst.SITE_NAVIGATION_MANAGE` (rôles `['owner','board']`),
  couvrant menu et pied de page.
- Un seul tag de cache combiné : `siteNavigationTag(organizationId)` — menu et pied de page sont
  toujours lus ensemble par le layout public, donc invalidés ensemble. Le code existant de s04
  (`bureau/pages/[id]/actions.ts`) doit **aussi** appeler `updateTag(siteNavigationTag(...))` sur
  publier/dépublier (invalidation croisée, piège documenté par la recherche).
- Le menu et le pied de page **remplacent** la navigation et le pied de page SaaS actuels du layout
  public (contenu de démonstration du boilerplate, sans rapport avec une association) — décision de
  périmètre déjà actée par le design (`docs/designs/s04b-navigation-publique.md`).

## Tasks (ordered)

1. [x] **Schéma & persistance — `menu_item`.**
       `src/db/models/menu-item-model.ts` : `organizationId` (FK `organization`, cascade),
       `pageId` (FK `page`, cascade), `rank` (integer), `visible` (boolean, défaut `true`), timestamps,
       unique `(organization_id, page_id)`. Enregistrement dans `src/db/models/db.ts`. Migration
       `pnpm db:generate`, puis policy RLS forcée par `drizzle-kit generate --custom` sur
       `organization_id` directement (gabarit `page-model.ts`, pas `content-block-model.ts`). Mise à jour
       de `docs/architecture.md` (§ Classement RLS : 23 → 24 tables, 4 → 5 lignes scopées).
       `src/db/repositories/menu-item-repository.ts` (`getDb()`) : liste par organisation (jointe à `page`
       pour titre/statut), ajout, retrait, `reorderMenuItemsTxnDao` (transaction, gabarit
       `rule-transaction-dao.md`), bascule de visibilité.
       Vérifiable par : `pnpm db:generate` sans erreur, migration appliquée proprement en local ; pas de
       test unitaire direct (RLS non testable en unitaire, ADR 002) — la preuve vient de la tâche 8.

2. [x] **Registre d'actions — `SITE_NAVIGATION_MANAGE`.**
       Ajouter l'entrée dans `src/services/types/domain/action-registry-types.ts`
       (`ActionIdConst.SITE_NAVIGATION_MANAGE`, rôles `['owner','board']`), au même endroit que
       `PAGE_MANAGE`.
       Test unitaire : l'entrée existe, `isActionAllowedForRole` la résout pour `board`/`owner`, la refuse
       pour `member`.

3. [x] **Service — gestion du menu.**
       `src/services/site-navigation-service.ts` : `addMenuItemService`, `removeMenuItemService`,
       `reorderMenuItemsService`, `setMenuItemVisibilityService`. Ordre : `safeParse` (Zod) →
       `getAuthUser()` → `canPerformAction(user, organizationId, ActionIdConst.SITE_NAVIGATION_MANAGE)`
       → vérifier que la page cible appartient bien à cette organisation (jamais l'id d'une page d'une
       autre association, même valide ailleurs) → `withTenant(organizationId, ...)`.
       Tests unitaires (patron `rule-services-tests.md`, rôles OWNER/BOARD/MEMBER/PUBLIC) : bureau
       autorisé sur les quatre actions, membre simple refusé (`AuthorizationError`) ; ajouter une page déjà
       dans le menu refusé (contrainte unique remontée en erreur de validation, pas une exception brute) ;
       ajouter une page d'une autre organisation refusé ; retirer, réordonner (même fonction utilisée au
       clic bouton ou après un déplacement clavier — un seul chemin, donc pas de divergence possible entre
       souris et clavier) et basculer la visibilité fonctionnent pour le bureau.

4. [x] **Service — pied de page.**
       `src/services/site-navigation-service.ts` (même fichier) : `getSiteFooterService`,
       `saveSiteFooterService(organizationId, content)` — réutilise `getOrganizationSettingsDao` /
       `upsertOrganizationSettingsDao` (`organization-setting-repository.ts`) directement sur la clé
       `site.footer_content`, **sans** passer par `ASSOCIATION_SETTINGS_REGISTRY` (ADR 021). Validation
       Zod : chaîne, vide autorisé (vide = pas de pied de page affiché côté public). Même ordre
       authent/autorisation que la tâche 3.
       Tests unitaires : bureau lit/écrit, membre simple refusé ; une valeur vide est acceptée et distincte
       d'une absence de ligne ; aucune interférence avec `getAssociationSettingsService` (résolution du
       registre de s02 inchangée en présence de cette clé).

5. [x] **DAL + cache combiné + invalidation croisée avec s04.**
       `src/app/dal/site-navigation-dal.ts` : `siteNavigationTag(organizationId)` (exporté), fonction
       interne non exportée `'use cache'` + `cacheLife` + `cacheTag(siteNavigationTag(...))` qui lit le
       menu (entrées `visible = true` **et** page `status = 'published'` seulement) et le pied de page,
       pour le rendu public. `getSiteNavigationForBureauDal` non cachée (toutes les entrées, statuts
       compris, pour l'écran de gestion). `canManageCurrentSiteNavigationDal` (patron
       `canManageCurrentPagesDal`). `updateTag(siteNavigationTag(...))` appelé après chaque mutation du
       menu et après l'enregistrement du pied de page (Server Actions de la tâche 6).
       **Modifier le code existant de s04** : `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts`
       doit appeler en plus `updateTag(siteNavigationTag(tenant.id))` sur `publishPageService` et
       `unpublishPageService` — sinon publier/dépublier une page ne met pas à jour le menu qui la
       référence (piège documenté par la recherche, invisible en développement où le cache est froid).
       Pas de test unitaire direct (lecture derrière `'use cache'`) ; vérifié en revue + par la tâche 8.

6. [x] **Back-office — écran « Navigation du site ».**
       `src/components/features/association/bureau-sidebar.tsx` : nouvelle entrée
       `{href: '/bureau/navigation', labelKey: 'navigation'}` dans `NAV_GROUPS[0].items` (groupe « Le
       site »). `src/app/[locale]/(bureau)/bureau/navigation/page.tsx` : Card « Menu du site »
       (`<SortableList />` réutilisé à l'identique — même signature que s04, boutons Monter/Descendre
       toujours visibles, annonce `aria-live`, annulation 10 s — chaque ligne avec titre + statut de la
       page, `switch` de visibilité à effet immédiat, annotation « Masquée sur le site public… » si la
       page n'est pas publiée) + sélecteur d'ajout (`command`, pages de l'organisation pas déjà dans le
       menu) + Card « Pied de page » (`RestrictedMarkdownEditor` réutilisé — le composant construit par
       s04, pas Milkdown, ADR 019 — bouton `default` unique de l'écran « Enregistrer »).
       `src/app/[locale]/(bureau)/bureau/navigation/actions.ts` : Server Actions add/remove/reorder/toggle
       (immédiates) et save-footer, chacune appelant `updateTag(siteNavigationTag(...))` après succès.
       Test : rendu par rôle (bureau agit, membre simple n'a pas accès à la route) ; les actions du menu
       n'ont pas de bouton d'enregistrement séparé.

7. [x] **Rendu public — remplacement du header/footer de démonstration.**
       `src/app/[locale]/(public)/layout.tsx` : la nav statique (Privacy/Terms/Docs/Blog codés en dur) est
       remplacée par les entrées du menu lues via `src/app/dal/site-navigation-dal.ts` ; menu vide → pas de
       zone de navigation visible (aucun conteneur vide). `src/components/features/layouts/public-footer.tsx`
       : réécrit pour rendre le contenu de `site.footer_content` (rendu texte riche restreint, mêmes règles
       que le bloc « texte riche » des pages, §4 du design system) au lieu du texte SaaS en dur ; devient
       tenant-scopé (`cacheTag(siteNavigationTag(...))` au lieu de son `cacheLife('days')` non tagué
       actuel). `PublicMobileMenu` : contenu remplacé par les mêmes entrées.
       Test e2e (production build) : le menu et le pied de page rendus reflètent la composition du bureau ;
       une entrée masquée (bascule ou page non publiée) est absente, sans espace vide.

8. [x] **Preuve d'isolation multi-tenant + invalidation croisée en conditions réelles.**
       `e2e/site-navigation.spec.ts` (patron allégé `page-cms.spec.ts`/`association-settings.spec.ts`,
       tenants seedés) : un menu composé dans le tenant A n'apparaît pas sur le domaine du tenant B ;
       membre non-bureau refusé en écriture (menu et pied de page) ; **publier une page depuis l'éditeur
       de s04 met à jour le menu public qui la référence sans redémarrage** (le critère 5, et la preuve
       directe que la tâche 5 a bien modifié le code existant de s04) ; une entrée dont le `switch` est
       basculé sur « masquée » reste absente du rendu même si sa page est publiée (critère 6, indépendance
       des deux statuts).

## Files touched

- `src/db/models/menu-item-model.ts`, `src/db/models/db.ts`
- `drizzle/migrations/00XX_menu_item.sql`, `drizzle/migrations/00XX_menu_item_rls.sql`
- `docs/architecture.md` (classement RLS)
- `src/services/types/domain/action-registry-types.ts`
- `src/services/site-navigation-service.ts`, `src/services/validation/site-navigation-validation.ts`
- `src/db/repositories/menu-item-repository.ts`
- `src/services/facades/site-navigation-service-facade.ts`
- `src/app/dal/site-navigation-dal.ts`
- `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts` (modifié, pas neuf — invalidation croisée)
- `src/components/features/association/bureau-sidebar.tsx`
- `src/app/[locale]/(bureau)/bureau/navigation/page.tsx`,
  `src/app/[locale]/(bureau)/bureau/navigation/actions.ts`
- `src/app/[locale]/(public)/layout.tsx`, `src/components/features/layouts/public-footer.tsx`,
  `src/components/features/layouts/public-mobile-menu.tsx`
- `e2e/site-navigation.spec.ts`
- `docs/decisions/021-navigation-menu-item-et-pied-de-page.md`

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : service (autorisation par rôle, page hors organisation
  refusée, doublon refusé, réordonnancement, pied de page vide autorisé, tâches 2-4). Base et auth
  mockées.
- **e2e (Playwright, production build, base éphémère seedée)** : parcours bureau complet (tâche 6-7),
  isolation multi-tenant et invalidation croisée avec s04 en conditions réelles (tâche 8).
- Traductions (`messages/en.json`/`messages/es.json`) : réellement traduites dès l'écriture, pas
  recopiées du français — piège déjà mordu deux fois pendant la revue de s04.

## Definition of Done

- Les 7 critères d'acceptation sont couverts par au moins un test qui échouerait sans l'implémentation.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` passent ; `pnpm test:e2e --project=chromium` passe
  sur `e2e/site-navigation.spec.ts`.
- `docs/architecture.md` reflète la nouvelle table RLS (23 → 24) ; l'ADR 021 est présent et non
  contredit par le code livré.
- `bureau/pages/[id]/actions.ts` (code de s04) invalide bien `siteNavigationTag` en plus de `pageTag`
  sur publier/dépublier — vérifié explicitement en revue, pas seulement par lecture du diff.
- Une seule action au registre (`SITE_NAVIGATION_MANAGE`) couvre menu et pied de page.
- Aucune ligne codée en dur qui aurait dû être un paramètre d'association ; aucun `withRlsBypass`
  introduit ; mockup non copié tel quel (composants réels du socle + `<SortableList />` réutilisé).
