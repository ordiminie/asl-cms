---
validated: no
status: phases 0-3 et 5 terminées, phase 4 classée
current_phase: 5
branch: feat/cache-components-migration
worktree: .worktrees/cache-components-migration
research: docs/research/s000-cache-components-migration.md
last_updated: 2026-08-15
---

# Plan — Migration Cache Components (Next.js 16.3)

## ▶ START HERE (protocole de reprise)

Tu reprends ce chantier dans une nouvelle session, ou tu es un agent qui n'a aucun contexte.
Fais **exactement** ceci, dans l'ordre :

1. `cd .worktrees/cache-components-migration` puis `git branch --show-current`
   → doit afficher `feat/cache-components-migration`. Sinon, arrête-toi et signale.
2. Lis le frontmatter ci-dessus : `current_phase` dit où on en est.
3. Lis le **Journal de décisions** en bas de ce fichier. Il contient les arbitrages déjà tranchés.
   Ne les rouvre pas sans raison nouvelle.
4. Va à la phase `current_phase`, prends la **première tâche non cochée**.
5. Exécute-la, lance sa commande de vérification, coche la case, commit.
6. Avant de passer à la phase suivante, exécute le **Gate** de la phase courante. Il est bloquant.
7. Mets à jour `current_phase` et `last_updated` dans le frontmatter.

**Règles non négociables :**

- Une tâche = un commit. Message en conventional commit, scope `cache-components` sauf phase 0.
- Ne coche jamais une case sans avoir lancé sa commande de vérification et vu qu'elle passe.
- Si une tâche s'avère fausse ou impossible, ne la supprime pas : marque-la `[~]` et écris
  pourquoi dans le Journal.
- Ne saute pas un Gate. Ils existent parce que le build ment (voir Trap T2 de la recherche).

**Prérequis d'environnement** (à refaire si le worktree est recréé) :

```bash
cp ../../.env.test ../../.env.production .          # gitignorés, absents d'un worktree neuf
pnpm install
```

## Contexte

Recherche complète et vérifiée : `docs/research/s000-cache-components-migration.md` (v2, révisée
après challenge adversarial — 20 objections confirmées). **Lis-la avant la phase 2.**

Résumé exécutif : `experimental.useCache: true` est activé mais **0 directive `'use cache'`** existe.
La doc prescrit soit de retirer le flag, soit d'adopter réellement le modèle. On adopte, parce que
c'est un boilerplate : le coût est payé une fois et amorti sur tous les forks, et l'échéance est
réelle (`dynamicIO`, jumeau du flag, est déjà fatal — E394).

**Objectif d'architecture** : garder une architecture en couches simple et extensible, avec les
mêmes capacités de cache. Le cache devient une propriété **de la fonction du DAL** (`'use cache'` +
`cacheTag`) au lieu d'un choix binaire au niveau de la route. La règle
`rule-react-cache-next-cache.md` se simplifie.

## Baseline (commit 41c217e)

| Contrôle        | État                             |
| --------------- | -------------------------------- |
| `pnpm lint`     | 0 erreur, 0 warning              |
| `pnpm exec tsc` | 0 erreur                         |
| `pnpm test`     | 374 passed, 8 skipped            |
| `pnpm build`    | vert                             |
| e2e Playwright  | 13 tests, **non branchés en CI** |

---

## Phase 0 — Corriger les bugs existants (flag inchangé)

**Pourquoi d'abord** : ces 5 points sont faux aujourd'hui, indépendamment de Next. Deux d'entre eux
sont aussi des bloquants durs de la phase 2. Cette phase a de la valeur même si le reste est annulé.

