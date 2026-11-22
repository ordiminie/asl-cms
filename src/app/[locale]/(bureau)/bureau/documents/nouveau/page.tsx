import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentSharedDocumentsDal,
  getDocumentCategoryChoicesDal,
} from '@/app/dal/shared-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {SharedDocumentForm} from '@/components/features/shared-document/shared-document-form'
import {Skeleton} from '@/components/ui/skeleton'

import {publishSharedDocumentAction} from '../actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauSharedDocumentsPage',
  })

  return {title: t('form.metadataTitle')}
}

/** Depot d'un document partage (design s31, ecran 3). */
export default async function BureauNewSharedDocumentPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewSharedDocumentSection />
    </Suspense>
  )
}

async function NewSharedDocumentSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentSharedDocumentsDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const categories = await getDocumentCategoryChoicesDal(tenant.id)

  return (
    <SharedDocumentForm
      categories={categories}
      saveAction={publishSharedDocumentAction}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
