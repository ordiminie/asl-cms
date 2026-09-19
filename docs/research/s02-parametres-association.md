# Recherche — Story s02-parametres-association

> Recherche du 2026-09-17, **mise à jour le 2026-09-19** sur `main` à `4b21b3f` (s01b mergée, design
> system corrigé par la PR 10). Tout ce qui suit a été revérifié en ouvrant les fichiers ; les numéros
> de ligne valent pour ce commit. Revue du découpage : `docs/reviews/stories.md` →
> `Max severity: minor`, `Stories ready: yes`.
>
> **Ce qui a changé depuis le 17/09** : le logo, le favicon, l'adaptateur `local`, la route de lecture
> et l'espace bureau sont **livrés par s01b** et sortis de s02. La story a été réécrite (PR 9) : ses
> critères ne portent plus ni logo ni favicon, l'accès suit le bureau de l'association, et le registre
> ne déclare que trois clés. Les questions 1 à 5, 7 et 11 de la version précédente sont closes.

## Story cible

**En tant que** membre du bureau d'une association **je veux** modifier ses réglages **afin de** ne
dépendre du prestataire pour aucune adresse ni aucun seuil. Complexité 3. Dépend de s01 et s01b.

Critères d'acceptation (verbatim, `docs/stories.md` §s02) :

