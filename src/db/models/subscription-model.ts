import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  decimal,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {user} from './auth-model'

export const planStatusEnum = pgEnum('plan_status', [
  'active',
  'inactive',
  'deprecated',
])

export const subscriptionPlan = pgTable('subscription_plan', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  code: text('code').notNull().unique(),
  planName: text('plan_name').notNull(),
  priceId: text('price_id').notNull(),
  annualDiscountPriceId: text('annual_discount_price_id'),
  limits: json('limits'),
  freeTrial: json('free_trial'),
  description: text('description'),
  features: json('features'),
  price: decimal('price', {precision: 10, scale: 2}),
  yearlyPrice: decimal('yearly_price', {precision: 10, scale: 2}),
  currency: text('currency').default('EUR').notNull(),
  isRecurring: boolean('is_recurring').default(true).notNull(),
  status: planStatusEnum('status').default('active').notNull(),
  version: integer('version').default(1).notNull(),
  isLegacy: boolean('is_legacy').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Define table schema - Aligned with Better Auth Stripe plugin
export const subscription = pgTable(
  'subscription',
  {
    // Better Auth required fields
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    plan: text('plan').notNull(),
    referenceId: text('reference_id').notNull(), // userId
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status').notNull(),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end'),
    seats: integer('seats'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),

    // Champs ajoutes par @better-auth/stripe 1.7 : le plugin les ecrit dans le
    // MEME adapter.update que cancelAtPeriodEnd (onSubscriptionUpdated). Tant
    // qu'ils manquent, l'UPDATE entier echoue et aucune annulation ni aucun
    // changement de plan ne redescend de Stripe.
    cancelAt: timestamp('cancel_at'),
    canceledAt: timestamp('canceled_at'),
    endedAt: timestamp('ended_at'),
    billingInterval: text('billing_interval'),
    stripeScheduleId: text('stripe_schedule_id'),

    // Optional audit fields
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  }
  // (table) => ({
  //   userPlanUnique: uniqueIndex('user_plan_unique_idx').on(
  //     table.stripeCustomerId,
  //     table.plan
  //   ),
  // })
)

// Define relations
export const subscriptionsRelations = relations(subscription, ({one}) => ({
  user: one(user, {
    fields: [subscription.stripeCustomerId],
    references: [user.stripeCustomerId],
  }),
  subscriptionPlan: one(subscriptionPlan, {
    fields: [subscription.plan],
    references: [subscriptionPlan.code], // Relation basée sur le 'name' du plan
  }),
}))

export const subscriptionPlanRelations = relations(
  subscriptionPlan,
  ({many}) => ({
    subscriptions: many(subscription),
  })
)

// Export types pour les plans
export type SubscriptionPlanModel = typeof subscriptionPlan.$inferSelect
export type SubscriptionPlanAddModel = typeof subscriptionPlan.$inferInsert

// Export types pour les subscriptions
export type SubscriptionModel = typeof subscription.$inferSelect
export type SubscriptionAddModel = typeof subscription.$inferInsert
