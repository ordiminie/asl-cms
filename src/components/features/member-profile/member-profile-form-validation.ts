import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import {
  MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
  MEMBER_PROFILE_CITY_MAX_LENGTH,
  MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH,
  MEMBER_PROFILE_NAME_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_PATTERN,
  MEMBER_PROFILE_POSTAL_CODE_PATTERN,
  type MemberAccountChange,
  type MemberAccountHolderDTO,
} from '@/services/types/domain/member-profile-types'
import type {MemberRoleChangeKind} from '@/services/types/domain/member-role-types'
import type {MyContactDTO} from '@/services/types/domain/member-space-types'
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

const emailShape = (t: Translate) => ({
  email: z
    .string()
    .refine(
      (value) =>
        isBlank(value) || z.string().email().safeParse(value.trim()).success,
      {message: t('validation.emailInvalid')}
    ),
})

const phoneShape = (t: Translate) => ({
  phone: z
    .string()
    .refine(
      (value) =>
        isBlank(value) ||
        (value.trim().length <= MEMBER_PROFILE_PHONE_MAX_LENGTH &&
          MEMBER_PROFILE_PHONE_PATTERN.test(value.trim())),
      {message: t('validation.phoneInvalid')}
    ),
})

type PostalAddressPrefix = 'home' | 'land'

/**
 * Les champs d'une adresse postale typee (s55, ADR 058) : domicile ou terrain.
 * Les deux groupes portent les memes champs : chaque message nomme son groupe
 * (« Terrain : le code postal compte cinq chiffres. »).
 */
const postalAddressSchemas = (t: Translate, prefix: PostalAddressPrefix) => ({
  line: optionalText(
    MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
    t(`validation.${prefix}.addressMax`)
  ),
  complement: optionalText(
    MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
    t(`validation.${prefix}.addressMax`)
  ),
  postalCode: z
    .string()
    .refine(
      (value) =>
        isBlank(value) || MEMBER_PROFILE_POSTAL_CODE_PATTERN.test(value.trim()),
      {message: t(`validation.${prefix}.postalCodeInvalid`)}
    ),
  city: optionalText(
    MEMBER_PROFILE_CITY_MAX_LENGTH,
    t(`validation.${prefix}.cityMax`)
  ),
})

const homeAddressShape = (t: Translate) => {
  const fields = postalAddressSchemas(t, 'home')
  return {
    homeAddressLine: fields.line,
    homeAddressComplement: fields.complement,
    homePostalCode: fields.postalCode,
    homeCity: fields.city,
  }
}

const landAddressShape = (t: Translate) => {
  const fields = postalAddressSchemas(t, 'land')
  return {
    landAddressLine: fields.line,
    landAddressComplement: fields.complement,
    landPostalCode: fields.postalCode,
    landCity: fields.city,
  }
}

/** Ce que le bureau saisit : telephone, domicile, terrain, entreprise (s55). */
const contactShape = (t: Translate) => ({
  ...phoneShape(t),
  ...homeAddressShape(t),
  ...landAddressShape(t),
  companyName: optionalText(
    MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH,
    t('validation.companyNameMax')
  ),
})

/**
 * Ce que le membre corrige lui-meme (s16) : telephone et domicile, jamais le
 * terrain ni le nom de l'entreprise (s55, critere 5).
 */
export const memberPostalContactFormSchema = z.object({
  phone: z.string(),
  homeAddressLine: z.string(),
  homeAddressComplement: z.string(),
  homePostalCode: z.string(),
  homeCity: z.string(),
})

/**
 * Coordonnees modifiees depuis la fiche : sans email depuis s54, les adresses
 * ont leur carte (ADR 056). Domicile, terrain et nom de l'entreprise (s55).
 */
export const memberContactFormSchema = memberPostalContactFormSchema.extend({
  landAddressLine: z.string(),
  landAddressComplement: z.string(),
  landPostalCode: z.string(),
  landCity: z.string(),
  companyName: z.string(),
})

