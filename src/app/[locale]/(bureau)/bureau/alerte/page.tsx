import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentSiteAlertDal,
  getSiteAlertForBureauDal,
} from '@/app/dal/site-alert-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {SiteAlertForm} from '@/components/features/association/site-alert-form'
import {Skeleton} from '@/components/ui/skeleton'

import {removeSiteAlertAction, saveSiteAlertAction} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauAlertPage'})

  return {title: t('metadata.title')}
}

/**
 * Ecran « Bandeau d'alerte » (design s07, ecran 1). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. Le bandeau
 * n'est lu qu'apres ce controle.
 */
export default async function BureauAlertPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<SiteAlertSkeleton />}>
      <SiteAlertSection />
    </Suspense>
  )
}

async function SiteAlertSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentSiteAlertDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const alert = await getSiteAlertForBureauDal(tenant.id)

  return (
    <SiteAlertForm
      initialAlert={alert}
      saveAction={saveSiteAlertAction}
      removeAction={removeSiteAlertAction}
    />
  )
}

function SiteAlertSkeleton() {
  return (
    <div className="flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
