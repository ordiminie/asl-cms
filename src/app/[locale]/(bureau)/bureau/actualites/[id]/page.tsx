import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentNewsDal,
  getNewsItemForBureauDal,
} from '@/app/dal/news-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {NewsEditor} from '@/components/features/news/news-editor'
import {Skeleton} from '@/components/ui/skeleton'

import {
  publishNewsAction,
  saveNewsDraftAction,
  unpublishNewsAction,
  uploadNewsImageAction,
} from './actions'

type EditorParams = {params: Promise<{locale: string; id: string}>}

export async function generateMetadata({
  params,
}: EditorParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauNewsPage'})

  return {title: t('editor.metadataTitle')}
}

/**
 * Editeur d'une actualite (ecran 2 du design s05). La lecture n'est pas
 * cachee : un brouillon change a chaque enregistrement, et l'editeur doit
 * repartir du dernier etat.
 */
export default async function BureauNewsEditorPage({params}: EditorParams) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorSection newsId={id} />
    </Suspense>
  )
}

async function EditorSection({newsId}: {newsId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentNewsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const item = await getNewsItemForBureauDal(tenant.id, newsId)
  if (!item) {
    notFound()
  }

  return (
    <NewsEditor
      news={item}
      saveAction={saveNewsDraftAction}
      publishAction={publishNewsAction}
      unpublishAction={unpublishNewsAction}
      uploadAction={uploadNewsImageAction}
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
