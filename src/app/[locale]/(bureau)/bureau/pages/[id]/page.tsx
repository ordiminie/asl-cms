import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentPagesDal, getPageForBureauDal} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {PageEditor} from '@/components/features/pages/page-editor'
import {Skeleton} from '@/components/ui/skeleton'

import {
  publishPageAction,
  savePageDraftAction,
  unpublishPageAction,
  uploadPageBlockFileAction,
} from './actions'

type EditorParams = {params: Promise<{locale: string; id: string}>}

export async function generateMetadata({
  params,
}: EditorParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauPagesPage'})

  return {title: t('editor.metadataTitle')}
}

/**
 * Editeur d'une page (ecran 2 du design s04). La lecture passe par le service
 * plutot que par une fonction cachee : un brouillon change a chaque
 * enregistrement, et l'editeur doit repartir du dernier etat.
 */
export default async function BureauPageEditorPage({params}: EditorParams) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorSection pageId={id} />
    </Suspense>
  )
}

async function EditorSection({pageId}: {pageId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentPagesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const page = await getPageForBureauDal(tenant.id, pageId)
  if (!page) {
    notFound()
  }

  return (
    <PageEditor
      page={page}
      saveAction={savePageDraftAction}
      publishAction={publishPageAction}
      unpublishAction={unpublishPageAction}
      uploadAction={uploadPageBlockFileAction}
    />
  )
}

function EditorSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
