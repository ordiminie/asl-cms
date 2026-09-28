import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentWaterAnalysisDal} from '@/app/dal/water-analysis-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {WaterAnalysisForm} from '@/components/features/water-analysis/water-analysis-form'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {publishWaterAnalysisAction} from '../actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauWaterAnalysisPage',
  })

  return {title: t('form.newTitle')}
}

/** Publication d'une analyse d'eau (design s09, ecran 2). */
export default async function BureauNewWaterAnalysisPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewWaterAnalysisSection />
    </Suspense>
  )
}

async function NewWaterAnalysisSection() {
  const allowed = await canManageCurrentWaterAnalysisDal()
  if (!allowed) {
    return <BureauAccessDenied />
  }

  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris, celui que la Server Action appliquera.
  const today = calendarDayOf(new Date())

  return (
    <WaterAnalysisForm today={today} saveAction={publishWaterAnalysisAction} />
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
