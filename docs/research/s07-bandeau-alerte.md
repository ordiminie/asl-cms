# Research — Story s07-bandeau-alerte

## Target story

**En tant que** membre du bureau **je veux** activer un bandeau d'alerte sur l'ensemble du site
**afin de** prévenir immédiatement d'une coupure d'eau ou de travaux.

Complexité 1. Dépend de **s01** et **s03b** (toutes deux livrées et mergées sur `main`). Réf.
`V5 §4.2`, `CDCT §4.2`, PRD ligne « Bandeau d'alerte global — Activation / édition / désactivation
par tout membre du bureau » (`docs/prd.md` l. 73, complexité 1).

### Acceptance criteria (docs/stories.md l. 767-772)

1. Activer le bandeau avec un message l'affiche sur toutes les pages du site existantes, publiques
   comme authentifiées.
2. Modifier le message met à jour le bandeau immédiatement, sans redéploiement.
3. Désactiver le bandeau le retire de toutes les pages.
4. N'importe quel membre du bureau peut l'activer, le modifier et le retirer, sans restriction
   supplémentaire.

### Notes de la story à tenir

- « Volontairement sans workflow : pas de validation, pas de programmation horaire. »
- **Niveaux de gravité : arbitrage ouvert, propriétaire unique `/ks-prd`.** Les critères n'exercent
  qu'un niveau ; passer à trois (design system §2.3) est un élargissement de périmètre. « Ne pas
  choisir en silence à l'implémentation. » Voir Trap 1.
- Le bandeau se pose dans le **gabarit commun**, pas page par page — propriété de conception
  vérifiée en review (les pages des stories ultérieures l'héritent sans y revenir).
- Piège cache : `'use cache'` + `cacheTag` invalidé par `updateTag` à l'activation. Voir Trap 3 : la
  prémisse « le rendre dynamique casserait le prerender de tout le site » ne correspond plus au code.
- Règles transverses (`docs/stories.md` l. 36-70) : rien en dur, couches, Cache Components, **registre
  d'actions**, isolation multi-tenant prouvée par un accès croisé.
- `docs/reviews/stories.md` : `Stories ready: yes`.

---

## Current state of the code

Vérifié le 22 septembre 2026 sur l'arbre de travail (branche courante `feature/s05-actualites`,
aucun commit au-delà de `main` = `0b328a2`, s03c). s01 → s04b, s12a et s03c sont mergées ; s05 a sa
recherche, son design, son ADR 023 et son plan **non commités**, et son implémentation est **en
cours, non commitée, dans le même arbre** (au moment de cette recherche : `NEWS_MANAGE` ajouté à
`action-registry-types.ts`, `news-model.ts`, migrations `0016_purple_plazm.sql` et `0017_news_rls.sql` ; la prochaine migration de s07, s’il en faut une, ne sera donc pas `0016`).
Les références de lignes ci-dessous sont celles de `main`.

**Aucune trace de bandeau d'alerte dans le code** : `grep -rni "alertbanner|alert-banner|bandeau|site_alert|siteAlert" src messages e2e`
ne rend que deux commentaires de `src/app/globals.css` (tokens `warning`, voir plus bas).

### Les gabarits — où « tout le site » passe réellement

Huit layouts sous `src/app/[locale]/` :

