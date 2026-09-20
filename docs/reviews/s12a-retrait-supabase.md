# Revue — Story s12a-retrait-supabase

> Revue en contexte neuf. Chaque constat est classé critique / majeur / mineur.
> Diff examiné : `git diff main...feature/s12a-retrait-supabase` (un commit, `7f40085`, 50 fichiers).
> Références : `docs/plans/s12a-retrait-supabase.md` (validated: yes), `docs/research/s12a-retrait-supabase.md`, AGENTS.md, ADR 004, ADR 015, `docs/design-system.md`.

**Verdict** : aucun problème critique ni majeur. Le critère 1 est prouvé par un vrai build de production sans les trois variables, le test de garde du critère 3 échoue bien quand un import `@supabase/*` revient (falsifié), et la suite e2e complète passe 81/81 sur le build de production. Neuf constats mineurs, dont deux à traiter avant la mise en ligne (`STORAGE_TYPE` hérité, `FileResponse.url` du blog).

## Vérifications exécutées

| Contrôle                                 | Résultat                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`                        | **818 passed, 8 skipped, 75 fichiers** — exit 0                                                                   |
| `pnpm lint`                              | 0 erreur (1 avertissement préexistant dans `.remember/tmp/last-ndc.ts`, hors diff)                                |
| `pnpm check:rules`                       | « Règles et documentation alignées sur le code. »                                                                 |
| `pnpm exec tsc --noEmit`                 | exit 0                                                                                                            |
| `pnpm install --frozen-lockfile`         | exit 0, « Lockfile is up to date » ; `grep -c "@supabase/" pnpm-lock.yaml` = **0**                                |
| `pnpm build` **sans variables Supabase** | exit 0, 330 pages statiques générées, **aucun échec de prerender** (les pages MDX `stripe-payments` sont passées) |
| e2e Playwright, build de production      | **81/81 passed** (48,9 s)                                                                                         |
| Falsification du test de garde           | **échoue bien** (voir plus bas)                                                                                   |
| `git status` en fin de revue             | propre, **aucun fichier sous `drizzle/`**                                                                         |

### Comment l'absence des variables a été garantie pour le build

1. `grep -l SUPABASE .env .env.local .env.development .env.test .env.production` → **aucun fichier** ne les contient ;
2. `env | grep -i supabase` → **vide** dans le shell ;
3. la commande a tout de même été lancée sous `env -u SUPABASE_ANON_KEY -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_BUCKET pnpm build`.

Le piège de la recherche est bien couvert : `files-repository.ts` construit son stockage **à l'import**, et les 330 pages générées traversent cette chaîne sans erreur.

### Falsification du test de garde (critère 3)

Sonde temporaire **non suivie** `src/zz-guard-probe-tmp.ts` contenant `import {createClient} from '@supabase/supabase-js'`, puis exécution du seul `provider-imports.test.ts` :

```
- []
+ [ "/workspace/src/zz-guard-probe-tmp.ts" ]
 ❯ src/lib/files/storage/provider-imports.test.ts:36:25   →  1 failed
```

Sonde supprimée immédiatement, `git status` propre. Le garde-fou n'est pas décoratif.

### e2e — résultat réel

Chromium a pu être exécuté dans le conteneur (paquets `apt-get download` + `dpkg-deb -x` dans un sysroot utilisateur, `LD_LIBRARY_PATH` en chemins **absolus** — en relatif la bibliothèque n'est pas trouvée par le processus fils). Serveur de production (`pnpm start`) sur le port 3000, `DATABASE_URL` de `asl_cms_test` passée explicitement, `EMAIL_TRANSPORT=file`, plus les variables du job e2e de `ci.yml` au build **et** au démarrage.

- **81/81 passed.**
- Un premier essai sur le port 3100 a donné 6 échecs : tous s'expliquent par `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` figés à `http://localhost:3000` au build. Artefact du harnais de revue, pas de la story.
- **Flake annoncé sur `association-settings.spec.ts:487`** : **non reproduit**, 4 exécutions sur 4 au vert. Ce test ne touche aucune chaîne de fichiers : cette story n'en est pas une cause plausible.

## Conformité au plan

