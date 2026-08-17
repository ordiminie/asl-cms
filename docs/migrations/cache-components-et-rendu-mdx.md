---
title: Migration — Cache Components (Next 16) puis rendu MDX
audience: SaaS forkés de ce boilerplate avant Cache Components
source: docs/plans/cache-components-migration.md (D1→D26), 62 commits de feat/cache-components-migration
next: 16.3.0
next_intl: 4.13.5
last_updated: 2026-08-16
---

# Migration — Cache Components, puis rendu MDX

Ce document s'adresse à un projet **forké de ce boilerplate avant la migration Cache Components**.
Il contient deux migrations indépendantes, à faire dans cet ordre :

| Partie | Objet                                                 | Phases | Réversible               |
| ------ | ----------------------------------------------------- | ------ | ------------------------ |
| **1**  | Passer sous `cacheComponents: true` (Next 16)         | A → G  | oui, jusqu'à la phase E  |
| **2**  | Reprendre le rendu MDX du blog et de la documentation | H → K  | oui, chaque phase isolée |

La partie 2 ne dépend pas de la partie 1 **sauf** sa dernière tâche (K5), qui lève un opt-out de
prerender. Un projet qui ne fait que la partie 2 saute K5.

Tout ce qui suit est tiré du chantier réel : le plan de migration et ses 26 décisions datées, les
62 commits de la branche, et les règles réécrites en cours de route. Rien n'est extrapolé. Quand une
conclusion a d'abord été fausse puis corrigée, c'est la version corrigée qui figure ici, et l'erreur
est signalée — elle coûte plusieurs heures à qui la refait.

---

## Protocole pour l'agent qui exécute

**Règles non négociables.**

1. **Une tâche = un commit.** Message en conventional commit. Si une tâche déborde sur deux
   décisions distinctes, c'est deux tâches.
2. **Ne jamais cocher une case sans avoir lancé son critère d'acceptation et vu qu'il passe.**
3. **Ne jamais sauter un Gate.** Ils existent parce que le build ment — voir « Ce qu'un build vert
   ne prouve pas » en annexe.
4. **Si une tâche s'avère fausse ou impossible, ne pas la supprimer** : la marquer `[~]` et écrire
   pourquoi dans un journal de décisions local au projet.
5. **Supprimer plutôt que remplacer.** Quand un bout de code bloque la migration et n'a pas d'utilité
   réelle, le supprimer au lieu de lui trouver un équivalent sophistiqué. En cas de doute sur
   l'utilité, demander plutôt que deviner. (D6)
6. **Chercher le guide officiel avant de déduire un pattern d'un symptôme de build.** Deux fois sur
   ce chantier, une conclusion « architecturalement impossible » s'est révélée fausse à la lecture
   d'une page de doc (D16→D17, D18→D20).

**Prérequis d'environnement, à établir avant la phase A.**

- Une base de données **joignable**. Sans elle, tout ce qui suit se déroule sur un signal faux.
- `pnpm install`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` : tous verts sur
  la baseline, chiffres notés.
- La sortie de `pnpm build` (table des routes) **sauvegardée** : c'est la référence de comparaison à
  chaque Gate.

---

# Partie 1 — Migration Cache Components

## Ce que ça change, en une page

`cacheComponents: true` remplace `experimental.useCache`, retiré en Next 16. Sous ce flag :

- **Rien n'est caché par défaut.** Chaque lecture est dynamique tant qu'on ne la cache pas
  explicitement.
- Next prerend un **shell statique** servi immédiatement, pendant que le contenu dynamique streame
  (Partial Prerendering). Dans la table des routes : `○` statique, `◐` shell prerendu + streaming,
  `ƒ` dynamique.
- Le cache devient une propriété **de la fonction du DAL** (`'use cache'` + `cacheLife` + `cacheTag`)
  au lieu d'un choix binaire au niveau de la route.
- Trois accès deviennent **interdits dans un scope caché ou prerendu** : l'heure courante
  (`new Date()`, `Date.now()`), l'aléatoire (`Math.random()`, `crypto.randomUUID()`), et le contexte
  de requête (`headers()`, `cookies()`).
- `export const instant = false` est l'échappatoire officielle pour une route légitimement bloquante.
  Elle autorise à bloquer — **elle n'autorise pas** à lire l'horloge. Ce cas-là demande
  `await connection()`.

**Résultat mesuré sur le boilerplate**, à titre de repère : 42 routes `○`, 102 `◐`, 35 `ƒ`, et
3 `instant = false` restants dans tout `src/app`. Avant la migration : 25 routes prerendues.

## Les six pièges qui coûtent le plus cher

À lire avant de commencer. Chacun a coûté au moins une demi-journée sur le chantier d'origine.

1. **Le logger bloque tout le prerender.** L'intercepteur de services émet un log à chaque appel de
   méthode, et Winston horodate via `new Date()`. Comme toute page prerendue passe par une façade,
   le blocage est systémique. Une erreur de prerender qui pointe une page sans rapport : vérifier le
   logger avant de suspecter la page. (D8)
2. **`[locale]` doit être un root param, sinon rien n'est prerendu.** Un `src/app/layout.tsx`
   pass-through au-dessus de `[locale]` suffit à l'en empêcher. C'est la différence entre 25 et
   151 routes statiques. (D11)
3. **`next/root-params` n'existe pas dans les Server Actions ni les Route Handlers.** Il y jette. Le
   fallback doit être **paresseux**, sinon il s'évalue au prerender et casse tout. (D14)
4. **Un build vert ne prouve rien sans base de données.** Les lectures échouent en silence, le
   sitemap sort amputé, les chemins qui touchent la base ne sont jamais exercés. Un bug de prerender
   est resté invisible plusieurs heures pour cette seule raison. (D19, D21)
5. **Supprimer le layout racine emporte l'import de `globals.css`.** L'application a été livrée sans
   aucune feuille de style, et ni le build, ni tsc, ni 381 tests unitaires, ni 22 specs e2e ne l'ont
   vu. (D26)
6. **`forbidden()` ne rend pas un 403 sous streaming.** Toute route dynamique streame un shell
   d'abord : quand le contrôle s'exécute, le `200` est déjà parti. `instant = false` n'y change rien.
   (D20, D25)

---

## Phase A — Corriger ce qui bloquera, avant de toucher au flag

**Pourquoi d'abord** : ces points sont faux indépendamment de Next, et deux d'entre eux sont des
bloquants durs de la phase C. Cette phase a de la valeur même si la migration est annulée.

- [ ] **A1 — Éliminer l'aléatoire des chemins de rendu serveur**
      Chercher `Math.random()` et `crypto.randomUUID()` dans `src/app/dal`, `src/services` et les
      composants rendus au serveur. Sur le boilerplate : un `shuffleArray` sur les articles liés
      (`blog-dal.ts`) et une largeur aléatoire dans le skeleton de sidebar (`ui/sidebar.tsx`).
      **Les deux ont été supprimés, pas remplacés** — l'ordre naturel suffit, une largeur fixe
      suffit (D6). Une première version remplaçait le shuffle par une rotation déterministe dérivée
      d'un hash : rejetée comme sur-ingénierie.
      ⚠️ `src/components/ui/*` est dans les `globalIgnores` d'ESLint : le lint ne verra pas ce
      fichier, il faut grep.
      **Acceptation** : `rg -n "Math.random|crypto.randomUUID" src/app src/services src/components`
      → aucun résultat dans un chemin de rendu.

- [ ] **A2 — Faire remonter les erreurs du sitemap**
      Un `catch` → `console.error` retourne un sitemap amputé sans que rien n'échoue. C'est ce qui
      rendrait une régression SEO invisible pendant toute la migration.
      **Acceptation** : provoquer une erreur DAL et constater que le build échoue au lieu de
      produire un sitemap partiel.

- [ ] **A3 — `revalidateTag(tag, 'max')` → `updateTag(tag)` dans les Server Actions**
      `'max'` est du stale-while-revalidate avec expiration à un an : après une modification admin,
      les lecteurs voient l'ancienne valeur. Sur le boilerplate c'était un **bug actif** sur les
      prix publics. `updateTag` donne le read-your-writes et n'est autorisé qu'en Server Action.
      **Acceptation** : `rg -n "revalidateTag" src/app/**/actions.ts` → aucune occurrence avec
      `'max'` ; une modification de prix en admin se voit immédiatement sur la page publique.

- [ ] **A4 — `generateStaticParams` actif sur le layout de locale**
      S'il est commenté, `locale` devient un fallback param sur la majorité des pages, et **tous les
      hooks de route suspendent** en phase E. Sur le boilerplate il avait été commenté par dommage
      collatéral d'un refactor, sans raison documentée (D5).
      ⚠️ Vérifier d'abord **pourquoi** il a été désactivé chez vous. Si la raison réapparaît,
      marquer `[~]` et documenter.
      **Acceptation** : `pnpm build` vert, les 3 locales toujours générées, table de routes
      identique à la baseline.

- [ ] **A5 — Neutraliser le logger pendant le prerender de build**
      Ces logs sont du bruit de build. Un seul point de correction débloque toutes les pages.
      **À retenir** : le même problème peut réapparaître **au runtime** dans un scope `'use cache'`,
      où l'heure courante est également interdite.
      **Acceptation** : `rg -n "NEXT_PHASE" src/lib/logger.ts` → la garde existe ; le build ne
      produit plus de log d'intercepteur.

```ts
// src/lib/logger.ts
const isBuildPrerender = process.env.NEXT_PHASE === 'phase-production-build'
export const logger = isBuildPrerender ? noopLogger : /* … */
```

### Gate A (bloquant)

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build
```

