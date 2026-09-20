---
description:
---

# Règle Zod - Internationalisation Client/Serveur

## Vue d'ensemble

Cette règle explique comment créer des schémas Zod traduits qui fonctionnent à la fois côté client (React Hook Form) et côté serveur (Server Actions) avec next-intl.

## Architecture de la Solution

### 1. Structure des Fichiers

```
src/
├── components/features/admin/users/
│   └── user-form-validation.ts          ← Schémas Zod avec traductions
├── components/features/user/
│   └── action.ts                        ← Server Actions avec validation
├── components/features/association/
│   └── association-settings-form.tsx    ← Formulaire client avec validation
└── messages/
    ├── fr.json                          ← Traductions françaises
    ├── en.json                          ← Traductions anglaises
    └── es.json                          ← Traductions espagnoles
```

### 2. Organisation des Traductions

Les clés de traduction suivent la hiérarchie : `{PageName}.{ComponentName}.{Section}`

```json
{
  "AccountPage": {
    "EditUserProfileForm": {
      "validation": {
        "name": {
          "min": "Le nom doit contenir au moins 2 caractères",
          "invalid": "Nom invalide"
        },
        "email": {
          "invalid": "Adresse email invalide"
        },
        "uuid": {
          "invalid": "UUID invalide"
        },
        "image": {
          "invalid": "URL d'image invalide"
        },
        "visibility": {
          "invalid": "Valeur de visibilité invalide"
        }
      }
    }
  }
}
```

## Implémentation

### 1. Schéma de Base avec Fonction de Traduction

**Référence : ](src/components/features/admin/users/user-form-validation.ts)**

```typescript
import z from 'zod'

// Schéma de base avec messages en dur (pour référence)
export const userFormSchema = z.object({
  id: z.string().uuid('Invalid UUID').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  image: z.string().url('Invalid URL').optional().or(z.literal('')),
  visibility: z.enum(['public', 'private']),
})

// Fonction qui crée un schéma avec messages traduits
// Option 1 : Schéma complet (clone)
export function createUserFormSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().uuid(t('validation.uuid.invalid')).optional(),
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),
    image: z
      .string()
      .url(t('validation.image.invalid'))
      .optional()
      .or(z.literal('')),
    visibility: z.enum(['public', 'private']),
  })
}

// Option 2 ide (recommandé)
export function createUserFormSchema(t: (key: string) => string) {
  return userFormSchema.extend({
    id: z.string().uuid(t('validation.uuid.invalid')).optional(),
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),
    image: z
      .string()
      .url(t('validation.image.invalid'))
      .optional()
      .or(z.literal('')),
    visibility: z.enum(['public', 'private']),
  })
}

export type UserFormSchemaType = z.infer<typeof userFormSchema>
```

### 2. Utilisation Côté Client

**Référence : [association-settings-form.tsx](src/components/features/association/association-settings-form.tsx)**

> Le gabarit ci-dessous vient de `EditUserProfileForm`, écran hérité retiré en s12a ; le patron
> reste celui à suivre.

```typescript
'use client'

import {useTranslations} from 'next-intl'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {createUserFormSchema} dmin/users/user-form-validation'

export function EditUserProfileForm({user}: {user: User}) {
  const t = useTranslations('AccountPage.EditUserProfileForm')

  // Créer le schéma avec messages traduits
  const userFormSchemaClient = createUserFormSchema(t)
  type FormValues = z.infer<typeof userFormSchemaClient>

  const form = useForm<FormValues>({
    resolver: zodResolver(userFormSchemaClient),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? '',
      visibility: user.visibility,
    },
  })

  // ... reste du composant
}
```

### 3. Utilisation Côté Serveur

**Référence : [action.ts](src/components/features/user/action.ts)**

```typescript
'use server'

import {getTranslations} from 'next-intl/server'
import {createUserFormSchema} from '../admin/users/user-form-validation'

export async function updateUserAction(
  prevState?: FormState<UserFormSchemaType>,
  formData?: FormData
): Promise<FormState<UserFormSchemaType>> {
  // Récupérer les traductions pour les messages d'erreur
  const t = await getTranslations('AccountPage.EditUserProfileForm')

  // ... validation d'authentification

  // Extraire les données du FormData
  const userData: UpdateUser = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    image: formData.get('image') as string,
    visibility: formData.get('visibility') as 'public' | 'private',
  }

  // Valider avec le schéma traduit
  const userFormSchemaServer = createUserFormSchema(t)
  const validationResult = userFormSchemaServer.safeParse(userData)

  if (!validationResult.success) {
    const validationErrors: ValidationError[] =
      validationResult.error.errors.map((err) => ({
        field: err.path[0] as keyof UserFormSchemaType,
        message: err.message, // Message déjà traduit
      }))

    return {
      success: false,
      message: `${t('form.validationFailed')}: ${errorMessages}`,
      errors: validationErrors,
    }
  }

  // ... logique métier
}
```

## Approches d'Implémentation

### Option 1 : Schéma Complet (Clone)

```typescript
export function createUserFormSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().uuid(t('validation.uuid.invalid')).optional(),
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),
    image: z
      .string()
      .url(t('validation.image.invalid'))
      .optional()
      .or(z.literal('')),
    visibility: z.enum(['public', 'private']),
  })
}
```

