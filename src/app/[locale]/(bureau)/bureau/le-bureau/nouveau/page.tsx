import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canManageCurrentBoardMembersDal} from '@/app/dal/board-member-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {BoardMemberForm} from '@/components/features/board/board-member-form'
import {Skeleton} from '@/components/ui/skeleton'

import {createBoardMemberAction} from '../actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauBoardPage'})

  return {title: t('form.newTitle')}
}

/** Creation d'une fiche du bureau (design s06, ecran 2, etat « fiche neuve »). */
export default async function BureauNewBoardMemberPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewBoardMemberSection />
    </Suspense>
  )
}

async function NewBoardMemberSection() {
  const allowed = await canManageCurrentBoardMembersDal()
  if (!allowed) {
    return <BureauAccessDenied />
  }

  return <BoardMemberForm saveAction={createBoardMemberAction} />
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
