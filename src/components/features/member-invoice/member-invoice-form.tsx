'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {type ReactNode, useState} from 'react'
import {Controller, useForm, useWatch} from 'react-hook-form'

import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
} from '@/components/features/member-profile/member-profile-paths'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {
  DateField,
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  composeInvoiceSubject,
  formatAmountCents,
} from '@/services/rules/member-invoice-rules'
import type {BoardInvoiceDTO} from '@/services/types/domain/member-invoice-types'

import {
  createMemberInvoiceFormSchema,
  MEMBER_INVOICE_FORM_FIELDS,
  type MemberInvoiceFormAction,
  type MemberInvoiceFormField,
  type MemberInvoiceFormSchemaType,
} from './member-invoice-form-validation'
import {savedInvoicePathOf} from './member-invoice-paths'

/** Une parcelle de la fiche, avec sa periode de propriete `[startsOn, endsOn)`. */
export type MemberInvoiceParcelOption = {
  parcelId: string
  number: string
  startsOn: string
  endsOn: string | null
}

type MemberInvoiceFormProps = {
  memberProfile: {id: string; name: string}
  /** Toutes les parcelles, actuelles et anciennes, de la fiche. */
  parcels: MemberInvoiceParcelOption[]
  /** Les statuts declares dans les reglages (union des deux listes). */
  statuses: string[]
  subjectTemplate: string
  /** Le jour calendaire de Paris, ISO : l'emission proposee. */
  today: string
  /** La facture corrigee ; absente, une saisie. */
  invoice?: BoardInvoiceDTO
  action: MemberInvoiceFormAction
}

type Feedback =
  {kind: 'none'} | {kind: 'readOnly'} | {kind: 'error'; message: string}

const fieldId = (field: MemberInvoiceFormField) => `invoice-${field}`

const LABEL_CLASS = 'text-base font-medium'
const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'
const INVALID_CLASS = 'aria-invalid:border-2'
const DATA_INPUT_CLASS = 'h-14 font-mono text-[18px] tabular-nums lg:h-12'

const ownsAt = (parcel: MemberInvoiceParcelOption, date: string): boolean =>
  parcel.startsOn <= date && (parcel.endsOn === null || date < parcel.endsOn)

const initialValues = (
  today: string,
  invoice?: BoardInvoiceDTO
): MemberInvoiceFormSchemaType =>
  invoice
    ? {
        parcelId: invoice.parcelId ?? '',
        year: String(invoice.year),
        amount: formatAmountCents(invoice.amountCents),
        issuedOn: isoToFrenchDate(invoice.issuedOn),
        dueOn: isoToFrenchDate(invoice.dueOn),
        status: invoice.status,
      }
    : {
        parcelId: '',
        year: today.slice(0, 4),
        amount: '',
        issuedOn: isoToFrenchDate(today),
        dueOn: '',
        status: '',
      }

/**
 * Saisir ou corriger une facture (s19, ecran 3) : une page, une colonne. Le
 * terrain facture est choisi parmi les parcelles possedees a la date
 * d'emission, le statut parmi ceux des reglages ; l'objet n'est pas saisi, il
 * se lit en apercu. React Hook Form + le schema partage avec l'action.
 */
