import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentHomePageDal,
  getHomePageForBureauDal,
} from '@/app/dal/home-page-dal'
import {getPagesForBureauDal} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {HomePageForm} from '@/components/features/association/home-page-form'
import {Skeleton} from '@/components/ui/skeleton'

import {saveHomePageAction} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauHomePage'})

  return {title: t('metadata.title')}
}

/**
 * Ecran « Page d'accueil » (design s44, ecran 1). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. Le choix et la
 * liste des pages ne sont lus qu'apres ce controle.
 */
export default async function BureauHomePage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageSection />
    </Suspense>
  )
}

async function HomePageSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentHomePageDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [{page: current}, pages] = await Promise.all([
    getHomePageForBureauDal(tenant.id),
    getPagesForBureauDal(tenant.id),
  ])

  return (
    <HomePageForm
      current={current}
      pages={pages.map(({id, title, status}) => ({id, title, status}))}
      saveAction={saveHomePageAction}
    />
  )
}

function HomePageSkeleton() {
  return (
    <div className="flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-80 w-full" />
    </div>
  )
}
