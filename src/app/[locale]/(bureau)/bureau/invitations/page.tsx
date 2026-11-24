import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {getMemberInvitationsOverviewDal} from '@/app/dal/member-invitation-campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  MemberInvitationsError,
  MemberInvitationsOverview,
  MemberInvitationsSkeleton,
} from '@/components/features/member-invitation-campaign/member-invitations-overview'
import {logger} from '@/lib/logger'

import {
  launchMemberInvitationsAction,
  remindNeverSignedInAction,
} from './actions'

type MemberInvitationsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: MemberInvitationsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'MemberInvitationsBureau',
  })

  return {title: t('metadata.title')}
}

/**
 * Le lancement des invitations et le suivi d'adoption (s42b, ecrans 1 et 2).
 * Le controle d'acces est repete ici (une navigation cliente ne rejoue pas le
 * layout) : celui des campagnes (Q9). Donnee vivante, streamee, sans cache.
 */
export default async function BureauMemberInvitationsPage({
  params,
  searchParams,
}: MemberInvitationsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<MemberInvitationsSkeleton />}>
      <MemberInvitationsSection page={current} />
    </Suspense>
  )
}

async function MemberInvitationsSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const overview = await getMemberInvitationsOverviewDal(tenant.id, page).catch(
    (error: unknown) => logOverviewReadFailure(tenant.id, error)
  )

  return overview ? (
    <MemberInvitationsOverview
      page={overview}
      launchAction={launchMemberInvitationsAction}
      remindAction={remindNeverSignedInAction}
    />
  ) : (
    <MemberInvitationsError />
  )
}

/**
 * La lecture en echec reste visible dans les journaux du serveur : l'erreur
 * et l'association, ni adresse ni fiche. L'ecran affiche l'erreur (1l).
 */
function logOverviewReadFailure(organizationId: string, error: unknown) {
  logger.error('[MEMBER-INVITATION] lecture de la page en echec', {
    organizationId,
    errorName: error instanceof Error ? error.name : typeof error,
  })
  return undefined
}
