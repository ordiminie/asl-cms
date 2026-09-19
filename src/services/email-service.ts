import {Subscription} from '@better-auth/stripe'
import {getLocale, getTranslations} from 'next-intl/server'
import type {ReactNode} from 'react'
import {render} from 'react-email'

import {getUserByStripeCustomerIdDao} from '@/db/repositories/user-repository'
import {env} from '@/env'
import {MAGIC_LINK_EXPIRES_IN_MINUTES} from '@/lib/better-auth/magic-link-constants'
import AdminNotificationEmail from '@/lib/emails/admin-notification-email'
import EmailChangeEmailVerification from '@/lib/emails/email-change-email-verification'
import InternalEmail from '@/lib/emails/internal-email'
import InvitationOrganizationLinkMail from '@/lib/emails/invitation-organization-link-email'
import MagicLinkMail, {
  type MagicLinkEmailAssociation,
} from '@/lib/emails/magic-link-email'
import NotificationEmail from '@/lib/emails/notification-email'
import OtpEmail from '@/lib/emails/otp-email'
import ResetPasswordEmail from '@/lib/emails/reset-password-email'
import SubscriptionCanceledMail from '@/lib/emails/subscription-canceled-email'
import SubscriptionCompletedMail from '@/lib/emails/subscription-completed-email'
import SubscriptionDeletedMail from '@/lib/emails/subscription-deleted-email'
import SubscriptionUpdatedMail from '@/lib/emails/subscription-updated-email'
import {getEmailTransport} from '@/lib/emails/transport'
import VerificationEmail from '@/lib/emails/verification-email'
import WelcomeFollowUpEmail from '@/lib/emails/welcome-follow-up-email'
import type {SupportedLocale} from '@/lib/helper/locale-helper'
import {
  getFormattedPriceFromSubscription,
  getSubscriptionDetails,
} from '@/lib/stripe/stripe-utils'

import {
  getBooleanSettingService,
  getStringSettingService,
} from './app-settings-service'
import {getPlanByPriceIdService} from './subscription-service'
import {AppSettingKeys} from './types/domain/app-settings-types'

const DEFAULT_EMAIL_FROM = 'onboarding@resend.dev'

const getEmailFrom = async (): Promise<string> => {
  try {
    const settingEmail = await getStringSettingService(
      AppSettingKeys.EMAIL_COMMUNICATION_EMAIL
    )
    if (settingEmail && settingEmail.trim() !== '') {
      return settingEmail
    }
  } catch {
    // Ignore error, fallback to env or default
  }
  return env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM
}

export type EmailRecipientType = 'admin' | 'client' | 'system'

const shouldSendEmail = async (
  recipientType: EmailRecipientType
): Promise<boolean> => {
  // System emails (magic link, OTP, verification, password reset) are never blocked
  if (recipientType === 'system') {
    return true
  }

  try {
    const globalEnabled = await getBooleanSettingService(
      AppSettingKeys.EMAIL_ENABLED
    )
    if (!globalEnabled) return false

    if (recipientType === 'admin') {
      return await getBooleanSettingService(
        AppSettingKeys.EMAIL_ENABLED_FOR_ADMINS
      )
    }
    if (recipientType === 'client') {
      return await getBooleanSettingService(
        AppSettingKeys.EMAIL_ENABLED_FOR_CLIENTS
      )
    }
    return true
  } catch {
    return true
  }
}

