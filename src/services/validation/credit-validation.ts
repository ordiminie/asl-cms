import {z} from 'zod'

import {
  ConsumeCredits,
  CreateCreditEntry,
  CreditSource,
  GrantCreditsOptions,
} from '../types/domain/credit-types'

// Base schemas
export const organizationIdSchema = z.string().uuid({
  message: "L'identifiant de l'organisation n'est pas valide.",
})

export const creditAmountSchema = z.number().positive({
  message: 'Le montant doit être positif.',
})

export const creditSourceSchema = z.enum([
  'plan',
  'admin_grant',
  'usage',
  'pack',
  'refund',
]) satisfies z.Schema<CreditSource>

// Create credit entry schema
export const createCreditEntryServiceSchema = z.object({
  organizationId: organizationIdSchema,
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
  source: creditSourceSchema,
  sourceId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
  periodStart: z.date().optional(),
  periodEnd: z.date().optional(),
  expiresAt: z.date().optional(),
}) satisfies z.Schema<CreateCreditEntry>

// Consume credits schema
export const consumeCreditsServiceSchema = z.object({
  organizationId: organizationIdSchema,
  amount: creditAmountSchema,
  reason: z
    .string()
    .min(1, {message: 'La raison est requise.'})
    .max(500, {message: 'La raison ne peut pas dépasser 500 caractères.'}),
}) satisfies z.Schema<ConsumeCredits>

// Grant credits schema (admin only)
export const grantCreditsServiceSchema = z.object({
  organizationId: organizationIdSchema,
  amount: creditAmountSchema.refine((val) => val <= 10000, {
    message: 'Le montant ne peut pas dépasser 10000 crédits.',
  }),
  options: z
    .object({
      reason: z.string().max(500).optional(),
      expiresAt: z.date().nullable().optional(),
    })
    .optional()
    .default({}),
}) satisfies z.Schema<{
  organizationId: string
  amount: number
  options: GrantCreditsOptions
}>

// Get balance schema
export const getBalanceServiceSchema = z.object({
  organizationId: organizationIdSchema,
})

// Date schema that accepts both Date objects and ISO date strings
const dateOrStringSchema = z
  .union([z.date(), z.string()])
  .transform((val) => (typeof val === 'string' ? new Date(val) : val))

// Get usage graph schema
export const getUsageGraphServiceSchema = z.object({
  organizationId: organizationIdSchema,
  periodStart: dateOrStringSchema,
  periodEnd: dateOrStringSchema,
})

// Get recent activity schema
export const getRecentActivityServiceSchema = z.object({
  organizationId: organizationIdSchema,
  limit: z.number().int().positive().max(100).default(20),
})

// Purchase pack schema
export const purchasePackServiceSchema = z.object({
  organizationId: organizationIdSchema,
  packId: z.string().min(1, {message: 'Le pack est requis.'}),
})

// Allocate monthly credits schema
export const allocateMonthlyCreditsServiceSchema = z.object({
  stripeSubscriptionId: z.string().min(1),
  organizationId: organizationIdSchema,
  periodStart: z.date(),
  periodEnd: z.date(),
  monthlyCredits: z.number().nonnegative(),
  overrideCredits: z.number().nonnegative().optional(),
})
