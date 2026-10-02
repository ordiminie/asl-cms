import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import {
  MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
  MEMBER_PROFILE_CITY_MAX_LENGTH,
  MEMBER_PROFILE_NAME_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_PATTERN,
  MEMBER_PROFILE_POSTAL_CODE_PATTERN,
} from '@/services/types/domain/member-profile-types'
import {
  type OwnershipConflictDTO,
  PARCEL_NUMBER_MAX_LENGTH,
} from '@/services/types/domain/parcel-ownership-types'

/**
 * Formulaires des proprietaires (s12, ecrans 2, 3 et 4). Partages par le
 * client (React Hook Form) et par les actions serveur. Seul le nom est
 * obligatoire : une coordonnee vide ou faite d'espaces est absente.
 */
const isBlank = (value: string) => value.trim().length === 0

type Translate = (key: string) => string

const optionalText = (max: number, message: string) =>
  z.string().refine((value) => value.trim().length <= max, {message})

const contactShape = (t: Translate) => ({
  email: z
    .string()
    .refine(
      (value) =>
        isBlank(value) || z.string().email().safeParse(value.trim()).success,
      {message: t('validation.emailInvalid')}
    ),
  phone: z
    .string()
    .refine(
      (value) =>
        isBlank(value) ||
        (value.trim().length <= MEMBER_PROFILE_PHONE_MAX_LENGTH &&
          MEMBER_PROFILE_PHONE_PATTERN.test(value.trim())),
      {message: t('validation.phoneInvalid')}
    ),
  addressLine: optionalText(
    MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
    t('validation.addressMax')
  ),
  addressComplement: optionalText(
    MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
    t('validation.addressMax')
  ),
  postalCode: z
    .string()
    .refine(
      (value) =>
        isBlank(value) || MEMBER_PROFILE_POSTAL_CODE_PATTERN.test(value.trim()),
      {message: t('validation.postalCodeInvalid')}
    ),
  city: optionalText(MEMBER_PROFILE_CITY_MAX_LENGTH, t('validation.cityMax')),
})

export const memberContactFormSchema = z.object({
  email: z.string(),
  phone: z.string(),
  addressLine: z.string(),
  addressComplement: z.string(),
  postalCode: z.string(),
  city: z.string(),
})

export const memberProfileFormSchema = z.object({
  name: z.string(),
  ...memberContactFormSchema.shape,
})

export function createMemberContactFormSchema(t: Translate) {
  return memberContactFormSchema.extend(contactShape(t))
}

export function createMemberProfileFormSchema(t: Translate) {
  return memberProfileFormSchema.extend({
    name: z
      .string()
      .refine((value) => !isBlank(value), {
        message: t('validation.nameRequired'),
      })
      .refine(
        (value) => value.trim().length <= MEMBER_PROFILE_NAME_MAX_LENGTH,
        {message: t('validation.nameMax')}
      ),
    ...contactShape(t),
  })
}

export type MemberContactFormSchemaType = z.infer<
  typeof memberContactFormSchema
>
export type MemberProfileFormSchemaType = z.infer<
  typeof memberProfileFormSchema
>

export const MEMBER_CONTACT_FORM_FIELDS = [
  'email',
  'phone',
  'addressLine',
  'addressComplement',
  'postalCode',
  'city',
] as const satisfies readonly (keyof MemberContactFormSchemaType)[]

export const MEMBER_PROFILE_FORM_FIELDS = [
  'name',
  ...MEMBER_CONTACT_FORM_FIELDS,
] as const satisfies readonly (keyof MemberProfileFormSchemaType)[]

export type MemberProfileFormField = (typeof MEMBER_PROFILE_FORM_FIELDS)[number]

/** Resultat d'un enregistrement de fiche, rendu par les Server Actions. */
export type MemberProfileActionResult =
  | {status: 'saved'; memberProfileId: string}
  | {
      status: 'invalid'
      errors: {field: MemberProfileFormField; message: string}[]
    }
  | {status: 'email_taken'; memberProfileId: string; name: string}
  | {status: 'error'; message: string}

/** Le `dialog` de rattachement (ecran 4) : la date est saisie `jj/mm/aaaa`. */
export const attachParcelFormSchema = z.object({
  parcelNumber: z.string(),
  startsOn: z.string(),
})

export function createAttachParcelFormSchema(t: Translate) {
  return attachParcelFormSchema.extend({
    parcelNumber: z
      .string()
      .refine((value) => !isBlank(value), {
        message: t('validation.parcelNumberRequired'),
      })
      .refine((value) => value.trim().length <= PARCEL_NUMBER_MAX_LENGTH, {
        message: t('validation.parcelNumberMax'),
      }),
    startsOn: z
      .string()
      .refine((value) => frenchDateToIso(value) !== undefined, {
        message: t('validation.dateInvalid'),
      }),
  })
}

export type AttachParcelFormSchemaType = z.infer<typeof attachParcelFormSchema>

export const ATTACH_PARCEL_FORM_FIELDS = [
  'parcelNumber',
  'startsOn',
] as const satisfies readonly (keyof AttachParcelFormSchemaType)[]

export type AttachParcelFormField = (typeof ATTACH_PARCEL_FORM_FIELDS)[number]

/** Resultat d'un rattachement, rendu par la Server Action. */
export type AttachParcelActionResult =
  | {
      status: 'attached'
      parcelNumber: string
      /** La parcelle n'existait pas : elle vient d'etre creee (etat `4d`). */
      parcelCreated: boolean
      /** Date ISO du debut de propriete. */
      startsOn: string
    }
  | {
      status: 'invalid'
      errors: {field: AttachParcelFormField; message: string}[]
    }
  | {status: 'overlap'; parcelNumber: string; conflict: OwnershipConflictDTO}
  /** La date est posterieure a aujourd'hui : rien n'a ete ecrit. */
  | {status: 'future_date'}
  | {status: 'error'; message: string}
