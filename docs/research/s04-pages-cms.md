# Research — Story s04-pages-cms

## Target story

**En tant que** membre du bureau **je veux** créer, modifier, publier et dépublier une page composée
de blocs **afin de** faire vivre le site sans intervention du prestataire.

Réf. `V5 §3.1, §4.1`, `CDCT §3.1, §4.1`, ADR 007 (éditeur CMS en blocs typés).

### Acceptance criteria (docs/stories.md)

- [ ] Le bureau crée une page (titre, slug, contenu riche, images) et la voit rendue à l'URL publique une fois publiée.
- [ ] Une page en brouillon n'est pas accessible publiquement (404 pour un visiteur) mais reste prévisualisable par le bureau.
- [ ] Dépublier une page la retire du site public sans la supprimer ; la republier la restaure à l'identique.
- [ ] L'insertion d'une image dans une page l'enregistre dans le stockage de fichiers et l'affiche dans le rendu public.
- [ ] Un slug déjà utilisé dans la même association est refusé avec un message de champ ; deux associations peuvent avoir le même slug.
- [ ] Un membre non-bureau ne peut ni créer ni modifier de page.
- [ ] Une page est une **liste ordonnée de blocs typés**, pas un champ de texte unique : le bureau insère un bloc à un rang précis, en change l'ordre, et le rendu public respecte cet ordre après rechargement.
- [ ] Le réordonnancement est atteignable **sans glisser-déposer** — au clavier seul, l'ordre obtenu est le même qu'à la souris.
- [ ] Un type de bloc inconnu dans une page enregistrée ne casse pas le rendu : la page s'affiche, le bloc est ignoré et signalé au bureau.

### Dependencies déclarées

`s01, s02, s03b`.

