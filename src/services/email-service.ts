import {Subscription} from '@better-auth/stripe'
import {getLocale, getTranslations} from 'next-intl/server'
import type {ReactNode} from 'react'
import {render} from 'react-email'

import {markContactMessageNotificationFailedDao} from '@/db/repositories/contact-message-repository'
import {
  claimDeferredEmailForSendTxnDao,
  createDeferredEmailTxnDao,
  deleteDeferredEmailTxnDao,
  markDeferredEmailFailedTxnDao,
  markDeferredEmailToVerifyTxnDao,
  releaseDeferredEmailTxnDao,
} from '@/db/repositories/deferred-email-repository'
import {
  claimReportableSendTxnDao,
  countLoginSendTxnDao,
  refundReportableSendTxnDao,
} from '@/db/repositories/email-send-budget-repository'
import {markIncidentReportNotificationFailedDao} from '@/db/repositories/incident-report-repository'
import {markMemberQuestionNotificationFailedDao} from '@/db/repositories/member-question-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {getUserByStripeCustomerIdDao} from '@/db/repositories/user-repository'
import {withTenant} from '@/db/tenant-scope'
import {env} from '@/env'
import {MAGIC_LINK_EXPIRES_IN_MINUTES} from '@/lib/better-auth/magic-link-constants'
import AdminNotificationEmail from '@/lib/emails/admin-notification-email'
import ContactMessageMail, {
  CONTACT_MESSAGE_SUBJECT_MAX_LENGTH,
  type ContactMessageEmailAssociation,
  type ContactMessageEmailMessage,
  fitSubjectToLength,
  fitToLength,
} from '@/lib/emails/contact-message-email'
import EmailChangeEmailVerification from '@/lib/emails/email-change-email-verification'
import IncidentReportMail, {
  INCIDENT_REPORT_SUBJECT_MAX_LENGTH,
  type IncidentReportEmailAssociation,
  type IncidentReportEmailReport,
} from '@/lib/emails/incident-report-email'
import InternalEmail from '@/lib/emails/internal-email'
import InvitationOrganizationLinkMail from '@/lib/emails/invitation-organization-link-email'
import MagicLinkMail, {
  type MagicLinkEmailAssociation,
} from '@/lib/emails/magic-link-email'
import MemberQuestionMail, {
  MEMBER_QUESTION_SUBJECT_MAX_LENGTH,
  type MemberQuestionEmailAssociation,
  type MemberQuestionEmailQuestion,
} from '@/lib/emails/member-question-email'
import NotificationEmail from '@/lib/emails/notification-email'
import OtpEmail from '@/lib/emails/otp-email'
import ResetPasswordEmail from '@/lib/emails/reset-password-email'
import SubscriptionCanceledMail from '@/lib/emails/subscription-canceled-email'
import SubscriptionCompletedMail from '@/lib/emails/subscription-completed-email'
import SubscriptionDeletedMail from '@/lib/emails/subscription-deleted-email'
import SubscriptionUpdatedMail from '@/lib/emails/subscription-updated-email'
import {getEmailTransport} from '@/lib/emails/transport'
import {
  isEmailTransportError,
  parseEmailAddress,
} from '@/lib/emails/transport/email-transport'
import VerificationEmail from '@/lib/emails/verification-email'
import WelcomeFollowUpEmail from '@/lib/emails/welcome-follow-up-email'
import type {SupportedLocale} from '@/lib/helper/locale-helper'
import {logger} from '@/lib/logger'
import {
  getFormattedPriceFromSubscription,
  getSubscriptionDetails,
} from '@/lib/stripe/stripe-utils'

