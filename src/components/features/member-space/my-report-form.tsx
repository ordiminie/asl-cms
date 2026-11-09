'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {type MouseEvent, type Ref, useEffect, useRef, useState} from 'react'
import {useForm} from 'react-hook-form'

import {
  createMyReportFormSchema,
  MY_REPORT_FORM_FIELDS,
  type MyReportFormField,
  type MyReportFormSchemaType,
  type MyReportFormState,
} from '@/app/[locale]/(app)/dashboard/signaler/my-report-form-validation'
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
import type {MyReportIdentityDTO} from '@/services/types/domain/incident-report-types'

import {MY_CONTACT_ANCHOR} from './my-contact-card'

export type MyReportFormAction = (
  state: MyReportFormState,
  formData: FormData
) => Promise<MyReportFormState>

const EMPTY_VALUES: MyReportFormSchemaType = {
  categoryId: '',
  location: '',
  description: '',
}

const fieldAnchorOf = (field: MyReportFormField) => `my-report-field-${field}`

const FIELD_MESSAGE_CLASS = 'text-base font-medium'
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'
const LABEL_CLASS = 'text-base font-medium'

const toFormData = (values: MyReportFormSchemaType, locale: string) => {
  const formData = new FormData()
  formData.set('locale', locale)
  for (const field of MY_REPORT_FORM_FIELDS) {
    formData.set(field, values[field] ?? '')
  }
  return formData
}

/**
 * Formulaire de declaration du membre connecte (s22, ecran B). Les champs,
 * l'aide et les messages sont ceux du formulaire public (s10) ; **aucun champ
 * d'identite** : le bloc « Ce que le bureau recoit » montre les coordonnees
 * de la fiche, transmises par le serveur. Le succes renvoie a l'espace
 * membre (etat A5) ; l'echec technique garde le texte saisi (B4).
 */
export function MyReportForm({
  categories,
  identity,
  action,
}: {
  categories: PublicCategoryDTO[]
  identity: MyReportIdentityDTO
  action: MyReportFormAction
}) {
  const t = useTranslations('ReportPage')
  const locale = useLocale()
  const withCategory = categories.length > 0
  const form = useForm<MyReportFormSchemaType>({
    resolver: zodResolver(
      createMyReportFormSchema(
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

  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus()
  }, [summaryRequest])

  const showSummary = () => setSummaryRequest((count) => count + 1)

  const onValid = async (values: MyReportFormSchemaType) => {
    setFailed(false)
    try {
      const result: MyReportFormState | undefined = await action(
        {status: 'idle'},
        toFormData(values, locale)
      )
      if (result?.status === 'invalid') {
        for (const error of result.errors) {
          form.setError(error.field, {message: error.message})
        }
        showSummary()
      } else if (result?.status === 'failed') {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
  }

  const invalidFields = MY_REPORT_FORM_FIELDS.filter((field) => errors[field])

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
                    className={`min-h-36 resize-y text-[17px] ${FIELD_INVALID_CLASS}`}
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

          <ReportedIdentity identity={identity} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              <SubmitLabel pending={isSubmitting} />
            </Button>
            <CancelButton />
          </div>
        </form>
      </Form>
    </Card>
  )
}

/**
 * Les deux libelles superposes (gap B3) : la largeur du bouton est celle du
 * plus long, l'etat `disabled` du composant dit l'envoi en cours.
 */
function SubmitLabel({pending}: {pending: boolean}) {
  const t = useTranslations('ReportPage.submit')

  return (
    <span className="grid">
      <span
        aria-hidden={pending}
        className={`[grid-area:1/1] ${pending ? 'invisible' : ''}`}
      >
        {t('idle')}
      </span>
      <span
        aria-hidden={!pending}
        className={`[grid-area:1/1] ${pending ? '' : 'invisible'}`}
      >
        {t('pending')}
      </span>
    </span>
  )
}

function CancelButton() {
  const t = useTranslations('MemberReportPage')

  return (
    <Button
      asChild
      variant="outline"
      className="h-14 w-full text-base sm:h-12 sm:w-auto"
    >
      <Link href="/dashboard">{t('cancel')}</Link>
    </Button>
  )
}

/**
 * « Ce que le bureau recoit » (B1, B6) : les coordonnees de la fiche, en
 * `meta`. Sans telephone, la phrase ne l'annonce pas et propose de l'ajouter.
 */
function ReportedIdentity({identity}: {identity: MyReportIdentityDTO}) {
  const t = useTranslations('MemberReportPage.identity')
  const values = [
    identity.name,
    identity.email,
    identity.phone ?? t('noPhone'),
  ].filter((value): value is string => Boolean(value))

  return (
    <div className="flex flex-col gap-1 border-t pt-6">
      <p className="text-base">
        {identity.phone ? t('intro') : t('introWithoutPhone')}
      </p>
      <p className="text-muted-foreground text-[15px]">{values.join(' · ')}</p>
      {!identity.phone && (
        <Button asChild variant="link" className="h-12 self-start px-0">
          <Link href={`/dashboard#${MY_CONTACT_ANCHOR}`}>{t('addPhone')}</Link>
        </Button>
      )}
    </div>
  )
}

function ErrorSummary({
  ref,
  fields,
  onFocusField,
}: {
  ref: Ref<HTMLDivElement>
  fields: MyReportFormField[]
  onFocusField: (field: MyReportFormField) => void
}) {
  const t = useTranslations('ReportPage')

  const focusField =
    (field: MyReportFormField) => (event: MouseEvent<HTMLAnchorElement>) => {
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
