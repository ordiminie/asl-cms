# Recherche — Story s01b-logo-association

> Recherche du 2026-09-17, sur `main` à `967cc96` (code identique à `926ac98`, le merge de la PR 6 ne
> touchant que `docs/`) et le découpage de la PR 6 (revue du
> découpage : `Stories ready: yes`). Tout ce qui suit a été vérifié en ouvrant les fichiers ; les numéros
> de ligne valent pour ce commit. Une partie de l'exploration a été faite pour s02
> (`docs/research/s02-parametres-association.md`, branche `feature/s02-parametres-association`) avant que
> le logo et le favicon ne passent dans s01b : les constats repris ici ont été revérifiés.

## Story cible

**En tant que** membre du bureau d'une association **je veux** téléverser son logo et son favicon
**afin que** le site public, le back-office et l'onglet du navigateur portent son identité, sans
intervention du prestataire. Complexité 3. Dépend de s01.

Critères d'acceptation (verbatim, `docs/stories.md` §s01b) :

1. Depuis la page de réglages de son association, un membre du bureau téléverse un logo ; il s'affiche sur le site public et dans le back-office, et le remplacer met à jour les deux sans redéploiement.
2. Un fichier refusé (type non autorisé ou taille dépassée) affiche une erreur explicite et laisse en place, inchangé, le fichier qu'il devait remplacer.
3. Le fichier est écrit sur le disque du serveur, sous un répertoire propre à l'association : deux associations qui téléversent un fichier de même nom obtiennent deux emplacements distincts, chacun sous le préfixe de son association.
4. Le logo et le favicon sont servis par une route de l'application, jamais depuis un dossier statique public : cette route ne sert que les fichiers d'identité de l'association du domaine appelé, et une demande portant sur le fichier d'une autre association ou sur un chemin forgé (remontée `../`, chemin absolu) ne rend aucun fichier.
5. Deux associations servent deux logos distincts — vérifié sur les deux domaines.
6. Le favicon est un fichier distinct du logo, téléversé séparément depuis la même page : le favicon servi est celui de l'association du domaine appelé, jamais un fichier unique du dépôt ni une dérivation du logo, et une association qui n'en a pas téléversé reçoit un favicon par défaut. Deux associations servent deux favicons distincts — vérifié sur les deux domaines.
7. Une association sans logo reste lisible : son nom remplace le logo, sur le site public comme dans le back-office. Aucun écran cassé faute de logo.
8. Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin accèdent à la page de réglages et téléversent un logo ou un favicon : tout autre utilisateur authentifié — simple membre, bureau ou présidente d'une autre association, administrateur global de la plateforme — reçoit un refus, côté interface et côté serveur.

Décisions de cadrage déjà prises (17 septembre 2026) : fichiers sur le disque du serveur (ADR 004), le
bureau édite (revue du découpage I-02), favicon distinct du logo (I-03), les actions posées ici seront
déclarées au registre par s03 (I-01), rôle Bureau renommé `board` en s03.

## État actuel du code

### Stockage de fichiers

- **Contrat** `src/lib/files/storage/types.ts` : `StorageConfig = {bucket, basePath, maxFileSize,
allowedMimeTypes}` et `StorageOperations = {upload(file, path) → {path}, download(path) → Blob,
delete(path) → void, list(path) → FileObject[]}`. **`FileObject` est importé de `@supabase/storage-js`**
  (ligne 1) : le contrat lui-même est couplé à Supabase.
- **Fabrique** `src/lib/files/storage/storage-factory.ts` : `StorageType = 'supabase' | 's3'`
  (`//todo adapter`), `'s3'` lève « not implemented yet ». **Aucune implémentation `local`.**
