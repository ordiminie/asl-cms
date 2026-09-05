import {relations} from 'drizzle-orm'
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {account, apikey, member, roleEnum, user} from './auth-model'
import {notifications} from './notification-model'

// Enums pour les paramètres utilisateur
export const themeEnum = pgEnum('theme_type', ['light', 'dark', 'system'])
export const languageEnum = pgEnum('language_type', ['fr', 'en', 'es'])
export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'push',
  'both',
  'none',
])
export const twoFactorTypeEnum = pgEnum('two_factor_type', ['otp', 'totp'])

// Table des paramètres utilisateur
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, {onDelete: 'cascade'})
    .notNull(),
  theme: themeEnum('theme').default('system').notNull(),
  language: languageEnum('language').default('fr').notNull(),
  timezone: text('timezone').default('Europe/Paris').notNull(),

  enableEmailNotifications: boolean('enable_email_notifications')
    .default(true)
    .notNull(),
  enablePushNotifications: boolean('enable_push_notifications')
    .default(true)
    .notNull(),
  notificationChannel: notificationChannelEnum('notification_channel')
    .default('both')
    .notNull(),
  emailDigest: boolean('email_digest').default(true).notNull(),
  marketingEmails: boolean('marketing_emails').default(false).notNull(),
  twoFactorType: twoFactorTypeEnum('two_factor_type').default('totp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Relations existantes
export const usersRelations = relations(user, ({one, many}) => ({
  account: one(account, {
    fields: [user.id],
    references: [account.userId],
  }),
  members: many(member, {
    relationName: 'userToOrganizations',
  }),
  settings: one(userSettings, {
    fields: [user.id],
    references: [userSettings.userId],
  }),
  notifications: many(notifications, {
    relationName: 'userToNotifications',
  }),
  apiKeys: many(apikey, {
    relationName: 'userToApiKeys',
  }),
  // userOrganizations: many(userOrganizations, {
  //   relationName: 'userToOrganizations',
  // }),
  // finances: many(finance),
}))

// Relations pour userSettings
export const userSettingsRelations = relations(userSettings, ({one}) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}))

export type UserModel = typeof user.$inferSelect
export type AddUserModel = typeof user.$inferInsert
export type UpdateUserModel = typeof user.$inferInsert

// export type RoleModel = typeof roles.$inferSelect
// export type AddRoleModel = typeof roles.$inferInsert
// export type UpdateRoleModel = typeof roles.$inferInsert

// export type UserRoleModel = typeof userRoles.$inferSelect
// export type AddUserRoleModel = typeof userRoles.$inferInsert
export type RoleEnumModel = (typeof roleEnum.enumValues)[number]

// Nouveaux types pour userSettings
export type UserSettingsModel = typeof userSettings.$inferSelect
export type AddUserSettingsModel = typeof userSettings.$inferInsert
export type UpdateUserSettingsModel = typeof userSettings.$inferInsert
export type ThemeEnumModel = (typeof themeEnum.enumValues)[number]
export type LanguageEnumModel = (typeof languageEnum.enumValues)[number]
export type NotificationChannelEnumModel =
  (typeof notificationChannelEnum.enumValues)[number]
export type TwoFactorTypeEnumModel =
  (typeof twoFactorTypeEnum.enumValues)[number]
