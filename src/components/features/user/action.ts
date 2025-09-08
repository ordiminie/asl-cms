'use server'

import {revalidatePath} from 'next/cache'
import {headers} from 'next/headers'
import {getTranslations} from 'next-intl/server'
import z from 'zod'

import {requireActionAuth} from '@/app/dal/user-dal'
import {auth} from '@/lib/better-auth/auth'
import {APP_NAME} from '@/lib/constants'
import {isValidationParsedZodError} from '@/services/errors/validation-error'
import {uploadImageForEntityService} from '@/services/facades/file-service-facade'
import {updateUserService} from '@/services/facades/user-service-facade'
import {updateUserSettingsService} from '@/services/facades/user-service-facade'
import {createTypedNotificationService} from '@/services/notification-service'
import {
  EntityTypeConst,
  FileCategoryConst,
} from '@/services/types/domain/file-types'
import {NotificationTypeConst} from '@/services/types/domain/notification-types'
import {
  Language,
  NotificationChannel,
  Theme,
  UpdateUser,
  UpdateUserSettings,
} from '@/services/types/domain/user-types'

import {
  createUserFormSchema,
  settingsFormSchema,
  SettingsFormSchemaType,
  userFormSchema,
  UserFormSchemaType,
} from '../admin/users/user-form-validation'
import {
  changeEmailFormSchema,
  ChangeEmailFormSchemaType,
  changePasswordFormSchema,
  ChangePasswordFormSchemaType,
  twoFactorFormSchema,
  TwoFactorFormSchemaType,
} from './user-form-validation'

type ValidationError<T = UserFormSchemaType> = {
  field: keyof T
  message: string
}

export type FormState<T = UserFormSchemaType> = {
  success: boolean
  errors?: ValidationError<T>[]
  message?: string
}

export type UploadImageState = {
  success: boolean
  message?: string
  imageUrl?: string
}

export type TwoFactorState = {
  success: boolean
  message?: string
  totpURI?: string
  backupCodes?: string[]
  errors?: ValidationError<TwoFactorFormSchemaType>[]
}

export type VerifyTotpState = {
  success: boolean
  message?: string
  errors?: ValidationError<{code: string}>[]
}

export type ChangePasswordState = {
  success: boolean
  message?: string
  errors?: ValidationError<ChangePasswordFormSchemaType>[]
}

export type ChangeEmailState = {
  success: boolean
  message?: string
  errors?: ValidationError<ChangeEmailFormSchemaType>[]
}

export async function updateUserAction(
  prevState?: FormState<UserFormSchemaType>,
  formData?: FormData
): Promise<FormState<UserFormSchemaType>> {
  // Récupérer les traductions pour les messages d'erreur
  const t = await getTranslations('AccountPage.EditUserProfileForm')

  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: t('form.userNotFound')}
  }
  if (!formData) {
    return {success: false, message: t('form.invalidData')}
  }
  // Extraire les données du FormData
  const userData: UpdateUser = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    image: formData.get('image') as string,
    visibility: formData.get('visibility') as 'public' | 'private',
  }
  // STEP 1 : Valider les données avec le schéma Zod coté back avec traductions
  const userFormSchemaServer = createUserFormSchema(t)
  const validationResult = userFormSchemaServer.safeParse(userData)

  if (!validationResult.success) {
    // Récupérer les messages d'erreur traduits
    const errorMessages = validationResult.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ')
    console.log('errorMessages', errorMessages)
    const validationErrors: ValidationError[] =
      validationResult.error.issues.map((err) => ({
        field: err.path[0] as keyof UserFormSchemaType,
        message: err.message, // Message déjà traduit par errorMap
      }))

    return {
      success: false,
      message: `${t('form.validationFailed')}: ${errorMessages}`,
      errors: validationErrors,
    }
  }
  // STEP 2 : Régles customs coté backend
  if (userData.name?.toString().includes('  ')) {
    return {
      success: false,
      errors: [
        {
          field: 'name',
          message: t('form.nameValidationError'),
        },
      ],
      message: t('form.nameValidationError'),
    }
  }

  const validatedData = validationResult.data as UpdateUser

  try {
    // Utiliser la version avec traductions pour les messages d'erreur côté service
    await updateUserService(validatedData)
    revalidatePath('/account')
    return {success: true, message: t('form.success')}
  } catch (error) {
    console.error(error)
    // Si l'erreur est une erreur de validation Zod au niveau Service
    const validationError = isValidationParsedZodError(error)
    console.log('validationError', validationError)
    if (validationError) {
      return {
        success: false,
        message: `${t('form.validationFailed')}: ${error.message}`,
        errors: error.zodErrorFields?.issues.map((err) => ({
          field: err.path[0] as keyof z.infer<typeof userFormSchema>,
          message: err.message,
        })),
      }
    }
    return {success: false, message: t('form.updateFailed')}
  }
}

