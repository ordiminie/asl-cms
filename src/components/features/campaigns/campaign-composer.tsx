'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {RestrictedMarkdownEditor} from '@/components/features/pages/blocks/restricted-markdown-editor'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {Skeleton} from '@/components/ui/skeleton'
import {cn} from '@/lib/utils'
import {finalSubject} from '@/services/rules/campaign-rules'
import {
  CAMPAIGN_PREHEADER_MAX,
  CAMPAIGN_TEMPLATE_IDS,
  CAMPAIGN_VARIABLES,
  type CampaignComposerContextDTO,
  type CampaignFormField,
  type CampaignPlanDTO,
  type CampaignPreviewDTO,
  type CampaignTemplateId,
  type PreviewCampaignActionResult,
  type SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'
import {
  type CampaignFormValues,
  createCampaignFormSchema,
} from '@/services/validation/campaign-validation'

import {CAMPAIGNS_PATH} from './campaign-paths'
import {CampaignPreviewStep} from './campaign-preview-step'

type ModelId = Exclude<CampaignTemplateId, 'free'>

/** Le contenu des quatre modeles, lu **brut** dans `messages/fr.json`. */
export type CampaignTemplates = Record<
  ModelId,
  {subject: string; preheader: string; body: string}
>

type CampaignComposerProps = {
  context: CampaignComposerContextDTO
  templates: CampaignTemplates
  previewAction: (
    state: PreviewCampaignActionResult | undefined,
    formData: FormData
  ) => Promise<PreviewCampaignActionResult>
  sendAction: (
    state: SendCampaignActionResult | undefined,
    formData: FormData
  ) => Promise<SendCampaignActionResult>
}

const FIELD_ORDER: CampaignFormField[] = [
  'templateId',
  'subject',
  'preheader',
  'bodyMarkdown',
]

const EMPTY_VALUES: CampaignFormValues = {
  templateId: 'free',
  subject: '',
  preheader: '',
  bodyMarkdown: '',
}

const VARIABLE_PLACEHOLDERS = Object.fromEntries(
  CAMPAIGN_VARIABLES.map((variable) => [variable, `{${variable}}`])
)

type ComposeNotice =
  | {kind: 'unknown_variables'; variables: string[]}
  | {kind: 'no_recipient'}
  | {kind: 'failed'; message: string}

/** Le formulaire en `FormData`, avec ce que l'action attend en plus. */
const formDataOf = (
  values: CampaignFormValues,
  extra: Record<string, string> = {}
): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries({...values, ...extra})) {
    formData.set(key, value)
  }
  return formData
}

/**
 * Le composeur de campagne (ecrans 2 et 3 du design s25). L'apercu est la
 * **deuxieme etape du meme ecran** (ecart 1 du plan) : aucun brouillon n'est
 * enregistre, la saisie vit dans le formulaire et survit a « Modifier le
 * message ». « Voir l'apercu » reste toujours actif : l'erreur arrive au
 * clic (§3.10). Le `submissionId` est tire a l'ouverture : un double envoi
 * retrouve la meme campagne (ADR 051).
 */
