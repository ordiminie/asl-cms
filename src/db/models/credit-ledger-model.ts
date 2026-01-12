import {relations, sql} from 'drizzle-orm'
import {
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

export const creditSourceEnum = pgEnum('credit_source', [
  'plan',
  'admin_grant',
  'usage',
  'pack',
  'refund',
])

export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    amount: decimal('amount', {precision: 10, scale: 2}).notNull(),
    source: creditSourceEnum('source').notNull(),
    sourceId: text('source_id'),
    reason: text('reason'),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    organizationIdIdx: index('credit_ledger_organization_id_idx').on(
      table.organizationId
    ),
    createdAtIdx: index('credit_ledger_created_at_idx').on(table.createdAt),
    expiresAtIdx: index('credit_ledger_expires_at_idx').on(table.expiresAt),
  })
)

export const creditLedgerRelations = relations(creditLedger, ({one}) => ({
  organization: one(organization, {
    fields: [creditLedger.organizationId],
    references: [organization.id],
  }),
}))

export type CreditLedgerModel = typeof creditLedger.$inferSelect
export type CreditLedgerAddModel = typeof creditLedger.$inferInsert
