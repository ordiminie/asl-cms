import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentPagesDal,
  getPagesForBureauDal,
} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {PagesList} from '@/components/features/pages/pages-list'
import {Skeleton} from '@/components/ui/skeleton'

import {createPageAction} from './[id]/actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauPagesPage'})

  return {title: t('metadata.title')}
}

/**
 * Liste des pages du site (ecran 1 du design s04). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout.
 */
export default async function BureauPagesPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<PagesListSkeleton />}>
      <PagesListSection />
    </Suspense>
  )
}

async function PagesListSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentPagesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const pages = await getPagesForBureauDal(tenant.id)

  return <PagesList pages={pages} createAction={createPageAction} />
}

function PagesListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