export function CampaignComposer({
  context,
  templates,
  previewAction,
  sendAction,
}: CampaignComposerProps) {
  const t = useTranslations('CampaignsBureau')
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(
      createCampaignFormSchema(t, context.subjectMaxLength)
    ),
    defaultValues: EMPTY_VALUES,
    reValidateMode: 'onChange',
  })
  const [submissionId] = useState(() => crypto.randomUUID())
  const [step, setStep] = useState<'compose' | 'preview'>('compose')
  const [preview, setPreview] = useState<CampaignPreviewDTO | null>(null)
  const [plan, setPlan] = useState<CampaignPlanDTO | null>(null)
  const [notice, setNotice] = useState<ComposeNotice | null>(null)
  const [submitFailed, setSubmitFailed] = useState(false)
  const [applied, setApplied] = useState(false)
  const [pendingModel, setPendingModel] = useState<ModelId | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const values = useWatch({control: form.control}) as CampaignFormValues
  const templateId = values.templateId as CampaignTemplateId

  const backToCompose = (next: ComposeNotice | null) => {
    setNotice(next)
    setStep('compose')
    setPreview(null)
    requestAnimationFrame(() => noticeRef.current?.focus())
  }

  const applyServerErrors = (
    errors: {field: CampaignFormField; message: string}[]
  ) => {
    for (const error of errors) {
      form.setError(error.field, {message: error.message})
    }
    setSubmitFailed(true)
    backToCompose(null)
  }

  const requestPreview = async (memberProfileId?: string) => {
    setStep('preview')
    setPreview(null)
    const result = await previewAction(
      undefined,
      formDataOf(form.getValues(), memberProfileId ? {memberProfileId} : {})
    )
    if (result.status === 'ok') {
      setNotice(null)
      setPreview(result.preview)
      setPlan(result.plan)
      return
    }
    if (result.status === 'invalid') return applyServerErrors(result.errors)
    if (result.status === 'unknown_variables') {
      return backToCompose({
        kind: 'unknown_variables',
        variables: result.variables,
      })
    }
    if (result.status === 'no_recipient') {
      return backToCompose({kind: 'no_recipient'})
    }
    backToCompose({kind: 'failed', message: result.message})
  }

  const applyModel = (id: ModelId) => {
    const model = templates[id]
    form.setValue('templateId', id)
    form.setValue('subject', model.subject, {shouldValidate: submitFailed})
    form.setValue('preheader', model.preheader, {shouldValidate: submitFailed})
    form.setValue('bodyMarkdown', model.body, {shouldValidate: submitFailed})
    setApplied(true)
  }

  const chooseTemplate = (next: string) => {
    const id = next as CampaignTemplateId
    if (id === 'free') {
      form.setValue('templateId', id)
      setApplied(false)
      return
    }
    const hasText =
      form.getValues('subject').trim() !== '' ||
      form.getValues('bodyMarkdown').trim() !== ''
    if (hasText) setPendingModel(id)
    else applyModel(id)
  }

  const onValid = () => {
    setSubmitFailed(false)
    void requestPreview()
  }

  if (step === 'preview') {
    return (
      <CampaignPreviewStep
        context={context}
        preview={preview}
        plan={plan}
        values={values}
        provisional={templateId !== 'free'}
        onChangeMember={(memberProfileId) =>
          void requestPreview(memberProfileId)
        }
        onEdit={() => backToCompose(null)}
        onSend={async () => {
          const result = await sendAction(
            undefined,
            formDataOf(form.getValues(), {submissionId})
          )
          if (result.status === 'invalid') applyServerErrors(result.errors)
          if (result.status === 'unknown_variables') {
            backToCompose({
              kind: 'unknown_variables',
              variables: result.variables,
            })
          }
          if (result.status === 'no_recipient') {
            backToCompose({kind: 'no_recipient'})
          }
          return result
        }}
      />
    )
  }

  const errors = FIELD_ORDER.flatMap((field) => {
    const message = form.formState.errors[field]?.message
    return message ? [{field, message}] : []
  })

  return (
    <ComposerFrame>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('composer.title')}
      </h1>

      <div
        ref={noticeRef}
        tabIndex={-1}
        className="flex flex-col gap-4 outline-none"
      >
        {submitFailed && errors.length > 0 && <ErrorSummary errors={errors} />}
        {notice && <ComposeNoticeAlert notice={notice} />}
      </div>

      <form
        noValidate
        onSubmit={(event) =>
          void form.handleSubmit(onValid, () => setSubmitFailed(true))(event)
        }
        className="flex flex-col gap-6"
      >
        <TemplateCard
          value={templateId}
          applied={applied && templateId !== 'free'}
          onChange={chooseTemplate}
        />

        <MessageCard
          context={context}
          values={values}
          errors={submitFailed ? form.formState.errors : {}}
          onChange={(field, value) => {
            form.setValue(field, value, {shouldValidate: submitFailed})
            if (field !== 'preheader') setApplied(false)
          }}
        />

        <RecipientsCard context={context} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="h-14 w-full sm:h-11 sm:w-auto">
            {t('composer.preview')}
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto"
          >
            <Link href={CAMPAIGNS_PATH}>{t('composer.cancel')}</Link>
          </Button>
        </div>
      </form>

      <AlertDialog
        open={pendingModel !== null}
        onOpenChange={(open) => !open && setPendingModel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('composer.template.replaceTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[17px]">
              {t('composer.template.replaceDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-14 sm:h-11">
              {t('composer.template.keep')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-14 sm:h-11"
              onClick={() => {
                if (pendingModel) applyModel(pendingModel)
                setPendingModel(null)
              }}
            >
              {t('composer.template.replace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComposerFrame>
  )
}

/** Fil d'Ariane et colonne de 720 px, partages par les deux etapes. */
export function ComposerFrame({
  preview = false,
  children,
}: {
  preview?: boolean
  children: ReactNode
}) {
  const t = useTranslations('CampaignsBureau.breadcrumb')

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={CAMPAIGNS_PATH}>{t('list')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {preview ? t('new') : <BreadcrumbPage>{t('new')}</BreadcrumbPage>}
          </BreadcrumbItem>
          {preview && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('preview')}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </div>
  )
}

function ErrorSummary({
  errors,
}: {
  errors: {field: CampaignFormField; message: string}[]
}) {
  const t = useTranslations('CampaignsBureau.composer')

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {t('errorSummary', {count: errors.length})}
      </AlertTitle>
      <AlertDescription className="text-[15px]">
        <ul className="list-disc pl-5">
          {errors.map((error) => (
            <li key={error.field}>
              {t('errorItem', {
                field: t(`fieldNames.${error.field}`),
                message: error.message,
              })}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function ComposeNoticeAlert({notice}: {notice: ComposeNotice}) {
  const t = useTranslations('CampaignsBureau')

  if (notice.kind === 'unknown_variables') {
    return <UnknownVariablesAlert variables={notice.variables} />
  }

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {notice.kind === 'no_recipient'
          ? t('composer.noRecipientAlert')
          : notice.message}
      </AlertTitle>
    </Alert>
  )
}

/** « Variable inconnue : {parcele}. » (etat e), signalee avant tout envoi. */
export function UnknownVariablesAlert({variables}: {variables: string[]}) {
  const t = useTranslations('CampaignsBureau.composer')

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {t('unknownVariableTitle', {
          variables: variables.map((name) => `{${name}}`).join(', '),
        })}
      </AlertTitle>
      <AlertDescription className="text-[15px]">
        {t('unknownVariableDescription', VARIABLE_PLACEHOLDERS)}
      </AlertDescription>
    </Alert>
  )
}

/** « Texte provisoire » d'un modele (gap 3 du design), ecrans 2 et 3. */
export function ProvisionalAlert() {
  const t = useTranslations('CampaignsBureau.composer.template')

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground border-2 [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-[15px]">
        <p>
          <strong>{t('provisional')}</strong> {t('provisionalDescription')}
        </p>
      </AlertDescription>
    </Alert>
  )
}

function SectionCard({title, children}: {title: string; children: ReactNode}) {
  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <h2 className="font-serif text-[24px] leading-snug font-semibold">
        {title}
      </h2>
      {children}
    </Card>
  )
}

function TemplateCard({
  value,
  applied,
  onChange,
}: {
  value: CampaignTemplateId
  applied: boolean
  onChange: (value: string) => void
}) {
  const t = useTranslations('CampaignsBureau')
  const fieldId = useId()

  return (
    <SectionCard title={t('composer.template.title')}>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        aria-label={t('composer.template.legend')}
        className="gap-3"
      >
        {CAMPAIGN_TEMPLATE_IDS.map((id) => (
          <div key={id} className="flex items-start gap-3">
            <RadioGroupItem
              value={id}
              id={`${fieldId}-${id}`}
              aria-describedby={`${fieldId}-${id}-usage`}
              className="mt-1 size-5"
            />
            <div className="flex flex-col">
              <Label htmlFor={`${fieldId}-${id}`} className="text-[17px]">
                {t(`templateNames.${id}`)}
              </Label>
              <p
                id={`${fieldId}-${id}-usage`}
                className="text-muted-foreground text-[15px]"
              >
                {t(`templateUsages.${id}`)}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
      {value !== 'free' && <ProvisionalAlert />}
      {applied && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertTitle className="text-[15px] whitespace-normal">
            {t('composer.template.applied')}
          </AlertTitle>
        </Alert>
      )}
    </SectionCard>
  )
}

function CountedInput({
  id,
  label,
  help,
  value,
  max,
  error,
  onChange,
}: {
  id: string
  label: string
  help: string
  value: string
  max: number
  error?: string
  onChange: (value: string) => void
}) {
  const t = useTranslations('CampaignsBureau.composer.message')
  const over = value.length > max

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[17px]">
        {label}
      </Label>
      <p id={`${id}-help`} className="text-muted-foreground text-[15px]">
        {help}
      </p>
      <Input
        id={id}
        value={value}
        aria-invalid={over || error ? true : undefined}
        aria-describedby={`${id}-help ${id}-counter`}
        className={cn(
          'h-14 text-[18px] sm:h-11 sm:text-[17px]',
          (over || error) && 'border-destructive border-2'
        )}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex items-start justify-between gap-3 text-[14px]">
        <p className="text-destructive-text font-medium">{error}</p>
        <p
          id={`${id}-counter`}
          className={cn(
            'tabular-nums',
            over ? 'text-destructive-text font-medium' : 'text-muted-foreground'
          )}
        >
          {t('counter', {count: value.length, max})}
        </p>
      </div>
    </div>
  )
}

function MessageCard({
  context,
  values,
  errors,
  onChange,
}: {
  context: CampaignComposerContextDTO
  values: CampaignFormValues
  errors: Partial<Record<CampaignFormField, {message?: string}>>
  onChange: (
    field: 'subject' | 'preheader' | 'bodyMarkdown',
    value: string
  ) => void
}) {
  const t = useTranslations('CampaignsBureau.composer.message')
  const fieldId = useId()

  return (
    <SectionCard title={t('title')}>
      <CountedInput
        id={`${fieldId}-subject`}
        label={t('subject')}
        help={t('subjectHelp', {
          prefix: finalSubject(context.associationName, ''),
        })}
        value={values.subject}
        max={context.subjectMaxLength}
        error={errors.subject?.message}
        onChange={(value) => onChange('subject', value)}
      />
      <CountedInput
        id={`${fieldId}-preheader`}
        label={t('preheader')}
        help={t('preheaderHelp')}
        value={values.preheader}
        max={CAMPAIGN_PREHEADER_MAX}
        error={errors.preheader?.message}
        onChange={(value) => onChange('preheader', value)}
      />
      <div className="flex flex-col gap-2">
        <RestrictedMarkdownEditor
          value={values.bodyMarkdown}
          label={t('body')}
          onChange={(value) => onChange('bodyMarkdown', value)}
        />
        {errors.bodyMarkdown?.message && (
          <p className="text-destructive-text text-[14px] font-medium">
            {errors.bodyMarkdown.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 text-[15px]">
        <p className="font-semibold">{t('variablesTitle')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {CAMPAIGN_VARIABLES.map((variable) => (
            <div key={variable} className="contents">
              <dt className="font-mono">{VARIABLE_PLACEHOLDERS[variable]}</dt>
              <dd className="text-muted-foreground">
                {t(`variables.${variable}`)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground">{t('variablesNote')}</p>
      </div>
      <p className="text-muted-foreground text-[15px]">
        {context.replyTo
          ? t('replyTo', {email: context.replyTo})
          : t('noReplyTo')}
      </p>
    </SectionCard>
  )
}

function RecipientsCard({context}: {context: CampaignComposerContextDTO}) {
  const t = useTranslations('CampaignsBureau.composer.recipients')
  const {counts} = context

  return (
    <SectionCard title={t('title')}>
      <p className="text-[17px] font-semibold">{t('target')}</p>
      <RecipientCounts
        rows={[
          [t('reachable'), counts.recipients],
          [t('withoutEmail'), counts.withoutEmail, t('withoutEmailNote')],
          [t('unsubscribed'), counts.unsubscribed],
        ]}
        totalLabel={t('total')}
        total={counts.total}
      />
      {counts.recipients === 0 && (
        <p className="text-destructive-text text-[15px] font-medium">
          {t('none')}
        </p>
      )}
    </SectionCard>
  )
}

function RecipientCounts({
  rows,
  totalLabel,
  total,
}: {
  rows: [string, number | ReactNode, string?][]
  totalLabel: string
  total: number | ReactNode
}) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-[17px]">
      {rows.map(([label, value, note]) => (
        <div key={label} className="contents">
          <dt>
            {label}
            {note && (
              <span className="text-muted-foreground block text-[15px]">
                {note}
              </span>
            )}
          </dt>
          <dd className="text-right font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
      <div className="border-border col-span-2 border-t" />
      <dt>{totalLabel}</dt>
      <dd className="text-right font-semibold tabular-nums">{total}</dd>
    </dl>
  )
}

/** Le composeur en chargement : le decompte se lit encore (etat i). */
export function CampaignComposerSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
      <Card className="gap-3 px-4 py-6 shadow-none sm:px-6">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-6 w-full" />
        ))}
      </Card>
    </div>
  )
}
