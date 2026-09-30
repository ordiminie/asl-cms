import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getReportCategoriesForBureauDal} from '@/app/dal/association-category-dal'
import {canManageCurrentReportsDal} from '@/app/dal/incident-report-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {ReportCategoriesManager} from '@/components/features/incident-report/report-categories-manager'
import {Skeleton} from '@/components/ui/skeleton'

import {
  createReportCategoryAction,
  deleteReportCategoryAction,
  updateReportCategoryAction,
} from './actions'

type CategoriesPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: CategoriesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauReportCategoriesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Categories de signalement (ecran 4 du design s10, critere 4). Le controle
 * d'acces est repete ici ; les categories ne sont lues qu'apres lui.
 */
export default async function BureauReportCategoriesPage({
  params,
}: CategoriesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesSection />
    </Suspense>
  )
}

async function CategoriesSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentReportsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getReportCategoriesForBureauDal(tenant.id)

  return (
    <ReportCategoriesManager
      list={list}
      createAction={createReportCategoryAction}
      updateAction={updateReportCategoryAction}
      deleteAction={deleteReportCategoryAction}
    />
  )
}

function CategoriesSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
