import {
  RoleConst,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'
import {User} from '@/services/types/domain/user-types'

const BOARD_ROLES: string[] = [
  UserOrganizationRoleConst.OWNER,
  UserOrganizationRoleConst.ADMIN,
]

/**
 * Gerer le logo et le favicon d'une association (s01b, critere 8) : le
 * SuperAdmin, ou le bureau de **cette** association — Bureau (`admin`) et
 * President(e) (`owner`).
 *
 * Volontairement hors CASL : l'`admin` global y gere toutes les organisations,
 * et la story l'exclut.
 */
export const canManageAssociationIdentity = (
  user: User | undefined,
  organizationId: string
): boolean => {
  if (!user) return false
  if (user.role === RoleConst.SUPER_ADMIN) return true

  return (user.organizations ?? []).some(
    (membership) =>
      membership.organizationId === organizationId &&
      BOARD_ROLES.includes(membership.role)
  )
}
