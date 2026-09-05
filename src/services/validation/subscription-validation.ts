import {z} from 'zod'

import {CreatePlan, UpdatePlan} from '../types/domain/subscription-types'

export const baseSubscriptionServiceSchema = z.object({
  referenceId: z.string({
    message: 'Le referenceId est requis.',
  }),
})

export const createSubscriptionServiceSchema =
  baseSubscriptionServiceSchema.extend({
    plan: z.string({
      message: 'Le plan est requis.',
    }),
    status: z.string().default('active'),
    quantity: z
      .number()
      .min(1, {
        message: 'La quantité doit être supérieure à 0.',
      })
      .default(1)
      .optional(),
    periodStart: z
      .date()
      .default(() => new Date())
      .optional(),
    periodEnd: z.date().optional(),
    stripeCustomerId: z.string().optional(),
    stripeSubscriptionId: z.string().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    seats: z.number().optional(),
    trialStart: z.date().optional(),
    trialEnd: z.date().optional(),
  })

export const updateSubscriptionServiceSchema =
  baseSubscriptionServiceSchema.extend({
    id: z.string().uuid(),
    plan: z.string().optional(),
    status: z.string().optional(),
    quantity: z.number().min(1).optional(),
    periodStart: z.date().optional(),
    periodEnd: z.date().optional(),
    stripeCustomerId: z.string().optional(),
    stripeSubscriptionId: z.string().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    seats: z.number().optional(),
    trialStart: z.date().optional(),
    trialEnd: z.date().optional(),
  })

// ========================================
// VALIDATION POUR LES PLANS
// ========================================

export const basePlanServiceSchema = z.object({
  code: z
    .string({
      message: 'Le nom du plan est requis.',
    })
    .min(2, {
      message: 'Le nom du plan doit contenir au moins 2 caractères.',
    })
    .max(50, {
      message: 'Le nom du plan ne doit pas contenir plus de 50 caractères.',
    })
    .regex(/^[a-z0-9_-]+$/, {
      message:
        'Le nom du plan ne peut contenir que des lettres minuscules, chiffres, tirets et underscores.',
    }),
  planName: z
    .string({
      message: "Le nom d'affichage du plan est requis.",
    })
    .min(2, {
      message: "Le nom d'affichage doit contenir au moins 2 caractères.",
    })
    .max(100, {
      message:
        "Le nom d'affichage ne doit pas contenir plus de 100 caractères.",
    }),
  priceId: z
    .string({
      message: "L'ID de prix Stripe est requis.",
    })
    .min(1, {
      message: "L'ID de prix Stripe ne peut pas être vide.",
    }),
})

export const createPlanServiceSchema = basePlanServiceSchema.extend({
  annualDiscountPriceId: z.string().optional(),
  limits: z.record(z.string(), z.unknown()).optional(), // JSON flexible pour les limites
  freeTrial: z.record(z.string(), z.unknown()).optional(), // JSON flexible pour le trial
  features: z.array(z.unknown()).optional(), // Array JSON flexible
  description: z
    .string()
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    })
    .optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: 'Le prix doit être un nombre décimal valide (ex: 29.99).',
    })
    .optional(),
  yearlyPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message:
        'Le prix annuel doit être un nombre décimal valide (ex: 249.99).',
    })
    .optional(),
  currency: z
    .string()
    .length(3, {
      message: 'La devise doit être un code ISO 3 caractères (ex: EUR, USD).',
    })
    .optional(),
  isRecurring: z.boolean().default(true),
  displayOrder: z
    .number()
    .int()
    .min(0, {
      message: "L'ordre d'affichage doit être un entier positif.",
    })
    .optional(),
}) satisfies z.Schema<CreatePlan>

export const updatePlanServiceSchema = z.object({
  id: z.string().uuid({
    message: "L'identifiant du plan doit être un UUID valide.",
  }),
  name: z
    .string()
    .min(2, {
      message: 'Le nom du plan doit contenir au moins 2 caractères.',
    })
    .max(50, {
      message: 'Le nom du plan ne doit pas contenir plus de 50 caractères.',
    })
    .regex(/^[a-z0-9_-]+$/, {
      message:
        'Le nom du plan ne peut contenir que des lettres minuscules, chiffres, tirets et underscores.',
    })
    .optional(),
  planName: z
    .string()
    .min(2, {
      message: "Le nom d'affichage doit contenir au moins 2 caractères.",
    })
    .max(100, {
      message:
        "Le nom d'affichage ne doit pas contenir plus de 100 caractères.",
    })
    .optional(),
  priceId: z
    .string()
    .min(1, {
      message: "L'ID de prix Stripe ne peut pas être vide.",
    })
    .optional(),
  annualDiscountPriceId: z.string().optional(),
  limits: z.record(z.string(), z.unknown()).optional(),
  freeTrial: z.record(z.string(), z.unknown()).optional(),
  features: z.array(z.unknown()).optional(),
  description: z
    .string()
    .max(500, {
      message: 'La description ne doit pas contenir plus de 500 caractères.',
    })
    .optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message: 'Le prix doit être un nombre décimal valide (ex: 29.99).',
    })
    .optional(),
  yearlyPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, {
      message:
        'Le prix annuel doit être un nombre décimal valide (ex: 249.99).',
    })
    .optional(),
  currency: z
    .string()
    .length(3, {
      message: 'La devise doit être un code ISO 3 caractères (ex: EUR, USD).',
    })
    .optional(),
  isRecurring: z.boolean().optional(),
  displayOrder: z
    .number()
    .int()
    .min(0, {
      message: "L'ordre d'affichage doit être un entier positif.",
    })
    .optional(),
  status: z.enum(['active', 'inactive', 'deprecated']).optional(),
}) satisfies z.Schema<UpdatePlan>

// Schémas utilitaires pour les plans
export const planUuidSchema = z.string().uuid({
  message: "L'identifiant du plan doit être un UUID valide.",
})

export const planNameSchema = z.string().regex(/^[a-z0-9_-]+$/, {
  message:
    'Le nom du plan ne peut contenir que des lettres minuscules, chiffres, tirets et underscores.',
})

export const priceIdSchema = z.string().min(1, {
  message: "L'ID de prix ne peut pas être vide.",
})
