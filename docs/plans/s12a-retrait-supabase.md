---
validated: yes
---

# Plan — Story s12a-retrait-supabase

Branch: `feature/s12a-retrait-supabase`

Sources : `docs/stories.md` §s12a, `docs/research/s12a-retrait-supabase.md`, `docs/architecture.md`,
AGENTS.md, ADR 004 (fichiers sur le disque du VPS), ADR 015 (fichiers d'identité).

## Target story

**En tant que** prestataire (SuperAdmin) **je veux** que l'application démarre et serve les fichiers
sans compte Supabase **afin que** la mise en ligne ne dépende pas d'un service que le produit
n'utilise plus. Complexité 2. Dépend de s01b, à livrer avant s12b.

Critères d'acceptation :

1. Le build de production démarre et sert le site d'une association **sans aucune variable Supabase
   définie**.
2. Les deux écrans d'envoi d'image hérités (logo d'organisation, avatar d'utilisateur) sont retirés
   avec leurs actions et leurs tests ; les parcours e2e existants passent toujours.
3. Aucun module de `src/` n'importe `@supabase/*`, vérifié par un test de garde.
4. Les paquets `@supabase/*` ne figurent plus dans `package.json` ni dans le lockfile, et
   `pnpm install --frozen-lockfile` passe.
5. `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_BUCKET` ont disparu de
   `src/env-schemas.ts`, `src/env.ts`, `env.example`, `scripts/init-env.ts` et
   `.github/workflows/ci.yml` ; un environnement qui les définit encore démarre sans erreur.
6. Un `STORAGE_TYPE` absent donne l'adaptateur `local`, jamais `supabase`.
7. Aucune règle ni page de documentation ne décrit plus un flux de fichiers vers Supabase.

### Arbitrages rendus le 2026-09-20 (à respecter, pas à rediscuter)

- **Le blog d'administration hérité reste, rebranché sur le disque.** La recherche a montré une
  troisième surface que la story ne nommait pas : `src/app/[locale]/admin/blog/actions.ts` envoie,
  liste et supprime des fichiers d'article par la même façade. Elle continue de fonctionner, sur
  l'adaptateur `local`. La chaîne générique (`file-service`, `files-repository`, `file-dal`) survit
  donc ; s05 (actualités) reverra le sujet.
- **`STORAGE_TYPE` est conservée**, avec `local` pour seule valeur acceptée et pour défaut. L'ADR 004
  prévoit un factory : la porte reste ouverte à un second adaptateur, sans rien coûter aujourd'hui.
- **Les deux écrans hérités partent** (arbitrage de la revue du découpage) : le logo d'organisation
  fait doublon avec l'identité d'association de s01b, l'avatar n'apparaît dans aucune story.
- **Pas d'ADR** : aucune décision structurelle nouvelle. Le choix du stockage est déjà porté par
  l'ADR 004, que cette story ne fait qu'appliquer jusqu'au bout.

### Taille de la story

**6 tâches**, complexité 2 : aucune scission nécessaire.

## Tasks (ordered)

1. [ ] **Le stockage par défaut devient le disque.** `src/lib/files/storage/env.ts` : `STORAGE_TYPE`
       passe à `z.enum(['local']).default('local')`, `NEXT_PUBLIC_SUPABASE_BUCKET` et `baseUrl`
       sortent de `getStorageConfig()` (le `bucket` devient une constante du module, l'adaptateur
       `local` ne s'en sert pas pour résoudre ses chemins).
       `src/lib/files/storage/storage-factory.ts` : la branche `'supabase'` et le membre de l'union
       disparaissent ; `'s3'` reste, il lève déjà. **Tests** : `storage-factory.test.ts` réécrit —
       `'local'` rend un adaptateur, `'supabase'` n'est plus un type accepté (erreur de compilation
       couverte par un cas `@ts-expect-error`), `'s3'` lève toujours ; `getStorageConfig()` rend
       `type: 'local'` quand `STORAGE_TYPE` est absente.
2. [ ] **Le blog hérité écrit sur le disque.** Aucune modification de
       `src/app/[locale]/admin/blog/actions.ts` ni de `src/services/file-service.ts` : ils passent
       par `files-repository.ts`, que la tâche 1 rebranche. Vérifier et corriger ce que la bascule
       casse dans `files-repository.ts` (validation de type MIME et de taille conservée) et dans
       `src/app/dal/file-dal.ts`. **Tests** : `src/services/__tests__/file-service.test.ts` — retirer
       le mock de `@/lib/files/supabaseClient` (l. 9) ; un test d'envoi d'un fichier d'article
       vérifie que l'adaptateur `local` reçoit la clé attendue (`posts/<id>/<nom>`), et qu'un type
       MIME refusé ou un fichier trop gros lève avant toute écriture.
3. [ ] **Retrait des deux écrans hérités.** Supprimer
       `src/components/features/organization/edit-organization-form.tsx`,
       `src/components/features/user/edit-user-profile.tsx`, leurs actions d'envoi d'image
       (`organization/action.ts:275`, `user/action.ts:193`) et les tests associés ; nettoyer les
       pages qui les montent : `(app)/account/page.tsx`, `(app)/account/organizations/[id]/edit/page.tsx`,
       `admin/organizations/[id]/edit/page.tsx` — chacune doit continuer de rendre le reste de son
       contenu. Retirer les clés de traduction devenues orphelines dans `messages/{fr,en,es}.json`.
       **Ne pas toucher** `src/components/ui/file-upload.tsx`, utilisé par l'écran d'identité de s01b.
       **Tests** : tests de composant supprimés avec leurs écrans ; un test de page vérifie que
       `/account` rend toujours ses sections restantes.
4. [ ] **Suppression du code Supabase et de ses paquets.** Supprimer
       `src/lib/files/storage/supabase-storage.ts`, `src/lib/files/supabaseClient.ts` et
       `src/lib/files/config.ts` (code mort établi par la recherche : `fileConfig` et `getBasePath`
       n'ont aucun importeur). Retirer `@supabase/supabase-js` et `@supabase/storage-js` de
       `package.json`, puis régénérer le lockfile. **Tests** : nouveau
       `src/lib/files/storage/provider-imports.test.ts`, sur le gabarit de
       `src/lib/emails/transport/provider-imports.test.ts` — la liste des modules de `src/` important
       `@supabase/*` doit être **vide**. Écrit avant la suppression, donc rouge d'abord.
5. [ ] **Retrait des variables.** `src/env-schemas.ts` et `src/env.ts` : `SUPABASE_ANON_KEY`,
       `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_BUCKET` disparaissent ;
       `NEXT_PUBLIC_MAX_FILE_SIZE` et `NEXT_PUBLIC_ALLOWED_MIME_TYPES` restent (la validation
       générique du blog s'en sert). Même retrait dans `env.example`, `scripts/init-env.ts`
       (l. 78-80, 133, 168-171, 189, 241 — `STORAGE_TYPE` n'y propose plus que `local`) et
       `.github/workflows/ci.yml` (l. 35-37). Un environnement qui les définit encore est ignoré
       sans erreur, `@t3-oss/env-nextjs` n'ayant pas de mode strict ici. **Tests** : un test vérifie
       que `getStorageConfig()` fonctionne sans aucune variable Supabase dans `process.env`.
6. [ ] **Documentation et règles.** `.claude/rules/01-presentation/rule-upload-file.md` : ne décrit
       plus que l'adaptateur `local`, sans flux Supabase ni « jusqu'à leur story (s04, s31) » ;
       `pnpm check:rules:fix` pour réaligner les copies `.cursor`. `docs/stories.md` : la note de s16
       (l. ~1559) ne renvoie plus à `edit-user-profile.tsx` supprimé — lui substituer un écran
       existant. `docs/architecture.md` : la ligne « Fichiers » et le paragraphe de l'ADR 004 ne
       mentionnent plus Supabase comme état courant. Pages MDX du socle
       (`src/app/[locale]/docs/_files/en/03a-file-management/*`, `10-deployment/*`) : remplacer la
       configuration Supabase par l'adaptateur `local`, ou retirer la page si elle ne décrit que lui.
       **Vérification finale** : `pnpm lint`, `pnpm check:rules`, `pnpm test --run`, `pnpm build`
       **sans les variables Supabase dans l'environnement** (critère 1), et la suite e2e complète en
       local (procédure dans la mémoire de session : Chromium installable sans root, base
       `asl_cms_test`, build de production, variables du job e2e de la CI).

## Files touched

**Supprimés**

- `src/lib/files/storage/supabase-storage.ts`, `src/lib/files/supabaseClient.ts`,
  `src/lib/files/config.ts`
- `src/components/features/organization/edit-organization-form.tsx`,
  `src/components/features/user/edit-user-profile.tsx` (+ leurs tests)

**Créés**

- `src/lib/files/storage/provider-imports.test.ts`

**Modifiés**

- `src/lib/files/storage/env.ts`, `storage-factory.ts` (+ `storage-factory.test.ts`)
- `src/db/repositories/files-repository.ts`, `src/app/dal/file-dal.ts` (si la bascule l'impose)
- `src/components/features/organization/action.ts`, `src/components/features/user/action.ts`
- `src/app/[locale]/(app)/account/page.tsx`,
  `src/app/[locale]/(app)/account/organizations/[id]/edit/page.tsx`,
  `src/app/[locale]/admin/organizations/[id]/edit/page.tsx`
- `src/services/__tests__/file-service.test.ts`
- `src/env-schemas.ts`, `src/env.ts`, `env.example`, `scripts/init-env.ts`,
  `.github/workflows/ci.yml`
- `messages/{fr,en,es}.json`
- `package.json`, `pnpm-lock.yaml`
- `.claude/rules/01-presentation/rule-upload-file.md` (+ copie `.cursor`), `docs/architecture.md`,
  `docs/stories.md` (note de s16), pages MDX de `src/app/[locale]/docs/_files/en/`
- `docs/plans/s12a-retrait-supabase.md` (cases cochées au fil de l'eau)

**À ne pas toucher** : `src/components/ui/file-upload.tsx`,
`src/services/association-identity-service.ts`, `src/lib/files/storage/local-storage.ts`,
`src/lib/files/storage/types.ts`, et tout fichier de `drizzle/` — cette story n'a aucune migration.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : fabrique de stockage et configuration sans variable
  Supabase (1, 5), envoi d'un fichier d'article vers l'adaptateur `local` avec ses refus de type et
  de taille (2), rendu des pages dont on a retiré un formulaire (3), test de garde sur les imports
  `@supabase/*` (4).
- **Bout en bout (Playwright)** : aucune spec nouvelle. Les specs existantes servent de
  non-régression — `smoke-authenticated.spec.ts` visite `/en/account` et
  `/en/account/organizations`, `association-identity.spec.ts` prouve que l'envoi du logo
  d'association, déjà sur l'adaptateur `local`, continue de fonctionner. **À lancer en local**, pas
  seulement en CI.
- **Build** : `pnpm build` avec un environnement **privé des trois variables Supabase**. C'est la
  seule vérification qui prouve le critère 1, parce que `files-repository.ts` construit son stockage
  au chargement du module, pas à l'appel.
- **Installation** : `pnpm install --frozen-lockfile` après régénération du lockfile (critère 4).

## Definition of Done

- Les 7 critères couverts, le 1 par un build sans variables Supabase, le 3 par un test de garde.
- Aucun module de `src/` n'importe `@supabase/*` ; les deux paquets ont quitté `package.json` et le
  lockfile.
- Le blog hérité écrit, liste et supprime ses fichiers sur le disque du VPS, sans changement de
  comportement visible.
- Les deux écrans hérités et leurs traductions ont disparu, et les pages qui les montaient rendent
  toujours leur contenu restant.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` et `pnpm build` verts ; suite e2e verte en local
  et en CI.
- Aucun fichier `drizzle/` dans le diff.
- Un commit de story (recherche et plan compris) ; revue `/ks-review` avec `Ship allowed: yes` avant
  `/ks-ship`.
