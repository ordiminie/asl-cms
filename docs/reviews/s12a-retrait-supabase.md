# Revue — Story s12a-retrait-supabase (deuxième passe)

> Revue en contexte neuf, après la passe de correction. Chaque constat est classé critique / majeur / mineur.
> Diff examiné : `git diff main...feature/s12a-retrait-supabase` (deux commits : `7f40085` la story, `de0ebcb` la passe de correction, 52 fichiers).
> Références : `docs/plans/s12a-retrait-supabase.md` (validated: yes), `docs/research/s12a-retrait-supabase.md`, AGENTS.md, ADR 004, ADR 015, `templates/review-checklist.md`.
> Cette revue **remplace** le rapport de première passe committé dans `de0ebcb` ; les constats non traités y sont repris avec leur statut.

**Verdict** : aucun problème critique ni majeur. Les trois corrections demandées par la propriétaire du produit sont réellement faites, et faites comme annoncé. L'arbitrage « ignorer et utiliser le disque » est vérifié **sur la vraie chaîne `@/env`** : `supabase` hérité démarre et rend `local`, une valeur inconnue (`azure`) échoue bruyamment, rien ne choisit un stockage en silence. Le critère 1 est re-prouvé par un build de production sans les trois variables (330/330 pages, exit 0). Trois constats mineurs nouveaux, sept constats mineurs de la première passe encore ouverts (dont un renvoyé à s05).

## Vérifications exécutées par le relecteur