export function MemberInvoiceForm({
  memberProfile,
  parcels,
  statuses,
  subjectTemplate,
  today,
  invoice,
  action,
}: MemberInvoiceFormProps) {
  const t = useTranslations('BureauMemberInvoices')
  const router = useRouter()
  const [feedback, setFeedback] = useState<Feedback>({kind: 'none'})
  const [showSummary, setShowSummary] = useState(false)
  const form = useForm<MemberInvoiceFormSchemaType>({
    resolver: zodResolver(createMemberInvoiceFormSchema(t)),
    defaultValues: initialValues(today, invoice),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const [year, issuedOn] = useWatch({
    control: form.control,
    name: ['year', 'issuedOn'],
  })
  const profilePath = memberProfilePathOf(memberProfile.id)
  const issuedIso = frenchDateToIso(issuedOn)
  const ownedParcels = issuedIso
    ? parcels.filter((parcel) => ownsAt(parcel, issuedIso))
    : parcels
  const yearNumber = /^\d{4}$/.test(year) ? Number(year) : undefined

  const onValid = async (values: MemberInvoiceFormSchemaType) => {
    setShowSummary(false)
    setFeedback({kind: 'none'})
    const formData = new FormData()
    if (invoice) formData.set('invoiceId', invoice.id)
    else formData.set('memberProfileId', memberProfile.id)
    for (const field of MEMBER_INVOICE_FORM_FIELDS) {
      formData.set(field, values[field])
    }

    try {
      const result = await action(undefined, formData)
      if (result.status === 'saved') {
        router.push(savedInvoicePathOf(memberProfile.id))
      } else if (result.status === 'invalid') {
        for (const error of result.errors) {
          form.setError(error.field, {type: 'server', message: error.message})
        }
        setShowSummary(true)
      } else if (result.status === 'read_only') {
        setFeedback({kind: 'readOnly'})
      } else {
        setFeedback({kind: 'error', message: result.message})
      }
    } catch {
      setFeedback({kind: 'error', message: t('errors.failed')})
    }
  }

  const invalidFields = MEMBER_INVOICE_FORM_FIELDS.filter(
    (field) => errors[field]
  )
  const title = invoice
    ? t('form.editTitle', {date: isoToFrenchDate(invoice.issuedOn)})
    : t('form.newTitle')

  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <InvoiceBreadcrumb
        memberProfile={memberProfile}
        current={
          invoice
            ? t('form.breadcrumbEdit', {
                date: isoToFrenchDate(invoice.issuedOn),
              })
            : t('form.breadcrumbNew')
        }
      />
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {title}
      </h1>

      {showSummary && invalidFields.length > 0 && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle className="text-[17px] font-semibold">
            {t('form.summary', {count: invalidFields.length})}
          </AlertTitle>
          <AlertDescription className="text-foreground text-[17px]">
            <ul className="flex flex-col gap-1">
              {invalidFields.map((field) => (
                <li key={field}>
                  <a href={`#${fieldId(field)}`} className="underline">
                    {errors[field]?.message}
                  </a>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {feedback.kind !== 'none' && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-[17px]">
            {feedback.kind === 'readOnly'
              ? t('readOnly.refused')
              : feedback.message}
          </AlertDescription>
        </Alert>
      )}

      <Card className="px-4 py-6 shadow-none sm:px-8">
        <form
          onSubmit={form.handleSubmit(onValid, () => setShowSummary(true))}
          noValidate
          className="flex flex-col gap-6"
        >
          <Controller
            control={form.control}
            name="parcelId"
            render={({field}) => (
              <FieldBlock
                field="parcelId"
                label={t('form.parcel.label')}
                help={t('form.parcel.help', {name: memberProfile.name})}
                error={errors.parcelId?.message}
              >
                <Select
                  value={field.value === '' ? undefined : field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id={fieldId('parcelId')}
                    aria-labelledby={`${fieldId('parcelId')}-label`}
                    aria-describedby={`${fieldId('parcelId')}-help`}
                    aria-invalid={errors.parcelId ? true : undefined}
                    className={`h-14 sm:max-w-80 lg:h-12 ${INVALID_CLASS}`}
                  >
                    <SelectValue placeholder={t('form.parcel.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ownedParcels.map((parcel) => (
                      <SelectItem key={parcel.parcelId} value={parcel.parcelId}>
                        {t('form.parcel.option', {number: parcel.number})}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ownedParcels.length === 0 && (
                  <p className="text-muted-foreground text-base">
                    {t('form.parcel.none', {name: memberProfile.name})}
                  </p>
                )}
              </FieldBlock>
            )}
          />

          <div className="flex flex-col gap-6 sm:flex-row">
            <Controller
              control={form.control}
              name="year"
              render={({field}) => (
                <FieldBlock
                  field="year"
                  label={t('form.year.label')}
                  error={errors.year?.message}
                >
                  <Input
                    id={fieldId('year')}
                    inputMode="numeric"
                    value={field.value}
                    disabled={isSubmitting}
                    aria-invalid={errors.year ? true : undefined}
                    className={`max-w-32 ${DATA_INPUT_CLASS} ${INVALID_CLASS}`}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                  />
                </FieldBlock>
              )}
            />
            <Controller
              control={form.control}
              name="amount"
              render={({field}) => (
                <FieldBlock
                  field="amount"
                  label={t('form.amount.label')}
                  error={errors.amount?.message}
                >
                  <div className="flex items-center gap-3">
                    <Input
                      id={fieldId('amount')}
                      inputMode="decimal"
                      value={field.value}
                      disabled={isSubmitting}
                      aria-invalid={errors.amount ? true : undefined}
                      className={`max-w-40 ${DATA_INPUT_CLASS} ${INVALID_CLASS}`}
                      onChange={(event) => field.onChange(event.target.value)}
                      onBlur={field.onBlur}
                    />
                    <span className="text-base">{t('form.amount.unit')}</span>
                  </div>
                </FieldBlock>
              )}
            />
          </div>

          <p className="text-muted-foreground text-base">
            {t.rich('form.subjectPreview', {
              subject:
                yearNumber === undefined
                  ? subjectTemplate
                  : composeInvoiceSubject(subjectTemplate, yearNumber),
              strong: (chunks: ReactNode) => (
                <strong className="text-foreground">{chunks}</strong>
              ),
            })}
          </p>

          <div className="flex flex-col gap-6 sm:flex-row">
            {(['issuedOn', 'dueOn'] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({field}) => (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={fieldId(name)} className={LABEL_CLASS}>
                      {t(`form.${name}.label`)}
                    </Label>
                    <DateField
                      id={fieldId(name)}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                      placeholder={t('form.dateFormat')}
                      error={errors[name]?.message}
                    />
                  </div>
                )}
              />
            ))}
          </div>

          <Controller
            control={form.control}
            name="status"
            render={({field}) => (
              <FieldBlock
                field="status"
                label={t('form.status.label')}
                help={t('form.status.help')}
                error={errors.status?.message}
              >
                <Select
                  value={
                    field.value === '' || !statuses.includes(field.value)
                      ? undefined
                      : field.value
                  }
                  onValueChange={field.onChange}
                  disabled={isSubmitting || statuses.length === 0}
                >
                  <SelectTrigger
                    id={fieldId('status')}
                    aria-labelledby={`${fieldId('status')}-label`}
                    aria-describedby={`${fieldId('status')}-help`}
                    aria-invalid={errors.status ? true : undefined}
                    className={`h-14 sm:max-w-80 lg:h-12 ${INVALID_CLASS}`}
                  >
                    <SelectValue placeholder={t('form.status.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statuses.length === 0 && (
                  <p className="text-muted-foreground text-base">
                    {t('form.status.none')}
                  </p>
                )}
              </FieldBlock>
            )}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              {isSubmitting ? t('form.submitting') : t('form.submit')}
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              <Link href={profilePath}>{t('form.cancel')}</Link>
            </Button>
          </div>
        </form>
      </Card>

      <BackToProfile memberProfileId={memberProfile.id} />
    </div>
  )
}

/** Libelle, aide, controle et message sous le champ (§3.9). */
function FieldBlock({
  field,
  label,
  help,
  error,
  children,
}: {
  field: MemberInvoiceFormField
  label: string
  help?: string
  error?: string
  children: ReactNode
}) {
  const id = fieldId(field)

  return (
    <div className="flex flex-col gap-2">
      <Label id={`${id}-label`} htmlFor={id} className={LABEL_CLASS}>
        {label}
      </Label>
      {help && (
        <p id={`${id}-help`} className="text-muted-foreground text-base">
          {help}
        </p>
      )}
      {children}
      {error && <p className={FIELD_MESSAGE_CLASS}>{error}</p>}
    </div>
  )
}

/** Fil d'Ariane : Proprietaires › {nom} › l'ecran courant. */
export function InvoiceBreadcrumb({
  memberProfile,
  current,
}: {
  memberProfile: {id: string; name: string}
  current: string
}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <Breadcrumb aria-label={t('breadcrumb.label')}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={MEMBER_PROFILES_PATH}>{t('breadcrumb.list')}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={memberProfilePathOf(memberProfile.id)}>
              {memberProfile.name}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** « Revenir a la fiche » : `ArrowLeft` et libelle. */
export function BackToProfile({memberProfileId}: {memberProfileId: string}) {
  const t = useTranslations('BureauMemberInvoices.form')

  return (
    <Link
      href={memberProfilePathOf(memberProfileId)}
      className="text-primary inline-flex h-12 items-center gap-2 self-start font-semibold underline underline-offset-4"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      {t('back')}
    </Link>
  )
}
