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
}

export function getEmailIds(): string[] {
  return Object.keys(EMAIL_REGISTRY)
}

export function getEmailDefinition(
  emailId: string
): EmailDefinition | undefined {
  return EMAIL_REGISTRY[emailId]
}