**s03b est livrée**, contrairement à ce qu'une version précédente de cette recherche affirmait (état
vérifié sur `main` avant le merge de s03b). État vérifié le 21 septembre 2026 **sur la branche
`feature/s03b-roles-registre-actions`**, qui porte les commits `218ba7c` (implémentation) et `a0a47aa`
(revue, `Ship allowed: yes`) au-dessus de `25c8667` (s12a, dernier commit de `main`). ⚠️ Point de
process, pas de code : `docs/reviews/s03b-roles-registre-actions.md` dit « ship allowed » mais aucun
`/ks-ship s03b` n'a encore ouvert de PR — la story n'est donc pas encore mergée sur `main`. Voir
« Open questions » n°1 : `/ks-plan s04` et `/ks-execute s04` devraient normalement partir d'un
`feature/s04-pages-cms` branché sur `main` **après** ce merge (règle « un branch par story » d'`AGENTS.md`),
pas de la branche courante. Le contenu ci-dessous suppose que le code de s03b (rôles `board`,
registre d'actions) est bien présent à la racine du travail de s04, quelle que soit la branche exacte.

---

## Current state of the code

Vérifié le 21 septembre 2026, sur `feature/s03b-roles-registre-actions`. s01, s01b, s02, s03, s03b
sont livrées (s03b sur cette branche, pas encore mergée — voir ci-dessus) ; **aucune story de contenu
(s04 et après) n'existe encore dans le code.**

- **Aucun modèle `page` ni `content_block` n'existe.** `src/db/models/` contient `action-registry` n'y
  est **pas** un modèle (c'est un module de code, voir plus bas) ; les fichiers présents sont
  `app-settings-model.ts`, `auth-model.ts` (dont `organization`, `member`), `notification-model.ts`,
  `organization-model.ts`, `organization-setting-model.ts`, `post-model.ts`, `subscription-model.ts`,
  `user-model.ts`, `user-submission-model.ts`. `docs/architecture.md` (§ Data model, ligne 200) liste
  déjà `page` et `content_block` comme entités **cibles** d'ASL-CMS (ADR 007) — c'est un document
  d'architecture prospectif, pas une preuve d'existence : le code, lui, n'a rien.
- `post-model.ts` (`posts`, `posts_translation`, `categories`, `hashtags`, `post_hashtags`) est le blog
  hérité du boilerplate : **pas tenant-scopé** (pas de colonne `organization_id`),
  `posts_translation.slug` est **globalement unique** (`text('slug').notNull().unique()`) — anti-patron
  à ne pas recopier pour `page.slug`, qui doit être unique par association (critère 5).
- **Aucune route API ne sert de fichier de contenu.** `src/app/api/` ne contient que `auth`, `identity`
  (`GET /api/identity/[kind]`, s01b), `inngest`, `webhooks/stripe`. La chaîne générique
  `uploadFilePostService` → `file-service.ts` → `files-repository.ts` upload bien un fichier sur le
  disque (adaptateur `local`), mais **rien ne le sert** : `getFileUrl` dans `file-service.ts`
  (ligne 62) est toujours `const getFileUrl = (path) => path`, qui n'est pas une URL joignable — vérifié
  à nouveau aujourd'hui, inchangé depuis la précédente recherche. Cette chaîne n'est pas un exemple à
  suivre. Le bon patron pour un fichier tenant-scopé servi publiquement est
  `association-identity-service.ts` + `GET /api/identity/[kind]/route.ts` — voir « Anchor points ».
- **`@dnd-kit` (`core`, `sortable`, `utilities`) et les paquets `@milkdown/*` sont dans
  `package.json`**, mais `@dnd-kit` n'est utilisé **nulle part** dans `src/` (confirmé par grep, aucun
  résultat). `@milkdown/*` a un seul usager : `src/components/ui/markdown-editor.tsx`, employé
  uniquement par `src/components/features/admin/blog/post-form.tsx` (back-office du blog hérité). Ce
  composant instancie explicitement `commonmark` **et** `gfm`
  (`.use(commonmark).use(gfm)`, lignes 6-46) et son propre texte d'aide dit noir sur blanc : « Support
  GFM : tableaux, listes de tâches, code fencé, strikethrough » (ligne 169). Il **ne respecte pas** la
  barre réduite du design system §2.1 (« gras, italique, titre 2, titre 3, liste, lien — pas de
  tableau, pas de code, pas de couleur »). Il ne peut pas être réutilisé sans modification pour le bloc
  « texte riche » de s04.
- **Le rendu MDX partagé (`src/components/mdx-content.tsx`, réutilisation prescrite par ADR 007) lit
  l'horloge via `await connection()`** (ligne 32), ce qui le rend **incompatible avec `'use cache'`** :
  `connection()` marque explicitement le sous-arbre comme rendu à la requête (dynamique), l'exact
  inverse de ce qu'exige la note de la story (« le rendu public est caché (`'use cache'` + `cacheTag`),
  la publication doit invalider avec `updateTag` »). Confirmé à nouveau aujourd'hui, inchangé. Voir
  « Traps ».
- **`organization_module` (pgEnum, `src/db/models/auth-model.ts:158`) ne contient que `vote`, `voirie`,
  `annonces`** (s33/s34/s35) — les pages ne sont **pas** un module désactivable, donc pas de
  `requireEnabledModuleDal`, seulement `requireCurrentTenantDal` / `withCurrentTenant`.
- **Le registre d'actions existe désormais** (s03b, ADR 018) :
  `src/services/types/domain/action-registry-types.ts` (module de code, sans table ni écran) et
  `src/services/authorization/action-registry-authorization.ts` (`canPerformAction`). Le rôle
  d'association `admin` a été renommé `board` **en valeur**, la clé `admin` de
  `OrganizationRoleConst`/`UserOrganizationRoleConst` reste inchangée par compatibilité de code
  (`OrganizationRoleConst.admin === 'board'`) — migration `drizzle/migrations/0011_organization_role_board.sql`.
  Voir « Anchor points » et « Verified APIs » pour l'usage exact.

## Anchor points

- **Scope de tenant, point d'entrée unique** : `withCurrentTenant()` / `requireCurrentTenantDal()`
  (`src/app/dal/tenant-dal.ts`), qui résolvent le tenant par le domaine appelé (en-tête
  `x-forwarded-host`/`host`, jamais lu dans un scope `'use cache'`) et ouvrent
  `withTenant(organizationId, ...)` (`src/db/tenant-scope.ts`). Les repositories de `page` /
  `content_block` doivent appeler `getDb()`, jamais `db` directement (règle déjà posée par s01/s02,
  inchangée).
- **Autorisation « action » (nouveau patron s03b, à utiliser pour s04)** :
  `canPerformAction(user, organizationId, actionId)`
  (`src/services/authorization/action-registry-authorization.ts`) — SuperAdmin toujours autorisé,
  sinon le rôle d'association de l'utilisateur **dans cette organisation** doit figurer dans
  `defaultRoles` de l'entrée `actionId` de `ACTION_REGISTRY`
  (`src/services/types/domain/action-registry-types.ts`). Une action absente du registre est **refusée**
  (défaut fermé). C'est le point d'accroche que la règle transverse « Registre d'actions »
  (`docs/stories.md`) impose à toute story qui introduit une action soumise à autorisation — s04 en
  introduit au moins quatre (créer / modifier / publier / dépublier une page) et **doit** les déclarer
  dans `ACTION_REGISTRY`, avec un nouvel `ActionIdConst` par action (ou une seule entrée si le plan
  choisit de regrouper les quatre verbes sous un rôle par défaut identique — `s01b` l'a fait pour logo
  et favicon sous une entrée unique `ASSOCIATION_IDENTITY_UPDATE`). **À trancher en plan**, pas ici.
- **`canManageAssociation` reste utilisé en parallèle**, pas remplacé : dans
  `association-identity-service.ts`, `canPerformAction` gate la **mutation**
  (`replaceAssociationIdentityFileService`) tandis que `canManageAssociation` sert une fonction
  séparée, `canManageAssociationIdentityService`, utilisée pour décider si l'**interface** (page de
  réglages, section du back-office) doit s'afficher à l'utilisateur courant. Même séparation probable
  pour s04 : `canPerformAction` + un `ActionIdConst` pour gater `createPageService` /
  `updatePageService` / `publishPageService` / `unpublishPageService`, `canManageAssociation` (ou son
  équivalent) pour décider si le groupe de sidebar « Le site » et les boutons d'édition s'affichent.