- **Configuration** `src/lib/files/storage/env.ts` : schéma Zod propre (distinct de `@/env`),
  `STORAGE_TYPE` `z.enum(['supabase','s3']).default('supabase')`, `NEXT_PUBLIC_SUPABASE_BUCKET` requis,
  `NEXT_PUBLIC_MAX_FILE_SIZE` (5 Mo par défaut), `NEXT_PUBLIC_ALLOWED_MIME_TYPES`
  (`image/jpeg,image/png,image/gif,application/pdf` par défaut). `getStorageConfig()` pose `basePath`
  à `prod` ou `dev` et renvoie aussi `baseUrl = env.NEXT_PUBLIC_SUPABASE_URL`. Côté `@/env`,
  `STORAGE_TYPE` est un simple `z.string().optional()` (`src/env-schemas.ts:93`).
- **Adaptateur Supabase** `supabase-storage.ts` : chemin complet `{basePath}/{path}`, logs via `logger`,
  erreurs `FileErrors.*` (`@/lib/files/errors`). Le client `supabase` est créé **à l'import** de
  `src/lib/files/supabaseClient.ts` avec `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_ANON_KEY`.
- **Repository** `src/db/repositories/files-repository.ts` : instancie le stockage **au chargement du
  module** (`createStorage(type, config)`, lignes 7-8), valide type MIME et taille (`validateFile`),
  expose `uploadFile`, `getFile`, `listFiles`, `deleteFile` et des variantes `…Post…`.
- **Service** `src/services/file-service.ts` : `generateFilePath` (ligne 42) produit
  `{entityType}s/{entityId}/[{category}/]{timestamp}-{file.name}` — **sans préfixe d'organisation**, et
  en conservant le **nom du fichier fourni par l'utilisateur** ; `getFileUrl` (ligne 55) fabrique
  **toujours une URL publique Supabase** (`…/storage/v1/object/public/{bucket}/{basePath}/{path}`).
- **Façade** `src/services/facades/file-service-facade.ts` : passe par un intercepteur de log.
- **Types** `src/services/types/domain/file-types.ts` : `EntityTypeConst` (ligne 12, dont `ORGANIZATION`),
  `FileCategoryConst` (ligne 21, dont `LOGO`, sans favicon), `ImageMimeTypes` = webp, jpeg, jpg, png
  (ligne 30) → `ALLOWED_IMAGE_MIME_TYPES`. **Ni `image/x-icon`, ni `image/vnd.microsoft.icon`, ni
  `image/svg+xml`.**
- **Composant** `src/components/ui/file-upload.tsx` : `FileUpload({multi, onlyimage, maxSize, …})`,
  refuse côté client un type hors `ALLOWED_IMAGE_MIME_TYPES` quand `onlyimage`, et une taille au-delà de
  `maxSize`.

### Qui utilise le stockage aujourd'hui (hors tests)

| Appelant                                             | Usage                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/app/[locale]/admin/blog/actions.ts`             | fichiers et images des articles (`uploadFilePostService`, `deleteFileByPostIdService`…) |
| `src/app/dal/file-dal.ts`                            | `listFilesByPostIdService`                                                              |
| `src/components/features/user/action.ts:193`         | avatar utilisateur (`uploadImageForEntityService`)                                      |
| `src/components/features/organization/action.ts:275` | logo d'organisation du boilerplate, écrit en URL dans `organization.logo`               |

Tous reçoivent des **URL publiques Supabase** via `getFileUrl`.

### Données d'identité existantes

- `organization.logo` : `text`, nullable (`src/db/models/auth-model.ts:174`). Contient aujourd'hui des
  URL externes (seed : images Unsplash, `src/db/scripts/seed.ts:271-277`) ou Supabase (formulaire
  boilerplate, validé `z.string().url()` dans `organization-form-validation.ts:21`). **Aucune colonne pour
  un favicon.**
- `organization` est exemptée de RLS (plan plateforme, `docs/architecture.md` §tables exemptées) : sa
  lecture précède la résolution du tenant.
- `next.config.ts` (`images.remotePatterns`) autorise `via.placeholder.com`, `images.unsplash.com`, … —
  pour `next/image` sur les URL actuelles.

### Favicon et affichage

- Un seul `src/app/favicon.ico`, servi à tous les domaines. Next.js 16 embarqué
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`) :
  `favicon.ico` seulement à la racine de `/app` (l. 65), **non générable par code** (l. 171) ; une icône
  générée est mise en cache au build sauf lecture d'une API de requête (l. 169, 172) ; `generateMetadata`
  accepte `icons` vers n'importe quelle URL (`04-functions/generate-metadata.md:581-625`).