- [x] Le code fait ce que le plan demande, et rien de plus. Les 6 tâches sont dans le diff :
  1. `storage/env.ts` : `STORAGE_TYPE: z.enum(['local']).default('local')`, `NEXT_PUBLIC_SUPABASE_BUCKET` et `baseUrl` sortis, `bucket` devenu la constante de module `STORAGE_BUCKET = 'files'` ; `storage-factory.ts` : branche `'supabase'` et membre d'union retirés, `'s3'` conservé et levant toujours. Tests réécrits comme demandé, y compris le cas `@ts-expect-error`.
  2. Blog hérité : ni `admin/blog/actions.ts` ni `files-repository.ts` ni `file-dal.ts` modifiés (diff vide sur ces trois fichiers), la bascule passe par la tâche 1. `file-service.test.ts` ne mocke plus `@/lib/files/supabaseClient`.
  3. Les deux écrans supprimés, les deux actions d'envoi d'image supprimées, les trois pages nettoyées, les clés de traduction retirées dans fr/en/es (parité vérifiée : 2006 clés dans les trois fichiers). `src/components/ui/file-upload.tsx` **intact**.
  4. `supabase-storage.ts`, `supabaseClient.ts`, `config.ts` supprimés ; les deux paquets hors de `package.json` et du lockfile ; `provider-imports.test.ts` calqué sur le gabarit des transports d'email.
  5. Variables retirées de `env-schemas.ts`, `env.ts`, `env.example`, `scripts/init-env.ts` et `ci.yml`.
  6. `rule-upload-file.md` réécrite, copies `.cursor` alignées, `docs/architecture.md`, note s16 de `docs/stories.md`, pages MDX du socle.
- [x] La liste « À ne pas toucher » est respectée : `file-upload.tsx`, `association-identity-service.ts`, `local-storage.ts`, `storage/types.ts`, `drizzle/` — diff vide sur tous.
- [x] Les 7 critères d'acceptation sont couverts.
- Dérive au-delà du plan, assumée (D3) : `next.config.ts` (remotePattern `your-project.supabase.co` retiré) et trois fichiers de règles qui pointaient vers `edit-user-profile.tsx` supprimé. Dérive justifiée : sans elle, `check:rules` et les règles renverraient vers un fichier absent. Les quatre fichiers de remplacement cités existent, ouverts et vérifiés.

## Anti-hallucination

- [x] Aucun import, appel ni clé de configuration inventé. Ouverts un par un : `createLocalStorage(config, rootDir)` (`local-storage.ts:48`), `StorageConfig` (`types.ts:1` — ne contient ni `baseUrl` ni champ supprimé), `getStorageConfig()` (`storage/env.ts:29`), les quatre variables d'environnement déclarées **et** câblées dans `runtimeEnv`, les messages d'erreur attendus par les tests, et les services du blog utilisés par le nouveau test.
- [x] Les extraits de code recopiés dans les pages MDX correspondent **mot pour mot** au code réel après la story.
- [x] Le nouveau `file-service-blog.test.ts` ne simule **rien** entre le service et le disque : il déplace la racine dans un répertoire temporaire et relit le fichier écrit. C'est la preuve réelle du rebranchement.
- [ ] Un point « plausible mais pas tout à fait juste » : `getFileUrl()` qui rend la clé (constat 2), dont les deux consommateurs vivants n'ont pas été mesurés.

## Conformité aux règles

- [x] AGENTS.md : un seul commit de story portant recherche, plan et code ; `pnpm test --run` ; aucune valeur en dur nouvelle ; aucun `withRlsBypass` ; aucune migration.
- [x] Aucun ADR contredit. L'ADR 004 prévoit explicitement le retrait des dépendances Supabase : sortir `'supabase'` de l'énuméré est son aboutissement, et le factory reste ouvert (`'s3'` conservé). ADR 015 : chaîne d'identité intacte, e2e verts.
- [x] Design system : aucun composant ni token introduit, aucune mention des écrans retirés dans le document.

## Tests

- [x] Suite exécutée par le relecteur : 818 tests unitaires, 81 e2e.
- [x] Les assertions tiennent les critères : `getStorageConfig().type === 'local'` sans variable ; garde falsifié ; écriture **relue sur le disque**, suppression vérifiée par `readdir`, refus de type MIME et de taille **sans rien écrire** ; page `/account` dont le test échouerait si le formulaire revenait.
- [ ] Deux faiblesses : une assertion triviale dans `env-schemas.test.ts` et aucun test ne fixe le nouveau comportement de `getFileUrl()` (constats 8 et 9).

## Régressions

- [x] Les pages qui montaient les écrans retirés rendent toujours — vérifié trois fois (test de page, `tsc`, e2e).
- [x] Aucune clé de traduction orpheline référencée ; aucun appel à `upload.success` / `upload.errorRetry` ne subsiste.
- [x] Chaîne d'identité s01b au vert ; `pnpm install --frozen-lockfile` et le build ne régressent pas.

## Constats