Attendu : lint 0 warning, tsc 0 erreur, tests au vert au même nombre qu'en baseline, build exit 0,
**et la table des routes identique à la baseline**.

---

## Phase B — Le filet de sécurité

**Pourquoi** : le seul filet d'un projet Next est le build, et le cas du sitemap prouve qu'il reste
vert sur une régression. Toucher au modèle de rendu de dizaines de pages sans e2e est un pilotage à
l'aveugle.

- [ ] **B1 — Playwright contre le build de production**
      `webServer.command` devient `pnpm build && pnpm start` quand `CI=1`, `pnpm dev` sinon.
      Le shell statique et le streaming ne se comportent pas pareil en dev et en production : c'est
      précisément ce que ces tests doivent protéger. Timeout à 300 s (le build ne tient pas dans les
      60 s par défaut). Port configurable par `PLAYWRIGHT_PORT`.
      **Acceptation** : `CI=1 pnpm test:e2e --project=chromium` lance bien un build puis un start.

- [ ] **B2 — Isoler la base du serveur sous test**
      `pnpm start` charge `.env.production`. Si des specs créent un compte ou lisent le seed, elles
      écrivent **en base de production** quand on les lance en local. Imposer la `DATABASE_URL` de
      `.env.test` au serveur sous test depuis `playwright.config.ts`.
      **Acceptation** : lancer la suite en local ne crée aucune ligne dans la base de production.

- [ ] **B3 — Job e2e en CI avec un Postgres éphémère**
      Service `postgres:17` dans le job, healthcheck `pg_isready`, puis `db:push && db:seed` avant
      les tests. **Jamais la base de preview** : deux specs écrivent, une lit le seed (D7).
      **Acceptation** : le job passe sur la branche, rapport uploadé en artefact si échec.

- [ ] **B4 — Balayer le rendu des pages authentifiées**
      Les specs d'autorisation vérifient qui a le droit d'entrer ; rien ne vérifie que la page
      **rend** une fois entré. C'est le trou le plus coûteux sous Cache Components : le shell part
      en `200` avant que le contenu n'arrive, donc une page qui casse en cours de stream affiche
      une frontière d'erreur dans un document parfaitement valide, et aucune assertion de statut ne
      le voit.
      Écrire une spec qui parcourt toutes les routes authentifiées — compte, facturation, équipe,
      admin — et contrôle trois choses par page : pas de frontière d'erreur, pas d'erreur console,
      pas d'imbrication HTML invalide.
      Trois pièges à éviter dans cette spec, tous rencontrés : - **une session par groupe, en série.** Se reconnecter avant chaque page rend la suite
      instable sans rien tester de plus. - **ne pas attendre `networkidle`** : certaines pages émettent des requêtes périodiques et
      n'y arrivent jamais. - **ignorer les diagnostics propres au mode développement** (voir l'annexe « dev contre
      production »), sinon la suite est rouge en local et personne ne la lance.
      **Acceptation** : la spec passe trois fois d'affilée contre le build de production.

### Gate B (bloquant)

Toutes les specs e2e existantes passent contre le build de production, sur une base seedée.

---

## Phase C — Bascule mécanique

**Objectif** : l'application build et tourne sous `cacheComponents`, avec la validation différée
partout. Aucune route n'est encore convertie. C'est un état stable et mergeable.

- [ ] **C1 — Activer le flag**
      Dans `next.config.ts` : retirer `useCache: true` de `experimental`, ajouter
      `cacheComponents: true` **au niveau racine**. Garder `authInterrupts`, `taint`, et
      **`staleTimes`** : il survit à `cacheComponents` et alimente `cacheLife.default.stale`,
      vérifié dans les sources de Next (D3). Ce n'est pas un risque.
      **Acceptation** : le warning `experimental.useCache is deprecated` disparaît du build.

- [ ] **C2 — Codemod d'opt-out global**
      ⚠️ Bien passer `./src/app` pour un projet en `src/`. **Un mauvais chemin affiche `0 ok` sans
      échouer** : vérifier le nombre de fichiers touchés.
      ⚠️ Le codemod pose aussi l'export dans des fichiers qui ne sont pas des routes (un
      `base-layout.tsx` par exemple), où il est inerte : le retirer.
      **Acceptation** : `rg -l "export const instant = false" src/app | wc -l` ≈ nombre de pages +
      layouts.