- **Gabarit de service tenant-scopé avec CRUD + validation + autorisation registre** :
  `src/services/association-settings-service.ts` — ordre exact vérifié : `safeParse` (Zod) →
  `getAuthUser()` → `canPerformAction(authUser, organizationId, ActionIdConst.X)` (sinon
  `AuthorizationError`) → validation métier → `withTenant(organizationId, () => repository(...))`. À
  reproduire pour un `page-service.ts`.
- **Gabarit de repository tenant-scopé** : `src/db/repositories/organization-setting-repository.ts`
  (`getDb()`, jamais `db`).
- **Gabarit de modèle Drizzle tenant-scopé** : `src/db/models/organization-setting-model.ts` —
  `organizationId` avec `references(() => organization.id, {onDelete: 'cascade'})`, à enregistrer dans
  `src/db/models/db.ts` (liste `schema: {...}`).
- **Gabarit de migration RLS forcée** : `drizzle/migrations/0007_organization_setting_rls.sql`
  (`ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation` sur
  `NULLIF(current_setting('app.organization_id', true), '')::uuid`, générée par
  `drizzle-kit generate --custom`, jamais écrite à la main autrement que via cette commande). Un
  deuxième exemple de policy RLS existe depuis, `0009_rate_limit_event_rls.sql` — même patron.