| Layout                                 | Ce qu'il sert                                                 | Particularité utile à s07                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[locale]/layout.tsx` (`LocaleLayout`) | **Tout** : public, auth, app, bureau, admin, docs, not-found  | `await requireCurrentTenantDal()` puis `await getAssociationSettingsDal(tenant.id)` (teinte), passe `accentHue` à `BaseLayout`. **`export const instant = false`** pour tout le segment (le tenant vient du `Host`, ADR 003). |
| `[locale]/base-layout.tsx`             | `<html>`, `<body>`, polices, `NextTopLoader`, `AppProviders`  | Composant async sans lecture de données ; props `{children, locale, accentHue?}`.                                                                                                                                             |
| `(public)/layout.tsx`                  | Site public (pages CMS `/{slug}`, blog hérité, contact, etc.) | `div.flex.h-screen.flex-col` → `<header class="border-b">` (logo + menu s04b) → `<main>` → `PublicFooter`. Lit `requireCurrentTenantDal` + `getCurrentPublicSiteNavigationDal` en `Promise.all`.                              |
| `(auth)/layout.tsx`                    | Connexion (s03)                                               | `bg-muted min-h-screen`, en-tête `AssociationMark` seul.                                                                                                                                                                      |
| `(app)/layout.tsx`                     | Espace utilisateur hérité (`dashboard`, `account`, `team`)    | Ne fait **aucun** `await` (promesse de session passée à `AuthProvider`), `SidebarProvider` + `AppSidebar` derrière `<Suspense>`.                                                                                              |
| `(bureau)/layout.tsx`                  | Back-office de l'association (`/bureau/**`)                   | Tout derrière `<Suspense fallback={null}>` ; `BureauShell` lit `requireCurrentTenantDal` + `canManageCurrentAssociationIdentityDal` ; refus → `BureauAccessDenied`. `SidebarProvider` + `BureauSidebar`.                      |
| `admin/layout.tsx`                     | Back-office SuperAdmin hérité                                 | `withAuthAdmin`, `instant = false`, `SidebarProvider` + `AdminSidebar`.                                                                                                                                                       |
| `docs/layout.tsx`, `(public)/blog/…`   | Docs et blog hérités du boilerplate                           | Sans rapport direct, mais sous `LocaleLayout`.                                                                                                                                                                                |

`[locale]/not-found.tsx`, `error.tsx`, `forbidden.tsx` sont rendus **sous** `LocaleLayout`.
`src/app/global-error.tsx` ne l'est pas (il remplace le layout racine) — hors critère.

**Conséquence** : `LocaleLayout` (ou `BaseLayout` qu'il rend) est le seul point par lequel passent
toutes les pages, publiques comme authentifiées. C'est le « gabarit commun » de la note. Il lit
déjà, au même endroit, un paramètre d'association caché par tenant (la teinte) : c'est le précédent
exact d'une donnée d'association affichée sur chaque page.

### Persistance — le précédent « contenu simple hors registre » (ADR 021)

- `organization_setting` (`src/db/models/organization-setting-model.ts`) : clé composite
  `(organization_id, key)`, `value text NOT NULL`, `updated_at` (avec fuseau), `updated_by` (FK
  `user`, `set null`). RLS forcée, policy `tenant_isolation` (`0007`). Déjà classée « scopée » dans
  `docs/architecture.md` l. 229.
- `src/db/repositories/organization-setting-repository.ts` : `getOrganizationSettingsDao(orgId)`,
  `upsertOrganizationSettingsDao(rows)`, `deleteOrganizationSettingsDao(orgId, keys)`,
  `saveOrganizationSettingsTxnDao({organizationId, upserts, deletions, updatedBy})` — tous via
  `getDb()`, à appeler sous `withTenant`.
- **ADR 021** a posé le pied de page dans `organization_setting` sous la clé `site.footer_content`
  (`SITE_FOOTER_SETTING_KEY`, `src/services/types/domain/site-navigation-types.ts:14`), lue et écrite
  **sans** passer par `ASSOCIATION_SETTINGS_REGISTRY`, avec une validation Zod locale
  (`saveSiteFooterServiceSchema`, `site-navigation-validation.ts:36`). Sa section « À surveiller » :
  « Si une future story a besoin d'un deuxième champ de contenu simple (hors registre de
  paramètres), **ce patron est le précédent à suivre** — pas une nouvelle table à chaque fois. »
- Vérifié : `resolveSettings` itère `registry.map(...)` et `validateSettingsChanges` ne produit des
  `deletions` que pour des clés du registre (`association-settings-types.ts` l. 346-402) — une clé hors
  registre n'est ni affichée par l'écran Réglages ni effacée par son enregistrement.

