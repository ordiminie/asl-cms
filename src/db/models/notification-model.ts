import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {user} from './auth-model'

export const notifications = pgTable('notifications', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, {onDelete: 'cascade'}),
  type: text('type').notNull(), // ex: 'payment_failed', 'subscription_updated', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

// Relations
export const notificationsRelations = relations(notifications, ({one}) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
    relationName: 'userToNotifications',
  }),
}))

// Types
export type NotificationModel = typeof notifications.$inferSelect
export type AddNotificationModel = typeof notifications.$inferInsert
export type UpdateNotificationModel = typeof notifications.$inferInsert
