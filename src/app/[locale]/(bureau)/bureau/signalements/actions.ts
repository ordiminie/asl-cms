'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {ReportStatusActionResult} from '@/components/features/incident-report/incident-report-detail'
import {REPORTS_ROUTE_PATTERN} from '@/components/features/incident-report/report-paths'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {changeIncidentReportStatusService} from '@/services/facades/incident-report-service-facade'
import type {ReportStatus} from '@/services/types/domain/incident-report-types'

/**
 * Fait avancer un signalement d'un pas (s10, ecran 3, critere 3).
 *
 * Rejoue le controle de session (`requireActionAuth`) avant d'appeler la
 * facade — le service reverifie `report.manage` de son cote et attribue le
 * changement a l'utilisateur authentifie — puis revalide la file et le detail
 * **apres** le succes seulement. Une course perdue (`stale`) revalide aussi :
 * la page se recharge sur le statut reel. Un refus est rendu comme un
 * resultat traduit, jamais leve.
 */
export async function changeReportStatusAction(
  reportId: string,
  to: ReportStatus
): Promise<ReportStatusActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauReportsPage.errors')

  try {
    await requireActionAuth()

    const result = await changeIncidentReportStatusService({
      organizationId: tenant.id,
      reportId,
      to,
    })

    revalidatePath(REPORTS_ROUTE_PATTERN, 'layout')
    return result.status === 'changed'
      ? {status: 'changed'}
      : {status: 'stale', message: t('stale')}
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof AuthorizationError ? t('forbidden') : t('failed'),
    }
  }
}
