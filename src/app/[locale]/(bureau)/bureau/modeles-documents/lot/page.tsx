import {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {type ReactNode, Suspense} from 'react'

import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentLotGroupsForBureauDal,
  getDocumentTemplatesForBureauDal,
} from '@/app/dal/document-template-dal'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {DocumentTemplateLot} from '@/components/features/document-templates/document-template-lot'
import {NoTemplateNotice} from '@/components/features/document-templates/template-document-generator'
import {NoCategoryNotice} from '@/components/features/member-documents/member-document-form'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {
  depositTemplateDocumentAction,
  getDocumentLotReachAction,
} from '../actions'

type DocumentLotPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{modele?: string}>
}

export async function generateMetadata({
  params,
}: DocumentLotPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'DocumentTemplatesBureau',
  })

  return {title: t('metadata.lotTitle')}
}

/**
 * Generer en lot (ecran 4 de s36, critere 3). Un lot depose : il faut
 * l'action des modeles **et** `member.document.manage`, sinon la page est
 * refusee d'emblee (ADR 074 §6). `?modele=` preselectionne un modele du
 * tenant.
 */
export default async function DocumentLotPage({
  params,
  searchParams,
}: DocumentLotPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {modele} = await searchParams

  return (
    <Suspense fallback={<LotSkeleton />}>
      <DocumentLotSection preselected={modele} />
    </Suspense>
  )
}

async function DocumentLotSection({preselected}: {preselected?: string}) {
  const [tenant, canManageTemplates, canDeposit] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentDocumentTemplatesDal(),
    canManageCurrentMemberDocumentsDal(),
  ])
  if (!canManageTemplates || !canDeposit) {
    return <BureauAccessDenied />
  }

  const [templates, groups, categories] = await Promise.all([
    getDocumentTemplatesForBureauDal(tenant.id),
    getDocumentLotGroupsForBureauDal(tenant.id),
    getMemberDocumentCategoryChoicesDal(tenant.id),
  ])

  if (templates.length === 0 || categories.length === 0) {
    return (
      <LotUnavailable>
        {templates.length === 0 ? <NoTemplateNotice /> : <NoCategoryNotice />}
      </LotUnavailable>
    )
  }

  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris.
  const today = calendarDayOf(new Date())
  const preselectedTemplateId = templates.some(({id}) => id === preselected)
    ? preselected
    : undefined

  return (
    <DocumentTemplateLot
      templates={templates.map(({id, name}) => ({id, name}))}
      preselectedTemplateId={preselectedTemplateId}
      groups={groups}
      categories={categories}
      today={today}
      reachAction={getDocumentLotReachAction}
      depositAction={depositTemplateDocumentAction}
    />
  )
}

function LotUnavailable({children}: {children: ReactNode}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
      </h1>
      {children}
    </div>
  )
}

function LotSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
