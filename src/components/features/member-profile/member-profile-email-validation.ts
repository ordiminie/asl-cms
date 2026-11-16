import {z} from 'zod'

import type {MemberEmailRole} from '@/services/types/domain/member-email-types'
import type {
  MemberAccountHolderDTO,
  MemberProfileEmailChange,
} from '@/services/types/domain/member-profile-types'

/**
 * Formulaires des adresses d'une fiche, cote bureau (s54, ecran 4). Partages
 * par le client (React Hook Form) et par les actions serveur.
 */
type Translate = (key: string) => string

export const memberEmailFormSchema = z.object({email: z.string()})

export function createMemberEmailFormSchema(t: Translate) {
  return memberEmailFormSchema.extend({
    email: z
      .string()
      .refine((value) => z.string().email().safeParse(value.trim()).success, {
        message: t('validation.emailInvalid'),
      }),
  })
}

export type MemberEmailFormSchemaType = z.infer<typeof memberEmailFormSchema>

/** Champs envoyes aux actions des adresses : jamais un compte a ouvrir. */
export const MEMBER_EMAIL_FORM_FIELDS = {
  memberProfileId: 'memberProfileId',
  emailId: 'emailId',
  email: 'email',
  role: 'role',
  replacementEmailId: 'replacementEmailId',
  replacementEmail: 'replacementEmail',
} as const

/** Ce que les actions des adresses rendent a la carte (4b a 4g). */
export type MemberProfileEmailActionResult =
  | {status: 'saved'; change: MemberProfileEmailChange; email: string}
  | {status: 'invalid'; message: string}
  | {status: 'email_shared'; holder: MemberAccountHolderDTO}
  | {status: 'already_listed'}
  | {status: 'replacement_required'}
  | {status: 'invalid_replacement'}
  | {status: 'board_email_required'}
  | {status: 'error'; message: string}

export type MemberProfileEmailFormAction = (
  prevState: MemberProfileEmailActionResult | undefined,
  formData: FormData
) => Promise<MemberProfileEmailActionResult>

/** Les quatre actions de la carte « Adresses email ». */
export type MemberProfileEmailActions = {
  addEmailAction: MemberProfileEmailFormAction
  updateEmailAction: MemberProfileEmailFormAction
  removeEmailAction: MemberProfileEmailFormAction
  designateHolderAction: MemberProfileEmailFormAction
}

export type MemberEmailRoleChoice = MemberEmailRole
