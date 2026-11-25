'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {CircleAlert, CircleCheck, Trash2} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState, useTransition} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {RestrictedMarkdownEditor} from '@/components/features/pages/blocks/restricted-markdown-editor'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
  DOCUMENT_TEMPLATE_VARIABLES,
  DocumentTemplateDTO,
  DocumentTemplateField,
} from '@/services/types/domain/document-template-types'

import {
  createDocumentTemplateFormSchema,
  DOCUMENT_TEMPLATE_FORM_FIELDS,
  DOCUMENT_TEMPLATE_MAX_LENGTHS,
  type DocumentTemplateFormState,
  type DocumentTemplateFormValues,
  templateIssueMessageOf,
  templateIssueSummaryOf,
} from './document-template-form-validation'
import {
  DOCUMENT_TEMPLATES_PATH,
  documentLotPathOf,
} from './document-template-paths'

export type DocumentTemplateSaveAction = (
  state: DocumentTemplateFormState,
  formData: FormData
) => Promise<DocumentTemplateFormState>

export type DocumentTemplateDeleteAction = (
  templateId: string
) => Promise<DocumentTemplateFormState>

const FIELD_IDS: Record<DocumentTemplateField, string> = {
  name: 'document-template-name',
  subject: 'document-template-subject',
  bodyMarkdown: 'document-template-body',
}

const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

const toFormData = (
  values: DocumentTemplateFormValues,
  templateId?: string
): FormData => {
  const formData = new FormData()
  if (templateId) formData.set('templateId', templateId)
  formData.set('name', values.name.trim())
  formData.set('subject', values.subject.trim())
  formData.set('bodyMarkdown', values.bodyMarkdown.trim())
  return formData
}

type DocumentTemplateFormProps = {
  /** Le modele edite ; absent pour un nouveau modele. */
  template?: DocumentTemplateDTO
  /** Le modele vient d'etre enregistre (2d). */
  saved?: boolean
  saveAction: DocumentTemplateSaveAction
  deleteAction?: DocumentTemplateDeleteAction
}

/**
 * L'editeur d'un modele (ecran 2 de s36) : nom interne, objet imprime, texte
 * en Markdown restreint et la liste des variables. Le serveur refuse une
 * variable inconnue (critere 4) : le resume ancre la nomme, focus porte
 * dessus, et le texte reste dans le champ.
 */
export function DocumentTemplateForm({
  template,
  saved = false,
  saveAction,
  deleteAction,
}: DocumentTemplateFormProps) {
  const t = useTranslations('DocumentTemplatesBureau.editor')
  const title = template?.name ?? t('newTitle')

  return (
    <div className="mx-auto flex w-full max-w-[76ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={DOCUMENT_TEMPLATES_PATH}>
                {t('breadcrumb.parent')}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {template?.name ?? t('breadcrumb.new')}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {title}
      </h1>

      {saved && template && <SavedNotice templateId={template.id} />}

      <TemplateFields
        template={template}
        saveAction={saveAction}
        deleteAction={deleteAction}
      />
    </div>
  )
}

/** 2d : le succes ancre en tete, et le lot avec ce modele. */
function SavedNotice({templateId}: {templateId: string}) {
  const t = useTranslations('DocumentTemplatesBureau.editor.saved')

  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertTitle className="text-[15px] whitespace-normal">
        {t('title')}
      </AlertTitle>
      <AlertDescription className="text-foreground">
        <p>{t('description')}</p>
        <Link
          href={documentLotPathOf(templateId)}
          className="underline underline-offset-4"
        >
          {t('lot')}
        </Link>
      </AlertDescription>
    </Alert>
  )
}

