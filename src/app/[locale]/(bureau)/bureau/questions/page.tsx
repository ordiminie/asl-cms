import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberQuestionsDal,
  getMemberQuestionsForBureauDal,
} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  MemberQuestionList,
  MemberQuestionListSkeleton,
} from '@/components/features/member-question/member-question-list'

type QuestionsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: QuestionsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberQuestionsPage',
  })

  return {title: t('metadata.title')}
}

/**
 * « Questions des membres » (s23, ecran C1). Le controle d'acces est repete
 * ici : une navigation cliente ne rejoue pas le layout. La file n'est lue
 * qu'apres ce controle.
 */
export default async function BureauMemberQuestionsPage({
  params,
  searchParams,
}: QuestionsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<MemberQuestionListSkeleton />}>
      <QuestionsListSection page={current} />
    </Suspense>
  )
}

async function QuestionsListSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberQuestionsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getMemberQuestionsForBureauDal(tenant.id, page)

  return <MemberQuestionList list={list} />
}
