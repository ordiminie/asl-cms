import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentNewsDal, getNewsForBureauDal} from '@/app/dal/news-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {NewsList} from '@/components/features/news/news-list'
import {Skeleton} from '@/components/ui/skeleton'

import {createNewsAction} from './[id]/actions'

type NewsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: NewsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauNewsPage'})

  return {title: t('metadata.title')}
}

/**
 * Liste des actualites du bureau (ecran 1 du design s05). Le controle d'acces
 * est repete ici : une navigation cliente ne rejoue pas le layout.
 */
export default async function BureauNewsPage({
  params,
  searchParams,
}: NewsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<NewsListSkeleton />}>
      <NewsListSection page={current} />
    </Suspense>
  )
}

async function NewsListSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentNewsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getNewsForBureauDal(tenant.id, page)

  return <NewsList list={list} createAction={createNewsAction} />
}

function NewsListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
