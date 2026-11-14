import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import type {MemberQuestionDTO} from '@/services/types/domain/member-question-types'

import {CategoryName, NotificationFailedBadge} from './member-question-list'
import {MEMBER_QUESTIONS_PATH} from './member-question-paths'

/**
 * Detail d'une question (s23, ecran C2) : l'identite du membre (lien vers sa
 * fiche, `mailto:`), le sujet, la date, puis le texte entier. Pas de reponse
 * dans l'outil ni de statut : le bureau repond par email.
 */
export function MemberQuestionDetail({
  question,
}: {
  question: MemberQuestionDTO
}) {
  const t = useTranslations('BureauMemberQuestionsPage.detail')
  const tList = useTranslations('BureauMemberQuestionsPage')
  const locale = useLocale()
  const receivedAt = receivedAtPartsOf(question.createdAt, locale)

  return (
    <article className="flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Link
        href={MEMBER_QUESTIONS_PATH}
        className="text-link self-start text-base underline underline-offset-4"
      >
        {t('back')}
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold break-words">
          {t('title', {name: question.memberName})}
        </h1>
        {question.notificationFailed && <NotificationFailedBadge />}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-y py-4 text-[17px] sm:grid-cols-[auto_1fr]">
        <Definition label={t('labels.member')}>
          <span className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-2">
            <Link
              href={memberProfilePathOf(question.memberId)}
              className="text-link font-semibold underline underline-offset-4"
            >
              {question.memberName}
            </Link>
            {question.memberEmail ? (
              <a
                href={`mailto:${question.memberEmail}`}
                className="text-link break-all underline underline-offset-4"
              >
                {question.memberEmail}
              </a>
            ) : (
              <span className="text-muted-foreground">{tList('noEmail')}</span>
            )}
          </span>
        </Definition>
        <Definition label={t('labels.category')}>
          <CategoryName item={question} />
        </Definition>
        <Definition label={t('labels.receivedAt')}>
          <span className="font-mono tabular-nums">
            {t('receivedAt', receivedAt)}
          </span>
        </Definition>
      </dl>

      <Card className="gap-3 px-4 py-6 shadow-none sm:px-6">
        <h2 className="font-serif text-xl font-semibold">
          {t('labels.question')}
        </h2>
        <p
          data-testid="member-question-body"
          className="text-[17px] leading-relaxed break-words whitespace-pre-line"
        >
          {question.body}
        </p>
      </Card>

      {question.memberEmail && (
        <Button
          asChild
          className="h-14 w-full text-base sm:h-12 sm:w-auto sm:self-start"
        >
          <a href={`mailto:${question.memberEmail}`}>{t('reply')}</a>
        </Button>
      )}
    </article>
  )
}

function Definition({label, children}: {label: string; children: ReactNode}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mb-2 sm:mb-0">{children}</dd>
    </>
  )
}
