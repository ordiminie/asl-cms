import {z} from 'zod'

import {
  BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH,
  BOARD_MEMBER_NAME_MAX_LENGTH,
  BOARD_MEMBER_ROLE_LABEL_MAX_LENGTH,
} from '../types/domain/board-member-types'

/**
 * Validation des fiches du bureau (s06). Nom et role sont **obligatoires** :
 * il n'existe pas de fiche a moitie remplie, puisqu'il n'existe pas de
 * brouillon. La biographie est facultative et plafonnee.
 */

export const boardMemberOrganizationIdSchema = z.string().uuid()
export const boardMemberIdSchema = z.string().uuid()

export const boardMemberNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(BOARD_MEMBER_NAME_MAX_LENGTH)

export const boardMemberRoleLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(BOARD_MEMBER_ROLE_LABEL_MAX_LENGTH)

export const boardMemberBiographySchema = z
  .string()
  .trim()
  .max(BOARD_MEMBER_BIOGRAPHY_MAX_LENGTH)

const boardMemberFieldsSchema = z.object({
  organizationId: boardMemberOrganizationIdSchema,
  name: boardMemberNameSchema,
  roleLabel: boardMemberRoleLabelSchema,
  biography: boardMemberBiographySchema,
})

export const createBoardMemberServiceSchema = boardMemberFieldsSchema

export const updateBoardMemberServiceSchema = boardMemberFieldsSchema.extend({
  memberId: boardMemberIdSchema,
})

export const boardMemberReferenceServiceSchema = z.object({
  organizationId: boardMemberOrganizationIdSchema,
  memberId: boardMemberIdSchema,
})

export const reorderBoardMembersServiceSchema = z.object({
  organizationId: boardMemberOrganizationIdSchema,
  orderedIds: z.array(boardMemberIdSchema).min(1),
})
