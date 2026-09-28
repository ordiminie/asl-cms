import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageCurrentWaterAnalysisDal,
  getWaterAnalysesForBureauDal,
} from '@/app/dal/water-analysis-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  WaterAnalysisList,
  WaterAnalysisNotice,
} from '@/components/features/water-analysis/water-analysis-list'
import {Skeleton} from '@/components/ui/skeleton'

type WaterAnalysisPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string; statut?: string}>
}

/** `?statut=` pose par les Server Actions apres un succes -> message ancre. */
const NOTICES: Record<string, WaterAnalysisNotice> = {
  publiee: 'published',
  enregistree: 'saved',
  supprimee: 'deleted',
}

export async function generateMetadata({
  params,
}: WaterAnalysisPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauWaterAnalysisPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Liste des analyses d'eau du bureau (design s09, ecran 1). Le controle
 * d'acces est repete ici : une navigation cliente ne rejoue pas le layout.
 */
export default async function BureauWaterAnalysisPage({
  params,
  searchParams,
}: WaterAnalysisPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page, statut} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<WaterAnalysisListSkeleton />}>
      <WaterAnalysisListSection
        page={current}
        notice={statut ? NOTICES[statut] : undefined}
      />
    </Suspense>
  )
}

async function WaterAnalysisListSection({
  page,
  notice,
}: {
  page: number
  notice?: WaterAnalysisNotice
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentWaterAnalysisDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getWaterAnalysesForBureauDal(tenant.id, page)

  return <WaterAnalysisList list={list} notice={notice} />
}

/** Le squelette ne couvre que les lignes du tableau, jamais un formulaire. */
function WaterAnalysisListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
