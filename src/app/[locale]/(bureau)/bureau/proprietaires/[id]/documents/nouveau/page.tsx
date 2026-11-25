import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

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
import {MemberDocumentForm} from '@/components/features/member-documents/member-document-form'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {depositMemberDocumentAction} from '../../../../documents-nominatifs/actions'

type NewMemberDocumentPageProps = {
  params: Promise<{locale: string; id: string}>
}

export async function generateMetadata({
  params,
}: NewMemberDocumentPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauMemberDocuments'})

  return {title: t('metadata.newTitle')}
}

/**
 * Deposer un document nominatif pour une fiche (s32, ecran 3). La lecture
 * n'est pas cachee ; le controle d'acces est repete ici. Introuvable pour une
 * fiche d'une autre association.
 */
export default async function NewMemberDocumentPage({
  params,
}: NewMemberDocumentPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<DocumentFormSkeleton />}>
      <NewDocumentSection memberProfileId={id} />
    </Suspense>
  )
}

async function NewDocumentSection({
  memberProfileId,
}: {
  memberProfileId: string
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberDocumentsDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const profile = await getMemberProfileForBureauDal(tenant.id, memberProfileId)
  if (!profile) {
    notFound()
  }

  const [parcels, categories] = await Promise.all([
    getMemberParcelsForBureauDal(tenant.id, memberProfileId),
    getMemberDocumentCategoryChoicesDal(tenant.id),
  ])
  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <MemberDocumentForm
      memberProfile={{id: profile.id, name: profile.name}}
      parcelNumbers={parcels.current.map((parcel) => parcel.number)}
      categories={categories}
      today={today}
      saveAction={depositMemberDocumentAction}
    />
  )
}

function DocumentFormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
