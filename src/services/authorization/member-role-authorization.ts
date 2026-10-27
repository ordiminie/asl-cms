import {ActionIdConst} from '@/services/types/domain/action-registry-types'
import {User} from '@/services/types/domain/user-types'

import {canPerformAction} from './action-registry-authorization'

/**
 * Attribuer ou retirer un role d'association (s14, ADR 039) : reserve a qui
 * porte `member.role.assign` dans **cette** association, le SuperAdmin
 * compris. Ce que la personne peut faire du role vise (presidence, dernier
 * compte capable) est tranche ensuite par `decideRoleChange`.
 */
export const canAssignMemberRole = (
  user: User | undefined,
  organizationId: string
): boolean =>
  canPerformAction(user, organizationId, ActionIdConst.MEMBER_ROLE_ASSIGN)
