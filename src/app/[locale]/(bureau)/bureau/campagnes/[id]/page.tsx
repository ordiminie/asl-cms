import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentCampaignsDal,
  getCampaignDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  CampaignDetail,
  CampaignDetailSkeleton,
  CampaignNotFound,
} from '@/components/features/campaigns/campaign-detail'
import {effectiveCampaignStatus} from '@/services/rules/campaign-rules'

type CampaignPageProps = {
  params: Promise<{locale: string; id: string}>
  searchParams: Promise<{envoi?: string}>
}

export async function generateMetadata({
  params,
}: CampaignPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'CampaignsBureau'})

  return {title: t('metadata.title')}
}

/**
 * Une campagne archivee (ecran 4 du design s25), en lecture seule. Le statut
 * affiche est le statut **effectif**, calcule ici avec l'heure de la requete
 * — jamais dans un scope `'use cache'`.
 */
export default async function BureauCampaignPage({
  params,
  searchParams,
}: CampaignPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)
  const {envoi} = await searchParams

  return (
    <Suspense key={id} fallback={<CampaignDetailSkeleton />}>
      <CampaignSection id={id} justSent={envoi === '1'} />
    </Suspense>
  )
}

async function CampaignSection({
  id,
  justSent,
}: {
  id: string
  justSent: boolean
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const result = await getCampaignDal(tenant.id, id).catch(() => undefined)
  if (result?.status !== 'found') {
    return <CampaignNotFound />
  }

  return (
    <CampaignDetail
      campaign={result.campaign}
      status={effectiveCampaignStatus(result.campaign, new Date())}
      associationName={tenant.name}
      justSent={justSent}
    />
  )
}
