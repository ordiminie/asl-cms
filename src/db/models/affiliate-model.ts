import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {organization, user} from './auth-model'

export const affiliateStatusEnum = pgEnum('affiliate_status', [
  'pending',
  'active',
  'suspended',
  'banned',
])

export const affiliateTypeEnum = pgEnum('affiliate_type', [
  'customer',
  'professional',
])

export const affiliatePayoutMethodEnum = pgEnum('affiliate_payout_method', [
  'credit',
  'manual',
])

export const referralSourceEnum = pgEnum('referral_source', [
  'cookie',
  'signup_code',
  'manual',
])

export const referralStatusEnum = pgEnum('referral_status', [
  'active',
  'self_referral',
  'voided',
])

export const commissionTypeEnum = pgEnum('affiliate_commission_type', [
  'bounty',
  'clawback',
  'adjustment',
])

export const commissionStatusEnum = pgEnum('affiliate_commission_status', [
  'pending',
  'approved',
  'paid',
  'refunded',
  'voided',
])

export const affiliatePayoutStatusEnum = pgEnum('affiliate_payout_status', [
  'pending',
  'paid',
  'failed',
])

/**
 * Barème du programme, une ligne par plan.
 *
 * Aucun montant ni délai n'est codé en dur ailleurs : chaque SaaS qui part de
 * ce boilerplate remplace le contenu de cette table par le sien.
 */
export const affiliateProgramReward = pgTable(
  'affiliate_program_reward',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    planCode: text('plan_code').notNull(),
    bountyCents: integer('bounty_cents').notNull(),
    currency: char('currency', {length: 3}).default('USD').notNull(),
    holdDays: integer('hold_days').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    planCodeUniqueIdx: uniqueIndex('affiliate_program_reward_plan_code_idx').on(
      table.planCode
    ),
  })
)

/**
 * Un affilié est un utilisateur. Le ref lui appartient et reste le même
 * quelles que soient les organisations qu'il gère.
 */
export const affiliate = pgTable(
  'affiliate',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    // Normalisé en minuscules par le service, jamais par la base.
    code: text('code').notNull(),
    status: affiliateStatusEnum('status').default('active').notNull(),
    type: affiliateTypeEnum('type').default('customer').notNull(),
    payoutMethod: affiliatePayoutMethodEnum('payout_method')
      .default('manual')
      .notNull(),
    // Identité légale, requise seulement pour un affilié 'professional'.
    legalName: text('legal_name'),
    taxId: text('tax_id'),
    country: text('country'),
    suspendedAt: timestamp('suspended_at'),
    suspendedReason: text('suspended_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdUniqueIdx: uniqueIndex('affiliate_user_id_unique_idx').on(
      table.userId
    ),
    codeUniqueIdx: uniqueIndex('affiliate_code_unique_idx').on(table.code),
    statusIdx: index('affiliate_status_idx').on(table.status),
  })
)

/**
 * L'attribution. Une organisation ne peut être attribuée qu'une seule fois,
 * définitivement : `lockedAt` est posé à l'écriture et n'est jamais modifié.
 */
export const referral = pgTable(
  'referral',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id, {onDelete: 'cascade'}),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    // L'utilisateur qui s'est inscrit, conservé pour l'audit et la détection
    // d'auto-parrainage. L'organisation reste le sujet attribué.
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    source: referralSourceEnum('source').default('cookie').notNull(),
    status: referralStatusEnum('status').default('active').notNull(),
    lockedAt: timestamp('locked_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    organizationIdUniqueIdx: uniqueIndex(
      'referral_organization_id_unique_idx'
    ).on(table.organizationId),
    affiliateIdIdx: index('referral_affiliate_id_idx').on(table.affiliateId),
    referredUserIdIdx: index('referral_referred_user_id_idx').on(
      table.referredUserId
    ),
  })
)

/**
 * Ledger de commissions, append-only.
 *
 * Rien n'est jamais modifié après passage en 'paid' : une correction prend la
 * forme d'une nouvelle ligne de type 'clawback' au montant négatif.
 */
