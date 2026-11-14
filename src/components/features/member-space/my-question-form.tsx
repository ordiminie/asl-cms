'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {type MouseEvent, type Ref, useEffect, useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {
  createMyQuestionFormSchema,
  MY_QUESTION_FORM_FIELDS,
  type MyQuestionFormField,
  type MyQuestionFormSchemaType,
  type MyQuestionFormState,
} from '@/app/[locale]/(app)/dashboard/question/question-form-validation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Textarea} from '@/components/ui/textarea'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import {
  MEMBER_QUESTION_BODY_MAX_LENGTH,
  type MyQuestionIdentityDTO,
} from '@/services/types/domain/member-question-types'

export type MyQuestionFormAction = (
  state: MyQuestionFormState,
  formData: FormData
) => Promise<MyQuestionFormState>

const EMPTY_VALUES: MyQuestionFormSchemaType = {categoryId: '', body: ''}

const fieldAnchorOf = (field: MyQuestionFormField) =>
  `my-question-field-${field}`

const FIELD_MESSAGE_CLASS = 'text-base font-medium'
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'
const LABEL_CLASS = 'text-base font-medium'

const toFormData = (values: MyQuestionFormSchemaType, locale: string) => {
  const formData = new FormData()
  formData.set('locale', locale)
  for (const field of MY_QUESTION_FORM_FIELDS) {
    formData.set(field, values[field] ?? '')
  }
  return formData
}

/**
 * « Poser une question au bureau » (s23, ecran B) : un sujet et un texte,
 * **aucun champ d'identite** — le bloc « Ce que le bureau recoit » montre le
 * nom et l'email de la fiche, transmis par le serveur. Le succes renvoie a
 * l'espace membre (A2) ; l'echec technique garde le texte saisi (B3).
 */
export function MyQuestionForm({
  categories,
  identity,
  action,
}: {
  categories: PublicCategoryDTO[]
  identity: MyQuestionIdentityDTO
  action: MyQuestionFormAction
}) {
  const t = useTranslations('MemberQuestionPage')
  const locale = useLocale()
  const form = useForm<MyQuestionFormSchemaType>({
    resolver: zodResolver(
      createMyQuestionFormSchema(
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
  const bodyLength = useWatch({control: form.control, name: 'body'}).length
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryRequest, setSummaryRequest] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus()
  }, [summaryRequest])

  const showSummary = () => setSummaryRequest((count) => count + 1)

  const onValid = async (values: MyQuestionFormSchemaType) => {
    setFailed(false)
    try {
      const result: MyQuestionFormState | undefined = await action(
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

  const invalidFields = MY_QUESTION_FORM_FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })

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
              errors={invalidFields}
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
                <FormDescription className="text-base">
                  {t('fields.categoryId.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="body"
            render={({field}) => (
              <FormItem id={fieldAnchorOf('body')}>
                <FormLabel className={LABEL_CLASS}>
                  {t('fields.body.label')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    className={`min-h-36 resize-y text-[17px] ${FIELD_INVALID_CLASS}`}
                    {...field}
                  />
                </FormControl>
                <p className="text-muted-foreground text-right text-[14px] tabular-nums">
                  {t('fields.body.counter', {
                    count: bodyLength,
                    max: MEMBER_QUESTION_BODY_MAX_LENGTH,
                  })}
                </p>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />

          <QuestionIdentity identity={identity} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              <SubmitLabel pending={isSubmitting} />
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full text-base sm:h-12 sm:w-auto"
            >
              <Link href="/dashboard">{t('cancel')}</Link>
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  )
}

/**
 * Les deux libelles superposes : la largeur du bouton est celle du plus long,
 * l'etat `disabled` du composant dit l'envoi en cours (B3).
 */
function SubmitLabel({pending}: {pending: boolean}) {
  const t = useTranslations('MemberQuestionPage.submit')

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

/** « Ce que le bureau recoit » (B1) : le nom et l'email de la fiche, en `meta`. */
function QuestionIdentity({identity}: {identity: MyQuestionIdentityDTO}) {
  const t = useTranslations('MemberQuestionPage.identity')
  const values = [identity.name, identity.email ?? t('noEmail')]

  return (
    <div className="flex flex-col gap-1 border-t pt-6">
      <p className="text-base">{t('intro')}</p>
      <p className="text-muted-foreground text-[15px]">{values.join(' · ')}</p>
    </div>
  )
}

function ErrorSummary({
  ref,
  errors,
  onFocusField,
}: {
  ref: Ref<HTMLDivElement>
  errors: {field: MyQuestionFormField; message: string}[]
  onFocusField: (field: MyQuestionFormField) => void
}) {
  const t = useTranslations('MemberQuestionPage.summary')

  const focusField =
    (field: MyQuestionFormField) => (event: MouseEvent<HTMLAnchorElement>) => {
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
        {t('title', {count: errors.length})}
      </AlertTitle>
      <AlertDescription className="text-foreground text-base">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {errors.map(({field, message}) => (
            <li key={field}>
              <a
                href={`#${fieldAnchorOf(field)}`}
                onClick={focusField(field)}
                className="text-destructive-text underline underline-offset-4"
              >
                {message}
              </a>
            </li>
          ))}
        </ul>
        <p>{t('kept')}</p>
      </AlertDescription>
    </Alert>
  )
}