### Chaîne de référence à imiter : pied de page de s04b

| Couche  | Fichier                                                  | Ce qu'il fait                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service | `src/services/site-navigation-service.ts`                | `readFooterContent` (privé, sous `withTenant` de l'appelant) ; `getSiteFooterService` (autorisé) ; `saveSiteFooterService` (`safeParse` → `canPerformAction(..., SITE_NAVIGATION_MANAGE)` → `upsert` sous `withTenant`) ; lecture publique `getPublicSiteNavigationService` **sans autorisation, délibérément**. |
| Façade  | `src/services/facades/site-navigation-service-facade.ts` | Réexporte les méthodes de `interceptors/site-navigation-service-logger-interceptor.ts`.                                                                                                                                                                                                                          |
| DAL     | `src/app/dal/site-navigation-dal.ts`                     | `siteNavigationTag(orgId)` ; lecture interne `'use cache'` + `cacheLife('hours')` + `cacheTag` ; `getCurrentPublicSiteNavigationDal` ; lecture bureau **non cachée** ; `canManageCurrentSiteNavigationDal`.                                                                                                      |
| Actions | `src/app/[locale]/(bureau)/bureau/navigation/actions.ts` | `requireCurrentTenantDal()` → `requireActionAuth()` → façade → `updateTag(siteNavigationTag(tenant.id))` **après succès** ; refus rendu comme résultat traduit (`BureauNavigationPage.errors`), jamais levé.                                                                                                     |
| e2e     | `e2e/site-navigation.spec.ts`                            | Tenants A = `http://localhost:PORT` (TechCorp), B = `http://127.0.0.1:PORT` (Marketing Pro) ; isolation du pied de page entre A et B ; refus d'un membre non-bureau ; invalidation « sans redémarrage ».                                                                                                         |

### Sidebar du bureau

`src/components/features/association/bureau-sidebar.tsx:21-36` : `NAV_GROUPS` — `siteGroup`
(`/bureau/pages`, `/bureau/navigation`) puis `group` (`/bureau/identite`, `/bureau/reglages`) ;
libellés `BureauIdentityPage.nav.*` dans `messages/fr.json` (l. 2800). Le plan de s05 (non commité)
y ajoute « Actualités » dans `siteGroup`.

### Design system — ce qui existe pour le bandeau

- **Tokens `warning`** présents dans `src/app/globals.css` : clair l. 70-72, sombre l. 140-142
  (**dérivés, non validés par la conception** — commentaire l. 133-138 : « un manque du design
  system, à combler, jamais à étendre par analogie »), exposés en `--color-warning*` l. 216-218.
  Contraste `warning-foreground` / `warning` = 8,2:1 (DS §3.7 l. 609).
- **Aucun composant `<AlertBanner />`** dans `src/components/ui/` (liste vérifiée). Le DS §2.2
  l. 393 le range dans « les cinq à construire », P0, « au-dessus de l'en-tête public, **pousse la
  page, ne la recouvre pas** ».
- Primitive existante : `src/components/ui/alert.tsx` (`Alert`, `AlertTitle`, `AlertDescription`),
  variantes `default | destructive` seulement, `role="alert"` codé en dur, `rounded-lg` — c'est
  l'`alert` « ancré dans la page » du DS §2.1, pas un bandeau pleine largeur.
- Icône figée : `AlertTriangle` = alerte (DS §1.7 l. 311).
- Impression : le bandeau d'alerte **disparaît** (DS §6.2 l. 809).
- Mockups : `docs/designs/design-system-mockups.html` montre le bandeau ambre, filet 2 px, icône,
  et un état « désactivé par le bureau ». Aucun `docs/designs/s07-*` n'existe encore.

---

## Anchor points

- **Rendu** : `src/app/[locale]/layout.tsx` (`LocaleLayout`) — lecture du bandeau de l'association à
  côté de `getAssociationSettingsDal(tenant.id)`, rendu dans `BaseLayout` avant `{children}` ou passé
  en prop. C'est le seul point commun à toutes les pages (Trap 4 pour le placement visuel).
