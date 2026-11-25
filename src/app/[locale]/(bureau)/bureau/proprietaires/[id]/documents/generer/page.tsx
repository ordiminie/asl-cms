import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentTemplatesForBureauDal,
  getTemplateDocumentRecipientForBureauDal,
} from '@/app/dal/document-template-dal'
import {
  canManageCurrentMemberDocumentsDal,
  getMemberDocumentCategoryChoicesDal,
} from '@/app/dal/member-document-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {TemplateDocumentGenerator} from '@/components/features/document-templates/template-document-generator'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {depositTemplateDocumentAction} from '../../../../modeles-documents/actions'

type GenerateMemberDocumentPageProps = {
  params: Promise<{locale: string; id: string}>
}

export async function generateMetadata({
  params,
}: GenerateMemberDocumentPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'DocumentTemplatesBureau',
  })

  return {title: t('metadata.generateTitle')}
}

/**
 * Generer un document pour une fiche depuis un modele (s36, ecran 3). Le
 * controle d'acces est repete ici ; introuvable pour une fiche d'une autre
 * association. Le depot n'est propose qu'avec `member.document.manage`.
 */
export default async function GenerateMemberDocumentPage({
  params,
}: GenerateMemberDocumentPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<GeneratorSkeleton />}>
      <GenerateDocumentSection memberProfileId={id} />
    </Suspense>
  )
}

async function GenerateDocumentSection({
  memberProfileId,
}: {
  memberProfileId: string
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentDocumentTemplatesDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const profile = await getMemberProfileForBureauDal(tenant.id, memberProfileId)
  if (!profile) {
    notFound()
  }

  const [parcels, templates, recipient, canDeposit] = await Promise.all([
    getMemberParcelsForBureauDal(tenant.id, memberProfileId),
    getDocumentTemplatesForBureauDal(tenant.id),
    getTemplateDocumentRecipientForBureauDal(tenant.id, memberProfileId),
    canManageCurrentMemberDocumentsDal(),
  ])
  const categories = canDeposit
    ? await getMemberDocumentCategoryChoicesDal(tenant.id)
    : null
  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <TemplateDocumentGenerator
      memberProfile={{id: profile.id, name: profile.name}}
      parcelNumbers={parcels.current.map((parcel) => parcel.number)}
      addressLines={recipient?.addressLines ?? [profile.name]}
      templates={templates.map(({id, name}) => ({id, name}))}
      categories={categories}
      today={today}
      depositAction={depositTemplateDocumentAction}
    />
  )
}

function GeneratorSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
