import {sql} from 'drizzle-orm'
import {date, integer, pgTable, unique, uuid} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

/**
 * Budget d'envoi quotidien d'une association (s52, ADR 053). Une ligne par
 * association et par jour de Paris. Les envois reportables s'accordent par un
 * incrément **conditionnel** de `reportable_count` (refuse au plafond dans la
 * meme instruction) ; les emails de connexion incrementent `login_count`,
 * jamais refuses. En base et non en memoire : le compteur survit a un
 * redemarrage.
 *
 * Table metier : RLS forcee, policy `tenant_isolation` (ADR 002).
 */
export const emailSendBudget = pgTable(
  'email_send_budget',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    day: date('day', {mode: 'string'}).notNull(),
    reportableCount: integer('reportable_count').default(0).notNull(),
    loginCount: integer('login_count').default(0).notNull(),
  },
  (table) => [
    unique('email_send_budget_organization_day_unique').on(
      table.organizationId,
      table.day
    ),
  ]
)

export type EmailSendBudgetModel = typeof emailSendBudget.$inferSelect
