import {sql} from 'drizzle-orm'
import {
  check,
  date,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'
import {campaign} from './campaign-model'

/**
 * Le rang d'une relance d'impaye (s29, ADR 070 §6) : une ligne par
 * (association, echeance, rang 1 a 3), qui designe sa campagne. Ecrite **dans
 * la meme transaction** que la campagne : un passage rejoue ne cree ni
 * seconde campagne ni second rang. Table metier : RLS forcee, policy
 * `tenant_isolation` (ADR 002). Aucune donnee de membre : le suivi se derive
 * des lignes de la campagne. Disparait avec sa campagne.
 */
export const unpaidReminder = pgTable(
  'unpaid_reminder',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    dueOn: date('due_on', {mode: 'string'}).notNull(),
    rank: integer('rank').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, {onDelete: 'cascade'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('unpaid_reminder_organization_due_on_rank_unique').on(
      table.organizationId,
      table.dueOn,
      table.rank
    ),
    check('unpaid_reminder_rank_check', sql`${table.rank} between 1 and 3`),
  ]
)

export type UnpaidReminderModel = typeof unpaidReminder.$inferSelect
export type AddUnpaidReminderModel = typeof unpaidReminder.$inferInsert