| Contrôle                                           | Résultat                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`                                  | **823 passed, 8 skipped** — 76 fichiers passés, 2 ignorés, **exit 0** (818 → 823 : les 5 tests ajoutés)                   |
| `pnpm lint`                                        | 0 erreur ; 1 avertissement préexistant dans `.remember/tmp/last-ndc.ts` (non suivi, hors diff)                            |
| `pnpm check:rules`                                 | « ✅ Règles et documentation alignées sur le code. » — exit 0                                                             |
| `pnpm exec tsc --noEmit`                           | exit 0                                                                                                                    |
| `pnpm install --frozen-lockfile`                   | exit 0, « Lockfile is up to date » ; `grep -c "@supabase" package.json pnpm-lock.yaml` = **0 et 0**                       |
| `pnpm build` **sans les trois variables Supabase** | **exit 0**, `✓ Compiled successfully in 45s`, **330/330 pages** générées, aucun échec de prerender                        |
| `pnpm format` (lecture seule)                      | 9 fichiers non formatés, **tous identiques à `main`** et hors diff (dette préexistante, dont `drizzle/migrations/meta/*`) |
| Falsification `getFileUrl`                         | **échoue bien** (détail plus bas)                                                                                         |
| Falsification d'un cas `storage/env`               | **échoue bien**                                                                                                           |
| Falsification du test de garde `@supabase/*`       | **échoue bien** (re-vérifiée après la passe de correction)                                                                |
| `git status` en fin de revue                       | **propre** ; aucun fichier sous `drizzle/`                                                                                |

### Comment l'absence des variables a été garantie pour le build

1. `git ls-files | grep '^\.env'` → **aucun fichier d'environnement n'est suivi** ;
2. `grep -l -i supabase .env .env.development .env.local .env.test` → **aucun** des quatre ne contient la chaîne ;
3. `env | grep -i supabase` → **vide** dans le shell ;
4. la commande a été lancée sous `env -u SUPABASE_ANON_KEY -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_BUCKET pnpm build`.

Aucun fichier d'environnement local ne définit non plus `STORAGE_TYPE` : le build a donc bien exercé le chemin « variable absente → `local` ». Aucune page n'a approché la limite des 60 s par page sur ce conteneur pendant ce build.

## Vérification des trois corrections annoncées

### Constat 1 — un `.env` hérité démarre (corrigé, vérifié de bout en bout)

`src/env-schemas.ts:104` est passé à `STORAGE_TYPE: z.string().optional()`, l'énuméré strict restant dans `src/lib/files/storage/env.ts:28` (`z.enum(['local']).default('local')`), alimenté par `withoutLegacyStorageType(env.STORAGE_TYPE)` qui ramène **la seule valeur `'supabase'`** à `undefined`.

Les tests livrés mockent `@/env` : ils ne prouvent donc pas que `createEnv` lui-même accepte la valeur héritée. Le relecteur l'a prouvé avec une sonde **non suivie** (supprimée aussitôt) qui charge la vraie chaîne `@/env` → `storage/env` en faisant varier `process.env.STORAGE_TYPE` :

- `STORAGE_TYPE=supabase` → `type: 'local'` ✅
- `STORAGE_TYPE` absente → `type: 'local'` ✅
- `STORAGE_TYPE=local` → `type: 'local'` ✅
- `STORAGE_TYPE=azure` → **lève** au chargement du module ✅ (4/4 au vert)

L'arbitrage est donc implémenté exactement comme décrit : aucun stockage n'est choisi en silence, et l'échec d'une valeur inconnue survient au chargement du module, bruyant et diagnosticable puisque le message Zod porte le chemin `STORAGE_TYPE`.

**La relaxation n'affaiblit rien d'autre** : `STORAGE_TYPE` n'a qu'un seul consommateur dans tout le dépôt (`storage/env.ts`), le type passe de `'local' | undefined` à `string | undefined` sans autre répercussion (`tsc` vert), les autres entrées de `serverSchema` sont inchangées, et `emptyStringAsUndefined: true` fait tomber `STORAGE_TYPE=""` sur le défaut `local`. **Aucun appel à `logger`** n'a été ajouté dans le diff : le piège Cache Components des modules évalués à l'import n'est pas rouvert.

### Constat 4 — clés orphelines (corrigé, parité recomptée)

Comptage fait par le relecteur sur les trois fichiers :

- **2004 clés feuilles** en `fr`, `en`, `es` — ensembles **strictement identiques** (0 manquante, 0 en trop dans chaque sens) ;
- 2431 nœuds au total (le chiffre cité par le commit compte aussi les objets intermédiaires — les deux comptes sont cohérents) ;
- `AccountPage.profile.*` : **absent des trois langues** ;
- aucun consommateur restant dans `src/` ni dans `e2e/`.

### Constat 9 (partiel) — contrat de `getFileUrl` (corrigé, falsifié)

**Falsification** (aucun fichier suivi modifié) : copie non suivie de `file-service.ts` où `getFileUrl` rend `https://xyz.supabase.co/storage/v1/object/public/${path}`, plus une copie non suivie du test pointant dessus.

```
× rend la cle de stockage comme reference, jamais une adresse de fournisseur
  Expected: "posts/<id>/schema.png"
  Received: "https://xyz.supabase.co/storage/v1/object/public/files/posts/<id>/schema.png"
  → 1 failed | 5 passed
```

Seul le nouveau test tombe : il est bien la sentinelle, et les trois assertions se recoupent (clé exacte, `url === path`, absence de `://`).

**Falsification d'un cas `storage/env`** : copie non suivie où le normaliseur avale _toute_ valeur inconnue — le cas « refuse bruyamment une valeur inconnue » échoue alors (1 failed | 2 passed). Le garde-fou contre le choix silencieux n'est pas décoratif.

## Conformité au plan

- [x] Le code fait ce que le plan demande, et rien de plus. Les 6 tâches sont cochées et présentes dans le diff (vérification refaite fichier par fichier).
- [x] La passe de correction **ne dérive pas** : elle touche exactement les trois constats demandés, plus le rapport de revue et un reformatage de lien markdown.
- [x] La liste « À ne pas toucher » reste respectée : `file-upload.tsx`, `association-identity-service.ts`, `local-storage.ts`, `storage/types.ts`, `drizzle/` — diff vide sur tous.
- [x] Les 7 critères d'acceptation sont couverts, et re-vérifiés **après** la passe de correction : build sans variables (1), pages nettoyées et `tsc` vert (2), test de garde falsifié (3), `--frozen-lockfile` et grep lockfile (4), variables absentes des 5 emplacements (5), `STORAGE_TYPE` absente → `local` prouvé sur la vraie chaîne (6), aucune règle ni page ne décrit plus un flux Supabase (7).
- Tension avec l'ADR 004 (« Supabase et S3 restent des valeurs possibles du même énuméré ») : **non contradictoire**, le même ADR prévoit le retrait des dépendances Supabase, un énuméré ne peut pas conserver une valeur dont l'adaptateur a disparu, et l'arbitrage figure dans le plan validé. Le factory reste ouvert (`'s3'` conservé, levant toujours).

## Anti-hallucination

- [x] Aucun import, appel ni clé de configuration inventé dans la passe de correction : `withoutLegacyStorageType`, `env.STORAGE_TYPE` (déclaré et câblé), les services du blog, `vi.hoisted` + `vi.resetModules` + import dynamique de `./env` (le rechargement par cas est nécessaire, la config étant résolue au chargement du module).
- [x] Aucune valeur plausible-mais-fausse : la seule valeur héritée normalisée est `'supabase'`, la chaîne exacte que `scripts/init-env.ts` écrivait avant la story.
- [x] Le code fait ce que le message de commit annonce — les trois points ont été re-testés indépendamment, pas crus sur parole.

## Conformité aux règles

- [x] AGENTS.md : `pnpm test --run` partout, aucune valeur métier en dur nouvelle, aucun `withRlsBypass`, aucune migration, aucun fichier `drizzle/` touché, Conventional Commits.
- [x] Aucun ADR contredit. ADR 004 : la chaîne fichiers est entièrement sur le disque du serveur, les SDK ont quitté le dépôt, un test de garde le verrouille. ADR 015 : chaîne d'identité intacte.
- [x] Story sans UI nouvelle : pas de `docs/designs/<id>` attendu, aucun composant ni token introduit.
- [x] La retouche de `rule-upload-file.md` et de sa copie `.cursor` est **purement cosmétique** : l'échappement prettier d'une cible de lien contenant des parenthèses. Le fichier cible existe, les deux copies sont alignées, `check:rules` est vert.

## Tests

- [x] Suite exécutée par le relecteur : **823 tests unitaires au vert**. Le delta de +5 correspond exactement aux tests ajoutés.
- [x] Les assertions tiennent les critères, et trois d'entre elles ont été **falsifiées** plutôt que lues.
- [ ] Deux faiblesses résiduelles, sans conséquence fonctionnelle : la couverture committée du constat 1 s'arrête au schéma et à un `@/env` mocké (N2), et une assertion de `account/page.test.tsx` s'est affaiblie mécaniquement (N3).

## Régressions

- [x] Rien de ce que la première passe avait vérifié n'a été re-cassé : test de garde toujours falsifiable, build sans les trois variables toujours vert, `--frozen-lockfile`, `tsc` et `check:rules` verts, critères 1 à 7 re-passés.
- [x] Aucun chemin d'exécution utilisateur n'est modifié par la passe de correction : la relaxation ne s'applique qu'à la validation d'amorçage, la normalisation ne se déclenche que sur `STORAGE_TYPE=supabase` (absente du job e2e et des quatre fichiers `.env` locaux), et les deux clés retirées n'avaient plus aucun consommateur.
- [x] **Le choix de ne pas relancer Playwright est justifié** — vérifié plutôt qu'accepté : les trois modifications sont soit inertes dans l'environnement e2e, soit strictement de test. Les 81/81 de la première passe portaient sur le même code applicatif, à ces trois modifications près.

## Constats

### Nouveaux (passe de correction)

- **N1 — mineur** — la tolérance de la valeur héritée n'est documentée **que dans le commentaire du code**. `docs/architecture.md:177`, `docs/_files/en/03a-file-management/03-storage-config.mdx:29` et `rule-upload-file.md:19` énoncent désormais une règle légèrement inexacte : un environnement portant `supabase` est accepté et ramené à `local`. L'extrait de `env.ts` recopié dans la page MDX n'est plus mot pour mot le fichier réel (il omet `withoutLegacyStorageType`). Une phrase à ajouter.
- **N2 — mineur** — `storage/env.test.ts` mocke `@/env` et `env-schemas.test.ts:52` parse `z.object(serverSchema)` : **aucun test committé ne traverse `createEnv`**, c'est-à-dire l'objet qui refusait effectivement de démarrer avant la correction. Le comportement est bon (prouvé par sonde), mais la sentinelle committée s'arrête un cran avant la cause du constat 1.
- **N3 — mineur (nit)** — `account/page.test.tsx:57` : `expect(screen.queryByText('Profil')).toBeNull()` est mécaniquement affaibli par le retrait des clés — le libellé n'existant plus, le mock de traduction rendrait `undefined` même si la carte revenait. `queryByLabelText('Nom')` tient toujours le critère.

### Points de procédure (hors code)

- La branche porte **deux commits** au lieu du commit unique de story. Acceptable : c'est la forme normale d'une passe de correction après revue, et les commits sont écrasés à la fusion.
- `docs/reviews/s12a-retrait-supabase.md` a été committé par la passe de correction, alors qu'AGENTS.md confie ce commit à `/ks-ship` ; le fichier portait encore le rapport de première passe. Le présent rapport le remplace avant `/ks-ship`.

### Constats de première passe — statut

| #   | Statut                                | Rappel                                                                                                                                                                              |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✅ **corrigé et vérifié**             | `STORAGE_TYPE` hérité bloquait le démarrage                                                                                                                                         |
| 2   | ⏭️ **reporté à s05** (toujours exact) | `FileResponse.url` porte la clé de stockage ; les boutons « copier le lien » copient `posts/<id>/image/…`, l'aperçu `<Image>` reste une branche morte (`mimeType` jamais renseigné) |
| 3   | 🔓 **ouvert** (toujours exact)        | le blog écrit sous `dev/posts/<postId>/…`, **sans préfixe `{organizationId}`** ; à écrire noir sur blanc dans `docs/architecture.md`                                                |
| 4   | ✅ **corrigé et vérifié**             | clés `AccountPage.profile.*` retirées, parité 2004/2004/2004                                                                                                                        |
| 5   | 🔓 **ouvert** (toujours exact)        | `updateUserAction` et `updateOrganizationAction` n'ont **aucun importeur** ; surface morte exportée d'un module `'use server'`, protégée par `requireActionAuth()`                  |
| 6   | 🔓 **ouvert**                         | titre « Modifier… » sur deux pages réduites à la table des membres ; le propriétaire perd son écran de renommage en self-service (à reprendre en s02/s31)                           |
| 7   | 🔓 **ouvert** (toujours exact)        | `docs/_files/en/10-deployment/01-vercel.mdx:119` conseille `LOCAL_STORAGE_ROOT` sur Vercel, dont le disque est éphémère                                                             |
| 8   | 🔓 **ouvert**                         | `provider-imports.test.ts:18` ne capte que `from '@supabase/…'` et `import('@supabase/…')` ; un `require()` passerait (limite héritée du gabarit des transports d'email)            |
| 9   | ✅ **partiellement corrigé**          | le contrat de `getFileUrl()` est fixé et falsifiable ; la faiblesse d'assertion d'`env-schemas.test.ts` subsiste (reprise en N2)                                                    |
| 10  | 🔓 **ouvert (factuel)**               | `env.example` conserve `MAX_FILE_SIZE=5242880` alors que le schéma attend `NEXT_PUBLIC_MAX_FILE_SIZE`. Incohérence préexistante                                                     |

## État final

`git status` **propre**, aucun fichier suivi modifié, **aucun fichier sous `drizzle/migrations/meta`** (les 4 fichiers `drizzle/` signalés par `prettier --check` sont identiques à `main` : dette de formatage préexistante, hors story). Les sondes de falsification ont toutes été supprimées. Aucune commande d'écriture n'a été lancée.

Max severity: minor
Ship allowed: yes
