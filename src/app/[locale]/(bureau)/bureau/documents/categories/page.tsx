import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentSharedDocumentsDal,
  getDocumentCategoriesForBureauDal,
} from '@/app/dal/shared-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {ReportCategoriesManager} from '@/components/features/incident-report/report-categories-manager'
import {SHARED_DOCUMENTS_PATH} from '@/components/features/shared-document/shared-document-paths'
import {Skeleton} from '@/components/ui/skeleton'

import {
  createDocumentCategoryAction,
  deleteDocumentCategoryAction,
  updateDocumentCategoryAction,
} from './actions'

type DocumentCategoriesPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: DocumentCategoriesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauDocumentCategoriesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Categories des documents partages (s31) : l'ecran des categories de
 * signalement, parametre pour le domaine `document`, **sans adresse de
 * routage** — un document n'envoie rien (design s31, manque 1). Le controle
 * d'acces est repete ici.
 */
export default async function BureauDocumentCategoriesPage({
  params,
}: DocumentCategoriesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesSection />
    </Suspense>
  )
}

async function CategoriesSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentSharedDocumentsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getDocumentCategoriesForBureauDal(tenant.id)

  return (
    <ReportCategoriesManager
      list={list}
      labels="BureauDocumentCategoriesPage"
      backHref={SHARED_DOCUMENTS_PATH}
      showUsageCount
      showRoutingEmail={false}
      createAction={createDocumentCategoryAction}
      updateAction={updateDocumentCategoryAction}
      deleteAction={deleteDocumentCategoryAction}
    />
  )
}

function CategoriesSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