- **Composant** : `src/components/ui/alert-banner.tsx` (convention shadcn du DS §2.2) — n'existe pas.
- **Persistance** : `organization_setting` + `organization-setting-repository.ts` sur le patron ADR 021
  (clé(s) `site.*` hors registre), **ou** table dédiée si l'arbitrage des niveaux l'impose (Trap 1,
  Open question 2). Sans nouvelle table : aucune migration, aucune ligne au classement RLS.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts` — `ActionIdConst`
  (l. 43-60) et `ACTION_REGISTRY` (l. 62-79). Nouvelle entrée `['owner', 'board']` sur le précédent
  `SITE_NAVIGATION_MANAGE` (une entrée pour tous les verbes).
- **Service / façade / intercepteur** : gabarit `site-navigation-service.ts` +
  `facades/site-navigation-service-facade.ts` + `interceptors/site-navigation-service-logger-interceptor.ts`
  (via `create-service-interceptor.ts`).
- **DAL** : gabarit `site-navigation-dal.ts` / `association-settings-dal.ts` — tag par association
  (`…:${organizationId}`), lecture publique cachée, lecture bureau non cachée.
- **Back-office** : nouvelle route sous `src/app/[locale]/(bureau)/bureau/` (+ `actions.ts`), entrée
  dans `NAV_GROUPS` ; l'accès est déjà gardé par `(bureau)/layout.tsx`.
- **Libellés** : `messages/fr.json` (nouveau namespace de page bureau + libellés publics du bandeau).
- **e2e** : nouveau `e2e/<…>.spec.ts` sur le patron de `e2e/site-navigation.spec.ts`.

## Verified APIs / functions

| Nom                                              | Fichier                                                          | Signature vérifiée                                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocaleLayout`                                   | `src/app/[locale]/layout.tsx`                                    | `async ({children, params: Promise<{locale}>})` ; rend `<BaseLayout locale accentHue>` ; `instant = false`                                            |
| `BaseLayout`                                     | `src/app/[locale]/base-layout.tsx`                               | `async ({children, locale, accentHue?})` ; `<body>` → `NextTopLoader` → `NextIntlClientProvider` → `AppProviders` → `children`                        |
| `requireCurrentTenantDal`                        | `src/app/dal/tenant-dal.ts:93`                                   | `() => Promise<TenantDTO>`                                                                                                                            |
| `getCurrentTenantDal`                            | `src/app/dal/tenant-dal.ts:71`                                   | `cache(...)`, lit `x-forwarded-host` / `host`, rend le tenant ou `undefined`                                                                          |
| `getTenantByDomainDal` / `TENANT_CACHE_TAG`      | `src/app/dal/tenant-dal.ts:42/31`                                | `'use cache'` + `cacheLife('hours')` + `cacheTag('tenant')`                                                                                           |
| `getAssociationSettingsDal`                      | `src/app/dal/association-settings-dal.ts`                        | `cache(async (organizationId) => …)`, `'use cache'`, `cacheLife('hours')`, `cacheTag(associationSettingsTag(id))` — **l'id en argument**              |
| `siteNavigationTag`                              | `src/app/dal/site-navigation-dal.ts:31`                          | `(organizationId: string) => 'site-navigation:<id>'`                                                                                                  |
| `getOrganizationSettingsDao`                     | `organization-setting-repository.ts`                             | `(organizationId) => Promise<OrganizationSettingModel[]>` (sous `withTenant`)                                                                         |
| `upsertOrganizationSettingsDao`                  | idem                                                             | `(rows: AddOrganizationSettingModel[]) => Promise<void>`, `ON CONFLICT (organization_id, key)`                                                        |
| `deleteOrganizationSettingsDao`                  | idem                                                             | `(organizationId, keys: string[]) => Promise<void>`                                                                                                   |
| `saveOrganizationSettingsTxnDao`                 | idem                                                             | `({organizationId, upserts, deletions, updatedBy}) => Promise<void>` — une transaction                                                                |
| `getDb` / `withTenant` / `withRlsBypass`         | `src/db/tenant-scope.ts:122/128/144`                             | `getDb(): ScopedDb` ; `withTenant(organizationId, callback)` ; `withRlsBypass(callback)`                                                              |
| `canPerformAction`                               | `src/services/authorization/action-registry-authorization.ts:18` | `(user: User \| undefined, organizationId, actionId) => boolean` — SuperAdmin passe ; action absente du registre refusée                              |
| `isActionAllowedForRole` / `ACTION_REGISTRY`     | `action-registry-types.ts`                                       | `(registry, actionId, role) => boolean` ; 4 entrées actuelles, toutes `['owner', 'board']`                                                            |
| `getAuthUser`                                    | `src/services/authentication/auth-service`                       | importé par `site-navigation-service.ts`                                                                                                              |
| `requireActionAuth`                              | `src/app/dal/user-dal.ts:41`                                     | `cache(async (options?: RequireAuthOptions) => …)`, appelé en tête de chaque action du bureau                                                         |
| `canManageCurrentAssociationIdentityDal`         | `src/app/dal/association-identity-dal.ts:13`                     | garde d'accès du layout `(bureau)`                                                                                                                    |
| `AuthorizationError`, `ValidationParsedZodError` | `src/services/errors/`                                           | levées par les services ; les actions les traduisent en résultat                                                                                      |
| `Alert`, `AlertTitle`, `AlertDescription`        | `src/components/ui/alert.tsx`                                    | variantes `default \| destructive`, `role="alert"` fixe                                                                                               |
| `updateTag`                                      | `next/cache`                                                     | **Server Actions uniquement** (`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md:467` : « calling it elsewhere throws ») |

