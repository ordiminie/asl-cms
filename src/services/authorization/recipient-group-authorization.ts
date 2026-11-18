import {ActionIdConst} from '@/services/types/domain/action-registry-types'
import {User} from '@/services/types/domain/user-types'

import {canPerformAction} from './action-registry-authorization'

/**
 * Le compte gere-t-il les groupes de destinataires de cette association
 * (s27, ADR 060 §6) ? Lu au registre par `campaign.group.manage`.
 */
export const canManageRecipientGroups = (
  user: User | undefined,
  organizationId: string
): boolean =>
  canPerformAction(user, organizationId, ActionIdConst.CAMPAIGN_GROUP_MANAGE)
