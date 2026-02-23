---
description:
paths: src/services/authorization/**
---

# Système d'Autorisation CASL

## Vue d'ensemble

Le projet utilise **CASL (Code Access Security Library)** pour gérer les autorisations et permissions. Le système est centralisé dans [casl-abilities.ts](src/services/authorization/casl-abilities.ts) et suit une architecture basée sur les actions et les sujets (ressources).

## Architecture

### Types Principaux

- **Actions** : Types union définissant les actions possibles
- **Subjects** : Types union définissant les ressources du système
- **Constantes** : `ActionsConst` et `SubjectsConst` pour éviter les erreurs de frappe
- **AppAbility** : Type retourné par `defineAbilitiesFor`

### Actions Disponibles

```typescript
type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage'

export const ActionsConst = {
  CREATE: 'create' as Actions,
  READ: 'read' as Actions,
  UPDATE: 'update' as Actions,
  DELETE: 'delete' as Actions,
  MANAGE: 'manage' as Actions,
} as const
```

### Subjects (Ressources)

```typescript
type Subjects = 'User' | 'Subscription' | 'Technical' | 'Log' | 'all'

export const SubjectsConst = {
  USER: 'User' as Subjects,
  SUBSCRIPTION: 'Subscription' as Subjects,
  TECHNICAL: 'Technical' as Subjects,
  LOG: 'Log' as Subjects,
  ALL: 'all' as Subjects,
} as const
```

## Permissions par Rôle

### GUEST (Non authentifié)

- **Accès limité** : Peut uniquement lire certains champs des logs
- **Restrictions** : Aucun accès aux utilisateurs, subscriptions ou ressources techniques

### USER (Utilisateur régulier)

- **Profil utilisateur** :
  - Peut lire et modifier son propre profil (`{id: user.id}`)
  - Peut lire les profils publics (`{visibility: 'public'}`)
  - Ne peut pas modifier les champs sensibles (rôle, permissions, etc.)

- **Subscriptions** :
  - Peut lire, créer et modifier ses propres subscriptions (`{userId: user.id}`)
  - Ne peut pas supprimer de subscriptions

- **Logs** :
  - Accès en lecture seule aux logs

- **Restrictions** :
  - Ne peut pas supprimer d'autres utilisateurs
  - Aucun accès aux ressources techniques

### ADMIN

- **Permissions étendues** :
  - Peut gérer (`MANAGE`) tous les utilisateurs
  - Peut gérer toutes les subscriptions
  - Peut gérer les ressources techniques et logs

### SUPER_ADMIN

- **Permissions complètes** :
  - Peut gérer (`MANAGE`) toutes les ressources (`ALL`)

## Fonctions Utilitaires

### Fonctions de Vérification

```typescript
// Vérification simple d'action sur un type de ressource
userCan(user, ActionsConst.READ, SubjectsConst.USER): boolean

// Vérification inverse
userCannot(user, ActionsConst.DELETE, SubjectsConst.USER): boolean

// Vérification avec conditions sur un objet spécifique
userCanOnResource(user, ActionsConst.READ, SubjectsConst.USER, userObject): boolean
```

### Fonction Principale

```typescript
// Définit toutes les abilities pour un utilisateur
defineAbilitiesFor(user?: User): AppAbility
```

### Fonctions d'Aide

```typescript
// Vérifie si l'utilisateur est admin
isUserAdmin(user?: User): boolean

// Filtre les champs selon les permissions
filterFields<T>(user, action, subject, data): Partial<T>
```

## Permissions Conditionnelles

Le système supporte les permissions conditionnelles via CASL :

```typescript
// Exemple : Un utilisateur peut lire son propre profil
can(ActionsConst.READ, SubjectsConst.USER, {id: user.id})

// Exemple : Un utilisateur peut lire les profils publics
can(ActionsConst.READ, SubjectsConst.USER, {visibility: 'public'})
```

### Implémentation avec `userCanOnResource`

Cette fonction utilise l'API interne CASL pour vérifier les conditions :

1. Récupère les règles applicables avec `ability.rulesFor(action, subject)`
2. Vérifie si l'objet respecte les conditions de au moins une règle
3. Retourne `true` si une règle sans condition existe (permission globale)

## Tests

Les tests sont définis dans [casl-abilities.test.ts](src/services/authorization/__tests__/casl-abilities.test.ts) :

- **Tests par rôle** : Vérification des permissions pour chaque rôle utilisateur
- **Tests de ressources** : Permissions sur User, Subscription, Log, Technical
- **Tests conditionnels** : Vérification avec `userCanOnResource`
- **Tests utilitaires** : Fonctions helper et cas d'usage spécifiques

## Bonnes Pratiques

### Utilisation des Constantes

**✅ Correct** :

```typescript
userCan(user, ActionsConst.READ, SubjectsConst.USER)
```

**❌ Incorrect** :

```typescript
userCan(user, 'read', 'User') // Risque d'erreur de frappe
```

### Vérification des Permissions

1. **Actions simples** : Utiliser `userCan()` ou `userCannot()`
2. **Objets spécifiques** : Utiliser `userCanOnResource()` pour les conditions
3. **Filtrage de données** : Utiliser `filterFields()` pour sécuriser les retours

### Structure des Règles

```typescript
// Règle sans condition (permission globale)
can(ActionsConst.MANAGE, SubjectsConst.ALL)

// Règle avec condition (permission conditionnelle)
can(ActionsConst.READ, SubjectsConst.USER, {id: user.id})

// Interdiction explicite
cannot(ActionsConst.DELETE, SubjectsConst.USER)
```

## Intégration avec l'Architecture

Le système CASL s'intègre dans l'architecture en couches :

- **Service Layer** : Utilise les fonctions d'autorisation avant d'accéder aux données
- **DAL** : Peut filtrer les données selon les permissions
- **Presentation Layer** : Vérifie les permissions pour l'affichage conditionnel

### Exemple d'Utilisation

```typescript
// Dans un service
if (!userCan(user, ActionsConst.UPDATE, SubjectsConst.USER)) {
  throw new AuthorizationError('Insufficient permissions')
}

// Avec conditions
if (
  !userCanOnResource(
    user,
    ActionsConst.READ,
    SubjectsConst.SUBSCRIPTION,
    subscription
  )
) {
  throw new AuthorizationError('Cannot access this subscription')
}
```

## Migration et Évolution

- **Types Union** : Le système utilise des types union TypeScript modernes au lieu d'enums
- **Constantes** : Export de constantes pour éviter les erreurs de frappe
- **Extensibilité** : Facile d'ajouter de nouveaux rôles, actions ou sujets
- **Tests** : Suite de tests comprehensive pour garantir la sécurité
