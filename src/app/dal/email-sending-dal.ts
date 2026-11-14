import 'server-only'

import {cache} from 'react'

import {getEmailSendingOverviewService} from '@/services/facades/email-sending-service-facade'
import type {EmailSendingOverviewDTO} from '@/services/types/domain/email-send-types'

/**
 * Les envois d'emails du bureau (s52, ecran 1). **Aucun cache persistant** :
 * les compteurs du jour bougent a chaque envoi, la page les lit vivants,
 * derriere un `<Suspense>`. `cache()` deduplique dans la requete ; l'instant
 * est celui de la requete.
 */
export const getEmailSendingOverviewDal = cache(
  async (organizationId: string): Promise<EmailSendingOverviewDTO> =>
    getEmailSendingOverviewService(organizationId, new Date())
)
