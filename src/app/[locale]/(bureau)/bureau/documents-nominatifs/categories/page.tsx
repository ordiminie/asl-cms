import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoriesForBureauDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {ReportCategoriesManager} from '@/components/features/incident-report/report-categories-manager'
import {MEMBER_DOCUMENTS_PATH} from '@/components/features/member-documents/member-document-paths'
import {Skeleton} from '@/components/ui/skeleton'

import {
  createMemberDocumentCategoryAction,
  deleteMemberDocumentCategoryAction,
  updateMemberDocumentCategoryAction,
} from './actions'

type MemberDocumentCategoriesPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: MemberDocumentCategoriesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberDocumentCategoriesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Categories des documents nominatifs (s32, ADR 073 §9) : l'ecran generique
 * des categories, parametre pour le domaine `member_document`, **sans adresse
 * de routage** — un document n'envoie rien. Le controle d'acces est repete
 * ici.
 */
export default async function BureauMemberDocumentCategoriesPage({
  params,
}: MemberDocumentCategoriesPageProps) {
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
    canManageCurrentMemberDocumentsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getMemberDocumentCategoriesForBureauDal(tenant.id)

  return (
    <ReportCategoriesManager
      list={list}
      labels="BureauMemberDocumentCategoriesPage"
      backHref={MEMBER_DOCUMENTS_PATH}
      showUsageCount
      showRoutingEmail={false}
      createAction={createMemberDocumentCategoryAction}
      updateAction={updateMemberDocumentCategoryAction}
      deleteAction={deleteMemberDocumentCategoryAction}
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