import {
  getBooleanSettingService,
  getStringSettingService,
} from './app-settings-service'
import {getAssociationSettingsService} from './association-settings-service'
import {retryDelayMs} from './rules/campaign-schedule-rules'
import {
  budgetDayOf,
  deferredRunAfter,
  deferredSendOn,
  isDeferredByCaller,
  isNeverDeferred,
  reportableAllowance,
} from './rules/email-budget-rules'
import {getPlanByPriceIdService} from './subscription-service'
import {AppSettingKeys} from './types/domain/app-settings-types'
import {
  getCampaignSendMaxAttempts,
  getEmailDailySendLimit,
  getEmailLoginReserve,
} from './types/domain/association-settings-types'
import {receivedAtPartsOf} from './types/domain/contact-message-types'
import type {
  EmailSendContext,
  EmailSendReferenceType,
  EmailSendResult,
  TenantEmailSendContext,
} from './types/domain/email-send-types'
import {
  EMAIL_DELIVER_DEFERRED_JOB_KIND,
  type ScheduledJob,
  type ScheduledJobHandlers,
  type ScheduledJobOutcome,
} from './types/domain/scheduled-job-types'

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
  await sendEmailService(
    {
      to,
      subject,
      text,
      from: fromEmail,
    },
    {scope: 'platform', nature: 'onboarding'}
  )
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
  /** En-tetes supplementaires (`List-Unsubscribe`, RFC 8058). */
  headers?: Record<string, string>
  /** Adresse de reponse (adresse de contact de l'association). */
  replyTo?: string
  /** Nom d'expediteur, compose en `Nom <adresse de la plateforme>`. */
  senderName?: string
}

export interface SendEmailOptions {
  recipientType?: EmailRecipientType
}

/** Un email pret a partir : objet prefixe, gabarit deja rendu en HTML. */
export type ComposedEmail = {
  to: string
  subject: string
  text: string
  html?: string
  headers?: Record<string, string>
  replyTo?: string
  senderName?: string
}

const composeEmail = async (
  payload: SendEmailPayload
): Promise<ComposedEmail> => {
  const subject =
    env.NEXT_PUBLIC_NODE_ENV === 'development'
      ? `[DEV] ${payload.subject}`
      : payload.subject
  const template = payload.react ? await payload.react : undefined
  const html = template ? await render(template) : undefined
  return {
    to: payload.to,
    subject,
    text: payload.text,
    ...(html ? {html} : {}),
    ...(payload.headers ? {headers: payload.headers} : {}),
    ...(payload.replyTo ? {replyTo: payload.replyTo} : {}),
    ...(payload.senderName ? {senderName: payload.senderName} : {}),
  }
}

/** Confie un email compose au transport actif (ADR 005, ADR 017). */
export const transmitComposedEmail = async (
  email: ComposedEmail
): Promise<void> => {
  const fromEmail = await getEmailFrom()
  await getEmailTransport().send({
    from: senderOf(fromEmail, email.senderName),
    to: email.to,
    subject: email.subject,
    text: email.text,
    ...(email.html ? {html: email.html} : {}),
    ...(email.headers ? {headers: email.headers} : {}),
    ...(email.replyTo ? {replyTo: email.replyTo} : {}),
  })
}

/** Un refus certain du fournisseur : l'email n'est pas parti. */
const isCertainProviderRefusal = (error: unknown): boolean =>
  isEmailTransportError(error) && error.refused

/**
 * Envoi reportable accorde par le budget du jour, puis transmis. Un refus
 * certain du fournisseur rend l'unite ; une issue inconnue la garde (le
 * budget est un majorant). L'echec remonte tel quel.
 */
const transmitWithinBudget = async (
  email: ComposedEmail,
  organizationId: string,
  day: string
): Promise<void> => {
  try {
    await transmitComposedEmail(email)
  } catch (error) {
    if (isCertainProviderRefusal(error)) {
      await withTenant(organizationId, () =>
        refundReportableSendTxnDao({organizationId, day})
      )
    }
    throw error
  }
}

/** Les envois reportables accordes par jour a l'association. */
const reportableAllowanceOf = async (
  organizationId: string
): Promise<number> => {
  const settings = await getAssociationSettingsService(organizationId)
  return reportableAllowance(
    getEmailDailySendLimit(settings),
    getEmailLoginReserve(settings)
  )
}

/**
 * Conserve un email reporte et cree sa tache de rejeu **dans la meme
 * transaction** (ADR 053 §4) : jamais l'un sans l'autre.
 */