- `generateMetadata` de `src/app/[locale]/layout.tsx` ne renvoie aujourd'hui que `title` et `description`.
- Marque affichée : constante `APP_NAME` (`src/lib/constants`) dans `public-footer.tsx:32,38` et les
  titres des layouts `admin` et `(app)`. L'en-tête public (`(public)/layout.tsx`) n'affiche aucun logo.
  `team-switcher.tsx:60` affiche une **icône** de composant (`activeTeam.logo` est un `React.ElementType`),
  pas l'image d'une organisation.

### Routes et proxy

- Routes existantes : `/api/auth/[...all]`, `/api/webhooks/stripe`, et **`/api/inngest`, toujours
  présente** alors que l'ADR 006 écarte Inngest (hors périmètre de cette story).
- `src/proxy.ts` : le `matcher` exclut `/api`, `/trpc`, `/_next`, `/_vercel`, `/monitoring` et **tout chemin
  contenant un point** (`favicon.ico`…), sauf `/api/auth/error`. Une route sous `/api` ou un chemin avec
  extension ne passe ni par l'i18n ni par le gating de session du proxy.
- **Route Handlers sous Cache Components** (`02-guides/migrating-to-cache-components.md:764-800`) : un
  `GET` suit le modèle des pages — prérendu s'il ne lit aucune donnée de requête, `'use cache'` possible
  seulement dans une fonction appelée (pas sur l'export `GET`). Une route qui lit le domaine appelé
  (`headers()`) est dynamique par nature.

### Tenant et accès (livrés par s01)

- `getCurrentTenantDal()` / `requireCurrentTenantDal()` (`src/app/dal/tenant-dal.ts:65,87`) résolvent le
  tenant depuis `x-forwarded-host` puis `host` ; utilisables dans un Route Handler (`headers()`).
- **Rôles de l'utilisateur par association** : `getAuthUser()` (`src/services/authentication/auth-service.ts:15`)
  renvoie un `User` avec `organizations?: MemberData[]` (`user-types.ts:22-23`), `MemberData = MemberModel &
{user?, organization?}` (`organization-types.ts:21`) — donc `organizationId` et `role` par appartenance.
- `withAuthAdmin` / `requireActionAuth` : rôles **globaux** seulement (`with-auth.tsx`, `user-dal.ts:41`).
- CASL : `userCanOnResource(user, action, subject, resource, orgContext?)`
  (`authorization-service.ts:118`) ; `buildOrganizationalAbilities(builder, user, orgRole, orgContext)`
  (`casl-abilities.ts:201`) : `owner` → `MANAGE` organisation (l. 212), `admin` → `UPDATE` (l. 234),
  `member` → `READ` (l. 256) ; `admin` **global** → `MANAGE` toutes organisations (l. 92) ;
  `super_admin` → `MANAGE ALL` (l. 76). `canUpdateOrganization(resourceId)`
  (`organization-authorization.ts:110`) accepte donc aussi l'`admin` global, que la story exclut.
- Comptes du seed vérifiés en base : `127.0.0.1` (Marketing Pro) : `user-admin@gmail.com` (Bureau, global
  `user`) ; `localhost` (TechCorp) : `user-owner@gmail.com` (Présidente), `user@gmail.com` (Membre),
  `admin@gmail.com` (global `admin`, Membre) ; `superadmin@gmail.com` (`super_admin`). Aucun Bureau chez
  TechCorp.

## Points d'ancrage

| Besoin                                      | Où ça se branche                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Écriture sur disque                         | nouvelle implémentation derrière `createStorage` (`storage-factory.ts`), contrat `StorageOperations` (`types.ts`)                                                |
| Configuration du répertoire racine          | `src/lib/files/storage/env.ts` (schéma de stockage) **et** `@/env` (`env-schemas.ts`, `env.ts` `runtimeEnv`) — ne jamais lire `process.env` directement (ESLint) |
| Arborescence par association                | `generateFilePath` (`file-service.ts:42`) ou une fonction dédiée aux fichiers d'identité ; préfixe `{organizationId}/` (ADR 004)                                 |
| Référence du logo                           | `organization.logo` (existant) ; référence du favicon : à créer (colonne ou autre, voir questions)                                                               |
| Route de lecture                            | nouveau Route Handler ; tenant par `getCurrentTenantDal()`                                                                                                       |
| Favicon par association                     | `generateMetadata` de `src/app/[locale]/layout.tsx` (`icons`) ; retrait de `src/app/favicon.ico`                                                                 |
| Affichage du logo / du nom                  | en-tête `(public)/layout.tsx`, `public-footer.tsx`, back-office (emplacement en `/ks-design`)                                                                    |
| Page de réglages et action de téléversement | hors `/admin` ; patron d'upload `components/features/organization/action.ts:275` + `FileUpload` ; emplacement en `/ks-design`                                    |
| Contrôle d'accès                            | `getAuthUser().organizations` (rôle dans l'organisation du tenant) ou `super_admin`                                                                              |
| Seed                                        | `src/db/scripts/seed.ts` (organisations, l. 262-277)                                                                                                             |
| Preuve sur deux domaines                    | `e2e/tenant-isolation.spec.ts` (`localhost`, `127.0.0.1`)                                                                                                        |
| Libellés                                    | `messages/{en,fr,es}.json`                                                                                                                                       |

