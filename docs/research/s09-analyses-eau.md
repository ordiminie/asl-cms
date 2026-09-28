# Research — Story s09-analyses-eau

## Target story

**En tant que** membre du bureau **je veux** publier rapidement un résultat d'analyse d'eau **afin
que** tout visiteur puisse le consulter sans compte.

Complexité 2. Dépend de **s04** (livrée, mergée : `94b4906`, PR #21). Réf. `V5 §4.4`, `CDCT §4.4`,
PRD ligne « Publication des analyses d'eau » (« contenu répétable (date, affiche, texte, PDF), saisie
rapide car publication au moins mensuelle »). Elle porte aussi le critère de succès du PRD « le bureau
crée, modifie et publie une page, une actualité et **une analyse d'eau** sans aucune intervention du
prestataire », mesuré à la recette par un membre du bureau seul devant l'écran. s11 (SEO) dépend
d'elle.

### Acceptance criteria (docs/stories.md l. 860-893)

1. Publier une analyse (date, affiche, texte facultatif, PDF) la fait apparaître en tête de la page
   publique des analyses.
2. Le PDF se télécharge depuis la page publique sans authentification.
3. Le texte est facultatif : une publication sans texte affiche la date, l'affiche et le lien du PDF,
   sans bloc vide ni libellé orphelin.
4. Le formulaire de saisie ne demande que les quatre champs (date, affiche, texte facultatif, PDF) et
   publie en **une seule soumission**, sans étape intermédiaire.
5. Les analyses sont listées par date décroissante et une analyse ne fuit pas vers une autre
   association.

### Sources à tenir

- `V5 §4.4` (contractuel, prévaut) : « Chaque publication comporte, à la suite les unes des autres :
  une date, une affiche (image), un court texte facultatif, et un lien pour télécharger le PDF complet
  du résultat. Ces publications sont fréquentes (au moins une par mois). » Seul le texte est dit
  facultatif : **affiche et PDF sont obligatoires**.
- `CDCT §4.4` : « Modèle de contenu répétable : `date`, `image (affiche)`, `texte facultatif`,
  `fichier PDF téléchargeable`. […] prévoir une UI de saisie rapide en BO, pas un formulaire lourd. »
- Notes de la story : la rapidité de saisie est « un critère de design autant que de code — à éprouver
  en `/ks-design` » ; la page publique « ne doit jamais passer derrière l'authentification, même par
  héritage de layout » ; « servir le PDF sans exposer un chemin devinable vers d'autres fichiers du
  tenant ».
- `docs/architecture.md` l. 200 : `water_analysis` figure parmi les modèles de contenu **à champs
  fixes** (ADR 007). `docs/architecture.md` l. 142 donne `WaterAnalysisForm` comme exemple de nommage.
- `docs/design-system.md` §9 (l. 913) : gap ouvert **pour s09** — « Bloc « analyses d'eau » dédié ou
  réemploi du bloc PDF — à trancher ».
- `docs/reviews/stories.md` : `Stories ready: yes`.

---

## Current state of the code

Vérifié le 22 septembre 2026. `main` = `0b328a2` (s03c). L'arbre de travail est sur
`feature/s05-actualites`, **sans aucun code de s05** : seuls des documents non suivis existent
(`docs/research/s05-actualites.md`, `docs/designs/s05-actualites*`, `docs/decisions/023-…`).

**Aucune trace d'analyse d'eau dans le code** : `grep -rni "analyse\|water" src e2e messages/fr.json`
ne rend que du texte de boilerplate (« Analyse avancée », la teinte `water` de s02) — ni modèle, ni
route, ni libellé.

### Ce que s04 a posé et qui touche s09