const keepDeferredEmail = async (
  email: ComposedEmail,
  context: TenantEmailSendContext,
  day: string
): Promise<void> => {
  const {organizationId} = context
  await withTenant(organizationId, async () => {
    const {id} = await createDeferredEmailTxnDao({
      organizationId,
      nature: context.nature,
      recipient: email.to,
      subject: email.subject,
      textBody: email.text,
      htmlBody: email.html ?? null,
      headers: email.headers ?? null,
      replyTo: email.replyTo ?? null,
      senderName: email.senderName ?? null,
      sendOn: deferredSendOn(day),
      referenceType: context.reference?.type ?? null,
      referenceId: context.reference?.id ?? null,
    })
    await enqueueScheduledJobTxnDao({
      organizationId,
      kind: EMAIL_DELIVER_DEFERRED_JOB_KIND,
      idempotencyKey: id,
      runAfter: deferredRunAfter(day),
      payload: {deferredEmailId: id},
    })
  })
}

/**
 * Un envoi d'association, decompte du budget du jour (ADR 053) : `login`
 * toujours accorde et decompte ; reportable accorde par l'increment
 * conditionnel, sinon reporte au lendemain — conserve pour rejeu, sauf une
 * campagne, dont l'appelant tient la file.
 */
const sendTenantEmail = async (
  email: ComposedEmail,
  context: TenantEmailSendContext,
  now: Date
): Promise<EmailSendResult> => {
  const {organizationId} = context
  const day = budgetDayOf(now)

  if (isNeverDeferred(context.nature)) {
    await withTenant(organizationId, () =>
      countLoginSendTxnDao({organizationId, day})
    )
    await transmitComposedEmail(email)
    return {status: 'sent'}
  }

  const allowance = await reportableAllowanceOf(organizationId)
  const granted = await withTenant(organizationId, () =>
    claimReportableSendTxnDao({organizationId, day, allowance})
  )
  if (!granted) {
    if (!isDeferredByCaller(context.nature)) {
      await keepDeferredEmail(email, context, day)
    }
    return {status: 'deferred', until: deferredSendOn(day)}
  }

  await transmitWithinBudget(email, organizationId, day)
  return {status: 'sent'}
}

/**
 * Point d'envoi unique du produit : tout email part par le contrat
 * `EmailTransport` (ADR 005, ADR 017), jamais par un fournisseur directement.
 * La **portee est obligatoire** (ADR 053) : un envoi d'association decompte
 * son budget quotidien et peut etre reporte ; un envoi de plateforme n'en
 * decompte aucun. Un echec du transport remonte tel quel
 * (`EmailTransportError`). Rien du message n'est journalise.
 */
export const sendEmailService = async (
  payload: SendEmailPayload,
  context: EmailSendContext,
  options?: SendEmailOptions
): Promise<EmailSendResult> => {
  const recipientType = options?.recipientType ?? 'client'
  const canSend = await shouldSendEmail(recipientType)
  if (!canSend) {
    logger.info('[EMAIL] Envois desactives par les reglages, envoi ignore', {
      nature: context.nature,
    })
    return {status: 'skipped'}
  }

  const email = await composeEmail(payload)
  if (context.scope === 'platform') {
    await transmitComposedEmail(email)
    return {status: 'sent'}
  }
  return sendTenantEmail(email, context, new Date())
}

const senderOf = (fromEmail: string, senderName?: string): string => {
  if (!senderName) return fromEmail
  const {email} = parseEmailAddress(fromEmail)
  const name = senderName.replace(/["<>\r\n]/g, '').trim()
  return name ? `${name} <${email}>` : fromEmail
}

/**
 * Les envois aux membres sont-ils permis par les reglages d'application ?
 * Lu **avant** d'ecrire quoi que ce soit : une campagne « envoyee » sans email
 * parti est le pire cas (s25).
 */
export const isClientEmailEnabledService = async (): Promise<boolean> =>
  shouldSendEmail('client')

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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'onboarding'}
  )
}

/**
 * Email de connexion (s03) : gabarit de l'association du domaine appele,
 * version texte complete (URL en clair). La locale est **explicite** : envoye
 * depuis une Server Action, l'email n'aurait sinon que le cookie `NEXT_LOCALE`
 * pour la trouver, absent d'un navigateur neuf (email parti en anglais). Ni l'URL ni le jeton ne sont
 * journalises ; l'intercepteur de la facade n'en logge pas les arguments.
 */
