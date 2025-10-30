# Migration Next.js 16 - Documentation Complète

## Vue d'ensemble

Cette documentation détaille la migration du projet de **Next.js 15.5.4** vers **Next.js 16.0.1**, incluant tous les breaking changes, les corrections et les optimisations nécessaires.

**Branche de migration:** `migration/nextjs-16`

---

## 1. Changements de dépendances

### Mise à jour des packages

```bash
# Next.js
next: 15.5.4 → 16.0.1

# React & React DOM
react: 19.0.0-rc-66ef85e7f-20240904 → 19.2.0
react-dom: 19.0.0-rc-66ef85e7f-20240904 → 19.2.0

# next-intl
next-intl: 4.0.24 → 4.4.0

# TypeScript
typescript: 5.6.3 → 5.8.3

# ESLint
eslint: 9.6.0 → 9.38.0

# Nouvelles dépendances ESLint
@typescript-eslint/eslint-plugin: ^7.0.0
eslint-plugin-react: ^7.0.0
```

### Installation

```bash
pnpm install
```

---

## 2. Breaking Changes et Corrections

### 2.1 Renommage: `middleware.ts` → `proxy.ts`

**Fichier affecté:** `src/proxy.ts` (ancien `src/middleware.ts`)

**Changement:**

```bash
git mv src/middleware.ts src/proxy.ts
```

**Raison:** Next.js 16 renomme `middleware.ts` en `proxy.ts` pour la edge runtime.

**Contenu du fichier:** Reste inchangé, c'est uniquement un renommage de fichier.

---

### 2.2 API `revalidateTag()` - Paramètre obligatoire

**Fichier affecté:** `src/app/[locale]/admin/plans/actions.ts`

**Changement:**

```typescript
// AVANT (Next.js 15)
revalidateTag('plans')

// APRÈS (Next.js 16)
revalidateTag('plans', 'max')
```

**Raison:** Next.js 16 introduit le paramètre `cacheLife` qui spécifie le profil de revalidation ('max' pour maximal).

**Instances corrigées:** 4 appels dans `src/app/[locale]/admin/plans/actions.ts`

---

### 2.3 Refactorisation des Service Interceptors (Pattern Proxy)

**Fichiers affectés:** 10 fichiers d'intercepteurs

```
src/services/facades/interceptors/
├── admin-dashboard-service-logger-interceptor.ts
├── create-service-interceptor.ts (NOUVEAU)
├── email-service-logger-interceptor.ts
├── file-service-logger-interceptor.ts
├── notification-service-logger-interceptor.ts
├── organization-service-logger-interceptor.ts
├── post-service-logger-interceptor.ts
├── project-service-logger-interceptor.ts
├── subscription-service-logger-interceptor.ts
└── user-service-logger-interceptor.ts
```

**Changement:**

```typescript
// AVANT (Pattern Proxy - Incompatible avec Turbopack)
const interceptor = new Proxy(serviceMethods, {
  get(target, property) {
    // logic...
  },
})
export default interceptor

// APRÈS (Factory Function - Compatible avec Turbopack)
const interceptor = createServiceInterceptor(serviceMethods, 'SERVICE-NAME')
export default interceptor
```

**Raison:** Turbopack (le bundler par défaut de Next.js 16) ne peut pas sérialiser les objets Proxy. Une factory function est utilisée à la place.

**Nouveau fichier:** `src/services/facades/interceptors/create-service-interceptor.ts`

```typescript
export function createServiceInterceptor<T extends Record<string, unknown>>(
  serviceMethods: T,
  serviceName: string
): T {
  const wrapped: Record<string, unknown> = {}
  for (const [key, method] of Object.entries(serviceMethods)) {
    if (typeof method === 'function') {
      wrapped[key] = async (...args: unknown[]) => {
        logger.info(`[${serviceName}] Appel de la méthode ${key}`)
        try {
          const result = await (method as Function)(...args)
          logger.info(`[${serviceName}] Retour de la méthode ${key}`)
          return result
        } catch (error) {
          logger.error(`[${serviceName}] Erreur dans ${key}:`, error)
          throw error
        }
      }
    } else {
      wrapped[key] = method
    }
  }
  return wrapped as T
}
```

---

### 2.4 Sonner Toaster - Lazy Loading

**Fichier affecté:** `src/components/ui/sonner.tsx`

**Changement:**

```typescript
// AVANT
export {Toaster} from 'sonner'

// APRÈS
import dynamic from 'next/dynamic'

const Toaster = dynamic(() => Promise.resolve(SonnerToaster), {
  ssr: false,
})

export {Toaster}
```

**Raison:** Évite les problèmes de contexte pendant le prerendering et l'hydratation.

---

### 2.5 Page Not Found - Marquage Client Component

**Fichier affecté:** `src/components/not-found.tsx`

**Changement:**

```typescript
// AVANT
import {useTranslations} from 'next-intl'

export default function NotFoundComponent() {
  const t = useTranslations('NotFoundPage')
  // ...
}

// APRÈS
;('use client')

import {useTranslations} from 'next-intl'

export default function NotFoundComponent() {
  const t = useTranslations('NotFoundPage')
  // ...
}
```

