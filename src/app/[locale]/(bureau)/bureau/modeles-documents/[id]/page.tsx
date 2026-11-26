import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentTemplateForBureauDal,
} from '@/app/dal/document-template-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {DocumentTemplateForm} from '@/components/features/document-templates/document-template-form'
import {DOCUMENT_TEMPLATE_NOTICE_FLAG} from '@/components/features/document-templates/document-template-paths'
import {Skeleton} from '@/components/ui/skeleton'

import {
  deleteDocumentTemplateAction,
  updateDocumentTemplateAction,
} from '../actions'

type DocumentTemplatePageProps = {
  params: Promise<{locale: string; id: string}>
  searchParams: Promise<{enregistre?: string}>
}

export async function generateMetadata({
  params,
}: DocumentTemplatePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'DocumentTemplatesBureau',
  })

  return {title: t('metadata.title')}
}

/**
 * Un modele de document (ecran 2 de s36). Le controle d'acces est repete ici ;
 * un modele inconnu, malforme ou d'une autre association rend une 404 (la RLS
 * ne le rend pas, critere 5).
 */
export default async function DocumentTemplatePage({
  params,
  searchParams,
}: DocumentTemplatePageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)
  const {enregistre} = await searchParams

  return (
    <Suspense key={id} fallback={<Skeleton className="m-8 h-10 w-72" />}>
      <DocumentTemplateSection
        id={id}
        saved={enregistre === DOCUMENT_TEMPLATE_NOTICE_FLAG}
      />
    </Suspense>
  )
}

async function DocumentTemplateSection({
  id,
  saved,
}: {
  id: string
  saved: boolean
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentDocumentTemplatesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const template = await getDocumentTemplateForBureauDal(tenant.id, id)
  if (!template) notFound()

  return (
    <DocumentTemplateForm
      template={template}
      saved={saved}
      saveAction={updateDocumentTemplateAction}
      deleteAction={deleteDocumentTemplateAction}
    />
  )
}