/** La creation d'une fiche : l'email saisi devient sa titulaire (s54). */
export const memberProfileFormSchema = z.object({
  name: z.string(),
  email: z.string(),
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
    ...emailShape(t),
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
  'phone',
  'homeAddressLine',
  'homeAddressComplement',
  'homePostalCode',
  'homeCity',
  'landAddressLine',
  'landAddressComplement',
  'landPostalCode',
  'landCity',
  'companyName',
] as const satisfies readonly (keyof MemberContactFormSchemaType)[]

export const MEMBER_PROFILE_FORM_FIELDS = [
  'name',
  'email',
  ...MEMBER_CONTACT_FORM_FIELDS,
] as const satisfies readonly (keyof MemberProfileFormSchemaType)[]

export type MemberProfileFormField = (typeof MEMBER_PROFILE_FORM_FIELDS)[number]

/**
 * Champ cache du second envoi (s53, etat 3a) : le compte que le bureau a
 * confirme rejoindre. Le service le revérifie, il ne le croit jamais.
 */
export const CONFIRMED_ACCOUNT_FIELD = 'confirmedAccountUserId'

/** Resultat d'un enregistrement de fiche, rendu par les Server Actions. */
export type MemberProfileActionResult =
  | {
      status: 'saved'
      memberProfileId: string
      /** Ce que l'enregistrement a fait du compte (s12d). */
      accountChange: MemberAccountChange
      /** Nom du compte desormais relie a la fiche, pour le message (s53). */
      accountName?: string | null
    }
  /** Adresse d'un membre du bureau videe : refusee, rien n'est ecrit (s12d). */
  | {status: 'board_email_required'}
  | {
      status: 'invalid'
      errors: {field: MemberProfileFormField; message: string}[]
    }
  /**
   * L'adresse est deja celle d'un compte de l'association : rien n'est ecrit,
   * le bureau confirme (s53, etat 3a).
   */
  | {status: 'email_shared'; holder: MemberAccountHolderDTO}
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

/**
 * Carte « Role dans l'association » (s14) : ce que rend l'enregistrement d'un
 * role. `message` est deja traduit ; `null` quand rien n'a change.
 */
export type ChangeMemberRoleActionResult =
  | {status: 'saved'; change: MemberRoleChangeKind; message: string | null}
  | {status: 'refused'; message: string}
  | {status: 'error'; message: string}

export type ChangeMemberRoleFormAction = (
  prevState: ChangeMemberRoleActionResult | undefined,
  formData: FormData
) => Promise<ChangeMemberRoleActionResult>

/**
 * L'issue de « Envoyer l'invitation » (s42a, ecran 2) : envoyee, reportee
 * au lendemain, partielle, refusee « courrier uniquement », echouee (aucun
 * email parti), ou refusee par la session ou le tenant.
 */
export type InviteMemberActionResult =
  | {status: 'sent'; sent: string[]}
  | {status: 'deferred'; sent: string[]; deferred: string[]}
  | {status: 'partial'; sent: string[]}
  | {status: 'mail_only'}
  | {status: 'failed'}
  | {status: 'error'; message: string}

export type InviteMemberFormAction = (
  prevState: InviteMemberActionResult | undefined,
  formData: FormData
) => Promise<InviteMemberActionResult>

/**
 * « Mes coordonnees » (s16, ADR 040) : les coordonnees que le membre corrige
 * lui-meme, sans email, ni terrain, ni nom d'entreprise (s55). Memes regles
 * et memes messages que la fiche du bureau.
 */
export function createMemberPostalContactFormSchema(t: Translate) {
  return memberPostalContactFormSchema.extend({
    ...phoneShape(t),
    ...homeAddressShape(t),
  })
}

export type MemberPostalContactFormSchemaType = z.infer<
  typeof memberPostalContactFormSchema
>

export const MEMBER_POSTAL_CONTACT_FORM_FIELDS = [
  'phone',
  'homeAddressLine',
  'homeAddressComplement',
  'homePostalCode',
  'homeCity',
] as const satisfies readonly (keyof MemberPostalContactFormSchemaType)[]

export type MemberPostalContactFormField =
  (typeof MEMBER_POSTAL_CONTACT_FORM_FIELDS)[number]

/** Resultat de « Enregistrer mes coordonnees », rendu par la Server Action. */
export type MyContactActionResult =
  | {status: 'saved'; contact: MyContactDTO}
  | {
      status: 'invalid'
      errors: {field: MemberPostalContactFormField; message: string}[]
    }
  | {status: 'error'; message: string}

export type MyContactFormAction = (
  prevState: MyContactActionResult | undefined,
  formData: FormData
) => Promise<MyContactActionResult>
