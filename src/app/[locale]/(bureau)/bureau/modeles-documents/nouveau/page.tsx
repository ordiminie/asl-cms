import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentDocumentTemplatesDal} from '@/app/dal/document-template-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {DocumentTemplateForm} from '@/components/features/document-templates/document-template-form'
import {Skeleton} from '@/components/ui/skeleton'

import {createDocumentTemplateAction} from '../actions'

type NewDocumentTemplatePageProps = {
  params: Promise<{locale: string}>
}

export async function generateMetadata({
  params,
}: NewDocumentTemplatePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'DocumentTemplatesBureau',
  })

  return {title: t('metadata.newTitle')}
}

/** Un nouveau modele de document (ecran 2 de s36, critere 1). */
export default async function NewDocumentTemplatePage({
  params,
}: NewDocumentTemplatePageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<Skeleton className="m-8 h-10 w-72" />}>
      <NewDocumentTemplateSection />
    </Suspense>
  )
}

async function NewDocumentTemplateSection() {
  const allowed = await canManageCurrentDocumentTemplatesDal()
  if (!allowed) {
    return <BureauAccessDenied />
  }

  return <DocumentTemplateForm saveAction={createDocumentTemplateAction} />
}
