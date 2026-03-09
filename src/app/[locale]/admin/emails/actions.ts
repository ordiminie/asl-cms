'use server'

import {requireActionAuth} from '@/app/dal/user-dal'
import {EMAIL_REGISTRY} from '@/lib/emails/email-registry'
import {
  sendAdminInternalEmailService,
  sendNotificationEmailService,
  sendWelcomeFollowUpEmailService,
} from '@/services/facades/email-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'

export type SendTestEmailResult = {
  success: boolean
  message: string
}

export async function sendTestEmailAction(
  emailId: string,
  params: Record<string, string>
): Promise<SendTestEmailResult> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  const emailDef = EMAIL_REGISTRY[emailId]
  if (!emailDef) {
    return {success: false, message: 'Email not found'}
  }

  try {
    switch (emailId) {
      case 'welcomeFollowUp':
        await sendWelcomeFollowUpEmailService({
          email: params.email,
          userName: params.userName,
          appUrl: params.appUrl,
          language: params.language as 'fr' | 'en' | 'es',
        })
        break

      case 'notification':
        await sendNotificationEmailService({
          email: params.email,
          title: params.title,
          message: params.message,
          type: params.type as 'info' | 'warning' | 'success' | 'error',
          language: params.language as 'fr' | 'en' | 'es',
        })
        break

      case 'adminSubscriptionCreated':
        await sendAdminInternalEmailService({
          title: '🎉 Nouvel abonnement créé',
          data: `Plan: ${params.plan}\nClient: ${params.clientEmail}\nStatut: ${params.status}\nDate: ${new Date().toLocaleString('fr-FR')}`,
        })
        break

      case 'adminSubscriptionUpdated':
        await sendAdminInternalEmailService({
          title: '🔄 Abonnement mis à jour',
          data: `Plan: ${params.plan}\nClient: ${params.clientEmail}\nStatut: ${params.status}\nDate: ${new Date().toLocaleString('fr-FR')}`,
        })
        break

      case 'adminSubscriptionCanceled':
        await sendAdminInternalEmailService({
          title: '⚠️ Abonnement annulé',
          data: `Plan: ${params.plan}\nClient: ${params.clientEmail}\nStatut: canceled\nDate: ${new Date().toLocaleString('fr-FR')}`,
        })
        break

      case 'adminSubscriptionDeleted':
        await sendAdminInternalEmailService({
          title: '🗑️ Abonnement supprimé',
          data: `Plan: ${params.plan}\nClient: ${params.clientEmail}\nDate: ${new Date().toLocaleString('fr-FR')}`,
        })
        break

      default:
        return {
          success: false,
          message: 'Service not implemented for this email',
        }
    }

    return {
      success: true,
      message: `Email "${emailDef.name}" sent to ${params.email}`,
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