- **Gabarit de lecture publique cachée + invalidation** : `src/app/dal/association-settings-dal.ts`
  (`'use cache'` + `cacheLife('hours')` + `cacheTag`, tag `association-settings:<id>`, généré par une
  fonction `associationSettingsTag(organizationId)` exportée pour que l'action l'appelle en retour) et
  l'appel `updateTag(associationSettingsTag(tenant.id))` dans
  `src/app/[locale]/(bureau)/bureau/reglages/actions.ts`, **après** le succès de l'écriture, jamais
  avant. C'est le patron direct pour le cache de page publiée + son invalidation à la
  publication/dépublication (et pour le futur tag du menu, posé par s04b).
- **Gabarit de stockage tenant-scopé + route de lecture publique bornée** :
  `src/services/association-identity-service.ts` (`createStorage('local', {bucket, basePath, ...})`,
  clé générée côté serveur `{organizationId}/identity/{kind}-{uuid}.{ext}`, validation par
  **signature binaire** du fichier, écriture puis mise à jour de la référence, suppression de l'ancien
  fichier) + `src/app/api/identity/[kind]/route.ts` (type énuméré dans l'URL, tenant résolu par le
  domaine, clé lue en base — **jamais depuis la requête**, `X-Content-Type-Options: nosniff`, cache
  long conditionné à `?v=`). C'est le patron à suivre pour les images (et PDF) de blocs, **pas**
  `file-service.ts`. Le cas identité est plus simple (deux fichiers nommés, une fois par organisation) ;
  une page a un nombre arbitraire d'images à travers un nombre arbitraire de blocs — la route de
  lecture de s04 devra probablement être paramétrée par clé (validée contre le préfixe de
  l'organisation courante) plutôt que par un type énuméré fixe. À trancher en plan (Open question 5).
- **Back-office bureau** : `src/app/[locale]/(bureau)/layout.tsx` (contrôle d'accès derrière
  `<Suspense>`, `BureauAccessDenied` sinon) + `src/components/features/association/bureau-sidebar.tsx`
  — un seul groupe existe aujourd'hui, `ASSOCIATION_NAV_ITEMS` (« L'association » : `/bureau/identite`,
  `/bureau/reglages`). Design system §2.1 : la sidebar a _deux_ groupes à terme, « Le site » et
  « L'association » — **s04 est la première story à ouvrir le groupe « Le site »**, absent du code
  aujourd'hui.
- **Route publique de contenu par slug** : pas d'équivalent direct encore posé pour une page générique
  (le blog vit sous `/blog/[slug]`, préfixé). `src/app/[locale]/(public)/blog/[slug]/page.tsx` donne le
  patron `generateStaticParams` + `notFound()` sur brouillon/absent, mais son DAL
  (`getUnifiedBlogPostBySlugDal`) n'est pas tenant-scopé — à ne pas copier tel quel, seulement le patron
  de route.
- **e2e d'isolation** : `e2e/tenant-isolation.spec.ts` (preuve initiale, lourde, faite par s01) et
  `e2e/association-settings.spec.ts` / `e2e/association-identity.spec.ts` (preuves allégées par story,
  réutilisant les tenants seedés en base) — patron à suivre pour la preuve d'isolation de
  `page`/`content_block`, moins lourde que celle de s01.

## Verified APIs / functions