export const sendSimpleEmailService = async ({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) => {
  const fromEmail = await getEmailFrom()
  await sendEmailService({
    to,
    subject,
    text,
    from: fromEmail,
  })
}

/**
 * Un email a envoyer : la version texte est toujours fournie (design system
 * §5), le gabarit `react` est rendu en HTML avant de partir.
 */
export type SendEmailPayload = {
  to: string
  subject: string
  text: string
  from?: string
  react?: ReactNode | Promise<ReactNode>
}

export interface SendEmailOptions {
  recipientType?: EmailRecipientType
}

/**
 * Point d'envoi unique du produit : tout email part par le contrat
 * `EmailTransport` (ADR 005, ADR 017), jamais par un fournisseur directement.
 * Un echec du transport remonte tel quel (`EmailTransportError`).
 */
export const sendEmailService = async (
  payload: SendEmailPayload,
  options?: SendEmailOptions
) => {
  const recipientType = options?.recipientType ?? 'client'
  const canSend = await shouldSendEmail(recipientType)
  if (!canSend) {
    console.log('[EMAIL] Disabled by settings, skipping:', payload.subject)
    return
  }

  const subject =
    env.NEXT_PUBLIC_NODE_ENV === 'development'
      ? `[DEV] ${payload.subject}`
      : payload.subject

  const fromEmail = await getEmailFrom()
  const template = payload.react ? await payload.react : undefined
  const html = template ? await render(template) : undefined

  await getEmailTransport().send({
    from: fromEmail,
    to: payload.to,
    subject,
    text: payload.text,
    ...(html ? {html} : {}),
  })
}

interface SendOrganizationInvitationParams {
  email: string
  invitedByUsername: string
  invitedByEmail: string
  teamName: string
  inviteLink: string
}

export const sendOrganizationInvitation = async ({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: SendOrganizationInvitationParams) => {
  const t = await getTranslations('email.user.organizationInvitation')
  const fromEmail = await getEmailFrom()

  await sendEmailService({
    to: email,
    subject: t('subject', {teamName}),
    from: fromEmail,
    text: `${t('invitationMessage', {
      invitedByUsername,
      invitedByEmail,
      teamName,
    })} ${t('acceptInvitation')} ${inviteLink}`,
    react: InvitationOrganizationLinkMail({
      invitedByUsername,
      invitedByEmail,
      teamName,
      inviteLink,
    }),
  })
}

/**
 * Email de connexion (s03) : gabarit de l'association du domaine appele,
 * version texte complete (URL en clair). La locale est **explicite** : envoye
 * depuis une Server Action, l'email n'aurait sinon que le cookie `NEXT_LOCALE`
 * pour la trouver, absent d'un navigateur neuf (email parti en anglais). Ni l'URL ni le jeton ne sont
 * journalises ; l'intercepteur de la facade n'en logge pas les arguments.
 */
export const sendMagicLinkEmailService = async ({
  email,
  url,
  association,
  locale,
}: {
  email: string
  url: string
  association: MagicLinkEmailAssociation
  locale: SupportedLocale
}) => {
  const t = await getTranslations({locale, namespace: 'email.user.magicLink'})
  const values = {
    name: association.name,
    minutes: MAGIC_LINK_EXPIRES_IN_MINUTES,
  }
  const text = [
    t('title'),
    t.markup('intro', {...values, strong: (chunks) => chunks}),
    `${t('urlIntro')}\n${url}`,
    t('ignore'),
    t('footer', values),
  ].join('\n\n')

  await sendEmailService(
    {
      to: email,
      subject: t('subject', values),
      text,
      react: MagicLinkMail({url, association, locale}),
    },
    {recipientType: 'system'}
  )
}

export const sendVerificationEmailService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.verification')
  const fromEmail = await getEmailFrom()

  await sendEmailService(
    {
      to: email,
      subject: t('subject'),
      from: fromEmail,
      text: t('preview'),
      react: VerificationEmail({url}),
    },
    {recipientType: 'system'}
  )
}

export const sendResetPasswordLinkEmailService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.resetPassword')
  const fromEmail = await getEmailFrom()

  await sendEmailService(
    {
      to: email,
      subject: t('subject'),
      from: fromEmail,
      text: t('preview'),
      react: ResetPasswordEmail({url}),
    },
    {recipientType: 'system'}
  )
}

export const sendOTPEmailService = async ({
  email,
  otp,
  otpLink,
}: {
  email: string
  otp: string
  otpLink?: string
}) => {
  const t = await getTranslations('email.user.otp')
  const fromEmail = await getEmailFrom()

  await sendEmailService(
    {
      to: email,
      subject: t('subject'),
      from: fromEmail,
      text: `${t('description')} ${otp}${otpLink ? `\n\n${t('verifyAutomatically')} : ${otpLink}` : ''}`,
      react: OtpEmail({otp, otpLink}),
    },
    {recipientType: 'system'}
  )
}

export const sendEmailChangeEmailVerificationService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.emailChange')
  const fromEmail = await getEmailFrom()

  await sendEmailService(
    {
      to: email,
      subject: t('subject'),
      from: fromEmail,
      text: t('preview'),
      react: EmailChangeEmailVerification({url}),
    },
    {recipientType: 'system'}
  )
}

