import {sql} from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Planificateur en base (ADR 006, ADR 052). Table metier : RLS forcee,
 * policy `tenant_isolation` (ADR 002). Un passage ne voit que les taches du
 * tenant pose par `withTenant`.
 *
 * - `payload` ne porte que des identifiants, jamais de donnee personnelle.
 * - `locked_at` pose par la prise ; un verrou perime rend la tache
 *   reprenable apres un redemarrage.
 * - `failed_at` : tentatives epuisees, la tache n'est plus jamais reprise.
 * - Unique `(organization_id, kind, idempotency_key)` : une tache ne se cree
 *   pas deux fois, quel que soit le nombre d'appels.
 */
export const scheduledJob = pgTable(
  'scheduled_job',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    runAfter: timestamp('run_after', {withTimezone: true}).notNull(),
    payload: jsonb('payload').$type<Record<string, string>>().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lockedAt: timestamp('locked_at', {withTimezone: true}),
    completedAt: timestamp('completed_at', {withTimezone: true}),
    failedAt: timestamp('failed_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('scheduled_job_organization_kind_key_unique').on(
      table.organizationId,
      table.kind,
      table.idempotencyKey
    ),
    index('scheduled_job_due_idx')
      .on(table.organizationId, table.runAfter)
      .where(sql`${table.completedAt} is null and ${table.failedAt} is null`),
  ]
)

export type ScheduledJobModel = typeof scheduledJob.$inferSelect
export type AddScheduledJobModel = typeof scheduledJob.$inferInsert
