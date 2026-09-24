import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentBoardMembersDal,
  getBoardMembersForBureauDal,
} from '@/app/dal/board-member-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {BoardMemberList} from '@/components/features/board/board-member-list'
import {Skeleton} from '@/components/ui/skeleton'
import {ASSOCIATION_MEMBER_COUNT_SETTING_KEY} from '@/services/types/domain/association-settings-types'

import {removeBoardMemberAction, reorderBoardMembersAction} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauBoardPage'})

  return {title: t('metadata.title')}
}

/**
 * Ecran « Membres du bureau » (design s06, ecran 1). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. Les fiches ne
 * sont lues qu'apres ce controle.
 */
export default async function BureauBoardPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<BoardMembersSkeleton />}>
      <BoardMembersSection />
    </Suspense>
  )
}

async function BoardMembersSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentBoardMembersDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [members, settings] = await Promise.all([
    getBoardMembersForBureauDal(tenant.id),
    getAssociationSettingsDal(tenant.id),
  ])

  const memberCount = settings[ASSOCIATION_MEMBER_COUNT_SETTING_KEY]?.value

  return (
    <BoardMemberList
      members={members}
      memberCount={typeof memberCount === 'number' ? memberCount : null}
      reorderAction={reorderBoardMembersAction}
      removeAction={removeBoardMemberAction}
    />
  )
}

function BoardMembersSkeleton() {
  return (
    <div className="flex w-full max-w-190 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
