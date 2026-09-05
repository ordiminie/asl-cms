import {relations, sql} from 'drizzle-orm'
import {
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization} from './auth-model'

export const creditSourceEnum = pgEnum('credit_source', [
  'plan',
  'admin_grant',
  'usage',
  'pack',
  'refund',
  'system_adjustment',
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
    // Idempotence webhook : empêche les doublons par (org, source, sourceId)
    // pour les sources où le sourceId est un identifiant unique d'événement.
    // - 'pack' : sourceId = stripe checkout session id (unique par achat)
    // - 'system_adjustment' : sourceId = 'cancel:<subId>' ou 'reconcile:<org>:<date>'
    // - 'refund' : sourceId = refund_id Stripe (unique par remboursement)
    // EXCLUS : 'plan' (sourceId='free-plan' réutilisé chaque mois, idempotence
    // par periodStart) et 'admin_grant' (manuel, pas de sourceId par convention).
    sourceDedupUniqueIdx: uniqueIndex('credit_ledger_source_dedup_unique_idx')
      .on(table.organizationId, table.source, table.sourceId)
      .where(
        sql`${table.sourceId} IS NOT NULL AND ${table.source} IN ('pack', 'system_adjustment', 'refund')`
      ),
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
