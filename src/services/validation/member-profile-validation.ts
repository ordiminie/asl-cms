import {z} from 'zod'

import {
  MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
  MEMBER_PROFILE_CITY_MAX_LENGTH,
  MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH,
  MEMBER_PROFILE_NAME_MAX_LENGTH,
  MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_MAX_LENGTH,
  MEMBER_PROFILE_PHONE_PATTERN,
  MEMBER_PROFILE_POSTAL_CODE_PATTERN,
  MEMBER_PROFILE_SEARCH_MAX_LENGTH,
} from '../types/domain/member-profile-types'

/**
 * Validation des fiches de proprietaires (s12, decisions A et H).
 *
 * Seul le nom est obligatoire. Toute coordonnee laissee vide ou faite
 * d'espaces est **absente** et sort `null` : aucune chaine vide n'est jamais
 * ecrite, et « courrier uniquement » ne se deduit que d'un email `NULL`.
 */

export const memberProfileOrganizationIdSchema = z.string().uuid()
export const memberProfileIdSchema = z.string().uuid()

/** Une coordonnee facultative : vide ou faite d'espaces, elle est absente. */
const optionalContact = (schema: z.ZodString) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    })
    .pipe(schema.optional())
    .transform((value) => value ?? null)

const phoneShape = {
  phone: optionalContact(
    z
      .string()
      .max(MEMBER_PROFILE_PHONE_MAX_LENGTH)
      .regex(MEMBER_PROFILE_PHONE_PATTERN)
  ),
}

/**
 * Une adresse postale typee (s55, ADR 058) : `home` pour le domicile, `land`
 * pour le terrain. Meme regle dans les deux : code postal a cinq chiffres.
 */
const postalAddressShape = <Prefix extends 'home' | 'land'>(prefix: Prefix) =>
  ({
    [`${prefix}AddressLine`]: optionalContact(
      z.string().max(MEMBER_PROFILE_ADDRESS_MAX_LENGTH)
    ),
    [`${prefix}AddressComplement`]: optionalContact(
      z.string().max(MEMBER_PROFILE_ADDRESS_MAX_LENGTH)
    ),
    [`${prefix}PostalCode`]: optionalContact(
      z.string().regex(MEMBER_PROFILE_POSTAL_CODE_PATTERN)
    ),
    [`${prefix}City`]: optionalContact(
      z.string().max(MEMBER_PROFILE_CITY_MAX_LENGTH)
    ),
  }) as Record<
    `${Prefix}${'AddressLine' | 'AddressComplement' | 'PostalCode' | 'City'}`,
    ReturnType<typeof optionalContact>
  >

/** Ce que le membre corrige lui-meme (s16) : telephone et domicile. */
const memberPostalContactShape = {
  ...phoneShape,
  ...postalAddressShape('home'),
}

/** Ce que le bureau saisit : en plus, le terrain et le nom de l'entreprise. */
const postalContactShape = {
  ...memberPostalContactShape,
  ...postalAddressShape('land'),
  companyName: optionalContact(
    z.string().max(MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH)
  ),
}

const contactShape = {
  email: optionalContact(z.string().email()),
  ...postalContactShape,
  /** Le compte confirme par le bureau (s53, ADR 054 §4), revérifie au serveur. */
  confirmedAccountUserId: z.string().uuid().optional(),
}

export const createMemberProfileServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  name: z.string().trim().min(1).max(MEMBER_PROFILE_NAME_MAX_LENGTH),
  ...contactShape,
  /** Ecrit par l'import seul (s13, ADR 048) ; jamais saisi par le bureau. */
  pennylaneCustomerId: optionalContact(
    z.string().max(MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH)
  ),
})

/** Coordonnees de la fiche, sans email : les adresses ont leur carte (s54). */
export const updateMemberProfileContactServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  ...postalContactShape,
})

export const memberProfileServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
})

export const memberProfilePageServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  page: z.number().int().min(1),
  search: z
    .string()
    .max(MEMBER_PROFILE_SEARCH_MAX_LENGTH)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    }),
  /** Le filtre « Groupe » de la liste (s27). */
  groupId: z.string().uuid().optional(),
})

/**
 * Coordonnees qu'un membre corrige lui-meme (s16, ADR 040) : sans email, ni
 * terrain, ni nom d'entreprise (s55). Les cles inconnues (`email`,
 * `memberProfileId`, `land…`, `companyName`) sont retirees par Zod.
 */
export const updateMyContactServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  ...memberPostalContactShape,
})

/** Recherche d'une fiche par sa cle d'import Pennylane (s13, ADR 048). */
export const findByPennylaneIdServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  pennylaneCustomerId: z
    .string()
    .trim()
    .min(1)
    .max(MEMBER_PROFILE_PENNYLANE_ID_MAX_LENGTH),
})

/** Une adresse saisie : obligatoire, sans espaces autour (s54). */
const requiredEmailSchema = z.string().trim().min(1).email()

const memberEmailRoleSchema = z.enum(['holder', 'additional'])

/** Le bureau ajoute une adresse a une fiche (s54, ADR 056 §4). */
export const addMemberProfileEmailServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  email: requiredEmailSchema,
  role: memberEmailRoleSchema.optional(),
  confirmedAccountUserId: z.string().uuid().optional(),
  origin: z.enum(['file', 'site']).optional(),
})

export const updateMemberProfileEmailServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  emailId: z.string().uuid(),
  email: requiredEmailSchema,
  confirmedAccountUserId: z.string().uuid().optional(),
})

export const removeMemberProfileEmailServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  emailId: z.string().uuid(),
  replacementEmailId: z.string().uuid().optional(),
  replacementEmail: optionalContact(z.string().email()),
})

export const designateMemberProfileHolderServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  emailId: z.string().uuid(),
})

/** Le membre ajoute une adresse depuis son espace (s54, 1b). */
export const addMyEmailServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  email: requiredEmailSchema,
  locale: z.string().optional(),
})

/** Le membre designe une de ses adresses : sa propre adresse, ou son attente. */
export const myEmailTargetServiceSchema = addMyEmailServiceSchema.extend({
  emailId: z.string().uuid(),
})

export const cancelMyPendingEmailServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  emailId: z.string().uuid(),
})
