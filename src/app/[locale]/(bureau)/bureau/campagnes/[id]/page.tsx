import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentCampaignsDal,
  getCampaignDal,
  getCampaignLetterContextDal,
  getCampaignRecipientsDal,
  getCampaignStatisticsDal,
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
import {
  CampaignStatisticsCard,
  CampaignStatisticsCardFallback,
} from '@/components/features/campaigns/campaign-statistics-card'
import {getCampaignDailySendCap} from '@/services/types/domain/association-settings-types'
import type {
  CampaignDTO,
  CampaignRecipientFilter,
  CampaignStatisticsReadResult,
} from '@/services/types/domain/campaign-types'

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
 * Une campagne (ecran 2 du design s26) : avancement, ouvertures et clics
 * (s30), parts, destinataires et courrier postal (s28). `?statut=` filtre
 * la liste des destinataires, `?page=` la pagine. L'etat de l'envoi se lit
 * des statuts (ADR 052), sans horloge ; la carte des statistiques, elle,
 * lit l'horloge et peut ecrire le releve de la campagne (ADR 068).
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

  const [result, recipients, letters, settings] = await Promise.all([
    getCampaignDal(tenant.id, id).catch(() => undefined),
    getCampaignRecipientsDal(tenant.id, id, filter, page).catch(
      () => undefined
    ),
    getCampaignLetterContextDal(tenant.id, id).catch(() => null),
    getAssociationSettingsDal(tenant.id),
  ])
  if (result?.status !== 'found') {
    return <CampaignNotFound />
  }

  return (
    <CampaignDetail
      campaign={result.campaign}
      recipients={recipients?.status === 'found' ? recipients.recipients : null}
      letters={letters}
      statistics={
        <Suspense fallback={<CampaignStatisticsCardFallback />}>
          <CampaignStatisticsSection
            organizationId={tenant.id}
            campaign={result.campaign}
          />
        </Suspense>
      }
      dailySendCap={getCampaignDailySendCap(settings)}
      associationName={tenant.name}
      justSent={justSent}
    />
  )
}

const UNREACHABLE_STATISTICS: CampaignStatisticsReadResult = {
  status: 'found',
  statistics: {state: 'unavailable', reason: 'unreachable'},
}

/**
 * La carte « Ouvertures et clics » (s30), streamee seule : la lenteur ou
 * l'echec du fournisseur ne touche qu'elle, rendue indisponible.
 */
async function CampaignStatisticsSection({
  organizationId,
  campaign,
}: {
  organizationId: string
  campaign: CampaignDTO
}) {
  const result = await getCampaignStatisticsDal(
    organizationId,
    campaign.id
  ).catch(() => UNREACHABLE_STATISTICS)
  if (result.status !== 'found') return null

  return (
    <CampaignStatisticsCard
      statistics={result.statistics}
      parts={campaign.parts}
    />
  )
}
