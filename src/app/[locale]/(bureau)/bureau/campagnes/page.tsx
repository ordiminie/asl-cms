import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentCampaignsDal,
  getCampaignsPageDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  CampaignList,
  CampaignListError,
  CampaignListSkeleton,
} from '@/components/features/campaigns/campaign-list'

type CampaignsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: CampaignsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'CampaignsBureau'})

  return {title: t('metadata.title')}
}

/**
 * L'archive des campagnes (ecran 1 du design s25). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. L'archive
 * n'est lue qu'apres ce controle ; donnee personnelle, streamee, sans cache.
 */
export default async function BureauCampaignsPage({
  params,
  searchParams,
}: CampaignsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<CampaignListSkeleton />}>
      <CampaignsSection page={current} />
    </Suspense>
  )
}

async function CampaignsSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getCampaignsPageDal(tenant.id, page).catch(() => undefined)

  return list ? <CampaignList list={list} /> : <CampaignListError />
}
