import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getPagesForBureauDal} from '@/app/dal/page-dal'
import {
  canManageCurrentSiteNavigationDal,
  getSiteNavigationForBureauDal,
} from '@/app/dal/site-navigation-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {SiteNavigationManager} from '@/components/features/navigation/site-navigation-manager'
import {Skeleton} from '@/components/ui/skeleton'

import {
  addMenuItemAction,
  removeMenuItemAction,
  reorderMenuItemsAction,
  saveSiteFooterAction,
  setMenuItemVisibilityAction,
} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauNavigationPage'})

  return {title: t('metadata.title')}
}

/**
 * Ecran « Navigation du site » (design s04b, ecran 1). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. Le menu et le
 * pied de page ne sont lus qu'apres ce controle.
 */
export default async function BureauNavigationPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<SiteNavigationSkeleton />}>
      <SiteNavigationSection />
    </Suspense>
  )
}

async function SiteNavigationSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentSiteNavigationDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [navigation, pages] = await Promise.all([
    getSiteNavigationForBureauDal(tenant.id),
    getPagesForBureauDal(tenant.id),
  ])

  return (
    <SiteNavigationManager
      menu={navigation.menu}
      pages={pages}
      footerContent={navigation.footerContent}
      addAction={addMenuItemAction}
      removeAction={removeMenuItemAction}
      reorderAction={reorderMenuItemsAction}
      setVisibilityAction={setMenuItemVisibilityAction}
      saveFooterAction={saveSiteFooterAction}
    />
  )
}

function SiteNavigationSkeleton() {
  return (
    <div className="flex w-full max-w-190 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
