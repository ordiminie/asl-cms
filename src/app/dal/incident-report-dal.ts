import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageIncidentReportsService,
  getIncidentReportService,
  getIncidentReportsPageService,
} from '@/services/facades/incident-report-service-facade'
import {
  IncidentReportDTO,
  IncidentReportListPageDTO,
} from '@/services/types/domain/incident-report-types'

/**
 * File de suivi des signalements (s10). **Aucun `'use cache'`** : c'est une
 * donnee d'administration, qui se streame derriere un `<Suspense>` et doit
 * refleter le dernier signalement arrive. Le service ouvre lui-meme le scope
 * du tenant (`withTenant`) pour l'association passee, celle du domaine appele
 * (patron `contact-message-dal.ts`).
 */
export const getIncidentReportsForBureauDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<IncidentReportListPageDTO> =>
    getIncidentReportsPageService(organizationId, page)
)

/**
 * Un signalement du bureau. L'absence, ou un identifiant malforme qui ne peut
 * designer aucun signalement, devient `undefined`, que l'appelant traduit en
 * 404 : un refus ou une panne remonte.
 */
export const getIncidentReportForBureauDal = cache(
  async (
    organizationId: string,
    reportId: string
  ): Promise<IncidentReportDTO | undefined> =>
    getIncidentReportService(organizationId, reportId).catch(
      (error: unknown) => {
        if (
          error instanceof NotFoundError ||
          error instanceof ValidationParsedZodError
        )
          return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte peut-il suivre les signalements de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentReportsDal = cache(async (): Promise<boolean> => {
  const tenant = await requireCurrentTenantDal()
  return canManageIncidentReportsService(tenant.id)
})