export const sendMagicLinkEmailService = async ({
  organizationId,
  email,
  url,
  association,
  locale,
}: {
  /** Association du domaine appele : le lien decompte son budget (s52). */
  organizationId: string
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
    {scope: 'tenant', organizationId, nature: 'login'},
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
    {scope: 'platform', nature: 'account_security'},
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
    {scope: 'platform', nature: 'account_security'},
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
    {scope: 'platform', nature: 'account_security'},
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
    {scope: 'platform', nature: 'account_security'},
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'platform_notification'}
  )
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'billing'}
  )
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'billing'}
  )
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'billing'}
  )
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'billing'}
  )
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

  await sendEmailService(
    {
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
    },
    {scope: 'platform', nature: 'onboarding'}
  )
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
    {scope: 'platform', nature: 'platform_notification'},
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
    {scope: 'platform', nature: 'platform_notification'},
    {recipientType: 'admin'}
  )
}

/**
 * Avertit le bureau d'un message recu depuis `/contact` (s08). L'adresse `to`
 * est celle des parametres de l'association, lue a l'envoi par l'appelant —
 * jamais `EMAIL_TO`. `recipientType: 'system'` : les interrupteurs d'envoi de
 * l'application ne peuvent pas couper cette notification en silence. Locale
 * explicite, partagee par l'objet, le texte et le gabarit. Un echec du
 * transport remonte a l'appelant.
 */
export const sendContactMessageNotificationEmailService = async ({
  organizationId,
  messageId,
  to,
  locale,
  association,
  message,
  messageUrl,
}: {
  /** Association du message : l'avertissement decompte son budget (s52). */
  organizationId: string
  /** Le message, designe au bureau si l'avertissement est reporte. */
  messageId: string
  to: string
  locale: SupportedLocale
  association: ContactMessageEmailAssociation
  message: ContactMessageEmailMessage
  messageUrl: string
}) => {
  const t = await getTranslations({
    locale,
    namespace: 'email.contact.notification',
  })
  const subject = fitSubjectToLength(
    (name) => t('subject', {name}),
    association.name,
    CONTACT_MESSAGE_SUBJECT_MAX_LENGTH
  )
  const receivedAt = t(
    'receivedAt',
    receivedAtPartsOf(message.createdAt, locale)
  )
  const text = [
    t('title'),
    t('intro'),
    [
      `${t('labels.from')} : ${message.senderName ?? t('anonymous')}`,
      `${t('labels.email')} : ${message.senderEmail}`,
      `${t('labels.subject')} : ${message.subject}`,
      `${t('labels.receivedAt')} : ${receivedAt}`,
    ].join('\n'),
    `${t('labels.message')} :\n${message.body}`,
    `${t('urlIntro')}\n${messageUrl}`,
    t('reply', {email: message.senderEmail}),
    t('footer', {name: association.name}),
  ].join('\n\n')

  await sendEmailService(
    {
      to,
      subject,
      text,
      react: ContactMessageMail({association, message, messageUrl, locale}),
    },
    {
      scope: 'tenant',
      organizationId,
      nature: 'board_notification',
      reference: {type: 'contact_message', id: messageId},
    },
    {recipientType: 'system'}
  )
}

/**
 * Objet « {association} — … : {categorie} » de 60 caracteres au plus. Trop
 * long, c'est **la categorie** qui se raccourcit d'abord (12 caracteres
 * gardes au moins) ; si le nom de l'association deborde encore, c'est lui qui
 * se raccourcit, l'objet commencant toujours par lui.
 */
const categorySubjectOf = (
  subjectOf: (name: string, category: string) => string,
  associationName: string,
  categoryName: string,
  max: number
): string => {
  const full = subjectOf(associationName, categoryName)
  const overflow = full.length - max
  if (overflow <= 0) return full

  const minCategory = 12
  const category = fitToLength(
    categoryName,
    Math.max(minCategory, categoryName.length - overflow)
  )
  return fitSubjectToLength(
    (name) => subjectOf(name, category),
    associationName,
    max
  )
}