export async function uploadProfileImageAction(
  prevState?: UploadImageState,
  formData?: FormData
): Promise<UploadImageState> {
  // Récupérer les traductions pour les messages d'upload
  const t = await getTranslations('AccountPage.EditUserProfileForm')

  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: t('form.userNotFound')}
  }
  if (!formData) {
    return {success: false, message: t('form.invalidData')}
  }

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return {success: false, message: t('upload.errorRetry')}
  }

  try {
    const result = await uploadImageForEntityService({
      file,
      entityType: EntityTypeConst.USER,
      entityId: user.id,
      category: FileCategoryConst.PROFILE,
    })

    return {
      success: true,
      message: t('upload.success'),
      imageUrl: result.url,
    }
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return {
      success: false,
      message: t('upload.errorRetry'),
    }
  }
}

export async function updateUserSettingsAction(
  prevState?: FormState<SettingsFormSchemaType>,
  formData?: FormData
): Promise<FormState<SettingsFormSchemaType>> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  // Construire l'objet settings en ne prenant que les champs présents
  const settingsData: UpdateUserSettings = {
    userId: user.id,
  }

  // Ajouter seulement les champs qui sont présents dans le FormData
  const theme = formData.get('theme')
  if (theme) settingsData.theme = theme as Theme

  const language = formData.get('language')
  if (language) settingsData.language = language as Language

  const timezone = formData.get('timezone')
  if (timezone) settingsData.timezone = timezone as string

  const twoFactorType = formData.get('twoFactorType')
  if (twoFactorType)
    settingsData.twoFactorType = twoFactorType as 'otp' | 'totp'

  const enableEmailNotifications = formData.get('enableEmailNotifications')
  if (enableEmailNotifications !== null) {
    settingsData.enableEmailNotifications = enableEmailNotifications === 'true'
  }

  const enablePushNotifications = formData.get('enablePushNotifications')
  if (enablePushNotifications !== null) {
    settingsData.enablePushNotifications = enablePushNotifications === 'true'
  }

  const notificationChannel = formData.get('notificationChannel')
  if (notificationChannel) {
    settingsData.notificationChannel =
      notificationChannel as NotificationChannel
  }

  const emailDigest = formData.get('emailDigest')
  if (emailDigest !== null) {
    settingsData.emailDigest = emailDigest === 'true'
  }

  const marketingEmails = formData.get('marketingEmails')
  if (marketingEmails !== null) {
    settingsData.marketingEmails = marketingEmails === 'true'
  }

  const validationResult = settingsFormSchema.safeParse(settingsData)

  if (!validationResult.success) {
    const validationErrors = validationResult.error.issues.map((err) => ({
      field: err.path[0] as keyof SettingsFormSchemaType,
      message: err.message,
    }))
    return {
      success: false,
      message: 'Erreur de validation',
      errors: validationErrors,
    }
  }

  try {
    await updateUserSettingsService(validationResult.data)
    revalidatePath('/account')
    return {success: true, message: 'Paramètres mis à jour avec succès'}
  } catch (error) {
    console.error(error)
    return {success: false, message: 'Échec de la mise à jour des paramètres'}
  }
}

export async function update2FAAction(
  prevState?: TwoFactorState,
  formData?: FormData
): Promise<TwoFactorState> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const twoFactorData = {
    action: formData.get('action') as 'enable' | 'disable',
    password: formData.get('password') as string,
  }

  // Validation avec Zod
  const validationResult = twoFactorFormSchema.safeParse(twoFactorData)

  if (!validationResult.success) {
    const validationErrors = validationResult.error.issues.map((err) => ({
      field: err.path[0] as keyof TwoFactorFormSchemaType,
      message: err.message,
    }))
    return {
      success: false,
      message: 'Erreur de validation',
      errors: validationErrors,
    }
  }

  const {action, password} = validationResult.data

  try {
    if (action === 'enable') {
      // Activer le 2FA
      const result = await auth.api.enableTwoFactor({
        headers: await headers(),
        body: {
          password,
          issuer: APP_NAME,
        },
      })
      console.log('enableTwoFactor result', result)
      // better-auth retourne { totpURI: string; backupCodes: string[] } en cas de succès
      if (result.totpURI && result.backupCodes) {
        revalidatePath('/account')
        return {
          success: true,
          message:
            "Authentification à deux facteurs activée avec succès. Veuillez configurer votre application d'authentification.",
          totpURI: result.totpURI,
          backupCodes: result.backupCodes,
        }
      } else {
        return {
          success: false,
          message: "Échec de l'activation du 2FA",
        }
      }
    } else {
      // Désactiver le 2FA
      const result = await auth.api.disableTwoFactor({
        headers: await headers(),
        body: {
          password,
        },
      })

      // better-auth retourne { status: boolean } pour disable
      if (result.status) {
        revalidatePath('/account')
        return {
          success: true,
          message: 'Authentification à deux facteurs désactivée avec succès',
        }
      } else {
        return {
          success: false,
          message: 'Échec de la désactivation du 2FA',
        }
      }
    }
  } catch (error) {
    console.error('Erreur 2FA:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur inattendue lors de la configuration 2FA',
    }
  }
}

