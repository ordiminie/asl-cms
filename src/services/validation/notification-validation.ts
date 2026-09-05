import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {
  CreateNotification,
  Notification,
  NotificationType,
  UpdateNotification,
} from '../types/domain/notification-types'

// Schema de base pour les notifications
export const baseNotificationServiceSchema = z.object({
  userId: z.string().uuid({
    message: "L'ID utilisateur doit être un UUID valide.",
  }),
  type: z.string().min(1, {
    message: 'Le type de notification est requis.',
  }),
  title: z
    .string()
    .min(1, {
      message: 'Le titre est requis.',
    })
    .max(255, {
      message: 'Le titre ne doit pas dépasser 255 caractères.',
    }),
  message: z
    .string()
    .min(1, {
      message: 'Le message est requis.',
    })
    .max(1000, {
      message: 'Le message ne doit pas dépasser 1000 caractères.',
    }),
}) satisfies z.Schema<
  Pick<Notification, 'userId' | 'type' | 'title' | 'message'>
>

// Schema pour créer une notification
export const createNotificationServiceSchema = baseNotificationServiceSchema
  .extend({
    metadata: z.record(z.string(), z.any()).optional(),
    read: z.boolean().optional().default(false),
  })
  .strict() satisfies z.Schema<CreateNotification>

// Schema pour mettre à jour une notification
export const updateNotificationServiceSchema = z
  .object({
    id: z.string().uuid({
      message: "L'ID de la notification doit être un UUID valide.",
    }),
    read: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict() satisfies z.Schema<UpdateNotification>

// Schema pour marquer comme lu
export const markAsReadNotificationServiceSchema = z.object({
  id: z.string().uuid({
    message: "L'ID de la notification doit être un UUID valide.",
  }),
})

// Schema pour les types de notifications valides
export const notificationTypeSchema = z.enum([
  'payment_failed',
  'payment_succeeded',
  'subscription_created',
  'subscription_updated',
  'subscription_canceled',
  'subscription_deleted',
  'organization_invitation',
  'project_created',
  'project_updated',
  'user_banned',
  'user_unbanned',
  'system_maintenance',
  'security_alert',
] as const) satisfies z.Schema<NotificationType>

// Schema pour valider les IDs UUID
export const uuidSchema = z.string().uuid({
  message: "L'ID doit être un UUID valide.",
})

// Schémas avec traduction dynamique
export function getNotificationValidationSchemas() {
  return {
    create: async () => {
      const t = await getTranslations('NotificationValidation.create')
      return createNotificationServiceSchema
        .extend({
          userId: z.string().uuid({
            message: t('userId.invalid'),
          }),
          type: z.string().min(1, {
            message: t('type.required'),
          }),
          title: z
            .string()
            .min(1, {
              message: t('title.required'),
            })
            .max(255, {
              message: t('title.maxLength'),
            }),
          message: z
            .string()
            .min(1, {
              message: t('message.required'),
            })
            .max(1000, {
              message: t('message.maxLength'),
            }),
        })
        .strict()
    },

    update: async () => {
      const t = await getTranslations('NotificationValidation.update')
      return z
        .object({
          id: z.string().uuid({
            message: t('id.invalid'),
          }),
          read: z.boolean().optional(),
          metadata: z.record(z.string(), z.any()).optional(),
        })
        .strict()
    },

    markAsRead: async () => {
      const t = await getTranslations('NotificationValidation.markAsRead')
      return z.object({
        id: z.string().uuid({
          message: t('id.invalid'),
        }),
      })
    },
  }
}
