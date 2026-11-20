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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {cn} from '@/lib/utils'
import {finalSubject} from '@/services/rules/campaign-rules'
import {
  CAMPAIGN_PREHEADER_MAX,
  CAMPAIGN_TARGET_KINDS,
  CAMPAIGN_TEMPLATE_IDS,
  CAMPAIGN_VARIABLES,
  type CampaignComposerContextDTO,
  type CampaignFormField,
  type CampaignNature,
  type CampaignPlanDTO,
  type CampaignPreviewDTO,
  type CampaignTarget,
  type CampaignTargetActionResult,
  type CampaignTargetCountsDTO,
  type CampaignTargetKind,
  type CampaignTemplateId,
  type PreviewCampaignActionResult,
  type SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'
import {
  type CampaignFormValues,
  createCampaignFormSchema,
} from '@/services/validation/campaign-validation'

import {RECIPIENT_GROUPS_PATH} from '../recipient-groups/recipient-group-paths'
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
  /**
   * Relit le decompte d'une autre cible (s27) ou d'un autre modele : le
   * modele porte la nature de l'envoi (s27b).
   */
  targetAction: (
    target: CampaignTarget,
    templateId: CampaignTemplateId
  ) => Promise<CampaignTargetActionResult>
}

/** Le decompte de la cible choisie, tel que la carte « Destinataires » le lit. */
type TargetReading =
  | {status: 'loading'}
  | Exclude<CampaignTargetActionResult, {status: 'error'}>
  | {status: 'error'; message: string}
  | {status: 'no_group'}

