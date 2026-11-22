import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentSharedDocumentsDal,
  getSharedDocumentsForBureauDal,
} from '@/app/dal/shared-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  SharedDocumentList,
  type SharedDocumentNotice,
} from '@/components/features/shared-document/shared-document-list'
import {SharedDocumentNoticeParamConst} from '@/components/features/shared-document/shared-document-paths'
import {Skeleton} from '@/components/ui/skeleton'

import {deleteSharedDocumentAction} from './actions'

type SharedDocumentsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{statut?: string; document?: string}>
}

/** `?statut=` pose par les Server Actions apres un succes -> alerte ancree. */
const noticeOf = (
  statut?: string,
  documentId?: string
): SharedDocumentNotice | undefined => {
  if (statut === SharedDocumentNoticeParamConst.PUBLISHED) {
    return {kind: 'published', documentId}
  }
  if (statut === SharedDocumentNoticeParamConst.DELETED) {
    return {kind: 'deleted'}
  }
  return undefined
}

export async function generateMetadata({
  params,
}: SharedDocumentsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauSharedDocumentsPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Documents partages du bureau (design s31, ecran 2). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout.
 */
export default async function BureauSharedDocumentsPage({
  params,
  searchParams,
}: SharedDocumentsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {statut, document} = await searchParams

  return (
    <Suspense fallback={<SharedDocumentListSkeleton />}>
      <SharedDocumentListSection notice={noticeOf(statut, document)} />
    </Suspense>
  )
}

async function SharedDocumentListSection({
  notice,
}: {
  notice?: SharedDocumentNotice
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentSharedDocumentsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const documents = await getSharedDocumentsForBureauDal(tenant.id)

  return (
    <SharedDocumentList
      documents={documents}
      notice={notice}
      deleteAction={deleteSharedDocumentAction}
    />
  )
}

/** Le squelette ne couvre que les lignes du tableau, jamais un formulaire. */
function SharedDocumentListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  )
}