```bash
npx @next/codemod@canary cache-components-instant-false ./src/app
```

- [ ] **C3 — Supprimer les route segment configs incompatibles**
      `export const dynamic = 'force-static'` et `export const dynamicParams = false` n'ont plus de
      sens sous Cache Components.
      **Acceptation** : `rg -n "export const dynamic\b|export const dynamicParams" src/app` → 0.

- [ ] **C4 — `generateStaticParams` ne doit jamais retourner `[]`**
      Un retour vide fait échouer le build (`empty-generate-static-params`). Attention aux cas
      **réels** : une boucle de pagination `for (page = 2; page <= totalPages)` ne s'exécute jamais
      avec peu de contenu, et les gardes de type `if (!isPageEnabled) return []`.
      Retourner au moins un param valide dans tous les cas — les paths non retournés restent servis.
      **Acceptation** : `pnpm build` sans erreur `empty-generate-static-params`.

- [ ] **C5 — Logout : rechargement complet**
      Sous `<Activity>`, l'état client est préservé entre navigations, **y compris à travers un
      changement d'authentification**. Remplacer `router.push('/login')` par
      `window.location.assign`, avec un `eslint-disable` justifié pour
      `@next/next/no-location-assign-relative-destination`.
      **Acceptation** : après logout puis retour arrière, aucun état de session ne subsiste.

### Gate C (bloquant)

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build && CI=1 pnpm test:e2e
```

**Plus deux contrôles manuels que le build ne fait pas :**

1. `curl localhost:3000/sitemap.xml` après `pnpm build && pnpm start` → doit contenir les URLs de
   contenu. Le build reste vert même si le sitemap est amputé.
2. Le nombre de routes prerendues est **≥ baseline**.

---

## Phase D — Le déblocage i18n (`next/root-params`)

**C'est la phase qui décide du rendement de toute la migration.** Sans elle, on peut poser autant de
`'use cache'` qu'on veut : les routes restent dynamiques. Sur le boilerplate, elle fait passer de 25
à 151 routes statiques.

> **Historique à ne pas refaire** : le chantier a d'abord conclu, sur la foi d'une issue GitHub lue
> dans un résultat de recherche, que next-intl ne supportait pas `cacheComponents` et que le
> bénéfice était inatteignable (D9, D10). **C'était faux.** L'issue était fermée, le mainteneur
> pointant `next/root-params` comme le fix. Deux décisions et une demi-journée perdues pour n'avoir
> pas ouvert l'issue. (D11)

- [ ] **D1 — Faire de `[locale]` un vrai root param**
      Supprimer `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/not-found.tsx` : c'est
      `[locale]/layout.tsx` qui devient le layout racine. Un simple pass-through
      `return children` au-dessus de `[locale]` suffit à empêcher la détection du root param.
      Déplacer `error.tsx` et `forbidden.tsx` de la racine vers `[locale]/`.
      Supprimer un éventuel catch-all `[locale]/[...rest]` qui ne servait qu'à compenser le
      `not-found` racine : vérifié au runtime, les routes inconnues rendent bien le 404 localisé
      sans lui.
      **Acceptation** : `pnpm exec next typegen` puis vérifier que `.next/types/root-params.d.ts`
      déclare `locale`. Le message « No root params detected » doit avoir disparu.

- [ ] **D2 — ⚠️ Restaurer l'import de `globals.css`**
      **Tâche la plus importante de cette phase.** L'import vivait dans le `layout.tsx` racine que
      D1 vient de supprimer. Sans lui, l'application est servie **sans aucune feuille de style**, et
      rien ne le signale : ni le build (un import CSS manquant n'est une erreur pour personne), ni
      tsc, ni les tests unitaires, ni les e2e — une assertion de DOM passe très bien sur une page
      sans styles. (D26)
      **Acceptation** : après `pnpm build && pnpm start`, `curl -s localhost:3000/en | rg
