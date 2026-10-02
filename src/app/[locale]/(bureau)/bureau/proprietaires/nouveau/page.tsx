import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentMemberProfilesDal} from '@/app/dal/member-profile-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberProfileForm} from '@/components/features/member-profile/member-profile-form'
import {
  type SaleReturn,
  saleReturnOf,
} from '@/components/features/member-profile/member-profile-paths'
import {Skeleton} from '@/components/ui/skeleton'

import {createMemberProfileAction} from '../actions'

type NewMemberProfilePageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{vendeur?: string; parcelle?: string; date?: string}>
}

export async function generateMetadata({
  params,
}: NewMemberProfilePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberProfilesPage',
  })

  return {title: t('form.metadataTitle')}
}

/**
 * Ajouter un proprietaire (ecran 2 du design s12). Ouvert depuis une vente
 * dont l'acquereur n'a pas encore de fiche, il y revient apres
 * l'enregistrement.
 */
export default async function BureauNewMemberProfilePage({
  params,
  searchParams,
}: NewMemberProfilePageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const saleReturn = saleReturnOf(await searchParams)

  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewMemberProfileSection saleReturn={saleReturn} />
    </Suspense>
  )
}

async function NewMemberProfileSection({
  saleReturn,
}: {
  saleReturn?: SaleReturn
}) {
  const allowed = await canManageCurrentMemberProfilesDal()
  if (!allowed) {
    return <BureauAccessDenied />
  }

  return (
    <MemberProfileForm
      saveAction={createMemberProfileAction}
      saleReturn={saleReturn}
    />
  )
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
