---
validated: yes
---

# Plan — Story s44-page-accueil

Branch: `feature/s44-page-accueil`, à créer depuis `main` **à jour**. s44 se joue en premier du lot
de nettoyage (s44 → s45 → s46 → s47), avant s12b et s12d (`docs/stories.md`, « Ordre des stories »).

> **Sources** :
>
> - recherche : `docs/research/s44-page-accueil.md` (reprise le 12/10, aucun écart de code depuis) ;
> - design : `docs/designs/s44-page-accueil.md`, maquette `docs/designs/s44-page-accueil.html`, brief
>   `docs/designs/s44-page-accueil-brief.md` ;
> - design system : `docs/design-system.md` §1.3, §2.1, §3.1, §3.2, §4 ;
> - décisions : **ADR 032** (écrit avec ce plan : le choix est une clé hors registre), ADR 003
>   (tenant par domaine), ADR 007 (page = blocs), ADR 010 (rien en dur), ADR 016 (registre des
>   paramètres), ADR 018 (registre d'actions), ADR 020 (pages à la racine), ADR 021 (précédent du
>   pied de page), ADR 023 (actualités) ;
> - règles : `rule-architecture`, `rule-service`, `rule-services-tests`, `rule-persistence`,
>   `rule-safe-server-action`, `rule-safe-route`, `rule-presentation`, `rule-react-cache-next-cache`,
>   `rule-logger`, `rule-translation`, `rule-layout-page-breaking`.

## Target story

**En tant que** membre du bureau **je veux** désigner quelle page du site sert d'accueil **afin
que** un visiteur qui tape l'adresse de l'association arrive sur le contenu de l'association, et non
sur la vitrine commerciale du boilerplate. Complexité 3, dépend de s02, s04, s04b, s05, s07, s11
(toutes livrées).

1. Depuis le back-office, le bureau désigne une page publiée du CMS comme accueil ; `/` affiche son
   contenu, avec la navigation (s04b) et le bandeau d'alerte (s07).
2. Sans page désignée, ou si elle est dépubliée, `/` affiche un accueil minimal (nom et logo, dernières
   actualités publiées), jamais un texte, lien ou bouton de la vitrine du boilerplate.
3. Le choix est un paramètre d'association ; le bureau d'une association ne désigne pas la page d'une
   autre, côté interface comme côté serveur — **prouvé par un test d'accès croisé**.
4. Seuls le bureau, la Présidence du domaine appelé et le SuperAdmin changent l'accueil ; tout autre
   utilisateur authentifié reçoit un refus, côté interface et côté serveur.
5. Le changement prend effet à la requête suivante, sans redéploiement.
6. Le sitemap liste la page désignée une seule fois, sous `/` ; son adresse propre `/<slug>` déclare
   `/` comme canonique.

### Décisions tranchées par ce plan

**A. Stockage : une clé hors registre `site.home_page_id` dans `organization_setting`, aucune
migration** (ADR 032, qui écarte le type « page » du registre, la colonne sur `organization` et le
drapeau `is_home`). Pas de ligne = accueil automatique. Une référence pendante se lit comme « pas de
page ».

**B. Autorisation : une action dédiée `HOME_PAGE_MANAGE` (`site.home.manage`)**, rôles par défaut
`owner` et `board`, sur le précédent de chaque story qui ouvre un domaine (`SITE_ALERT_MANAGE`,
`NEWS_MANAGE`…). Raison : s37 rend les droits ajustables **par action** ; réemployer `PAGE_MANAGE`
lierait pour toujours « choisir l'accueil » à « écrire des pages ». Le contrôle est dans le service
(`canPerformAction`) ; le SuperAdmin passe par la même fonction, comme pour les autres actions.

