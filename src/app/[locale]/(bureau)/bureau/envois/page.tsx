import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentCampaignsDal} from '@/app/dal/campaign-dal'
import {getEmailSendingOverviewDal} from '@/app/dal/email-sending-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  EmailSendingError,
  EmailSendingOverview,
  EmailSendingSkeleton,
} from '@/components/features/email-sending/email-sending-overview'
import {logger} from '@/lib/logger'

type EmailSendingPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: EmailSendingPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'EmailSendingBureau'})

  return {title: t('metadata.title')}
}

/**
 * Les envois d'emails de l'association (s52, ecran 1) : budget du jour et
 * envois en attente. Le controle d'acces est repete ici (une navigation
 * cliente ne rejoue pas le layout) : celui des campagnes, le bureau. Donnee
 * vivante, streamee, sans cache.
 */
export default async function BureauEmailSendingPage({
  params,
  searchParams,
}: EmailSendingPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<EmailSendingSkeleton />}>
      <EmailSendingSection page={current} />
    </Suspense>
  )
}

async function EmailSendingSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentCampaignsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const overview = await getEmailSendingOverviewDal(tenant.id).catch(
    (error: unknown) => logOverviewReadFailure(tenant.id, error)
  )

  return overview ? (
    <EmailSendingOverview overview={overview} page={page} />
  ) : (
    <EmailSendingError />
  )
}

/**
 * La lecture en echec reste visible dans les journaux du serveur : l'erreur
 * et l'association, ni adresse ni contenu. L'ecran affiche l'erreur.
 */
function logOverviewReadFailure(organizationId: string, error: unknown) {
  logger.error('[EMAIL-SENDING] lecture des envois en echec', {
    organizationId,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  })
  return undefined
}
