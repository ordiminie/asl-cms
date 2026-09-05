import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'

export const submissionTypeEnum = pgEnum('submission_type', [
  'contact',
  'feedback',
  'support',
])

export const userSubmissions = pgTable('user_submissions', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  userId: uuid('user_id').references(() => user.id, {onDelete: 'cascade'}),
  organizationId: uuid('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  email: text('email'),
  type: submissionTypeEnum('type').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  read: boolean('read').default(false).notNull(),
  archived: boolean('archived').default(false).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export const userSubmissionsRelations = relations(userSubmissions, ({one}) => ({
  user: one(user, {
    fields: [userSubmissions.userId],
    references: [user.id],
    relationName: 'userToSubmissions',
  }),
  organization: one(organization, {
    fields: [userSubmissions.organizationId],
    references: [organization.id],
    relationName: 'organizationToSubmissions',
  }),
}))

export type UserSubmissionModel = typeof userSubmissions.$inferSelect
export type AddUserSubmissionModel = typeof userSubmissions.$inferInsert
export type UpdateUserSubmissionModel = typeof userSubmissions.$inferInsert
