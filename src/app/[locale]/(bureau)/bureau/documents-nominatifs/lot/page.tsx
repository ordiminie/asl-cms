import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentBatchReachDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberDocumentBatch} from '@/components/features/member-documents/member-document-batch'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {depositMemberDocumentBatchLineAction} from '../actions'

type MemberDocumentBatchPageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({
  params,
}: MemberDocumentBatchPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauMemberDocuments'})

  return {title: t('metadata.batchTitle')}
}

/**
 * Depot en lot (design s32, ecran 5, critere 7). Le controle d'acces est
 * repete ici ; chaque fichier repasse par l'action, qui le reverifie.
 */
export default async function MemberDocumentBatchPage({
  params,
}: MemberDocumentBatchPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<BatchSkeleton />}>
      <BatchSection />
    </Suspense>
  )
}

async function BatchSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberDocumentsDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [categories, reach] = await Promise.all([
    getMemberDocumentCategoryChoicesDal(tenant.id),
    getMemberDocumentBatchReachDal(tenant.id),
  ])
  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <MemberDocumentBatch
      categories={categories}
      today={today}
      reach={reach}
      batchAction={depositMemberDocumentBatchLineAction}
    />
  )
}

function BatchSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
