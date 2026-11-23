'use client'

import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useActionState, useId} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import type {
  CampaignSendKind,
  ConfirmUnsubscribeActionResult,
} from '@/services/types/domain/campaign-types'

export type UnsubscribeScreenState =
  'confirm' | 'unsubscribed' | 'already' | 'invalid' | 'error'

type UnsubscribePanelProps = {
  token: string
  associationName: string
  contactEmail: string | null
  /** L'etat lu au rendu, **sans ecriture** (`GET`). */
  initialState: UnsubscribeScreenState
  /**
   * Les types d'envoi statutaires de l'association (s27b), lus avec l'etat ;
   * `null` s'ils n'ont pas pu l'etre : la page ne promet alors rien.
   */
  statutoryTemplateIds: CampaignSendKind[] | null
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
 * `h1`. En demande, une fois enregistree ou deja faite, elle dit ce que le
 * membre continuera de recevoir, d'apres la classification (s27b, ecran 5).
 */
export function UnsubscribePanel({
  token,
  associationName,
  contactEmail,
  initialState,
  statutoryTemplateIds,
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
          {state === 'confirm' && (
            <StatutoryNotice
              associationName={associationName}
              templateIds={statutoryTemplateIds}
            />
          )}
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
      {(state === 'unsubscribed' || state === 'already') && (
        <StatutoryNotice
          associationName={associationName}
          templateIds={statutoryTemplateIds}
        />
      )}
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

/**
 * Ce que le membre continuera de recevoir (s27b, critere 5) : la liste des
 * types statutaires, sous leurs libelles des reglages ; aucun, la phrase
 * « plus aucune campagne ». Sans classification lue, rien n'est promis.
 */
function StatutoryNotice({
  associationName,
  templateIds,
}: {
  associationName: string
  templateIds: CampaignSendKind[] | null
}) {
  const t = useTranslations('UnsubscribePage')
  const tNature = useTranslations('AssociationSettings.campaignNature')
  const labelId = useId()

  if (templateIds === null) return null
  if (templateIds.length === 0) {
    return <p>{t('nothingMore', {name: associationName})}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId}>{t('continues')}</p>
      <ul aria-labelledby={labelId} className="list-disc pl-6">
        {templateIds.map((templateId) => (
          <li key={templateId}>{tNature(`templates.${templateId}`)}</li>
        ))}
      </ul>
    </div>
  )
}