| Couche        | Fichier                                                                                                  | Ce qui compte pour s09                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types domaine | `src/services/types/domain/page-block-types.ts`                                                          | Validation par **signature binaire** générique (`detectPageFileFormat`, `validatePageBlockFile(kind, content)`), plafonds `PAGE_FILE_MAX_BYTES` = image 5 Mo / document 10 Mo, formats `png \| webp \| jpeg \| pdf`. Mais **clé et contrôle de clé liés à la page** (`buildPageBlockFileKey`, `isPageBlockFileKeyAllowed`).      |
| Service       | `src/services/page-service.ts`                                                                           | `getPageFileStorage()` (l. 397, `createStorage('local', {bucket: 'pages', basePath: '', …})`) ; `uploadPageBlockFileService` (l. 426) exige `pageId` + `blockId` et vérifie que **la page** existe ; `readPageBlockFileService` (l. 486) — lecture publique, **sans autorisation, délibérément**, clé validée contre le préfixe. |
| Route fichier | `src/app/api/pages/files/[...key]/route.ts`                                                              | Tenant du domaine (`getCurrentTenantDal`), 404 sur toute clé hors préfixe, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`. **Aucun `Content-Disposition`.**                                                                                                                             |
| Rendu         | `src/lib/cms/render-page-block.ts`                                                                       | Bloc PDF (l. 90-99) : `<a target="_blank" rel="noopener noreferrer">{titre} (PDF, ouverture dans un nouvel onglet)</a>`, omis si pas de fichier **ou pas de titre**. `renderMarkdown` privé ; seul `renderPageBlock` est exporté.                                                                                                |
| Composants    | `src/components/features/pages/blocks/pdf-block-form.tsx`, `image-block-form.tsx`, `block-form-types.ts` | Formulaires de bloc à `onUpload(file, kind)` **injecté** ; l'URL d'aperçu passe par `pageBlockFileUrl` (préfixe `/api/pages/files`). Upload **immédiat** au dépôt, avant l'enregistrement.                                                                                                                                       |
| Server Action | `src/app/[locale]/(bureau)/bureau/pages/[id]/actions.ts:212`                                             | `uploadPageBlockFileAction(formData)` : un fichier par appel, sur une page **déjà créée**.                                                                                                                                                                                                                                       |
| Primitives UI | `src/components/ui/`                                                                                     | `file-upload.tsx` (props `onChange`, `multi`, `onlyimage`, `isUploading` ; hors `onlyimage`, aucun filtre `accept`), `preview-bar.tsx`, `pagination.tsx`, `table.tsx`, `badge.tsx`, `progress.tsx`, `alert-dialog.tsx`, `skeleton.tsx`.                                                                                          |

Il n'y a **pas encore** de `/api/files`, ni de `content-file-types.ts` : c'est ce que l'ADR 023 (non
suivi, story s05) décide de créer. Voir Trap 1.

### Le patron d'écriture « fichier puis référence » (s01b)

`src/services/association-identity-service.ts` l. 70-105 : écrire le nouveau fichier, **puis** la
référence en base ; si la référence échoue, supprimer le fichier tout juste écrit
(`commitIdentityReference`) ; l'ancien fichier est supprimé **après** coup, un échec ne laissant qu'un
orphelin journalisé (`deletePreviousIdentityFile`). C'est le seul précédent du dépôt qui écrit un
fichier **et** une ligne dans la même opération — exactement la forme de la soumission unique de s09
(critère 4), à deux fichiers.

### Accès public

- `src/app/[locale]/(public)/layout.tsx` : aucun contrôle de session ; résout le tenant
  (`requireCurrentTenantDal`) et le menu. Une route sous `(public)/` est publique par construction.
- `src/proxy.ts` l. 13-19 : `AUTHENTICATED_SEGMENTS = ['/account', '/admin', '/bureau', '/dashboard',
'/team']`. Le matcher exclut `/api` : une route de fichier sous `/api/…` n'est jamais gatée.
- Modules activables (ADR 010) : `organization_module` = `vote | voirie | annonces`
  (`src/db/models/auth-model.ts:158`). Les analyses d'eau **ne sont pas un module** ; aucune garde
  `requireEnabledModuleDal` à poser, sauf décision contraire (Open question 9).

### Sidebar du bureau

`src/components/features/association/bureau-sidebar.tsx:21-36` : `NAV_GROUPS` — « Le site »
(`/bureau/pages`, `/bureau/navigation`) puis « L'association ». Libellés sous
`BureauIdentityPage.nav`. **Aucune icône rendue aujourd'hui** (pas d'import lucide dans le fichier),
alors que le design de s05 place `Megaphone` sur son entrée.

---

## Anchor points

- **Modèle + migration** : nouveau fichier dans `src/db/models/` (`water_analysis`, nom posé par
  `docs/architecture.md` l. 200), enregistré dans le `schema` de `src/db/models/db.ts` (l. 32-45).
  Policy RLS forcée par `drizzle-kit generate --custom` sur le patron `0013_page_content_block_rls.sql`
  / `0015_menu_item_rls.sql`. Dernière migration sur `main` : `0015`.
- **Registre d'actions** : `src/services/types/domain/action-registry-types.ts` — `ActionIdConst`
  (l. 43-60) et `ACTION_REGISTRY` (l. 62-79). Précédents : `PAGE_MANAGE` (une entrée pour
  créer/modifier/publier/dépublier), toutes `['owner', 'board']`.
- **Service** : gabarit `src/services/page-service.ts` — `safeParse` → contrôle par
  `canPerformAction(authUser, organizationId, ActionIdConst.X)` → écriture sous `withTenant`.
  Façade + intercepteur de journalisation sur le patron `src/services/facades/page-service-facade.ts`.
- **Fichiers** : soit la chaîne partagée de l'ADR 023 (portée à déclarer, route `/api/files`), soit
  l'existant de s04 à généraliser — dépend de l'ordre de livraison (Trap 1).
- **DAL** : gabarit `src/app/dal/page-dal.ts` — lecture publique interne `'use cache'` +
  `cacheLife('hours')` + `cacheTag`, prenant `organizationId` en argument ; lecture bureau non cachée ;
  `canManageCurrent…Dal` pour l'affichage.
- **Route publique** : nouveau segment statique sous `src/app/[locale]/(public)/` ; **à ajouter à
  `RESERVED_PAGE_SLUGS` dans le même commit** (`page-block-types.ts:89`, avertissement l. 83-86).
- **Back-office** : nouvelle route sous `src/app/[locale]/(bureau)/bureau/`, entrée dans le groupe
  `siteGroup` de `NAV_GROUPS`, libellé sous `BureauIdentityPage.nav`.
- **Libellés** : `messages/fr.json` **et** `en.json` / `es.json` (garde `page-i18n.test.ts`, voir
  Trap 12).
- **e2e** : nouveau `e2e/<…>.spec.ts` sur le patron de `e2e/page-cms.spec.ts` (tenant A =
  `http://localhost:PORT` TechCorp, tenant B = `http://127.0.0.1:PORT` Marketing Pro ; comptes
  `user-owner@gmail.com`, `user@gmail.com`, `user-admin@gmail.com` ; preuve RLS en SQL direct).

