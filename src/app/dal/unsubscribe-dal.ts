import 'server-only'

import {cache} from 'react'

import {
  getMemberUnsubscribeService,
  getUnsubscribePageStateService,
} from '@/services/facades/unsubscribe-service-facade'
import {
  MemberUnsubscribeDTO,
  UnsubscribePageState,
} from '@/services/types/domain/campaign-types'

/**
 * L'etat de la page publique de desinscription (s25, ADR 051), **lecture
 * seule**. Jamais de cache persistant : le jeton est le titre du membre.
 */
export const getUnsubscribePageStateDal = cache(
  async (
    organizationId: string,
    token: string
  ): Promise<UnsubscribePageState> =>
    getUnsubscribePageStateService({organizationId, token})
)

/**
 * Le refus des campagnes d'une fiche, pour sa mention (ecran 5). Un refus
 * d'acces ou une panne n'affiche **aucune** mention : la fiche reste lisible,
 * et la mention n'est jamais une raison de la faire echouer.
 */
export const getMemberUnsubscribeForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<MemberUnsubscribeDTO | null> =>
    getMemberUnsubscribeService({organizationId, memberProfileId}).catch(
      () => null
    )
)
