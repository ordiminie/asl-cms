'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useActionState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import type {ConfirmUnsubscribeActionResult} from '@/services/types/domain/campaign-types'

export type UnsubscribeScreenState =
  'confirm' | 'unsubscribed' | 'already' | 'invalid' | 'error'

type UnsubscribePanelProps = {
  token: string
  associationName: string
  contactEmail: string | null
  /** L'etat lu au rendu, **sans ecriture** (`GET`). */
  initialState: UnsubscribeScreenState
  confirmAction: (
    state: ConfirmUnsubscribeActionResult | undefined,
    formData: FormData
  ) => Promise<ConfirmUnsubscribeActionResult>
}

const screenStateOf = (
  initial: UnsubscribeScreenState,
  result: ConfirmUnsubscribeActionResult | undefined
): UnsubscribeScreenState => result?.status ?? initial

/**
 * La page publique de desinscription (ecran 6 du design s25). Le rendu ne
 * fait que **montrer** ; seul le bouton « Me desinscrire » ecrit, par une
 * Server Action (ADR 051 : les liens sont precharges). Texte 18 px, un seul
 * `h1`, aucune phrase sur ce que le membre continuera de recevoir.
 */
export function UnsubscribePanel({
  token,
  associationName,
  contactEmail,
  initialState,
  confirmAction,
}: UnsubscribePanelProps) {
  const t = useTranslations('UnsubscribePage')
  const [result, formAction, pending] = useActionState(confirmAction, undefined)
  const state = screenStateOf(initialState, result)

  return (
    <div className="flex flex-col gap-6 text-[18px] leading-[1.6]">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {state === 'invalid'
          ? t('invalidTitle')
          : t('title', {name: associationName})}
      </h1>

      {state === 'error' && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle className="text-[18px] whitespace-normal">
            {t('failedTitle')}
          </AlertTitle>
          <AlertDescription className="text-[17px]">
            {t('failedDescription')}
          </AlertDescription>
        </Alert>
      )}

      {(state === 'confirm' || state === 'error') && (
        <>
          <p>{t('ask')}</p>
          <form
            action={formAction}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="token" value={token} />
            <Button
              type="submit"
              disabled={pending}
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              {t('confirm')}
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              <Link href="/">{t('keep')}</Link>
            </Button>
          </form>
        </>
      )}

      {state === 'unsubscribed' && (
        <p role="status">{t('done', {name: associationName})}</p>
      )}
      {state === 'already' && <p role="status">{t('already')}</p>}
      {state === 'invalid' && (
        <div className="flex flex-col gap-2">
          <p>{t('invalid')}</p>
          <p>
            {contactEmail
              ? t('invalidContact', {email: contactEmail})
              : t('invalidNoContact')}
          </p>
        </div>
      )}

      {(state === 'unsubscribed' || state === 'already') && (
        <Button
          asChild
          variant="outline"
          className="h-14 w-full self-start sm:h-12 sm:w-auto"
        >
          <Link href="/">{t('siteLink')}</Link>
        </Button>
      )}
    </div>
  )
}
