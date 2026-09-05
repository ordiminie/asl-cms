import {z} from 'zod'

export const createPlanSchema = z.object({
  code: z.string().min(2, 'Le code doit contenir au moins 2 caractères'),
  planName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  priceId: z.string().min(1, 'Le Price ID Stripe est requis'),
  description: z.string().optional(),
  price: z.string().min(1, 'Le prix mensuel est requis'),
  yearlyPrice: z.string().optional(),
  annualDiscountPriceId: z.string().optional(),
  currency: z.string().optional(),
  isRecurring: z.boolean().optional(),
  displayOrder: z.number().optional(),
  limits: z.record(z.string(), z.number()).optional(),
})

export const editPlanSchema = z.object({
  planName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  priceId: z.string().min(1, 'Le Price ID Stripe est requis'),
  description: z.string().optional(),
  price: z.string().min(1, 'Le prix mensuel est requis'),
  yearlyPrice: z.string().optional(),
  annualDiscountPriceId: z.string().optional(),
  currency: z.string().optional(),
  isRecurring: z.boolean().optional(),
  displayOrder: z.number().optional(),
  limits: z.record(z.string(), z.number()).optional(),
})

// Schémas avec internationalisation (pour le futur)
export function createPlanFormSchema(t: (key: string) => string) {
  return createPlanSchema.extend({
    code: z.string().min(2, t('validation.plan.code.min')),
    planName: z.string().min(2, t('validation.plan.name.min')),
    priceId: z.string().min(1, t('validation.plan.priceId.required')),
  })
}

export function editPlanFormSchema(t: (key: string) => string) {
  return editPlanSchema.extend({
    planName: z.string().min(2, t('validation.plan.name.min')),
    priceId: z.string().min(1, t('validation.plan.priceId.required')),
  })
}

// Types inférés pour TypeScript
export type CreatePlanFormData = z.infer<typeof createPlanSchema>
export type EditPlanFormData = z.infer<typeof editPlanSchema>
