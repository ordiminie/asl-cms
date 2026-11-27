import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canImportCurrentMemberContactsDal} from '@/app/dal/member-annual-import-dal'
import {
  canManageCurrentMemberProfilesDal,
  getMemberProfilesPageForBureauDal,
} from '@/app/dal/member-profile-dal'
import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupsForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  MemberProfileList,
  MemberProfileListSkeleton,
} from '@/components/features/member-profile/member-profile-list'
import {groupIdOfParam} from '@/components/features/member-profile/member-profile-paths'

import {
  addToRecipientGroupAction,
  removeFromRecipientGroupAction,
} from './actions'

type MemberProfilesPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string; q?: string; groupe?: string}>
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
  const {page, q, groupe} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested
  const search = q?.trim() || undefined
  const groupId = groupIdOfParam(groupe)

  return (
    <Suspense
      key={`${current}:${search ?? ''}:${groupId ?? ''}`}
      fallback={<MemberProfileListSkeleton />}
    >
      <MemberProfilesSection page={current} search={search} groupId={groupId} />
    </Suspense>
  )
}

/**
 * La liste, puis — pour qui compose les groupes de destinataires (s27) — le
 * filtre « Groupe » et la selection des fiches. Sans ce droit, `?groupe=` est
 * ignore.
 */
async function MemberProfilesSection({
  page,
  search,
  groupId,
}: {
  page: number
  search?: string
  groupId?: string
}) {
  const [tenant, allowed, managesGroups, importsContacts] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberProfilesDal(),
    canManageCurrentRecipientGroupsDal(),
    canImportCurrentMemberContactsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const filter = managesGroups ? groupId : undefined
  const [list, groups] = await Promise.all([
    getMemberProfilesPageForBureauDal(tenant.id, page, search, filter),
    managesGroups ? getRecipientGroupsForBureauDal(tenant.id) : undefined,
  ])

  return (
    <MemberProfileList
      list={list}
      search={search}
      canImportContacts={importsContacts}
      groupSelection={
        groups && {
          groups,
          groupId: filter,
          addAction: addToRecipientGroupAction,
          removeAction: removeFromRecipientGroupAction,
        }
      }
    />
  )
}
