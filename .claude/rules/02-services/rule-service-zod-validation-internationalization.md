---
description:
paths: src/services/validation/**.ts
---

# Règle Service - Internationalisation des Validations Zod au niveau service

## Vue d'ensemble

Cette règle explique comment implémenter l'internationalisation des validations Zod côté service (Server Actions) en utilisant `getTranslations` directement dans les fichiers de validation.

## Principe de Fonctionnement

### Architecture Côté Service

- **Code serveur uniquement** : Les validations côté service s'exécutent dans les Server Actions
- **Traductions intégrées** : `getTranslations` est appelé directement dans les fichiers de validation
- **Namespace dédié** : Les clés de traduction utilisent le format `/Service.{Domain}.validation`

## Structure des Fichiers

```
src/
├── services/
│   ├── validation/
│   │   └── user-validation.ts          ← Schémas Zod avec traductions intégrées
│   └── user-service.ts                 ← Services utilisant les schémas traduits
└── messages/
    ├── fr.json                         ← Traductions françaises
    ├── en.json                         ← Traductions anglaises
    └── es.json                         ← Traductions espagnoles
```

## Implémentation

### 1. Fonction de Validation avec Traductions Intégrées

**Référence : [user-validation.ts](src/services/validation/user-validation.ts)**

```typescript
import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

// Fonction qui crée un schéma avec messages traduits pour updateUserService
export async function createUpdateUserServiceSchema() {
  const t = await getTranslations('Service.User')
  return updateUserServiceSchema.extend({
    name: z
      .string()
      .min(3, {
        message: t('validation.name.min'),
      })
      .max(30, {
        message: t('validation.name.max'),
      }),
    email: z.string().email({
      message: t('validation.email.invalid'),
    }),
  })
}
```

### 2. Utilisation dans le Service

**Référence : [user-service.ts](src/services/user-service.ts)**

```typescript
export const updateUserService = async (userParams: UpdateUser) => {
  const resourceUid = userParams.id
  const granted = await canUpdateUser(resourceUid)

  if (!granted) {
    throw new AuthorizationError()
  }
  userParams.updatedAt = new Date()

  // Utiliser le schéma avec traductions intégrées
  const translatedSchema = await createUpdateUserServiceSchema()
  const parsed = translatedSchema.safeParse(userParams)
  if (!parsed.success) {
    throw new ValidationParsedZodError(parsed.error)
  }

  const userParamsSanitized = parsed.data
  await updateUserSafeByUidDao(userParamsSanitized, resourceUid)
}
```

### 3. Organisation des Traductions

Les clés de traduction suivent le format `/Service.{Domain}.validation` :

```json
{
  "Service": {
    "User": {
      "validation": {
        "name": {
          "min": "Le nom doit contenir au moins 3 caractères",
          "max": "Le nom ne doit pas contenir plus de 30 caractères",
          "required": "Le nom est requis",
          "invalid": "Nom invalide"
        },
        "email": {
          "invalid": "L'email n'est pas valide",
          "required": "L'email est requis",
          "format": "Format d'email invalide"
        },
        "uuid": {
          "invalid": "L'identifiant n'est pas valide"
        }
      }
    }
  }
}
```

## Avantages de cette Approche

### ✅ **Traductions Intégrées**

- `getTranslations` appelé directement dans les fichiers de validation
- Pas besoin de passer la fonction de traduction en paramètre
- Traductions automatiques selon la locale de la requête

### ✅ **Séparation des Responsabilités**

- Code serveur uniquement (pas de logique client)
- Validations centralisées dans les fichiers de validation
- Services focus sur la logique métier

### ✅ **Maintenabilité**

- Une seule fonction par schéma de validation
- Clés de traduction organisées par domaine
- Modifications centralisées

### ✅ **Performance**

- Traductions récupérées une seule fois par validation
- Pas de surcharge côté client
- Cache automatique de next-intl

## Conventions de Nommage

### Fonctions de Validation

```typescript
// Format : create{Entity}ServiceSchema
createUpdateUserServiceSchema()
createCreateUserServiceSchema()
createUserSettingsServiceSchema()
```

### Clés de Traduction

```typescript
// Format : Service.{Domain}.validation.{field}.{rule}
'Service.User.validation.name.min'
'Service.User.validation.email.invalid'
'Service.Organization.validation.name.required'
```

### Namespaces par Domaine

```typescript
// Utilisateurs
getTranslations('Service.User')

// Organisations
getTranslations('Service.Organization')

// Souscriptions
getTranslations('Service.Subscription')
```

## Exemple Complet

### 1. Définition du Schéma

```typescript
// user-validation.ts
export async function createUpdateUserServiceSchema() {
  const t = await getTranslations('Service.User')
  return updateUserServiceSchema.extend({
    name: z.string().min(3, {
      message: t('validation.name.min'),
    }),
    email: z.string().email({
      message: t('validation.email.invalid'),
    }),
  })
}
```

### 2. Traductions

```json
{
  "Service": {
    "User": {
      "validation": {
        "name": {
          "min": "Le nom doit contenir au moins 3 caractères",
          "max": "Le nom ne doit pas contenir plus de 30 caractères"
        },
        "email": {
          "invalid": "L'email n'est pas valide"
        }
      }
    }
  }
}
```

### 3. Utilisation dans le Service

```typescript
// user-service.ts
const translatedSchema = await createUpdateUserServiceSchema()
const parsed = translatedSchema.safeParse(userParams)
if (!parsed.success) {
  throw new ValidationParsedZodError(parsed.error)
}
```

## Différences avec l'Approche Client

### Côté Service (Cette règle)

```typescript
// Traductions intégrées dans le fichier de validation
export async function createUpdateUserServiceSchema() {
  const t = await getTranslations('Service.User')
  return schema.extend({...})
}
```

### Côté Client (Règle précédente)

```typescript
// Fonction de traduction passée en paramètre
export function createUserFormSchema(t: (key: string) => string) {
  return schema.extend({...})
}
```

## Checklist d'Implémentation

- [ ] Créer la fonction `create{Entity}ServiceSchema()` avec `getTranslations`
- [ ] Ajouter les clés de traduction dans `Service.{Domain}.validation`
- [ ] Utiliser la fonction dans le service avec `await`
- [ ] Tester les validations dans toutes les langues
- [ ] Vérifier la gestion des erreurs avec `ValidationParsedZodError`

## Bonnes Pratiques

1. **Namespace cohérent** : Toujours utiliser `Service.{Domain}.validation`
2. **Fonctions async** : Les fonctions de validation doivent être `async`
3. **Gestion d'erreurs** : Utiliser `ValidationParsedZodError` pour les erreurs de validation
4. **Traductions complètes** : Ajouter les clés dans tous les fichiers de langue
5. **Tests multilingues** : Tester les validations dans toutes les langues supportées

## Résumé

Cette approche garantit :

- **Traductions automatiques** côté service
- **Code serveur pur** sans logique client
- **Organisation claire** des clés de traduction
- **Maintenabilité optimale** avec validations centralisées
- **Performance optimale** avec cache next-intl

La fonction `createUpdateUserServiceSchema()` avec `getTranslations('Service.User')` est la clé de cette solution, permettant des validations traduites automatiquement côté service.
