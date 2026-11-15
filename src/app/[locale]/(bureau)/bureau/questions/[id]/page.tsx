import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberQuestionsDal,
  getMemberQuestionForBureauDal,
} from '@/app/dal/member-question-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberQuestionDetail} from '@/components/features/member-question/member-question-detail'
import {Skeleton} from '@/components/ui/skeleton'

type QuestionPageProps = {params: Promise<{locale: string; id: string}>}

export async function generateMetadata({
  params,
}: QuestionPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberQuestionsPage.detail',
  })

  return {title: t('metadataTitle')}
}

/** Detail d'une question d'un membre (s23, ecran C2). Lecture sans cache. */
export default async function BureauMemberQuestionPage({
  params,
}: QuestionPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<QuestionSkeleton />}>
      <QuestionSection questionId={id} />
    </Suspense>
  )
}

async function QuestionSection({questionId}: {questionId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberQuestionsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const question = await getMemberQuestionForBureauDal(tenant.id, questionId)
  if (!question) {
    notFound()
  }

  return <MemberQuestionDetail question={question} />
}

function QuestionSkeleton() {
  return (
    <div className="flex w-full max-w-[68ch] flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
