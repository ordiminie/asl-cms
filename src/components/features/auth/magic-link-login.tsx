'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {CircleAlert, CircleCheck, Mail} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {MouseEvent, ReactNode, useEffect, useState} from 'react'
import {useForm} from 'react-hook-form'

import type {MagicLinkRequestState} from '@/app/[locale]/(auth)/action'
import {createMagicLinkRequestSchema} from '@/components/features/auth/auth-form-validation'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  MAGIC_LINK_EXPIRES_IN_MINUTES,
  MAGIC_LINK_RESEND_DELAY_SECONDS,
} from '@/lib/better-auth/magic-link-constants'

export type MagicLinkRequestAction = (
  prevState: MagicLinkRequestState,
  formData: FormData
) => Promise<MagicLinkRequestState>

type MagicLinkLoginProps = {
  requestAction: MagicLinkRequestAction
}

type FormValues = {email: string}

const EMAIL_FIELD_ID = 'magic-link-email'
const EMAIL_ERROR_ID = 'magic-link-email-error'

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

const toFormData = (email: string) => {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

/**
 * Garde le focus dans le champ pendant l'appui sur le bouton : sinon le _blur_
 * valide le champ, son message deplace le bouton avant le relachement et le
 * clic se perd (lecon de s02). L'envoi valide de toute facon le champ.
 */
const keepFocusUntilClick = (event: MouseEvent<HTMLButtonElement>) =>
  event.preventDefault()

/**
 * Connexion par lien (s03, ecrans A et B du design) : un seul composant, deux
 * vues. L'adresse reste dans l'etat du composant, **jamais dans l'URL**
 * (donnee personnelle) ; « Renvoyer un lien » et « Corriger l'adresse » s'en
 * servent. L'ecran B est le meme que l'adresse soit enregistree ou non.
 */
export function MagicLinkLogin({requestAction}: MagicLinkLoginProps) {
  const [view, setView] = useState<'request' | 'sent'>('request')
  const [email, setEmail] = useState('')

  if (view === 'sent') {
    return (
      <SentView
        email={email}
        requestAction={requestAction}
        onCorrect={() => setView('request')}
      />
    )
  }

  return (
    <RequestView
      initialEmail={email}
      requestAction={requestAction}
      onSent={(sentTo) => {
        setEmail(sentTo)
        setView('sent')
      }}
    />
  )
}

function RequestView({
  initialEmail,
  requestAction,
  onSent,
}: {
  initialEmail: string
  requestAction: MagicLinkRequestAction
  onSent: (email: string) => void
}) {
  const t = useTranslations('Auth.MagicLinkLogin')
  const [unavailable, setUnavailable] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(createMagicLinkRequestSchema(t)),
    defaultValues: {email: initialEmail},
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const emailError = errors.email?.message

  const onValid = async ({email}: FormValues) => {
    setUnavailable(false)
    const result = await requestAction({status: 'idle'}, toFormData(email))

    if (result.status === 'sent') {
      onSent(email)
    } else if (result.status === 'invalid') {
      form.setError('email', {message: result.errors[0]?.message})
    } else if (result.status === 'unavailable') {
      setUnavailable(true)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AuthCard>
        <h1 className="font-serif text-2xl leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-base">{t.rich('intro', {strong})}</p>

        {unavailable && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" strokeWidth={1.75} />
            <AlertDescription className="text-base">
              {t.rich('unavailable', {strong})}
            </AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={form.handleSubmit(onValid)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label
              htmlFor={EMAIL_FIELD_ID}
              className="text-base leading-snug font-medium"
            >
              {t('email.label')}
            </Label>
            <Input
              id={EMAIL_FIELD_ID}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? EMAIL_ERROR_ID : undefined}
              className="aria-invalid:border-2"
              disabled={isSubmitting}
              {...form.register('email')}
            />
            {emailError && (
              <p
                id={EMAIL_ERROR_ID}
                className="text-destructive flex items-start gap-2 text-base"
              >
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0"
                  strokeWidth={1.75}
                />
                <span>{emailError}</span>
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            onMouseDown={keepFocusUntilClick}
            className="h-14 w-full text-base sm:h-12"
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="bg-muted rounded-md p-4 text-base">
          {t.rich('postal', {strong})}
        </p>
      </AuthCard>
      <p className="text-center text-sm">
        <Link
          href="/login/prestataire"
          className="text-muted-foreground underline underline-offset-4"
        >
          {t('providerAccess')}
        </Link>
      </p>
    </div>
  )
}

function SentView({
  email,
  requestAction,
  onCorrect,
}: {
  email: string
  requestAction: MagicLinkRequestAction
  onCorrect: () => void
}) {
  const t = useTranslations('Auth.MagicLinkLogin')
  const {secondsLeft, restart} = useResendCountdown()
  const [resending, setResending] = useState(false)
  const [feedback, setFeedback] = useState<'none' | 'resent' | 'unavailable'>(
    'none'
  )

  const resend = async () => {
    setResending(true)
    setFeedback('none')
    const result = await requestAction({status: 'idle'}, toFormData(email))
    setResending(false)

    if (result.status === 'sent') {
      setFeedback('resent')
      restart()
    } else {
      setFeedback('unavailable')
    }
  }

  return (
    <AuthCard data-testid="magic-link-sent">
      <Mail
        aria-hidden="true"
        className="text-primary size-6"
        strokeWidth={1.75}
      />
      <h1 className="font-serif text-2xl leading-tight font-semibold">
        {t('sent.title')}
      </h1>
      <p className="text-base">
        {t.rich('sent.intro', {
          email,
          minutes: MAGIC_LINK_EXPIRES_IN_MINUTES,
          strong,
        })}
      </p>

      {feedback === 'resent' && (
        <Alert>
          <CircleCheck
            aria-hidden="true"
            className="text-primary"
            strokeWidth={1.75}
          />
          <AlertDescription className="text-foreground text-base">
            {t('sent.resent')}
          </AlertDescription>
        </Alert>
      )}
      {feedback === 'unavailable' && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" strokeWidth={1.75} />
          <AlertDescription className="text-base">
            {t.rich('unavailable', {strong})}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg leading-snug font-semibold">
          {t('sent.nothingTitle')}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-base">
          <li>{t('sent.stepWait')}</li>
          <li>{t('sent.stepSpam')}</li>
          <li>
            {t('sent.stepCheck', {email})}{' '}
            <Button
              type="button"
              variant="link"
              onClick={onCorrect}
              className="h-auto p-0 text-base underline underline-offset-4"
            >
              {t('sent.correct')}
            </Button>
          </li>
        </ol>
        <p className="text-muted-foreground text-base">{t('sent.causes')}</p>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={secondsLeft > 0 || resending}
        onClick={resend}
        className="h-14 w-full text-base sm:h-12"
      >
        {secondsLeft > 0
          ? t('sent.resendIn', {seconds: secondsLeft})
          : t('sent.resend')}
      </Button>

      <p className="text-base">{t('sent.help')}</p>
    </AuthCard>
  )
}

function AuthCard({
  children,
  ...props
}: {children: ReactNode; 'data-testid'?: string}) {
  return (
    <Card
      className="gap-5 px-4 py-4 shadow-none sm:px-8 sm:py-8"
      {...props}
    >
      {children}
    </Card>
  )
}

/**
 * Compte a rebours du renvoi : `MAGIC_LINK_RESEND_DELAY_SECONDS` des
 * l'affichage de l'ecran B, relance a chaque renvoi. Calcule sur une echeance,
 * pas en decomptant les ticks : un onglet en arriere-plan ne le ralentit pas.
 */
function useResendCountdown() {
  const [deadline, setDeadline] = useState(
    () => Date.now() + MAGIC_LINK_RESEND_DELAY_SECONDS * 1000
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= deadline) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  return {
    secondsLeft: Math.max(0, Math.ceil((deadline - now) / 1000)),
    restart: () => {
      const current = Date.now()
      setNow(current)
      setDeadline(current + MAGIC_LINK_RESEND_DELAY_SECONDS * 1000)
    },
  }
}
