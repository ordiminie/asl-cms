import {getTranslations} from 'next-intl/server'
import {z} from 'zod'

import {SUPPORTED_LANGUAGES} from '../types/common-type'
import {
  CreateUser,
  CreateUserFromStripe,
  CreateUserSettings,
  Language,
  NotificationChannel,
  Theme,
  UpdateUser,
  UpdateUserSettings,
  User,
  UserVisibility,
} from '../types/domain/user-types'

export const baseUserServiceSchema = z.object({
  email: z.string().email({
    message: "L'email n'est pas valide.",
  }),
}) satisfies z.Schema<Pick<User, 'email'>>

export const createUserServiceSchema = baseUserServiceSchema.extend({
  name: z
    .string()
    .min(3, {
      message: 'Le nom doit contenir au moins 3 caractères.',
    })
    .max(30, {
      message: 'Le nom ne doit pas contenir plus de 30 caractères.',
    }),
  password: z.string().optional(),
  email: z.string().email({
    message: "L'email n'est pas valide.",
  }),
}) satisfies z.Schema<CreateUser>

export const createUserFromStripeServiceSchema = z.object({
  email: z.string().email({
    message: "L'email n'est pas valide.",
  }),
  name: z
    .string()
    .min(1, {
      message: 'Le nom ne peut pas être vide.',
    })
    .max(50, {
      message: 'Le nom ne doit pas contenir plus de 50 caractères.',
    })
    .optional(),
  stripeCustomerId: z.string().optional(),
}) satisfies z.Schema<CreateUserFromStripe>

export const updateUserServiceSchema = createUserServiceSchema.extend({
  id: z.string(),
  image: z.string().nullable().optional(),
  visibility: z.enum(['public', 'private']) satisfies z.Schema<UserVisibility>,
  password: z.string().optional(),
  role: z
    .enum(['public', 'user', 'redactor', 'moderator', 'admin', 'super_admin'])
    .optional(),
  banned: z.boolean().optional(),
  banReason: z.string().nullable().optional(),
  banExpires: z.date().nullable().optional(),
  twoFactorEnabled: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  stripeCustomerId: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date(),
}) satisfies z.Schema<UpdateUser>

// Fonction qui crée un schéma avec messages traduits pour updateUserService
export async function createUpdateUserServiceSchema() {
  const t = await getTranslations('Service.User')
  return updateUserServiceSchema.extend({
    name: z
      .string()
      .min(3, {
        message: t('validation.name.min'),
      })
      .max(30, {
        message: t('validation.name.max'),
      }),
    email: z.string().email({
      message: t('validation.email.invalid'),
    }),
    role: z
      .enum(['public', 'user', 'redactor', 'moderator', 'admin', 'super_admin'])
      .optional(),
    banned: z.boolean().optional(),
    banReason: z.string().nullable().optional(),
    banExpires: z.date().nullable().optional(),
    twoFactorEnabled: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    stripeCustomerId: z.string().nullable().optional(),
  })
}

export const userUuidSchema = z.string().uuid({
  message: "L'identifiant n'est pas valide.",
})

export const themeSchema = z.enum([
  'light',
  'dark',
  'system',
]) satisfies z.Schema<Theme>

export const languageSchema = z.enum(
  SUPPORTED_LANGUAGES
) satisfies z.Schema<Language>

export const notificationChannelSchema = z.enum([
  'email',
  'push',
  'both',
  'none',
]) satisfies z.Schema<NotificationChannel>

// Schémas pour les paramètres utilisateur
export const createUserSettingsServiceSchema = z.object({
  userId: z.string().uuid({
    message: "L'identifiant de l'utilisateur n'est pas valide.",
  }),

  theme: themeSchema,
  language: languageSchema,
  timezone: z.string().default('Europe/Paris'),
  enableTwoFactor: z.boolean().default(false),
  enableEmailNotifications: z.boolean().default(true),
  enablePushNotifications: z.boolean().default(true),
  notificationChannel: notificationChannelSchema.default('both'),
  emailDigest: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
  twoFactorType: z.enum(['otp', 'totp']).default('totp'),
}) satisfies z.Schema<CreateUserSettings>

export const updateUserSettingsServiceSchema = createUserSettingsServiceSchema
  .partial()
  .extend({
    userId: z.string().uuid({
      message: "L'identifiant de l'utilisateur n'est pas valide.",
    }),
  }) satisfies z.Schema<UpdateUserSettings>

export const userSettingsUuidSchema = z.string().uuid()
