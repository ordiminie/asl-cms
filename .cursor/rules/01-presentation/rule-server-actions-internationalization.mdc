---
description:
globs:
alwaysApply: false
---

# Internationalisation des Server Actions avec next-intl

Ce guide explique comment implémenter l'internationalisation des messages dans les Server Actions en utilisant next-intl, conformément à la [documentation officielle](https://next-intl.dev/docs/environments/actions-metadata-route-handlers).

## Principe

Les Server Actions peuvent retourner des messages localisés en utilisant `getTranslations` de `next-intl/server`. Cela permet d'avoir des messages d'erreur et de succès traduits selon la locale de l'utilisateur.

## Implémentation

### 1. Import de getTranslations

```typescript
'use server'

import {getTranslations} from 'next-intl/server'

export async function myServerAction(formData: FormData) {
  // Récupérer les traductions pour le namespace approprié
  const t = await getTranslations('NamespaceName')

  // Utiliser les traductions dans les messages
  return {success: true, message: t('successMessage')}
}
```

### 2. Structure des Traductions

Organisez vos traductions de manière hiérarchique dans les fichiers `messages/{locale}.json` :

```json
{
  "AccountPage": {
    "EditUserProfileForm": {
      "form": {
        "success": "Profil mis à jour avec succès",
        "error": "Erreur lors de la mise à jour du profil",
        "validationFailed": "Erreur de validation",
        "userNotFound": "Utilisateur non trouvé",
        "invalidData": "Données invalides",
        "updateFailed": "Échec de la mise à jour du profil"
      },
      "upload": {
        "success": "Image uploadée avec succès",
        "errorRetry": "Impossible d'uploader l'image. Veuillez réessayer."
      }
    }
  }
}
```

### 3. Exemple Complet - updateUserAction

```typescript
'use server'

import {getTranslations} from 'next-intl/server'
import {requireActionAuth} from '@/app/dal/user-dal'

export async function updateUserAction(
  prevState?: FormState,
  formData?: FormData
): Promise<FormState> {
  // Récupérer les traductions
  const t = await getTranslations('AccountPage.EditUserProfileForm')

  // Vérification d'authentification
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: t('form.userNotFound')}
  }

  if (!formData) {
    return {success: false, message: t('form.invalidData')}
  }

  // Validation et logique métier...

  try {
    await updateUserService(validatedData)
    revalidatePath('/account')
    return {success: true, message: t('form.success')}
  } catch (error) {
    return {success: false, message: t('form.updateFailed')}
  }
}
```

## Bonnes Pratiques

### 1. Organisation des Namespaces

- **Pages** : `{PageName}` (ex: `AccountPage`)
- **Composants** : `{PageName}.{ComponentName}` (ex: `AccountPage.EditUserProfileForm`)
- **Sections** : `{PageName}.{SectionName}` (ex: `AccountPage.profile`)

### 2. Messages Spécifiques

Utilisez des clés de traduction spécifiques plutôt que des messages génériques :

```typescript
// ✅ Bon - Messages spécifiques
return {success: false, message: t('form.userNotFound')}
return {success: false, message: t('form.validationFailed')}

// ❌ Éviter - Messages génériques
return {success: false, message: t('form.error')}
```

### 3. Gestion des Erreurs

```typescript
try {
  await someService()
  return {success: true, message: t('form.success')}
} catch (error) {
  // Erreurs d'autorisation
  if (error instanceof AuthorizationError) {
    return {success: false, message: t('form.unauthorized')}
  }

  // Erreurs de validation
  if (isValidationError(error)) {
    return {success: false, message: t('form.validationFailed')}
  }

  // Erreurs générales
  return {success: false, message: t('form.updateFailed')}
}
```

### 4. Validation avec Zod

Pour les erreurs de validation Zod, vous pouvez utiliser des messages localisés :

```typescript
const validationResult = schema.safeParse(data, {
  errorMap(issue, ctx) {
    const path = issue.path.join('.')

    const message = {
      email: t('validation.invalidEmail'),
      password: t('validation.invalidPassword'),
    }[path]

    return {message: message || ctx.defaultError}
  },
})
```

## Exemples d'Utilisation

### Action d'Upload d'Image

```typescript
export async function uploadImageAction(formData: FormData) {
  const t = await getTranslations('AccountPage.EditUserProfileForm')

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return {success: false, message: t('upload.noFile')}
  }

  try {
    const result = await uploadService(file)
    return {
      success: true,
      message: t('upload.success'),
      imageUrl: result.url,
    }
  } catch (error) {
    return {success: false, message: t('upload.errorRetry')}
  }
}
```

### Action de Changement de Mot de Passe

```typescript
export async function changePasswordAction(formData: FormData) {
  const t = await getTranslations(
    'AccountPage.UserSecuritySection.changePassword'
  )

  try {
    await authService.changePassword(data)
    return {success: true, message: t('success')}
  } catch (error) {
    return {success: false, message: t('error')}
  }
}
```

## Avantages

1. **Cohérence** : Messages traduits dans toute l'application
2. **Maintenabilité** : Centralisation des traductions
3. **UX** : Messages d'erreur clairs et localisés
4. **Performance** : Traductions côté serveur (pas de bundle JS supplémentaire)
5. **SEO** : Messages rendus côté serveur

## Limitations

- Les traductions doivent être disponibles dans toutes les langues supportées
- Nécessite une organisation rigoureuse des clés de traduction
- Les messages dynamiques nécessitent une gestion spéciale

## Conclusion

L'utilisation de next-intl dans les Server Actions permet d'avoir une application entièrement internationalisée, avec des messages d'erreur et de succès cohérents et localisés selon les préférences de l'utilisateur.
