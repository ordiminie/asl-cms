import {z} from 'zod'

import {
  MEMBER_PROFILE_ADDRESS_MAX_LENGTH,
  MEMBER_PROFILE_CITY_MAX_LENGTH,
  MEMBER_PROFILE_NAME_MAX_LENGTH,
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

const postalContactShape = {
  phone: optionalContact(
    z
      .string()
      .max(MEMBER_PROFILE_PHONE_MAX_LENGTH)
      .regex(MEMBER_PROFILE_PHONE_PATTERN)
  ),
  addressLine: optionalContact(
    z.string().max(MEMBER_PROFILE_ADDRESS_MAX_LENGTH)
  ),
  addressComplement: optionalContact(
    z.string().max(MEMBER_PROFILE_ADDRESS_MAX_LENGTH)
  ),
  postalCode: optionalContact(
    z.string().regex(MEMBER_PROFILE_POSTAL_CODE_PATTERN)
  ),
  city: optionalContact(z.string().max(MEMBER_PROFILE_CITY_MAX_LENGTH)),
}

const contactShape = {
  email: optionalContact(z.string().email()),
  ...postalContactShape,
}

export const createMemberProfileServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  name: z.string().trim().min(1).max(MEMBER_PROFILE_NAME_MAX_LENGTH),
  ...contactShape,
})

export const updateMemberProfileContactServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  memberProfileId: memberProfileIdSchema,
  ...contactShape,
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
})

/**
 * Coordonnees qu'un membre corrige lui-meme (s16, ADR 040) : sans email. Les
 * cles inconnues (`email`, `memberProfileId`) sont retirees par Zod.
 */
export const updateMyContactServiceSchema = z.object({
  organizationId: memberProfileOrganizationIdSchema,
  ...postalContactShape,
})