/**
 * Objet de l'avertissement d'un signalement : « {association} — Signalement :
 * {categorie} », ou « … — Nouveau signalement » sans categorie.
 */
const incidentReportSubjectOf = (
  t: (key: string, values?: Record<string, string>) => string,
  associationName: string,
  categoryName: string | null
): string => {
  const max = INCIDENT_REPORT_SUBJECT_MAX_LENGTH
  if (!categoryName) {
    return fitSubjectToLength(
      (name) => t('subjectWithoutCategory', {name}),
      associationName,
      max
    )
  }
  return categorySubjectOf(
    (name, category) => t('subject', {name, category}),
    associationName,
    categoryName,
    max
  )
}

/**
 * Avertit le bureau d'un signalement recu depuis `/signaler` (s10, decision
 * F). L'adresse `to` est l'une des adresses resolues par l'appelant (contact
 * des Reglages, adresse de la categorie) — jamais `EMAIL_TO`. Un envoi par
 * destinataire. `recipientType: 'system'` : les interrupteurs d'envoi de
 * l'application ne peuvent pas couper cette notification en silence. Locale
 * explicite. Un echec du transport remonte a l'appelant.
 */
export const sendIncidentReportNotificationEmailService = async ({
  organizationId,
  reportId,
  to,
  locale,
  association,
  report,
  reportUrl,
}: {
  /** Association du signalement : l'avertissement decompte son budget (s52). */
  organizationId: string
  /** Le signalement, designe au bureau si l'avertissement est reporte. */
  reportId: string
  to: string
  locale: SupportedLocale
  association: IncidentReportEmailAssociation
  report: IncidentReportEmailReport
  reportUrl: string
}) => {
  const t = await getTranslations({
    locale,
    namespace: 'email.report.notification',
  })
  const subject = incidentReportSubjectOf(
    t,
    association.name,
    report.categoryName
  )
  const receivedAt = t(
    'receivedAt',
    receivedAtPartsOf(report.createdAt, locale)
  )
  const notProvided = t('notProvided')
  const text = [
    t('title'),
    [
      `${t('labels.category')} : ${report.categoryName ?? t('noCategory')}`,
      `${t('labels.location')} : ${report.location}`,
      `${t('labels.receivedAt')} : ${receivedAt}`,
      `${t('labels.reporter')} : ${report.reporterName ?? notProvided}`,
      `${t('labels.email')} : ${report.reporterEmail ?? notProvided}`,
      `${t('labels.phone')} : ${report.reporterPhone ?? notProvided}`,
    ].join('\n'),
    `${t('labels.description')} :\n${report.description}`,
    `${t('action')} :\n${reportUrl}`,
    t('footer', {name: association.name}),
  ].join('\n\n')

  await sendEmailService(
    {
      to,
      subject,
      text,
      react: IncidentReportMail({association, report, reportUrl, locale}),
    },
    {
      scope: 'tenant',
      organizationId,
      nature: 'board_notification',
      reference: {type: 'incident_report', id: reportId},
    },
    {recipientType: 'system'}
  )
}

/**
 * Avertit le bureau d'une question posee par un membre depuis son espace
 * (s23). L'adresse `to` est **l'unique** destinataire resolu par l'appelant
 * (adresse du sujet, sinon contact : routage exclusif, D1) — jamais
 * `EMAIL_TO`. La reponse est dirigee vers le membre quand sa fiche a une
 * adresse. `recipientType: 'system'` ; decompte le budget du tenant et peut
 * etre reportee (s52). Un echec du transport remonte a l'appelant.
 */