**Avantages :**

- Contrôle total sur tous les champs
- Pas de dépendance au schéma de base

**Inconvénients :**

- Duplication de code
- Maintenance plus difficile

### Option 2 : Extension avec Override (Recommandé)

```typescript
export function createUserFormSchema(t: (key: string) => string) {
  return userFormSchema.extend({
    id: z.string().uuid(t('validation.uuid.invalid')).optional(),
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),
    image: z
      .string()
      .url(t('validation.image.invalid'))
      .optional()
      .or(z.literal('')),
    visibility: z.enum(['public', 'private']),
  })
}
```

**Avantages :**

- Réutilisation du schéma de base
- Override automatique des messages
- Maintenance plus facile
- Cohérence garantie

**Inconvénients :**

- Dépendance au schéma de base

## Extensions Avancées

### Extension avec Nouveaux Champs

```typescript
export function createExtendedUserFormSchema(t: (key: string) => string) {
  return userFormSchema.extend({
    // Override des messages existants
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),

    // Nouveaux champs avec traductions
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, t('validation.phone.invalid')),
    settings: z.object({
      theme: z.enum(['light', 'dark'], {
        errorMap: () => ({message: t('validation.theme.invalid')}),
      }),
    }),
  })
}
```

### Extension avec Conditions

```typescript
export function createConditionalUserFormSchema(
  t: (key: string) => string,
  isAdmin: boolean
) {
  return userFormSchema.extend({
    // Champs conditionnels selon le rôle
    ...(isAdmin && {
      role: z.enum(['user', 'admin'], {
        errorMap: () => ({message: t('validation.role.invalid')}),
      }),
    }),
  })
}
```

## Avantages de cette Approche

### ✅ **Base Commune**

- Une seule fonction `createUserFormSchema(t)` fonctionne partout
- Même structure de validation côté client et serveur
- Cohérence garantie entre les validations

### ✅ **Traductions Dynamiques**

- Messages traduits côté client avec `useTranslations`
- Messages traduits côté serveur avec `getTranslations`
- Même namespace pour les clés de traduction

### ✅ **Maintenabilité**

- Schéma de base `userFormSchema` pour référence
- Fonction de création avec traductions
- Modifications centralisées
- Extension avec override pour flexibilité

### ✅ **Type Safety**

- TypeScript infère les types correctement
- Même type `UserFormSchemaType` partout
- Validation des clés de traduction

## Conventions de Nommage

### Clés de Traduction

```typescript
// Format : {PageName}.{ComponentName}.{Section}
'AccountPage.EditUserProfileForm.validation.name.min'
'AccountPage.EditUserProfileForm.validation.email.invalid'
'AccountPage.EditUserProfileForm.form.validationFailed'
```

### Fonctions de Schéma

```typescript
// Format : create{Entity}FormSchema
createUserFormSchema(t)
createSettingsFormSchema(t)
createPasswordFormSchema(t)
```

## Exemple Complet

### 1. Définition du Schéma

```typescript
// user-form-validation.ts
export function createUserFormSchema(t: (key: string) => string) {
  return userFormSchema.extend({
    id: z.string().uuid(t('validation.uuid.invalid')).optional(),
    name: z.string().min(2, t('validation.name.min')),
    email: z.string().email(t('validation.email.invalid')),
    image: z
      .string()
      .url(t('validation.image.invalid'))
      .optional()
      .or(z.literal('')),
    visibility: z.enum(['public', 'private']),
  })
}
```

### 2. Traductions

```json
{
  "AccountPage": {
    "EditUserProfileForm": {
      "validation": {
        "name": {
          "min": "Le nom doit contenir au moins 2 caractères",
          "invalid": "Nom invalide"
        },
        "email": {
          "invalid": "Adresse email invalide"
        },
        "uuid": {
          "invalid": "UUID invalide"
        },
        "image": {
          "invalid": "URL d'image invalide"
        }
      }
    }
  }
}
```

### 3. Utilisation Client

```typescript
const t = useTranslations('AccountPage.EditUserProfileForm')
const userFormSchemaClient = createUserFormSchema(t)
```

### 4. Utilisation Serveur

```typescript
const t = await getTranslations('AccountPage.EditUserProfileForm')
const userFormSchemaServer = createUserFormSchema(t)
```

## Checklist d'Implémentation

- [ ] Créer le schéma de base avec messages en dur
- [ ] Créer la fonction `create{Entity}FormSchema(t)` avec extension
- [ ] Ajouter les clés de traduction dans tous les fichiers de langue
- [ ] Utiliser côté client avec `useTranslations`
- [ ] Utiliser côté serveur avec `getTranslations`
- [ ] Tester les validations dans toutes les langues
- [ ] Vérifier la cohérence des types TypeScript

## Résumé

Cette approche garantit :

- **Traductions cohérentes** côté client et serveur
- **Base commune** pour les validations
- **Maintenabilité** optimale avec extension et override
- **Type safety** complète
- **Réutilisabilité** des schémas
- **Flexibilité** pour les extensions avancées

La fonction `createUserFormSchema(t)` avec extension est la clé de cette solution, permettant d'avoir des messages d'erreur traduits partout avec une seule définition de schéma et la possibilité d'override des messages existants.