| Fonction / composant                   | Fichier                                                              | Signature vérifiée                                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `withCurrentTenant`                    | `src/app/dal/tenant-dal.ts`                                          | `<T>(callback: () => Promise<T>) => Promise<T>`                                                                                            |
| `requireCurrentTenantDal`              | `src/app/dal/tenant-dal.ts`                                          | `() => Promise<TenantDTO>`                                                                                                                 |
| `getDb`, `withTenant`, `withRlsBypass` | `src/db/tenant-scope.ts`                                             | `getDb(): ScopedDb`; `withTenant(organizationId: string, callback) => Promise<T>`; `withRlsBypass(callback) => Promise<T>`                 |
| `canPerformAction`                     | `src/services/authorization/action-registry-authorization.ts`        | `(user: User \| undefined, organizationId: string, actionId: string) => boolean` — SuperAdmin passe toujours, sinon rôle d'assoc.          |
| `isActionAllowedForRole`               | `src/services/types/domain/action-registry-types.ts`                 | `(registry: ActionRegistry, actionId: string, role: OrganizationRole) => boolean` — action absente = refus                                 |
| `ACTION_REGISTRY`, `ActionIdConst`     | `src/services/types/domain/action-registry-types.ts`                 | registre de production ; deux entrées existantes : `ASSOCIATION_IDENTITY_UPDATE`, `ASSOCIATION_SETTINGS_UPDATE`, rôles `['owner','board']` |
| `canManageAssociation`                 | `src/services/authorization/association-authorization.ts`            | `(user: User \| undefined, organizationId: string) => boolean` — SuperAdmin ou rôle `owner`/`board` de cette organisation                  |
| `OrganizationRoleConst`                | `src/services/types/domain/organization-types.ts`                    | `{admin: 'board', member: 'member', owner: 'owner'}` — **valeur** renommée, **clé** `admin` conservée                                      |
| `UserOrganizationRoleConst`            | `src/services/types/domain/auth-types.ts`                            | `{OWNER: 'owner', ADMIN: 'board', MEMBER: 'member'}` — doublon fonctionnel de `OrganizationRoleConst`, mêmes valeurs                       |
| `createStorage`                        | `src/lib/files/storage/storage-factory.ts`                           | `('local', StorageConfig) => StorageOperations` (`upload`, `download`, `delete`, `list`)                                                   |
| `MarkdownEditor`                       | `src/components/ui/markdown-editor.tsx`                              | `(props: {value?, onChange?, placeholder?, className?, disabled?, id?}) => JSX` — Milkdown + GFM complet, à restreindre pour s04           |
| `MDXContent`                           | `src/components/mdx-content.tsx`                                     | `async ({source: string}) => JSX`, **`await connection()` en tête — dynamique, incompatible `'use cache'`**                                |
| `organizationModuleValues`             | `src/db/models/auth-model.ts`                                        | `['vote', 'voirie', 'annonces']` — pages hors de cette liste                                                                               |
| `updateTag` (Next 16)                  | usages : `association-settings-dal.ts`, `bureau/reglages/actions.ts` | invalidation immédiate, patron confirmé en usage réel, appelée après écriture réussie                                                      |

## Traps & constraints

1. **Le registre d'actions existe désormais (levé depuis la précédente recherche)** : s04 doit
   déclarer ses actions (créer / modifier / publier / dépublier une page) dans `ACTION_REGISTRY` avec
   `canPerformAction`, à l'identique du patron posé par `association-settings-service.ts`. Ne pas
   réécrire un contrôle `canManageAssociation` à la main pour la mutation — c'est exactement ce que la
   règle transverse (et la note « à vérifier en review, pas en test » de s03b) interdit. `canManageAssociation`
   reste légitime pour la question distincte « cet utilisateur voit-il l'écran d'édition ? ».
2. **Tension entre ADR 007 (« le rendu réutilise le pipeline MDX existant ») et le mandat de cache de
   la story.** `MDXContent` appelle `await connection()`, qui _force_ le rendu dynamique par requête —
   exactement ce que `'use cache'` interdit de faire cohabiter. Le rendu public d'une page avec
   `'use cache'` + `cacheTag` (mandaté par la note de la story et par `docs/architecture.md` §Cache
   Components) ne peut donc pas passer par `MDXContent` tel quel. Deux issues possibles, à trancher en
   plan : (a) un rendu markdown→HTML synchrone et sanitisé, propre aux blocs, cachable ; (b) accepter
   que le rendu de page reste dynamique (comme les quatre routes `instant = false` déjà assumées dans
   `docs/architecture.md`) et documenter l'écart à ADR 007. Aucune des deux n'est actée dans les docs
   actuels.
