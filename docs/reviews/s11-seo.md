# Revue s11-seo : référencement par association (4ᵉ passage)

> Revue en contexte neuf. Chaque défaut est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s11-seo`, soit `1a7ad2d` (story), `43e1c1b`, `abf73fe` et `8033566` (trois séries de correctifs). `8033566` a été relu comme du code neuf, ADR 030 compris.
> Références : `docs/plans/s11-seo.md` (`validated: yes`), AGENTS.md, ADR 001 à 028 et 030, `docs/design-system.md`, `docs/designs/s11-seo.md`.

**Verdict : le ship est autorisé, sous réserve que la CI de la PR montre la suite e2e verte avant le merge.** Le critique C3 est résolu : je l'ai vérifié sur la vraie route, avec le vrai sharp, le vrai `next/og` et le vrai blocage de l'optimiseur de Next, et par mutation. La suite e2e n'a pas été exécutée à ce passage (consigne : elle tourne en CI). Il reste un majeur de design system et trois mineurs, dont aucun ne bloque.

## Historique

| Passage | Constat | Gravité | Résolution | Vérifié à ce passage |
|---|---|---|---|---|
| 1 | C1 — titre « · association » effacé par le layout `(public)` | critique | `43e1c1b` | Non revérifié ; tests unitaires verts |
| 1 | M2 — `/fr/bureau`… absents de robots.txt | majeur | `43e1c1b` | Code relu (`robots.ts:31-35`, `withLocalePrefixes`) |
| 1 | m1 à m4 | mineur | `43e1c1b` | Non revérifié |
| 1 | m5 — s43 non commitée | mineur | PR #35 | **Résolu** : `gh pr view 35` → `MERGED`. Le `main` local ne la contient pas encore |
| 1 | m6 — tests écrits après le code | mineur | constat | Inchangé |
| 1 | m7 — `/api/` bloquait l'image de partage | mineur (accepté par l'utilisatrice) | `allow` des 3 préfixes publics | Code relu (`robots.ts:20-24`) |
| 2 | C2 — logo PNG illisible | critique | `abf73fe` | Oui : logo illisible → 200 avec monogramme, sur la vraie route |
| 2 | m8, m9, m10 | mineur | `abf73fe` | Non revérifié |
| 3 | **C3 — image de partage cassée dès que `next/image` a optimisé une image** | critique | `8033566` + ADR 030 | **Oui, résolu** (détail ci-dessous) |
| 3 | m11 — `catch` muet sur un logo indécodable | mineur | `8033566` : `logger.warn` | Trace présente, mais la cause est perdue : voir m13 |
| 3 | m12 — logo réencodé en pleine résolution | mineur | `8033566` : `convertToPng(bytes, 480)` | Oui : 4000×2000 → 480×240, 120×80 inchangé (vrai sharp) |

## Vérifications exécutées par le reviewer

Tout a tourné sur une copie de `feature/s11-seo` (`git archive`) en disque local, avec une copie de `node_modules`. Le dépôt `/workspace` n'a pas été modifié : `git status` est identique à celui du départ.

| Contrôle | Exécuté ? | Résultat |
|---|---|---|
| `pnpm test --run` | Oui | **181 fichiers verts, 2 ignorés ; 2111 tests verts, 8 ignorés.** Sortie 0, aucun timeout de worker. +7 depuis le 3ᵉ passage (5 sur la route, 2 sur `convertToPng`) |
| `pnpm lint` | Oui | Sortie 0 |
| `tsc --noEmit` | Oui | Sortie 0, aucune ligne. La copie n'a pas de `.next/`, donc rien n'est masqué par `routes.d.ts` |
| `pnpm check:rules` | Oui | « Règles et documentation alignées sur le code. » |
| `prettier --check` sur les fichiers de `8033566` | Oui | Conforme |
| Lecture des internes de `node_modules` | Oui | Mécanisme de C3 confirmé (détail sous « C3 ») |
| Mécanisme C3 hors Next (script node) | Oui | Sortie brute ci-dessous |
| Vraie route sous Vitest, sans doubler sharp ni `next/og` | Oui | Sortie brute ci-dessous |
| Mutations du correctif (2) | Oui | Les deux font échouer le test du dépôt et mon contrôle réel |
| Format des traces avec le vrai logger | Oui | `"error":{}` : voir m13 |
| `pnpm build` | **Non** | Consigne : pas de build local |
| Suite e2e Playwright | **Non** | Reportée à la CI de la PR. Specs relues seulement |
| `pnpm db:generate` sans diff | **Non** | Pas de base sur la copie. Migration `0028` relue : 5 `ADD COLUMN` nullables, journal cohérent |

**Script node — vrai `getSharp` de l'optimiseur (via `optimizeImage`), vrai `@vercel/og` embarqué :**

```
1. avant tout appel de l optimiseur, sans unblock -> OK png 1200 630
   optimizeImage (vrai getSharp de Next) -> 1127 octets
