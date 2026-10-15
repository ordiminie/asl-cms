'use server'

import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {getPostLoginPathOfAccountDal} from '@/app/dal/user-dal'
import {
  authLoginFormSchema,
  createMagicLinkRequestSchema,
} from '@/components/features/auth/auth-form-validation'
import {env} from '@/env'
import {auth} from '@/lib/better-auth/auth'
import {MAGIC_LINK_REQUEST_MIN_DURATION_MS} from '@/lib/better-auth/magic-link-constants'
import {isEmailTransportError} from '@/lib/emails/transport'
import {buildBannedMessage, isUserBanned} from '@/lib/helper/auth-helper'
import {resolveSupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'
import {getUserByEmailService} from '@/services/facades/user-service-facade'

type LoginValidationError = {
  field: keyof z.infer<typeof authLoginFormSchema>
  message: string
}

type LoginFormState = {
  success: boolean
  errors?: LoginValidationError[]
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

    // Aucune consultation du compte avant la connexion : compte inconnu,
    // mauvais mot de passe et refus d'association rendent le meme message
    // (s46b, ADR 034). Les en-tetes portent le domaine appele, que le
    // controle d'ouverture de session lit.
    const response = await auth.api.signInEmail({
      headers: await headers(),
      body: {
        email,
        password: password ?? '',
        callbackURL: '/login/destination',
      },
      asResponse: true,
    })

    if (!response.ok) {
      if (await isBannedResponse(response)) {
        await redirectBannedUser(email, t)
      }
      return {
        success: false,
        message: t('invalidCredentials'),
      }
    }

    const twoFactorRedirect = await isTwoFactorRedirect(response)
    if (!twoFactorRedirect) {
      return await redirectToPostLoginPath(email)
    } else {
      const user = await getUserByEmailService(email)
      redirect(
        user?.settings?.twoFactorType === 'otp'
          ? '/verify-request/otp'
          : '/verify-request/totp'
      )
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

type LoginTranslator = Awaited<
  ReturnType<typeof getTranslations<'AuthActions.login'>>
>

/** Le refus du plugin `admin()` pour un compte banni (403 `BANNED_USER`). */
const isBannedResponse = async (response: Response) => {
  if (response.status !== 403) return false
  try {
    const body = await response.clone().json()
    return body?.code === 'BANNED_USER'
  } catch {
    return false
  }
}

/**
 * Redirige le compte qui vient d'ouvrir sa session vers sa **page finale**
 * (revue M1 de s46b). Pas vers `/login/destination` : apres une Server Action,
 * Next suit cote serveur la chaine de redirections et laisse la barre
 * d'adresse sur la premiere adresse.
 */
const redirectToPostLoginPath = async (
  email: string | undefined
): Promise<never> => {
  redirect(await postLoginPathOfSignedInAccount(email))
}

/**
 * La session est deja ouverte : un compte introuvable ou une lecture en echec
 * ne renvoie pas vers `/login` mais vers l'espace membre, et se journalise
 * (revue m7 de s46b).
 */
const postLoginPathOfSignedInAccount = async (email: string | undefined) => {
  try {
    const path = email ? await getPostLoginPathOfAccountDal(email) : undefined
    if (path) return path
    logger.error('[LOGIN] Compte introuvable apres une connexion reussie')
  } catch (error) {
    logger.error(
      '[LOGIN] Lecture du compte en echec apres une connexion reussie',
      {error}
    )
  }
  return '/dashboard'
}

/** L'email du compte que Better Auth rend apres une verification 2FA. */
const signedInEmailOf = (body: unknown): string | undefined => {
  const email = (body as {user?: {email?: unknown}} | null)?.user?.email
  return typeof email === 'string' ? email : undefined
}

const isTwoFactorRedirect = async (response: Response) => {
  try {
    const body = await response.json()
    return Boolean(body?.twoFactorRedirect)
  } catch {
    return false
  }
}

/**
 * Le bannissement n'est connu qu'apres un mot de passe correct, sur le
 * domaine de l'association du compte : le message traduit est alors construit
 * comme avant s46b.
 */
const redirectBannedUser = async (email: string, t: LoginTranslator) => {
  const user = await getUserByEmailService(email)
  if (!user || !isUserBanned(user)) return
  const message = buildBannedMessage(user, {
    base: t('userBanned.base'),
    reason: ({reason}) => t('userBanned.reason', {reason}),
    expires: ({date, time}) => t('userBanned.expires', {date, time}),
    permanent: t('userBanned.permanent'),
  })
  redirect(`/auth-error?error=banned&message=${encodeURIComponent(message)}`)
}

export type MagicLinkRequestState =
  | {status: 'idle'}
  | {status: 'sent'}
  | {status: 'invalid'; errors: {field: 'email'; message: string}[]}
  | {status: 'unavailable'}

const waitUntil = async (deadline: number) => {
  const remaining = deadline - Date.now()
  if (remaining <= 0) return
  await new Promise<void>((resolve) => setTimeout(resolve, remaining))
}

/**
 * Demande d'un lien de connexion (s03, ecrans A et B).
 *
 * Le resultat est **le meme** pour une adresse connue ou non, et la reponse
 * dure au moins `MAGIC_LINK_REQUEST_MIN_DURATION_MS` dans les deux cas (§7).
 * Un echec d'envoi rend l'etat « service en panne », jamais une exception.
 * La locale vient du formulaire, pas de next-intl : une Server Action ne lit
 * que le cookie `NEXT_LOCALE`, absent d'un navigateur neuf. Verifiee contre le
 * routage, francais sinon (ADR 008) ; `metadata` la porte jusqu'a l'email.
 */
export async function requestMagicLinkAction(
  prevState: MagicLinkRequestState,
  formData: FormData
): Promise<MagicLinkRequestState> {
  const locale = resolveSupportedLocale(formData.get('locale'))
  const t = await getTranslations({locale, namespace: 'Auth.MagicLinkLogin'})

  const validation = createMagicLinkRequestSchema(t).safeParse({
    email: formData.get('email')?.toString() ?? '',
  })
  if (!validation.success) {
    return {
      status: 'invalid',
      errors: validation.error.issues.map((issue) => ({
        field: 'email',
        message: issue.message,
      })),
    }
  }

  const deadline = Date.now() + MAGIC_LINK_REQUEST_MIN_DURATION_MS
  let result: MagicLinkRequestState
  try {
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email: validation.data.email,
        callbackURL: '/login/destination',
        errorCallbackURL: '/login/lien-invalide',
        metadata: {locale},
      },
    })
    result = {status: 'sent'}
  } catch (error) {
    logger.error("[MAGIC-LINK] Echec de l'envoi du lien de connexion", {
      reason: isEmailTransportError(error) ? 'transport' : 'unexpected',
    })
    result = {status: 'unavailable'}
  }

  await waitUntil(deadline)
  return result
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

    if (response.token) {
      return await redirectToPostLoginPath(signedInEmailOf(response))
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
      },
      asResponse: true,
    })

    if (response.ok) {
      return await redirectToPostLoginPath(
        signedInEmailOf(await response.json())
      )
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
