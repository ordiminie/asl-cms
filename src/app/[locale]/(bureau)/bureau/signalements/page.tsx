import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentReportsDal,
  getIncidentReportsForBureauDal,
} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  IncidentReportList,
  IncidentReportListSkeleton,
} from '@/components/features/incident-report/incident-report-list'

type ReportsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: ReportsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauReportsPage'})

  return {title: t('metadata.title')}
}

/**
 * File de suivi des signalements (ecran 2 du design s10). Le controle d'acces
 * est repete ici : une navigation cliente ne rejoue pas le layout. La file
 * n'est lue qu'apres ce controle.
 */
export default async function BureauReportsPage({
  params,
  searchParams,
}: ReportsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<IncidentReportListSkeleton />}>
      <ReportsListSection page={current} />
    </Suspense>
  )
}

async function ReportsListSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentReportsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getIncidentReportsForBureauDal(tenant.id, page)

  return <IncidentReportList list={list} />
}
