'use client'

import {AlertTriangle, CircleCheck, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useActionState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {MemberEmailConfirmationStateDTO} from '@/services/types/domain/member-email-types'

/** L'issue de l'action de confirmation, telle que la page la lit. */
export type ConfirmMemberEmailActionResult =
  | {status: 'confirmed'; replaced: boolean}
  | {status: 'invalid'}
  | {status: 'taken'}
  | {status: 'revoked'}
  | {status: 'error'}

type MemberEmailConfirmationPanelProps = {
  token: string
  associationName: string
  /** L'etat lu au rendu, **sans ecriture**. */
  initialState: MemberEmailConfirmationStateDTO
  confirmAction: (
    state: ConfirmMemberEmailActionResult | undefined,
    formData: FormData
  ) => Promise<ConfirmMemberEmailActionResult>
}

const CONTACT_PATH = '/contact'
const LOGIN_PATH = '/login'

/**
 * La page publique « Confirmer votre adresse » (s54, ecran 3), coquille de
 * la page de desinscription (s25). Le rendu ne fait que **montrer** ; seul le
 * bouton « Confirmer cette adresse » ecrit, par une Server Action : les
 * anti-virus de messagerie ouvrent les liens tout seuls (ADR 056 §5).
 */
export function MemberEmailConfirmationPanel({
  token,
  associationName,
  initialState,
  confirmAction,
}: MemberEmailConfirmationPanelProps) {
  const t = useTranslations('MemberEmailConfirmationPage')
  const [result, formAction, pending] = useActionState(confirmAction, undefined)
  const state = result?.status ?? initialState.status

  return (
    <div className="flex flex-col gap-6 text-[18px] leading-[1.6]">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
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

      {(state === 'confirm' || state === 'error') &&
        initialState.status === 'confirm' && (
          <>
            <p className="font-mono font-medium break-all">
              {initialState.email}
            </p>
            <p>
              {t('ask', {
                name: associationName,
                count: initialState.parcelNumbers.length,
                numbers: joinParcelNumbers(initialState.parcelNumbers),
              })}
            </p>
            <form action={formAction}>
              <input type="hidden" name="token" value={token} />
              <Button
                type="submit"
                disabled={pending}
                className="h-14 w-full sm:h-12 sm:w-auto"
              >
                {pending ? t('confirming') : t('confirm')}
              </Button>
            </form>
          </>
        )}

      {result?.status === 'confirmed' && (
        <>
          <Alert role="status" className="[&>svg]:size-5">
            <CircleCheck aria-hidden="true" className="text-primary" />
            <AlertDescription className="text-foreground text-[18px]">
              <p>
                <strong>{t('doneTitle')}</strong>{' '}
                {t(result.replaced ? 'doneReplaced' : 'done')}
              </p>
            </AlertDescription>
          </Alert>
          <Button asChild className="h-14 w-full self-start sm:h-12 sm:w-auto">
            <Link href={LOGIN_PATH}>{t('login')}</Link>
          </Button>
        </>
      )}

      {state === 'invalid' && (
        <ContactAlert title={t('invalidTitle')} detail={t('invalid')} />
      )}
      {state === 'taken' && (
        <ContactAlert title={t('takenTitle')} detail={t('taken')} />
      )}
      {state === 'revoked' && (
        <ContactAlert title={t('revokedTitle')} detail={t('revoked')} />
      )}
    </div>
  )
}

function ContactAlert({title, detail}: {title: string; detail: string}) {
  const t = useTranslations('MemberEmailConfirmationPage')

  return (
    <Alert className="[&>svg]:size-5">
      <Info aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground flex flex-col gap-2 text-[18px]">
        <p className="font-semibold">{title}</p>
        <p>{detail}</p>
        <Link href={CONTACT_PATH} className="underline underline-offset-4">
          {t('contactLink')}
        </Link>
      </AlertDescription>
    </Alert>
  )
}