1. **mineur** — `src/env-schemas.ts:101` : `STORAGE_TYPE: z.enum(['local']).optional()`. Un `.env` généré par `pnpm init:env` **avant** cette story contient `STORAGE_TYPE=supabase` : `@t3-oss/env-nextjs` refuse alors de démarrer. Le critère 5 promet qu'un environnement définissant encore les anciennes variables démarre sans erreur — vrai pour les trois variables Supabase, faux pour `STORAGE_TYPE`. Échec bruyant et diagnosticable, rien n'est déployé à ce jour. À corriger par `z.string().optional()` dans `env-schemas.ts` (l'énuméré strict restant dans `storage/env.ts`), ou par une note de mise en ligne.
2. **mineur** — conséquence de D1 non mesurée : `FileResponse.url` porte désormais la clé de stockage, et deux consommateurs vivants s'en servent comme d'un lien. `file-image-preview-card.tsx:34` fait `<Image src={file.url}>`, et les boutons « copier le lien » (`file-image-preview-card.tsx:50`, `file-dropzone.tsx:258`) copient `posts/<id>/image/12345-schema.png` sous un toast « lien copié ». **Pas de plantage** : `listFilesService` remplit `type` depuis `StoredFile.mimeType`, que l'adaptateur `local` ne renseigne jamais, donc `isImage` est faux et la branche `<Image>` est morte. Reste que l'aperçu disparaît et que le bouton copie autre chose qu'un lien : la DoD « sans changement de comportement visible » n'est pas tout à fait tenue sur le blog hérité. À reprendre en s05 avec la route qui servira ces fichiers.
3. **mineur** — arborescence ADR 004 : le blog écrit sous `dev/posts/<postId>/image/...`, **sans le préfixe `{organizationId}`** que l'ADR 004 désigne comme le mécanisme de séparation physique par tenant. Chemin hérité, non introduit par du code neuf, et le plan renvoie à s05 — mais `docs/architecture.md` annonce « Deux chaînes l'utilisent » sans dire que l'une n'est pas scopée tenant. À écrire noir sur blanc.
4. **mineur** — clés de traduction orphelines laissées : `AccountPage.profile.title` et `AccountPage.profile.description` (fr/en/es) n'ont plus aucun consommateur. La tâche 3 demandait de retirer les clés devenues orphelines. (Celles sous `AccountPage.EditUserProfileForm.form/validation` restent légitimement utilisées par `updateUserAction`.)
5. **mineur** — D4 : `updateUserAction` (`user/action.ts:77`) et `updateOrganizationAction` (`organization/action.ts:42`) n'ont plus **aucun importeur** (les homonymes de l'admin vivent ailleurs). Elles restent exportées d'un module `'use server'`, donc appelables comme point d'entrée sans interface. Pas de faille — `requireActionAuth()` puis autorisation de service — mais c'est de la surface morte.
6. **mineur** — les deux pages d'édition d'organisation gardent le titre « Modifier… » alors qu'il ne reste que la table des membres. Accessoirement, le propriétaire d'une organisation perd son seul écran de renommage en self-service (l'admin garde le sien). Conforme à l'arbitrage du plan, à noter pour s02/s31.
7. **mineur** — `docs/_files/en/10-deployment/01-vercel.mdx:119` conseille `LOCAL_STORAGE_ROOT="/var/lib/asl-cms/files"` sur Vercel, dont le système de fichiers est éphémère. Substitution mécaniquement cohérente, sémantiquement fausse. Page héritée du socle, à corriger ou à retirer.
8. **mineur** — `provider-imports.test.ts:18` : la regex ne capte que `from '@supabase/…'` et `import('@supabase/…')`. Un import à effet de bord ou un `require()` passerait. Limite identique au gabarit dont il est copié.
9. **mineur** — `env-schemas.test.ts:47` : le cas « ignore sans erreur un environnement qui les définit encore » passe trivialement, `z.object` retirant les clés inconnues ; il n'exerce pas `createEnv`. Aucun test ne fixe le nouveau `getFileUrl()` — le constat 2 serait passé inaperçu.
10. **mineur (factuel, hors code)** — le rapport d'implémentation affirme que les trois variables ont été retirées de « `.env.test` (committed) ». C'est faux : `.gitignore:42` ignore `.env*` et aucun fichier d'environnement n'est suivi. L'état réel est bon, c'est la formulation qui était à corriger. Nit adjacent : `env.example` conserve `MAX_FILE_SIZE=5242880` alors que le schéma attend `NEXT_PUBLIC_MAX_FILE_SIZE` — incohérence préexistante, non corrigée par la story.

## Fichiers clés

- `src/lib/files/storage/env.ts`, `src/lib/files/storage/storage-factory.ts`
- `src/services/file-service.ts` (l. 62 : `const getFileUrl = (path: string) => path`)
- `src/components/features/admin/blog/file-image-preview-card.tsx` (l. 34 et 50, consommateurs de `url`)
- `src/env-schemas.ts` (l. 101, `STORAGE_TYPE`)
- `src/lib/files/storage/provider-imports.test.ts`, `src/services/__tests__/file-service-blog.test.ts`

## État final

`git status` propre, aucun fichier suivi modifié, aucun fichier sous `drizzle/migrations/meta`. La sonde de falsification et le serveur de test ont été supprimés ou arrêtés.

Max severity: minor
Ship allowed: yes