/** Les champs de la cible, tels que les actions les lisent (s27). */
const targetFieldsOf = (target: CampaignTarget): Record<string, string> =>
  target.kind === 'group'
    ? {targetKind: target.kind, targetGroupId: target.groupId}
    : {targetKind: target.kind}

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
  targetAction,
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
  const [targetKind, setTargetKind] =
    useState<CampaignTargetKind>('all_members')
  const [groupId, setGroupId] = useState(context.groups[0]?.id ?? '')
  const [reading, setReading] = useState<TargetReading>({
    status: 'ok',
    counts: context.counts,
    reachableMembers: context.reachableMembers,
  })
  const readingRequest = useRef(0)

  const target: CampaignTarget =
    targetKind === 'group' ? {kind: 'group', groupId} : {kind: targetKind}

  /**
   * Le decompte de la cible pour le modele : celui du contexte vaut pour
   * « tous » a la meme nature que lui ; sinon il est relu (s27, s27b).
   */
  const readTarget = async (
    next: CampaignTarget,
    nextTemplateId: CampaignTemplateId
  ) => {
    const request = ++readingRequest.current
    if (
      next.kind === 'all_members' &&
      context.templateNatures[nextTemplateId] === context.counts.nature
    ) {
      setReading({
        status: 'ok',
        counts: context.counts,
        reachableMembers: context.reachableMembers,
      })
      return
    }
    if (next.kind === 'group' && !next.groupId) {
      setReading({status: 'no_group'})
      return
    }
    setReading({status: 'loading'})
    const result = await targetAction(next, nextTemplateId)
    if (request === readingRequest.current) setReading(result)
  }

  const chooseTargetKind = (next: CampaignTargetKind) => {
    setTargetKind(next)
    void readTarget(
      next === 'group' ? {kind: next, groupId} : {kind: next},
      form.getValues('templateId') as CampaignTemplateId
    )
  }

  const chooseGroup = (next: string) => {
    setGroupId(next)
    void readTarget(
      {kind: 'group', groupId: next},
      form.getValues('templateId') as CampaignTemplateId
    )
  }

  /** Le modele change : le decompte suit sa nature (s27b). */
  const setTemplate = (id: CampaignTemplateId) => {
    const previous = form.getValues('templateId') as CampaignTemplateId
    form.setValue('templateId', id)
    if (context.templateNatures[previous] !== context.templateNatures[id]) {
      void readTarget(target, id)
    }
  }

  const targetContext: CampaignComposerContextDTO =
    reading.status === 'ok'
      ? {
          ...context,
          counts: reading.counts,
          reachableMembers: reading.reachableMembers,
        }
      : context

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
      formDataOf(form.getValues(), {
        ...targetFieldsOf(target),
        ...(memberProfileId ? {memberProfileId} : {}),
      })
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
    setTemplate(id)
    form.setValue('subject', model.subject, {shouldValidate: submitFailed})
    form.setValue('preheader', model.preheader, {shouldValidate: submitFailed})
    form.setValue('bodyMarkdown', model.body, {shouldValidate: submitFailed})
    setApplied(true)
  }

  const chooseTemplate = (next: string) => {
    const id = next as CampaignTemplateId
    if (id === 'free') {
      setTemplate(id)
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
        context={targetContext}
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
            formDataOf(form.getValues(), {
              ...targetFieldsOf(target),
              submissionId,
            })
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
          natures={context.templateNatures}
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

        <RecipientsCard
          targetKind={targetKind}
          groupId={groupId}
          groups={context.groups}
          reading={reading}
          onChangeKind={chooseTargetKind}
          onChangeGroup={chooseGroup}
        />

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

/**
 * « Modele » : chaque choix dit son usage, puis sa nature lue dans les
 * reglages (s27b, design system §3.14) — aucun controle pour la changer.
 */
function TemplateCard({
  value,
  natures,
  applied,
  onChange,
}: {
  value: CampaignTemplateId
  natures: Record<CampaignTemplateId, CampaignNature>
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
              aria-describedby={`${fieldId}-${id}-usage ${fieldId}-${id}-nature`}
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
              <p
                id={`${fieldId}-${id}-nature`}
                className="text-muted-foreground text-[14px]"
              >
                {t(`templateNatures.${natures[id]}`)}
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

type RecipientsCardProps = {
  targetKind: CampaignTargetKind
  groupId: string
  groups: CampaignComposerContextDTO['groups']
  reading: TargetReading
  onChangeKind: (kind: CampaignTargetKind) => void
  onChangeGroup: (groupId: string) => void
}

/**
 * « Destinataires » (ecran 1 de s27) : le choix de la cible, puis son
 * decompte en fiches, puis en adresses. « Un groupe » revele le choix du
 * groupe sous l'option (gap 2 du design, retenu au plan).
 */
function RecipientsCard({
  targetKind,
  groupId,
  groups,
  reading,
  onChangeKind,
  onChangeGroup,
}: RecipientsCardProps) {
  const t = useTranslations('CampaignsBureau.composer.recipients')
  const fieldId = useId()

  return (
    <SectionCard title={t('title')}>
      <p id={`${fieldId}-legend`} className="text-[17px] font-semibold">
        {t('legend')}
      </p>
      <RadioGroup
        value={targetKind}
        onValueChange={(value) => onChangeKind(value as CampaignTargetKind)}
        aria-labelledby={`${fieldId}-legend`}
        className="gap-3"
      >
        {CAMPAIGN_TARGET_KINDS.map((kind) => (
          <div key={kind} className="flex items-start gap-3">
            <RadioGroupItem
              value={kind}
              id={`${fieldId}-${kind}`}
              aria-describedby={`${fieldId}-${kind}-help`}
              className="mt-1 size-5"
            />
            <div className="flex flex-col">
              <Label htmlFor={`${fieldId}-${kind}`} className="text-[17px]">
                {t(`targets.${kind}.label`)}
              </Label>
              <p
                id={`${fieldId}-${kind}-help`}
                className="text-muted-foreground text-[15px]"
              >
                {t(`targets.${kind}.help`)}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
      {targetKind === 'group' && (
        <GroupChoice
          groupId={groupId}
          groups={groups}
          onChange={onChangeGroup}
        />
      )}
      <TargetReadingView reading={reading} targetKind={targetKind} />
    </SectionCard>
  )
}

function GroupChoice({
  groupId,
  groups,
  onChange,
}: {
  groupId: string
  groups: CampaignComposerContextDTO['groups']
  onChange: (groupId: string) => void
}) {
  const t = useTranslations('CampaignsBureau.composer.recipients')
  const fieldId = useId()

  if (groups.length === 0) {
    return (
      <p className="text-[17px] sm:pl-12">
        {t('noGroup')}{' '}
        <Link href={RECIPIENT_GROUPS_PATH} className="text-primary underline">
          {t('createGroup')}
        </Link>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 sm:pl-12">
      <Label htmlFor={fieldId} className="text-[17px]">
        {t('group')}
      </Label>
      <Select value={groupId} onValueChange={onChange}>
        <SelectTrigger id={fieldId} className="h-14 w-full sm:h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {t('groupOption', {name: group.name, count: group.profileCount})}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link
        href={RECIPIENT_GROUPS_PATH}
        className="text-primary text-[15px] underline"
      >
        {t('manageGroups')}
      </Link>
    </div>
  )
}

function TargetReadingView({
  reading,
  targetKind,
}: {
  reading: TargetReading
  targetKind: CampaignTargetKind
}) {
  const t = useTranslations('CampaignsBureau.composer.recipients')

  if (reading.status === 'no_group') return null
  if (reading.status === 'error') {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle className="text-[15px] whitespace-normal">
          {reading.message}
        </AlertTitle>
      </Alert>
    )
  }
  const counts = reading.status === 'ok' ? reading.counts : null
  const figure = (
    key: Exclude<keyof CampaignTargetCountsDTO, 'nature'>
  ): ReactNode =>
    counts ? counts[key] : <Skeleton className="ml-auto h-6 w-10" />
  const statutory = counts?.nature === 'statutaire'

  return (
    <>
      <RecipientCounts
        label={t('profiles')}
        rows={[
          [t('profilesWithEmail'), figure('profilesWithEmail')],
          [
            t('profilesWithoutEmail'),
            figure('profilesWithoutEmail'),
            t('profilesWithoutEmailNote'),
          ],
        ]}
        total={[t('profilesTotal'), figure('profiles')]}
      />
      <RecipientCounts
        label={t('addresses')}
        rows={[
          [t('recipients'), figure('recipients'), t('recipientsNote')],
          statutory
            ? [t('unsubscribed'), figure('reinstated'), t('reinstatedNote')]
            : [
                t('unsubscribed'),
                figure('unsubscribed'),
                t('unsubscribedNote'),
              ],
        ]}
      />
      {counts && counts.recipients === 0 && (
        <p className="text-destructive-text text-[15px] font-medium">
          {targetKind === 'unpaid_members' && counts.profiles === 0
            ? t('noneUnpaid')
            : t('none')}
        </p>
      )}
    </>
  )
}

function RecipientCounts({
  label,
  rows,
  total,
}: {
  label: string
  rows: [string, ReactNode, string?][]
  total?: [string, ReactNode]
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[13px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-[17px]">
        {rows.map(([rowLabel, value, note]) => (
          <div key={rowLabel} className="contents">
            <dt>
              {rowLabel}
              {note && (
                <span className="text-muted-foreground block text-[15px]">
                  {note}
                </span>
              )}
            </dt>
            <dd className="text-right font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
        {total && (
          <>
            <div className="border-border col-span-2 border-t" />
            <dt>{total[0]}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {total[1]}
            </dd>
          </>
        )}
      </dl>
    </div>
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
