import {ActionIdConst} from '@/services/types/domain/action-registry-types'
import {User} from '@/services/types/domain/user-types'

import {canPerformAction} from './action-registry-authorization'

/**
 * Lire l'etat du compte d'une fiche — l'appartenance d'un tiers a
 * l'association (s12d, ADR 014) : reserve a qui gere les fiches
 * (`member.profile.manage`), le SuperAdmin compris.
 */
export const canReadMemberAccount = (
  user: User | undefined,
  organizationId: string
): boolean =>
  canPerformAction(user, organizationId, ActionIdConst.MEMBER_PROFILE_MANAGE)