**C. Cache : un seul fil d'invalidation, sans toucher aux actions de s04.** La lecture publique de
l'accueil est taguée `home-page:<org>` et, **une fois la page connue**, `page:<org>:<slug>` — le tag
que `bureau/pages/[id]/actions.ts` invalide déjà à la création, la modification (ancien et nouveau
slug), la publication et la dépublication. Le service rend la page désignée **quel que soit son
statut** et le DAL filtre `published` hors du scope caché (comme `getPublicPageBySlugDal`) : c'est ce
qui fait qu'une page **republiée** réapparaît en accueil sans invalidation de plus. Un service qui ne
rendrait que la page publiée créerait une entrée sans tag `page:` tant que la page est en brouillon,
donc **jamais invalidée à sa publication** — le piège de cette décision.

**D. Rendu de la page désignée : le même composant que `/<slug>`** (`PublicPageArticle`, extrait du
fichier de route). Le titre de la page reste en `h1` 34 px, comme à son adresse propre (design,
écran 2).

**E. Métadonnées de `/`** (question ouverte 5 de la recherche) : avec une page désignée, celles de
la page (`resolvePageSeo`) avec **canonique `/`** ; sans page, celles d'aujourd'hui (nom de
l'association, `resolveFixedPageSeo`). `resolvePageSeo` reçoit un paramètre optionnel
`canonicalPath`, utilisé aussi par `/<slug>` quand la page est l'accueil (critère 6).

**F. Hypothèses du design retenues** : trois actualités sur l'accueil minimal (constante d'affichage
`HOME_NEWS_COUNT`, pas un paramètre, ADR 023 §4) ; le choix est **conservé** quand la page est
dépubliée (la ligne n'est pas effacée) ; le menu (s04b) n'est pas touché (entrée vers `/<slug>`,
inchangée — hors périmètre, déclaré au design).

**G. Pas de liste d'actualités partagée avec `/actualites`.** Le design fixe un autre rendu (titre en
`h3` 20 px, pas de lien « Lire l'actualité ») : un composant dédié, sans toucher à la page de s05.

## Tasks (ordered)

1. [x] **Action `HOME_PAGE_MANAGE`** — `ActionIdConst.HOME_PAGE_MANAGE = 'site.home.manage'` et son
       entrée dans `ACTION_REGISTRY` (`defaultRoles: ['owner', 'board']`), avec un commentaire sur le
       modèle des voisins. **Test (rouge d'abord)** dans
       `src/services/__tests__/action-registry-authorization.test.ts` : l'action existe au registre,
       `owner` et `board` l'ont, `member` non, le SuperAdmin passe (même gabarit que les cas
       `READ`/`MANAGE` du fichier).

2. [x] **Service de la page d'accueil** — `src/services/types/domain/home-page-types.ts`
       (`HOME_PAGE_SETTING_KEY = 'site.home_page_id'`, `HOME_NEWS_COUNT = 3`, `HomePageForBureauDTO =
 {page: {id, title, status} | null}`, résultats `{status: 'saved'} | {status: 'not_published'}`)
       ; `src/services/validation/home-page-validation.ts` (UUID d'association, `pageId` UUID ou
       `null`) ; `src/services/home-page-service.ts` : `setHomePageService`,
       `getHomePageForBureauService`, `getPublicHomePageService` ; facade
       `src/services/facades/home-page-service-facade.ts` et intercepteur
       `interceptors/home-page-service-logger-interceptor.ts`, sur le gabarit de `page-service`. - `setHomePageService({organizationId, pageId})` : `safeParse` → `ValidationParsedZodError` ;
       `canPerformAction(…, HOME_PAGE_MANAGE)` sinon `AuthorizationError` ; `pageId` non nul →
       `withTenant(org, () => getPageByIdDao(pageId))`, page absente → `NotFoundError`, statut
       ≠ `published` → résultat `not_published`, sinon `upsertOrganizationSettingsDao` (valeur = id,
       `updatedBy` = utilisateur) ; `pageId` nul → `deleteOrganizationSettingsDao(org, [clé])`.
       Tout sous `withTenant`. - `getHomePageForBureauService(org)` : autorisation, puis lit la ligne et la page (id, titre,
       statut) ; ligne sans page → `{page: null}`. - `getPublicHomePageService(org)` : **sans autorisation, délibéré** (commentaire, comme
       `getPageBySlugService`) ; ligne absente, UUID invalide ou page introuvable → `undefined` ;
       sinon la page **quel que soit son statut** (décision C).
       **Tests** `src/services/__tests__/home-page-service.test.ts` (DAO et `getAuthUser` mockés, gabarit de
       `src/services/__tests__/page-service.test.ts`) : refus d'un membre sans écriture ; UUID invalide rejeté ; **page
       d'une autre association = `getPageByIdDao` ne rend rien (simulé) → refus et aucune écriture** ;
       brouillon et page dépubliée refusés sans écriture ; page publiée → upsert avec la bonne clé et
       la bonne valeur ; `null` → suppression de la clé ; lecture publique sans session ; référence
       pendante → `undefined`.

3. [x] **DAL de la page d'accueil** — `src/app/dal/home-page-dal.ts` : `homePageTag(org)` =
       `home-page:${org}` ; `readPublicHomePageCached` (`'use cache'`, `cacheLife('hours')`,
       `cacheTag(homePageTag(org))`, puis `cacheTag(pageTag(org, page.slug))` si la page existe —
       **aucun `logger` direct dans le scope**, aucune horloge) ; `getPublicHomePageDal(org)` →
       page **seulement si `status === 'published'`** ; `getCurrentPublicHomePageDal` (tenant du
       domaine, enveloppé dans `cache()`) ; `getHomePageForBureauDal(org)` (non cachée : écran
       d'administration) ; `canManageCurrentHomePageDal`. **Tests** `home-page-dal.test.ts` (gabarit
       de `news-dal.test.ts`, `next/cache` mocké) : brouillon et dépubliée ne sont pas servies ;
       publiée l'est ; les **deux tags** sont posés quand la page existe, un seul sinon.

4. [x] **Rendu de page partagé et canonique** —
       a. Extraire de `(public)/[slug]/page.tsx` le composant serveur
       `src/components/features/pages/public-page-article.tsx` (`<article>`, bandeau d'aperçu,
       `h1`, tri par `rank`, `renderPageBlock`, blocs `null` omis) ; `[slug]/page.tsx` l'appelle,
       **sans changement de rendu**. b. `resolvePageSeo(page, association, options?)` accepte
       `{canonicalPath}` (défaut : `/${page.slug}`). c. `generateMetadata` de `[slug]` lit
       `getCurrentPublicHomePageDal()` et, si `resolved.page.id` est l'accueil, passe
       `canonicalPath: '/'` (critère 6). **Tests** : `public-page-article.test.tsx` (titre en `h1`,
       blocs triés, bloc vide omis, bandeau d'aperçu brouillon/dépubliée) ; cas `canonicalPath` dans
       le test de `resolve-metadata` ; test de `generateMetadata` de `[slug]` : canonique `/` pour la
       page d'accueil, `/<slug>` pour toute autre.

5. [x] **Route `/` : page désignée ou accueil minimal** — **déplacer** `src/app/[locale]/page.tsx`
       vers `src/app/[locale]/(public)/page.tsx` (même URL ; les deux fichiers ne peuvent pas
       coexister) pour hériter de la navigation et du pied de page (critère 1) ; le bandeau d'alerte
       vient déjà du layout `[locale]`. La page lit `getCurrentPublicHomePageDal()` : page désignée →
       `<PublicPageArticle page={…} />` ; sinon `src/components/features/association/home-minimal.tsx`
       (nom en `h1` `display` 44 px/48, description si elle existe via
       `getCurrentAssociationSeoDal`, section « Dernières actualités » en `h2`, les
       `HOME_NEWS_COUNT` premiers de `getPublicNewsPageDal(tenant.id, 1)`, titre en `h3` en lien,
       vignette 4:3 **seulement** si l'actualité a une image, lien « Toutes les actualités »,
       « Aucune actualité pour l'instant. » sinon). `generateMetadata` selon la décision E (plus de
       repli `HomePage.metadata.*`). Libellés dans `messages/fr.json` (`PublicHome`). **Retirer** la
       vitrine : l'ancien `src/app/[locale]/page.tsx`, `src/app/__tests__/home.test.tsx` (suite
       `describe.skip` déjà morte), le bloc `HomePage` de `messages/fr.json`, et — **après `grep`
       confirmant qu'aucun autre fichier ne les importe** — `ButtonConnexionDashboard`,
       `src/components/image-theme.tsx` et `src/components/ui/vapour-text-effect.tsx`. Les fichiers de
       `public/` (`next.svg`, `product-2.avif`) restent : le reste de la vitrine est à s45. **Tests**
       `(public)/page.test.tsx` : page désignée publiée → son `h1` et ses blocs ; aucune page →
       nom en `h1`, trois actualités au plus, état vide, **aucun** « Essayez gratuitement » ni lien
       `/pricing` ; `home-minimal.test.tsx` : vignette seulement avec image, description facultative.

6. [x] **Sitemap : la page d'accueil une seule fois, sous `/`** — `src/app/sitemap.ts` lit
       `getPublicHomePageDal(tenant.id)` à côté de `getPublishedSitemapEntriesDal`, **retire** de
       `pages` celle dont le slug est l'accueil et date l'entrée `/` de `updatedAt` de la page ; sans
       page désignée, le sitemap est inchangé. `sitemap-dal` et le service du sitemap ne changent pas.
       **Tests** dans `src/app/sitemap.test.ts` : avec une page désignée, `/` figure une fois et
       `/<slug>` aucune ; page dépubliée → `/<slug>` absent comme avant (déjà non publiée) et `/` sans
       `lastModified` ; sans page désignée, sortie identique à aujourd'hui.

7. [x] **Écran du bureau « Page d'accueil »** (`/bureau/page-accueil`) — `bureau-sidebar.tsx` : entrée
       `{href: '/bureau/page-accueil', labelKey: 'homePage'}` dans « Le site », **juste après
       « Pages »** ; `messages/fr.json` : `nav.homePage` = « Page d'accueil » et le namespace
       `BureauHomePage` (titre, chapeau, état actuel, choix, aides, raisons, `alert` de succès,
       d'avertissement et d'échec, libellés des boutons — tous les textes du design, avec espaces
       insécables et apostrophes courbes). `actions.ts` : `saveHomePageAction(pageId: string | null)`
       sur le modèle de `bureau/alerte/actions.ts` (`requireActionAuth` → facade →
       `updateTag(homePageTag(tenant.id))` **après** le succès seulement ; résultat traduit
       `saved | not_published | error`, jamais levé). `page.tsx` : contrôle d'accès répété
       (`canManageCurrentHomePageDal`, sinon `BureauAccessDenied`), lecture sous `<Suspense>` avec
       `skeleton`, titre de page via `generateMetadata`. `home-page-form.tsx` (client, composants du
       socle : `card`, `radio-group`, `select`, `label`, `button`, `alert`) : les états a à f du
       design — dont **c** (aucune page publiée : choix 2 désactivé, raison écrite + lien « Publier
       une page ») et **d** (page désignée non publiée : `alert` `warning` en tête, `select` montrant
       « … — non publiée »). Le `select` ne propose **que les pages publiées** de la liste
       `getPagesForBureauDal`. Le titre de carte est un **`h3` Public Sans 20 px** (écart de la
       maquette, `docs/designs/s44-page-accueil.md`). « Voir l'accueil du site » : lien `target="_blank"`
       à libellé accessible complet. Mobile : champs et boutons 56 px, pleine largeur. **Tests** :
       `actions.test.ts` (non authentifié refusé, succès invalide le tag **après** l'écriture, refus
       d'autorisation et page non publiée rendus comme résultats, `null` accepté) ; `page.test.tsx`
       (membre sans droit → `BureauAccessDenied`, jamais de lecture) ; `home-page-form.test.tsx` (un
       cas par état, un seul bouton `default`, libellé « Enregistrement… » et largeur conservée,
       choix 2 désactivé sans page publiée, le brouillon n'est pas dans la liste) ; extension de
       `bureau-sidebar.test.tsx` (entrée présente, entre Pages et Actualités, active sur sa route).

8. [x] **Tests e2e** (Playwright, exécutés en CI — jamais en local) —
       a. **Réécrire** `e2e/homepage.spec.ts` et `e2e/mobile.spec.ts`, qui assertent aujourd'hui le
       texte de la vitrine : titre `TechCorp Solutions`, `h1` = nom de l'association, aucun
       « Essayez gratuitement », aucun lien `/pricing`. b. **Nouveau** `e2e/home-page.spec.ts`
       (`mode: 'serial'`, deux domaines, helpers de connexion et de création de page repris de
       `e2e/site-navigation.spec.ts`) : - **cycle** : le bureau A crée et publie une page, la désigne sur `/bureau/page-accueil`, le
       visiteur du domaine A voit son `h1` sur `/` avec la navigation ; `link[rel=canonical]` de `/`
       = `/`, celui de `/<slug>` = `/` ; `sitemap.xml` liste `/` une fois et pas `/<slug>` ; la
       dépublier ramène l'accueil minimal et l'écran du bureau affiche l'avertissement « n'est
       plus publiée » ; la republier la remet en accueil, **sans redéploiement ni redémarrage**
       (critères 1, 2, 5, 6) ; retour à « L'accueil automatique » en fin de scénario, pour ne pas
       polluer les autres specs ; - **accès croisé (critère 3)** : A a désigné sa page ; sur le domaine B, `/` sert l'accueil
       minimal de B (nom « Marketing Pro »), le `select` du bureau B ne propose aucune page de A, et
       **la base attaquée en direct sous le rôle applicatif** (gabarit `withAppRoleClient` de
       `tenant-isolation.spec.ts`) montre que, sous le scope de B, ni la ligne `site.home_page_id`
       de A ni la page désignée ne sortent. Le refus côté serveur d'un identifiant forgé est porté
       par le test de service de la tâche 2 (RLS simulée) **et** cette preuve de RLS ; - **autorisation (critère 4)** : un membre simple de A (`user@gmail.com`) ouvrant
       `/bureau/page-accueil` reçoit « Cette page est réservée au bureau de l'association ».
       c. Vérifier que `e2e/styles.spec.ts` (`/` dans `ROUTES`) passe toujours.

## Files touched

**Créés** : `docs/decisions/032-page-d-accueil-cle-hors-registre.md` (déjà écrit),
`src/services/types/domain/home-page-types.ts`, `src/services/validation/home-page-validation.ts`,
`src/services/home-page-service.ts` (+ `src/services/__tests__/home-page-service.test.ts`), `src/services/facades/home-page-service-facade.ts`,
`src/services/facades/interceptors/home-page-service-logger-interceptor.ts`,
`src/app/dal/home-page-dal.ts` (+ `.test.ts`),
`src/components/features/pages/public-page-article.tsx` (+ test),
`src/components/features/association/home-minimal.tsx` (+ test),
`src/components/features/association/home-page-form.tsx` (+ test),
`src/app/[locale]/(public)/page.tsx` (+ test),
`src/app/[locale]/(bureau)/bureau/page-accueil/{page.tsx,actions.ts}` (+ tests),
`e2e/home-page.spec.ts`.

**Modifiés** : `src/services/types/domain/action-registry-types.ts`,
`src/services/__tests__/action-registry-authorization.test.ts`,
`src/lib/seo/resolve-metadata.ts` (+ son test), `src/app/[locale]/(public)/[slug]/page.tsx`,
`src/app/sitemap.ts` (+ `sitemap.test.ts`), `src/components/features/association/bureau-sidebar.tsx`
(+ test), `messages/fr.json`, `e2e/homepage.spec.ts`, `e2e/mobile.spec.ts`.

**Supprimés** : `src/app/[locale]/page.tsx`, `src/app/__tests__/home.test.tsx`, et, si le `grep`
confirme qu'ils sont orphelins, `src/components/features/auth/button-connexion-dashboard.tsx`,
`src/components/image-theme.tsx`, `src/components/ui/vapour-text-effect.tsx`.

**Pas touchés, volontairement** : les actions de pages de s04 (le tag `page:` suffit, décision C),
le menu et le pied de page (s04b), `/actualites` (s05), `sitemap-service`, le schéma de base et les
migrations (aucune, ADR 032), `public/next.svg` et `public/images/product-2.avif`, `/pricing`,
`/checkout`, `/register`, `/blog`, le sélecteur de thème (s45), `/dashboard` et la connexion (s46).

## Test strategy

Deux niveaux seulement (`rule-ci-cd-devops`) : Vitest en unitaire, Playwright en e2e.

- **Unitaire (Vitest, `pnpm test --run`)** : le service est testé **avec les repositories mockés**
  — c'est là que se prouvent l'autorisation, la validation, le refus d'une page absente ou non
  publiée, et l'**absence d'écriture** sur chaque refus. Le DAL est testé sur ses deux tags et son
  filtre de statut. Composants : un cas par état du design. Un test qui n'a pas d'échec possible
  n'est pas une tâche.
- **Ce que l'unitaire ne prouve pas** : la RLS (`db.ts` refuse toute connexion en test) et le cache
  réel. Ils relèvent de l'e2e de la tâche 8 : accès croisé par la base en direct, et effet à la
  requête suivante sur le build de production.
- **TDD** : chaque tâche écrit ses tests d'abord (rouge), puis le code.
- **Où ça s'exécute** : les e2e tournent **en CI** (la machine locale ne tient pas le build et la
  suite) ; les tests unitaires locaux se valident sur une copie en disque local si le montage de
  `/workspace` fait expirer les workers Vitest — un timeout n'est jamais compté pour vert.
- **Régressions surveillées** : `e2e/styles.spec.ts` (`/`), `e2e/locale-unique.spec.ts` (`/fr` → `/`),
  `e2e/seo.spec.ts` et `src/app/sitemap.test.ts` (adresses et canoniques), `e2e/site-navigation.spec.ts`
  (navigation du layout public), `e2e/page-cms.spec.ts` (rendu de `/<slug>` après l'extraction).

## Definition of Done

- Les six critères d'acceptation sont couverts par un test nommé (unitaire ou e2e) ; le critère 3 par
  un **test d'accès croisé** (e2e, deux domaines + base en direct).
- Une PR, une branche `feature/s44-page-accueil`, **un seul commit** (la recherche, le design,
  l'ADR 032 et le plan y voyagent), description structurée.
- `pnpm lint`, `pnpm format`, la vérification de types et `pnpm test --run` passent ; **pas de
  `pnpm build` local** (AGENTS.md) — le build et les e2e sont ceux de la CI.
- **Rien en dur** (ADR 010) : aucun slug ni identifiant de page dans le code ; `HOME_NEWS_COUNT` est
  une constante d'affichage assumée (ADR 023 §4), pas une valeur d'association.
- Aucun appel direct à `logger` dans un scope `'use cache'` ; aucune migration ; aucune nouvelle
  occurrence de `withRlsBypass()`.
- Aucun texte de la vitrine du boilerplate ne reste servi sur `/` ; les clés `HomePage.*` et les
  composants orphelins sont retirés, et le `grep` qui le prouve figure dans la description de la PR.
- Le design est respecté : composants du socle uniquement, un seul bouton `default`, alertes ancrées
  (jamais de toast), titre de carte du back-office en `h3`, cibles de 56 px sur mobile.
- Review passée (`/ks-review s44`) avec `Ship allowed: yes`.

## Risques à garder en vue pendant l'exécution

1. **Le tag `page:<slug>` de la décision C** : si le DAL ne tague pas la page **même en brouillon**,
   la republication ne réveille pas l'accueil. Le test de la tâche 3 le fige ; l'e2e du cycle
   (dépublier puis republier) le prouve de bout en bout.
2. **Le déplacement de `/` sous `(public)`** : `(public)/loading.tsx` (squelette générique) et le
   `ModeToggle` du layout public s'appliquent désormais à `/`. Le sélecteur disparaît avec s45 ; le
   squelette est déjà celui de toutes les pages publiques — pas de traitement spécifique ici.
3. **L'extraction de `PublicPageArticle`** touche le rendu de toutes les pages publiques : elle doit
   être **sans aucun changement visible**, ce que `page-cms.spec.ts` doit confirmer.
