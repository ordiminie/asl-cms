'use server'

import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {
  authLoginFormSchema,
  authMagicLinkFormSchema,
  authRegisterFormSchema,
} from '@/components/features/auth/auth-form-validation'
import {AuthMethod, env} from '@/env'
import {auth, AuthAppConfig} from '@/lib/better-auth/auth' // path to your Better Auth server instance
import {
  getUserByEmailService,
  isEmailAvailableService,
} from '@/services/facades/user-service-facade'
//import {APIError} from 'better-auth'

type LoginValidationError = {
  field: keyof z.infer<typeof authLoginFormSchema>
  message: string
}

type RegisterValidationError = {
  field: keyof z.infer<typeof authRegisterFormSchema>
  message: string
}

type MagicLinkValidationError = {
  field: keyof z.infer<typeof authMagicLinkFormSchema>
  message: string
}

type LoginFormState = {
  success: boolean
  errors?: LoginValidationError[]
  message?: string
}

type RegisterFormState = {
  success: boolean
  errors?: RegisterValidationError[]
  message?: string
}

type MagicLinkFormState = {
  success: boolean
  errors?: MagicLinkValidationError[]
  message?: string
}

type RecoveryFormState = {
  success: boolean
  message?: string
}

type OtpFormState = {
  success: boolean
  message?: string
}

/**
 * Action de connexion avec les credentials email/password
 *
 * @param prevState
 * @param formData
 * @returns
 */
export async function loginCredentialAction(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const t = await getTranslations('AuthActions.login')

  // Vérifier si credential est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes('credential')) {
    return {
      success: false,
      message: 'Credential authentication is not enabled',
    }
  }

  try {
    // 1. Validation Server Zod des données du formulaire
    const validationResult = authLoginFormSchema.safeParse({
      email: formData.get('email')?.toString().toLowerCase(),
      password: formData.get('password'),
    })

    if (!validationResult.success) {
      const validationErrors: LoginValidationError[] =
        validationResult.error.issues.map((err) => ({
          field: err.path[0] as keyof z.infer<typeof authLoginFormSchema>,
          message: err.message,
        }))
      return {
        success: false,
        message: t('validationError'),
        errors: validationErrors,
      }
    }

    const {email, password} = validationResult.data

    // 2. verification de l'email en bdd (optionel)
    const user = await getUserByEmailService(email)

    if (!user) {
      return {
        success: false,
        message: t('userNotFound'),
      }
    }

    if (user.banned) {
      let bannedMessage = t('userBanned.base')

      // Ajouter la raison si elle existe
      if (user.banReason) {
        bannedMessage += ` ${t('userBanned.reason', {reason: user.banReason})}`
      }

      // Ajouter la date d'expiration si elle existe
      if (user.banExpires) {
        const expiryDate = new Date(user.banExpires)
        const now = new Date()

        if (expiryDate > now) {
          bannedMessage += ` ${t('userBanned.expires', {
            date: expiryDate.toLocaleDateString(),
            time: expiryDate.toLocaleTimeString(),
          })}`
        }
      } else {
        // Ban permanent
        bannedMessage += ` ${t('userBanned.permanent')}`
      }

      return {
        success: false,
        message: bannedMessage,
      }
    }

    const twoFactorType = user.settings?.twoFactorType

    // Login Credential
    const response = await auth.api.signInEmail({
      body: {
        email,
        password: password ?? '',
        callbackURL: '/dashboard',
      },
      asResponse: true, // returns a response object instead of data
    })

    if (!response.ok) {
      return {
        success: false,
        message: t('invalidCredentials'),
      }
    }

    let twoFactorRedirect
    let responseData
    try {
      responseData = await response.json()
      twoFactorRedirect = responseData.twoFactorRedirect
    } catch {
      twoFactorRedirect = false
    }

    if (!twoFactorRedirect) {
      //CAS Sans 2FA
      redirect(response.headers.get('Location') ?? responseData?.url ?? '/404') //callbackURL
    } else {
      //CAS Avec 2FA - Rediriger vers la page appropriée
      if (twoFactorType === 'otp') {
        redirect('/verify-request/otp')
      } else {
        redirect('/verify-request/totp')
      }
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    return {
      success: false,
      message: t('connectionError'),
    }
  }
}

