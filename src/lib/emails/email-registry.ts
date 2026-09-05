import {env} from '@/env'

export type EmailParamType = 'text' | 'email' | 'select' | 'number'

export type EmailParam = {
  key: string
  label: string
  type: EmailParamType
  required?: boolean
  default?: string
  options?: string[]
}

export type EmailDefinition = {
  id: string
  name: string
  description: string
  params: EmailParam[]
}

export const EMAIL_REGISTRY: Record<string, EmailDefinition> = {
  welcomeFollowUp: {
    id: 'welcomeFollowUp',
    name: 'Welcome Follow-Up',
    description: 'Email de suivi envoyé après inscription',
    params: [
      {key: 'email', label: 'Email', type: 'email', required: true},
      {key: 'userName', label: 'User Name', type: 'text', required: true},
      {
        key: 'appUrl',
        label: 'App URL',
        type: 'text',
        default: env.NEXT_PUBLIC_APP_URL,
      },
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        options: ['en', 'fr', 'es'],
        default: 'en',
      },
    ],
  },
  notification: {
    id: 'notification',
    name: 'Notification',
    description: 'Email de notification générique',
    params: [
      {key: 'email', label: 'Email', type: 'email', required: true},
      {key: 'title', label: 'Title', type: 'text', required: true},
      {key: 'message', label: 'Message', type: 'text', required: true},
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['info', 'warning', 'success', 'error'],
        default: 'info',
      },
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        options: ['en', 'fr', 'es'],
        default: 'en',
      },
    ],
  },
  adminSubscriptionCreated: {
    id: 'adminSubscriptionCreated',
    name: '[Admin] Subscription Created',
    description: 'Notification admin pour nouvel abonnement',
    params: [
      {key: 'plan', label: 'Plan', type: 'text', default: 'pro'},
      {
        key: 'clientEmail',
        label: 'Client Email',
        type: 'email',
        required: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['active', 'trialing', 'past_due'],
        default: 'active',
      },
    ],
  },
  adminSubscriptionUpdated: {
    id: 'adminSubscriptionUpdated',
    name: '[Admin] Subscription Updated',
    description: 'Notification admin pour mise à jour abonnement',
    params: [
      {key: 'plan', label: 'Plan', type: 'text', default: 'pro'},
      {
        key: 'clientEmail',
        label: 'Client Email',
        type: 'email',
        required: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['active', 'trialing', 'past_due', 'canceled'],
        default: 'active',
      },
    ],
  },
  adminSubscriptionCanceled: {
    id: 'adminSubscriptionCanceled',
    name: '[Admin] Subscription Canceled',
    description: 'Notification admin pour annulation abonnement',
    params: [
      {key: 'plan', label: 'Plan', type: 'text', default: 'pro'},
      {
        key: 'clientEmail',
        label: 'Client Email',
        type: 'email',
        required: true,
      },
    ],
  },
  adminSubscriptionDeleted: {
    id: 'adminSubscriptionDeleted',
    name: '[Admin] Subscription Deleted',
    description: 'Notification admin pour suppression abonnement',
    params: [
      {key: 'plan', label: 'Plan', type: 'text', default: 'pro'},
      {
        key: 'clientEmail',
        label: 'Client Email',
        type: 'email',
        required: true,
      },
    ],
  },
}

export function getEmailIds(): string[] {
  return Object.keys(EMAIL_REGISTRY)
}

export function getEmailDefinition(
  emailId: string
): EmailDefinition | undefined {
  return EMAIL_REGISTRY[emailId]
}