## Traps & constraints

1. **L'arbitrage des niveaux n'est pas rendu, et deux documents désignent deux arbitres.**
   `docs/stories.md` (note de s07, après C-10) : propriétaire unique **`/ks-prd`**, `/ks-design` reçoit
   la décision déjà prise. `docs/design-system.md` §2.3 l. 400 : « **ne pas trancher avant
   `/ks-design s07`** » — formulation antérieure, que la note de story dit précisément avoir corrigée.
   `docs/prd.md` n'a rien tranché (ligne l. 73 inchangée, complexité 1, aucun mot sur la gravité).
   En l'état, **le périmètre est un seul niveau** ; le DS §2.3 le dit aussi (« s07 livre un bandeau à
   un seul niveau, cette section décrit une extension documentée »). Ce qui dépend de l'arbitrage : la
   forme de la donnée (un niveau = message + actif ; trois niveaux = `level`, `endsAt`, `publishedAt`,
   `publishedBy`, masquage `localStorage` 24 h par `id`, rappel à 48 h, désactivation « en un clic depuis
   n'importe quelle page du back-office »), donc le choix `organization_setting` vs table dédiée. La
   phrase du DS §2.3 est à aligner sur la note de story quand l'arbitrage tombe.
2. **Même à un niveau, le DS §2.3 porte des règles qui ne sont pas liées aux niveaux**, à trier au
   design plutôt qu'à reprendre en bloc : message **280 caractères max**, lien facultatif
   `{label, href}`, « un seul bandeau actif à la fois », mobile **trois lignes maximum**, refermable
   (niveaux 1-2) avec masquage 24 h qui ne survit pas à une modification du texte. La refermabilité
   exige un identifiant de version du message (clé `alert:{id}`) : sans colonne `id`, il faudrait
   dériver une version (horodatage `updated_at`, empreinte du texte). Aucun critère ne l'exige.
3. **La prémisse cache de la note est dépassée — le vrai piège est ailleurs.** `LocaleLayout` porte
   déjà `export const instant = false` et lit le `Host` : **aucune page n'est prerendue par tenant**
   (ADR 003, commentaire du layout). Rendre le bandeau « dynamique » ne casse donc plus rien. Ce qui
   reste vrai et obligatoire :
   - la lecture reste en `'use cache'` + `cacheLife` + `cacheTag(<tag>:${organizationId})` **dans une
     fonction du DAL qui prend l'id en argument** (patron `getAssociationSettingsDal`) — sinon chaque
     page de chaque visiteur fait une requête SQL ;
   - `updateTag(<tag>)` **après succès** dans chaque Server Action qui active, modifie ou désactive
     (patron `navigation/actions.ts`). L'oubli ne se voit pas en `pnpm dev` (cache froid) : l'e2e, lancé
     sur le build de production, est ce qui le prouve (critère 2) ;
   - aucun `logger`, `new Date()`, `headers()` dans le scope caché. Donc **pas de désactivation
     automatique à `endsAt` calculée dans la lecture cachée** (hors périmètre de toute façon : « pas de
     programmation horaire »).
   - `updateTag` ne marche que depuis une Server Action : pas de Route Handler pour ce flux.
4. **Placement : le layout commun n'est pas une simple pile.** Un bandeau rendu au-dessus de
   `{children}` dans `BaseLayout` :
   - passe **sous** les barres latérales du bureau, de l'admin et de `(app)` : `Sidebar` est
     `fixed inset-y-0 h-svh` à partir de `md` (`src/components/ui/sidebar.tsx:230`) et
     `SidebarWrapper`/`SidebarInset` sont `min-h-svh` (l. 142, 309). Le bandeau serait recouvert à
     gauche et la page dépasserait la hauteur de l'écran ;
   - s'ajoute au-dessus d'un `(public)/layout.tsx` en `h-screen flex-col` (hauteur = écran, le bandeau
     la pousse d'autant) ;
   - le DS veut « **au-dessus de l'en-tête public**, pousse la page, ne la recouvre pas » et place
     `ImpersonationBar` (z 60, sticky top 0) au-dessus de lui ; `PreviewBar` est `sticky top-0 z-50`
     (`preview-bar.tsx:67`). L'échelle de `z-index` est un **manque signalé** du DS (§9 l. 923),
     « partagé s04, s07, s41 », non tranché.
     Deux options, à choisir au design/plan : lecture dans `LocaleLayout` et rendu dans `BaseLayout`
     avec correction des gabarits à sidebar, ou lecture partagée et rendu **dans chaque layout de
     groupe** (5 à 6 fichiers, contraire à la lettre de la note « gabarit commun »). Voir Open question 4.
5. **Tests unitaires des layouts : mocks explicites.** `src/app/[locale]/layout-accent-hue.test.ts`
   mocke `./base-layout`, `@/app/dal/tenant-dal` et `@/app/dal/association-settings-dal` ; il lit
   `element.props.accentHue`. `src/app/[locale]/(public)/layout.test.tsx` mocke `tenant-dal` et
   `site-navigation-dal`. Existent aussi `base-layout.test.tsx` et `layout-metadata.test.ts`. Un nouvel
   import de DAL dans l'un de ces layouts **casse ces fichiers** tant qu'il n'est pas mocké (`db.ts`
   refuse toute connexion en test).
6. **Rendu du message : du texte, jamais du HTML.** Le pied de page de s04b est du markdown rendu par
   une chaîne sanitisée ; un bandeau de 280 caractères n'en a pas besoin. Un message saisi par le
   bureau et injecté dans **toutes** les pages, back-office compris, est la surface XSS la plus large
   du produit : rendu en nœud texte React, pas de `dangerouslySetInnerHTML`. Si le lien facultatif du
   DS est retenu, son `href` se valide (schéma `http(s)` ou chemin relatif).
7. **Accessibilité du rôle ARIA.** `alert.tsx` pose `role="alert"`, qui fait **annoncer** le message à
   chaque chargement de page par les lecteurs d'écran — sur un bandeau présent sur toutes les pages,
   c'est du bruit, et le DS réserve `aria-live="assertive"` à l'entrée/sortie de simulation (§2.6).
   Une `region` étiquetée (`aria-label`) ou `role="status"` est à choisir au design. Effet de bord
   e2e : `e2e/auth.spec.ts` (l. 100, 155, 208, 242, 272) cherche `[role="alert"]` sur les écrans de
   connexion — un bandeau en `role="alert"` actif pendant ces specs fausserait leurs assertions.
8. **Isolation des e2e : un bandeau est global au tenant.** `playwright.config.ts` :
   `fullyParallel: true`, `workers` = 1 en CI mais illimité en local. Seuls deux tenants ont un domaine
   dans le seed (`localhost` = TechCorp, `127.0.0.1` = Marketing Pro ; Acme et Evil Corp ont
   `domain NULL`). Un bandeau activé par la spec de s07 apparaît sur **toutes** les pages de ce tenant
   pendant que les autres specs tournent (`homepage`, `mobile`, `styles`, `auth`…). Il faut le
   désactiver en fin de test (`afterEach`/`finally`) et ne pas dépendre de l'ordre d'exécution.
9. **Critère 4 — « n'importe quel membre du bureau » = `owner` et `board`.** Dans le seed
   (`src/db/scripts/seed.ts` l. 280-305), TechCorp (tenant A) n'a **aucun** `board` : seulement
   `user-owner@gmail.com` (`owner`) et des `member`. Le rôle `board` avec domaine n'existe que sur
   Marketing Pro (tenant B : `user-admin@gmail.com`, `admin@gmail.com`). Prouver « bureau » et non
   seulement « présidente » demande donc d'opérer sur B, ou un test unitaire de service par rôle
   (`rule-services-tests.md` : ADMIN, USER, PUBLIC + rôles d'organisation). Refus à prouver :
   `user@gmail.com` (membre simple de A). SuperAdmin passe via `canPerformAction`.
10. **« Immédiatement » et le routeur client.** Le bandeau vit dans le layout racine : une navigation
    client (`<Link>`) ne re-rend pas les layouts partagés, et `staleTimes.dynamic = 30`
    (`next.config.ts` l. 48-51). Un visiteur qui navigue déjà sur le site verra le changement à la
    prochaine requête complète, pas forcément au clic suivant. `updateTag` garantit la fraîcheur pour
    l'auteur de l'action et pour toute nouvelle requête ; l'e2e doit charger la page par `goto`.
11. **Registre d'actions** : déclarer l'action (une entrée unique « gérer le bandeau »,
    `['owner', 'board']`) — l'oublier est un défaut de revue (`docs/stories.md` l. 63-68). La lecture
    publique reste **sans autorisation**, comme `getPublicSiteNavigationService`.
12. **Rien en dur** : le message n'a pas de valeur par défaut ; tous les libellés (titre de l'écran,
    « Activer », « Désactiver », étiquette ARIA du bandeau, mot du niveau si retenu) vont dans
    `messages/fr.json`. Le DS §2.1 réserve le `switch` « aux réglages à effet immédiat, avec libellé
    d'état » — c'est le cas ici ; « un seul bouton `default` par écran ».
13. **Multi-tenant** : sans nouvelle table, l'isolation repose sur la policy existante de
    `organization_setting` (`0007`) ; la règle transverse demande néanmoins un **test d'accès croisé**
    (bandeau actif sur A absent de B), sur le modèle du test pied de page de `site-navigation.spec.ts`
    l. 144. Avec une table dédiée : `organization_id`, RLS forcée via `drizzle-kit generate --custom`
    sur le patron `0015_menu_item_rls.sql`, et mise à jour du « Classement RLS des 24 tables »
    (`docs/architecture.md` l. 218-231), tenu à la main.
14. **s38 (export)** lira « bandeau d'alerte » parmi les contenus publiés du tronc commun
    (`docs/stories.md` l. 2668) : la persistance choisie doit être énumérable par association. Une clé
    `organization_setting` hors registre l'est (ADR 021 le signale déjà pour le pied de page), mais
    s38 devra connaître les clés — à documenter.
15. **Voisinage et conflits de fusion.** s04 / s04b : aucune ligne de leur code n'est à modifier ;
    s07 réemploie leur patron. s05 (implémentation en cours dans l’arbre, non commitée) ajoute `NEWS_MANAGE` au registre, une entrée
    « Actualités » dans `NAV_GROUPS` et des routes publiques qui **hériteront** du bandeau s'il est dans
    le gabarit commun. s06, s08, s09 travaillent en parallèle : tous touchent vraisemblablement
    `action-registry-types.ts`, `bureau-sidebar.tsx` et `messages/fr.json` — fusions attendues, sans
    recouvrement fonctionnel. Aucun ne touche `LocaleLayout` à ce jour (vérifié dans le plan de s05).
16. **Process** : `pnpm test --run` ; pas de `pnpm build` automatique ; `feature/s07-bandeau-alerte` à
    brancher depuis `main` à jour (`0b328a2`). Ce fichier a été écrit dans l'arbre de travail actuel
    (branche `feature/s05-actualites`) sans commit : il doit voyager avec `feature/s07-bandeau-alerte`.

## Open questions

1. **Un niveau ou trois ?** Arbitrage de `/ks-prd`, non rendu (Trap 1). Sans décision, le plan part
   sur **un niveau** (périmètre écrit). Si trois : élargissement de périmètre, complexité à revoir, et
   la phrase du DS §2.3 « ne pas trancher avant `/ks-design s07` » à corriger.
2. **Persistance** : clés `organization_setting` hors registre sur le précédent ADR 021 (ex. message +
   état actif, et faut-il **garder le message** à la désactivation pour le réactiver tel quel ?), ou
   table dédiée (qui ne se justifie qu'avec `level`/`endsAt`/historique) ? Si clés : faut-il un ADR
   propre, ou une ligne suffit-elle puisque l'ADR 021 prévoit explicitement ce cas ?
3. **Refermable par le visiteur ?** Aucun critère ne le demande ; le DS §2.3 le prévoit (niveaux 1-2,
   24 h, `localStorage`). Si oui : identifiant de version du message à définir (Trap 2), et un
   composant client pour ce seul comportement.
4. **Placement exact** : bandeau rendu une fois dans `BaseLayout` (au-dessus des barres latérales,
   gabarits à sidebar à corriger) ou dans chaque layout de groupe ? Au-dessus de l'en-tête dans le
   back-office aussi, ou seulement côté public ? Sticky ou non ? Échelle de `z-index` (manque §9) à
   poser par s07 ou laissée à s41 ?
5. **Pages « existantes » couvertes** : le critère 1 vise-t-il aussi les zones héritées
   `admin/**` (SuperAdmin), `docs/**`, `(app)/**` et `/blog`, ou seulement le site de l'association,
   la connexion et `/bureau/**` ? Un rendu dans `LocaleLayout` les couvre toutes d'office.
6. **Écran du bureau** : route dédiée (`/bureau/…`) et entrée de sidebar — dans `siteGroup`
   (« Le site ») ou `group` ? Ou une section de l'écran Navigation / Réglages ? Le DS §2.3 imagine une
   désactivation « depuis n'importe quelle page du back-office » (contrepartie du niveau 3 seulement).
7. **Contraintes du message** : 280 caractères (DS) retenus ? Texte brut seulement, ou lien facultatif
   `{label, href}` ? Retours à la ligne autorisés ?
8. **Rôle ARIA** du bandeau (Trap 7) : `region` étiquetée, `role="status"`, ou `role="alert"` ?
9. **Tokens sombres `warning`** : dérivés, non validés (globals.css l. 133-138). Le bandeau est leur
   premier consommateur visible en mode sombre : faut-il faire valider ce jeu par la conception
   avant de livrer, ou livrer avec les valeurs dérivées et garder le manque ouvert ?
