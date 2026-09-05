---
description:
---

# Gestion des Logs avec Winston Logger

Key Principles

- Utilisation de winston via `import { logger } from '@/lib/logger'`
- Avoir un juste équuilibre de logging (pas trop de log)
- Les service passent deja par des interceptor de logging

## Configuration du Logger

Le projet utilise **Winston** pour la gestion des logs côté serveur uniquement. Le logger est configuré dans [logger.ts](src/lib/logger.ts).

```ts
import {logger} from '@/lib/logger'
```

## ⚠️ Restriction Importante

**Le logger ne fonctionne QUE côté serveur** :

- ✅ Server Components
- ✅ Server Actions
- ✅ API Routes
- ✅ Services métier
- ✅ DAL (Data Access Layer)
- ✅ Webhooks
- ❌ Client Components (utiliser `console.log` à la place)

## ⚠️ Le logger et Cache Components

Winston horodate chaque log via `new Date()` — un accès à l'heure courante **interdit au prerender
et dans un scope `'use cache'`**. Comme l'intercepteur de services logge à chaque appel de méthode,
et que toute page prerendue passe par une façade, le blocage serait systémique.

Le logger est donc **neutralisé pendant le build** (`src/lib/logger.ts`) :

```ts
const isBuildPrerender = process.env.NEXT_PHASE === 'phase-production-build'
export const logger = isBuildPrerender ? noopLogger : winstonLogger
```

Deux conséquences pour qui écrit du code :

- **Ne pas appeler `logger` à l'intérieur d'une fonction portant `'use cache'`.** La garde ci-dessus
  ne couvre que le build : au runtime, dans un scope caché, l'horloge reste interdite. Logger avant
  ou après l'appel caché, pas dedans.
- **Si une erreur de prerender pointe une page qui semble sans rapport avec le logging, vérifier le
  logger avant de suspecter la page.** C'est le piège qui a coûté le plus cher pendant la migration
  Cache Components.

## Niveaux de Log Disponibles

```ts
// Niveau ERROR - Erreurs critiques
logger.error('❌ Erreur critique:', error)

// Niveau INFO - Informations importantes
logger.info('✅ Opération réussie:', data)

// Niveau DEBUG - Informations de débogage (développement)
logger.debug('🔧 Données de débogage:', metadata)

// Niveau LOG - Informations générales
logger.log('📝 Information générale:', message)
```

## Utilisation dans les Services

### Logging Automatique avec Intercepteurs

Les services disposent d'intercepteurs automatiques qui loggent les appels de méthodes :

[organization-service-logger-interceptor.ts](src/services/facades/interceptors/organization-service-logger-interceptor.ts)

```ts
// Les intercepteurs loggent automatiquement :
// - L'appel de chaque méthode de service
// - Les arguments passés (en mode debug)
// - Le résultat retourné (en mode debug)
// - Les erreurs d'autorisation et autres
```

### Logging Manuel dans les Services

```ts
import {logger} from '@/lib/logger'

export const createUserService = async (userData: CreateUser) => {
  logger.info('[USER-SERVICE] Création utilisateur démarrée')

  try {
    const user = await createUserDao(userData)
    logger.info('✅ Utilisateur créé avec succès:', user.email)
    return user
  } catch (error) {
    logger.error('❌ Erreur création utilisateur:', error)
    throw error
  }
}
```

## Utilisation dans les Webhooks

Exemple d'usage dans les webhooks Stripe [stripe-events.ts](src/lib/stripe/stripe-events.ts) :

```ts
export async function onStripeEvent(event: Stripe.Event) {
  logger.info('Better Auth Stripe event:', event.type, event.id)

  try {
    // Traitement...
    logger.debug('🔧 Données métadata:', metadata)
    logger.log('✅ Traitement terminé avec succès')
  } catch (error) {
    logger.error('❌ Erreur dans onEvent Stripe:', error)
  }
}
```

## Bonnes Pratiques

### 1. Utilisation des Emojis pour Identifier les Types

```ts
// ✅ Succès / Opération réussie
logger.info('✅ Utilisateur authentifié:', user.email)

// ❌ Erreurs
logger.error("❌ Échec de l'authentification:", error)

// 🔧 Debug / Développement
logger.debug("🔧 Variables d'environnement:", process.env.NODE_ENV)

// 📝 Informations générales
logger.log("📝 Démarrage de l'application")

// ⚠️ Avertissements
logger.warn('⚠️ Configuration manquante:', config)
```

### 2. Logging Structuré avec Métadonnées

```ts
// Bon - avec métadonnées structurées
logger.info('Utilisateur connecté', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
})

// Éviter - texte non structuré
logger.info(`Utilisateur ${user.email} connecté à ${new Date()}`)
```

### 3. Gestion des Erreurs

```ts
try {
  // Code métier
} catch (error) {
  if (error instanceof AuthorizationError) {
    logger.error("[AUTH] Erreur d'autorisation:", error.message)
  } else if (error instanceof ValidationError) {
    logger.error('[VALIDATION] Erreur de validation:', error.message)
  } else {
    logger.error('[SYSTEM] Erreur système:', error)
  }
  throw error
}
```

### 4. Logging dans les Server Actions

```ts
'use server'

export async function updateUserAction(formData: FormData) {
  logger.info('[ACTION] Mise à jour utilisateur démarrée')

  try {
    const result = await updateUserService(data)
    logger.info('✅ Action terminée avec succès')
    return result
  } catch (error) {
    logger.error("❌ Erreur dans l'action:", error)
    throw error
  }
}
```

## Configuration des Niveaux

Le niveau de log est contrôlé par la variable d'environnement `LOG_LEVEL` :

```env
# Développement - voir tous les logs
LOG_LEVEL=debug

# Production - logs essentiels uniquement
LOG_LEVEL=info
```

## Format des Logs

Les logs incluent automatiquement :

- **Timestamp** : Date et heure formatted
- **Level** : Niveau du log (colorisé en console)
- **Message** : Message principal
- **Metadata** : Données structurées (JSON)

Exemple de sortie :

```
2024-01-15 14:30:25 [info]: ✅ Utilisateur créé avec succès | {"email":"user@example.com","id":"123"}
```

## Attention : Client vs Server

```ts
// ❌ NE FONCTIONNE PAS côté client
'use client'
import {logger} from '@/lib/logger' // Erreur !

// ✅ Utilisez console.log côté client
;('use client')
console.log('Debug côté client:', data)

// ✅ Fonctionne côté serveur
;('use server')
import {logger} from '@/lib/logger'
logger.info('Log côté serveur:', data)
```

Cette approche garantit un logging robuste et structuré pour tout le code côté serveur de l'application.
