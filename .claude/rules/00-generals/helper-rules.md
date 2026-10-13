---
paths: src/lib/**
---

# Règle - Organisation des Fichiers Helper/Utils Isomorphiques

## Principe Général

Les fichiers helper et utils doivent être **le plus possible isomorphiques** (compatibles front/back). Cela permet une meilleure réutilisabilité du code et évite la duplication de logique.

## Règles d'Organisation

### ✅ Cas Acceptables

1. **Helper purement isomorphique** : Code compatible client et serveur

   ```typescript
   // ✅ utils/date.ts - Fonctionne partout
   export const formatDate = (date: Date): string => {
     return date.toLocaleDateString('fr-FR')
   }
   ```

2. **Helper spécifique serveur** : Code exclusivement serveur

   ```typescript
   // ✅ helpers/auth.server.ts - Serveur uniquement
   import 'server-only'
   export const validateServerToken = (token: string) => { ... }
   ```

3. **Helper spécifique client** : Code exclusivement client
   ```typescript
   // ✅ helpers/dom.client.ts - Client uniquement
   export const getElementPosition = (el: HTMLElement) => { ... }
   ```

### ⚠️ Cas Problématique

**Helper non-isomorphique utilisé dans les 2 environnements** :

```typescript
// ❌ PROBLÈME : Mélange code client/serveur dans le même fichier
export const blogHelper = {
  // Code commun
  generateSlug: (title: string) => { ... },

  // Code serveur uniquement
  readMDXFile: (path: string) => fs.readFileSync(path),

  // Code client uniquement
  saveToLocalStorage: (data: any) => localStorage.setItem(...)
}
```

## Solution : Pattern de Splitting

### 🔧 Exemple Concret : métadonnées SEO

Référence : [resolve-metadata.ts](src/lib/seo/resolve-metadata.ts), [public-metadata.ts](src/lib/seo/public-metadata.ts)

#### 1. **Fichier Commun** : `resolve-metadata.ts`

```typescript
// Types et fonctions pures : aucune dépendance au serveur ni au navigateur
export type ResolvedSeo = { ... }

export const resolvePageSeo = (page, association, options) => { ... }
export const toPageMetadata = (seo, associationName, options) => { ... }
```

#### 2. **Fichier Serveur** : `public-metadata.ts`

```typescript
import 'server-only'

import {getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'

import {ResolvedSeo, toPageMetadata} from './resolve-metadata'

// Lit l'association du domaine appelé, puis délègue au code commun
export const publicPageMetadata = async (resolve, options) => { ... }
```

Le fichier serveur porte `import 'server-only'`. Écrit avant la convention de
nommage ci-dessous, il n'a pas le suffixe `.server.ts` : un nouveau fichier le
prend. Le dépôt n'a aujourd'hui aucun helper client séparé (`.client.ts`).

## Convention de Nommage

### Structure des Fichiers

```
src/lib/helper/
├── feature.ts          # Code isomorphique commun
├── feature.server.ts   # Code spécifique serveur
└── feature.client.ts   # Code spécifique client
```

### Suffixes Obligatoires

- **`.server.ts`** : Code serveur uniquement (avec `import 'server-only'`)
- **`.client.ts`** : Code client uniquement
- **`.ts`** : Code isomorphique (sans suffixe)

## Imports et Utilisation

### ✅ Bonnes Pratiques

```typescript
// Dans un Server Component
import {publicPageMetadata} from '@/lib/seo/public-metadata'
import {resolvePageSeo} from '@/lib/seo/resolve-metadata'

// Dans un Client Component : le code commun seulement
import {excerptOf} from '@/lib/seo/resolve-metadata'
```

### ❌ Éviter

```typescript
// ❌ Import serveur dans du code client
import {publicPageMetadata} from '@/lib/seo/public-metadata' // ERREUR
```

## Checklist de Refactorisation

### 🔍 **Quand Splitter un Helper ?**

- [ ] Le fichier contient du code `fs`, `path`, ou autres APIs Node.js ?
- [ ] Le fichier utilise `window`, `document`, `localStorage` ?
- [ ] Le fichier est importé à la fois côté client ET serveur ?
- [ ] Les fonctions ont des comportements différents selon l'environnement ?

### 🛠️ **Étapes de Splitting**

- [ ] Identifier le code vraiment isomorphique
- [ ] Extraire les types/interfaces dans le fichier commun
- [ ] Déplacer le code serveur vers `.server.ts`
- [ ] Déplacer le code client vers `.client.ts`
- [ ] Ajouter `import 'server-only'` dans les fichiers serveur
- [ ] Mettre à jour tous les imports

### ✅ **Validation**

- [ ] Le fichier commun ne contient que du code isomorphique
- [ ] Pas d'erreur de build côté client/serveur
- [ ] Les imports sont corrects dans tous les contextes
- [ ] La logique métier n'est pas dupliquée

## Avantages de cette Approche

### 🚀 **Performance**

- Bundles client plus légers (pas de code serveur)
- Tree-shaking optimisé
- Pas de polyfills inutiles

### 🔒 **Sécurité**

- Code serveur protégé par `server-only`
- Pas de fuite de logique backend vers le client
- APIs sensibles isolées

### 🧹 **Maintenabilité**

- Séparation claire des responsabilités
- Code réutilisable maximisé
- Pas de conditions `if (typeof window !== 'undefined')`

**Objectif** : Code propre, performant et sécurisé avec une réutilisabilité maximale.
