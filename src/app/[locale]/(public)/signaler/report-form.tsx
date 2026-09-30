'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {type MouseEvent, type Ref, useEffect, useRef, useState} from 'react'
import {useForm} from 'react-hook-form'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'

import {type ReportRecontact, submitReportAction} from './actions'
import {
  createReportFormSchema,
  REPORT_FORM_FIELDS,
  type ReportFormField,
  type ReportFormSchemaType,
} from './report-form-validation'

const EMPTY_VALUES: ReportFormSchemaType = {
  categoryId: '',
  location: '',
  description: '',
  name: '',
  email: '',
  phone: '',
}

/** Ancre d'un champ, cible des liens du resume d'erreurs. */
const fieldAnchorOf = (field: ReportFormField) => `report-field-${field}`

/** Message sous un champ fautif : 16 px / 500, `--destructive-text` (§3.9). */
const FIELD_MESSAGE_CLASS = 'text-base font-medium'

/** Bordure 2 px `destructive` sur un champ fautif (§3.1). */
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'

const LABEL_CLASS = 'text-base font-medium'

const toFormData = (values: ReportFormSchemaType, locale: string) => {
  const formData = new FormData()
  formData.set('locale', locale)
  for (const field of REPORT_FORM_FIELDS) {
    formData.set(field, values[field] ?? '')
  }
  return formData
}

/**
 * Formulaire public « Signaler une fuite ou un incident » (s10, ecran 1 du
 * design), sur le patron de `/contact` : vierge, erreurs par champ aux trois
 * signaux (resume ancre focalise, bordure 2 px, message sous le champ), envoi
 * en cours a largeur conservee, succes neutre, refus au-dela du seuil avec le
 * texte conserve. Sans categorie proposee, le champ disparait (decision D).
 */
export function ReportForm({categories}: {categories: PublicCategoryDTO[]}) {
  const t = useTranslations('ReportPage')
  const [sent, setSent] = useState<ReportRecontact | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      {sent === null ? (
        <>
          <p className="text-lg leading-[1.65]">{t('intro')}</p>
          <Alert role="note">
            <AlertDescription className="text-foreground text-base">
              {t('emergency')}
            </AlertDescription>
          </Alert>
          <ReportFormCard categories={categories} onSent={setSent} />
        </>
      ) : (
        <SentAlert recontact={sent} onReportAnother={() => setSent(null)} />
      )}
    </div>
  )
}