export const sendMemberQuestionNotificationEmailService = async ({
  organizationId,
  questionId,
  to,
  locale,
  association,
  question,
  questionUrl,
}: {
  /** Association de la question : l'avertissement decompte son budget. */
  organizationId: string
  /** La question, designee au bureau si l'avertissement est reporte. */
  questionId: string
  to: string
  locale: SupportedLocale
  association: MemberQuestionEmailAssociation
  question: MemberQuestionEmailQuestion
  questionUrl: string
}): Promise<EmailSendResult> => {
  const t = await getTranslations({
    locale,
    namespace: 'email.question.notification',
  })
  const subject = categorySubjectOf(
    (name, category) => t('subject', {name, category}),
    association.name,
    question.categoryName,
    MEMBER_QUESTION_SUBJECT_MAX_LENGTH
  )
  const receivedAt = t(
    'receivedAt',
    receivedAtPartsOf(question.createdAt, locale)
  )
  const text = [
    t('title'),
    t('intro'),
    [
      `${t('labels.category')} : ${question.categoryName}`,
      `${t('labels.member')} : ${question.memberName}`,
      `${t('labels.email')} : ${question.memberEmail ?? t('noEmail')}`,
      `${t('labels.receivedAt')} : ${receivedAt}`,
    ].join('\n'),
    `${t('labels.question')} :\n${question.body}`,
    `${t('urlIntro')}\n${questionUrl}`,
    question.memberEmail
      ? t('reply', {email: question.memberEmail})
      : t('replyWithoutEmail'),
    t('footer', {name: association.name}),
  ].join('\n\n')

  return sendEmailService(
    {
      to,
      subject,
      text,
      react: MemberQuestionMail({association, question, questionUrl, locale}),
      ...(question.memberEmail ? {replyTo: question.memberEmail} : {}),
    },
    {
      scope: 'tenant',
      organizationId,
      nature: 'board_notification',
      reference: {type: 'member_question', id: questionId},
    },
    {recipientType: 'system'}
  )
}

type ClaimedDeferredEmail = NonNullable<
  Awaited<ReturnType<typeof claimDeferredEmailForSendTxnDao>>
>

const composedOfDeferred = (row: ClaimedDeferredEmail): ComposedEmail => ({
  to: row.recipient,
  subject: row.subject,
  text: row.textBody,
  ...(row.htmlBody ? {html: row.htmlBody} : {}),
  ...(row.headers ? {headers: row.headers} : {}),
  ...(row.replyTo ? {replyTo: row.replyTo} : {}),
  ...(row.senderName ? {senderName: row.senderName} : {}),
})

/** Le DAO qui pose le temoin d'echec, par type d'objet designe. */
const MARK_SOURCE_NOTIFICATION_FAILED = new Map<
  string,
  (referenceId: string) => Promise<void>
>(
  Object.entries({
    contact_message: markContactMessageNotificationFailedDao,
    incident_report: markIncidentReportNotificationFailedDao,
    member_question: markMemberQuestionNotificationFailedDao,
  } satisfies Record<EmailSendReferenceType, (id: string) => Promise<void>>)
)

/**
 * Le message a l'origine d'une notification au bureau dont le rejeu n'a pas
 * abouti porte le temoin d'echec, comme a l'envoi direct (revue s52, n° 7).
 * Un temoin qui ne se pose pas est journalise, sans rien du message.
 */
const flagSourceNotificationFailed = async (
  organizationId: string,
  row: ClaimedDeferredEmail
): Promise<void> => {
  const {referenceType, referenceId} = row
  if (!referenceId) return
  const markFailed = referenceType
    ? MARK_SOURCE_NOTIFICATION_FAILED.get(referenceType)
    : undefined
  if (!markFailed) return
  try {
    await withTenant(organizationId, () => markFailed(referenceId))
  } catch (error) {
    logger.error("[EMAIL] Temoin d'echec de notification non pose", {
      referenceType,
      error: error instanceof Error ? error.name : 'unknown',
    })
  }
}

/** Les tentatives d'envoi permises, reglage de l'association (ADR 010). */
const sendMaxAttemptsOf = async (organizationId: string): Promise<number> =>
  getCampaignSendMaxAttempts(
    await getAssociationSettingsService(organizationId)
  )

/**
 * Refus certain du fournisseur : tentatives restantes, la ligne attend une
 * nouvelle tentative ; epuisees (`campaign.send_max_attempts`, comme une part
 * de campagne), la ligne passe en echec, son adresse et son contenu effaces,
 * et la tache echoue (revue s52, n° 2).
 */
