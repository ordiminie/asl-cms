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
import {Textarea} from '@/components/ui/textarea'

import {submitContactAction} from './actions'
import {
  CONTACT_FORM_FIELDS,
  type ContactFormField,
  type ContactFormSchemaType,
  createContactFormSchema,
} from './contact-form-validation'

const EMPTY_VALUES: ContactFormSchemaType = {
  name: '',
  email: '',
  subject: '',
  content: '',
}

/** Ancre d'un champ, cible des liens du resume d'erreurs. */
const fieldAnchorOf = (field: ContactFormField) => `contact-field-${field}`

/** Message sous un champ fautif : 16 px / 500, `--destructive-text` (§3.9). */
const FIELD_MESSAGE_CLASS = 'text-base font-medium'

/** Bordure 2 px `destructive` sur un champ fautif (§3.1). */
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'

const toFormData = (values: ContactFormSchemaType, locale: string) => {
  const formData = new FormData()
  formData.set('locale', locale)
  for (const field of CONTACT_FORM_FIELDS) {
    formData.set(field, values[field] ?? '')
  }
  return formData
}

/**
 * Formulaire public « Contacter le bureau » (s08, ecran 1 du design) : vierge,
 * erreurs par champ, envoi en cours, succes. Les erreurs portent les trois
 * signaux ensemble — resume ancre focalise a la soumission, bordure 2 px,
 * message sous le champ — qu'elles viennent du client ou du serveur. Le succes
 * remplace le formulaire par un `alert` neutre, meme si la notification au
 * bureau n'est pas partie.
 */
export function ContactForm() {
  const t = useTranslations('ContactPage')
  const [sentTo, setSentTo] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      {sentTo === null ? (
        <>
          <p className="text-lg leading-[1.65]">{t('intro')}</p>
          <ContactFormCard onSent={setSentTo} />
        </>
      ) : (
        <SentAlert email={sentTo} onWriteAnother={() => setSentTo(null)} />
      )}
    </div>
  )
}

function ContactFormCard({onSent}: {onSent: (email: string) => void}) {
  const t = useTranslations('ContactPage')
  const locale = useLocale()
  const form = useForm<ContactFormSchemaType>({
    resolver: zodResolver(createContactFormSchema(t)),
    defaultValues: EMPTY_VALUES,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryRequest, setSummaryRequest] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus()
  }, [summaryRequest])

  const showSummary = () => setSummaryRequest((count) => count + 1)

  const onValid = async (values: ContactFormSchemaType) => {
    setFailed(false)
    try {
      const result = await submitContactAction(
        {status: 'idle'},
        toFormData(values, locale)
      )
      if (result.status === 'sent') {
        onSent(values.email)
      } else if (result.status === 'invalid') {
        for (const error of result.errors) {
          form.setError(error.field, {message: error.message})
        }
        showSummary()
      }
    } catch {
      setFailed(true)
    }
  }

  const invalidFields = CONTACT_FORM_FIELDS.filter((field) => errors[field])

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
          {failed && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="text-base">
                {t('errors.generic')}
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('name')}>
                <FormLabel className="text-base font-medium">
                  {t('fields.name.label')}{' '}
                  <span className="text-muted-foreground font-normal">
                    {t('fields.name.optional')}
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    className={FIELD_INVALID_CLASS}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormDescription className="text-base">
                  {t('fields.name.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('email')}>
                <FormLabel className="text-base font-medium">
                  {t('fields.email.label')}
                </FormLabel>
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
                <FormDescription className="text-base">
                  {t('fields.email.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('subject')}>
                <FormLabel className="text-base font-medium">
                  {t('fields.subject.label')}
                </FormLabel>
                <FormControl>
                  <Input className={FIELD_INVALID_CLASS} {...field} />
                </FormControl>
                <FormDescription className="text-base">
                  {t('fields.subject.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('content')}>
                <FormLabel className="text-base font-medium">
                  {t('fields.content.label')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={8}
                    className={`resize-y text-[17px] ${FIELD_INVALID_CLASS}`}
                    {...field}
                  />
                </FormControl>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-14 w-full text-base sm:h-12 sm:w-58"
          >
            {isSubmitting ? t('submit.pending') : t('submit.idle')}
          </Button>
        </form>
      </Form>
    </Card>
  )
}

function ErrorSummary({
  ref,
  fields,
  onFocusField,
}: {
  ref: Ref<HTMLDivElement>
  fields: ContactFormField[]
  onFocusField: (field: ContactFormField) => void
}) {
  const t = useTranslations('ContactPage')

  const focusField =
    (field: ContactFormField) => (event: MouseEvent<HTMLAnchorElement>) => {
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

function SentAlert({
  email,
  onWriteAnother,
}: {
  email: string
  onWriteAnother: () => void
}) {
  const t = useTranslations('ContactPage')

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert role="status" className="[&>svg]:size-5">
        <CircleCheck aria-hidden="true" className="text-primary" />
        <AlertTitle className="line-clamp-none text-base font-bold">
          {t('success.title')}
        </AlertTitle>
        <AlertDescription className="text-foreground text-base">
          {t('success.message', {email})}
        </AlertDescription>
      </Alert>
      <Button
        type="button"
        variant="outline"
        onClick={onWriteAnother}
        className="h-14 w-full text-base sm:h-12 sm:w-auto"
      >
        {t('success.cta')}
      </Button>
    </div>
  )
}