export const sendNotificationEmailService = async ({
  email,
  title,
  message,
  type = 'info',
  language = 'fr',
}: {
  email: string
  title: string
  message: string
  type?: 'info' | 'warning' | 'success' | 'error'
  language?: 'fr' | 'en' | 'es'
}) => {
  const t = await getTranslations({
    locale: language,
    namespace: 'email.user.notification',
  })
  const fromEmail = await getEmailFrom()

  await sendEmailService({
    to: email,
    subject: t('subject', {title}),
    from: fromEmail,
    text: t('preview'),
    react: NotificationEmail({
      title,
      message,
      type,
      preview: t('preview'),
      language,
    }),
  })
}

export const sendSubscriptionCompletedEmailService = async (
  subscription: Subscription
) => {
  const locale = await getLocale()
  const t = await getTranslations('email.user.subscriptionCompleted')
  const fromEmail = await getEmailFrom()

  if (!subscription.stripeCustomerId) {
    console.error('Pas de stripeCustomerId dans la subscription')
    return
  }

  const stripeSubscriptionUpdated = await getSubscriptionDetails(
    subscription.stripeSubscriptionId ?? ''
  )
  const plan = await getPlanByPriceIdService(
    stripeSubscriptionUpdated?.items.data[0].price.id ?? ''
  )
  const user = await getUserByStripeCustomerIdDao(subscription.stripeCustomerId)
  if (!user) {
    console.error(
      'Utilisateur non trouvé pour stripeCustomerId:',
      subscription.stripeCustomerId
    )
    return
  }

  // Extraire les informations de la subscription
  const planName = subscription.plan || plan?.planName || 'Plan inconnu'
  const status = subscription.status || 'actif'

  // Informations du plan
  const seats = subscription.seats ? `${subscription.seats}` : 'Non défini'
  const price = getFormattedPriceFromSubscription(stripeSubscriptionUpdated)
  const limits = plan?.limits
    ? Object.entries(plan.limits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : 'Non défini'

  // Calculer les dates
  const periodEnd = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : 'Non disponible'

  const nextBilling = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : 'Non disponible'

  await sendEmailService({
    to: user.email,
    subject: t('subject', {planName}),
    from: fromEmail,
    text: t('preview', {planName}),
    react: SubscriptionCompletedMail({
      planName,
      status,
      seats,
      price,
      limits,
      nextBilling,
      periodEnd,
    }),
  })
}

export const sendSubscriptionUpdatedEmailService = async (
  subscription: Subscription
) => {
  const locale = await getLocale()
  const t = await getTranslations('email.user.subscriptionUpdated')
  const fromEmail = await getEmailFrom()

  if (!subscription.stripeCustomerId) {
    console.error('Pas de stripeCustomerId dans la subscription')
    return
  }
  const stripeSubscription = await getSubscriptionDetails(
    subscription.stripeSubscriptionId ?? ''
  )
  const plan = await getPlanByPriceIdService(
    stripeSubscription?.items.data[0].price.id ?? ''
  )

  const user = await getUserByStripeCustomerIdDao(subscription.stripeCustomerId)
  if (!user) {
    console.error(
      'Utilisateur non trouvé pour stripeCustomerId:',
      subscription.stripeCustomerId
    )
    return
  }

  // Extraire les informations de la subscription
  const planName = subscription.plan || plan?.planName || 'Plan inconnu'
  const status = subscription.status || 'actif'

  // Informations du plan
  const seats = subscription.seats ? `${subscription.seats}` : 'Non défini'
  const price = getFormattedPriceFromSubscription(stripeSubscription)
  const limits = plan?.limits
    ? Object.entries(plan.limits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : 'Non défini'

  // Calculer les dates
  const periodEnd = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : 'Non disponible'

  const nextBilling = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : 'Non disponible'

  await sendEmailService({
    to: user.email,
    subject: t('subject', {planName}),
    from: fromEmail,
    text: t('preview', {planName}),
    react: SubscriptionUpdatedMail({
      planName,
      status,
      seats,
      price,
      limits,
      nextBilling,
      periodEnd,
    }),
  })
}

export const sendSubscriptionCanceledEmailService = async (
  subscription: Subscription
) => {
  const locale = await getLocale()
  const t = await getTranslations('email.user.subscriptionCanceled')
  const fromEmail = await getEmailFrom()

  if (!subscription.stripeCustomerId) {
    console.error('Pas de stripeCustomerId dans la subscription')
    return
  }

  const stripeSubscriptionCanceled = await getSubscriptionDetails(
    subscription.stripeSubscriptionId ?? ''
  )
  const plan = await getPlanByPriceIdService(
    stripeSubscriptionCanceled?.items.data[0].price.id ?? ''
  )
  const user = await getUserByStripeCustomerIdDao(subscription.stripeCustomerId)
  if (!user) {
    console.error(
      'Utilisateur non trouvé pour stripeCustomerId:',
      subscription.stripeCustomerId
    )
    return
  }

  // Extraire les informations de la subscription
  const planName = subscription.plan || plan?.planName || 'Plan inconnu'
  const status = subscription.status || 'annulé'

  // Informations du plan
  const seats = subscription.seats ? `${subscription.seats}` : 'Non défini'
  const price = getFormattedPriceFromSubscription(stripeSubscriptionCanceled)
  const limits = plan?.limits
    ? Object.entries(plan.limits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : 'Non défini'

  // Calculer les dates
  const canceledAt = new Date().toLocaleDateString(locale)

  const periodEnd = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString(locale)
    : 'Non disponible'

  await sendEmailService({
    to: user.email,
    subject: t('subject', {planName}),
    from: fromEmail,
    text: t('preview', {planName}),
    react: SubscriptionCanceledMail({
      planName,
      status,
      seats,
      price,
      limits,
      canceledAt,
      periodEnd,
    }),
  })
}

export const sendSubscriptionDeletedEmailService = async (
  subscription: Subscription
) => {
  const locale = await getLocale()
  const t = await getTranslations('email.user.subscriptionDeleted')
  const fromEmail = await getEmailFrom()

  if (!subscription.stripeCustomerId) {
    console.error('Pas de stripeCustomerId dans la subscription')
    return
  }

  const stripeSubscriptionDeleted = await getSubscriptionDetails(
    subscription.stripeSubscriptionId ?? ''
  )
  const plan = await getPlanByPriceIdService(
    stripeSubscriptionDeleted?.items.data[0].price.id ?? ''
  )
  const user = await getUserByStripeCustomerIdDao(subscription.stripeCustomerId)
  if (!user) {
    console.error(
      'Utilisateur non trouvé pour stripeCustomerId:',
      subscription.stripeCustomerId
    )
    return
  }

  // Extraire les informations de la subscription
  const planName = subscription.plan || plan?.planName || 'Plan inconnu'
  const status = subscription.status || 'supprimé'

  // Informations du plan
  const seats = subscription.seats ? `${subscription.seats}` : 'Non défini'
  const price = getFormattedPriceFromSubscription(stripeSubscriptionDeleted)
  const limits = plan?.limits
    ? Object.entries(plan.limits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : 'Non défini'

  // Date de suppression
  const deletedAt = new Date().toLocaleDateString(locale)

  await sendEmailService({
    to: user.email,
    subject: t('subject', {planName}),
    from: fromEmail,
    text: t('preview', {planName}),
    react: SubscriptionDeletedMail({
      planName,
      status,
      seats,
      price,
      limits,
      deletedAt,
    }),
  })
}

export const sendWelcomeFollowUpEmailService = async ({
  email,
  userName,
  appUrl,
  language = 'fr',
}: {
  email: string
  userName: string
  appUrl: string
  language?: 'fr' | 'en' | 'es'
}) => {
  const t = await getTranslations({
    locale: language,
    namespace: 'WelcomeFollowUpEmail',
  })
  const fromEmail = await getEmailFrom()

  await sendEmailService({
    to: email,
    subject: t('title'),
    from: fromEmail,
    text: t('message'),
    react: WelcomeFollowUpEmail({
      userName,
      userEmail: email,
      appUrl,
      language,
    }),
  })
}

export const sendInternalEmailService = async ({
  title,
  data,
}: {
  title: string
  data: string
}) => {
  const t = await getTranslations('email.admin.internal')
  const fromEmail = await getEmailFrom()
  const toEmail = env.EMAIL_TO ?? env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService(
    {
      to: toEmail,
      subject: `${t('subject')} - ${title}`,
      from: fromEmail,
      text: t('preview'),
      react: InternalEmail({
        preview: t('preview'),
        content: data,
      }),
    },
    {recipientType: 'admin'}
  )
}

interface SendAdminInternalEmailParams {
  title: string
  data: string
}

export const sendAdminInternalEmailService = async ({
  title,
  data,
}: SendAdminInternalEmailParams) => {
  const fromEmail = await getEmailFrom()
  const toEmail = env.EMAIL_TO ?? env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService(
    {
      to: toEmail,
      subject: `[Admin] ${title}`,
      text: `${title}\n\n${data}`,
      from: fromEmail,
      react: AdminNotificationEmail({
        title,
        data,
      }),
    },
    {recipientType: 'admin'}
  )
}