## Verified APIs / functions

| Nom                                                      | Fichier                                                          | Signature vérifiée                                                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireCurrentTenantDal`                                | `src/app/dal/tenant-dal.ts:93`                                   | `() => Promise<TenantDTO>` — `notFound()` si aucun tenant                                                                                             |
| `getCurrentTenantDal`                                    | `src/app/dal/tenant-dal.ts:71`                                   | `cache(async () => Promise<TenantDTO \| undefined>)` — lit `x-forwarded-host` puis `host`                                                             |
| `withCurrentTenant`                                      | `src/app/dal/tenant-dal.ts:112`                                  | `<T>(callback: () => Promise<T>) => Promise<T>`                                                                                                       |
| `requireEnabledModuleDal`                                | `src/app/dal/tenant-dal.ts:131`                                  | `(moduleKey: string) => Promise<TenantDTO>` — sans objet si s09 n'est pas un module                                                                   |
| `getDb` / `withTenant` / `withRlsBypass`                 | `src/db/tenant-scope.ts:122 / 128 / 144`                         | `getDb(): ScopedDb` ; `withTenant(organizationId, callback)` (lève si l'id n'est pas un UUID) ; `withRlsBypass(callback)` — interdit ici              |
| `canPerformAction`                                       | `src/services/authorization/action-registry-authorization.ts:18` | `(user: User \| undefined, organizationId: string, actionId: string) => boolean` — SuperAdmin passe, action absente refusée                           |
| `requireActionAuth`                                      | `src/app/dal/user-dal.ts:41`                                     | `cache(async (options?: RequireAuthOptions) => …)`                                                                                                    |
| `createStorage`                                          | `src/lib/files/storage/storage-factory.ts:8`                     | `(type: 's3' \| 'local', config: StorageConfig) => StorageOperations` ; `local` → `createLocalStorage(config, env.LOCAL_STORAGE_ROOT)`                |
| `StorageOperations`                                      | `src/lib/files/storage/types.ts`                                 | `{upload(file, path), download(path): Promise<Blob>, delete(path), list(path)}` — `bucket` ignoré par l'adaptateur local, clé confinée sous la racine |
| `validatePageBlockFile`                                  | `page-block-types.ts:247`                                        | `(kind: 'image' \| 'document', content: Uint8Array) => PageFileValidation` — `{valid, format}` ou refus `format` / `size`                             |
| `detectPageFileFormat`                                   | `page-block-types.ts:232`                                        | `(content: Uint8Array) => 'png' \| 'webp' \| 'jpeg' \| 'pdf' \| undefined`                                                                            |
| `PAGE_FILE_CONTENT_TYPES` / `PAGE_FILE_MAX_BYTES`        | `page-block-types.ts:191 / 207`                                  | types MIME par format ; 5 Mo image, 10 Mo document                                                                                                    |
| `buildPageBlockFileKey`                                  | `page-block-types.ts:276`                                        | `(orgId, pageId, blockId, format) => '{org}/pages/{page}/{block}-{uuid}.{ext}'` — **lié à la page**                                                   |
| `isPageBlockFileKeyAllowed`                              | `page-block-types.ts:306`                                        | n'accepte que `{org}/pages/`, refuse `..`, segment vide, `\0`, `\\`, extension inconnue                                                               |
| `getPageFileFormatFromKey`                               | `page-block-types.ts:292`                                        | `(key) => PageFileFormat \| undefined`                                                                                                                |
| `RESERVED_PAGE_SLUGS` / `isPageSlugReserved`             | `page-block-types.ts:89 / 115`                                   | liste explicite ; **aucun** segment « analyses » aujourd'hui                                                                                          |
| `renderPageBlock`                                        | `src/lib/cms/render-page-block.ts:132`                           | `(block: {type: string; data: unknown}) => string \| null` — `{type: 'text', data: {markdown}}` passe par le schéma sanitisé                          |
| `PAGE_BLOCK_FILE_ROUTE`                                  | `render-page-block.ts:20`                                        | `'/api/pages/files'`                                                                                                                                  |
| `pageTag` (patron de tag)                                | `src/app/dal/page-dal.ts:22`                                     | `(organizationId, slug) => 'page:<org>:<slug>'`                                                                                                       |
| `FileUpload`                                             | `src/components/ui/file-upload.tsx:33`                           | `{onChange(files), multi?, onlyimage?, isUploading?}` — pas de prop `accept` pour restreindre au PDF                                                  |
| `commitIdentityReference` / `deletePreviousIdentityFile` | `src/services/association-identity-service.ts:74 / 94`           | privées ; patron « fichier écrit, référence posée, nettoyage sur échec » à reproduire, pas à importer                                                 |
| `updateTag`                                              | `next/cache`                                                     | usage réel : `bureau/pages/[id]/actions.ts`, appelé **après** le succès de l'écriture                                                                 |

## Traps & constraints

1. **L'ordre de livraison avec s05 décide de la moitié de la story.** L'ADR 023 (story s05,
   « accepted » mais **non suivi**, rien sur `main`) décide une chaîne de fichiers de contenu
   **partagée** : module isomorphe `content-file-types.ts` à **portées** (`pages`, `news` ; « s06 et
   s09 y ajouteront la leur »), clé `{organizationId}/{portée}/{ownerId}/{slotId}-{uuid}.{ext}`, route
   unique `GET /api/files/[...key]`, et le chemin `/api/pages/files` servi par le même gestionnaire.
   Sa conséquence écrite : « s06 et s09 déclarent leur portée de fichier et leur colonne `…_key`. Ils
   n'écrivent ni validation de clé, ni route de lecture. »
   - **s05 mergée d'abord** : s09 déclare sa portée, ses colonnes `…_key`, et réemploie route et
     lecture. C'est le chemin le plus court.
   - **s09 avant s05** : aucune de ces briques n'existe ; s09 devrait soit porter elle-même la
     factorisation décidée par l'ADR 023 (et devenir le premier client à la place de s05), soit
     écrire une chaîne dédiée — que l'ADR 023 rejette explicitement (« trois copies d'une validation
     de sécurité »).
   - **En parallèle** : s05, s06, s07 et s08 sont préparées en même temps dans le même arbre. Les
     fichiers communs se heurteront au merge : `action-registry-types.ts`, `db.ts` (schéma),
     `bureau-sidebar.tsx`, `RESERVED_PAGE_SLUGS`, `messages/*.json`, `docs/architecture.md` (classement
     RLS), et surtout **le journal et les snapshots Drizzle** (`drizzle/migrations/meta/`) — deux
     branches qui génèrent chacune une `0016` ne se fusionnent pas à la main (AGENTS.md interdit
     d'éditer le journal). Brancher s09 depuis un `main` qui contient déjà les migrations des stories
     précédentes, ou régénérer.
2. **« Une seule soumission » (critère 4) contredit le flux de fichiers de s04.** s04 dépose chaque
   fichier **immédiatement**, par une action dédiée, sur une page **déjà créée** (`uploadPageBlockFileService`
   exige `pageId`, et la création de page fait `redirect` vers l'éditeur). Pour s09, date + affiche +
   texte + PDF partent ensemble : la clé de fichier contient l'identifiant du propriétaire, qui doit
   donc être **généré par le serveur avant l'insertion** (ou la clé construite sans lui). Les deux
   fichiers et la ligne forment une seule opération : sur échec de l'insertion, les fichiers écrits
   sont à retirer (patron s01b, Current state). Un refus de validation (format, poids, champ manquant)
   ne doit rien écrire.
3. **Limite de taille des requêtes — bloquant probable.** `next.config.ts:44-46` fixe
   `serverActions.bodySizeLimit: '2mb'` (posé par s01b pour le logo à 1 Mo). Or :
   - les plafonds de s04 sont 5 Mo pour une image et 10 Mo pour un PDF : **au-delà de 2 Mo, la
     requête est rejetée par Next avant toute validation**, sans le message de refus prévu. Défaut
     latent de s04 (aucun test ne dépose de fichier de plus de 2 Mo), qui toucherait s09 de plein
     fouet : une affiche photographiée et un PDF de laboratoire dans la même soumission dépassent
     facilement 2 Mo ;
   - au-dessus, le proxy (`src/proxy.ts`, qui couvre les routes du bureau) met le corps en mémoire
     jusqu'à `proxyClientMaxBodySize`, **10 Mo par défaut** (doc Next 16.3,
     `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`) :
     au-delà, le corps est **tronqué** avec un simple avertissement. Affiche 5 Mo + PDF 10 Mo en une
     requête = 15 Mo > 10 Mo ;
   - le reverse proxy du VPS (s12b) aura sa propre limite, non décidée.
     Relever `bodySizeLimit` est un changement de configuration globale (toutes les Server Actions) :
     à décider et justifier au plan, pas en passant. Voir Open question 3.
4. **« Se télécharge » vs « s'ouvre ».** La route de fichiers ne pose aucun `Content-Disposition` :
   un PDF servi en `application/pdf` s'**affiche** dans le navigateur. Le bloc PDF de s04 annonce
   d'ailleurs « ouverture dans un nouvel onglet », et le design system (§4, bloc 3 « Document PDF »,
   « support des analyses d'eau ») aussi. Le critère 2 dit « se télécharge ». Un attribut `download`
   sur le lien suffit pour une URL de même origine, sans toucher à la route partagée ; un
   `Content-Disposition: attachment` changerait la route commune à tous les fichiers. Le nom proposé
   au téléchargement ne peut pas venir de la clé (UUID) : il faut le construire (date, association)
   ou stocker le nom d'origine. À trancher avec `/ks-design`.
5. **Le texte alternatif de l'affiche — un cinquième champ ?** Le design system (§4, bloc 2) impose
   « `alt` obligatoire à la saisie — sinon la publication est refusée » pour toute image, et s05 a
   ajouté un champ « Texte alternatif ». Le critère 4 limite le formulaire à **quatre champs**. Une
   affiche d'analyse porte souvent ses résultats **en texte dans l'image** : un alt vide ou générique
   (« Affiche de l'analyse du 2 septembre 2026 ») laisse un lecteur d'écran sans le résultat. Le texte
   facultatif ou le PDF compensent-ils ? Arbitrage d'accessibilité à rendre en `/ks-design` : alt
   dérivé de la date, champ texte réutilisé, ou écart au critère 4 assumé.
6. **Libellé du lien PDF.** Le design system (§4, bloc 3) : « Titre écrit par le bureau (**jamais le
   nom du fichier**), résultat en clair, **poids annoncé** ». Aucun des quatre champs n'est un titre :
   le libellé est à dériver (« Résultat complet du 2 septembre 2026 (PDF, 320 Ko) »), et le poids doit
   être **stocké** à l'écriture (le bloc PDF de s04 garde `fileSize` dans son jsonb ; ici une colonne).
   « Résultat en clair » n'a pas de champ correspondant — le texte facultatif est le seul candidat.
7. **Bloc dédié ou modèle ?** Le gap du design system (§9, l. 913) hésite entre « bloc analyses d'eau
   dédié » et « réemploi du bloc PDF ». L'ADR 007 et `docs/architecture.md` l. 200 ont déjà tranché
   pour un **modèle à champs fixes** `water_analysis` ; l'ADR 007 ajoute « ne pas laisser proliférer
   les types de blocs ». Le bloc PDF de s04 ne satisfait d'ailleurs ni le tri par date (critère 5), ni
   la soumission unique. Le gap est à **clore** dans ce sens au design, pas à rouvrir.
8. **Table RLS et classement.** Nouvelle table métier : `organization_id` + policy `tenant_isolation`
   forcée + test d'accès croisé e2e (la RLS n'est pas testable en unitaire, `db.ts` refuse toute
   connexion en test). `docs/architecture.md` « Classement RLS des 24 tables » est un tableau tenu **à
   la main** (aucun test ne le vérifie) : y ajouter la ligne et corriger le compte — qui aura déjà
   bougé avec s05 (`news`), s06 (`board_member`), s07 (`alert_banner`) selon l'ordre de merge.
9. **Inventaire des clés de fichier (s12c).** `docs/stories.md` l. 1303-1312 : s12c recensera « les
   PDF d'analyses d'eau (s09) » et attend une **convention reconnaissable** de colonne de clé. Seul
   précédent en colonne : `identity_logo_key`, `identity_favicon_key` ; l'ADR 023 retient `image_key`
   pour `news`. s09 aura **deux** colonnes (affiche et PDF), sur le suffixe `_key`.
10. **Nouveau segment racine.** Un segment statique sous `(public)/` gagne sur `(public)/[slug]`
    (ADR 020) : une page CMS existante de même slug disparaîtrait sans message. L'ajouter à
    `RESERVED_PAGE_SLUGS` dans le même commit. Seed et e2e ne créent aucune page de slug fixe (les
    e2e suffixent leurs slugs par `uniqueSlug`) : pas de collision connue en test, **données réelles
    à vérifier**.
11. **Cache Components.** Liste publique en `'use cache'` dans le DAL, clé = `organizationId` (+ page
    si pagination), tag de liste par association invalidé par `updateTag` **après** chaque publication
    (et chaque modification ou retrait, s'ils existent). Aucune horloge dans le scope. Compromis hérité
    documenté dans `page-dal.ts` : la façade appelée depuis un scope caché passe par l'intercepteur de
    log — ne pas y ajouter d'appel direct à `logger`.
12. **Catalogues de libellés.** `src/services/__tests__/page-i18n.test.ts` exige que les espaces de
    noms de s04 existent, traduits, dans `fr`, `en` **et** `es` (les trois locales restent déclarées
    dans `src/i18n/routing.ts`). Même discipline attendue pour les espaces de noms de s09, et la garde
    est à étendre.
13. **Tri et départage.** « Par date décroissante » : la date saisie (critère 1), pas `created_at`.
    Publication mensuelle, mais deux analyses de même date restent possibles (deux points de
    prélèvement, une correction) : départage stable nécessaire (ADR 023 retient
    `published_on desc, created_at desc, id desc` pour `news`). Colonne `date` sans heure ni fuseau,
    comme l'ADR 023.
14. **Champ date.** Gap déjà signalé par le design de s05 (gap 2) : le socle n'a pas de sélecteur de
    date ; proposition `input` 48 px `jj/mm/aaaa` + icône `Calendar`, saisie native ou masquée « à
    trancher au plan. Même besoin attendu en s09 ». Le trancher une fois pour les deux.
15. **Design system.** Icône figée `Droplet` pour l'eau (§1.7, l. 310) — la sidebar du bureau n'affiche
    aucune icône aujourd'hui. Dates en clair côté public (« 2 septembre 2026 »), `02/09/2026` en champ
    et en tableau (§3.6). La feuille d'impression (§6.2) cite l'analyse d'eau parmi les trois documents
    imprimés, mais **aucune règle `@media print` n'existe** dans le dépôt : hors critères, à ne pas
    promettre. Aucune maquette d'analyse n'existe : `/ks-design s09` à faire (story à écran).
16. **Fichiers d'un brouillon lisibles par clé.** La route publique sert toute clé valide du tenant,
    publiée ou non (compromis accepté par s04 et l'ADR 023, clé non devinable). Si s09 n'a pas de
    brouillon (critère 4 : publication directe), la question ne se pose que pour une analyse retirée.
17. **Process** : `pnpm test --run` ; migrations par `pnpm db:generate` / `drizzle-kit generate
--custom`, jamais de SQL ni de journal écrits à la main ; brancher `feature/s09-analyses-eau`
    depuis un `main` à jour. Ce fichier de recherche voyage avec cette branche.

## Open questions

1. **Ordre de livraison s05 → s09.** s09 attend-elle le merge de s05 pour réemployer la chaîne de
   fichiers partagée de l'ADR 023, ou la construit-elle elle-même ? L'ADR 023 n'est pas encore sur
   `main` : tant qu'il ne l'est pas, le plan de s09 ne peut pas s'y adosser.
2. **Cycle de vie d'une analyse.** Les critères ne parlent que de publier. Faut-il un brouillon (le
   critère 4 semble l'exclure : « publie en une seule soumission »), la **correction** d'une analyse
   publiée (erreur de date, mauvais PDF), le **retrait** (dépublication ou suppression) ? Si retrait
   ou remplacement : que deviennent les fichiers ? Le critère de recette du PRD dit « crée, **modifie**
   et publie » — la modification semble donc attendue.
3. **Taille des fichiers et limite de requête** (Trap 3). Quels plafonds pour l'affiche et le PDF
   (reprendre 5 / 10 Mo de s04 ?), et comment les faire tenir dans une seule requête : relever
   `serverActions.bodySizeLimit` (réglage global), `proxyClientMaxBodySize`, ou changer de transport ?
   Le défaut latent de s04 (dépôt > 2 Mo impossible) est-il corrigé ici ou par une story propre ?
4. **Texte alternatif de l'affiche** (Trap 5) : alt dérivé, alt saisi (cinquième champ, écart au
   critère 4), ou renvoi au texte facultatif ?
5. **Libellé et nom du PDF** (Traps 4 et 6) : téléchargement (`download`) ou ouverture en nouvel
   onglet ; libellé dérivé de la date ; nom de fichier proposé au téléchargement ; poids affiché.
6. **Sémantique de la date** : date de prélèvement, date du rapport du laboratoire, ou date de
   publication ? Pré-remplie à aujourd'hui (comme s05) ou vide ? Date future acceptée ?
7. **Forme du texte facultatif** : texte brut court, ou markdown rendu par la chaîne sanitisée de s04
   (`renderPageBlock({type: 'text', …})`) ? Longueur maximale (« court texte ») ?
8. **URL et pagination de la page publique** : nom du segment (`/analyses-eau` ? `/analyses` ?) à
   réserver ; une analyse a-t-elle sa propre page (les critères n'en demandent pas) ; pagination
   au-delà de combien d'analyses (≥ 12 par an), et taille de page en constante d'affichage comme
   l'ADR 023 ?
9. **Module activable ?** Les analyses d'eau doivent-elles devenir une clé de `organization_module`
   (une association sans forage) ou rester toujours actives ? Le PRD décrit les six associations
   visées comme gérant l'eau ; aucune source ne demande de module.
10. **Accès depuis le site** : le menu (s04b, `menu_item.page_id` NOT NULL) ne sait pointer que vers
    une page CMS — même limite que s05 (son Trap 8). Lien écrit à la main dans une page, ou extension
    du menu hors périmètre ?
11. **Nom de l'action au registre** : une entrée unique (« gérer les analyses d'eau »,
    `['owner', 'board']`) sur le précédent `PAGE_MANAGE`, sauf si le bureau veut réserver la
    publication à certains rôles — rien dans les critères ne le dit.
