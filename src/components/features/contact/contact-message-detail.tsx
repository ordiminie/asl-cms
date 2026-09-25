'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {type ReactNode, useState, useTransition} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  type ContactMessageDTO,
  receivedAtPartsOf,
} from '@/services/types/domain/contact-message-types'

import {useReadOnOpenSettled} from './mark-read-on-open'

/** Resultat de la bascule lu / non lu, rendu par les Server Actions. */
export type ContactMessageReadActionResult =
  {status: 'saved'} | {status: 'error'; message: string}

type Feedback = 'none' | 'unread' | {error: string}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

/**
 * Detail d'un message recu (ecran 3 du design s08) : page dediee, colonne de
 * lecture, message entier avec ses retours a la ligne. Une seule action,
 * « Marquer comme non lu » — ni suppression ni archivage. Un echec de
 * notification est signale au-dessus de l'expediteur, sous sa forme complete
 * (§3.2).
 */
export function ContactMessageDetail({
  message,
  markUnreadAction,
}: {
  message: ContactMessageDTO
  markUnreadAction: (id: string) => Promise<ContactMessageReadActionResult>
}) {
  const t = useTranslations('BureauContactMessagesPage.detail')
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>('none')
  const receivedAt = receivedAtPartsOf(message.createdAt, locale)
  const readOnOpenSettled = useReadOnOpenSettled()

  const markUnread = () => {
    startTransition(async () => {
      await readOnOpenSettled.current
      const result = await markUnreadAction(message.id)
      setFeedback(
        result.status === 'saved' ? 'unread' : {error: result.message}
      )
    })
  }

  return (
    <article className="flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Link
        href="/bureau/messages"
        className="text-link self-start text-base underline underline-offset-4"
      >
        {t('back')}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-[34px] leading-tight font-semibold break-words">
          {message.subject}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          {t('receivedAt', receivedAt)}
        </p>
      </div>

      {message.notificationFailed && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground flex flex-col items-start gap-2 text-base">
            <p>{t.rich('notificationFailed', {strong})}</p>
            <Link
              href="/bureau/reglages"
              className="text-link underline underline-offset-4"
            >
              {t('openSettings')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1 border-y py-4">
        <p className="text-[17px] font-semibold">
          {t('from', {name: message.senderName ?? t('anonymous')})}
        </p>
        <a
          href={`mailto:${message.senderEmail}`}
          className="text-link self-start text-[17px] break-all underline underline-offset-4"
        >
          {message.senderEmail}
        </a>
      </div>

      <p
        data-testid="contact-message-body"
        className="text-[17px] leading-relaxed break-words whitespace-pre-line"
      >
        {message.body}
      </p>

      {typeof feedback === 'object' && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {feedback.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || feedback === 'unread'}
          onClick={markUnread}
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          {t('markUnread')}
        </Button>
        <p className="text-muted-foreground text-[15px]" role="status">
          {feedback === 'unread' ? t('markedUnread') : t('markedReadOnOpen')}
        </p>
      </div>
    </article>
  )
}