## APIs / fonctions vérifiées

| Symbole                                | Signature vérifiée                                                                                                                                           | Emplacement                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `StorageOperations`                    | `{upload(file: File, path: string): Promise<{path: string}>; download(path): Promise<Blob>; delete(path): Promise<void>; list(path): Promise<FileObject[]>}` | `src/lib/files/storage/types.ts:10`                                                |
| `StorageConfig`                        | `{bucket: string; basePath: string; maxFileSize: number; allowedMimeTypes: string[]}`                                                                        | `src/lib/files/storage/types.ts:3`                                                 |
| `createStorage`                        | `(type: StorageType, config: StorageConfig): StorageOperations`                                                                                              | `src/lib/files/storage/storage-factory.ts:6`                                       |
| `getStorageConfig`                     | `() => {type, config: {baseUrl, bucket, basePath, maxFileSize, allowedMimeTypes}}`                                                                           | `src/lib/files/storage/env.ts:25`                                                  |
| `createSupabaseStorage`                | `(config: StorageConfig): StorageOperations`                                                                                                                 | `src/lib/files/storage/supabase-storage.ts:13`                                     |
| `uploadImageForEntityService`          | `(params: UploadFileForEntity)`                                                                                                                              | `src/services/file-service.ts:137`                                                 |
| `uploadFileForEntityService`           | `(params: UploadFileForEntity)`                                                                                                                              | `src/services/file-service.ts:83`                                                  |
| `getFileService` / `deleteFileService` | `(…)`, `(params: DeleteFile): Promise<void>`                                                                                                                 | `src/services/file-service.ts:255,232`                                             |
| `FileUpload`                           | `({onChange, multi?, onlyimage?, isUploading?, maxSize?})`                                                                                                   | `src/components/ui/file-upload.tsx:33`                                             |
| `ALLOWED_IMAGE_MIME_TYPES`             | webp, jpeg, jpg, png                                                                                                                                         | `src/services/types/domain/file-types.ts:37`                                       |
| `getCurrentTenantDal`                  | `(): Promise<TenantDTO \| undefined>`                                                                                                                        | `src/app/dal/tenant-dal.ts:65`                                                     |
| `requireCurrentTenantDal`              | `(): Promise<TenantDTO>` — `notFound()` sinon                                                                                                                | `src/app/dal/tenant-dal.ts:87`                                                     |
| `TENANT_CACHE_TAG`                     | `'tenant'` (la résolution de tenant est en `'use cache'`)                                                                                                    | `src/app/dal/tenant-dal.ts:27`                                                     |
| `getAuthUser`                          | `cache(async () => User \| undefined)` avec `organizations`                                                                                                  | `src/services/authentication/auth-service.ts:15`                                   |
| `User`                                 | `UserModel & {organizations?: MemberData[]; …}`                                                                                                              | `src/services/types/domain/user-types.ts:22`                                       |
| `userCanOnResource`                    | `(user, action, subject, resource, orgContext?): boolean`                                                                                                    | `src/services/authorization/authorization-service.ts:118`                          |
| `organization.logo`                    | `text('logo')`, nullable                                                                                                                                     | `src/db/models/auth-model.ts:174`                                                  |
| Route Handler `GET`                    | Web `Request` → `Response` ; sous Cache Components, dynamique s'il lit la requête                                                                            | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` |

