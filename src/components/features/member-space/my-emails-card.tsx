'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck, Info, Mail, Plus} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useEffect, useId, useRef, useState} from 'react'
import {useForm} from 'react-hook-form'

import {shortDayOfInstant} from '@/components/features/member-profile/member-email-format'
import {
  createMemberEmailFormSchema,
  type MemberEmailFormSchemaType,
} from '@/components/features/member-profile/member-profile-email-validation'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Skeleton} from '@/components/ui/skeleton'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {
  MyEmailDTO,
  MyEmailsDTO,
} from '@/services/types/domain/member-email-types'

import {
  MY_EMAIL_FORM_FIELDS,
  type MyEmailActionResult,
  type MyEmailActions,
  type MyEmailFormAction,
} from './my-emails-validation'

/**
 * « Mes adresses email » (s54, ecran 1), placee juste apres « Mes
 * coordonnees ». Chaque adresse se connecte et recoit les envois ; la
 * personne connectee modifie la sienne, ajoute des adresses et gere les
 * attentes qu'elle a ajoutees — une seule action par ligne. Formulaires en
 * place, jamais de `dialog`. Aucun identifiant de fiche ni d'adresse dans le
 * DOM : l'action recoit l'identifiant de la ligne en `FormData`, que le
 * serveur revérifie contre la session.
 */

const CONTACT_PATH = '/contact'
const BUTTON_CLASS = 'h-14 w-full text-base sm:h-12 sm:w-auto'

type Editing =
  | {kind: 'add'}
  | {kind: 'modify'; index: number}
  | {kind: 'manage'; index: number}
  | null

type Notice =
  | {kind: 'sent'; email: string}
  | {kind: 'deferred'}
  | {kind: 'cancelled'}
  | {kind: 'error'; message: string}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

export function MyEmailsCard({
  emails,
  ...actions
}: MyEmailActions & {emails: MyEmailsDTO}) {
  const t = useTranslations('MemberSpacePage.emails')
  const titleId = useId()
  const [editing, setEditing] = useState<Editing>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  const onResult = (result: MyEmailActionResult): string | undefined => {
    if (result.status === 'sent') {
      setEditing(null)
      setNotice({kind: 'sent', email: result.email})
    } else if (result.status === 'deferred') {
      setEditing(null)
      setNotice({kind: 'deferred'})
    } else if (result.status === 'cancelled') {
      setEditing(null)
      setNotice({kind: 'cancelled'})
    } else if (result.status === 'error') {
      setNotice({kind: 'error', message: result.message})
    } else if (result.status === 'invalid') {
      return result.message
    } else if (result.status === 'already_listed') {
      return t('alreadyListed')
    } else if (result.status === 'taken') {
      return t('taken')
    }
    return undefined
  }

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-6 px-4 py-6 shadow-none sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {t('title')}
          </h2>
          <p className="text-muted-foreground text-[15px]">
            {t('intro')}
            {emails.landCount > 1 &&
              ` ${t('forLands', {count: emails.landCount})}`}
          </p>
        </div>

        {notice && (
          <NoticeAlert
            ref={noticeRef}
            notice={notice}
            days={emails.confirmationDays}
          />
        )}

        <ul className="flex flex-col">
          {emails.emails.map((email, index) => (
            <li key={email.email} className="border-b last:border-b-0">
              <EmailLine
                email={email}
                onModify={() => {
                  setNotice(null)
                  setEditing({kind: 'modify', index})
                }}
                onManage={() => {
                  setNotice(null)
                  setEditing({kind: 'manage', index})
                }}
              />
              {editing?.kind === 'modify' && editing.index === index && (
                <EmailForm
                  label={t('modifyForm.label')}
                  help={t('modifyForm.help')}
                  submitLabel={t('addForm.send')}
                  emailId={email.ownEmailId}
                  action={actions.updateEmailAction}
                  onResult={onResult}
                  onCancel={() => setEditing(null)}
                />
              )}
              {editing?.kind === 'manage' && editing.index === index && (
                <EmailForm
                  label={t('manageForm.label')}
                  submitLabel={t('manageForm.resend')}
                  defaultEmail={email.email}
                  emailId={email.pendingId}
                  action={actions.correctEmailAction}
                  onResult={onResult}
                  onCancel={() => setEditing(null)}
                  cancelLabel={t('manageForm.close')}
                  extra={
                    <CancelPendingButton
                      emailId={email.pendingId}
                      action={actions.cancelEmailAction}
                      onResult={onResult}
                    />
                  }
                />
              )}
            </li>
          ))}
        </ul>

        {editing?.kind === 'add' ? (
          <EmailForm
            label={t('addForm.label')}
            help={t('addForm.help')}
            submitLabel={t('addForm.send')}
            emailId={null}
            action={actions.addEmailAction}
            onResult={onResult}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              className={BUTTON_CLASS}
              onClick={() => {
                setNotice(null)
                setEditing({kind: 'add'})
              }}
            >
              <Plus aria-hidden="true" className="size-5" />
              {t('add')}
            </Button>
          </div>
        )}

        <p className="text-muted-foreground text-[15px]">
          {t('removeNote')}{' '}
          <Link
            href={CONTACT_PATH}
            className="text-primary font-semibold underline underline-offset-4"
          >
            {t('contactLink')}
          </Link>
        </p>
      </Card>
    </section>
  )
}