export async function loginMagicLinkAction(
  prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState> {
  const t = await getTranslations('AuthActions.magicLink')

  // Vérifier si magiclink est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')) {
    return {
      success: false,
      message: 'Magic link authentication is not enabled',
    }
  }

  try {
    // 1. Validation Server Zod des données du formulaire
    const validationResult = authMagicLinkFormSchema.safeParse({
      email: formData.get('email')?.toString().toLowerCase(),
    })

    if (!validationResult.success) {
      const validationErrors: MagicLinkValidationError[] =
        validationResult.error.issues.map((err) => ({
          field: err.path[0] as keyof z.infer<typeof authMagicLinkFormSchema>,
          message: err.message,
        }))
      return {
        success: false,
        message: t('validationError'),
        errors: validationErrors,
      }
    }

    const {email} = validationResult.data

    // 2. Vérification de l'existence de l'utilisateur (optionnel)
    const user = await getUserByEmailService(email)
    if (!user) {
      return {
        success: false,
        message: t('userNotFound'),
      }
    }

    // 3. Envoi du magic link avec better auth
    const response = await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email,
        callbackURL: '/dashboard',
      },
    })

    if (!response.status) {
      return {
        success: false,
        message: t('sendError'),
      }
    }

    redirect('/verify-request')
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    return {
      success: false,
      message: t('unexpectedError'),
    }
  }
}

/**
 * Action d'inscription d'un nouvel utilisateur
 */
export async function registerCredentialAction(
  prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const t = await getTranslations('AuthActions.register')

  // Vérifier si credential est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes('credential')) {
    return {
      success: false,
      message: 'Credential authentication is not enabled',
    }
  }

  // 1. Validation server  Zod des données du formulaire
  const validationResult = authRegisterFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email')?.toString().toLowerCase(),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!validationResult.success) {
    const validationErrors: RegisterValidationError[] =
      validationResult.error.issues.map((err) => ({
        field: err.path[0] as keyof z.infer<typeof authRegisterFormSchema>,
        message: err.message,
      }))
    return {
      success: false,
      message: t('validationError'),
      errors: validationErrors,
    }
  }

  const {name, email, password} = validationResult.data

  // 2. Vérifier si l'email est disponible
  const isEmailAvailable = await isEmailAvailableService(email)
  if (!isEmailAvailable) {
    return {
      success: false,
      errors: [
        {
          field: 'email',
          message: t('emailAlreadyUsed'),
        },
      ],
    }
  }

  // 3. creation de l'utilisateur avec better auth
  const response = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: password ?? '',
    },
    asResponse: true,
  })

  if (!response.ok && response.status !== 302) {
    return {
      success: false,
      message: t('userCreationError'),
    }
  }

  try {
    if (!AuthAppConfig.requireEmailVerification) {
      const response = await auth.api.signInEmail({
        headers: await headers(),
        body: {
          email,
          password,
          rememberMe: true,
        },
        asResponse: true,
      })

      if (!response.ok && response.status !== 302) {
        return {
          success: false,
          message: t('invalidCredentials'),
        }
      }
      redirect(response.headers.get('Location') ?? '/404')
    }

    redirect('/verify-request')
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    // Si l'erreur est une erreur technique generique
    return {
      success: false,
      message:
        error instanceof Error
          ? `Error technique : ${error.message}`
          : t('accountCreationError'),
      errors: [],
    }
  }
}

/**
 * Action pour l'inscription avec un provider OAuth (Google, Apple)
 */
export async function loginProviderAction(
  provider:
    | 'google'
    | 'apple'
    | 'github'
    | 'discord'
    | 'facebook'
    | 'twitter'
    | 'linkedin'
): Promise<LoginFormState> {
  const t = await getTranslations('AuthActions.loginProvider')

  // Vérifier si le provider est activé (seulement pour google et apple pour l'instant)
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes(provider as AuthMethod)) {
    return {
      success: false,
      message: `${provider} authentication is not enabled`,
    }
  }

  try {
    const response = await auth.api.signInSocial({
      headers: await headers(),
      body: {
        provider,
        callbackURL: '/dashboard',
      },
    })
    if (response.url) {
      redirect(response.url)
    }
    return {
      success: true,
      message: t('redirecting'),
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? `Error technique : ${error.message}`
          : t('connectionError'),
      errors: [],
    }
  }
}

/**
 * Action d'inscription d'un nouvel utilisateur
 */