3. **Aucune librairie de sanitisation HTML n'est présente dans `package.json`** (ni `rehype-sanitize`,
   ni `dompurify`, ni équivalent — reconfirmé aujourd'hui). ADR 007 est explicite : « le contenu des
   blocs est saisi par des humains et rendu en HTML : la sanitisation est une exigence de sécurité, pas
   une option. » À poser au plan — ajout de dépendance, donc hors périmètre d'un Quick Fix.
4. **`markdown-editor.tsx` n'est pas conforme à la barre réduite du design system** (§2.1 :
   gras/italique/titre 2-3/liste/lien seulement, ni tableau, ni code, ni couleur) : c'est un composant
   GFM complet (`commonmark` + `gfm`) avec bascule « texte brut » et un texte d'aide qui annonce
   lui-même tableaux, listes de tâches, code fencé et strikethrough. Le bloc « texte riche » de s04 doit
   soit le réécrire, soit en dériver une variante contrainte — pas le réutiliser en l'état.
5. **Le chemin générique `file-service.ts` n'est toujours pas un exemple à suivre** : pas de préfixe
   `organizationId`, pas de route de lecture branchée (`getFileUrl` renvoie toujours la clé brute, pas
   une URL — vérifié ligne 62). Aucune route ne sert aujourd'hui un fichier uploadé par cette chaîne.
6. **`posts_translation.slug` est unique globalement**, pas par organisation. Le critère 5 de s04
   (« deux associations peuvent avoir le même slug ») exige une contrainte unique composite
   `(organization_id, slug)` — un gabarit Drizzle à écrire, pas à copier depuis `posts`.
7. **Le logger est interdit dans tout scope `'use cache'`** (Winston horodate via `new Date()`) — la
   fonction du DAL qui rend une page publique ne doit rien logger directement ; logger avant/après
   l'appel caché si nécessaire.
8. **Le groupe de sidebar « Le site » n'existe pas encore** dans
   `src/components/features/association/bureau-sidebar.tsx` — s04 l'ouvre pour la première fois.
9. **Design system — trois manques signalés, à ne pas deviner** (§9) : la visionneuse de galerie
   (navigation entre images, compteur), les cinq aperçus miniatures du sélecteur de blocs, et l'échelle
   de `z-index` (partagée avec s07 et s41, seules deux valeurs posées : `PreviewBar` 50,
   `ImpersonationBar` 60). Les deux premiers sont explicitement assignés à s04 dans le design system ; à
   traiter en `/ks-design s04`, pas en freestyle.
10. **Deux constantes homonymes pour le même rôle** : `OrganizationRoleConst` (organization-types.ts)
    et `UserOrganizationRoleConst` (auth-types.ts) portent toutes deux `admin → 'board'`,
    `owner → 'owner'`, `member → 'member'`. Les deux sont utilisées dans le code actuel
    (`association-authorization.ts` importe `UserOrganizationRoleConst`, `action-registry-types.ts`
    type sur `OrganizationRole` d'`organization-types.ts`) — ne pas supposer qu'une seule existe, ne pas
    en introduire une troisième pour s04.
11. **`pnpm test` reste en mode watch** — toute exécution non interactive (implémenteur, reviewer, CI)
    doit utiliser `pnpm test --run`.
12. **Migrations** : toujours `pnpm db:generate` (ou `drizzle-kit generate --custom` pour une policy RLS
    manuscrite, deux exemples existants : `0007_organization_setting_rls.sql`,
    `0009_rate_limit_event_rls.sql`), jamais de SQL ni de `meta/_journal.json` écrits à la main.

## Open questions

1. **Process, pas code : `/ks-plan s04` doit-il attendre le merge de `feature/s03b-roles-registre-actions`
   sur `main` ?** `AGENTS.md` : « une story = un branch, branché depuis le défaut ». s03b est prête à
   shipper (revue « Ship allowed: yes ») mais pas encore mergée (pas de `/ks-ship s03b` exécuté au
   moment de cette recherche). Recommandation : lancer `/ks-ship s03b` d'abord, puis créer
   `feature/s04-pages-cms` depuis `main` à jour — sinon la branche de s04 hériterait de l'historique de
   s03b au lieu d'un merge propre.
2. **Le rendu public d'une page passe-t-il par un renderer markdown propre, cachable, ou le rendu reste-t-il
   dynamique (route `instant = false`) ?** Voir Trap 2. Conditionne le choix d'outillage (sanitisation
   comprise) et la conformité à la note de la story sur le cache.
