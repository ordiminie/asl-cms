# Cache sous Cache Components

## Vue d'ensemble

Le projet tourne sous `cacheComponents: true` (Next 16). **Rien n'est caché par défaut** : chaque
lecture est dynamique tant qu'on ne la cache pas explicitement.

Le cache est une propriété **de la fonction du DAL**, pas de la route. C'est ce qui rend la règle
plus simple qu'avant : il n'y a plus à choisir entre deux systèmes selon que le service touche
l'authentification ou non.

## Les trois cas

| Type de donnée                          | Mécanisme                                  | Où                   |
| --------------------------------------- | ------------------------------------------ | -------------------- |
| Lecture publique (blog, docs, plans)    | `'use cache'` + `cacheLife` + `cacheTag`   | fonction du DAL      |
| Donnée devant survivre aux déploiements | `unstable_cache` conservé                  | fonction du DAL      |
| Donnée par utilisateur                  | ni l'un ni l'autre — `<Suspense>` + stream | composant de la page |

### 1. Lecture publique — `'use cache'` dans le DAL

```ts
export const getAllBlogCategoriesDal = cache(async (locale: string) => {
  'use cache'
  cacheLife('days')
  cacheTag('blog')

  return getAllCategoriesPublicService(locale)
})
```

Invalidation depuis une Server Action :

```ts
import {updateTag} from 'next/cache'

updateTag('blog') // read-your-writes : l'utilisateur voit son changement tout de suite
```

`revalidateTag(tag, profil)` existe aussi, mais c'est du **stale-while-revalidate** : les lecteurs
voient l'ancienne valeur pendant le rafraîchissement. Pour une modification que l'utilisateur doit
voir immédiatement (un tarif, un article publié), utiliser `updateTag`.

### 2. Donnée durable — `unstable_cache` conservé

`'use cache'` est **in-memory** : il repart froid à chaque déploiement et sur chaque nouvelle
instance serverless. Pour une donnée coûteuse à recalculer et stable dans le temps — typiquement les
plans Stripe — `unstable_cache` reste le bon choix, car il persiste entre déploiements.

Voir `subscription-dal.ts`.

### 3. Donnée par utilisateur — `<Suspense>`

Pas de cache. Le composant qui lit la session est isolé pour que le reste de la page se prerende :

```tsx
<Suspense fallback={<Button disabled>&nbsp;</Button>}>
  <ButtonConnexionDashboard />
</Suspense>
```

## Interdits dans un scope `'use cache'`

Ces accès font échouer le prerender. La liste vient de cas réellement rencontrés pendant la
migration :

| Interdit                               | Symptôme                              | Solution                                 |
| -------------------------------------- | ------------------------------------- | ---------------------------------------- |
| `new Date()`, `Date.now()`             | `blocking-prerender-current-time`     | cacher la valeur dans sa propre fonction |
| `Math.random()`, `crypto.randomUUID()` | idem                                  | rendre déterministe, ou supprimer        |
| `headers()`, `cookies()`               | `next-request-in-use-cache`           | lire en dehors et passer en argument     |
| Compilation MDX (`MDXRemote` + Shiki)  | `Date.now()` en frames ignore-listées | `<Suspense>` **+** `await connection()`  |

⚠️ **`<Suspense>` seul ne suffit pas** pour l'IO synchrone. La doc est explicite et on l'a vérifié :
`instant = false` et `<Suspense>` ne neutralisent pas une erreur d'IO synchrone au prerender. Il faut
`await connection()` pour marquer le sous-arbre comme rendu à la requête.

Exemple, `blog-article.tsx` :

```tsx
async function ArticleContent({content}: {content: string}) {
  await connection()
  return <MDXRemote source={content} ... />
}
```

## Routes bloquantes assumées

Une route légitimement dépendante de la requête porte `export const instant = false` **avec la raison
écrite dans le fichier**, jamais un TODO générique.

Cas actuels :

- les 39 routes `(app)` et `admin` — le layout lit la session et la passe à `AuthProvider`, qui
  enveloppe tout l'arbre : aucun enfant à isoler
- `checkout/*` — prix, session, état Stripe
- `docs/[...slug]` — lit `x-theme` pour la coloration Shiki

## Le piège du logger

L'intercepteur de services émet un `logger.info` à **chaque appel de méthode**, et Winston horodate
via `new Date()`. Sous Cache Components, ça bloque le prerender de toute page passant par une façade
— c'est-à-dire presque toutes. Le logger est neutralisé pendant `NEXT_PHASE=phase-production-build`
(`src/lib/logger.ts`).

Si une erreur de prerender pointe une page qui semble sans rapport, **vérifier le logger avant de
suspecter la page**.

## React `cache()`

Toujours utile, et complémentaire : il déduplique les appels **dans une même requête**. Les fonctions
du DAL le gardent en plus de `'use cache'`.
