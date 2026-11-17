import 'server-only'

import {cache} from 'react'

import {getMemberEmailConfirmationStateService} from '@/services/facades/member-email-confirmation-service-facade'
import type {MemberEmailConfirmationStateDTO} from '@/services/types/domain/member-email-types'

/**
 * L'etat de la page publique de confirmation d'une adresse (s54, ecran 3),
 * **lecture seule**. Jamais de cache persistant : le jeton est le seul titre.
 */
export const getMemberEmailConfirmationStateDal = cache(
  async (
    organizationId: string,
    token: string
  ): Promise<MemberEmailConfirmationStateDTO> =>
    getMemberEmailConfirmationStateService({organizationId, token})
)
