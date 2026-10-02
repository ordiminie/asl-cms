import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberProfilesDal,
  getMemberProfilesPageForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  MemberProfileList,
  MemberProfileListSkeleton,
} from '@/components/features/member-profile/member-profile-list'

type MemberProfilesPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string; q?: string}>
}

export async function generateMetadata({
  params,
}: MemberProfilesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberProfilesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Liste des proprietaires (ecran 1 du design s12). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. La liste n'est
 * lue qu'apres ce controle.
 */
export default async function BureauMemberProfilesPage({
  params,
  searchParams,
}: MemberProfilesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page, q} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested
  const search = q?.trim() || undefined

  return (
    <Suspense
      key={`${current}:${search ?? ''}`}
      fallback={<MemberProfileListSkeleton />}
    >
      <MemberProfilesSection page={current} search={search} />
    </Suspense>
  )
}

async function MemberProfilesSection({
  page,
  search,
}: {
  page: number
  search?: string
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberProfilesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getMemberProfilesPageForBureauDal(tenant.id, page, search)

  return <MemberProfileList list={list} search={search} />
}