const refusedDeferredSendOutcome = async (
  job: ScheduledJob,
  row: ClaimedDeferredEmail,
  day: string,
  now: Date
): Promise<ScheduledJobOutcome> => {
  if (job.attempts < (await sendMaxAttemptsOf(job.organizationId))) {
    await withTenant(job.organizationId, () =>
      releaseDeferredEmailTxnDao({id: row.id, sendOn: day, countAttempt: true})
    )
    return {
      status: 'retry',
      runAfter: new Date(now.getTime() + retryDelayMs(job.attempts)),
    }
  }
  await withTenant(job.organizationId, () =>
    markDeferredEmailFailedTxnDao(row.id)
  )
  await flagSourceNotificationFailed(job.organizationId, row)
  return {status: 'failed'}
}

/**
 * L'envoi a echoue : refus certain, voir `refusedDeferredSendOutcome` ; issue
 * inconnue, la ligne est a verifier, jamais renvoyee, et le message source
 * porte le temoin d'echec. Seul le nom de l'erreur est journalise, jamais le
 * message (critere 7).
 */
const deferredSendFailureOutcome = async (
  job: ScheduledJob,
  row: ClaimedDeferredEmail,
  day: string,
  now: Date,
  error: unknown
): Promise<ScheduledJobOutcome> => {
  const refused = isCertainProviderRefusal(error)
  logger.error("[EMAIL] Rejeu d'un email reporte interrompu", {
    jobId: job.id,
    refused,
    error: error instanceof Error ? error.name : 'unknown',
  })
  if (refused) return refusedDeferredSendOutcome(job, row, day, now)

  await withTenant(job.organizationId, () =>
    markDeferredEmailToVerifyTxnDao(row.id)
  )
  await flagSourceNotificationFailed(job.organizationId, row)
  return {status: 'completed'}
}

/**
 * Rejeu d'un email reporte (s52, ADR 053 §4), gestionnaire de
 * `email.deliver_deferred`, **sans session**. Dans l'ordre : reprise sur un
 * verrou perime (la ligne `sending` passe a verifier, jamais renvoyee) ; prise
 * `pending → sending` (deja prise ou absente : rien) ; budget du jour (de
 * nouveau epuise : ligne rendue et tache reportee au lendemain 02:00, sans
 * tentative comptee) ; envoi ; la ligne est **supprimee** une fois partie.
 * Un refus du fournisseur a chaque tentative la laisse en echec.
 */
export const deliverDeferredEmailService = async (
  job: ScheduledJob,
  now: Date
): Promise<ScheduledJobOutcome> => {
  const {organizationId} = job
  const deferredEmailId = job.payload.deferredEmailId
  const row = await withTenant(organizationId, async () => {
    if (job.resumedAfterStaleLock) {
      await markDeferredEmailToVerifyTxnDao(deferredEmailId)
    }
    return claimDeferredEmailForSendTxnDao(deferredEmailId)
  })
  if (!row) return {status: 'completed'}

  const day = budgetDayOf(now)
  const allowance = await reportableAllowanceOf(organizationId)
  const granted = await withTenant(organizationId, () =>
    claimReportableSendTxnDao({organizationId, day, allowance})
  )
  if (!granted) {
    await withTenant(organizationId, () =>
      releaseDeferredEmailTxnDao({
        id: deferredEmailId,
        sendOn: deferredSendOn(day),
        countAttempt: false,
      })
    )
    return {status: 'deferred', runAfter: deferredRunAfter(day)}
  }

  try {
    await transmitWithinBudget(composedOfDeferred(row), organizationId, day)
  } catch (error) {
    return deferredSendFailureOutcome(job, row, day, now, error)
  }
  await withTenant(organizationId, () =>
    deleteDeferredEmailTxnDao(deferredEmailId)
  )
  return {status: 'completed'}
}

/** Les gestionnaires du planificateur que porte l'envoi d'emails (s52). */
export const emailScheduledJobHandlers: ScheduledJobHandlers = {
  [EMAIL_DELIVER_DEFERRED_JOB_KIND]: deliverDeferredEmailService,
}
