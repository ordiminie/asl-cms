import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentCampaignsDal,
  getCampaignDal,
  getCampaignRecipientsDal,
} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  CampaignDetail,
  CampaignDetailSkeleton,
  CampaignNotFound,
} from '@/components/features/campaigns/campaign-detail'
import {
  pageOfParam,
  recipientFilterOfSlug,
} from '@/components/features/campaigns/campaign-paths'
import {getCampaignDailySendCap} from '@/services/types/domain/association-settings-types'
import type {CampaignRecipientFilter} from '@/services/types/domain/campaign-types'

type CampaignPageProps = {
  params: Promise<{locale: string; id: string}>
  searchParams: Promise<{envoi?: string; statut?: string; page?: string}>
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
 * Une campagne (ecran 2 du design s26), en lecture seule : avancement, parts
 * et destinataires. `?statut=` filtre la liste des destinataires, `?page=` la
 * pagine. L'etat affiche se lit des statuts (ADR 052), sans horloge.
 */
export default async function BureauCampaignPage({
  params,
  searchParams,
}: CampaignPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)
  const {envoi, statut, page} = await searchParams
  const filter = recipientFilterOfSlug(statut)
  const current = pageOfParam(page)

  return (
    <Suspense key={id} fallback={<CampaignDetailSkeleton />}>
      <CampaignSection
        id={id}
        justSent={envoi === '1'}
        filter={filter}
        page={current}
      />
    </Suspense>
  )
}

async function CampaignSection({
  id,
  justSent,
  filter,
  page,
}: {
  id: string
  justSent: boolean
  filter: CampaignRecipientFilter
  page: number
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [result, recipients, settings] = await Promise.all([
    getCampaignDal(tenant.id, id).catch(() => undefined),
    getCampaignRecipientsDal(tenant.id, id, filter, page).catch(
      () => undefined
    ),
    getAssociationSettingsDal(tenant.id),
  ])
  if (result?.status !== 'found') {
    return <CampaignNotFound />
  }

  return (
    <CampaignDetail
      campaign={result.campaign}
      recipients={recipients?.status === 'found' ? recipients.recipients : null}
      dailySendCap={getCampaignDailySendCap(settings)}
      associationName={tenant.name}
      justSent={justSent}
    />
  )
}
