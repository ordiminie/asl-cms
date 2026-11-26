import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentTemplatesForBureauDal,
} from '@/app/dal/document-template-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  DocumentTemplateList,
  DocumentTemplateListError,
  DocumentTemplateListSkeleton,
} from '@/components/features/document-templates/document-template-list'
import {DOCUMENT_TEMPLATE_NOTICE_FLAG} from '@/components/features/document-templates/document-template-paths'
import {logger} from '@/lib/logger'
import type {DocumentTemplateListItemDTO} from '@/services/types/domain/document-template-types'

type DocumentTemplatesPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{supprime?: string}>
}

export async function generateMetadata({
  params,
}: DocumentTemplatesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'DocumentTemplatesBureau',
  })

  return {title: t('metadata.title')}
}

/**
 * Les modeles de documents (ecran 1 de s36). Le controle d'acces est repete
 * ici : une navigation cliente ne rejoue pas le layout. La liste n'est lue
 * qu'apres lui.
 */
export default async function DocumentTemplatesPage({
  params,
  searchParams,
}: DocumentTemplatesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {supprime} = await searchParams

  return (
    <Suspense fallback={<DocumentTemplateListSkeleton />}>
      <DocumentTemplatesSection
        deleted={supprime === DOCUMENT_TEMPLATE_NOTICE_FLAG}
      />
    </Suspense>
  )
}

const readTemplates = async (
  organizationId: string
): Promise<DocumentTemplateListItemDTO[] | undefined> => {
  try {
    return await getDocumentTemplatesForBureauDal(organizationId)
  } catch (error) {
    logger.error('[DOCUMENT-TEMPLATE] Liste des modèles illisible', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return undefined
  }
}

async function DocumentTemplatesSection({deleted}: {deleted: boolean}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentDocumentTemplatesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const templates = await readTemplates(tenant.id)
  if (!templates) return <DocumentTemplateListError />

  return <DocumentTemplateList templates={templates} deleted={deleted} />
}