1. La page de réglages de l'association liste les paramètres déclarés au registre et permet de les modifier, chaque valeur étant validée selon le type déclaré au registre. En s02, le registre déclare l'adresse de contact et l'adresse du responsable forage (définies par `CDCT §4.6`, lues par s08 et s10) et la teinte d'accent.
2. La validation du registre est prouvée pour chaque type qu'il sait porter — adresse email, nombre, booléen, choix dans une liste fermée — : une valeur conforme est acceptée, une valeur non conforme est refusée avec un message explicite. Déclarer une clé d'un type existant ne demande aucune modification de la page — vérifié par une clé de test déclarée au registre de test.
3. Modifier un paramètre puis le relire renvoie la nouvelle valeur, sans redéploiement ni redémarrage.
4. Un paramètre jamais renseigné se lit à sa valeur par défaut déclarée au registre ; le renseigner puis le vider le ramène à cette même valeur par défaut.
5. Le seed d'un tenant charge les valeurs déclarées dans son jeu de paramètres : après exécution, chaque clé déclarée se lit à sa valeur déclarée — vérifié sur un tenant de test, sans dépendre des données d'un client.
6. Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin modifient les paramètres : tout autre utilisateur authentifié reçoit un refus, côté interface et côté serveur.
7. Le bureau choisit la **teinte d'accent** de son association **dans la liste des six teintes validées**, jamais au sélecteur libre ; la couleur retenue s'applique au site public après rechargement.
8. Deux associations aux teintes différentes servent bien deux teintes distinctes — vérifié sur les deux domaines (test d'isolation visuelle).
9. Une association qui n'a pas choisi de teinte reçoit la teinte par défaut. Aucun écran cassé faute de personnalisation.

Notes de la story à retenir : clés `contact.email` et `forage.responsable.email` ; valeurs de La Fourche
= **seed de ce tenant**, jamais attendues par les tests ; registre typé (nom, type, défaut,
description), pas un `Record<string, string>` ; la teinte est un paramètre de `organization_setting` ;
l'action « modifier les paramètres » sera déclarée au registre des permissions **par s03** ; l'absence
de constante métier se vérifie en revue, pas en test.

## État actuel du code

### Paramètres

- **`organization_setting` n'existe toujours pas** : aucune occurrence dans `src/` ni `drizzle/`.
- **`app_settings` reste global** (`src/db/models/app-settings-model.ts:17-28`) : `key` seule en clé
  primaire, colonnes `value`, `type`, `category`, `label`, `description`, `updatedAt`, `updatedBy`.
  Énumérés Postgres `setting_type` (`boolean`, `string`, `number`, `json`, lignes 5-10) et
  `setting_category` (`email`, `general`, lignes 12-15). **Ni `email` ni liste fermée** parmi les types.
- Chaîne complète existante, patron le plus proche mais **à adapter, pas à copier** :
  page `src/app/[locale]/admin/settings/page.tsx`, formulaire `settings-form.tsx` (un champ par type,
  retours par **`toast` de `sonner`**, lignes 81-86 — contraire au design system §2.1 pour une erreur),
  action `actions.ts` (`requireActionAuth({roles: …})` rôles **globaux**, `revalidatePath`, ligne 22),
  service `src/services/app-settings-service.ts` (getters typés lignes 121-137,
  `bulkUpdateAppSettingsService` ligne 181), repository `src/db/repositories/app-settings-repository.ts`,
  façade `src/services/facades/app-settings-service-facade.ts`.

### Espace bureau (livré par s01b)

- Groupe de routes `src/app/[locale]/(bureau)/` : `layout.tsx` + une page `bureau/identite/`
  (`page.tsx`, `actions.ts`, `actions.test.ts`). URL actuelle : `/{locale}/bureau/identite` (ADR 008 pas
  encore appliqué).
- **Layout** : ne fait jamais `await` de la session en tête ; `BureauShell` derrière `<Suspense>` lit
  `requireCurrentTenantDal()` et `canManageCurrentAssociationIdentityDal()` ; refus → `BureauAccessDenied`
  sans barre latérale. **La page répète le contrôle** (« une navigation cliente ne rejoue pas le layout »).
- **Barre latérale** `src/components/features/association/bureau-sidebar.tsx` : un seul groupe
  (« L'association »), un seul item « Identité » **codé en dur avec `isActive`** et `aria-current="page"`.
  Ajouter une page oblige à rendre l'item actif dépendant de la route. Tiroir mobile via
  `bureau-menu-button.tsx`.
- **Action** `replaceAssociationIdentityFileAction` : `requireCurrentTenantDal()` → `requireActionAuth()`
  (sans rôle) → façade ; le service porte le contrôle d'accès ; toute erreur est rendue comme résultat ;
  succès → `updateTag(TENANT_CACHE_TAG)`. Messages via `getTranslations('BureauIdentityPage')`.
- **Retours d'interface** : `AssociationIdentityCard` ancre succès et erreur dans la carte (`alert`),
  pas de toast.

### Accès (livré par s01b)

- `canManageAssociationIdentity(user, organizationId)`
  (`src/services/authorization/association-identity-authorization.ts:20`) : `super_admin` global, ou
  membre de **cette** organisation avec le rôle `owner` ou `admin`. **Volontairement hors CASL** (CASL
  accorde `manage` à l'`admin` global sur toutes les organisations). C'est exactement la règle du
  critère 6 de s02, mais son nom et son module parlent d'« identité ».
- Façade `canManageAssociationIdentityService` et DAL `canManageCurrentAssociationIdentityDal`
  (`src/app/dal/association-identity-dal.ts:13`, `cache()` React seul, donnée par utilisateur).
- Rôles d'association en base : énuméré `organization_role` = `admin`, `member`, `owner`
  (`auth-model.ts`) ; le renommage `admin` → `board` est prévu en s03, pas fait.

### Tenant et isolation

- `src/db/tenant-scope.ts` : `getDb()` ligne 122, `withTenant()` ligne 128, `withRlsBypass()` ligne 144.
- `src/app/dal/tenant-dal.ts` : `TenantDTO` (lignes 18-29) porte désormais `logoKey` et `faviconKey`
  (s01b) en plus de `id`, `name`, `slug`, `domain`, `enabledModules` ; `getTenantByDomainDal` ligne 42
  (`'use cache'`, `cacheLife('hours')`, `cacheTag('tenant')`), `getCurrentTenantDal` ligne 71,
  `requireCurrentTenantDal` ligne 93, `withCurrentTenant` ligne 112, `requireEnabledModuleDal` ligne 131.
- Une seule table sous RLS forcée : `user_submissions` (`drizzle/migrations/0004_rls_tenant_isolation.sql`).
  Dernière migration : `0005_big_iron_man.sql` (colonnes d'identité de s01b).
- `docs/architecture.md` : « Classement RLS des 20 tables du schéma » (ligne 206) ; section « Scopée
  par une policy RLS forcée — 1 table » (ligne 212). La ligne 233 annonce déjà que `organization_setting`
  « sera scopée ».

### Teinte d'accent

- Tokens en place : `src/app/globals.css:75-79` (`--accent-hue: 195`, puis `--accent`,
  `--accent-foreground`, `--accent-solid`, `--accent-border` en `oklch(… var(--accent-hue))`) ; variante
  sombre lignes 145-153, qui ne redéclare pas `--accent-hue`.
- **Aucune injection par tenant** : `src/app/[locale]/layout.tsx` fait `await requireCurrentTenantDal()`
  sans utiliser la valeur, puis `<BaseLayout locale={locale}>` ; `BaseLayout`
  (`src/app/[locale]/base-layout.tsx`) rend `<html lang={locale} suppressHydrationWarning>` sans `style`.
- Consommateurs actuels de la teinte : `AssociationMark` (monogramme en `bg-accent-solid`) — suivra la
  variable CSS sans modification.
- **Valeur en dur à remplacer** : `src/lib/helper/association-monogram-svg.ts:9`,
  `DEFAULT_MONOGRAM_ACCENT_HEX = '#17849B'`, dont le commentaire dit « s02 la remplacera par la teinte
  paramétrée de l'association ». Utilisée par `renderAssociationMonogramSvg(name)` (ligne 24), servie par
  `GET /api/identity/favicon` quand il n'y a pas de favicon (`route.ts:84-90`, `Cache-Control: no-cache`).
  Un SVG servi comme image ne lit pas les variables CSS de la page : il lui faut la couleur elle-même.

### Seed

- SQL brut via `pg.Client`, refusé si `NODE_ENV=production` (`seed.ts:21`).
- Tenants de test : TechCorp Solutions (`localhost`, module `voirie`) et Marketing Pro (`127.0.0.1`),
  plus Acme et Evil Corp sans domaine (`seed.ts:271-277`).
- Comptes pour le critère 6, vérifiés dans le seed (`seed.ts:282-300`) : `user-owner@gmail.com`
  (Présidente de TechCorp), `user-admin@gmail.com` (Bureau de Marketing Pro), `user@gmail.com`
  (`member` de TechCorp), `admin@gmail.com` (admin **global**, `member` de TechCorp),
  `superadmin@gmail.com` (`super_admin`, ligne 142).
- Écriture sous RLS : `SET app.bypass_rls = 'on'` / `'off'` autour de l'insertion (`seed.ts:520-541`).
  `app_settings` seedé en `INSERT … ON CONFLICT (key) DO NOTHING` (ligne 491).

## Points d'ancrage

| Besoin                          | Où ça se branche                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table `organization_setting`    | modèle dans `src/db/models/`, `pnpm db:generate`, puis migration **custom** pour la policy (`drizzle-kit generate --custom`, patron `0004`)          |
| Registre typé des clés          | `src/services/types/domain/` (module isomorphe, comme `association-identity-types.ts`) ; doit accepter un registre de test (critère 2)               |
| Accès données                   | repository sous `src/db/repositories/`, **`getDb()` uniquement**                                                                                     |
| Service + façade + intercepteur | patron `association-identity-service.ts` : `safeParse` → contrôle d'accès → repository ; façade + intercepteur sous `src/services/facades/`          |
| Règle d'accès                   | `canManageAssociationIdentity` (même règle) — réutiliser, généraliser ou renommer : voir questions                                                   |
| Lecture pour la présentation    | DAL sous `src/app/dal/`, fonction cachée recevant l'`organizationId` en argument, `cacheTag` par association, `withTenant(...)` ouvert à l'intérieur |
| Page de réglages                | nouveau segment sous `src/app/[locale]/(bureau)/bureau/` (le layout, l'accès et la barre latérale existent)                                          |
| Barre latérale                  | `bureau-sidebar.tsx` : deuxième item, item actif selon la route                                                                                      |
| Invalidation                    | `updateTag(...)` dans l'action (patron `bureau/identite/actions.ts`)                                                                                 |
| Teinte sur le site              | `[locale]/layout.tsx` (tenant déjà résolu) → `BaseLayout` → `style` de `<html>`                                                                      |
| Favicon par défaut              | `association-monogram-svg.ts` + `api/identity/[kind]/route.ts` : passer la teinte de l'association                                                   |
| Seed par tenant                 | `src/db/scripts/seed.ts`, après les organisations, sous `app.bypass_rls`                                                                             |
| Preuve d'isolation              | e2e sur `localhost` / `127.0.0.1` (patrons `e2e/tenant-isolation.spec.ts`, `e2e/association-identity.spec.ts`)                                       |
| Traductions                     | `messages/{en,fr,es}.json` ; namespaces voisins `BureauIdentityPage`, `AssociationMark`                                                              |
| Documentation                   | `docs/architecture.md` : classement RLS (décompte des tables, section « Scopée »)                                                                    |

## APIs / fonctions vérifiées

| Symbole                                  | Signature vérifiée                                                                  | Emplacement                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `getDb`                                  | `(): ScopedDb`                                                                      | `src/db/tenant-scope.ts:122`                                          |
| `withTenant`                             | `<T>(organizationId: string, callback: () => Promise<T>): Promise<T>`               | `src/db/tenant-scope.ts:128`                                          |
| `TenantDTO`                              | `{id, name, slug, domain, enabledModules, logoKey, faviconKey}`                     | `src/app/dal/tenant-dal.ts:18`                                        |
| `TENANT_CACHE_TAG`                       | `'tenant'`                                                                          | `src/app/dal/tenant-dal.ts:31`                                        |
| `getTenantByDomainDal`                   | `(domain: string): Promise<TenantDTO \| undefined>`, `'use cache'`                  | `src/app/dal/tenant-dal.ts:42`                                        |
| `getCurrentTenantDal`                    | `(): Promise<TenantDTO \| undefined>`                                               | `src/app/dal/tenant-dal.ts:71`                                        |
| `requireCurrentTenantDal`                | `(): Promise<TenantDTO>` — `notFound()` sinon                                       | `src/app/dal/tenant-dal.ts:93`                                        |
| `withCurrentTenant`                      | `<T>(callback: () => Promise<T>): Promise<T>` — sans tenant, exécute **hors scope** | `src/app/dal/tenant-dal.ts:112`                                       |
| `canManageAssociationIdentity`           | `(user: User \| undefined, organizationId: string): boolean`                        | `src/services/authorization/association-identity-authorization.ts:20` |
| `canManageCurrentAssociationIdentityDal` | `(): Promise<boolean>`, `cache()` React                                             | `src/app/dal/association-identity-dal.ts:13`                          |
| `getAuthUser`                            | `cache(async () => …)`                                                              | `src/services/authentication/auth-service.ts:15`                      |
| `requireActionAuth`                      | `cache(async (options?: RequireAuthOptions) => …)` — rôles globaux ou `uid`         | `src/app/dal/user-dal.ts:41`                                          |
| `RoleConst.SUPER_ADMIN`                  | `'super_admin'`                                                                     | `src/services/types/domain/auth-types.ts:51`                          |
| `renderAssociationMonogramSvg`           | `(associationName: string) => string`                                               | `src/lib/helper/association-monogram-svg.ts:24`                       |
| `DEFAULT_MONOGRAM_ACCENT_HEX`            | `'#17849B'`                                                                         | `src/lib/helper/association-monogram-svg.ts:9`                        |
| `createServiceInterceptor`               | `<T>(serviceMethods: T, serviceName: string, options?) => T`                        | `src/services/facades/interceptors/create-service-interceptor.ts:12`  |
| `appSettings`, `settingTypeEnum`         | table `app_settings` ; énuméré `'setting_type'`                                     | `src/db/models/app-settings-model.ts:17,5`                            |

Scripts vérifiés (`package.json:17-31`) : `test` (Vitest, **`--run`** en non interactif), `db:generate`,
`db:migrate`, `db:check`, `db:seed`, `db:reset-seed`.

## Pièges et contraintes

- **La classification RLS n'est vérifiée par aucun test.** Ajouter `organization_setting` impose de
  mettre à jour `docs/architecture.md` (titre « 20 tables », section « Scopée — 1 table ») : rien ne le
  signalera sinon.
- **Migration de policy = migration custom**, patron `0004` (`ENABLE` + `FORCE` + policy
  `tenant_isolation` avec `NULLIF(current_setting('app.organization_id', true), '')::uuid` ou
  `app.bypass_rls = 'on'`). Jamais d'écriture à la main dans `drizzle/migrations/` ni dans le journal.
- **Droits du rôle applicatif `asl_app`** : accordés par `ALTER DEFAULT PRIVILEGES` pour les tables créées
  par le rôle propriétaire. À vérifier par `pnpm db:check` et l'e2e.
- **`'use cache'` et scope de tenant** : la fonction cachée reçoit l'`organizationId` en argument et
  ouvre elle-même `withTenant(...)` ; le scope `AsyncLocalStorage` de l'appelant n'est pas une garantie
  dans un scope caché.
- **Logger dans un scope caché — toujours présent** : l'intercepteur de façade logge à chaque appel
  (`create-service-interceptor.ts:24`), et `getTenantByDomainDal` appelle une façade depuis `'use cache'`.
  C'est le minor 4 de la review de s01, non corrigé ; la CI passe malgré tout. Ne pas en ajouter un
  second dans la lecture des paramètres.
- **La teinte est lue sur chaque page**, public comme bureau : lecture cachée, invalidation par
  `updateTag` (lecture immédiate de sa propre écriture), pas `revalidateTag`.
- **Deux caches, deux tags** : la teinte en `organization_setting` sous un tag par association ne
  partage pas le tag `tenant`. Le favicon par défaut (route, `no-cache`) et le layout doivent tous deux
  relire la nouvelle teinte.
- **La barre latérale a un item actif codé en dur** : ajouter la page des réglages sans corriger cela
  rendrait « Identité » active sur les deux pages.
- **`withCurrentTenant` sans tenant exécute hors scope** : sous RLS, tout réglage « revient au défaut ».
  Devant ce symptôme, tester le scope d'abord (AGENTS.md).
- **Ne pas recopier `rule-persistence.md`** : il enseigne encore `import db from '@/db/models/db'`
  (ligne 112), contraire à AGENTS.md.
- **Ne pas recopier les retours en `toast` de `admin/settings`** : les erreurs vont dans une `alert`
  ancrée (design system §2.1, §3.2), comme dans l'écran d'identité.
- **Locales** : `en`, `fr`, `es` actives, `en` par défaut (`src/i18n/routing.ts`) ; libellés dans les
  trois fichiers `messages/`.
- **Tests à ne pas casser** : `src/app/dal/tenant-dal.test.ts`, `association-identity-dal.test.ts`,
  `src/db/tenant-scope.test.ts`, `src/services/__tests__/association-identity-*.test.ts`,
  `src/app/[locale]/(bureau)/bureau/identite/actions.test.ts`, `e2e/tenant-isolation.spec.ts`,
  `e2e/association-identity.spec.ts`. La RLS ne se prouve qu'en e2e ; l'e2e tourne en CI sur chaque PR,
  pas en local (pas de Chromium dans le conteneur).
- **Aucune valeur d'un client dans le code ni dans les tests**, aucun secret dans `organization_setting`
  (ADR 010).

## Questions ouvertes

1. **Règle d'accès : réutiliser ou généraliser `canManageAssociationIdentity` ?** La règle est identique
   (bureau de l'association du domaine appelé + SuperAdmin), mais le nom parle d'identité. Options :
   l'appeler telle quelle, la renommer (`canManageAssociation…`) avec ses appelants, ou en créer une
   seconde qui la réutilise. s03 déclarera l'action au registre des permissions : le choix doit lui
   laisser un point d'accroche unique.
2. ~~**Où vit la teinte à l'écran ?**~~ **Tranché par Marie-Ève le 2026-09-19** : dans la page
   **« Identité »** (critère 1 reformulé sur `main` en ce sens, PR 11), avec le logo et le favicon. Le **sélecteur des six teintes avec aperçu** reste un
   manque du design system (§9, « Tenant ») : il relève de `/ks-design`.
3. **Forme du registre et du stockage.** Réutiliser les énumérés `setting_type` / `setting_category`
   d'`app_settings` (qui n'ont ni `email` ni liste fermée) ou déclarer les siens ? La table ne peut-elle
   stocker que `organization_id`, `key`, `value` en laissant type, libellé et défaut au registre ?
   L'ADR 010 liste `type`, `category`, `label`, `description` en colonnes : s'en écarter demande de le
   dire (et peut-être un ADR).
4. **« Vider ramène au défaut »** — **règle tranchée par Marie-Ève le 2026-09-19** (PR 12) : l'adresse de
   contact est l'adresse par défaut, **obligatoire**, saisie à la création de l'association (formulaire de
   provisioning de s01 : `provision-organization-form.tsx`, `provision-organization-form-validation.ts`,
   `provisionOrganizationService`) et jamais vidée ; `forage.responsable.email` a pour défaut l'adresse de
   contact. **Reste au plan** : la forme technique — supprimer la ligne ou stocker une valeur vide lue
   comme absente — et comment le registre exprime « défaut = un autre réglage ». Les tenants de test du
   seed et toute association déjà en base doivent recevoir une adresse de contact.
5. **Registre de test (critère 2)** : comment la page et le service reçoivent-ils un registre autre que
   celui de production — injection en paramètre, ou module mocké en Vitest ? « Aucune modification de la
   page » suppose un rendu générique piloté par le registre.
6. **Injection de la teinte** : `attr()` typé non vérifiable ici (pas de navigateur) ; le repli
   documenté (`style` sur `<html>` posé par le serveur) est réalisable avec l'existant. Une teinte hors
   liste en base (valeur corrompue) doit retomber sur le défaut plutôt que casser le rendu (critère 9).
7. **Couleur du favicon par défaut.** Le SVG ne lit pas les tokens : il lui faut une couleur calculée par
   teinte. Le tableau de §1.2 donne un hexadécimal par teinte, **mais il ne coïncide pas avec les tokens
   OKLCH** : pour la teinte 195, `#17849B` (tableau) contre environ `#008384` recalculé depuis
   `oklch(0.55 0.1 195)`. Choisir la source de vérité (tableau hex, ou `oklch()` écrit directement dans
   le SVG si les navigateurs visés le rendent) — non vérifiable sans navigateur.
8. ~~**Contraste du monogramme**~~ **Tranché par Marie-Ève le 2026-09-19** : le monogramme est
   traité comme un **logotype**, dispensé de l'exigence de contraste (WCAG 1.4.3), parce que le nom de
   l'association est **toujours écrit en clair à côté** (`AssociationMark`). Aucun ajustement de teinte.
   Mesures pour mémoire : texte clair sur `accent-solid`, depuis le tableau hex de §1.2, 195 → 4,37:1 ;
   150 → 5,03 ; 255 → 5,15 ; 40 → 4,69 ; 300 → 5,45 ; 95 → 4,84 ; depuis les tokens OKLCH, environ 4,4:1
   pour 195 avec `primary-foreground`. **Reste ouvert** : §3.7 annonce 4,9:1 pour `accent-solid` sur fond
   blanc, ce qu'aucun des deux calculs ne retrouve pour la teinte 195.
9. **« Jeu de paramètres » d'un tenant pour le seed** (critère 5) : format et emplacement. Une vraie
   association reçoit-elle ses valeurs de départ par le seed (refusé en production) ou au provisioning
   (s01) ? Le critère ne vise que le seed d'un tenant de test.

<< IP Mike: exploration method, what a good research always verifies. >>
