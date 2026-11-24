import 'server-only'

import {cache} from 'react'

import {getMemberInvitationsOverviewService} from '@/services/facades/member-invitation-campaign-service-facade'
import type {MemberInvitationsPageDTO} from '@/services/types/domain/member-invitation-campaign-types'

/**
 * La page « Invitations des membres » du bureau (s42b, ecrans 1 et 2).
 * Donnee par utilisateur et vivante : **aucun cache persistant**, lue
 * derriere un `<Suspense>`. `cache()` deduplique dans la requete.
 */
export const getMemberInvitationsOverviewDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<MemberInvitationsPageDTO> =>
    getMemberInvitationsOverviewService({organizationId, page})
)