export const affiliateCommission = pgTable(
  'affiliate_commission',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id, {onDelete: 'cascade'}),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => referral.id, {onDelete: 'cascade'}),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    type: commissionTypeEnum('type').default('bounty').notNull(),
    status: commissionStatusEnum('status').default('pending').notNull(),
    planCode: text('plan_code').notNull(),
    // Signé : négatif pour un clawback.
    amountCents: integer('amount_cents').notNull(),
    currency: char('currency', {length: 3}).default('USD').notNull(),
    // Provenance Stripe. `sourceId` porte l'idempotence : un identifiant de
    // facture ne peut produire qu'une seule commission de prime.
    sourceId: text('source_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    // Seule liaison exploitable vers un remboursement : Stripe expose
    // `invoice -> payments -> payment_intent`, jamais l'inverse. Sans cette
    // colonne, un `charge.refunded` ne retrouve pas la prime à annuler.
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    // Matérialisé à l'insertion : changer le barème ne réécrit pas l'histoire.
    maturesAt: timestamp('matures_at').notNull(),
    approvedAt: timestamp('approved_at'),
    paidAt: timestamp('paid_at'),
    voidedAt: timestamp('voided_at'),
    voidReason: text('void_reason'),
    parentCommissionId: uuid('parent_commission_id'),
    payoutId: uuid('payout_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    affiliateStatusIdx: index('affiliate_commission_affiliate_status_idx').on(
      table.affiliateId,
      table.status,
      table.maturesAt
    ),
    organizationIdIdx: index('affiliate_commission_organization_id_idx').on(
      table.organizationId
    ),
    payoutIdIdx: index('affiliate_commission_payout_id_idx').on(table.payoutId),
    paymentIntentIdx: index('affiliate_commission_payment_intent_idx').on(
      table.stripePaymentIntentId
    ),
    // Idempotence webhook : une facture Stripe ne peut créer qu'une prime.
    // Les clawbacks et ajustements sont exclus, ils référencent la même source
    // que la ligne qu'ils corrigent.
    sourceDedupUniqueIdx: uniqueIndex('affiliate_commission_source_dedup_idx')
      .on(table.affiliateId, table.sourceId)
      .where(sql`${table.sourceId} IS NOT NULL AND ${table.type} = 'bounty'`),
    // Une organisation ne peut produire qu'une prime, même en cas de
    // réabonnement ou de changement de plan.
    organizationBountyUniqueIdx: uniqueIndex(
      'affiliate_commission_organization_bounty_idx'
    )
      .on(table.organizationId)
      .where(sql`${table.type} = 'bounty'`),
  })
)

/**
 * Trace de versement, immuable une fois `paid`.
 *
 * `affiliateSnapshot` fige l'identité légale au moment du paiement : si
 * l'affilié change de raison sociale ensuite, la comptabilité ne bouge pas.
 */
export const affiliatePayout = pgTable(
  'affiliate_payout',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id, {onDelete: 'cascade'}),
    amountCents: integer('amount_cents').notNull(),
    currency: char('currency', {length: 3}).default('USD').notNull(),
    status: affiliatePayoutStatusEnum('status').default('pending').notNull(),
    method: affiliatePayoutMethodEnum('method').default('manual').notNull(),
    externalReference: text('external_reference'),
    affiliateSnapshot:
      jsonb('affiliate_snapshot').$type<Record<string, unknown>>(),
    initiatedByUserId: uuid('initiated_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    affiliateIdIdx: index('affiliate_payout_affiliate_id_idx').on(
      table.affiliateId
    ),
    statusIdx: index('affiliate_payout_status_idx').on(table.status),
  })
)

export const affiliateRelations = relations(affiliate, ({one, many}) => ({
  user: one(user, {
    fields: [affiliate.userId],
    references: [user.id],
  }),
  referrals: many(referral),
  commissions: many(affiliateCommission),
  payouts: many(affiliatePayout),
}))

export const referralRelations = relations(referral, ({one, many}) => ({
  affiliate: one(affiliate, {
    fields: [referral.affiliateId],
    references: [affiliate.id],
  }),
  organization: one(organization, {
    fields: [referral.organizationId],
    references: [organization.id],
  }),
  commissions: many(affiliateCommission),
}))

export const affiliateCommissionRelations = relations(
  affiliateCommission,
  ({one}) => ({
    affiliate: one(affiliate, {
      fields: [affiliateCommission.affiliateId],
      references: [affiliate.id],
    }),
    referral: one(referral, {
      fields: [affiliateCommission.referralId],
      references: [referral.id],
    }),
    payout: one(affiliatePayout, {
      fields: [affiliateCommission.payoutId],
      references: [affiliatePayout.id],
    }),
  })
)

export const affiliatePayoutRelations = relations(
  affiliatePayout,
  ({one, many}) => ({
    affiliate: one(affiliate, {
      fields: [affiliatePayout.affiliateId],
      references: [affiliate.id],
    }),
    commissions: many(affiliateCommission),
  })
)

export type AffiliateModel = typeof affiliate.$inferSelect
export type AffiliateAddModel = typeof affiliate.$inferInsert
export type ReferralModel = typeof referral.$inferSelect
export type ReferralAddModel = typeof referral.$inferInsert
export type AffiliateCommissionModel = typeof affiliateCommission.$inferSelect
export type AffiliateCommissionAddModel =
  typeof affiliateCommission.$inferInsert
export type AffiliatePayoutModel = typeof affiliatePayout.$inferSelect
export type AffiliatePayoutAddModel = typeof affiliatePayout.$inferInsert
export type AffiliateProgramRewardModel =
  typeof affiliateProgramReward.$inferSelect
export type AffiliateProgramRewardAddModel =
  typeof affiliateProgramReward.$inferInsert
