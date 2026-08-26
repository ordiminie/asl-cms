import {z} from 'zod'

import {
  REFERRAL_CODE_MAX_LENGTH,
  REFERRAL_CODE_PATTERN,
} from '@/lib/helper/referral-helper'

export const affiliateUuidSchema = z.string().uuid('Identifiant invalide')

export const affiliateCodeSchema = z
  .string()
  .trim()
  .min(3, 'Le code doit contenir au moins 3 caractères')
  .max(
    REFERRAL_CODE_MAX_LENGTH,
    `Le code ne peut pas dépasser ${REFERRAL_CODE_MAX_LENGTH} caractères`
  )
  .regex(
    REFERRAL_CODE_PATTERN,
    'Le code ne peut contenir que des minuscules, des chiffres et des tirets'
  )

export const setAffiliateCodeServiceSchema = z.object({
  code: affiliateCodeSchema,
})

export const attributeReferralServiceSchema = z.object({
  code: affiliateCodeSchema,
  organizationId: affiliateUuidSchema,
  referredUserId: affiliateUuidSchema,
})

export const recordBountyServiceSchema = z.object({
  organizationId: affiliateUuidSchema,
  planCode: z.string().min(1, 'Le code du plan est requis'),
  sourceId: z.string().min(1, "L'identifiant de source est requis"),
  stripeSubscriptionId: z.string().optional(),
  amountPaidCents: z
    .number()
    .int('Le montant doit être un entier')
    .positive("Une prime ne peut pas naître d'une facture à zéro"),
})

export const markPayoutPaidServiceSchema = z.object({
  affiliateId: affiliateUuidSchema,
  externalReference: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type SetAffiliateCodeInput = z.infer<
  typeof setAffiliateCodeServiceSchema
>
export type MarkPayoutPaidInput = z.infer<typeof markPayoutPaidServiceSchema>
