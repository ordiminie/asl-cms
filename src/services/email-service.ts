import {Subscription} from '@better-auth/stripe'
import {getTranslations} from 'next-intl/server'
import {
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  Resend,
} from 'resend'

import {getUserByStripeCustomerIdDao} from '@/db/repositories/user-repository'
import {env} from '@/env'
import EmailChangeEmailVerification from '@/lib/emails/email-change-email-verification'
import InternalEmail from '@/lib/emails/internal-email'
import InvitationOrganizationLinkMail from '@/lib/emails/invitation-organization-link-email'
import MagicLinkMail from '@/lib/emails/magic-link-email'
import NotificationEmail from '@/lib/emails/notification-email'
import OtpEmail from '@/lib/emails/otp-email'
import ResetPasswordEmail from '@/lib/emails/reset-password-email'
import SubscriptionCanceledMail from '@/lib/emails/subscription-canceled-email'
import SubscriptionCompletedMail from '@/lib/emails/subscription-completed-email'
import SubscriptionDeletedMail from '@/lib/emails/subscription-deleted-email'
import SubscriptionUpdatedMail from '@/lib/emails/subscription-updated-email'
import VerificationEmail from '@/lib/emails/verification-email'
import WelcomeFollowUpEmail from '@/lib/emails/welcome-follow-up-email'
import {
  getFormattedPriceFromSubscription,
  getSubscriptionDetails,
} from '@/lib/stripe/stripe-utils'

import {getPlanByPriceIdService} from './subscription-service'

const resend = new Resend(env.RESEND_API_KEY)

export const sendSimpleEmailService = async ({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) => {
  await sendEmailService({
    to,
    subject,
    text,
    from: env.EMAIL_FROM ?? 'onboarding@resend.dev',
  })
}

export const sendEmailService = async (
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions
) => {
  if (env.NEXT_PUBLIC_NODE_ENV === 'development') {
    payload.subject = `[DEV] ${payload.subject}`
  }

  const {error} = await resend.emails.send(
    {
      ...payload,
      from: env.EMAIL_FROM ?? 'onboarding@resend.dev',
    },
    options
  )

  if (error) {
    console.error(error)
    throw error
  }
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

  await sendEmailService({
    to: email,
    subject: t('subject', {teamName}),
    from: env.EMAIL_FROM ?? 'onboarding@resend.dev',
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

export const sendMagicLinkEmailService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.magicLink')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: email,
    subject: t('subject'),
    from: fromEmail,
    text: t('preview'),
    react: MagicLinkMail({url}),
  })
}

export const sendVerificationEmailService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.verification')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: email,
    subject: t('subject'),
    from: fromEmail,
    text: t('preview'),
    react: VerificationEmail({url}),
  })
}

export const sendResetPasswordLinkEmailService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.resetPassword')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: email,
    subject: t('subject'),
    from: fromEmail,
    text: t('preview'),
    react: ResetPasswordEmail({url}),
  })
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
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: email,
    subject: t('subject'),
    from: fromEmail,
    text: `${t('description')} ${otp}${otpLink ? `\n\n${t('verifyAutomatically')} : ${otpLink}` : ''}`,
    react: OtpEmail({otp, otpLink}),
  })
}

export const sendEmailChangeEmailVerificationService = async ({
  email,
  url,
}: {
  email: string
  url: string
}) => {
  const t = await getTranslations('email.user.emailChange')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: email,
    subject: t('subject'),
    from: fromEmail,
    text: t('preview'),
    react: EmailChangeEmailVerification({url}),
  })
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
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
  const t = await getTranslations('email.user.subscriptionCompleted')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
    : 'Non disponible'

  const nextBilling = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
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
  const t = await getTranslations('email.user.subscriptionUpdated')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
    : 'Non disponible'

  const nextBilling = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
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
  const t = await getTranslations('email.user.subscriptionCanceled')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
  const canceledAt = new Date().toLocaleDateString('fr-FR')

  const periodEnd = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString('fr-FR')
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
  const t = await getTranslations('email.user.subscriptionDeleted')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
  const deletedAt = new Date().toLocaleDateString('fr-FR')

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
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'

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
  const t = await getTranslations('email.internal')
  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev'
  const toEmail = env.EMAIL_TO ?? env.EMAIL_FROM ?? 'onboarding@resend.dev'

  await sendEmailService({
    to: toEmail,
    subject: `${t('subject')} - ${title}`,
    from: fromEmail,
    text: t('preview'),
    react: InternalEmail({
      preview: t('preview'),
      content: data,
    }),
  })
}