**Raison:** Les hooks contexte doivent être dans des client components pour éviter les erreurs lors du prerendering.

---

## 3. Corrections React 19 Strict Rules

Next.js 16 + React 19 activent par défaut des règles ESLint strictes. Les corrections suivantes ont été apportées:

### 3.1 JSX dans try/catch

**Fichier affecté:** `src/app/[locale]/(app)/account/invitations/[id]/page.tsx`

**Changement:**

```typescript
// AVANT (erreur React 19)
try {
  const invitation = await auth.api.getInvitation({...})
  return <div>...</div>
} catch (error) {
  // ...
}

// APRÈS (correct)
let invitation
try {
  invitation = await auth.api.getInvitation({...})
} catch (error) {
  // error handling
}
return <div>...</div>
```

**Raison:** React ne peut pas capturer les erreurs de JSX rendu dans un try/catch. Le JSX doit être rendu après le try/catch.

---

### 3.2 Fonctions impures dans le render

**Fichier affecté:** `src/app/[locale]/(public)/blog/layout.tsx`

**Changement:**

```typescript
// AVANT (erreur React 19)
categories.map((category) => (
  <Badge>{Math.floor(Math.random() * 10) + 1}</Badge>
))

// APRÈS (correct)
categories.map((category, index) => (
  <Badge>{index + 1}</Badge>
))
```

**Raison:** `Math.random()` est une fonction impure. React 19 en strict mode l'interdit pendant le render.

---

### 3.3 setState synchrone dans useEffect

**Fichiers affectés:**

- `src/components/features/chat/message-content.tsx`
- `src/components/hooks/use-unread-notifications.ts`

**Changement pour message-content.tsx:**

```typescript
// AVANT (erreur React 19)
useEffect(() => {
  if (!isStreaming && content) {
    setFrozenContent(content)
    setShouldRenderMarkdown(true)
  }
}, [isStreaming, content])

// APRÈS (correct - state dérivé)
const [frozenContent, setFrozenContent] = useState('')
const prevIsStreamingRef = useRef(isStreaming)

useEffect(() => {
  if (prevIsStreamingRef.current && !isStreaming && content) {
    setFrozenContent(content)
  }
  prevIsStreamingRef.current = isStreaming
}, [isStreaming, content])

const shouldRenderMarkdown = frozenContent !== '' || hasClosedCodeBlocks
```

**Changement pour use-unread-notifications.ts:**

```typescript
// Utilisation de useRef pour tracker les notifications
const notificationsRef = useRef(user?.notifications)

useEffect(() => {
  notificationsRef.current = user?.notifications
}, [user?.notifications])

useEffect(() => {
  if (notificationsRef.current) {
    const unreadNotifications = notificationsRef.current.filter(
      (notification) => !notification.read
    )
    const newCount = unreadNotifications.length
    setUnreadCount((prev) => (prev !== newCount ? newCount : prev))
  }
}, [user?.notifications])
```

**Raison:** setState synchrone dans useEffect cause des re-rendus en cascade. Utiliser du state dérivé ou des refs pour éviter cela.

---

## 4. Configuration ESLint Flat Config

**Fichier affecté:** `eslint.config.mjs`

**Changements:**

- Migration vers ESLint 9 Flat Config format
- Ajout des plugins React et TypeScript
- Configuration basée sur le template officiel Next.js
- Ajout de règles personnalisées pour le projet

### Structure de la configuration:

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
// ... autres plugins

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([...]),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      react,
      // ... autres plugins
    },
    rules: {
      // Règles personnalisées
    }
  },
  // ... autres configurations
]);