export async function registerMagicLinkAction(
  prevState: MagicLinkFormState,
  formData: FormData
): Promise<MagicLinkFormState> {
  const t = await getTranslations('AuthActions.registerMagicLink')

  // Vérifier si magiclink est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')) {
    return {
      success: false,
      message: 'Magic link authentication is not enabled',
    }
  }

  // 1. Validation server  Zod des données du formulaire
  const validationResult = authMagicLinkFormSchema.safeParse({
    email: formData.get('email')?.toString().toLowerCase(),
  })

  if (!validationResult.success) {
    const validationErrors: MagicLinkValidationError[] =
      validationResult.error.issues.map((err) => ({
        field: err.path[0] as keyof z.infer<typeof authMagicLinkFormSchema>,
        message: err.message,
      }))
    return {
      success: false,
      message: t('validationError'),
      errors: validationErrors,
    }
  }

  const {email} = validationResult.data

  // 2. Vérifier si l'email est disponible
  const isEmailAvailable = await isEmailAvailableService(email)
  if (!isEmailAvailable) {
    return {
      success: false,
      errors: [
        {
          field: 'email',
          message: t('emailAlreadyUsed'),
        },
      ],
    }
  }
  // 3. Envoi du magic link avec better auth
  const response = await auth.api.signInMagicLink({
    headers: await headers(),
    body: {
      email,
      callbackURL: '/dashboard',
    },
  })

  if (!response.status) {
    return {
      success: false,
      message: t('sendError'),
    }
  }

  // 4. Créer son organisation dans la base de données
  try {
    redirect('/verify-request')
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    return {
      success: false,
      message: t('unexpectedError'),
    }
  }
  return {
    success: true,
    message: t('linkSent'),
  }
}

/**
 * Action pour l'inscription avec un provider OAuth (Google, Apple)
 */
export async function registerProviderAction(
  provider: 'google' | 'apple' | 'github'
): Promise<LoginFormState> {
  const t = await getTranslations('AuthActions.registerProvider')

  // Vérifier si le provider est activé
  if (!env.NEXT_PUBLIC_AUTH_METHODS.includes(provider)) {
    return {
      success: false,
      message: `${provider} authentication is not enabled`,
    }
  }

  await loginProviderAction(provider)
  return {
    success: true,
    message: t('redirecting'),
  }
}

export async function logoutAction() {
  await auth.api.signOut({
    headers: await headers(),
    asResponse: true,
  })
}

/**
 * Action pour vérifier un code de sauvegarde 2FA
 */
export async function verifyBackupCodeAction(
  prevState: RecoveryFormState,
  formData: FormData
): Promise<RecoveryFormState> {
  const t = await getTranslations('AuthActions.verifyBackupCode')

  try {
    const code = formData.get('code') as string

    // Validation basique du code
    if (!code || code.trim().length === 0) {
      return {
        success: false,
        message: t('emptyCode'),
      }
    }

    // Vérification du code de sauvegarde avec Better Auth
    const response = await auth.api.verifyBackupCode({
      headers: await headers(),
      body: {
        code: code.trim(),
      },
    })

    // Si la vérification réussit, rediriger vers le dashboard
    if (response.token) {
      redirect('/dashboard')
    }

    return {
      success: false,
      message: t('invalidCode'),
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    console.error(
      'Erreur lors de la vérification du code de sauvegarde:',
      error
    )

    return {
      success: false,
      message: t('verificationError'),
    }
  }
}

/**
 * Action pour vérifier un code OTP
 */
export async function verifyOTPAction(
  prevState: OtpFormState,
  formData: FormData
): Promise<OtpFormState> {
  const t = await getTranslations('AuthActions.verifyOTP')

  try {
    const code = formData.get('code') as string

    // Validation basique du code
    if (!code || code.trim().length === 0) {
      return {
        success: false,
        message: t('emptyCode'),
      }
    }

    // DEBUG: Vérifier les headers de session
    const currentHeaders = await headers()

    // Vérification du code OTP avec Better Auth
    const response = await auth.api.verifyTwoFactorOTP({
      headers: currentHeaders,
      body: {
        code: code.trim(),
        trustDevice: true,
        // callbackURL: '/dashboard',
      },
      asResponse: true,
    })

    // Si la vérification réussit, rediriger vers le dashboard
    if (response.ok) {
      redirect('/dashboard')
    }
    // Si la vérification échoue
    const errorData = await response.json()

    return {
      success: false,
      message: errorData.message || t('invalidCode'),
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    console.error('Erreur lors de la vérification OTP:', error)

    return {
      success: false,
      message: t('verificationError'),
    }
  }
}
