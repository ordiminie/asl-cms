import {pgEnum, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {user} from './auth-model'

export const settingTypeEnum = pgEnum('setting_type', [
  'boolean',
  'string',
  'number',
  'json',
])

export const settingCategoryEnum = pgEnum('setting_category', [
  'email',
  'general',
])

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  type: settingTypeEnum('type').notNull(),
  category: settingCategoryEnum('category').notNull(),
  label: text('label'),
  description: text('description'),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow(),
  updatedBy: uuid('updated_by').references(() => user.id, {
    onDelete: 'set null',
  }),
})

export type AppSettingModel = typeof appSettings.$inferSelect
export type AddAppSettingModel = typeof appSettings.$inferInsert
export type UpdateAppSettingModel = Partial<AddAppSettingModel> & {key: string}
