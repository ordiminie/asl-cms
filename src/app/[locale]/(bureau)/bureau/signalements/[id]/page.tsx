import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentReportsDal,
  getIncidentReportForBureauDal,
} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {IncidentReportDetail} from '@/components/features/incident-report/incident-report-detail'
import {Skeleton} from '@/components/ui/skeleton'

import {changeReportStatusAction} from '../actions'

type ReportPageProps = {params: Promise<{locale: string; id: string}>}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauReportsPage.detail',
  })

  return {title: t('metadataTitle')}
}

/**
 * Detail d'un signalement (ecran 3 du design s10). La lecture n'est pas
 * cachee ; le controle d'acces est repete ici.
 */
export default async function BureauReportPage({params}: ReportPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportSection reportId={id} />
    </Suspense>
  )
}

async function ReportSection({reportId}: {reportId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentReportsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const report = await getIncidentReportForBureauDal(tenant.id, reportId)
  if (!report) {
    notFound()
  }

  return (
    <IncidentReportDetail
      report={report}
      changeStatusAction={changeReportStatusAction}
    />
  )
}

function ReportSkeleton() {
  return (
    <div className="flex w-full max-w-[68ch] flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