function NoticeAlert({
  ref,
  notice,
  days,
}: {
  ref: React.Ref<HTMLDivElement>
  notice: Notice
  days: number
}) {
  const t = useTranslations('MemberSpacePage.emails')

  if (notice.kind === 'error') {
    return (
      <Alert
        ref={ref}
        tabIndex={-1}
        variant="destructive"
        className="border-2 [&>svg]:size-5"
      >
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-foreground text-base">
          {notice.message}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert ref={ref} tabIndex={-1} role="status" className="[&>svg]:size-5">
      {notice.kind === 'deferred' ? (
        <Info aria-hidden="true" className="text-primary" />
      ) : (
        <CircleCheck aria-hidden="true" className="text-primary" />
      )}
      <AlertDescription className="text-foreground text-base">
        <p>
          {notice.kind === 'sent'
            ? t.rich('sent', {email: notice.email, days, strong})
            : t(notice.kind)}
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** Une ligne de 56 px, l'adresse en `data`, puis sa `meta`. */
function EmailLine({
  email,
  onModify,
  onManage,
}: {
  email: MyEmailDTO
  onModify: () => void
  onManage: () => void
}) {
  const t = useTranslations('MemberSpacePage.emails')

  return (
    <div className="flex min-h-14 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Mail
          aria-hidden="true"
          className="text-primary mt-0.5 size-5 shrink-0"
          strokeWidth={1.75}
        />
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[17px] font-medium [overflow-wrap:anywhere]">
            {email.email}
          </p>
          <EmailMeta email={email} />
        </div>
      </div>
      {email.ownEmailId && (
        <Button
          type="button"
          variant="link"
          className="h-11 self-start px-0 text-base sm:self-center"
          aria-label={t('modifyLabel', {email: email.email})}
          onClick={onModify}
        >
          {t('modify')}
        </Button>
      )}
      {email.pendingId && (
        <Button
          type="button"
          variant="link"
          className="h-11 self-start px-0 text-base sm:self-center"
          aria-label={t('manageLabel', {email: email.email})}
          onClick={onManage}
        >
          {t('manage')}
        </Button>
      )}
    </div>
  )
}

function EmailMeta({email}: {email: MyEmailDTO}) {
  const t = useTranslations('MemberSpacePage.emails')
  const lines: ReactNode[] = []

  if (email.status === 'pending') {
    const until = email.expiresAt ? shortDayOfInstant(email.expiresAt) : ''
    lines.push(
      <Badge key="badge" variant="outline">
        {t('pendingBadge')}
      </Badge>
    )
    lines.push(
      email.replacesOwn
        ? t('pendingReplaces', {until})
        : t('pendingMeta', {
            sent: email.sentAt ? shortDayOfInstant(email.sentAt) : '',
            until,
          })
    )
  } else if (email.own) {
    lines.push(t(email.holder ? 'ownHolder' : 'own'))
  } else if (email.holder) {
    lines.push(t('holder'))
  }
  if (email.onlyParcelNumbers) {
    lines.push(
      t('onlyParcels', {
        count: email.onlyParcelNumbers.length,
        numbers: joinParcelNumbers(email.onlyParcelNumbers),
      })
    )
  }

  return (
    <>
      {lines.map((line, index) =>
        typeof line === 'string' ? (
          <p key={index} className="text-muted-foreground text-[15px]">
            {line}
          </p>
        ) : (
          line
        )
      )}
    </>
  )
}

const formDataOf = (values: Record<string, string | null>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value) formData.set(key, value)
  }
  return formData
}

/** Un formulaire en place : le champ, son aide, son erreur, ses boutons. */
function EmailForm({
  label,
  help,
  submitLabel,
  defaultEmail = '',
  emailId,
  action,
  onResult,
  onCancel,
  cancelLabel,
  extra,
}: {
  label: string
  help?: string
  submitLabel: string
  defaultEmail?: string
  emailId: string | null
  action: MyEmailFormAction
  onResult: (result: MyEmailActionResult) => string | undefined
  onCancel: () => void
  cancelLabel?: string
  extra?: ReactNode
}) {
  const t = useTranslations('MemberSpacePage.emails')
  const id = useId()
  const form = useForm<MemberEmailFormSchemaType>({
    resolver: zodResolver(createMemberEmailFormSchema(t)),
    defaultValues: {email: defaultEmail},
  })
  const error = form.formState.errors.email?.message
  const describedBy = [help && `${id}-help`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const fieldError = onResult(
          await action(
            undefined,
            formDataOf({
              [MY_EMAIL_FORM_FIELDS.emailId]: emailId,
              [MY_EMAIL_FORM_FIELDS.email]: values.email.trim(),
            })
          )
        )
        if (fieldError) form.setError('email', {message: fieldError})
      })}
      className="flex flex-col gap-4 pb-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base font-medium">
          {label}
        </Label>
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="h-14 text-[18px] aria-invalid:border-2 sm:h-12"
          {...form.register('email')}
        />
        {help && (
          <p id={`${id}-help`} className="text-muted-foreground text-base">
            {help}
          </p>
        )}
        {error && (
          <p
            id={`${id}-error`}
            className="text-destructive-text text-base font-medium"
          >
            {error}{' '}
            {error === t('taken') && (
              <Link
                href={CONTACT_PATH}
                className="underline underline-offset-4"
              >
                {t('contactLink')}
              </Link>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className={BUTTON_CLASS}
        >
          {form.formState.isSubmitting ? t('addForm.sending') : submitLabel}
        </Button>
        {extra}
        <Button
          type="button"
          variant="outline"
          className={BUTTON_CLASS}
          onClick={onCancel}
        >
          {cancelLabel ?? t('addForm.cancel')}
        </Button>
      </div>
    </form>
  )
}

function CancelPendingButton({
  emailId,
  action,
  onResult,
}: {
  emailId: string | null
  action: MyEmailFormAction
  onResult: (result: MyEmailActionResult) => string | undefined
}) {
  const t = useTranslations('MemberSpacePage.emails')
  const [pending, setPending] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className={`${BUTTON_CLASS} border-destructive text-destructive-text hover:text-destructive-text`}
      onClick={async () => {
        setPending(true)
        onResult(
          await action(
            undefined,
            formDataOf({[MY_EMAIL_FORM_FIELDS.emailId]: emailId})
          )
        )
        setPending(false)
      }}
    >
      {t('manageForm.cancelPending')}
    </Button>
  )
}

const LOADING_LINES = [0, 1, 2]

/** Chargement : trois lignes `skeleton`, `aria-busy` (patron de s53). */
export function MyEmailsCardLoading() {
  const t = useTranslations('MemberSpacePage.emails')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} aria-busy="true">
      <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {LOADING_LINES.map((line) => (
          <Skeleton key={line} className="h-14 w-full" />
        ))}
      </Card>
    </section>
  )
}