export async function verifyTotpAction(
  prevState?: VerifyTotpState,
  formData?: FormData
): Promise<VerifyTotpState> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const code = formData.get('code') as string

  // Validation simple du code
  if (!code || code.trim().length === 0) {
    return {
      success: false,
      message: 'Le code ne peut pas être vide',
      errors: [
        {
          field: 'code',
          message: 'Le code ne peut pas être vide',
        },
      ],
    }
  }

  try {
    console.log('verifyTOTP code', code)
    const result = await auth.api.verifyTOTP({
      headers: await headers(),
      body: {
        code,
        trustDevice: true,
      },
    })
    console.log('verifyTOTP result', result)
    if (result.token) {
      revalidatePath('/account')
      return {
        success: true,
        message:
          'Code validé avec succès ! Votre 2FA est maintenant configuré.',
      }
    } else {
      return {
        success: false,
        message: 'Code incorrect. Veuillez réessayer.',
        errors: [
          {
            field: 'code',
            message: 'Code incorrect. Veuillez réessayer.',
          },
        ],
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification TOTP:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur inattendue lors de la vérification',
      errors: [
        {
          field: 'code',
          message: 'Erreur lors de la vérification du code',
        },
      ],
    }
  }
}

export async function changePasswordAction(
  prevState?: ChangePasswordState,
  formData?: FormData
): Promise<ChangePasswordState> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const passwordData = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  // Validation avec Zod
  const validationResult = changePasswordFormSchema.safeParse(passwordData)

  if (!validationResult.success) {
    const validationErrors = validationResult.error.issues.map((err) => ({
      field: err.path[0] as keyof ChangePasswordFormSchemaType,
      message: err.message,
    }))
    return {
      success: false,
      message: 'Erreur de validation',
      errors: validationErrors,
    }
  }

  const {currentPassword, newPassword} = validationResult.data

  try {
    const result = await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword,
        newPassword,
      },
    })

    if (result) {
      // Créer une notification pour le changement de mot de passe
      try {
        const headersList = await headers()
        const userAgent = headersList.get('user-agent') || undefined
        const xForwardedFor = headersList.get('x-forwarded-for')
        const xRealIp = headersList.get('x-real-ip')
        const ipAddress = xForwardedFor?.split(',')[0] || xRealIp || undefined

        await createTypedNotificationService({
          userId: user.id,
          type: NotificationTypeConst.password_changed,
          metadata: {
            changedAt: new Date().toISOString(),
            ipAddress,
            userAgent,
          },
        })
      } catch (notificationError) {
        // Ne pas faire échouer le changement de mot de passe si la notification échoue
        console.error(
          'Erreur lors de la création de la notification:',
          notificationError
        )
      }

      revalidatePath('/account')
      return {
        success: true,
        message: 'Mot de passe changé avec succès',
      }
    } else {
      return {
        success: false,
        message: 'Échec du changement de mot de passe',
      }
    }
  } catch (error) {
    console.error('Erreur changement mot de passe:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur inattendue lors du changement de mot de passe',
    }
  }
}

export async function changeEmailAction(
  prevState?: ChangeEmailState,
  formData?: FormData
): Promise<ChangeEmailState> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const emailData = {
    newEmail: formData.get('newEmail') as string,
  }

  // Validation avec Zod
  const validationResult = changeEmailFormSchema.safeParse(emailData)

  if (!validationResult.success) {
    const validationErrors = validationResult.error.issues.map((err) => ({
      field: err.path[0] as keyof ChangeEmailFormSchemaType,
      message: err.message,
    }))
    return {
      success: false,
      message: 'Erreur de validation',
      errors: validationErrors,
    }
  }

  const {newEmail} = validationResult.data

  try {
    const result = await auth.api.changeEmail({
      headers: await headers(),
      body: {
        newEmail,
        callbackURL: '/account', // Redirection vers la page compte après vérification
      },
    })

    if (result) {
      revalidatePath('/account')
      return {
        success: true,
        message:
          'Un email de vérification a été envoyé à votre adresse actuelle pour confirmer le changement.',
      }
    } else {
      return {
        success: false,
        message: "Échec de la demande de changement d'email",
      }
    }
  } catch (error) {
    console.error('Erreur changement email:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erreur inattendue lors du changement d'email",
    }
  }
}