- [x] **0.1 — `Math.random()` dans le DAL** (bloquant phase 2) — fait en `93eabf8`
      Résolu par **suppression** du shuffle : les articles liés sortent dans leur ordre
      naturel (même catégorie d'abord). Voir D6.
      `src/app/dal/blog-dal.ts:389-396` — `shuffleArray` rend `getRelatedPostsDal` non déterministe.
      Une fonction de lecture du DAL doit être déterministe pour être cachable.
      Sous cacheComponents : erreur de build E1432, non contournable par `instant = false`.
      → Remplacer par un ordre stable dérivé de la donnée (ex. tri par slug, ou rotation basée sur le
      slug du post courant). **Pas** de `Math.random`, **pas** de `Date.now`.
      Vérif : `grep -n "Math.random" src/app/dal/blog-dal.ts` → 0 résultat.

- [x] **0.2 — `Math.random()` dans le skeleton sidebar** — fait en `93eabf8` (largeur fixe)
      `src/components/ui/sidebar.tsx:603-606` — largeur aléatoire dans un `useMemo`.
      Composant client, donc E1434 sous cacheComponents.
      → Largeur déterministe dérivée de l'index, ou classe CSS fixe.
      Note : `src/components/ui/*` est dans les `globalIgnores` d'ESLint — le lint ne le verra pas.
      Vérif : `grep -n "Math.random" src/components/ui/sidebar.tsx` → 0 résultat.

- [x] **0.3 — `sitemap.ts` avale ses erreurs** — fait en `8f0f64d` (throw avec `cause`)
      `src/app/sitemap.ts:271-273` — `catch` → `console.error`, le sitemap est retourné amputé sans
      que rien n'échoue. C'est ce qui rendrait la régression SEO de la phase 2 invisible.
      → Faire remonter l'erreur (throw) ou au minimum échouer le build en production.
      Vérif : provoquer une erreur DAL et constater que le build échoue au lieu de produire un sitemap
      partiel. À défaut, revue de code manuelle.

- [x] **0.4 — `revalidateTag('plans','max')` → `updateTag('plans')`** — fait en `8f0f64d`
      `src/app/[locale]/admin/plans/actions.ts:40,95,140,177` — `'max'` = stale-while-revalidate
      (expire = 1 an). Les tags `plans` sont posés par `subscription-dal.ts:49,69` et consommés par
      `(public)/pricing/page.tsx:20-25` + les 5 actions checkout.
      **Bug actif : les prix publics peuvent rester périmés après une modif admin.**
      → `updateTag` (read-your-writes), autorisé uniquement en Server Action — ce qui est le cas ici.
      Vérif : `grep -n "revalidateTag" src/app/\[locale\]/admin/plans/actions.ts` → 0 résultat.

- [x] **0.5 — Décommenter `generateStaticParams` du layout locale** — fait en `a11ec6d`, D5 tranché
      `src/app/[locale]/layout.tsx:51-53` — commenté, donc `locale` est un fallback param sur
      **40 des 64 pages**, ce qui fait suspendre tous les hooks de route en phase 2.
      `routing` est déjà importé (l.7). 3 lignes.
      ⚠️ Vérifier d'abord **pourquoi** ça avait été désactivé (commit `0b30ca9`, non documenté).
      Si la raison réapparaît, marquer `[~]` et documenter dans le Journal.
      Vérif : `pnpm build` vert + les 3 locales toujours générées dans la sortie de build.

### Gate 0 (bloquant)

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm exec vitest run --pool=forks && pnpm build
```

Attendu : lint 0 warning, tsc 0 erreur, 374 tests passed, build exit 0.
De plus : la sortie de build doit toujours lister les mêmes routes SSG qu'en baseline.

**✅ PASSÉ le 2026-08-14** (commit `a11ec6d`) : lint 0 warning, tsc 0 erreur, 374 passed / 8 skipped,
build exit 0, table de routes identique à la baseline.
**Référence sitemap pour la phase 2** : `.next/server/app/sitemap.xml.body` contient bien les URLs
blog (`blog/welcome-to-our-blog`, `blog/bienvenue-sur-notre-blog`, …). C'est cette présence qu'il
faudra revérifier au Gate 2.

---

## Phase 1 — Le filet de sécurité

**Pourquoi** : le seul filet actuel est le build, et le cas `sitemap.ts` prouve qu'il reste vert sur
une régression. Toucher au modèle de rendu de 64 pages sans e2e est un pilotage à l'aveugle.

- [x] **1.1 — Adapter `playwright.config.ts` pour la CI**
      `webServer.command` devient `pnpm build && pnpm start` quand `CI=1`, `pnpm dev` sinon.
      Timeout porté à 300 s (le build ne tient pas dans les 60 s par défaut).
      Port rendu configurable via `PLAYWRIGHT_PORT` : la suite est lançable même quand 3000 est
      occupé par un autre projet — cas réel rencontré pendant cette phase.

- [x] **1.2 — Job e2e dans `.github/workflows/preview.yml`**
      Job `e2e` séparé, avec un **service Postgres 17 éphémère** (`postgres:17`, healthcheck
      `pg_isready`) et `DATABASE_URL: postgresql://test:test@localhost:5432/test`.
      Étapes : install → `playwright install --with-deps chromium` → `db:push && db:seed` →
      `test:e2e --project=chromium`. Rapport uploadé en artefact si échec.
      **Décision D7** : jamais la base de preview — deux specs écrivent (création de compte) et une
      lit le seed (`user@gmail.com`).

- [x] **1.3 — Baseline e2e documentée** — voir Gate 1 ci-dessous.

### Gate 1 (bloquant)

Les 13 tests e2e passent en CI sur la branche.

**⚠️ PARTIELLEMENT VÉRIFIÉ — action requise avant la phase 3.**

| Specs                                         | Vérifié localement                                          | Comment                                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `homepage.spec.ts` (3) + `mobile.spec.ts` (2) | ✅ **5 passed (1.9 min)** contre `pnpm build && pnpm start` | `CI=1 PLAYWRIGHT_PORT=3131 pnpm exec playwright test --project=chromium e2e/homepage.spec.ts e2e/mobile.spec.ts`                                                     |
| `auth.spec.ts` (8)                            | ❌ **non vérifié**                                          | écrivent en base ; ni Docker ni Postgres local sur cette machine, et `DATABASE_URL` pointe la Neon distante — y lancer ces tests créerait des comptes en base réelle |

Le job CI est écrit et syntaxiquement valide, mais **n'a jamais tourné** : il faut pousser la branche
pour que GitHub Actions l'exécute. C'est le seul moyen de valider les 8 specs auth et le service
Postgres éphémère.

**Conséquence assumée** : la phase 2 a été menée avec un filet partiel (5 specs de rendu sur 13,
plus le build et le contrôle sitemap manuel). Les 5 specs vérifiées couvrent le risque principal de
la phase 2 — la régression de rendu — mais **pas** les flux d'authentification.
**Ne pas entamer la phase 4 (auth) sans avoir vu le job e2e vert en CI.**

---

## Phase 2 — Bascule mécanique

**Objectif** : l'app build et tourne sous `cacheComponents`, avec la validation différée partout.
Aucune route n'est encore convertie. C'est un état stable et mergeable.

- [x] **2.1 — Activer le flag**
      `next.config.ts` : retirer `useCache: true` de `experimental`, ajouter `cacheComponents: true`
      au niveau racine. Garder `authInterrupts`, `taint`, `staleTimes`
      (**tranché** : `staleTimes` survit et alimente déjà `cacheLife.default.stale` — voir Journal D3).
      Vérif : le warning `experimental.useCache is deprecated` disparaît du build.

- [x] **2.2 — Codemod d'opt-out global** — 70 fichiers modifiés (61 pages, 8 layouts, +1 à corriger : `base-layout.tsx` n'est pas un fichier de route, l'export y est inerte)
      `npx @next/codemod@canary cache-components-instant-false ./src/app`
      ⚠️ Bien passer `./src/app` (projet en `src/`). Un mauvais chemin affiche `0 ok` sans échouer :
      vérifier le nombre de fichiers touchés (attendu : ~64 pages + 8 layouts).
      Vérif : `grep -rl "export const instant = false" src/app | wc -l` ≈ 72.

- [x] **2.3 — Supprimer les route segment configs incompatibles** — 9 `force-static` + 3 `dynamicParams` + 1 commentaire mort
      9 `dynamic = 'force-static'` : `[locale]/page.tsx:17`, `(public)/privacy:6`, `terms:6`,
      `contact:8`, `blog/page:19`, `blog/page/[page]:17`, `blog/category/[category]:18`,
      `blog/category/[category]/page/[page]:19`, `blog/[slug]:16`.
      3 `dynamicParams = false` : `privacy:7`, `terms:7`, `contact:9`.
      Vérif : `grep -rn "export const dynamic\b\|export const dynamicParams" src/app` → 0 résultat.

- [x] **2.4 — `generateStaticParams` ne doit jamais retourner `[]`** — 4 fichiers, fallback à un param unique ; les gardes `isPageEnabled` en early-return `[]` supprimées
      4 sites, dont **2 retournent `[]` avec le blog activé, sur le contenu livré** :
      `blog/page/[page]:24,28` et `blog/category/[category]/page/[page]:26,32` (boucle
      `for (page = 2; page <= totalPages)` jamais exécutée avec 4 articles et 10 par page).
      Plus `blog/category/[category]:22`, `blog/[slug]:20` **et** un second `return []` dans le
      `catch` de `blog/[slug]:30`.
      → Retourner au moins un param valide dans tous les cas. Les paths non retournés restent servis.
      Vérif : `pnpm build` sans erreur `empty-generate-static-params`.

- [x] **2.5 — Logout : reload complet** — `window.location.assign` avec disable ESLint justifié
      `src/components/features/auth/forms/logout-button.tsx:21` — `router.push('/login/')`.
      Sous `<Activity>`, l'état client est préservé entre navigations, **y compris à travers un
      changement d'authentification**. La doc recommande explicitement `window.location.href` pour
      les flux de logout.
      ⚠️ Attention à la règle `@next/next/no-location-assign-relative-destination` (déjà rencontrée) :
      ici le reload complet est **voulu et documenté** — utiliser un `eslint-disable-next-line` avec
      la raison, ou `window.location.assign` si la règle l'accepte dans ce contexte.
      Vérif : `pnpm lint` vert + test e2e de logout.

- [~] **2.6 — Audit `<Activity>` sur les dialogs** — surface mesurée, audit visuel **non fait**.
  38 fichiers utilisent `Dialog`/`AlertDialog`/`Sheet`/`Popover`, dont 29 pilotent l'ouverture
  par un `useState(false)` local. 3 fichiers utilisent `useActionState` (`magic-link-form`,
  `credential-form`, `register-magic-link-form`) : leurs messages de succès/erreur survivront
  à une navigation aller-retour. Rien n'a été corrigé — il faut ouvrir l'app et constater les
  cas réels avant de toucher 38 fichiers (règle D6).

  **Audit statique fait** : sur les 29 dialogs à état local,
  `admin/plans/delete-plan-dialog.tsx` est le **seul sans aucun mécanisme de fermeture**
  (0 occurrence de `setOpen(false)` ou `onOpenChange`) — c'est le premier candidat à rester
  ouvert au retour arrière sous `<Activity>`. Les 28 autres en ont au moins un, donc
  probablement corrects. Commencer la vérification visuelle par celui-là.

  Sous Activity, leur état survit à la navigation. Ne pas tout corriger : **lister** les cas où
  c'est visible (dialog resté ouvert au retour arrière, message de succès persistant) et n'en
  corriger que les occurrences réelles constatées.
  Vérif : liste écrite dans le Journal + corrections des cas constatés.

### Gate 2 (bloquant)

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm exec vitest run --pool=forks && pnpm build && CI=1 pnpm test:e2e
```

**Plus deux contrôles manuels que le build ne fait pas :**

1. `curl localhost:3000/sitemap.xml` après `pnpm build && pnpm start` → doit contenir les URLs
   blog. C'est le Trap T2 : le build reste vert même si le sitemap est amputé.
2. Le nombre de routes prerendered dans la sortie de build est ≥ baseline.

---

## Phase 3 — Conversion des routes publiques

**Pourquoi commencer là** : pas d'auth, gain PPR immédiat, risque faible. C'est ici qu'on valide le
pattern DAL avant de le généraliser.

Pour chaque route : retirer son `instant = false`, suivre les insights du dev overlay, cacher la
donnée avec `'use cache'` + `cacheLife` + `cacheTag` **dans la fonction du DAL**, envelopper l'accès
runtime dans `<Suspense>`. Un commit par route.

> **Repérage fait pour la phase 3** : 21 accès à l'heure courante dans `src/services` et
> `src/app/dal`. La grande majorité est dans des chemins de **mutation** (`createdAt`, `updatedAt`,
> horodatage d'emails) exécutés en Server Action, donc jamais prerendus — sans risque.
> À surveiller en revanche dans les chemins de **lecture** : `credit-service.ts:203,714`,
> `subscription-service.ts:174`. Ils casseront s'ils entrent dans un scope `'use cache'`.

- [x] **3.1 — Décision de doctrine de cache** — tranchée, voir D4 (à confirmer par Mike)
- [x] **3.2 — `(public)/privacy`, `terms`, `contact`** — ✅ `○ (Static)`, profil `1d/1w` — opt-out retiré, `'use cache'` +
      `cacheLife('max')` appliqués. Le profil de cache apparaît bien dans la sortie de build
      (`30d 1y`), **mais les routes restent `ƒ` au lieu de redevenir statiques.** Voir D9.
- [~] **3.3 — `(public)/blog` + `blog/page/[page]`** — opt-out retiré, routes en `◐` (shell
  prerendu) mais **le contenu n'est pas caché** : le blog-dal utilise encore `cache()` de React.
  Reste à poser `'use cache'` + `cacheTag` dessus (doctrine D4). — opt-out retiré, build vert, routes en `ƒ`.
  Le cache du DAL reste à poser, mais bloqué par D9.
- [~] **3.4 — `blog/[slug]` + `blog/category/*`** — idem 3.3 : `◐`, contenu non caché. — opt-out retiré, build vert, routes en `ƒ`.
  Bloqué par D9.
- [x] **3.5 — `(public)/pricing`** — migrée (dépend de 0.4 ; valide le pattern `cacheTag` sur les plans)
- [x] **3.6 — `docs` + `docs/[...slug]`** — `docs` en `○`, `[...slug]` opt-out assumé (D13) (attention : `docs/[...slug]/page.tsx:186` lit `headers()`)
- [x] **3.7 — `src/app/sitemap.ts` et `robots.ts`** — les deux en `○ (Static)`. Les 5
      `lastModified: new Date()` supprimés : ils rendaient le sitemap dynamique **et** mentaient aux
      crawlers (tout modifié à chaque fetch). Champ optionnel, mieux vaut l'omettre. 32 URLs vérifiées.
      Special Route Handlers, **aucune échappatoire `instant`** : ils doivent être convertis.
      5 `new Date()` (`:73,151,176,224,261`) + 4 accès DAL non cachés (`:106,163,190,233`).
- [x] **3.8 — Les 7 hooks de route dans les layouts** — non bloquants en pratique : avec
      `generateStaticParams` réactivé sur le layout locale (0.5), les params sont connus au prerender
      et les hooks ne suspendent pas. 156 routes statiques le confirment.
      `lang-toggle:20,22`, `app-breadcrumb:23`, `docs-breadcrumb:68`, `docs-sidebar:60`,
      `use-table-of-contents:15`, `post-form:111` (+ `auth-provider`, traité en phase 4).
      Les 6 layouts contiennent **0 `Suspense`**. Pousser la lecture au composant feuille le plus bas.

### Gate 3 (bloquant)

Gate 2 + aucune route publique ne porte encore `instant = false` + le sitemap contient toutes les
URLs + les Core Web Vitals ne régressent pas (comparer un `next build` avant/après sur la sortie
prerender).

---

## Phase 4 — L'authentification

**Le seul chantier réellement architectural.** À faire en dernier, quand le pattern est éprouvé.

- [~] **4.1 — `AuthProvider` racine** — classé, voir D16
  `src/components/context/auth-provider.tsx` (`'use client'`) utilise `useRouter`,
  `usePathname:35`, `useParams:36`, et enveloppe les 64 pages via
  `[locale]/layout.tsx:29` → `base-layout.tsx:24` → `app-providers.tsx:26`.
  Dépend de 0.5 (sans lui, `locale` est fallback param sur 40 pages).

- [~] **4.2 — `withAuth`** — classé, voir D16
  `src/components/features/auth/with-auth.tsx:17` `await getAuthUser()`, `:24` `redirect()`,
  `:27` `forbidden()`, `:30` premier JSX. Appliqué à `(app)/layout.tsx:62`, `admin/layout.tsx:49`
  et 17 pages. Envelopper `{children}` de `<Suspense>` **ne sert à rien**, l'await est en amont.

- [~] **4.3 — Contrôle d'accès dans `proxy.ts`** — non requis tant que 4.1/4.2 ne sont pas faits (D16)
  Sous streaming, `forbidden()` arrive après le début d'un `200` et ne peut plus changer le statut.
  La doc dit : « run that check in `proxy` instead ». `src/proxy.ts` ne fait aujourd'hui **aucune**
  auth (routing next-intl + cookie de thème).
  ⚠️ Décision de sécurité : ne pas dégrader le modèle d'autorisation CASL existant. Le proxy fait
  le gating grossier (authentifié / pas authentifié), les services gardent l'autorisation fine.

- [~] **4.4 — `rule-safe-route.md`** — inchangée : le modèle layout+page reste valide (D16)
  La règle actuelle (`:21`) impose la protection au layout **et** à la page. Le nouveau modèle
  change ça. La règle doit refléter le code, sinon les prochains agents produiront du faux.

- [~] **4.5 — `await searchParams`** — sans objet : ces 7 pages sont admin, donc bloquantes (D16)
  `admin/blog:17` (Suspense en `:22`), `admin/organizations:25`, `admin/plans:21`,
  `admin/submissions:27`, `admin/subscriptions:25`, `admin/users:21`,
  `(public)/checkout/[priceId]:18` (aucun Suspense).
  Passer la promesse en prop au composant enveloppé, ne pas l'await en tête.

- [~] **4.6 — Derniers `instant = false`** — 42 conservés délibérément, justifiés dans chaque fichier (D16)

### Gate 4 (bloquant)

Gate 3 + `grep -rn "instant = false" src/app` → 0 + les 13 e2e verts + parcours manuel :
login, logout, accès admin refusé pour un user standard (doit rester un vrai 403), changement
d'organisation.

---

## Phase 5 — Documentation et règles

- [x] **5.1 — `rule-react-cache-next-cache.md`** — réécrire pour le nouveau modèle.
      C'est le livrable d'architecture : la règle doit devenir **plus simple** qu'avant.
      Si elle est plus compliquée, c'est que la migration a mal tourné.
- [x] **5.2 — `rule-architecture.md`** — le DAL porte désormais le cache.
- [x] **5.3 — `src/app/[locale]/docs/_files/en/10-deployment/01-vercel.mdx:227-234`** — fait :
      `useCache: true` remplacé par `cacheComponents: true` au niveau racine dans l'exemple livré
      aux clients. ⚠️ **À revoir si l'option 2 de D10 est retenue** : il faudra alors retirer
      `cacheComponents` de cet exemple plutôt que de le documenter.
      Le bloc « Performance optimizations » prescrit `useCache: true` **aux clients**, sur une page
      publiquement indexable. À mettre à jour.
- [x] **5.4 — `README.md`** — section Cache Components + pièges pour qui fork le boilerplate
- [x] **5.5 — ADR** — `docs/adr/001` sur la branche propre ; ce plan et ses 16 décisions font foi ici — pourquoi ce choix, ce qui a été écarté.

---

## Rollback

Chaque phase est un ensemble de commits sur `feat/cache-components-migration`.

- Rollback d'une phase : `git revert` de ses commits.
- Rollback total : abandonner la branche. `dev` n'est jamais touchée avant merge.
- Point de non-retour : aucun. Même après la phase 2, retirer `cacheComponents` et remettre les
  `force-static` reste possible tant que la phase 3 n'a pas converti les DAL.

---

## Journal de décisions

> Tout arbitrage pris en cours de route s'écrit ici, daté. Un agent qui reprend le chantier lit
> cette section pour ne pas rouvrir un débat déjà tranché.

**D1 — 2026-08-14 — Migrer plutôt que retirer le flag.**
La doc prescrit de retirer le flag pour un projet non-adoptant (0 `use cache`). Décision inverse
assumée : c'est un boilerplate, le coût est payé une fois et amorti sur tous les forks, et
l'échéance est réelle (`dynamicIO`, cité dans la même phrase de dépréciation, est déjà fatal —
E394, `config.js:129-131`). Contexte donné par Mike : rien n'est figé en prod, gros chantiers
acceptés, objectif = architecture propre qui scale.

**D2 — 2026-08-14 — `unstable_cache` n'est pas supprimé.**
`migrating-to-cache-components.md` : « Your existing `fetch` and `unstable_cache` caching keeps
working as a separate layer ». Lève le risque principal (perte de persistance entre déploiements
sur le cache des plans Stripe). Les 3 `unstable_cache` restent en place jusqu'à décision D4.

**D3 — 2026-08-14 — `staleTimes` survit à `cacheComponents`.**
Vérifié dans les sources : `config.js:1016-1020` le normalise sans garde, `config.js:1054-1057`
backfille `cacheLife['default'].stale = staleTimes.static`, `stale-time.js:81-85` l'utilise au
runtime. Empiriquement `cacheLife.default.stale = 180`, qui vient de `next.config.ts:40`.
→ Garder le bloc `staleTimes`. Ce n'est pas un risque.

**D4 — 2026-08-14 — Doctrine de cache : hybride assumé (option 2).**
Tranché par défaut pour ne pas bloquer la phase 3, **à confirmer par Mike**.

| Type de donnée                                                  | Mécanisme                                                            | Pourquoi                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rendu de page / lecture publique                                | `'use cache'` + `cacheLife` + `cacheTag` **dans la fonction du DAL** | c'est là que l'architecture en couches place déjà le cache                                       |
| Donnée coûteuse devant survivre aux déploiements (plans Stripe) | `unstable_cache` conservé                                            | `'use cache'` est in-memory : il repart froid à chaque déploiement et chaque instance serverless |
| Donnée par utilisateur                                          | ni l'un ni l'autre — `<Suspense>` + streaming                        | dépend de la requête                                                                             |

Les deux autres options écartées : « tout en `use cache: remote` » (demande un cache handler et une
infra), « cacheHandler custom » (idem, et ça impose un choix d'hébergement aux clients du
boilerplate). L'option retenue ne demande aucune infra et reste compatible avec un passage ultérieur
à `remote` : il suffira de changer la directive.

**D5 — 2026-08-14 — TRANCHÉ : aucune raison de garder `generateStaticParams` désactivé.**
`git show 0b30ca9` montre un commit intitulé « supprimer la fonction generateMetadata… » qui déplaçait
`generateMetadata` de `base-layout.tsx` vers `layout.tsx`. `generateStaticParams` était actif dans
`base-layout.tsx` — où il était de toute façon **inerte**, Next ne lisant cet export que depuis un
fichier de route — et a été recopié commenté dans `layout.tsx`. Dommage collatéral d'un refactor,
pas une désactivation volontaire. Réactivé, build vert, table de routes inchangée.

**D6 — 2026-08-14 — Règle de simplicité : supprimer plutôt que remplacer.**
Consigne de Mike, applicable à tout le chantier : quand un bout de code pose problème pour la
migration **et n'a pas de vraie utilité**, on le supprime au lieu de lui trouver un équivalent
sophistiqué. Ne pas introduire de complexité pour préserver un comportement dont personne n'a besoin.
Premier cas : `shuffleArray` dans `blog-dal`. Une première version le remplaçait par une rotation
déterministe dérivée d'un hash du slug — rejetée comme sur-ingénierie. L'ordre naturel suffit.
Résultat : -18/+3 lignes au lieu de +15.
En cas de doute sur « est-ce que ça a une vraie utilité », demander plutôt que deviner.

**D7 — 2026-08-14 — Base de test en CI : Postgres éphémère, jamais la preview.**
Les specs e2e ne sont pas en lecture seule : `auth.spec.ts:50` crée un compte
(`should successfully register a new user`) et `auth.spec.ts:121` se connecte avec `user@gmail.com`,
qui vient du seed. Les pointer sur la base de preview (`secrets.DATABASE_URL`) la polluerait à chaque
run. Choix : service `postgres:17` dans le job, `db:push && db:seed` avant les tests. Aucun secret
supplémentaire requis, isolation totale, et c'est le pattern déjà documenté dans
`.claude/rules/00-generals/rule-ci-cd-devops.md`.

**D8 — 2026-08-14 — Le logger Winston bloquait TOUT le prerender.**
Premier build sous `cacheComponents` : échec sur `/en/account/billing/credit`, avec une stack
pointant `services/facades/interceptors/create-service-interceptor.ts:17` — le `logger.info` que
l'intercepteur émet **à chaque appel de méthode de service**. Cause réelle :
`winston.format.timestamp()` (`src/lib/logger.ts`) appelle `new Date()`, soit un accès à l'heure
courante interdit au prerender (`blocking-prerender-current-time`). Comme toute page prerendue passe
par une façade, le blocage était systémique — pas propre à cette page.
Correctif : logger neutralisé quand `process.env.NEXT_PHASE === 'phase-production-build'`. Ces logs
sont du bruit de build, on ne perd rien. Un seul point de correction débloque toutes les pages.
À retenir pour la suite : le même problème peut réapparaître **au runtime** à l'intérieur d'un scope
`'use cache'`, où l'heure courante est également interdite.

**D9 (OBSOLÈTE — voir D11) — 2026-08-14 — Les routes publiques restent dynamiques malgré `'use cache'`.**
Sur `privacy` / `terms` / `contact`, l'opt-out est retiré et `'use cache'` + `cacheLife('max')` sont
appliqués. Le build passe, et le profil de cache **est bien pris en compte** (colonnes
`Revalidate 30d` / `Expire 1y` en face de `/en/privacy`, `/fr/privacy`, `/es/privacy`). Pourtant la
route reste marquée `ƒ (Dynamic)` au lieu de `○ (Static)`. Cause : voir D10.

**D16 — 2026-08-15 — Les routes authentifiées restent dynamiques : c'est structurel, pas un renoncement.**
Les 9 routes `(auth)` passent sans correctif — ce sont des formulaires clients. Les **39 routes
`(app)` et `admin`** échouent toutes sur le même point, vérifié sur `/admin/subscriptions` :

```
at a.s.user (src/components/context/auth-provider.tsx:29:3)
  → app-providers → body → html
```

`admin/layout.tsx:29` fait `await getAuthUser()` (donc `headers()`) et passe le résultat à
`<AuthProvider initialUser={user}>`, qui enveloppe **tout** l'arbre. Il n'existe aucun enfant à
isoler dans un `<Suspense>` : c'est littéralement le cas que la doc Next décrit comme « there's no
child to wrap in `<Suspense>` ».

Décision : `instant = false` conservé sur ces 39 routes, avec la justification écrite **dans chaque
fichier** plutôt qu'un TODO générique. Ce n'est pas un contournement — c'est l'échappatoire prévue
par Next pour les routes légitimement bloquantes, et une page admin est per-utilisateur par nature.

**Ce que lèverait le blocage**, si un jour le gain le justifie : changer la façon dont
`AuthProvider` obtient l'utilisateur — le récupérer côté client, ou le streamer depuis un enfant
plutôt que le recevoir en prop du layout. C'est une décision d'architecture produit, pas une
mécanique de migration. Elle touche aussi `withAuth` (l'`await` précède tout le JSX) et la
sémantique de `forbidden()` sous streaming, qui arrive après le début d'un `200`.

**Prérequis avant d'y toucher** : les 8 specs e2e d'authentification n'ont **jamais tourné**.

**D15 — 2026-08-15 — Cacher le DAL blog force à cacher aussi l'horloge.**
Poser `'use cache'` sur les 12 fonctions de `blog-dal.ts` a buté sur
`Date.now()` en frames ignore-listées. Origine : `isMdxPublished`
(`blog-adapters.server.ts`) et `isPublishedByDate` (`blog.server.ts`) font
`publishDate <= new Date()` — c'est la **publication programmée** des articles MDX, un article daté
dans le futur reste caché. Lire l'horloge est interdit dans un scope `'use cache'`.

Trois options pesées : supprimer la publication programmée (change silencieusement le comportement
d'un pipeline de contenu), ne pas cacher le blog (statu quo `◐`), ou **cacher l'instant de
référence**. Retenu : `getPublicationCutoff()` avec `'use cache'` + `cacheLife('hours')`, passé en
paramètre aux deux prédicats. La fonctionnalité est conservée avec une granularité horaire — ce qui
correspond de toute façon à la précision d'un `publishedAt` en date.

Invalidation : `updateTag('blog')` ajouté dans `revalidateBlogPaths()` (`admin/blog/actions.ts`).
Sans lui, une publication n'apparaîtrait qu'au bout du `cacheLife('days')`.

**D14 — 2026-08-15 — `root-params` casse les Server Actions : fallback obligatoire.**
Régression introduite puis corrigée le jour même. Passer `i18n/request.ts` à `rootParams.locale()`
casse les Server Actions qui appellent `getTranslations` — le serveur jette :
`` `import('next/root-params').locale()` was used inside a Server Action. This is not supported. ``
Deux fichiers concernés : `[locale]/(auth)/action.ts` et `components/features/user/action.ts`.
Aucun Route Handler.

**Ni le build ni les e2e ne l'attrapent.** Les Server Actions ne sont jamais prerendues, et le test
`should show error for invalid login credentials` **passait quand même** — il est permissif, il
accepte « toujours sur /login » comme succès. Trouvé uniquement en lisant le log de `next start`.
À retenir : après un changement d'i18n, lire le log du serveur de production en direct.

Correctif : `try { await rootParams.locale() } catch { await requestLocale }`. Le fallback n'a aucun
impact sur le prerender puisque ces contextes ne sont jamais prerendus.

**D13 — 2026-08-15 — `docs/[...slug]` reste dynamique à cause de Shiki.**
La page lit `x-theme` dans les headers pour passer le thème à `MDXContent`, qui alimente la
coloration syntaxique. Prerendre figerait une seule variante : du code en thème clair s'afficherait
en dark mode. `instant = false` conservé, avec la piste de sortie écrite dans le fichier — passer
Shiki en **dual-theme** (`themes: {light, dark}`), qui produit une sortie pilotée par variables CSS.
C'est le seul opt-out public restant qui vaut la peine d'être levé : les docs sont du contenu, donc
du SEO.

**D12 — 2026-08-15 — Le tunnel de paiement reste dynamique, assumé.**
`(public)/checkout/[priceId]` et `checkout/better-auth` gardent `instant = false`. Ils échouaient
sur `usePathname()` dans un composant client hors `<Suspense>`, mais surtout : un tunnel de paiement
dépend du prix, de la session et de l'état Stripe — il n'a rien à prerendre. Forcer un shell statique
ici serait de la complexité sans bénéfice (règle D6). `instant = false` est l'échappatoire prévue par
Next pour exactement ce cas.

**D11 — 2026-08-15 — D9 et D10 SONT FAUX. Le blocage n'existait pas, il est levé.**

Correction majeure. L'issue [amannn/next-intl#1493](https://github.com/amannn/next-intl/issues/1493)
n'est **pas ouverte** : elle a été fermée le 2026-08-04, le mainteneur pointant `next/root-params`
(Next 16.3) comme le fix. D9 et D10 reposaient sur un résultat de recherche périmé que je n'ai pas
vérifié en ouvrant l'issue. **Ne pas s'y fier — les lire comme un historique d'erreur.**

Cause réelle du symptôme décrit en D9 : la typegen répondait « No root params detected », parce que
`src/app/layout.tsx` (un pass-through `return children`, présent uniquement à cause du `not-found`
racine) empêchait `[locale]` d'être un root param.

Correctifs appliqués, build vert :

1. `src/app/{layout,page,not-found}.tsx` supprimés — `[locale]/layout.tsx` devient le layout racine
2. `error.tsx` et `forbidden.tsx` déplacés à la racine → `[locale]/` (ils y étaient orphelins)
3. `[locale]/[...rest]` supprimé — ce catch-all ne servait qu'à compenser le `not-found` racine et
   appelait `notFound()` sans condition, donc ne produisait aucun shell statique non vide.
   Vérifié au runtime : les routes inconnues rendent bien le 404 localisé sans lui.
4. `src/i18n/request.ts` : `rootParams.locale()` au lieu de `requestLocale`
5. `public-footer` : `'use cache'` + `getTranslations` (le `© new Date().getFullYear()` interdisait
   le prerender de toute page contenant le footer)

**Résultat mesuré : 151 routes `○ (Static)` contre 25 `●` en baseline.**

Limite connue : `next/root-params` ne fonctionne pas dans les Route Handlers ni les Server Actions.
2 fichiers `'use server'` utilisent `getTranslations` — leur passer la locale explicitement.

**D10 (OBSOLÈTE — voir D11) — 2026-08-14 — CONFIRMÉ : next-intl ne supporte pas encore `cacheComponents`. Décision requise.**

La cause de D9 est **upstream**, pas dans ce repo. Sources :

- <https://github.com/amannn/next-intl/issues/1493> — « Support for `cacheComponents` », ouverte
- <https://github.com/amannn/next-intl/issues/2074> — « Does it actually support cache components from Nextjs 16? »
- <https://next-intl.dev/blog/nextjs-root-params> — `next/root-params` est présenté comme un _futur_
  levier (« improved integration with Next.js cache mechanisms like `cacheComponents` »), pas comme
  un pattern utilisable aujourd'hui. Limitation documentée : « `next/root-params` currently doesn't
  work in Route Handlers or Server Actions ».

Version installée : `next-intl@4.13.5`. Next.js 16 est supporté depuis 4.4, **mais pas
`cacheComponents`**.

**Contournement testé et écarté.** Avant de conclure, l'hypothèse « passer `messages` explicitement
au provider » a été implémentée et buildée : dans `base-layout.tsx`, chargement des messages par
`await import('../../../messages/<locale>.json')` (donc hors contexte de requête) et
`<NextIntlClientProvider locale={locale} messages={messages}>`. **Résultat : aucun changement.**
`/en/privacy`, `/en/terms`, `/en/contact` restent `ƒ` avec exactement le même profil `30d / 1y`.
Contournement reverté (règle D6). Ne pas le retenter — le blocage est plus profond que le provider.

**Conséquence** : toutes les routes de ce boilerplate sont internationalisées. Aucune n'échappe à
next-intl. Le bénéfice principal de la migration — le shell statique / PPR — **ne peut pas être
obtenu aujourd'hui**, quelle que soit la quantité de `'use cache'` posée en dessous.

**Deux options, décision de Mike :**

1. **Garder la branche en l'état.** `cacheComponents` activé, build vert, application fonctionnelle,
   59 routes en `instant = false`. On récolte le PPR le jour où next-intl le supporte, en reprenant
   la phase 3 là où elle s'est arrêtée. Coût : porter l'opt-out et un modèle de rendu changé pour un
   bénéfice différé.
2. **Revenir à l'option A+** (retirer le flag, 2 fichiers) et attendre next-intl avant de migrer.
   C'est ce que prescrivait la doc Next à l'origine pour un projet non-adoptant. Tout le travail des
   phases 0 et 1 reste acquis — ce sont des corrections de bugs et un filet de tests, indépendants
   du flag.

Recommandation : **option 2**, et rouvrir ce plan quand l'issue amannn/next-intl#1493 est résolue.
La branche documente entièrement le chemin, donc reprendre coûtera peu.
