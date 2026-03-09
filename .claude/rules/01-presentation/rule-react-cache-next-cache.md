# React Cache vs Next.js Cache - Guide d'utilisation

## Vue d'ensemble

Cette application utilise deux systèmes de cache différents selon le contexte et le type de données.

## React `cache()`

### Utilisation

```typescript
import {cache} from 'react'

export const getUserData = cache(async (userId: string) => {
  const user = await getAuthUser() // Fonction d'autorisation
  return await getUserService(userId)
})
```

### Caractéristiques

- **Portée** : Cache au niveau de la requête HTTP uniquement
- **Durée** : Pendant la durée de la requête/rendu
- **Déduplication** : Évite les appels multiples dans la même requête
- **Compatibilité** : Fonctionne avec toutes les fonctions (dynamiques ou statiques)

### Quand l'utiliser

- ✅ Données dépendantes de l'utilisateur
- ✅ Fonctions appelant `getAuthUser()` ou d'autres autorisations
- ✅ Pages utilisant `headers()`, `cookies()`, `searchParams`
- ✅ Déduplication d'appels dans la même requête

## Next.js `unstable_cache()`

### Utilisation

```typescript
import {unstable_cache} from 'next/cache'

export const getAllCategoriesDal = unstable_cache(
  async (): Promise<CategoryDTO[]> => {
    return await getAllCategoriesPublicService()
  },
  ['all-categories'],
  {
    tags: ['categories'],
    revalidate: 3600, // 1 heure
  }
)
```

### Caractéristiques

- **Portée** : Cache persistant entre toutes les requêtes
- **Durée** : Selon la configuration `revalidate`
- **Invalidation** : Via tags avec `revalidateTag()`
- **Performance** : Cache partagé au niveau application

### Quand l'utiliser

- ✅ Données statiques/globales (catégories, configurations)
- ✅ Fonctions **sans autorisation** (services "Public")
- ✅ Pages complètement statiques
- ❌ **JAMAIS** avec `getAuthUser()` ou fonctions d'autorisation
- ❌ **JAMAIS** sur pages avec `headers()`, `cookies()`, `searchParams`

## Convention dans cette application

### Services "Public" - Éligibles pour `unstable_cache`

Les services nommés avec le suffixe **"Public"** sont spécialement conçus pour être mis en cache :

```typescript
// ✅ Peut être mis en cache Next.js
getAllCategoriesPublicService()
getPublishedPostsPublicService()
getConfigPublicService()
```

**Caractéristiques des services Public** :

- N'appellent **jamais** `getAuthUser()`
- Pas de vérifications d'autorisation
- Retournent des données publiques/globales
- Conçus pour être statiques

### Services avec autorisation - Utiliser `cache()`

```typescript
// ❌ Ne JAMAIS mettre en cache Next.js
getUserPostsService() // Appelle getAuthUser()
getPrivateDataService() // Vérifications d'autorisation
```

## Exemples pratiques

### ✅ Bon usage - Données publiques

```typescript
// DAL avec Next.js cache
export const getAllCategoriesDal = unstable_cache(
  async () => await getAllCategoriesPublicService(),
  ['categories'],
  {tags: ['categories'], revalidate: 3600}
)
```

### ✅ Bon usage - Données utilisateur

```typescript
// DAL avec React cache
export const getUserPostsDal = cache(async (userId: string) => {
  await getAuthUser() // Vérification autorisation
  return await getUserPostsService(userId)
})
```

### ❌ Mauvais usage

```typescript
// ❌ ERREUR : Service avec autorisation en cache Next.js
export const getUserDataDal = unstable_cache(
  async (userId: string) => {
    await getAuthUser() // Rendra la page dynamique !
    return await getUserService(userId)
  },
  ['user-data'], // Ce cache ne fonctionnera jamais
  {revalidate: 3600}
)
```

## Invalidation du cache

### React cache

```typescript
// Pas d'invalidation nécessaire - automatique à chaque requête
```

### Next.js cache

```typescript
import {revalidateTag} from 'next/cache'

// Invalider le cache des catégories
revalidateTag('categories')

// Invalider plusieurs caches
revalidateTag('posts')
revalidateTag('categories')
```

## Résumé des règles

1. **Services "Public"** → `unstable_cache()` dans le DAL
2. **Services avec autorisation** → `cache()` dans le DAL
3. **Pages dynamiques** → Toujours `cache()`, jamais `unstable_cache()`
4. **Données globales/statiques** → `unstable_cache()` avec tags
5. **Déduplication simple** → `cache()` suffit

## Pattern recommandé dans le DAL

```typescript
// Pour données publiques
export const getPublicDataDal = unstable_cache(
  async () => await getPublicDataService(),
  ['public-data'],
  {tags: ['public'], revalidate: 3600}
)

// Pour données utilisateur
export const getUserDataDal = cache(async (userId: string) => {
  await checkAuthorization(userId)
  return await getUserDataService(userId)
})
```

## Next.js `unstable_cache()` avec paramètres dynamiques

### Règle importante pour les clés de cache avec ID

Quand vous utilisez `unstable_cache` avec des paramètres dynamiques (comme un ID), **toujours inclure le paramètre dans la clé de cache** :

```typescript
// ✅ CORRECT - Clé de cache avec ID
export const getPlanByPriceId = (priceId: string) =>
  unstable_cache(
    async (): Promise<PlanDTO | undefined> => {
      return getPlanByPriceIdPublicService(priceId)
    },
    ['plan-by-price-id', priceId], // ✅ Clé unique par priceId
    {
      tags: ['plans'],
      revalidate: 3600,
    }
  )()

// ❌ INCORRECT - Clé de cache sans ID
export const getPlanByPriceId = unstable_cache(
  async (priceId: string) => {
    return getPlanByPriceIdPublicService(priceId)
  },
  ['plan-by-price-id'], // ❌ Tous les priceId partageraient le même cache
  {tags: ['plans'], revalidate: 3600}
)
```

### Pourquoi cette règle ?

- **Sans l'ID** : Tous les appels `getPlanByPriceId('price_123')` et `getPlanByPriceId('price_456')` partageraient le même cache
- **Avec l'ID** : Chaque priceId a son propre cache : `['plan-by-price-id', 'price_123']`, `['plan-by-price-id', 'price_456']`

### Pattern pour fonctions avec paramètres

```typescript
// Pattern recommandé pour unstable_cache avec paramètres
export const getItemById = (id: string) =>
  unstable_cache(async () => getItemPublicService(id), ['item-by-id', id], {
    tags: ['items'],
    revalidate: 3600,
  })()

export const getUserPosts = (userId: string, category: string) =>
  unstable_cache(
    async () => getUserPostsPublicService(userId, category),
    ['user-posts', userId, category],
    {tags: ['posts'], revalidate: 1800}
  )()
```
