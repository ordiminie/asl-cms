import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
  getMemberDocumentsForBureauDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberDocumentNoticeParamConst} from '@/components/features/member-documents/member-document-paths'
import {MemberDocumentsOverview} from '@/components/features/member-documents/member-documents-overview'
import {Skeleton} from '@/components/ui/skeleton'

import {removeMemberDocumentAction} from './actions'

type MemberDocumentsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{
    q?: string
    categorie?: string
    page?: string
    statut?: string
  }>
}

type Filters = {search?: string; categoryId?: string; page: number}

/** La page lue dans `?page=` : un entier, au moins 1. */
const pageOf = (value?: string): number => {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

export async function generateMetadata({
  params,
}: MemberDocumentsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauMemberDocuments'})

  return {title: t('metadata.overviewTitle')}
}

/**
 * Documents nominatifs du bureau (design s32, ecran 4, critere 6). Le
 * controle d'acces est repete ici : une navigation cliente ne rejoue pas le
 * layout. Les filtres et la page viennent de l'URL ; le serveur pagine.
 */
export default async function BureauMemberDocumentsPage({
  params,
  searchParams,
}: MemberDocumentsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {q, categorie, page, statut} = await searchParams

  return (
    <Suspense fallback={<MemberDocumentsSkeleton />}>
      <MemberDocumentsSection
        filters={{
          search: q?.trim() || undefined,
          categoryId: categorie || undefined,
          page: pageOf(page),
        }}
        removed={statut === MemberDocumentNoticeParamConst.REMOVED}
      />
    </Suspense>
  )
}

async function MemberDocumentsSection({
  filters,
  removed,
}: {
  filters: Filters
  removed: boolean
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberDocumentsDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [list, categories] = await Promise.all([
    getMemberDocumentsForBureauDal(tenant.id, filters),
    getMemberDocumentCategoryChoicesDal(tenant.id),
  ])

  return (
    <MemberDocumentsOverview
      list={list}
      categories={categories}
      search={filters.search}
      categoryId={filters.categoryId}
      notice={removed ? {kind: 'removed'} : undefined}
      removeAction={removeMemberDocumentAction}
    />
  )
}

/** Le squelette ne couvre que les lignes du tableau. */
function MemberDocumentsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