function ReportFormCard({
  categories,
  onSent,
}: {
  categories: PublicCategoryDTO[]
  onSent: (recontact: ReportRecontact) => void
}) {
  const t = useTranslations('ReportPage')
  const locale = useLocale()
  const withCategory = categories.length > 0
  const form = useForm<ReportFormSchemaType>({
    resolver: zodResolver(
      createReportFormSchema(
        t,
        categories.map((category) => category.id)
      )
    ),
    defaultValues: EMPTY_VALUES,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryRequest, setSummaryRequest] = useState(0)
  const [failed, setFailed] = useState(false)
  const rateLimitRef = useRef<HTMLDivElement>(null)
  const [rateLimit, setRateLimit] = useState<number | null>(null)

  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus()
  }, [summaryRequest])

  useEffect(() => {
    if (rateLimit !== null) rateLimitRef.current?.focus()
  }, [rateLimit])

  const showSummary = () => setSummaryRequest((count) => count + 1)

  const onValid = async (values: ReportFormSchemaType) => {
    setFailed(false)
    try {
      const result = await submitReportAction(
        {status: 'idle'},
        toFormData(values, locale)
      )
      if (result.status === 'sent') {
        onSent(result.recontact)
      } else if (result.status === 'invalid') {
        for (const error of result.errors) {
          form.setError(error.field, {message: error.message})
        }
        showSummary()
      } else if (result.status === 'rate_limited') {
        setRateLimit(result.limit)
      }
    } catch {
      setFailed(true)
    }
  }

  const invalidFields = REPORT_FORM_FIELDS.filter((field) => errors[field])

  return (
    <Card className="px-4 py-6 shadow-none sm:px-8">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onValid, showSummary)}
          noValidate
          className="flex flex-col gap-6"
        >
          {summaryRequest > 0 && invalidFields.length > 0 && (
            <ErrorSummary
              ref={summaryRef}
              fields={invalidFields}
              onFocusField={(field) => form.setFocus(field)}
            />
          )}
          {rateLimit !== null && (
            <RateLimitAlert ref={rateLimitRef} limit={rateLimit} />
          )}
          {failed && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="text-base">
                {t('errors.generic')}
              </AlertDescription>
            </Alert>
          )}

          {withCategory && (
            <FormField
              control={form.control}
              name="categoryId"
              render={({field}) => (
                <FormItem id={fieldAnchorOf('categoryId')}>
                  <FormLabel className={LABEL_CLASS}>
                    {t('fields.categoryId.label')}
                  </FormLabel>
                  <Select
                    value={field.value === '' ? undefined : field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger
                        ref={field.ref}
                        onBlur={field.onBlur}
                        className={FIELD_INVALID_CLASS}
                      >
                        <SelectValue
                          placeholder={t('fields.categoryId.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          className="text-[17px]"
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className={FIELD_MESSAGE_CLASS} />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="location"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('location')}>
                <FormLabel className={LABEL_CLASS}>
                  {t('fields.location.label')}
                </FormLabel>
                <FormControl>
                  <Input className={FIELD_INVALID_CLASS} {...field} />
                </FormControl>
                <FormDescription className="text-base">
                  {t('fields.location.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('description')}>
                <FormLabel className={LABEL_CLASS}>
                  {t('fields.description.label')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    className={`resize-y text-[17px] ${FIELD_INVALID_CLASS}`}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-base">
                  {t('fields.description.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-1 border-t pt-6">
            <h3 className="text-lg font-semibold">{t('contact.title')}</h3>
            <p className="text-muted-foreground text-base">
              {t('contact.help')}
            </p>
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('name')}>
                <OptionalLabel label={t('fields.name.label')} />
                <FormControl>
                  <Input
                    autoComplete="name"
                    className={FIELD_INVALID_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('email')}>
                <OptionalLabel label={t('fields.email.label')} />
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={FIELD_INVALID_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('phone')}>
                <OptionalLabel label={t('fields.phone.label')} />
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    className={FIELD_INVALID_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting || rateLimit !== null}
            className="h-14 w-full text-base sm:h-12 sm:w-66"
          >
            {isSubmitting ? t('submit.pending') : t('submit.idle')}
          </Button>
        </form>
      </Form>
    </Card>
  )
}

function OptionalLabel({label}: {label: string}) {
  const t = useTranslations('ReportPage')

  return (
    <FormLabel className={LABEL_CLASS}>
      {label}{' '}
      <span className="text-muted-foreground font-normal">{t('optional')}</span>
    </FormLabel>
  )
}

function ErrorSummary({
  ref,
  fields,
  onFocusField,
}: {
  ref: Ref<HTMLDivElement>
  fields: ReportFormField[]
  onFocusField: (field: ReportFormField) => void
}) {
  const t = useTranslations('ReportPage')

  const focusField =
    (field: ReportFormField) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      onFocusField(field)
    }

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
        {t('summary.title')}
      </AlertTitle>
      <AlertDescription className="text-foreground text-base">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {fields.map((field) => (
            <li key={field}>
              <a
                href={`#${fieldAnchorOf(field)}`}
                onClick={focusField(field)}
                className="text-destructive-text underline underline-offset-4"
              >
                {t(`fields.${field}.label`)}
              </a>
            </li>
          ))}
        </ul>
        <p>{t('summary.kept')}</p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Refus au-dela du seuil horaire (etat `1.G`) : `alert` `destructive` ancre
 * et focalise, seuil interpole depuis le reglage de l'association, texte
 * saisi conserve.
 */
function RateLimitAlert({
  ref,
  limit,
}: {
  ref: Ref<HTMLDivElement>
  limit: number
}) {
  const t = useTranslations('ReportPage')

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        <p>
          {t('errors.rateLimit', {limit})} <strong>{t('summary.kept')}</strong>
        </p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Succes (etats `1.C` et `1.F`) : `alert` neutre, identique que l'email au
 * bureau soit parti ou non. La phrase de rappel dit par ou le bureau pourra
 * recontacter, ou qu'il ne le pourra pas.
 */
function SentAlert({
  recontact,
  onReportAnother,
}: {
  recontact: ReportRecontact
  onReportAnother: () => void
}) {
  const t = useTranslations('ReportPage')
  const {phone, email} = recontact
  const reminder =
    phone && email
      ? t('success.recontactBoth', {phone, email})
      : phone
        ? t('success.recontactPhone', {phone})
        : email
          ? t('success.recontactEmail', {email})
          : t('success.noContact')

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert role="status" className="[&>svg]:size-5">
        <CircleCheck aria-hidden="true" className="text-primary" />
        <AlertTitle className="line-clamp-none text-base font-bold">
          {t('success.title')}
        </AlertTitle>
        <AlertDescription className="text-foreground text-base">
          {reminder}
        </AlertDescription>
      </Alert>
      <Button
        type="button"
        variant="outline"
        onClick={onReportAnother}
        className="h-14 w-full text-base sm:h-12 sm:w-auto"
      >
        {t('success.cta')}
      </Button>
    </div>
  )
}
