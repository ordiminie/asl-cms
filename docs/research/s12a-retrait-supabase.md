# Research — Story s12a-retrait-supabase

> Exploration faite le 2026-09-20, sur la branche `docs/story-s12a-retrait-supabase` (PR 18, la story
> n'est pas encore sur `main`). Tous les faits ci-dessous ont été relevés **en ouvrant les fichiers**,
> jamais de mémoire. `docs/reviews/stories.md` dit `Stories ready: yes`.

## Target story

**En tant que** prestataire (SuperAdmin) **je veux** que l'application démarre et serve les fichiers
sans compte Supabase **afin que** la mise en ligne ne dépende pas d'un service que le produit
n'utilise plus. Complexité 2. Dépend de s01b. À livrer avant s12b.

Critères d'acceptation :

1. Le build de production démarre et sert le site sans aucune variable Supabase définie.
2. Les deux écrans d'envoi d'image hérités (logo d'organisation, avatar d'utilisateur) sont retirés
   avec leurs actions et leurs tests ; les parcours e2e existants passent toujours.
3. Aucun module de `src/` n'importe `@supabase/*`, vérifié par un test de garde.
4. Les paquets `@supabase/*` ne figurent plus dans `package.json` ni dans le lockfile.
5. Les trois variables Supabase ont disparu de `env-schemas.ts`, `env.ts`, `env.example`,
   `init-env.ts` et `ci.yml` ; un environnement qui les définit encore démarre sans erreur.
6. Un `STORAGE_TYPE` absent donne l'adaptateur `local`, jamais `supabase`.
7. Aucune règle ni page de documentation ne décrit plus un flux de fichiers vers Supabase.

## Current state of the code

### Les deux paquets et leurs importeurs

`package.json` l. 83-84 : `@supabase/storage-js@^2.112.2` et `@supabase/supabase-js@^2.112.2`.

Un seul module importe un SDK Supabase : `src/lib/files/supabaseClient.ts`, qui crée le client **au
chargement du module** (`createClient(env.NEXT_PUBLIC_SUPABASE_URL || '', env.SUPABASE_ANON_KEY || '')`).
Il est importé par `src/lib/files/storage/supabase-storage.ts`, seul adaptateur qui s'en sert.

⚠️ `@supabase/storage-js` n'est plus importé nulle part dans `src/` : le type `FileObject` qu'en
citait `files-repository.ts` a déjà disparu au profit du type maison `StoredFile`
(`src/lib/files/storage/types.ts`). La dépendance est donc **déjà orpheline**.

### La chaîne de stockage, et où elle se fige

| Fichier                                     | Ce qu'il fait aujourd'hui                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/files/storage/types.ts`            | Contrat neutre `StorageOperations` (`upload`, `download`, `delete`, `list`) et `StorageConfig`. Aucun type Supabase. **À garder.** |
| `src/lib/files/storage/storage-factory.ts`  | `createStorage(type, config)` : `'supabase'`, `'local'`, `'s3'` (ce dernier lève). C'est le point de branchement.                  |
| `src/lib/files/storage/local-storage.ts`    | Adaptateur disque posé par s01b. Signature : `createLocalStorage(config, rootDir)`, racine `env.LOCAL_STORAGE_ROOT`.               |
| `src/lib/files/storage/supabase-storage.ts` | Adaptateur Supabase. **À supprimer.**                                                                                              |
| `src/lib/files/storage/env.ts`              | `storageEnv` est **parsé au chargement du module**, et `getStorageConfig()` fabrique la config.                                    |
| `src/db/repositories/files-repository.ts`   | Appelle `getStorageConfig()` puis `createStorage(...)` **au chargement du module** (l. 6-7).                                       |

Deux détails qui commandent le plan :

- **`storage/env.ts` exige `NEXT_PUBLIC_SUPABASE_BUCKET`** (`z.string().min(1)`) et déclare
  `STORAGE_TYPE: z.enum(['supabase', 's3']).default('supabase')`. **`'local'` n'est pas dans cet
  enum** : poser `STORAGE_TYPE=local` aujourd'hui fait échouer le parse. Le critère 6 impose donc de
  réécrire ce schéma, pas seulement de changer une valeur par défaut.
- **Le parse et la construction se font à l'import**, pas à l'appel. Une variable manquante ne casse
  donc pas l'envoi d'un fichier : elle casse le **chargement** de tout module qui importe
  `files-repository.ts`, en cascade jusqu'à la page qui l'atteint.

### Qui envoie réellement des fichiers vers Supabase

`src/services/file-service.ts` expose neuf services ; la façade est
`src/services/facades/file-service-facade.ts`. Les appelants vivants sont **trois**, pas deux :

| Appelant                                             | Service utilisé                                      | Écran                                              |
| ---------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `src/components/features/organization/action.ts:275` | `uploadImageForEntityService`                        | Logo d'organisation (`edit-organization-form.tsx`) |
| `src/components/features/user/action.ts:193`         | `uploadImageForEntityService`                        | Avatar (`edit-user-profile.tsx`)                   |
| `src/app/[locale]/admin/blog/actions.ts:414, 469`    | `uploadFilePostService`, `deleteFileByPostIdService` | **Blog d'administration** (fichiers d'article)     |

`src/app/dal/file-dal.ts` lit en plus `listFilesByPostIdService` pour ce même blog.

**C'est le point que la story ne dit pas** : les critères ne nomment que les deux écrans d'identité,
alors que le blog hérité passe par la même chaîne. Voir « Open questions ».

### Les écrans concernés

- `src/components/features/organization/edit-organization-form.tsx` (importe `FileUpload`), monté par
  `src/app/[locale]/(app)/account/organizations/[id]/edit/page.tsx` et par
  `src/app/[locale]/admin/organizations/[id]/edit/page.tsx`.
- `src/components/features/user/edit-user-profile.tsx` (importe `FileUpload`), monté par
  `src/app/[locale]/(app)/account/page.tsx`.
- ⚠️ `src/components/ui/file-upload.tsx` est aussi utilisé par
  `src/components/features/association/association-identity-card.tsx` — l'écran d'identité de s01b.
  **Le composant d'interface reste**, seuls les deux écrans hérités partent.

### Les variables, et où elles vivent

| Variable                         | Déclarée                                                 | Statut actuel                                                  |
| -------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `SUPABASE_ANON_KEY`              | `env-schemas.ts` (serveur), `env.ts:69`                  | **obligatoire** (`z.string().min(1)`)                          |
| `NEXT_PUBLIC_SUPABASE_URL`       | `env-schemas.ts` (client), `env.ts:108`                  | **obligatoire** (`z.string().url()`)                           |
| `NEXT_PUBLIC_SUPABASE_BUCKET`    | `env-schemas.ts` (client), `env.ts:80`, `storage/env.ts` | **obligatoire** (`min(1)`)                                     |
| `STORAGE_TYPE`                   | `env-schemas.ts:103`, `env.ts:71`, `storage/env.ts`      | facultative côté `@/env`, enum restreint côté `storage/env.ts` |
| `NEXT_PUBLIC_MAX_FILE_SIZE`      | `env-schemas.ts` (client)                                | défaut `5242880` — sert aussi au `local`                       |
| `NEXT_PUBLIC_ALLOWED_MIME_TYPES` | `env-schemas.ts` (client)                                | idem                                                           |

Autres points de déclaration : `env.example`, `scripts/init-env.ts` (l. 78-80, 133, 168-171, 189, 241) et `.github/workflows/ci.yml` (l. 35-37, valeurs factices).

⚠️ `init-env.ts` propose déjà `STORAGE_TYPE: ['supabase', 'local']` (l. 133) alors que
`storage/env.ts` n'accepte que `['supabase', 's3']` : les deux fichiers se contredisent **avant** la
story.

## Anchor points

1. **`src/lib/files/storage/env.ts`** — le schéma à réécrire (enum de `STORAGE_TYPE`, retrait du
   bucket, `baseUrl` qui vient de `NEXT_PUBLIC_SUPABASE_URL`).
2. **`src/lib/files/storage/storage-factory.ts`** — retirer la branche `'supabase'` et le type de
   l'union.
3. **`src/db/repositories/files-repository.ts`** — le seul consommateur de `getStorageConfig()`.
4. **`src/env-schemas.ts` + `src/env.ts`** — les trois variables à retirer.
5. **Les trois appelants** listés plus haut, et `src/app/dal/file-dal.ts` pour le blog.
6. **`src/lib/emails/transport/provider-imports.test.ts`** — le gabarit exact du test de garde
   demandé par le critère 3.

## Verified APIs / functions

- `createStorage(type: StorageType, config: StorageConfig): StorageOperations` —
  `src/lib/files/storage/storage-factory.ts:9`.
- `createLocalStorage(config: StorageConfig, rootDir: string): StorageOperations` —
  `src/lib/files/storage/local-storage.ts:48`. Résout la cible sous `path.resolve(rootDir, config.basePath)`
  et écrit par fichier temporaire puis renommage.
- `getStorageConfig(): {type, config}` — `src/lib/files/storage/env.ts:25`.
- `uploadImageForEntityService(params: UploadFileForEntity): Promise<FileResponse>` —
  `src/services/file-service.ts:137`.
- `uploadFilePostService`, `listFilesByPostIdService`, `deleteFileByPostIdService` —
  `src/services/file-service.ts:304, 319, 330`.
- `createStorage('local', {...})` déjà appelé en dur par
  `src/services/association-identity-service.ts:50` (`getIdentityStorage`), avec
  `bucket: 'identity'`, `basePath: ''`. **Le modèle à suivre** : l'identité n'a jamais dépendu de
  `getStorageConfig()`.
- Type `StoredFile {name, size, mimeType?}` — `src/lib/files/storage/types.ts`, neutre, déjà découplé
  de Supabase.

## Traps & constraints

1. **Le blog hérité est une troisième surface.** Le retirer, le rebrancher sur `local` ou le laisser
   casser est une décision, pas un détail d'implémentation. `NEXT_PUBLIC_ENABLED_PAGES` (`ci.yml`)
   active `blog` et `docs` ; `isPageEnabled` (`src/lib/utils.ts:15`) est la garde.
2. **Le module se fige à l'import.** `files-repository.ts` construit son stockage au chargement : une
   erreur de configuration ne se voit pas à l'envoi mais au rendu de la page qui l'importe. C'est
   pourquoi le critère 1 (« démarre sans variable Supabase ») se vérifie sur le **build de
   production**, et pas seulement par un test unitaire.
3. **`src/lib/files/config.ts` est du code mort** : `fileConfig` et `getBasePath` ne sont importés
   nulle part hors du fichier lui-même. À retirer avec le reste plutôt qu'à migrer.
4. **Deux tests mockent Supabase** : `src/lib/files/storage/storage-factory.test.ts` et
   `src/services/__tests__/file-service.test.ts` (qui mocke `@/lib/files/supabaseClient` l. 9 puis
   `@/db/repositories/files-repository` l. 83). Ils tomberont avec l'adaptateur : prévoir leur
   réécriture sur `local`, pas leur suppression silencieuse.
5. **Le test de garde doit ignorer ses propres occurrences.** `provider-imports.test.ts` compare la
   liste des importeurs à un tableau attendu ; pour Supabase, l'attendu devient `[]`. Attention à ne
   pas faire échouer le test sur la chaîne `@supabase/` contenue dans le test lui-même : le gabarit
   existant exclut déjà les fichiers `*.test.ts`.
6. **e2e** : `e2e/smoke-authenticated.spec.ts` visite `/en/account` (l. 24) et
   `/en/account/organizations` (l. 27). Ces pages doivent continuer de rendre une fois les deux
   formulaires retirés. Aucune spec n'envoie d'image sur ces écrans ; l'unique envoi couvert en e2e
   est celui de l'identité d'association (`association-identity.spec.ts`), qui passe par l'adaptateur
   `local` et n'est pas concerné.
7. **s16 dépend du fichier supprimé** : `docs/stories.md:1559` désigne
   `src/components/features/user/edit-user-profile.tsx` comme la référence dont s'inspirer pour
   l'écran de coordonnées. Le critère 7 l'impose déjà ; ne pas l'oublier, c'est quinze stories plus
   loin que la casse se verrait.
8. **Documentation MDX du socle** : `src/app/[locale]/docs/_files/en/03a-file-management/*` et
   `10-deployment/*` décrivent la configuration Supabase et le composant `FileUpload`. Elles sont
   servies quand `docs` est activée. Les corriger ou les retirer est un choix à porter au plan.
9. **`pnpm check:rules`** contrôle l'alignement des règles `.claude` et de leurs copies `.cursor` :
   toute modification de `rule-upload-file.md` se termine par `pnpm check:rules:fix`.
10. **Le hook Prettier** reformate `drizzle/migrations/meta/*` à chaque édition. Aucune migration
    n'est attendue dans cette story : le diff ne doit contenir aucun fichier `drizzle/`.

## Open questions

1. **Que devient le blog d'administration ?** Trois voies : (a) rebrancher `uploadFilePostService` et
   ses voisins sur l'adaptateur `local`, (b) retirer l'envoi de fichiers du blog hérité comme les
   deux autres écrans, (c) retirer entièrement le blog d'administration. La table `post` est conservée
   (ADR 009) et sert de base aux actualités de s05, mais **aucune story ne réclame les fichiers
   d'article**. À trancher au point de validation de `/ks-plan` : c'est ce qui détermine si
   `file-service.ts`, `files-repository.ts` et `file-dal.ts` survivent ou disparaissent.
2. **`NEXT_PUBLIC_MAX_FILE_SIZE` et `NEXT_PUBLIC_ALLOWED_MIME_TYPES` restent-elles ?** Elles servent
   la validation générique de `files-repository.ts`. Si le blog part (voie b ou c), elles n'ont plus
   d'appelant : l'identité de s01b porte ses propres constantes (`IDENTITY_MAX_BYTES`,
   `IDENTITY_FORMAT_CONTENT_TYPES`).
3. **`STORAGE_TYPE` garde-t-elle un sens ?** S'il ne reste qu'un adaptateur, la variable et l'enum
   peuvent disparaître ; le critère 6 serait alors tenu par construction. À arbitrer avec l'ADR 004,
   qui prévoit un factory, donc plusieurs adaptateurs possibles.
4. **Les pages MDX du socle** : mises à jour, retirées, ou laissées telles quelles avec une mention ?
   Le critère 7 ne parle que des règles `.claude` et de s16.

Research ready in docs/research/s12a-retrait-supabase.md.
