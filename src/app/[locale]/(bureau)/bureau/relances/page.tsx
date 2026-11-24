import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getUnpaidRemindersOverviewDal} from '@/app/dal/unpaid-reminder-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  UnpaidRemindersError,
  UnpaidRemindersOverview,
  UnpaidRemindersSkeleton,
} from '@/components/features/unpaid-reminder/unpaid-reminders-overview'
import {logger} from '@/lib/logger'

type UnpaidRemindersPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: UnpaidRemindersPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'UnpaidRemindersBureau'})

  return {title: t('metadata.title')}
}

/**
 * Le suivi des relances des impayes (s29, ecran 1). Le controle d'acces est
 * repete ici (une navigation cliente ne rejoue pas le layout) : celui des
 * campagnes, le bureau (ADR 070 §10). Donnee vivante, streamee, sans cache.
 */
export default async function BureauUnpaidRemindersPage({
  params,
  searchParams,
}: UnpaidRemindersPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<UnpaidRemindersSkeleton />}>
      <UnpaidRemindersSection page={current} />
    </Suspense>
  )
}

async function UnpaidRemindersSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const overview = await getUnpaidRemindersOverviewDal(tenant.id, page).catch(
    (error: unknown) => logOverviewReadFailure(tenant.id, error)
  )

  return overview ? (
    <UnpaidRemindersOverview overview={overview} />
  ) : (
    <UnpaidRemindersError />
  )
}

/**
 * La lecture en echec reste visible dans les journaux du serveur : l'erreur
 * et l'association, ni nom ni facture. L'ecran affiche l'erreur.
 */
function logOverviewReadFailure(organizationId: string, error: unknown) {
  logger.error('[UNPAID-REMINDER] lecture du suivi en echec', {
    organizationId,
    errorName: error instanceof Error ? error.name : typeof error,
  })
  return undefined
}
