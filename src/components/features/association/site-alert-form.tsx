'use client'

import {CircleAlert, CircleCheck} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useId, useState, useTransition} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {AlertBanner} from '@/components/ui/alert-banner'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {cn} from '@/lib/utils'
import {
  SITE_ALERT_MAX_LENGTH,
  SiteAlertDTO,
} from '@/services/types/domain/site-alert-types'

export type SiteAlertActionResult =
  | {status: 'saved'; active: boolean}
  | {status: 'invalid'; message: string}
  | {status: 'error'; message: string}

type SiteAlertFormProps = {
  initialAlert: SiteAlertDTO
  saveAction: (
    message: string,
    active: boolean
  ) => Promise<SiteAlertActionResult>
  removeAction: () => Promise<SiteAlertActionResult>
}

type Notice = 'shown' | 'removed'

/**
 * Ecran « Bandeau d'alerte » du bureau (design s07, ecran 1, etats 1a a 1g).
 *
 * Message et affichage s'enregistrent d'un seul geste — pas d'interrupteur :
 * un seul bouton `default` dont le libelle suit l'etat, et « Retirer le
 * bandeau » seulement quand il est affiche. Le retrait laisse le message dans
 * le champ (etat 1g). Succes et echec sont des `alert` ancrees, jamais des
 * toasts : le succes en `status`, l'echec d'une soumission en `alert`.
 */
export function SiteAlertForm({
  initialAlert,
  saveAction,
  removeAction,
}: SiteAlertFormProps) {
  const t = useTranslations('BureauAlertPage')
  const messageId = useId()

  const [message, setMessage] = useState(initialAlert.message)
  const [active, setActive] = useState(initialAlert.active)
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [notice, setNotice] = useState<Notice>()
  const [isPending, startTransition] = useTransition()

  const overflow = message.length - SITE_ALERT_MAX_LENGTH
  const hasOverflow = overflow > 0
  const isInvalid = hasOverflow || fieldError !== undefined
  const hasPreview = message.trim() !== ''

  const run = (
    action: () => Promise<SiteAlertActionResult>,
    onSaved: Notice
  ) => {
    setFormError(undefined)
    setNotice(undefined)

    startTransition(async () => {
      try {
        const result = await action()

        if (result.status === 'saved') {
          setActive(result.active)
          setNotice(onSaved)
          return
        }
        if (result.status === 'invalid') {
          setFieldError(result.message)
          return
        }
        setFormError(result.message)
      } catch {
        setFormError(t('errors.failed'))
      }
    })
  }

  const save = () => {
    if (isPending) return

    if (message.trim() === '') {
      setFieldError(t('errors.messageRequired'))
      return
    }
    setFieldError(undefined)
    if (hasOverflow) return

    run(() => saveAction(message, true), 'shown')
  }

  const remove = () => {
    if (isPending) return
    run(removeAction, 'removed')
  }

  return (
    <div className="flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">{t('intro')}</p>
      </div>

      {notice && (
        <Alert role="status">
          <CircleCheck className="text-primary" strokeWidth={1.75} />
          <AlertDescription className="text-foreground">
            {t(`notices.${notice}`)}
          </AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive" className="border-destructive border-2">
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle>{t('errors.saveFailedTitle')}</AlertTitle>
          <AlertDescription className="text-foreground">
            {formError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
          <CardContent className="flex flex-col gap-2 px-0">
            <Label htmlFor={messageId}>{t('message.label')}</Label>
            <Textarea
              id={messageId}
              rows={4}
              value={message}
              aria-invalid={isInvalid ? true : undefined}
              aria-describedby={`${messageId}-help ${messageId}-counter`}
              className={cn(
                'min-h-[calc(6lh+1rem+2px)] sm:min-h-[calc(4lh+1rem+2px)]',
                isInvalid && 'border-destructive border-2'
              )}
              onChange={(event) => {
                setMessage(event.target.value)
                setFieldError(undefined)
              }}
            />
            <div className="flex items-start justify-between gap-4">
              <p
                id={`${messageId}-help`}
                className="text-muted-foreground text-[14px]"
              >
                {t('message.help', {max: SITE_ALERT_MAX_LENGTH})}
              </p>
              <p
                id={`${messageId}-counter`}
                className={cn(
                  'shrink-0 text-right font-mono text-[14px] tabular-nums',
                  hasOverflow
                    ? 'text-destructive-text font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {t('message.counter', {
                  count: message.length,
                  max: SITE_ALERT_MAX_LENGTH,
                })}
              </p>
            </div>
            {hasOverflow && (
              <p className="text-destructive-text text-[16px] font-medium">
                {t('message.overflow', {over: overflow})}
              </p>
            )}
            {fieldError && (
              <p className="text-destructive-text text-[16px] font-medium">
                {fieldError}
              </p>
            )}
          </CardContent>
        </Card>

        <p className="flex items-center gap-2 text-[15px]">
          <span
            aria-hidden="true"
            className={cn(
              'size-2.5 rounded-full',
              active ? 'bg-primary' : 'bg-muted-foreground'
            )}
          />
          {active ? t('status.shown') : t('status.hidden')}
        </p>
      </div>

      <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
        <CardHeader className="gap-1 px-0">
          <CardTitle>
            <h3 className="text-xl leading-snug font-semibold">
              {t('preview.title')}
            </h3>
          </CardTitle>
          <p className="text-muted-foreground text-[14px]">
            {t('preview.meta')}
          </p>
        </CardHeader>
        <CardContent className="px-0">
          {hasPreview ? (
            <div className="border-border overflow-hidden rounded-md border">
              <AlertBanner message={message} />
              <div aria-hidden="true" className="flex flex-col gap-2 p-4">
                <span className="bg-muted h-3 w-2/3 rounded-sm" />
                <span className="bg-muted h-3 w-1/2 rounded-sm" />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-[15px]">
              {t('preview.empty')}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          disabled={isPending}
          onClick={save}
          className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-72"
        >
          {isPending
            ? t('actions.saving')
            : active
              ? t('actions.save')
              : t('actions.show')}
        </Button>
        {active && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={remove}
            className="h-14 w-full sm:h-12 sm:w-auto"
          >
            {t('actions.remove')}
          </Button>
        )}
      </div>
    </div>
  )
}
