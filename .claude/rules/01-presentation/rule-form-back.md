---
description:
paths:
  - '**/action.ts'
  - '**/forms/**/*.tsx'
---

# Validation des Formulaires Côté Backend

Guide complet pour la validation des formulaires avec Server Actions dans Next.js 16 / React 19.

## Principes Architecturaux

- **React Server Components (RSC)** par défaut pour les performances
- **Server Actions** pour toutes les mutations de données
- **Validation Zod obligatoire** côté backend avec `safeParse()`
- **Validation métier via façades** de service uniquement
- **Architecture en couches** strictement respectée
- **Messages d'erreur localisés** et explicites

## Organisation des Server Actions

### Structure des dossiers

```
app/
  ├── (auth)/
  │   ├── action.ts          ← Actions d'authentification
  │   ├── login/page.tsx
  │   └── register/page.tsx
  ├── (app)/
  │   ├── account/action.ts  ← Actions du compte utilisateur
  │   └── dashboard/action.ts
  └── (admin)/
      └── users/action.ts    ← Actions d'administration
components/
  ├── features/auth/auth-form-validation.ts  ← Schema zod de validation des forms
```

### Template standard d'une Server Action

**Référence : [action.ts](<src/app/[locale]/(auth)/action.ts>)**

```tsx
'use server'

import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {redirect} from 'next/navigation'
import {ValidationSchema} from '@/components/features/module/validation'
import {ServiceFacade} from '@/services/facades/service-facade'

type ActionResult = {
  success: boolean
  message: string
}

export async function formAction(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 1. VALIDATION ZOD OBLIGATOIRE
    const validationResult = ValidationSchema.safeParse({
      field1: formData.get('field1'),
      field2: formData.get('field2'),
    })

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => err.message)
        .join(', ')
      return {success: false, message: errors}
    }

    const {field1, field2} = validationResult.data

    // 2. VALIDATION MÉTIER VIA FAÇADE
    const result = await ServiceFacade({
      field1,
      field2,
    })

    // 3. REDIRECTION APRÈS SUCCÈS
    redirect('/success-page')
  } catch (error) {
    // 4. GESTION SPÉCIALISÉE DES ERREURS
    if (isRedirectError(error)) {
      throw error // OBLIGATOIRE pour Next.js
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Une erreur inattendue est survenue',
    }
  }
}
```

## Validation Backend - Règles Strictes

### 1. Validation Zod avec safeParse OBLIGATOIRE

**✅ CORRECT - Évite les exceptions**

```tsx
// Exemple du projet
const validationResult = authRegisterFormSchema.safeParse({
  name: formData.get('name'),
  email: formData.get('email'),
  password: formData.get('password'),
  confirmPassword: formData.get('confirmPassword'),
})

if (!validationResult.success) {
  const errors = validationResult.error.errors
    .map((err) => err.message)
    .join(', ')
  return {success: false, message: errors}
}
```

**❌ INTERDIRE - parse() lève des exceptions**

```tsx
// Ne jamais faire
const data = ValidationSchema.parse(formData)
```

### 2. Validation métier VIA FAÇADES UNIQUEMENT

**✅ CORRECT - Utiliser les façades de service ou DAL**

```tsx
import {getUserByEmailService} from '@/services/facades/user-service-facade'
import {getUserByEmailDal} from '@/app/dal/user-dal'

// Vérifier l'existence avant traitement
const existingUser = await getUserByEmailService(email)
if (existingUser) {
  return {
    success: false,
    message: 'Un compte existe déjà avec cet email',
  }
}
```

**❌ INTERDIRE - Accès direct aux couches inférieures**

```tsx
// JAMAIS d'import direct depuis la persistence
import {getUserByEmailDao} from '@/db/repositories/user-repository'
// JAMAIS d'import direct de service (utiliser les facades)
import {getUserByEmailService} from '@/services/user-service'
```

### 3. Gestion des erreurs Next.js OBLIGATOIRE

**✅ OBLIGATOIRE - Gestion des erreurs de redirection**

```tsx
import {isRedirectError} from 'next/dist/client/components/redirect-error'

try {
  // Logique métier
  await createUserService(userData)
  redirect('/dashboard')
} catch (error) {
  // OBLIGATOIRE - Relancer les erreurs de redirection
  if (isRedirectError(error)) {
    throw error
  }

  // Traiter les autres erreurs
  return {
    success: false,
    message: error instanceof Error ? error.message : 'Erreur inconnue',
  }
}
```

## Intégration Frontend

### Formulaire avec useActionState

**Référence : [register-form.tsx](src/components/features/auth/forms/register-form.tsx)**

```tsx
'use client'
import {useActionState} from 'react'
import {formAction} from './action'

export function MyForm() {
  const [state, formAction] = useActionState(formAction, {
    success: false,
    message: '',
  })

  const error = state && !state.success ? state.message : null

  return (
    <form action={formAction}>
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="field">Champ</Label>
          <Input id="field" name="field" required />
        </div>

        <SubmitButton />
      </div>
    </form>
  )
}
```

### Bouton de soumission avec état de chargement

```tsx
import {useFormStatus} from 'react-dom'

function SubmitButton() {
  const {pending} = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Traitement en cours...' : 'Valider'}
    </Button>
  )
}
```

## Schémas de Validation Zod

**Référence : [auth-form-validation.ts](src/components/features/auth/auth-form-validation.ts)**

### Schémas avec refinement et messages localisés

```tsx
import z from 'zod'

export const formSchema = z
  .object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    email: z.string().email('Adresse email invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(8, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })
```

### Messages d'erreur en français

```tsx
// ✅ Messages explicites et localisés
z.string().email('Adresse email invalide')
z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères')
z.boolean({required_error: 'Veuillez accepter les conditions'})

// ❌ Messages par défaut en anglais
z.string().email()
z.string().min(8)
```

## Types et États

### Types standardisés

```tsx
// Type standardisé pour toutes les actions
type ActionResult = {
  success: boolean
  message: string
}

// État initial pour useActionState
const initialState: ActionResult = {
  success: false,
  message: '',
}
```

## Flux de Données Respecté

### Pour les lectures

**RSC** → **DAL** → **Service Facades** → **Services** → **Repositories** → **Models**

### Pour les mutations (Server Actions)

**Client Components** → **Server Actions** → **Service Facades** → **Services** → **Repositories** → **Models**

## Checklist de Validation Backend

- [ ] **Validation Zod** avec `safeParse()` uniquement
- [ ] **Import des façades** de service uniquement
- [ ] **Gestion des erreurs** de redirection Next.js
- [ ] **Messages d'erreur** en français et explicites
- [ ] **Types de retour** cohérents (`ActionResult`)
- [ ] **Architecture en couches** respectée
- [ ] **Intégration** avec `useActionState` et `useFormStatus`

## Recommandations Finales

1. **`useActionState` (React 19)** plutôt que `useFormState` (déprécié)
2. **Validation double** : client-side pour UX + server-side pour sécurité
3. **Messages d'erreur précis** pour guider l'utilisateur
4. **Types TypeScript stricts** pour éviter les erreurs
5. **Respect absolu** de l'architecture en couches
6. **Tests unitaires** des Server Actions pour la robustesse

Cette approche garantit une validation robuste, sécurisée et maintenue avec une excellente expérience utilisateur.