export default eslintConfig;
```

### Plugins ajoutés:

- `@typescript-eslint/eslint-plugin`
- `eslint-plugin-react`
- `eslint-plugin-drizzle`
- `eslint-plugin-promise`
- `eslint-plugin-simple-import-sort`
- `eslint-plugin-unicorn`

---

## 5. Comportements par défaut Next.js 16

### Dynamic Rendering par défaut

**Important:** Next.js 16 rend **tout dynamique par défaut**. Les pages statiques doivent être explicitement configurées.

**Pour générer des pages statiques:**

```typescript
export const dynamic = 'force-static'
```

**Pour utiliser l'ISR (Incremental Static Regeneration):**

```typescript
export const revalidate = 3600 // 1 heure
```

Ou utiliser `revalidateTag()` avec les tags correspondants.

---

## 6. Fichiers Modifiés - Liste Complète

### Configuration & Build

- `package.json` - Mise à jour des dépendances
- `pnpm-lock.yaml` - Lock file mis à jour
- `tsconfig.json` - Configuration TypeScript
- `eslint.config.mjs` - Configuration ESLint (Flat Config)
- `playwright.config.ts` - Configuration tests E2E
- `.claude/plugin.json` - Configuration MCP

### Core Files

- `src/proxy.ts` (anciennement `src/middleware.ts`)
- `src/app/[locale]/base-layout.tsx` - Layout restructuré

### Services & Interceptors

- `src/services/facades/interceptors/create-service-interceptor.ts` (NOUVEAU)
- `src/services/facades/interceptors/admin-dashboard-service-logger-interceptor.ts`
- `src/services/facades/interceptors/email-service-logger-interceptor.ts`
- `src/services/facades/interceptors/file-service-logger-interceptor.ts`
- `src/services/facades/interceptors/notification-service-logger-interceptor.ts`
- `src/services/facades/interceptors/organization-service-logger-interceptor.ts`
- `src/services/facades/interceptors/post-service-logger-interceptor.ts`
- `src/services/facades/interceptors/project-service-logger-interceptor.ts`
- `src/services/facades/interceptors/subscription-service-logger-interceptor.ts`
- `src/services/facades/interceptors/user-service-logger-interceptor.ts`

### Pages & Components

- `src/app/[locale]/(app)/account/invitations/[id]/page.tsx` - Fix JSX in try/catch
- `src/app/[locale]/(public)/blog/layout.tsx` - Fix Math.random()
- `src/app/[locale]/admin/plans/actions.ts` - Fix revalidateTag()
- `src/components/ui/sonner.tsx` - Lazy loading
- `src/components/not-found.tsx` - Client component marker
- `src/components/features/chat/message-content.tsx` - Fix setState in useEffect
- `src/components/hooks/use-unread-notifications.ts` - Fix useState + useRef pattern

### Autres

- `README.md` - Documentation projet
- `ROADMAP.md` - Roadmap mis à jour
- `scripts/init-env.ts` - Scripts d'initialisation

---

## 7. Checklist de Migration

- [x] Installer Next.js 16.0.1
- [x] Mettre à jour React vers 19.2.0
- [x] Mettre à jour next-intl vers 4.4.0
- [x] Renommer `middleware.ts` en `proxy.ts`
- [x] Corriger les appels `revalidateTag()`
- [x] Refactoriser les Service Interceptors (Proxy → Factory)
- [x] Lazy loader Sonner Toaster
- [x] Marquer NotFoundComponent comme client
- [x] Fixer JSX dans try/catch
- [x] Éliminer Math.random() pendant le render
- [x] Corriger setState synchrone dans useEffect
- [x] Migrer ESLint vers Flat Config
- [x] Ajouter plugins React et TypeScript
- [x] Vérifier `pnpm lint` (0 erreurs)
- [x] Vérifier `pnpm build` (succès avec pages statiques)

---

## 8. Commandes Utiles

```bash
# Installation des dépendances
pnpm install

# Vérifier les erreurs de linting
pnpm lint

# Fixer les erreurs ESLint auto-fixables
pnpm lint:fix

# Build pour production
pnpm build

# Démarrer le serveur de développement
pnpm dev

# Générer les migrations Drizzle (si nécessaire)
pnpm db:generate
```

---

## 9. Points Importants à Retenir

1. **Turbopack Incompatibilité:** Les objets Proxy ne sont pas sérialisables par Turbopack. Utiliser des factory functions à la place.

2. **React 19 Strict Mode:** Les nouvelles règles ESLint sont activées par défaut. Les violations causent des erreurs au build.

3. **Dynamic Rendering:** Tout est dynamique par défaut. Configurer explicitement les pages statiques avec `export const dynamic = 'force-static'`.

4. **ISR:** Utiliser `export const revalidate = <seconds>` ou `revalidateTag()` pour le cached rendering.

5. **ESLint Flat Config:** La nouvelle configuration est plus simple et plus puissante que l'ancienne.

---

## 10. Dépannage Courant

### Issue: "Cannot read properties of null (reading 'useContext')"

**Cause:** Un composant utilisant des hooks contexte est rendu lors du prerendering sans provider.
**Solution:** Marquer le composant avec `'use client'` ou créer un client component wrapper.

### Issue: "Cannot serialize Proxy object"

**Cause:** Un objet Proxy est utilisé dans un server component.
**Solution:** Remplacer par une factory function qui retourne un objet ordinaire.

### Issue: Pages non générées statiquement

**Cause:** Next.js 16 rend tout dynamique par défaut.
**Solution:** Ajouter `export const dynamic = 'force-static'` aux pages qui doivent être statiques.

### Issue: "Avoid calling setState directly within an effect"

**Cause:** setState synchrone dans useEffect.
**Solution:** Utiliser du state dérivé, des refs, ou restructurer la logique.

---

## Conclusion

La migration vers Next.js 16 est maintenant complète. Le projet utilise:

- **Next.js 16.0.1** avec Turbopack par défaut
- **React 19.2.0** avec strict mode
- **ESLint 9** avec Flat Config
- **Zero build errors** et configuration optimisée

Tous les breaking changes ont été adressés et le code respecte les nouvelles règles React 19.

**Branche:** `migration/nextjs-16`
**Statut:** ✅ Prête pour production
