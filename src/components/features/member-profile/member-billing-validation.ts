import {z} from 'zod'

import {MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH} from '@/services/types/domain/member-profile-types'

/**
 * Carte « Facturation » d'une fiche (s20, critere 4) : l'identifiant client
 * Pennylane saisi par le bureau. Partage par le formulaire (React Hook Form)
 * et l'action serveur ; vide, il est retire.
 */
type Translate = (key: string) => string

export const memberBillingFormSchema = z.object({
  pennylaneCustomerId: z.string(),
})

export function createMemberBillingFormSchema(t: Translate) {
  return memberBillingFormSchema.extend({
    pennylaneCustomerId: z
      .string()
      .refine(
        (value) =>
          value.trim().length <= MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH,
        {message: t('detail.billing.errors.tooLong')}
      ),
  })
}

export type MemberBillingFormSchemaType = z.infer<
  typeof memberBillingFormSchema
>

export const MEMBER_BILLING_FORM_FIELDS = [
  'pennylaneCustomerId',
] as const satisfies readonly (keyof MemberBillingFormSchemaType)[]

export type MemberBillingFormField = (typeof MEMBER_BILLING_FORM_FIELDS)[number]

export type MemberBillingActionResult =
  | {status: 'saved'}
  | {
      status: 'invalid'
      errors: {field: MemberBillingFormField; message: string}[]
    }
  | {status: 'error'; message: string}

export type MemberBillingFormAction = (
  prevState: MemberBillingActionResult | undefined,
  formData: FormData
) => Promise<MemberBillingActionResult>