'_next/static.*\.css'` renvoie un lien, et ce fichier fait plusieurs dizaines de Ko.

```ts
// src/app/[locale]/layout.tsx
import '../globals.css'
```

- [ ] **D3 — Garde-fou permanent sur les styles**
      Ajouter une spec e2e qui, sur 3-4 routes, vérifie qu'une feuille `/_next/static` est présente
      **et** qu'une utilitaire Tailwind résout réellement (créer un `<div class="flex">` et lire
      `getComputedStyle().display`), plutôt que de faire confiance au `<link>`.
      **Acceptation** : validé par mutation — retirer l'import de D2 doit faire échouer la spec sur
      chaque route, le remettre doit tout remettre au vert.

- [ ] **D4 — `next/root-params` dans la config i18n, avec fallback paresseux**
      Trois subtilités, chacune payée d'une régression : - `root-params` **jette** dans les Server Actions et les Route Handlers. Le fallback est
      obligatoire. (D14) - Le fallback doit être **paresseux** : il ne s'évalue que si `root-params` a échoué, donc
      jamais pendant un prerender. - **Ne pas déstructurer `requestLocale` dans la signature** de `getRequestConfig` : next-intl
      le résout en amont via `headers()`, ce qui casse toute page portant `'use cache'`.
      **Acceptation** : `pnpm build` vert **et** — le build ne suffit pas ici — lancer
      `pnpm start` et exercer un formulaire qui passe par une Server Action traduite, en **lisant le
      log du serveur en direct**. Ni le build ni les e2e n'attrapent cette régression : les Server
      Actions ne sont jamais prerendues, et un test permissif passe quand même.

```ts
let paramValue: string | undefined
try {
  paramValue = await rootParams.locale()
} catch {
  const cookieStore = await cookies()
  paramValue = cookieStore.get('NEXT_LOCALE')?.value ?? routing.defaultLocale
}
```

- [ ] **D5 — Traiter les lectures d'horloge dans les composants partagés**
      Un `© {new Date().getFullYear()}` dans un footer interdit le prerender de **toute page qui
      contient le footer**. Le mettre en `'use cache'`, ou supprimer la valeur dynamique.
      **Acceptation** : la page d'accueil et les pages statiques repassent en `○`.

### Gate D (bloquant)

Gate C, plus : le nombre de routes `○` a **augmenté significativement** par rapport à la baseline,
et la spec de styles de D3 est au vert.

---

## Phase E — Conversion des routes publiques

**Pourquoi commencer là** : pas d'authentification, gain immédiat, risque faible. C'est ici qu'on
valide le pattern DAL avant de le généraliser.

Pour chaque route : retirer son `instant = false`, suivre les insights du dev overlay, cacher la
donnée dans **la fonction du DAL**, envelopper l'accès runtime dans `<Suspense>`. **Un commit par
route.**

- [ ] **E1 — Adopter la doctrine de cache (D4)**, résumée dans le tableau ci-dessous.
      `unstable_cache` n'est pas supprimé par Cache Components : la doc de migration dit
      explicitement que `fetch` et `unstable_cache` continuent de fonctionner comme une couche
      séparée (D2). C'est ce qui lève le risque sur les données qui doivent survivre à un
      déploiement — `'use cache'` est in-memory et repart froid à chaque déploiement et chaque
      instance serverless. `cache()` de React reste utile **en plus**, pour dédupliquer dans une
      même requête.
      **Acceptation** : la règle de cache du projet est réécrite et **plus simple** qu'avant. Si
      elle est plus compliquée, la migration a mal tourné.

| Type de donnée                                   | Mécanisme                                     | Où                   |
| ------------------------------------------------ | --------------------------------------------- | -------------------- |
| Lecture publique (blog, docs, plans)             | `'use cache'` + `cacheLife` + `cacheTag`      | fonction du DAL      |
| Donnée coûteuse devant survivre aux déploiements | `unstable_cache` **conservé**                 | fonction du DAL      |
| Donnée par utilisateur                           | ni l'un ni l'autre — `<Suspense>` + streaming | composant de la page |

- [ ] **E2 — Repérer les lectures d'horloge dans les chemins de lecture**
      Lister tous les accès à l'heure courante dans `src/services` et `src/app/dal`. La grande
      majorité est dans des chemins de **mutation** (`createdAt`, horodatage d'emails), exécutés en
      Server Action, donc jamais prerendus — sans risque. Ce sont les chemins de **lecture** qui
      casseront en entrant dans un scope `'use cache'`.
      Deux formes concrètes trouvées sur le boilerplate, dans des pages authentifiées que rien ne
      testait : `new Date(valeur ?? new Date())` — un repli qui fabrique une date quand la donnée
      n'en a pas, donc une information fausse en plus d'une lecture d'horloge — et un
      `const today = new Date()` en tête d'un composant serveur.
      ⚠️ **Un `suppressHydrationWarning` est un indice.** Il signale qu'on a masqué une divergence
      serveur/client au lieu d'en traiter la cause, et la cause est presque toujours une lecture
      d'horloge ou d'aléatoire.
      **Acceptation** : liste écrite, chaque entrée classée mutation ou lecture ; les lectures sont
      supprimées ou passent par un instant de référence caché.

- [ ] **E3 — Convertir les pages de contenu statique**
      **Acceptation** : ces routes repassent en `○`, avec leur profil de cache visible dans la
      sortie de build.

- [ ] **E4 — Convertir le DAL du blog**
      Piège spécifique : si le blog gère une **publication programmée** (un article daté dans le
      futur reste caché), le prédicat compare `publishDate <= new Date()` — donc lit l'horloge, donc
      interdit dans `'use cache'`. Trois options ont été pesées ; retenue : **cacher l'instant de
      référence** dans sa propre fonction `getPublicationCutoff()` avec `'use cache'` +
      `cacheLife('hours')`, et le passer en paramètre aux prédicats. La fonctionnalité est conservée
      avec une granularité horaire, ce qui correspond de toute façon à la précision d'une date de
      publication. (D15)
      Ne pas oublier `updateTag('blog')` dans l'action de revalidation : sans lui, une publication
      n'apparaîtrait qu'au bout du `cacheLife`.
      **Acceptation** : les routes blog en `○` ou `◐` selon les params, profil de cache visible, et
      **publier un article depuis l'admin le fait apparaître immédiatement** sur la page publique.

- [ ] **E5 — Convertir `sitemap.ts` et `robots.ts`**
      Ce sont des Special Route Handlers : **aucune échappatoire `instant` n'existe**, ils doivent
      être convertis. Supprimer les `lastModified: new Date()` — ils rendaient le sitemap dynamique
      **et** mentaient aux crawlers en annonçant tout comme modifié à chaque fetch. Le champ est
      optionnel, mieux vaut l'omettre.
      **Acceptation** : les deux en `○`, et le nombre d'URLs du sitemap est celui attendu.

- [ ] **E6 — Les hooks de route dans les layouts**
      `usePathname()` et consorts suspendent quand les params ne sont pas connus au prerender. Avec
      `generateStaticParams` réactivé (A4), la plupart ne posent plus de problème. Pour les autres,
      **pousser la lecture au composant feuille le plus bas** et l'envelopper d'un `<Suspense>`
      plutôt que de bloquer le layout.
      **Acceptation** : aucun layout ne bloque pour un hook de route.

### Gate E (bloquant)

Gate D, plus : aucune route publique ne porte encore `instant = false`, le sitemap contient toutes
les URLs, et la sortie de prerender ne régresse pas par rapport au Gate D.

---

## Phase F — L'authentification

**Le seul chantier réellement architectural.** À faire en dernier, quand le pattern est éprouvé.

> Il existe un **guide officiel dédié** :
> <https://nextjs.org/docs/app/guides/authentication-with-cache-components>.
> Le chantier d'origine a d'abord conclu que le cas était structurellement impossible (D16), sur la
> foi d'un symptôme de build et sans avoir lu ce guide. C'était faux (D17). Lire le guide **avant**
> de commencer cette phase.

- [ ] **F1 — Lecteur de session en `'use cache: private'`**
      `'use cache: private'` est la **seule directive autorisée à lire `cookies()` / `headers()`** ;
      le résultat est gardé côté navigateur, jamais sur le serveur, et ne survit pas à un
      rechargement.
      **`cacheLife` n'est pas décoratif** : sous 5 minutes de `stale`, le contenu sort de l'App Shell
      de la route et les navigations authentifiées cessent d'être instantanées ; sous 30 secondes,
      il sort carrément des prerenders. `minutes` donne `stale` 5 min, `revalidate` 1 min.
      **`getAuthUser()` reste intact** : c'est la vérité serveur, relue à chaque requête par les
      services, les Server Actions et l'autorisation. Le cache privé ne sert qu'à l'UI — sinon une
      identité gardée côté navigateur piloterait l'autorisation serveur.
      **Acceptation** : `rg -n "use cache: private" src/app/dal` → une seule occurrence, sur le
      lecteur de session ; aucun `cacheLife` implicite.

```ts
export const getCurrentUserDal = async (): Promise<CurrentUserContext> => {
  'use cache: private'
  cacheLife('minutes')
  const user = await getAuthUser()
  if (!user) redirect('/login')
  // …
}
```

- [ ] **F2 — Le layout ne fait plus `await` sur la session**
      Un `await` au niveau supérieur d'un layout tient **tout le segment**, `{children}` compris.
      **Un provider ne doit jamais suspendre** : il emporterait `{children}` avec lui. Les providers
      ne portent que la promesse et l'état client ; ce sont les **hooks** (`useAuth`,
      `useOrganization`) qui déroulent avec `use()`, chacun derrière son propre `<Suspense>`.
      **Les effets sortent dans des composants dédiés** (`UserPreferencesSync`, `OrganizationSync`)
      montés derrière un `<Suspense>`.
      **Acceptation** : les routes du groupe authentifié passent de bloquantes à `◐`.

```tsx
export default function AppLayout({children}) {
  const userPromise = getCurrentUserDal() // créée, jamais attendue
  return (
    <AuthProvider userPromise={userPromise}>
      <Suspense fallback={<SidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      {children}
    </AuthProvider>
  )
}
```

- [ ] **F3 — Gating grossier dans le proxy**
      `getSessionCookie` de Better Auth, **sans appel base** : pas de cookie sur les segments
      protégés → redirect `/{locale}/login`.
      C'est un **garde-fou de routage, pas une preuve** : la présence d'un cookie ne dit rien de sa
      validité. Il existe parce que sous streaming, un `redirect()` déclenché en cours de rendu part
      après le début d'un `200`. La sécurité réelle reste dans les Server Actions
      (`requireActionAuth()`) et les services.
      **Acceptation** : sans session, chaque segment protégé redirige vers `/login` **avant** le
      premier octet de contenu.

- [ ] **F4 — Données dérivées de la session**
      Le getter exporté résout l'utilisateur et passe **l'id** à une fonction **non exportée** en
      `'use cache'` + `cacheTag(\`x:${userId}\`)`. Ne pas exporter la fonction interne : un appelant
pourrait demander les données d'un autre utilisateur.
⚠️ Les clés de cache et les `cacheTag`sont stockés **en clair**. Jamais de secret ni de donnée
personnelle dedans : indexer sur un identifiant stable.
**Acceptation** :`rg -n "cacheTag" src/app/dal` → aucun tag ne contient d'email, de token ou
      de donnée personnelle.

- [ ] **F5 — Décider du contrôle de rôle, en connaissance de cause**
      **`forbidden()` ne rend pas de 403 sous Cache Components.** Toute route dynamique streame un
      shell d'abord ; quand le contrôle s'exécute, le statut est parti. Mesuré : une page admin
      visitée par un utilisateur standard rend **200** avec l'UI forbidden. Aucun contenu ne fuit —
      la protection fait son travail — mais le statut est faux. `instant = false` n'achète que le
      droit de bloquer, **jamais le statut**. (D20)
      **Ce que ça coûte vraiment** : moins qu'il n'y paraît. Les Route Handlers ne streament aucun
      shell et rendent de vrais `401` / `403`. La couche où un code de statut est réellement
      consommé — clients d'API, monitoring, intégrations — n'est pas touchée. (D25)
      **Arbitrage retenu sur le boilerplate** : proxy léger sans appel base + layout admin bloquant.
      Les deux alternatives — appel `auth.api.getSession()` dans le proxy, ou cookie cache Better
      Auth portant le rôle — font migrer les routes admin en plus, au prix d'un appel session par
      navigation ou d'un rôle potentiellement périmé. Mauvais échange par défaut ; à rouvrir pour un
      besoin explicite.
      **Acceptation** : une spec e2e qui asserte **volontairement** le statut réel constaté (`200`
      dans le cas du boilerplate). Le jour où le contrôle passe dans le proxy, le test tombe et le
      signale.

- [ ] **F6 — Justifier chaque `instant = false` restant, dans son fichier**
      Pas de TODO générique : la raison, écrite. Sur le boilerplate il en reste trois — layout admin
      (l'`await` de session en tête de layout, **vérifié en le retirant** : le build casse), et les
      deux pages du tunnel de paiement (prix, session et état Stripe : rien à prerendre).
      Un opt-out de layout couvre son segment : ne pas le répéter sur chaque page en dessous, ça ne
      change rien et ça périme.
      **Acceptation** : `rg -rn "instant = false" src/app` → chaque occurrence a sa raison écrite
      juste au-dessus, et retirer l'opt-out fait effectivement échouer le build.

### Gate F (bloquant)

- lint 0 erreur, tsc 0 erreur, tests unitaires au vert, build exit 0
- `rg -rn "instant = false" src/app` → chaque occurrence justifiée
- table des routes : le groupe authentifié est passé de bloquant à `◐`
- e2e vertes **sur le build de production**, base seedée
- parcours manuel : login, logout, accès refusé pour un rôle insuffisant, et changement de contexte
  (organisation) **suivi d'un rechargement** — le cache privé ne survivant pas à un reload, ce qui
  s'affiche après ne peut venir que de la session serveur (D23)

---

## Phase G — Garde-fous permanents

- [ ] **G1 — Refuser de builder sans base de données**
      `"build": "tsx scripts/preflight-build.ts && next build"`, le script lançant `db:check` et
      s'arrêtant net si la base ne répond pas, avec un message qui explique pourquoi. Échappatoire
      explicite `SKIP_DB_CHECK=1` pour les cas où l'absence de base est voulue (image Docker, CI sans
      Postgres). (D21)
      ⚠️ **À savoir avant de pousser** : si le secret `DATABASE_URL` de votre CI est lui aussi mort,
      le job de build passera au rouge — c'est le comportement voulu, autant le savoir à l'avance.
      **Acceptation** : `pnpm build` échoue explicitement avec une base injoignable, et passe avec
      `SKIP_DB_CHECK=1`.

- [ ] **G2 — Documenter les pièges pour les forks**
      Dans le README : le modèle de cache, l'obligation de garder `[locale]` root param, les routes
      volontairement bloquantes, l'interdiction d'horloge et d'aléatoire dans un scope caché. Et pour
      un Postgres local neuf : le schéma peut utiliser `uuid_generate_v4()`, il faut alors
      `CREATE EXTENSION "uuid-ossp"` **avant** `db:push`. Neon et Supabase l'activent par défaut, pas
      un serveur local. (D19)
      **Acceptation** : un développeur qui clone et suit le README arrive à un build vert.

- [ ] **G3 — Mettre à jour les règles internes**
      La règle de cache et la règle de sécurisation des routes doivent décrire le **code réel**.
      Vérifier au passage qu'elles ne décrivent pas des fichiers qui n'existent pas : celle du
      boilerplate décrivait un `src/middleware.ts` qui n'a jamais existé.
      Si le projet maintient **deux jeux de règles** (`.claude/rules` et `.cursor/rules`), les
      comparer fichier à fichier **en ignorant le frontmatter et le formatage** : sur le boilerplate,
      la copie Cursor de la règle d'architecture décrivait encore le DAL « avec react-cache » alors
      que la copie Claude était à jour. Une divergence de ce type suffit à faire écrire du code au
      mauvais pattern selon l'outil utilisé.
      **Acceptation** : chaque chemin de fichier cité dans les règles existe, et la comparaison des
      deux jeux ne montre plus que des différences de forme.

- [ ] **G4 — Auditer aussi la documentation livrée aux clients**
      Point le plus facile à oublier : les règles internes peuvent être parfaitement à jour pendant
      que la documentation publique enseigne encore l'ancien modèle. Sur le boilerplate, les pages
      d'architecture décrivaient toujours le DAL comme « cached reads with react-cache », avec des
      exemples de code à l'avenant — un agent qui lisait cette page écrivait au mauvais pattern.
      Chercher dans le contenu : `react-cache`, `useCache`, `force-static`, `dynamicParams`,
      `middleware.ts`, et toute description de la couche de cache.
      **Acceptation** : aucune de ces occurrences ne subsiste dans un sens périmé, et les exemples
      de DAL montrent `'use cache'` + `cacheLife` + `cacheTag`.

- [ ] **G5 — Automatiser le contrôle d'alignement**
      Les trois tâches précédentes ne tiennent que si quelque chose les rejoue. Un script — lancé
      en CI juste après le lint — vérifie mécaniquement : les chemins de fichiers cités dans les
      règles existent, l'index les liste toutes sans lien mort, les deux jeux de règles disent la
      même chose si le projet en maintient deux, et aucun terme périmé ne subsiste.
      Ce dernier point suppose de **lister, après chaque changement d'architecture, les termes que
      le changement rend faux**. C'est ce contrôle qui a trouvé un paragraphe qu'un audit manuel
      venait de laisser passer.
      **Acceptation** : le script échoue sur une règle volontairement désalignée, et passe une fois
      corrigée.

### Gate G — sortie de la partie 1

L'ensemble des Gates A→F tient, et un `pnpm build` produit une table de routes stable entre deux
exécutions consécutives, **avec et sans base joignable**.

---

# Partie 2 — Rendu MDX (blog + documentation)

Cette partie suppose un rendu MDX bâti sur `next-mdx-remote` + `@shikijs/rehype`, un mapping de
composants MDX, et le plugin `@tailwindcss/typography`.

> **Méthode imposée, et elle n'est pas négociable.** Une première tentative a été **entièrement
> revertée** parce qu'une dizaine de changements avaient été empaquetés dans deux commits : il était
> impossible de garder les bons et de jeter les mauvais. Les trois règles qui en découlent :
>
> 1. **Un changement par commit.**
> 2. **Vérifier en clair ET en sombre avant de passer au suivant.** Un correctif de fond de bloc de
>    code marchait en sombre et cassait en clair ; personne ne l'a vu.
> 3. **Pas de bidouille** : utiliser le mécanisme officiel de la librairie, ou ne rien faire.

## Phase H — Lisibilité du code (P0)

- [ ] **H1 — Shiki en dual-theme**
      Symptôme : le thème de coloration vient d'une source côté serveur (header, cookie) alors que
      l'interface suit `next-themes`. En clair, du code colorié pour un fond sombre est illisible ;
      et sur un blog qui n'envoie aucun thème, c'est figé.
      **Le mécanisme officiel est le dual-theme** : `themes: {light, dark}` + `defaultColor: false`
      dans les options de `rehypeShiki`. Shiki émet alors `--shiki-light` / `--shiki-dark` par
      token, et c'est le CSS qui tranche (voir le bloc ci-dessous).
      ⚠️ **Ne pas inventer de variable maison.** C'est la bidouille qui a été refusée.
      ⚠️ **Le mapping `pre` doit transmettre le `style` et la classe générés par Shiki.** S'il les
      jette pour appliquer ses propres classes, les variables n'atteignent jamais le HTML et le
      dual-theme ne sert à rien. C'est la cause racine n°1.
      **Acceptation** : la même page, sans rechargement, affiche un code lisible dans les deux
      thèmes ; `document.querySelector('pre.shiki').getAttribute('style')` contient
      `--shiki-light` et `--shiki-dark`.

<!-- prettier-ignore -->
```css
.shiki, .shiki span { color: var(--shiki-light); background-color: transparent; }
.dark .shiki, .dark .shiki span { color: var(--shiki-dark); }
```

- [ ] **H2 — Détacher le bloc de code du fond de page**
      ⚠️ **Le dual-theme seul ne suffit pas en clair** : `github-light` a un fond `#fff`, identique
      à celui de la page. Fonds réels mesurés, si vous préférez changer de thème plutôt que de fond :
      `github-dark` #24292e, `one-light` #FAFAFA, `catppuccin-latte` #eff1f5, `rose-pine-dawn`
      #faf4ed, `everforest-light` #fdf6e3, `snazzy-light` #FAFBFC — `min-light`, `vitesse-light` et
      `github-light` sont blancs.
      Choix retenu sur le boilerplate : le fond du conteneur vient du **design system** (`bg-muted`),
      Shiki ne colorant que les tokens. Une seule règle, cohérente dans les deux thèmes, sans
      appariement de palettes hasardeux.
      **Acceptation** : en clair comme en sombre, le bloc se distingue du fond de page sans dépendre
      de sa seule bordure.

- [ ] **H3 — Donner aux liens une couleur qui les distingue du texte**
      Sur une palette neutre type shadcn `stone`, `--primary` vaut **exactement** `--foreground` en
      sombre, et son quasi-jumeau en clair : les liens du contenu ont la couleur du texte, seul le
      soulignement les signale.
      Ajouter un jeton `--link` au design system (valeur claire et valeur sombre, exposé en
      `--color-link`), plutôt que de bricoler une couleur dans le mapping.
      **Acceptation** : dans les deux thèmes, un lien de contenu est visuellement distinct d'un mot
      en gras, contraste vérifié sur le fond réel.

## Phase I — Structure (P1)

- [ ] **I1 — Laisser `prose` styler le contenu au lieu de le doubler**
      Symptôme typique d'un mapping écrit avant l'ajout de `prose` : les deux se marchent dessus.
      Cas réels rencontrés — les paragraphes rendus en `<span class="block">`, donc **aucune balise
      `<p>` dans la page et tous les `prose-p:*` morts** ; les backticks de `prose-code` qui
      s'affichent sur le code inline ; les modificateurs `prose-a:` qui battent la classe posée sur
      le `<a>`.
      Supprimer du mapping tout ce que `prose` gère déjà : `p`, `ul`, `ol`, `li`, `blockquote`, `hr`,
      `thead`, `tbody`, `tr`, `th`, `td`. **Ne garder que ce qui demande un vrai comportement** : les
      titres (ancres du sommaire), `pre` (composant de bloc de code), `code` (détection de l'inline),
      `a` (lien interne), `img` (image optimisée), et `table` pour son conteneur scrollable.
      Ajouter `prose-code:before:content-none prose-code:after:content-none` pour neutraliser les
      backticks.
      **Acceptation** : `document.querySelectorAll('article p').length > 0` et
      `document.querySelectorAll('span.block').length === 0` ; aucun backtick affiché autour du code
      inline ; tableaux, listes et rythme vertical rendus par `prose`.

- [ ] **I2 — Détecter le code inline par son contenu, pas par sa longueur**
      Une heuristique du type « moins de 15 caractères » classe en bloc tout code inline un peu long.
      Le bon discriminant : **le code inline a une chaîne pour enfant**, celui d'un bloc porte les
      `<span>` produits par Shiki.
      **Acceptation** : un chemin de fichier long en code inline reste inline, un bloc reste un bloc.

- [ ] **I3 — Un seul rendu MDX pour le blog et la documentation**
      Deux `MDXRemote` séparés dérivent : listes de langages différentes, options différentes,
      wrappers `prose` différents pour le même mapping de composants. Extraire un composant unique.
      S'il porte un `await connection()` (voir K5), les appelants l'enveloppent d'un `<Suspense>`.
      **Acceptation** : `rg -n "MDXRemote" src` → une seule occurrence ; le blog et la doc rendent la
      même typographie.

## Phase J — Détails de rendu (P2)

- [ ] **J1 — Rendre aux titres le rythme de `prose`**
      Des tailles et marges en dur dans le mapping cassent l'échelle typographique. Ne garder que
      l'ancre (`id`) et le décalage de scroll (`scroll-mt-*`). Retirer aussi le filet de séparation
      sous le `h1` s'il fait doublon avec le titre de page.
      **Acceptation** : la hiérarchie des titres suit la même échelle que le corps du texte.

- [ ] **J2 — Afficher le langage et le bouton copier des blocs de code**
      ⚠️ **Shiki ne reporte pas le langage dans le HTML.** Un transformer qui lit
      `node.properties.lang` ne trouvera rien — c'est pour ça qu'aucun bloc n'a d'en-tête. Le
      langage n'est disponible que dans le contexte de compilation :
      Masquer les langages neutres (`text`, `plaintext`, `txt`, `ansi`), qui n'apportent rien.
      Rendre le bouton copier **visible au repos** plutôt que le faire surgir au survol.
      **Acceptation** : chaque bloc avec langage affiche son en-tête ; le bouton copier est visible
      sans survol et la copie fonctionne.

```ts
const exposeLanguage: ShikiTransformer = {
  name: 'expose-language',
  pre(node) {
    node.properties['data-language'] = this.options.lang
  },
}
```

- [ ] **J3 — Vérifier ce que déclarent les fences**
      Effet de bord utile de J2 : afficher le langage révèle les fences mal déclarés. Sur le
      boilerplate, **42 blocs annonçaient `typescript` alors qu'ils montrent du JSX** — la grammaire
      TypeScript ne connaît pas JSX, Shiki laissait donc balises et props sans couleur. Corrigés en
      `tsx`.
      Détection : pour chaque bloc `ts`/`typescript`/`js`/`javascript`, chercher `</Tag>`, `/>` en
      fin de ligne, ou une ligne commençant par `<Majuscule`.
      **Acceptation** : plus aucun bloc `ts`/`js` ne contient de JSX ; les balises sont colorées.

- [ ] **J3 bis — Remettre sur une ligne le contenu des balises JSX inline**
      Conséquence directe de I1, et elle ne se voit qu'à l'exécution. Une balise écrite sur
      plusieurs lignes dans du MDX — `<p className="…">` puis son texte à la ligne — voit son
      contenu **reparsé comme un bloc Markdown**, ce qui produit un second `<p>` à l'intérieur.
      Tant que le mapping rendait les paragraphes en `<span>`, l'imbrication était légale et les
      classes de la balise littérale étaient silencieusement perdues ; avec de vrais `<p>`, c'est
      du HTML invalide et une erreur d'hydratation.
      Chercher les `<p` ouverts seuls sur leur ligne dans tout le contenu MDX et ramener le texte
      sur la même ligne.
      **Acceptation** : sur chaque page du site, aucun `<p>` imbriqué dans un `<p>` ni bloc à
      l'intérieur d'un `<p>` — contrôle automatisable en parcourant le HTML rendu.

- [ ] **J4 — Rendre le curseur pointer aux éléments cliquables**
      **Tailwind v4 ne pose plus `cursor: pointer` sur `<button>`**, contrairement à la v3 : tout ce
      qui est cliquable sans être un `<a>` garde le curseur de texte — onglets, déclencheurs de
      dialog, boutons de la bibliothèque de composants. Une règle de base plutôt qu'un
      `cursor-pointer` répété partout :
      **Acceptation** : sur une page riche en composants, tous les boutons ont `cursor: pointer`, à
      l'exception assumée des poignées de redimensionnement.

```css
@layer base {
  button:not(:disabled),
  [role='button']:not(:disabled),
  [role='tab']:not(:disabled),
  [role='menuitem']:not(:disabled) {
    cursor: pointer;
  }
}
```

## Phase K — Sommaire, navigation, copie (P3 et bugs)

- [ ] **K1 — Reconstruire le sommaire depuis la source MDX**
      Un hook qui lit les titres dans le DOM au montage **ne marche plus dès que le contenu est
      streamé** : l'effet s'exécute avant l'arrivée du contenu, capture un DOM vide, et rien ne le
      relance — sommaire vide ou partiel selon le timing. Deux défauts secondaires courants : le
      sélecteur balaie tout le document, et il ramasse le `h1` alors que le titre de page en est un.
      Extraire les titres de la **source MDX** au rendu, avec **le même slug** que le mapping des
      titres (le partager dans un module commun), en excluant le niveau 1. Le sommaire passe alors du
      layout à la page, seule à connaître le contenu.
      Le hook ne garde que le suivi du titre courant ; comme les ancres peuvent arriver après lui,
      il doit **attendre leur apparition** plutôt que de renoncer.
      **Acceptation** : le sommaire est complet au premier rendu, rechargement compris ; le titre
      actif suit le défilement.

- [ ] **K2 — ⚠️ Le défilement doux ne marche pas dans ce layout**
      Vérifié dans les trois cas : `scrollIntoView({behavior:'smooth'})` laisse la page immobile,
      `scroll-behavior: smooth` en CSS aussi, et la navigation de hash de `next/link` ne défile pas
      non plus. Seule l'**ancre native** `<a href="#id">` en défilement instantané fonctionne (cause
      probable : les `overflow-x-hidden` du conteneur de sidebar).
      Supprimer les gestionnaires de clic et laisser le navigateur faire son travail ; le décalage
      sous un en-tête collant est assuré par `scroll-mt-*` sur les titres.
      **Acceptation** : cliquer une entrée du sommaire défile effectivement jusqu'au titre, qui
      s'arrête sous l'en-tête.

- [ ] **K3 — Navigation Précédent/Suivant**
      Si la structure de la documentation est déjà triée (par préfixes numériques de fichiers, par
      exemple), l'ordre de lecture est **entièrement dérivable** : aplatir l'arbre en profondeur,
      chercher l'index de la page courante, prendre ±1. Rien à maintenir à la main, une nouvelle page
      entre automatiquement dans la navigation.
      **Acceptation** : sur une page du milieu, les deux liens pointent les bonnes voisines ; sur la
      première et la dernière, un seul lien s'affiche.

- [ ] **K4 — Bouton « Copier la page »**
      Copier la **source Markdown**, titre en tête : c'est la forme utile pour la coller ailleurs —
      un agent, une issue, un message — là où le HTML rendu ne sert à rien.
      **Acceptation** : le bouton bascule visuellement en état copié, et le presse-papier contient le
      Markdown.

- [ ] **K5 — (partie 1 requise) Lever l'opt-out de prerender de la documentation**
      Une page de documentation portait `instant = false` pour deux raisons, **toutes deux levées par
      les phases précédentes** : le rendu du code ne dépend plus d'un header de thème (H1), et la
      compilation MDX lit l'horloge — ce que `await connection()` dans le composant de rendu marque
      explicitement comme rendu à la requête.
      ⚠️ **`<Suspense>` seul ne suffit pas** pour de l'IO synchrone : il faut `await connection()`.
      Il reste alors à isoler le rendu derrière un `<Suspense>` : le shell — titre, sommaire,
      navigation — se prerende, le contenu arrive en streaming.
      **Acceptation** : la route passe de `ƒ` à `◐` dans la sortie de build, et le build reste vert.

### Gate final (partie 2)

- `pnpm exec tsc --noEmit` et `pnpm lint` verts
- tests unitaires et e2e au même niveau qu'avant
- **revue visuelle en clair et en sombre** sur au moins : une page de doc avec blocs de code et
  onglets, une page de doc avec tableau, un article de blog
- un `pnpm build` vert, table de routes comparée à celle d'avant la partie 2

---

# Annexes

## Ce qu'un build vert ne prouve pas

Liste construite à partir des régressions réellement passées à travers les mailles sur ce chantier.
Chacune était invisible pour `next build`, `tsc`, les tests unitaires **et** les e2e.

| Régression                               | Ce qui l'a laissée passer                                                                                   | Ce qui l'aurait attrapée                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Application servie **sans aucun CSS**    | un import CSS manquant n'est une erreur pour personne ; une assertion de DOM passe sur une page sans styles | une spec qui vérifie qu'une utilitaire Tailwind **résout**       |
| Sitemap amputé                           | le `catch` avalait l'erreur, le build restait vert                                                          | faire remonter l'erreur (A2) + contrôle manuel du sitemap        |
| Bug de prerender sur l'horloge           | la base était morte, la lecture échouait **avant** d'atteindre le code fautif                               | préflight base (G1)                                              |
| `root-params` cassant les Server Actions | les Server Actions ne sont jamais prerendues ; le test concerné était permissif                             | lire le log de `next start` en direct après un changement d'i18n |
| Prix publics périmés après modif admin   | `revalidateTag` en stale-while-revalidate : techniquement correct                                           | parcours manuel admin → page publique                            |

## Dev contre production : lesquels de ces messages comptent

Sous Cache Components, le mode développement affiche dans la console des diagnostics que le build
de production n'émet pas. Les confondre avec des défauts fait perdre des heures ; les ignorer en
bloc fait rater de vrais problèmes. Le partage constaté :

| Message                                                                             | Ce que c'est                                                  | Compte-t-il ?                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| « encountered the unstable value `new Date()` » pointant l'intercepteur de services | le logger, qui horodate à chaque appel de méthode             | non en soi — mais le logger reste actif en dev, et c'est le piège n°1 |
| « encountered the unstable value » pointant un de vos composants                    | une vraie lecture d'horloge dans un chemin de rendu           | **oui**, à corriger                                                   |
| « uncached data during prerendering or a navigation »                               | une lecture non cachée hors `<Suspense>`                      | **oui**, c'est la promesse de navigation instantanée qui tombe        |
| « Encountered a script tag while rendering React component »                        | `next-themes` rend un `<script>` inline ; React 19 le signale | non, dépendance tierce, absent du build                               |

Le test décisif : **relancer contre `pnpm build && pnpm start`**. Ce qui disparaît était un
diagnostic de développement ; ce qui reste est un défaut.

⚠️ **Pour lancer les e2e en local**, les URLs d'authentification (`BETTER_AUTH_URL`,
`NEXT_PUBLIC_APP_URL`) doivent pointer le port réellement servi. Sur un autre port, les specs
d'authentification échouent en boucle sur un écran de chargement, ce qui ressemble à un bug de
l'application alors que c'est un problème d'environnement.

## Écrire un test qui vaut quelque chose

Trois enseignements du chantier, applicables au-delà.

- **Un test écrit pour couvrir une régression connue doit être validé en réintroduisant la
  régression.** Une première série de tests sur des identités mémoïsées passait au vert **avec** la
  régression réintroduite : le cas testé ne passait pas par le chemin fautif. Validé ensuite par
  mutation : `useMemo` retiré → 1 échec, `useCallback` retiré → 2 échecs.
- **Un test qui ne peut pas échouer pour la bonne raison ne vaut pas mieux que pas de test.** Une
  spec censée prouver le comportement de `<Activity>` a été **retirée** après trois tentatives : le
  dialog modal empêche de naviguer par l'UI, et passer par l'historique provoque un rechargement qui
  remet l'état à zéro — donc ne prouve rien.
- **Sous streaming, un bouton s'affiche avant d'être hydraté**, et un premier clic peut ne rien
  déclencher. Toute spec qui clique tôt sur une route `◐` doit réessayer
  (`await expect(...).toPass()`).

## Vérifier qu'on teste bien ce qu'on croit tester

Deux fois sur ce chantier, une mesure a mené à une conclusion fausse :

- un correctif jugé inopérant parce que le serveur local n'avait jamais redémarré — `EADDRINUSE`
  silencieux dans un log qui n'était pas lu ;
- des specs d'authentification en échec parce que le serveur tournait sur un autre port que celui
  déclaré dans `BETTER_AUTH_URL`, ce qui laissait l'interface bloquée sur « Chargement… ».

Avant de conclure qu'un correctif ne marche pas : vérifier quel processus répond, sur quel port, avec
quelle configuration.

## Table des décisions d'origine

Pour retrouver le raisonnement complet : `docs/plans/cache-components-migration.md`, section
« Journal de décisions ».

| Décision      | Sujet                                                     | Statut                    |
| ------------- | --------------------------------------------------------- | ------------------------- |
| D2            | `unstable_cache` survit à Cache Components                | acquis                    |
| D3            | `staleTimes` survit et alimente `cacheLife.default.stale` | acquis                    |
| D4            | Doctrine de cache hybride                                 | acquis                    |
| D5            | `generateStaticParams` du layout locale                   | acquis                    |
| D6            | Supprimer plutôt que remplacer                            | règle                     |
| D7            | Postgres éphémère en CI, jamais la preview                | acquis                    |
| D8            | Le logger bloquait tout le prerender                      | piège                     |
| D9, D10       | next-intl incompatible                                    | **faux**, corrigé par D11 |
| D11           | `[locale]` root param : 25 → 151 routes statiques         | acquis                    |
| D12, D13      | Opt-outs assumés (paiement, doc)                          | D13 levé depuis (K5)      |
| D14           | `root-params` casse les Server Actions                    | piège                     |
| D15           | Cacher le blog force à cacher l'horloge                   | acquis                    |
| D16           | Auth structurellement impossible                          | **faux**, corrigé par D17 |
| D17, D18      | Pattern officiel d'authentification                       | acquis                    |
| D19           | Bases mortes, e2e enfin lancées                           | piège                     |
| D20, D25      | Pas de 403 sous streaming, portée réelle                  | acquis                    |
| D21           | Préflight base avant build                                | garde-fou                 |
| D22, D23, D24 | Tests : mutation, bout en bout, spec retirée              | méthode                   |
| D26           | Application livrée sans CSS                               | piège                     |
