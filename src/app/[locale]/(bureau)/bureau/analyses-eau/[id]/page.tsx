import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageCurrentWaterAnalysisDal,
  getWaterAnalysisForBureauDal,
} from '@/app/dal/water-analysis-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {WaterAnalysisForm} from '@/components/features/water-analysis/water-analysis-form'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {deleteWaterAnalysisAction, updateWaterAnalysisAction} from '../actions'

type EditorParams = {params: Promise<{locale: string; id: string}>}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({
  params,
}: EditorParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauWaterAnalysisPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Correction d'une analyse d'eau en ligne (design s09, ecran 3). La lecture
 * du bureau n'est pas cachee : l'ecran repart du dernier etat enregistre.
 */
export default async function BureauEditWaterAnalysisPage({
  params,
}: EditorParams) {
  const {locale, id} = await params
  setRequestLocale(locale)

  // Un identifiant qui n'est pas un UUID n'est pas une analyse : 404 tout de
  // suite, sans interroger la base.
  if (!UUID_PATTERN.test(id)) {
    notFound()
  }

  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditWaterAnalysisSection analysisId={id} />
    </Suspense>
  )
}

async function EditWaterAnalysisSection({analysisId}: {analysisId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentWaterAnalysisDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const analysis = await getWaterAnalysisForBureauDal(tenant.id, analysisId)
  if (!analysis) {
    notFound()
  }

  return (
    <WaterAnalysisForm
      analysis={analysis}
      today={calendarDayOf(new Date())}
      saveAction={updateWaterAnalysisAction}
      deleteAction={deleteWaterAnalysisAction}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