2. apres l optimiseur, sans unblock (ancien code) -> ECHEC Input buffer contains unsupported image format
3. apres l optimiseur, apres unblock SvgBuffer (nouveau code) -> OK png 1200 630
4. rendu suivant sans nouvel unblock (le deblocage tient) -> OK png 1200 630
5. SVG depuis un fichier -> bloque : Input file contains unsupported image format
```

**Vraie route `GET` (code de la branche ; seuls les DAL, la façade et le logger sont doublés) :**

```
RAW 1. avant l optimiseur, monogramme -> 200 image/png | cache-control: public, no-cache | 33452 octets png 1200x630
RAW    optimiseur de next/image appele (getSharp bloque les chargeurs)
RAW 2. apres l optimiseur, monogramme -> 200 image/png | cache-control: public, no-cache | 33452 octets png 1200x630
RAW 3. apres l optimiseur, logo PNG 4000x2000 -> 200 image/png | cache-control: public, no-cache | 29047 octets png 1200x630
RAW 3. apres l optimiseur, logo WebP -> 200 image/png | cache-control: public, no-cache | 29941 octets png 1200x630
RAW 4. apres l optimiseur, logo illisible (repli monogramme) -> 200 image/png | cache-control: public, no-cache | 33452 octets png 1200x630
RAW    logger.warn appels: 1 | logger.error appels: 0
RAW statuts: [200,200,200,200,200]
```

**Mutation 1 — retrait de `reopenSvgBufferLoader()` (`route.tsx:232`), soit l'ancien code :**

```
RAW statuts: [200,500,500,500,500]   (logger.error : Input buffer contains unsupported image format)
route.test.ts : × rouvre le seul chargeur SVG en memoire de sharp avant chaque rendu — 1 failed | 15 passed
```

**Mutation 2 — déblocage fait une seule fois, au chargement du module :** même résultat, `[200,500,500,500,500]`, et le même test du dépôt échoue. L'ordre « déblocage avant chaque rendu » est donc bien épinglé.

## C3 — résolu

- **Mécanisme relu dans `node_modules`** :
  - `next/dist/compiled/@vercel/og/index.node.js:21419-21420` rastérise le SVG de satori avec sharp dès que sharp est importable (`:21454-21463`).
  - `next/dist/server/image-optimizer.js:196-215` bloque `VipsForeignLoad` une seule fois par processus (`if (_sharp) return _sharp`), puis ne rouvre que six chargeurs raster.
  - Le projet est sous `cacheComponents: true` : `next/og` passe par `next/dist/server/og/cache-image-response.js`. À la requête (store `request`), il rend directement, et une erreur de rendu fait rejeter `arrayBuffer()`. `materialize` l'attrape donc bien.
- **Le correctif est déterministe** : `route.tsx:232` rouvre `VipsForeignLoadSvgBuffer` juste avant chaque `new ImageResponse`. Peu importe que l'optimiseur ait tourné avant ou après le chargement de la route.
- **Fenêtre résiduelle** : celle que l'ADR 030 décrit. Si le tout premier appel de l'optimiseur tombe entre le déblocage et la rastérisation, ce rendu-là répond 500 `no-store`, journalisé ; les suivants passent.
- **Échec visible** : `materialize` (`route.tsx:104-127`) rend un 500 au lieu d'une connexion coupée, vérifié sur la vraie route par la mutation. Les en-têtes (`image/png`, `Cache-Control`) survivent à la matérialisation.
- **Périmètre de sécurité** : le chargeur SVG depuis un fichier reste bloqué (ligne 5 du script). Next refuse les SVG avant sharp sur détection par octets magiques (`image-optimizer.js:1092`).
- **Une seule libvips** : un seul sharp installé (0.35.3), et `sharp` figure dans `server-external-packages.jsonc:88`. Le sharp de la route, celui de l'optimiseur et celui de `@vercel/og` partagent donc le même état.
- **Ce que je n'ai pas prouvé** : le comportement dans le bundle de production servi par `next start`. Seule la CI le montrera (`seo.spec.ts:233-241`).

## Plan, tâche par tâche

- **Tâches 1 à 7, 9** : faites, vérifiées aux passages précédents. À ce passage : tests unitaires verts et relecture ciblée, pas de revérification ligne à ligne.
- **Tâche 5 (image de repli)** : faite ; C3 résolu.
- **Tâche 8 (sitemap)** : faite, avec un écart au plan : voir m15.
- **Tâche 10 (e2e et documentation)** : spec et documentation présentes ; l'exécution e2e reste à constater en CI.
- **`8033566`** : reste dans le périmètre des constats C3, m11 et m12. Seul ajout : l'ADR 030, que la revue précédente suggérait. Aucune dépendance ajoutée (`package.json` et `pnpm-lock.yaml` hors diff).

## Défauts trouvés

### M3 — majeur : l'aperçu « Dans Google » sort de l'échelle typographique et contredit son propre design

- **Où** : `src/components/features/pages/search-preview.tsx:32`, `:35`, `:39`, `:42`.
- **Le constat** :

  | Élément | Design (`s11-seo.md:62-64`, design system, maquette) | Code |
  |---|---|---|
  | Libellé « Dans Google » | `label`, 16 px / 500 | `text-[13px]` |
  | Adresse | `meta`, 15 px | `text-[14px]` |
  | Titre | `link`, 20 px | `text-[20px]` (conforme) |
  | Description | `body`, 17 px | `text-[15px]` |
  | Phrase « Google peut raccourcir… » | `meta`, 15 px | `text-[13px]` |

  - 13 px n'existe ni dans l'échelle du design system (le plus petit texte courant est `meta` à 15 px) ni ailleurs dans `src` sur `main` (0 occurrence).
  - Le paragraphe que cette story ajoute au design system dit lui-même « adresse en `meta` », « description en `body` ».
- **Pourquoi majeur** : AGENTS.md interdit d'inventer un token hors du design system, et la lisibilité est un parti pris du produit. Le défaut est limité à un composant du back-office et ne casse rien : il ne bloque pas le ship.
- **Hors constat** : les aides en 14 px de `page-seo-section.tsx` suivent une pratique déjà présente dans les éditeurs sur `main` (53 occurrences).
- **Correctif** : reprendre les tailles du design (16/500, 15, 20, 17, 15).

### m13 — mineur : les deux traces ajoutées perdent la cause de l'erreur

- **Où** : `src/app/api/identity/share-image/route.tsx:75-79` (`logger.warn`) et `:115-118` (`logger.error`).
- **Le constat** : le format de `src/lib/logger.ts` passe les métadonnées par `JSON.stringify`, et une `Error` s'y sérialise en `{}`. Sortie du vrai logger :

  ```
  [error]: [SHARE-IMAGE] rendu de l image de partage en echec | {"organizationId":"org-1","error":{}}
  [warn]: [SHARE-IMAGE] logo indécodable, repli sur le monogramme | {"organizationId":"org-1","logoKey":"k","error":{}}
  ```

  - La trace existe et nomme l'association, mais pas la raison. Le 500 de C3 serait donc journalisé sans son message.
  - Les tests unitaires ne le voient pas : le logger y est doublé.
  - La forme venait de la suggestion de la revue précédente : l'erreur est partagée.
- **Correctif** : passer `error: error instanceof Error ? error.message : String(error)`, ou l'erreur en argument direct (`logger.error('…', error)`, qui garde message et pile).
- **Détail** : le `warn` dit « logo indécodable » alors que le `catch` couvre aussi un échec de lecture du fichier.

### m14 — mineur : la garde e2e de C3 ne discrimine qu'avec un cache d'images froid

- **Où** : `e2e/seo.spec.ts:100-108`, et la phrase de l'ADR 030 « elle échoue si l'interaction réapparaît ».
- **Le constat** :
  - `forceImageOptimizer` demande toujours la même URL (`/shipsaas/shipsaas.png`, `w=32`, `q=75`). En CI, c'est déterministe : le build est neuf, `ci.yml` ne met pas `.next/cache` en cache, et la réponse n'arrive qu'après le blocage. L'ancien code échouerait donc à `:235`, quel que soit l'ordre des specs.
  - En local, si `.next/cache/images` vient d'un processus précédent, la requête est servie du cache sans charger sharp. Le test passe alors sans rien prouver. Il ne donne jamais de faux rouge.
  - Le commentaire de la spec le dit ; l'ADR l'affirme sans cette réserve.
- **Vérifié par lecture** : `32` est dans `imageSizes` par défaut, `75` dans `qualities` ; la source est un PNG de 283 Ko, et avec `Accept: */*` la sortie reste en PNG, donc passe par `optimizeImage`. `decodePng` décode réellement les pixels (`failOn: 'warning'`).
- **Correctif** : préciser la réserve dans l'ADR 030 et dans `docs/e2e-testing.md` (`rm -rf .next/cache/images` avant une passe locale). Le test unitaire d'ordre couvre le reste.

### m15 — mineur : écart au plan non consigné sur le sitemap

- **Où** : `src/app/sitemap.ts:7-17` ; plan, décision A et tâche 8.
- **Le constat** : le plan demande des pages fixes « filtrées par `enabledModules` » et un test « module inactif → page fixe absente ». Le code les liste toutes et n'a pas ce test.
- **Le choix est juste dans les faits** : les modules sont `vote`, `voirie`, `annonces`, et aucune page fixe publique n'appelle `requireEnabledModuleDal`. Il n'y a rien à filtrer.
- **Correctif** : le dire dans la PR. Le jour où une page fixe sera rattachée à un module, le sitemap devra suivre.

### m6, m7 (passages précédents)

Inchangés : m6 est un constat, m7 a été accepté en mineur par l'utilisatrice.

## Ce que la CI doit montrer vert avant le merge

La suite e2e n'a pas été exécutée à ce passage. Le verdict dépend de :

- **`e2e/seo.spec.ts`, critère 2** (`:233-241`) : `/_next/image` répond OK, puis l'image de partage répond 200, `image/png`, et se décode en PNG 1200 × 630. C'est la seule preuve de C3 sur le serveur de production.
- **`e2e/seo.spec.ts`, critères 1, 3, 4 et 5** : sitemap avant et après publication, sans préfixe ni blog ; `Disallow` et `noindex` ; code Google chez A et absent chez B ; sitemap, `Sitemap:`, `og:url`, canonique et `og:image` sur le domaine de B.
- **Non-régression** : `association-identity`, `homepage`, `mobile` (touchées par le diff), puis `page-cms`, `news`, `association-settings`. Le 3ᵉ passage comptait 146 tests dans 20 fichiers.

## Checklist de revue

### Respect du plan
- [x] Toutes les tâches du plan sont faites.
- [ ] Rien hors plan, aucun écart : un écart non consigné sur la tâche 8 (m15). L'ADR 030 est un ajout demandé par la revue.
- [ ] DoD « e2e vert » : non constaté à ce passage, reporté à la CI.

### Anti-hallucination
- [x] Aucune API inventée. Vérifiés dans `node_modules` : `sharp.unblock({operation})` (`sharp/lib/index.d.ts`), `VipsForeignLoadSvgBuffer` (accepté par libvips, effet mesuré), `ImageResponse` de `next/og`, `getSharp` de l'optimiseur, `IDENTITY_ACCEPTED_FORMATS` cité par l'ADR (`association-identity-types.ts:28`).
- [x] Les affirmations de l'ADR 030 sur les internes de Next sont exactes, à la réserve de m14 près.
- [x] Le code fait ce qu'il annonce : 200 après blocage, 500 sur échec de rendu.

### Respect des règles
- [x] `getDb`/`withTenant` respectés (`sitemap-service.ts:28`), aucun `withRlsBypass` ajouté, aucun `process.env` hors spec e2e, libellés dans `messages/`.
- [x] Aucun ADR accepté contredit. L'ADR 030 suit le gabarit MADR.
- [ ] Design system : tailles hors échelle dans l'aperçu « Dans Google » (M3).
- [ ] Gestion explicite des erreurs : trace présente, cause perdue (m13).
- [x] Migration générée, jamais écrite à la main (`0028`, journal et instantané cohérents).

### Tests
- [x] Suite unitaire lancée par le reviewer : verte (2111 tests, aucun timeout).
- [x] Lint, types, `check:rules` : verts.
- [x] Le test d'ordre de C3 échoue sur l'ancien code et sur un déblocage au chargement du module (mutations).
- [ ] Suite e2e : **non exécutée**, reportée à la CI.
- [ ] La garde e2e de C3 dépend de l'état du cache d'images en local (m14).

### Régressions
- [x] `convertToPng` sans `maxSide` : comportement inchangé ; un seul appelant.
- [x] Le proxy importe la même liste de segments qu'avant (`src/proxy.ts`).
- [ ] Non-régression e2e : à constater en CI.

## Constats

- **majeur** — `src/components/features/pages/search-preview.tsx:32,35,39,42` : tailles 13/14/15 px hors de l'échelle typographique, là où le design et le design system demandent `label` 16, `meta` 15 et `body` 17 (M3).
- **mineur** — `src/app/api/identity/share-image/route.tsx:75-79,115-118` : l'erreur se journalise en `"error":{}`, la cause est perdue (m13).
- **mineur** — `e2e/seo.spec.ts:100-108` et ADR 030 : la garde e2e de C3 ne discrimine qu'avec un cache d'images froid ; vrai en CI, pas toujours en local (m14).
- **mineur** — `src/app/sitemap.ts:7-17` : filtrage par `enabledModules` prévu au plan et non fait, à juste titre mais sans le dire (m15).
- **mineur** — m6 (constat), m7 (accepté par l'utilisatrice) : rappel.

À confirmer par l'utilisatrice, sans gravité :

- L'ADR 030 porte « Status: accepted » et « Décision de l'utilisatrice » ; le dépôt ne permet pas de le vérifier.
- La numérotation saute de 028 à 030 sur la branche ; le 029 est un fichier non suivi de s12.
- Le `main` local n'a pas la PR #35 (mergée sur GitHub). La branche ne touche pas `docs/stories.md` : mettre `main` à jour avant d'ouvrir la PR.
- La branche compte quatre commits ; ils seront écrasés au merge.

## Fichiers concernés

- `src/app/api/identity/share-image/route.tsx`
- `src/app/api/identity/share-image/route.test.ts`
- `src/lib/files/resize-image.ts`
- `src/lib/logger.ts`
- `src/components/features/pages/search-preview.tsx`
- `src/app/sitemap.ts`
- `e2e/seo.spec.ts`
- `docs/decisions/030-chargeur-svg-de-sharp-pour-l-image-de-partage.md`
- `docs/designs/s11-seo.md` et `docs/designs/s11-seo.html`
- `node_modules/next/dist/server/image-optimizer.js` (lignes 196-215, 312-520, 1079-1160, lecture seule)
- `node_modules/next/dist/compiled/@vercel/og/index.node.js` (lignes 21400-21500, lecture seule)
- `node_modules/next/dist/server/og/image-response.js` et `cache-image-response.js` (lecture seule)
- Scripts de contrôle du reviewer, hors dépôt (dossier temporaire de la session) : `c3-raw.mjs`, `c3-real.test.ts`, `c3.vitest.config.ts`, journaux `unit.log`, `lint.log`, `tsc.log`, `rules.log`

Max severity: major
Ship allowed: yes
