import 'server-only'

import {cache} from 'react'

import {getUnpaidRemindersOverviewService} from '@/services/facades/unpaid-reminder-service-facade'
import type {UnpaidRemindersOverviewDTO} from '@/services/types/domain/unpaid-reminder-types'

/**
 * Le suivi des relances du bureau (s29, ecran 1). Donnee par utilisateur et
 * vivante : **aucun cache persistant**, lue derriere un `<Suspense>`.
 * `cache()` deduplique dans la requete.
 */
export const getUnpaidRemindersOverviewDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<UnpaidRemindersOverviewDTO> =>
    getUnpaidRemindersOverviewService({organizationId, page})
)