3. **Sous quel préfixe de route vit une page CMS publique ?** Racine (`/{slug}`) ou un préfixe dédié
   (`/pages/{slug}`) ? Aucun document ne tranche ; le CDCT ne mentionne qu'une « URL publique ». Un choix
   à la racine ouvre un risque de collision avec les segments déjà réservés (`(public)`, `(bureau)`,
   `bureau`, `admin`, `api`, `docs`, `blog`, et les futurs modules `vote`/`voirie`/`annonces`) — à
   vérifier et probablement à interdire explicitement (liste de slugs réservés) plutôt qu'à découvrir en
   production.
4. **Quelle forme prend `content_block.data` ?** Aucun schéma n'est posé nulle part (ADR 007 ne donne que
   les cinq types et leurs champs informels — cf. design system §2.5, §4). À concevoir en plan : une
   colonne JSON typée par bloc (avec le garde-fou du critère 9 — un type inconnu est ignoré et signalé,
   jamais fatal) semble la voie la plus proche de l'existant (`organization_setting` utilise déjà un
   stockage clé/valeur simple, et le registre typé en code d'ADR 016 est un précédent direct pour « les
   types de blocs valides vivent dans le code, pas en base »), mais aucune story précédente ne donne de
   gabarit JSON typé en base à imiter.
5. **Les images et PDF de blocs suivent-elles exactement le patron `association-identity-*` (validation
   par signature binaire, clé serveur, route de lecture dédiée par type énuméré), ou une route plus
   générale (clé quelconque sous le préfixe de l'association, tenant résolu par domaine) ?** Le cas
   identité est plus simple (deux fichiers, une seule fois par organisation) ; une page peut avoir un
   nombre arbitraire d'images à travers un nombre arbitraire de blocs, donc pas de « type énuméré »
   unique côté route. À trancher en plan, probablement par une route paramétrée par clé (validée contre
   le préfixe de l'organisation courante), plutôt qu'une route par bloc.
6. **Faut-il ajouter une dépendance de sanitisation HTML (`rehype-sanitize` ou équivalent), et où vit-elle
   dans la couche (helper isomorphique, ou strictement serveur) ?** Voir Trap 3. C'est un ajout de
   dépendance, donc explicitement hors du périmètre « Quick Fix » — normal dans le pipeline standard,
   mais à documenter en plan puisqu'aucun choix n'est fait dans les docs existants.
7. **Le composant `<PreviewBar />` (statuts `draft | dirty | live | publishing | error | unpublished`,
   §2.2) est-il livré entièrement par s04, ou seulement les statuts qu'exigent ses propres critères
   (`draft`/`live`/`unpublished` au minimum) ?** Le design system le liste en P0 sans story assignée
   explicitement dans le tableau, mais s04 est la première (et pour l'instant seule) story à avoir un
   flux brouillon/publié/dépublié. À confirmer en `/ks-design s04`.
8. **s04 déclare-t-elle une seule action au registre (« gérer une page », rôles `['owner','board']`) ou
   une par verbe (créer / modifier / publier / dépublier) ?** Les deux lectures du critère 6 sont
   défendables ; le précédent `ASSOCIATION_IDENTITY_UPDATE` (une entrée pour deux actions distinctes,
   logo et favicon) penche pour une entrée unique, mais publier/dépublier pourrait un jour avoir des
   rôles différents de créer/modifier. À trancher en plan.

Research ready in docs/research/s04-pages-cms.md. Next step: /ks-design s04 (UI story) or /ks-plan s04
