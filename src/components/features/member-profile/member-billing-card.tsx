'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {Suspense, use, useId, useState} from 'react'
import {useForm} from 'react-hook-form'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import type {BoardMemberInvoicesDTO} from '@/services/types/domain/member-invoice-types'

import {
  createMemberBillingFormSchema,
  type MemberBillingFormAction,
  type MemberBillingFormSchemaType,
} from './member-billing-validation'
import {DetailCard} from './member-profile-detail-card'

type BillingProfile = {
  id: string
  name: string
  pennylaneCustomerId: string | null
}

/**
 * Carte « Facturation » de la fiche (s20, ecran 2, critere 4) :
 * l'« Identifiant client Pennylane » de ce terrain, que le bureau renseigne
 * sur une fiche creee a la main. Sous Pennylane et sans identifiant, un
 * avertissement dit que ses factures ne remontent pas (2b).
 */
export function MemberBillingCard({
  profile,
  action,
  invoicesPromise,
}: {
  profile: BillingProfile
  action: MemberBillingFormAction
  /** Le fournisseur se lit dans la carte « Factures », sans etre attendu. */
  invoicesPromise: Promise<BoardMemberInvoicesDTO | undefined>
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.billing')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [current, setCurrent] = useState(profile.pennylaneCustomerId)

  return (
    <DetailCard title={t('title')}>
      {!current && (
        <Suspense fallback={null}>
          <UnlinkedWarning invoicesPromise={invoicesPromise} />
        </Suspense>
      )}
      {saved && !editing && (
        <Alert role="status" className="[&>svg]:size-5">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t('saved')}
          </AlertDescription>
        </Alert>
      )}
      {editing ? (
        <BillingForm
          profileId={profile.id}
          value={current}
          action={action}
          onCancel={() => setEditing(false)}
          onSaved={(value) => {
            setCurrent(value)
            setSaved(true)
            setEditing(false)
          }}
        />
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-3 text-[17px] sm:grid-cols-[16rem_1fr]">
            <dt className="text-muted-foreground">{t('label')}</dt>
            <dd>
              {current ? (
                <span className="font-mono font-medium break-all tabular-nums">
                  {current}
                </span>
              ) : (
                <span className="text-muted-foreground">{t('missing')}</span>
              )}
            </dd>
          </dl>
          <div>
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full text-base sm:h-11 sm:w-auto"
              onClick={() => {
                setSaved(false)
                setEditing(true)
              }}
            >
              {t('edit')}
            </Button>
          </div>
        </>
      )}
    </DetailCard>
  )
}

function UnlinkedWarning({
  invoicesPromise,
}: {
  invoicesPromise: Promise<BoardMemberInvoicesDTO | undefined>
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.billing')
  const invoices = use(invoicesPromise)
  if (!invoices?.syncedFromPennylane) return null

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-base">
        {t('unlinked')}
      </AlertDescription>
    </Alert>
  )
}

function BillingForm({
  profileId,
  value,
  action,
  onCancel,
  onSaved,
}: {
  profileId: string
  value: string | null
  action: MemberBillingFormAction
  onCancel: () => void
  onSaved: (value: string | null) => void
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const id = useId()
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<MemberBillingFormSchemaType>({
    resolver: zodResolver(createMemberBillingFormSchema(t)),
    defaultValues: {pennylaneCustomerId: value ?? ''},
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const error = form.formState.errors.pennylaneCustomerId?.message

  const save = async (values: MemberBillingFormSchemaType) => {
    setFailure(null)
    const formData = new FormData()
    formData.set('memberProfileId', profileId)
    formData.set('pennylaneCustomerId', values.pennylaneCustomerId)

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const issue of result.errors) {
        form.setError(issue.field, {message: issue.message})
      }
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
      onSaved(values.pennylaneCustomerId.trim() || null)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="flex flex-col gap-6"
    >
      {failure && (
        <Alert variant="destructive" className="border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {failure}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-base font-medium">
          {t('detail.billing.label')}{' '}
          <span className="text-muted-foreground font-normal">
            {t('optional')}
          </span>
        </Label>
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={[`${id}-help`, error && `${id}-error`]
            .filter(Boolean)
            .join(' ')}
          className="h-14 font-mono text-[18px] tabular-nums aria-invalid:border-2 sm:h-12"
          {...form.register('pennylaneCustomerId')}
        />
        <p id={`${id}-help`} className="text-muted-foreground text-base">
          {t('detail.billing.help')}
        </p>
        {error && (
          <p id={`${id}-error`} className="text-destructive text-base">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-14 w-full text-base sm:h-11 sm:w-auto"
        >
          {form.formState.isSubmitting
            ? t('detail.billing.saving')
            : t('detail.billing.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base sm:h-11 sm:w-auto"
          onClick={onCancel}
        >
          {t('detail.billing.cancel')}
        </Button>
      </div>
    </form>
  )
}
