import {Subscription} from '@better-auth/stripe'

import {
  AddNotificationModel,
  NotificationModel,
  UpdateNotificationModel,
} from '@/db/models/notification-model'

// ICI les TYPES DE DOMAIN sont EGAUX aux types drizzle
// Les fichier types DOMAINS sont la pour décorréler les types de drizzle des types de domaine (services)

export type Notification = NotificationModel

export type CreateNotification = AddNotificationModel

export type UpdateNotification = {
  id: string
} & Partial<Omit<UpdateNotificationModel, 'id'>>

// Types pour les différents types de notifications
export type NotificationType =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_deleted'
  | 'organization_invitation'
  | 'project_created'
  | 'project_updated'
  | 'user_banned'
  | 'user_unbanned'
  | 'system_maintenance'
  | 'security_alert'
  | 'password_changed'
  | 'reset_password'
  | 'email_verification'
  | 'change_email_verification'
  | 'magic_link'
  | 'otp_code'

export const NotificationTypeConst = {
  payment_failed: 'payment_failed' satisfies NotificationType,
  payment_succeeded: 'payment_succeeded' satisfies NotificationType,
  subscription_created: 'subscription_created' satisfies NotificationType,
  subscription_updated: 'subscription_updated' satisfies NotificationType,
  subscription_canceled: 'subscription_canceled' satisfies NotificationType,
  subscription_deleted: 'subscription_deleted' satisfies NotificationType,
  organization_invitation: 'organization_invitation' satisfies NotificationType,
  project_created: 'project_created' satisfies NotificationType,
  project_updated: 'project_updated' satisfies NotificationType,
  user_banned: 'user_banned' satisfies NotificationType,
  user_unbanned: 'user_unbanned' satisfies NotificationType,
  system_maintenance: 'system_maintenance' satisfies NotificationType,
  security_alert: 'security_alert' satisfies NotificationType,
  password_changed: 'password_changed' satisfies NotificationType,
  reset_password: 'reset_password' satisfies NotificationType,
  email_verification: 'email_verification' satisfies NotificationType,
  change_email_verification:
    'change_email_verification' satisfies NotificationType,
  magic_link: 'magic_link' satisfies NotificationType,
  otp_code: 'otp_code' satisfies NotificationType,
} as const

// Métadonnées spécifiques selon le type de notification
export type NotificationMetadata = {
  payment_failed?: {
    paymentId: string
    amount: number
    currency: string
    reason?: string
  }
  payment_succeeded?: {
    paymentId: string
    amount: number
    currency: string
  }
  subscription_created?: {
    subscription: Subscription // Better Auth subscription object
  }
  subscription_updated?: {
    subscription: Subscription // Better Auth subscription object
  }
  subscription_canceled?: {
    subscription: Subscription // Better Auth subscription object
  }
  subscription_deleted?: {
    subscription: Subscription // Better Auth subscription object
  }
  organization_invitation?: {
    organizationId: string
    organizationName: string
    invitedBy: string
    invitedByEmail: string
    role: string
  }
  project_created?: {
    projectId: string
    projectName: string
    organizationId?: string
  }
  project_updated?: {
    projectId: string
    projectName: string
    changes: string[]
  }
  user_banned?: {
    reason: string
    expiresAt?: string
    bannedBy: string
  }
  user_unbanned?: {
    unbannedBy: string
    unbannedAt: string
  }
  system_maintenance?: {
    startTime: string
    endTime: string
    description: string
  }
  security_alert?: {
    alertType: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
  }
  password_changed?: {
    changedAt: string
    ipAddress?: string
    userAgent?: string
  }
  reset_password?: {
    url: string
    expiresAt?: string
    requestedAt?: string
    ipAddress?: string
    userAgent?: string
  }
  email_verification?: {
    url: string
    expiresAt?: string
    requestedAt?: string
  }
  change_email_verification?: {
    url: string
    newEmail?: string
    expiresAt?: string
    requestedAt?: string
  }
  magic_link?: {
    url: string
    email: string
    expiresAt?: string
    requestedAt?: string
  }
  otp_code?: {
    otp: string
    otpLink?: string
    expiresAt?: string
    requestedAt?: string
  }
}

// Type pour créer une notification avec métadonnées typées
export type CreateTypedNotification<T extends NotificationType> = Omit<
  CreateNotification,
  'type' | 'metadata' | 'title' | 'message'
> & {
  type: T
  title?: string
  message?: string
  metadata?: NotificationMetadata[T]
}
