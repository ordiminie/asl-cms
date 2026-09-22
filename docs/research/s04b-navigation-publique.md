# Research — Story s04b-navigation-publique

## Target story

**En tant que** membre du bureau **je veux** décider où mes pages apparaissent dans le menu et ce que
dit le pied de page **afin que** le visiteur trouve le site sans connaître les URL.

Réf. `V5 §3.1`, `CDCT §3.1`, `PRD` (« Navigation du site public », complexité 2). Id intercalé
(dérogation assumée à `AGENTS.md`, documentée dans `docs/stories.md`) — dépend de s04, livrée et
mergée (`main`, commit `94b4906`, PR #21).

### Acceptance criteria (docs/stories.md)

1. Le bureau compose le **menu du site public** : ajouter une entrée pointant vers une page, la
   retirer, en changer l'ordre. Le menu rendu au visiteur reflète cet ordre.
2. Une page publiée mais absente du menu reste atteignable par son URL ; une entrée de menu pointant
   vers une page dépubliée ou supprimée **ne s'affiche pas** au visiteur, sans casser le rendu du menu.
3. Le bureau modifie le contenu du **pied de page** ; la modification est visible sur toutes les pages
   publiques.
4. Le menu et le pied de page sont **scopés au tenant** : deux associations servent deux navigations
   distinctes sur leurs domaines respectifs.
5. Publier ou dépublier une page depuis s04 met le menu à jour **sans délai de revalidation**.
6. Une entrée de menu porte sa **propre visibilité**, indépendante du statut de publication de sa page
   cible — masquée si la page cesse d'être publiée, mais réglable en plus par le bureau.
7. Un membre non-bureau ne peut modifier ni le menu ni le pied de page.

Périmètre à ne pas élargir (notes agentiques de la story) : **une seule profondeur de menu**, pas de
sous-menus ; l'**en-tête** au-delà du logo/teinte n'est pas dans cette story (D-04, déjà tranché) ;
pas de menu par rôle ni de navigation conditionnelle au membre connecté.

## Current state of the code

Vérifié le 22 septembre 2026, sur `main` (`94b4906`, s04 mergée). **Rien de cette story n'existe
encore dans le code** : ni table, ni composant, ni écran.

- **Le header et le pied de page publics actuels sont du chrome SaaS hérité, pas du contenu
  d'association.** `src/app/[locale]/(public)/layout.tsx` : la nav est une liste de `<Link>` en dur
  (`/privacy`, `/terms`, `/docs` si `isPageEnabled(PagesConst.DOCS)`, `/blog` si
  `isPageEnabled(PagesConst.BLOG)`), sans lecture d'aucune donnée d'association au-delà du logo/nom
  (`AssociationMark`). `src/components/features/layouts/public-footer.tsx` : quatre colonnes
  statiques (« Product », « Resources », « Legal »…) qui citent `t('footer.byMike')`,
  `/pricing`, des `href="#"` de démo — namespace i18n `HomePage.footer.*`, **aucune donnée
  tenant-scopée**. Il est déjà en `'use cache'` + `cacheLife('days')` (le commentaire dit que l'année
  du copyright, via `new Date()`, interdirait le prerender sans ça) — mais **sans `cacheTag`**, et
  identique pour toutes les associations aujourd'hui.
- **`isPageEnabled`/`PagesConst` (`src/env.ts`, `src/lib/utils.ts`) est un flag de plateforme, pas de
  tenant** : `env.NEXT_PUBLIC_ENABLED_PAGES` (variable d'environnement globale, une seule pour tout le
  déploiement), à ne pas confondre avec `organization_module` (pgEnum, `auth-model.ts`, drapeaux
  **par association** `vote`/`voirie`/`annonces`, ADR 010) qu'utilisent s33-s35. Cette story n'a pas à
  toucher `PagesConst` ; le futur menu composé par le bureau est un mécanisme entièrement différent,
  scopé par association.
- **Aucune table `menu_item` ni équivalent.** `src/db/models/` ne contient toujours que les modèles
  déjà cités par la recherche de s04 (`page-model.ts`, `content-block-model.ts` nouvellement ajoutés,
  plus les modèles antérieurs). Rien pour une liste ordonnée d'entrées de navigation.
- **`docs/architecture.md` (§ Classement RLS) liste 23 tables**, dont `page` et `content_block`
  (ajoutées par s04) — une table `menu_item` (ou équivalent) devra y être ajoutée par cette story, sur
  le même gabarit.
- **Design system : aucune section dédiée.** `docs/design-system.md` §9 (« Manques signalés ») ne
  cite s04b dans aucune ligne — ni pour le composeur de menu, ni pour l'éditeur de pied de page. Ce
  n'est pas un oubli à combler ici : c'est un vrai vide à signaler à `/ks-design s04b`, qui composera
  depuis les tokens/composants génériques (§1-§3) sans gabarit dédié, contrairement à s04 qui avait
  §1.6/§2.2-2.5/§4.

## Anchor points

- **Page publique déjà scopée par tenant** : `src/app/[locale]/(public)/[slug]/page.tsx` (ADR 020,
  route racine, slugs réservés) — la page où le menu doit permettre d'arriver, et où le pied de page
  s'affiche déjà (via le layout parent).
- **Layout public, point d'insertion du menu et du footer** :
  `src/app/[locale]/(public)/layout.tsx`. Résout déjà le tenant (`requireCurrentTenantDal()`,
  bloquant, ADR 003) avant de rendre `<header>`/`{children}`/`<PublicFooter />` — le menu composé
  peut se brancher au même niveau, avec le même `tenant` déjà en main, sans résolution supplémentaire.
- **Gabarit de lecture publique cachée + invalidation, avec deux tags croisés** :
  `src/app/dal/page-dal.ts` — `pageTag(organizationId, slug)` (exporté), et
  `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts` (lignes 88, 127-128, 168-169, 194) où
  `updateTag(pageTag(...))` est appelé après succès, sur l'ancien **et** le nouveau slug quand il
  change. **C'est le point exact où le piège de cache de cette story mord** : publier/dépublier une
  page (dans ce fichier, déjà écrit par s04) doit **aussi** appeler `updateTag(menuTag(organizationId))`
  quand cette story existera — une invalidation croisée entre deux tags, à poser dans les deux sens
  (le futur code de gestion du menu invalide son propre tag ; le code déjà existant de s04 devra être
  modifié pour invalider en plus celui du menu).
- **Gabarit de service/repository/façade/DAL tenant-scopé avec CRUD + registre d'actions**, le plus
  proche structurellement (liste ordonnée, rangs, transaction de réordonnancement) :
  `src/services/page-service.ts` + `src/db/repositories/page-repository.ts` (`reorderPageBlocksTxnDao`,
  gabarit `rule-transaction-dao.md`) — un `menu-item-service.ts` / `menu-item-repository.ts` suivrait
  le même patron pour réordonner les entrées de menu.
- **Registre d'actions, entrée à ajouter** : `src/services/types/domain/action-registry-types.ts`
  (`ActionIdConst`, actuellement `ASSOCIATION_IDENTITY_UPDATE`, `ASSOCIATION_SETTINGS_UPDATE`,
  `PAGE_MANAGE`, tous rôles `['owner','board']`) — cette story ajoute vraisemblablement une entrée
  (`SITE_NAVIGATION_MANAGE` ou similaire) pour gater la mutation du menu et du pied de page (critère 7),
  à trancher en plan (une entrée unique pour les deux, ou deux — le précédent `PAGE_MANAGE` penche
  pour une entrée unique).
- **Sidebar bureau, groupe « Le site » déjà ouvert par s04** :
  `src/components/features/association/bureau-sidebar.tsx` — `NAV_GROUPS[0].items` contient
  aujourd'hui `[{href: '/bureau/pages', labelKey: 'pages'}]` ; cette story y ajoute une entrée
  (ex. `/bureau/navigation`), sur le même patron (`t('BureauIdentityPage.nav.<labelKey>')`).
- **Stockage clé/valeur scalaire pour un contenu simple par association** :
  `src/db/models/organization-setting-model.ts` + `ASSOCIATION_SETTINGS_REGISTRY`
  (`src/services/types/domain/association-settings-types.ts`) — candidat naturel pour le **pied de
  page** si son contenu reste un champ texte/markdown unique (pas une liste), sans nouvelle table ni
  migration. Le **menu**, lui, est structurellement une liste ordonnée avec visibilité par entrée : ne
  rentre pas dans ce patron scalaire, plus proche de `content_block` (nouvelle table, rangs entiers).
  À trancher en plan (voir Open questions).
- **e2e à réutiliser comme gabarit** : `e2e/page-cms.spec.ts` (isolation + critères d'une story de
  contenu récente) et `e2e/association-settings.spec.ts` (si le pied de page passe par
  `organization_setting`).

## Verified APIs / functions

| Fonction / composant             | Fichier                                                       | Signature vérifiée                                                                                                 |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pageTag`                        | `src/app/dal/page-dal.ts`                                     | `(organizationId: string, slug: string) => string` — `` `page:${organizationId}:${slug}` ``                        |
| `getPublicPageBySlugDal`         | `src/app/dal/page-dal.ts`                                     | `(organizationId: string, slug: string) => Promise<PageWithBlocksDTO \| undefined>` — `undefined` si non publiée   |
| `getPagesForBureauDal`           | `src/app/dal/page-dal.ts`                                     | `(organizationId: string) => Promise<PageDTO[]>` — non cachée                                                      |
| `canManageCurrentPagesDal`       | `src/app/dal/page-dal.ts`                                     | `() => Promise<boolean>` — tenant résolu par le domaine appelé                                                     |
| `canPerformAction`               | `src/services/authorization/action-registry-authorization.ts` | `(user, organizationId, actionId) => boolean` — inchangé depuis s04                                                |
| `requireCurrentTenantDal`        | `src/app/dal/tenant-dal.ts`                                   | `() => Promise<TenantDTO>` — déjà appelé par `PublicLayout`                                                        |
| `getDb`, `withTenant`            | `src/db/tenant-scope.ts`                                      | inchangés depuis s01/s02                                                                                           |
| `isPageEnabled`, `PagesConst`    | `src/lib/utils.ts`, `src/env.ts`                              | flag **de plateforme** (`NEXT_PUBLIC_ENABLED_PAGES`), pas de tenant — ne pas confondre avec le futur menu          |
| `ASSOCIATION_SETTINGS_REGISTRY`  | `src/services/types/domain/association-settings-types.ts`     | patron clé/valeur scalaire, candidat pour un pied de page simple champ texte                                       |
| `page` (table), `pageStatusEnum` | `src/db/models/page-model.ts`                                 | `status: 'draft' \| 'published' \| 'unpublished'` — c'est cette colonne que le critère 2/6 doit lire pour masquer  |
| `PageDTO`                        | `src/services/types/domain/page-types.ts`                     | domaine, pas le modèle Drizzle — la présentation d'une future liste de pages cibles (menu) doit passer par ce type |

## Traps & constraints

1. **Invalidation croisée entre deux tags, dans les deux sens.** Le piège documenté par la story lui-
   même : publier/dépublier une page (code déjà écrit par s04,
   `bureau/pages/[id]/actions.ts`) doit invalider le tag du menu en plus du sien — ce fichier **existant**
   devra être modifié par cette story, pas seulement du code neuf ajouté à côté. L'oubli ne se voit pas
   en développement (cache froid) : c'est exactement le type de régression qu'un e2e doit couvrir
   explicitement (publier une page depuis s04, vérifier que le menu qui la référence se met à jour
   sans redémarrage).
2. **Le header et le footer publics actuels sont du contenu SaaS de démonstration, pas un point de
   départ à étendre tel quel.** `PublicFooter` cite du texte de produit générique (« Pricing »,
   « Demo », « API », « By Mike ») et des liens `href="#"` ; le header a Privacy/Terms/Docs/Blog en
   dur. Cette story doit décider (en plan, pas ici) si elle **remplace** ce bloc par le contenu
   composé par le bureau ou si elle l'insère à côté — remplacer semble cohérent avec le CDCT mais
   change un fichier que personne n'a touché depuis le boilerplate.
3. **`PublicFooter` est déjà `'use cache'` sans `cacheTag`**, identique pour tous les tenants
   aujourd'hui. Le rendre tenant-scopé change sa nature de cache (ajouter `cacheTag`, probablement
   passer `organizationId` en paramètre) — pas un ajustement mineur, une réécriture de la fonction.
4. **Pas de table pour une liste ordonnée avec visibilité par entrée.** `organization_setting` est
   scalaire (une valeur par clé) : ne porte pas nativement un tableau d'entrées ordonnées avec leur
   propre champ de visibilité (critère 6). Une table neuve (`menu_item` ou équivalent) semble
   nécessaire, sur le gabarit RLS de `page`/`content_block` — à confirmer en plan, pas ici.
5. **Le pied de page pourrait, lui, tenir dans `organization_setting`** si son contenu reste un champ
   texte/markdown unique — mais le CDCT ne précise pas sa forme exacte (texte simple ? liens ?
   plusieurs colonnes comme le footer actuel ?). Pas tranché ici : voir Open questions.
6. **Une entrée de menu pointe vers une page — par id ou par slug ?** Le slug peut changer (le bureau
   le modifie dans le panneau Paramètres de l'éditeur de page, s04). Une référence par `page_id` (FK,
   `onDelete: 'cascade'` pour la suppression future, `SET NULL` pour la dépublication qui ne supprime
   pas) survit au renommage du slug ; une référence par slug capturerait un slug périmé. À trancher en
   plan, mais l'indice va vers `page_id`.
7. **`docs/architecture.md` (§ Classement RLS, 23 tables) devra être mis à jour** si une table neuve
   est créée — même geste que s04 pour `page`/`content_block`.
8. **`pnpm test` reste en mode watch** — `pnpm test --run` obligatoire pour toute exécution non
   interactive (implémenteur, reviewer, CI).
9. **Migrations** : toujours `pnpm db:generate` (ou `drizzle-kit generate --custom` pour une policy RLS
   manuscrite, gabarit `drizzle/migrations/0013_page_content_block_rls.sql`, le plus récent).
10. **`src/i18n/routing.ts` déclare toujours `locales: ['en','fr','es']` avec `defaultLocale: 'en'`**,
    contrairement à l'intention de l'ADR 008 (fr seule, sans préfixe) — vérifié à nouveau lors de la
    revue de s04 (`docs/reviews/s04-pages-cms.md`, pas corrigé, hors périmètre de s04). Toute chaîne
    ajoutée par cette story dans `messages/en.json`/`messages/es.json` doit être **réellement
    traduite**, pas recopiée du français — piège déjà mordu deux fois pendant la revue de s04.

## Open questions

1. **Le pied de page est-il un champ scalaire (`organization_setting`, patron ADR 016) ou une
   structure propre (nouvelle table, sections/colonnes comme l'actuel `PublicFooter`) ?** Le CDCT dit
   « modifie le contenu du pied de page » sans détail. À trancher en `/ks-design s04b` (quel besoin
   réel) puis en `/ks-plan s04b` (quelle persistance).
2. **Le menu remplace-t-il le header actuel (Privacy/Terms/Docs/Blog) ou s'ajoute-t-il à côté ?** Ces
   liens sont du chrome SaaS hérité, pas du contenu d'association — mais les retirer est un choix de
   périmètre au-delà de « composer un menu », à confirmer avant d'y toucher.
3. **Référence d'une entrée de menu : `page_id` (FK) ou slug capturé ?** Voir Trap 6 — l'indice va vers
   `page_id`, à confirmer en plan.
4. **Une entrée de menu neuve, une seule action au registre (`SITE_NAVIGATION_MANAGE`) ou deux
   (menu / pied de page séparément) ?** Rien dans les critères ne distingue les deux rôles ; le
   précédent `PAGE_MANAGE` (une entrée pour quatre verbes) penche pour une entrée unique — à confirmer
   en plan.
5. **Design system sans gabarit dédié** (voir « Current state »") : `/ks-design s04b` composera depuis
   les tokens/composants génériques, sans §. Le sélecteur de page cible d'une entrée de menu (parmi
   les pages **publiées** de l'association) n'a pas de composant existant à réutiliser tel quel — à
   spécifier au design, probablement une simple liste/`select`, pas un nouveau composant du socle.

Research ready in docs/research/s04b-navigation-publique.md. Next step: /ks-design s04b (UI story) or
/ks-plan s04b