function TemplateFields({
  template,
  saveAction,
  deleteAction,
}: {
  template?: DocumentTemplateDTO
  saveAction: DocumentTemplateSaveAction
  deleteAction?: DocumentTemplateDeleteAction
}) {
  const t = useTranslations('DocumentTemplatesBureau.editor')
  const form = useForm<DocumentTemplateFormValues>({
    resolver: zodResolver(createDocumentTemplateFormSchema(t)),
    defaultValues: {
      name: template?.name ?? '',
      subject: template?.subject ?? '',
      bodyMarkdown: template?.bodyMarkdown ?? '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const [failure, setFailure] = useState<string>()
  const [summaries, setSummaries] = useState<
    Partial<Record<DocumentTemplateField, string>>
  >({})
  const [focusRequest, setFocusRequest] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const name = useWatch({control: form.control, name: 'name'})
  const subject = useWatch({control: form.control, name: 'subject'})

  useEffect(() => {
    if (focusRequest > 0) summaryRef.current?.focus()
  }, [focusRequest])

  const requestFocus = () => setFocusRequest((count) => count + 1)

  const onValid = async (values: DocumentTemplateFormValues) => {
    setFailure(undefined)
    setSummaries({})
    try {
      const result = await saveAction(
        {status: 'idle'},
        toFormData(values, template?.id)
      )
      if (result.status === 'rejected') {
        const nextSummaries: Partial<Record<DocumentTemplateField, string>> = {}
        for (const field of DOCUMENT_TEMPLATE_FORM_FIELDS) {
          const issue = result.issues[field]
          if (!issue) continue
          form.setError(field, {
            message: templateIssueMessageOf(t, field, issue),
          })
          nextSummaries[field] = templateIssueSummaryOf(t, field, issue)
        }
        setSummaries(nextSummaries)
        requestFocus()
      } else if (result.status === 'error') {
        setFailure(result.message)
        requestFocus()
      }
    } catch (caught) {
      if (isNavigationSignal(caught)) throw caught
      setFailure(t('failed'))
      requestFocus()
    }
  }

  const invalidFields = DOCUMENT_TEMPLATE_FORM_FIELDS.flatMap((field) => {
    const message = summaries[field] ?? errors[field]?.message
    return message ? [{field, message}] : []
  })

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={form.handleSubmit(onValid, requestFocus)}
      >
        {(invalidFields.length > 0 || failure) && (
          <Alert
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            variant="destructive"
            className="border-destructive border-2"
          >
            <CircleAlert strokeWidth={1.75} />
            <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
              {t('errorSummaryTitle')}
            </AlertTitle>
            <AlertDescription className="text-foreground">
              <p>{t('errorSummaryDescription')}</p>
              {invalidFields.length > 0 ? (
                <ul className="flex list-none flex-col gap-1">
                  {invalidFields.map(({field, message}) => (
                    <li key={field}>
                      <a
                        href={`#${FIELD_IDS[field]}`}
                        className="text-destructive-text underline underline-offset-4"
                      >
                        {message}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{failure}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="gap-8 px-4 py-6 shadow-none sm:px-6">
          {(['name', 'subject'] as const).map((field) => (
            <FormField
              key={field}
              control={form.control}
              name={field}
              render={({field: input}) => (
                <FormItem>
                  <FormLabel htmlFor={FIELD_IDS[field]} className="text-base">
                    {t(`${field}Label`)}
                  </FormLabel>
                  <FormControl>
                    <Input
                      id={FIELD_IDS[field]}
                      className="aria-invalid:border-2"
                      {...input}
                    />
                  </FormControl>
                  <FormDescription className="text-[14px]">
                    {t(`${field}Help`)}
                  </FormDescription>
                  <p className="text-muted-foreground text-right text-[14px] tabular-nums">
                    {t('counter', {
                      count: (field === 'name' ? name : subject).length,
                      max: DOCUMENT_TEMPLATE_MAX_LENGTHS[field],
                    })}
                  </p>
                  <FormMessage className={FIELD_MESSAGE_CLASS} />
                </FormItem>
              )}
            />
          ))}

          <FormField
            control={form.control}
            name="bodyMarkdown"
            render={({field}) => (
              <div
                id={FIELD_IDS.bodyMarkdown}
                className={
                  errors.bodyMarkdown
                    ? 'border-destructive flex flex-col gap-2 rounded-md border-2 p-3'
                    : 'flex flex-col gap-2'
                }
              >
                <RestrictedMarkdownEditor
                  value={field.value}
                  label={t('bodyLabel')}
                  onChange={field.onChange}
                />
                {errors.bodyMarkdown?.message && (
                  <p className={FIELD_MESSAGE_CLASS}>
                    {errors.bodyMarkdown.message}
                  </p>
                )}
              </div>
            )}
          />

          <TemplateVariables />
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-65"
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          {template && deleteAction && (
            <DeleteTemplateDialog
              templateId={template.id}
              name={template.name}
              action={deleteAction}
            />
          )}
        </div>
      </form>
    </Form>
  )
}

/** Les variables d'un document, forme du composeur de campagne (s25). */
function TemplateVariables() {
  const t = useTranslations('DocumentTemplatesBureau')

  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <p className="font-semibold">{t('editor.variablesTitle')}</p>
      <dl className="grid grid-cols-1 gap-y-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        {DOCUMENT_TEMPLATE_VARIABLES.map((variable) => (
          <div key={variable} className="contents">
            <dt className="font-mono">{`{${variable}}`}</dt>
            <dd className="text-muted-foreground">
              {t(`variables.${variable}`)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground">{t('editor.variablesNote')}</p>
    </div>
  )
}

/** 2e : la suppression, confirmee ; les documents deposes restent figes. */
function DeleteTemplateDialog({
  templateId,
  name,
  action,
}: {
  templateId: string
  name: string
  action: DocumentTemplateDeleteAction
}) {
  const t = useTranslations('DocumentTemplatesBureau.editor.delete')
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      const result = await action(templateId)
      if (result.status === 'error') setFailure(result.message)
    })

  return (
    <AlertDialog onOpenChange={(open) => open && setFailure(null)}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto"
        >
          <Trash2 aria-hidden="true" />
          {t('trigger')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title', {name})}</AlertDialogTitle>
          <AlertDialogDescription className="text-[17px]">
            {t('description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure && (
          <p role="alert" className="text-destructive-text text-[15px]">
            {failure}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-14 sm:h-11">
            {t('cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="h-14 sm:h-11"
            disabled={pending}
            onClick={confirm}
          >
            {t('confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