## Pièges et contraintes

- **Basculer l'adaptateur par défaut casse les usages existants.** Blog, avatar et logo boilerplate
  reçoivent des URL publiques Supabase construites par `getFileUrl`, et le client Supabase est créé à
  l'import. Passer `STORAGE_TYPE` à `local` sans traiter ces flux rend leurs URL fausses. À décider au plan :
  périmètre de la bascule (tout le stockage, ou seulement les fichiers d'identité) — voir questions.
- **`FileObject` Supabase dans le contrat** (`types.ts:1`) : une implémentation `local` ne peut pas le
  produire sans dépendre du paquet Supabase ; l'ADR 004 demande de découpler `list`.
- **Stockage instancié au chargement du module** (`files-repository.ts:7-8`) : la configuration est lue
  une fois, à l'import ; les tests qui changent l'environnement doivent en tenir compte (mocks existants
  dans `file-service.test.ts`).
- **Traversée de chemin** (critère 4) : le chemin servi ne doit jamais dériver d'une saisie de requête
  brute. Aujourd'hui `generateFilePath` **incorpore le nom de fichier de l'utilisateur**, qui peut contenir
  `../` ou des caractères arbitraires.
- **Sécurité des types** : `image/svg+xml` n'est pas autorisé aujourd'hui, et un SVG servi par l'application
  depuis le domaine de l'association peut porter du script. Le favicon réclame en revanche des types absents
  de la liste (`image/x-icon` / `image/vnd.microsoft.icon`, éventuellement `image/png`). Le type servi
  (`Content-Type`) ne doit pas être celui déclaré par le client sans contrôle.
- **« Laisser en place le fichier précédent »** (critère 2) : un remplacement doit valider avant d'écrire et
  ne supprimer l'ancien fichier qu'après succès — et rester cohérent avec la référence en base (ADR 004,
  « À surveiller »).
- **Le favicon n'est pas une page** : les navigateurs demandent `/favicon.ico` d'office, que le proxy exclut
  (chemin avec point) et que `src/app/favicon.ico` sert aujourd'hui à tous. La résolution du tenant doit
  pourtant se faire sur la requête de l'icône elle-même.
- **Cache** : la résolution du tenant est cachée (`cacheTag('tenant')`, `cacheLife('hours')`). Si la
  référence du logo ou du favicon est lue avec le tenant, un remplacement doit invalider le tag
  (`updateTag`, depuis une Server Action uniquement — doc `migrating-to-cache-components.md:467`) pour
  tenir « sans redéploiement » ; un cache HTTP trop long sur le fichier servi retarderait aussi l'affichage.
- **Pas de logger dans un scope `'use cache'`** (constat minor 4 de la review de s01, toujours présent :
  les façades passent par un intercepteur de log).
- **Accès** : ni `withAuthAdmin`, ni `requireActionAuth`, ni `canUpdateOrganization` tels quels (voir
  « Tenant et accès »). La page ne vit pas sous `/admin`. Le contrôle porte sur le rôle dans l'association
  **du domaine appelé**, pas sur une appartenance quelconque.
- **Emplacement disque en développement et en CI** : `/workspace` est un montage depuis Windows ; un
  répertoire de fichiers dans le dépôt doit être ignoré par git (`.gitignore` n'a aucune entrée de ce type
  aujourd'hui) et hors de `public/`. En CI, `ci.yml` ne déclare aucune variable de stockage local
  (seulement les variables Supabase factices, l. 31-33, 42-43) : l'e2e qui téléverse aura besoin d'un
  répertoire accessible en écriture.
- **Tests existants** : `src/services/__tests__/file-service.test.ts` (rôles ADMIN, USER, ORGANIZATION OWNER,
  PUBLIC), `tenant-dal.test.ts`, `e2e/tenant-isolation.spec.ts`, `e2e/smoke-authenticated.spec.ts`.
  `db.ts` refuse la base en test unitaire ; l'isolation sur deux domaines se prouve en e2e, en CI (pas de
  Chromium dans le conteneur de développement).
- **Règle obsolète** : `.claude/rules/01-presentation/rule-upload-file.md` documente encore Supabase
  Storage comme stockage du projet ; la suivre contredirait l'ADR 004.
- **Hors périmètre, à ne pas reproduire** : `/api/inngest` (ADR 006), `rule-persistence.md` qui enseigne
  `db` direct (major 2 de la review de s01).
- **Aucune donnée client en dur** ; aucun fichier d'une vraie association dans le dépôt ni dans le seed.

## Questions ouvertes

1. ~~**Périmètre de la bascule vers le disque**~~ — **tranché par Marie-Ève le 2026-09-17 : seulement le
   logo et le favicon.** L'adaptateur `local` sert les fichiers d'identité de cette story ; le blog, l'avatar
   et le logo du formulaire boilerplate restent sur leur stockage actuel jusqu'à leur story (s04, s31…).
   Conséquence à respecter au plan : ne pas changer le type de stockage **par défaut** des flux existants, et
   ne pas retirer les dépendances Supabase dans cette story.

2. **Forme de la route de lecture** : chemin (sous `/api` ou non, fixe par type de fichier —
   `…/logo`, `…/favicon` — plutôt qu'un chemin de fichier en paramètre, qui ferme la traversée par
   construction) ; en-têtes de cache compatibles avec « remplacer sans redéploiement ».
3. **Où vit la référence du favicon** : nouvelle colonne sur `organization`, ou convention de nom fixe
   dans le répertoire de l'association sans référence en base ? Même question pour le logo, dont la
   colonne `text` contient aujourd'hui des URL.
4. **Favicon par défaut et `favicon.ico` racine** : que sert-on à une association sans favicon (critère 6),
   et comment répondre à la requête implicite `/favicon.ico` par domaine, sachant que le fichier racine
   n'est pas générable ?
5. **Types et tailles acceptés** pour le logo et pour le favicon (PNG/WebP/JPEG ; ICO ; SVG exclu ou
   assaini ?) et dimensions éventuelles. Relève du plan et du design.
6. **Répertoire racine** : nom de la variable d'environnement, valeur en développement (dans le dépôt
   ignoré par git, ou volume Docker nommé comme `node_modules`), et en CI.
7. **Emplacement de la page de réglages et du logo dans le back-office** : il n'existe pas encore d'espace
   de back-office d'association hors `/admin` ; seul `/account/organizations/[id]/edit` (groupe `(app)`)
   permet aujourd'hui à un membre d'éditer son organisation. À trancher en `/ks-design`.
8. **Sort du formulaire d'organisation du boilerplate** (`edit-organization-form.tsx`, champ URL de logo) :
   le garder, le rebrancher sur le nouveau téléversement, ou le retirer, pour éviter deux chemins d'écriture
   de `organization.logo`.
9. **Compte Bureau chez TechCorp dans le seed** : utile si le test d'accès doit prouver « Bureau accepté »
   et « Membre refusé » sur le même domaine.
