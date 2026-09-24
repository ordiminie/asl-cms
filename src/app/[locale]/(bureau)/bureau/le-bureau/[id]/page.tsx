import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentBoardMembersDal,
  getBoardMembersForBureauDal,
} from '@/app/dal/board-member-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {BoardMemberForm} from '@/components/features/board/board-member-form'
import {Skeleton} from '@/components/ui/skeleton'

import {updateBoardMemberAction} from '../actions'

type EditorParams = {params: Promise<{locale: string; id: string}>}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({
  params,
}: EditorParams): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauBoardPage'})

  return {title: t('metadata.title')}
}

/**
 * Modification d'une fiche du bureau (design s06, ecran 2). La liste du bureau
 * n'est pas cachee : l'ecran repart du dernier etat enregistre.
 */
export default async function BureauEditBoardMemberPage({
  params,
}: EditorParams) {
  const {locale, id} = await params
  setRequestLocale(locale)

  // Un identifiant qui n'est pas un UUID n'est pas une fiche : 404 tout de
  // suite, sans interroger la base ni reveler ce qu'on y cherchait.
  if (!UUID_PATTERN.test(id)) {
    notFound()
  }

  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditBoardMemberSection memberId={id} />
    </Suspense>
  )
}

async function EditBoardMemberSection({memberId}: {memberId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentBoardMembersDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const members = await getBoardMembersForBureauDal(tenant.id)
  const member = members.find((candidate) => candidate.id === memberId)
  if (!member) {
    notFound()
  }

  return (
    <BoardMemberForm member={member} saveAction={updateBoardMemberAction} />
  )
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
