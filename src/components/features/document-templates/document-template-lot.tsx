'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleAlert, CircleCheck, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {z} from 'zod'

import {MEMBER_DOCUMENTS_PATH} from '@/components/features/member-documents/member-document-paths'
import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'
import {RECIPIENT_GROUPS_PATH} from '@/components/features/recipient-groups/recipient-group-paths'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
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
import {Progress} from '@/components/ui/progress'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import {
  CAMPAIGN_TARGET_KINDS,
  type CampaignTargetKind,
} from '@/services/types/domain/campaign-types'
import type {
  DocumentLotLineResult,
  DocumentLotProfileDTO,
  DocumentLotReachDTO,
  DocumentLotReachResult,
  DocumentLotTarget,
} from '@/services/types/domain/document-template-types'
import {MEMBER_DOCUMENT_TITLE_MAX_LENGTH} from '@/services/types/domain/member-document-types'
import type {RecipientGroupDTO} from '@/services/types/domain/recipient-group-types'

import {DOCUMENT_TEMPLATES_PATH} from './document-template-paths'

export type DocumentLotReachAction = (
  target: DocumentLotTarget
) => Promise<DocumentLotReachResult>

export type DocumentLotDepositAction = (
  formData: FormData
) => Promise<DocumentLotLineResult>

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

const DATA_CLASS = 'font-mono font-medium tabular-nums'
const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'

const FIELD_IDS = {
  templateId: 'document-lot-template',
  targetKind: 'document-lot-target',
  groupId: 'document-lot-group',
  documentDate: 'document-lot-date',
  categoryId: 'document-lot-category',
  title: 'document-lot-title',
} as const

type LotField = keyof typeof FIELD_IDS
const LOT_FIELDS = Object.keys(FIELD_IDS) as LotField[]

const lotSchemaOf = (t: Translate, categoryIds: readonly string[]) =>
  z
    .object({
      templateId: z.string().min(1, t('issues.templateMissing')),
      targetKind: z.string().min(1, t('issues.targetMissing')),
      groupId: z.string(),
      documentDate: z
        .string()
        .refine((value) => frenchDateToIso(value) !== undefined, {
          message: t('issues.dateInvalid'),
        }),
      categoryId: z.string().refine((value) => categoryIds.includes(value), {
        message: t('issues.categoryMissing'),
      }),
      title: z
        .string()
        .refine((value) => value.trim() !== '', {
          message: t('issues.titleMissing'),
        })
        .refine(
          (value) => value.trim().length <= MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
          {
            message: t('issues.titleTooLong', {
              max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
            }),
          }
        ),
    })
    .superRefine((values, context) => {
      if (values.targetKind === 'group' && values.groupId === '') {
        context.addIssue({
          code: 'custom',
          path: ['groupId'],
          message: t('issues.groupMissing'),
        })
      }
    })

type LotValues = z.infer<ReturnType<typeof lotSchemaOf>>

type Reach =
  | {kind: 'none'}
  | {kind: 'loading'}
  | {kind: 'ready'; reach: DocumentLotReachDTO}
  | {kind: 'error'; message: string}

type ReportLine = {
  profile: DocumentLotProfileDTO
  result: DocumentLotLineResult
}

type Phase =
  | {kind: 'form'}
  | {kind: 'running'; done: number; total: number; current: string}
  | {kind: 'done'}
  | {kind: 'interrupted'; at: number; total: number; remaining: number}

const targetOf = (kind: string, groupId: string): DocumentLotTarget | null => {
  if (kind === 'all_members' || kind === 'unpaid_members') return {kind}
  if (kind === 'group' && groupId !== '') return {kind: 'group', groupId}
  return null
}

/** Les echecs d'abord, dans l'ordre d'envoi ; puis les deposes. */
const reportOrderOf = (lines: readonly ReportLine[]): ReportLine[] => [
  ...lines.filter((line) => line.result.status !== 'deposited'),
  ...lines.filter((line) => line.result.status === 'deposited'),
]

/** Retient le depart de la page pendant le lot seulement (§3.19). */
function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const retain = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', retain)
    return () => window.removeEventListener('beforeunload', retain)
  }, [active])
}

type DocumentTemplateLotProps = {
  templates: {id: string; name: string}[]
  /** Le modele de `?modele=`, s'il est un modele du tenant. */
  preselectedTemplateId?: string
  groups: RecipientGroupDTO[]
  categories: PublicCategoryDTO[]
  /** Le jour calendaire de Paris, ISO : la date proposee. */
  today: string
  reachAction: DocumentLotReachAction
  depositAction: DocumentLotDepositAction
}

/**
 * « Generer en lot » (ecran 4 de s36, critere 3). La cible est lue une fois ;
 * le navigateur envoie ensuite **un appel par fiche**, l'un apres l'autre,
 * chacun produisant et deposant un document. Pas de reprise : le rapport dit
 * ce qui est fait, et n'est pas conserve.
 */
export function DocumentTemplateLot(props: DocumentTemplateLotProps) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
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
            <BreadcrumbPage>{t('breadcrumb.current')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
      </h1>

      <Alert role="note" className="bg-muted">
        <Info aria-hidden="true" />
        <AlertDescription className="text-foreground text-base">
          {t('rule')}
        </AlertDescription>
      </Alert>

      <LotRun {...props} />
    </div>
  )
}

function LotRun({
  templates,
  preselectedTemplateId,
  groups,
  categories,
  today,
  reachAction,
  depositAction,
}: DocumentTemplateLotProps) {
  const t = useTranslations('DocumentTemplatesBureau.lot')
  const form = useForm<LotValues>({
    resolver: zodResolver(
      lotSchemaOf(
        t,
        categories.map((category) => category.id)
      )
    ),
    defaultValues: {
      templateId: preselectedTemplateId ?? '',
      targetKind: '',
      groupId: '',
      documentDate: isoToFrenchDate(today),
      categoryId: '',
      title: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, submitCount} = form.formState
  const [reach, setReach] = useState<Reach>({kind: 'none'})
  const [lines, setLines] = useState<ReportLine[]>([])
  const [phase, setPhase] = useState<Phase>({kind: 'form'})
  const [focusRequest, setFocusRequest] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const reachRequest = useRef(0)
  const [targetKind, groupId, templateId, categoryId, documentDate] = useWatch({
    control: form.control,
    name: ['targetKind', 'groupId', 'templateId', 'categoryId', 'documentDate'],
  })
  const running = phase.kind === 'running'

  useLeaveGuard(running)

  useEffect(() => {
    if (focusRequest > 0) summaryRef.current?.focus()
  }, [focusRequest])

  const readReach = async (target: DocumentLotTarget | null) => {
    const request = ++reachRequest.current
    if (!target) {
      setReach({kind: 'none'})
      return
    }
    setReach({kind: 'loading'})
    const result = await reachAction(target).catch(
      (): DocumentLotReachResult => ({
        status: 'error',
        message: t('reachErrors.failed'),
      })
    )
    if (request !== reachRequest.current) return
    setReach(
      result.status === 'ready'
        ? {kind: 'ready', reach: result.reach}
        : {kind: 'error', message: result.message}
    )
  }

  const chooseTarget = (kind: string) => {
    form.setValue('targetKind', kind, {shouldValidate: submitCount > 0})
    void readReach(targetOf(kind, form.getValues('groupId')))
  }

  const chooseGroup = (id: string) => {
    form.setValue('groupId', id, {shouldValidate: submitCount > 0})
    void readReach(targetOf('group', id))
  }

  const requestFocus = () => setFocusRequest((count) => count + 1)

  const run = async (values: LotValues, profiles: DocumentLotProfileDTO[]) => {
    const total = profiles.length
    const isoDate = frenchDateToIso(values.documentDate) ?? ''
    const served: ReportLine[] = []
    setLines([])

    for (const [index, profile] of profiles.entries()) {
      setPhase({kind: 'running', done: index, total, current: profile.name})
      const formData = new FormData()
      formData.set('templateId', values.templateId)
      formData.set('memberProfileId', profile.id)
      formData.set('documentDate', isoDate)
      formData.set('categoryId', values.categoryId)
      formData.set('title', values.title.trim())

      let result: DocumentLotLineResult
      try {
        result = await depositAction(formData)
      } catch {
        setPhase({
          kind: 'interrupted',
          at: index + 1,
          total,
          remaining: total - index,
        })
        requestFocus()
        return
      }
      served.push({profile, result})
      setLines([...served])
    }
    setPhase({kind: 'done'})
  }

  const onValid = async (values: LotValues) => {
    if (reach.kind !== 'ready') {
      form.setError('targetKind', {message: t('issues.targetUnavailable')})
      requestFocus()
      return
    }
    if (reach.reach.total === 0) {
      form.setError('targetKind', {message: t('issues.targetEmpty')})
      requestFocus()
      return
    }
    await run(values, reach.reach.profiles)
  }

  const invalidFields = LOT_FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })
  const count = reach.kind === 'ready' ? reach.reach.total : null
  const finished = phase.kind === 'done' || phase.kind === 'interrupted'

  return (
    <>
      {!finished && (
        <form
          noValidate
          className="flex flex-col gap-8"
          onSubmit={form.handleSubmit(onValid, requestFocus)}
        >
          {invalidFields.length > 0 && (
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
              </AlertDescription>
            </Alert>
          )}

          <fieldset disabled={running} className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.templateId} className="text-base">
                {t('templateLabel')}
              </Label>
              <Select
                value={templateId || undefined}
                onValueChange={(value) =>
                  form.setValue('templateId', value, {
                    shouldValidate: submitCount > 0,
                  })
                }
                disabled={running}
              >
                <SelectTrigger
                  id={FIELD_IDS.templateId}
                  aria-invalid={errors.templateId ? true : undefined}
                  className="aria-invalid:border-2"
                >
                  <SelectValue placeholder={t('templatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem
                      key={template.id}
                      value={template.id}
                      className="text-[17px]"
                    >
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.templateId?.message && (
                <p className={FIELD_MESSAGE_CLASS}>
                  {errors.templateId.message}
                </p>
              )}
            </div>

            <TargetChoice
              targetKind={targetKind}
              groupId={groupId}
              groups={groups}
              disabled={running}
              targetError={errors.targetKind?.message}
              groupError={errors.groupId?.message}
              onTarget={chooseTarget}
              onGroup={chooseGroup}
            />

            <ReachCounter reach={reach} targetKind={targetKind} />

            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.documentDate} className="text-base">
                {t('dateLabel')}
              </Label>
              <p
                id={`${FIELD_IDS.documentDate}-help`}
                className="text-muted-foreground text-[14px]"
              >
                {t('dateHelp', {variable: '{date}'})}
              </p>
              <DateField
                id={FIELD_IDS.documentDate}
                value={documentDate}
                onValueChange={(value) =>
                  form.setValue('documentDate', value, {
                    shouldValidate: submitCount > 0,
                  })
                }
                disabled={running}
                placeholder={t('dateFormat')}
                aria-describedby={`${FIELD_IDS.documentDate}-help`}
                error={errors.documentDate?.message}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.categoryId} className="text-base">
                {t('categoryLabel')}
              </Label>
              <Select
                value={categoryId || undefined}
                onValueChange={(value) =>
                  form.setValue('categoryId', value, {
                    shouldValidate: submitCount > 0,
                  })
                }
                disabled={running}
              >
                <SelectTrigger
                  id={FIELD_IDS.categoryId}
                  aria-invalid={errors.categoryId ? true : undefined}
                  className="aria-invalid:border-2"
                >
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
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
              {errors.categoryId?.message && (
                <p className={FIELD_MESSAGE_CLASS}>
                  {errors.categoryId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.title} className="text-base">
                {t('titleLabel')}
              </Label>
              <Input
                id={FIELD_IDS.title}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={`${FIELD_IDS.title}-help`}
                className="aria-invalid:border-2"
                {...form.register('title')}
              />
              <p
                id={`${FIELD_IDS.title}-help`}
                className="text-muted-foreground text-[14px]"
              >
                {t('titleHelp')}
              </p>
              {errors.title?.message && (
                <p className={FIELD_MESSAGE_CLASS}>{errors.title.message}</p>
              )}
            </div>
          </fieldset>

          <p className="text-muted-foreground text-[15px]">
            {t('relaunchWarning')}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="submit"
              disabled={running}
              className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-65"
            >
              {running
                ? t('running')
                : count === null || count === 0
                  ? t('submitUnknown')
                  : t('submit', {count})}
            </Button>
            {!running && (
              <Button
                asChild
                variant="outline"
                className="h-14 w-full sm:h-12 sm:w-auto"
              >
                <Link href={DOCUMENT_TEMPLATES_PATH}>{t('cancel')}</Link>
              </Button>
            )}
          </div>
        </form>
      )}

      {phase.kind === 'running' && <LotProgress phase={phase} />}

      {phase.kind === 'interrupted' && (
        <Alert
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          variant="destructive"
          className="border-destructive border-2"
        >
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
            {t('interruptedTitle', {at: phase.at, total: phase.total})}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {t('interruptedDescription', {
              deposited: lines.filter(
                (line) => line.result.status === 'deposited'
              ).length,
              remaining: phase.remaining,
            })}
          </AlertDescription>
        </Alert>
      )}

      {phase.kind === 'done' && <LotDone lines={lines} />}

      {lines.length > 0 && <LotReport lines={lines} />}

      {finished && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
            <Link href={DOCUMENT_TEMPLATES_PATH}>{t('backToTemplates')}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full sm:h-12 sm:w-auto"
          >
            <Link href={MEMBER_DOCUMENTS_PATH}>{t('memberDocuments')}</Link>
          </Button>
        </div>
      )}
    </>
  )
}

/** « Pour qui ? » : les trois cibles de s27, « Un groupe » revele son choix. */
function TargetChoice({
  targetKind,
  groupId,
  groups,
  disabled,
  targetError,
  groupError,
  onTarget,
  onGroup,
}: {
  targetKind: string
  groupId: string
  groups: RecipientGroupDTO[]
  disabled: boolean
  targetError?: string
  groupError?: string
  onTarget: (kind: string) => void
  onGroup: (groupId: string) => void
}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  return (
    <fieldset id={FIELD_IDS.targetKind} className="flex flex-col gap-3">
      <legend className="mb-2 text-base font-medium">
        {t('targetLegend')}
      </legend>
      <RadioGroup
        value={targetKind}
        onValueChange={onTarget}
        disabled={disabled}
        className="flex flex-col gap-4"
      >
        {CAMPAIGN_TARGET_KINDS.map((kind: CampaignTargetKind) => (
          <div key={kind} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem
                id={`document-lot-target-${kind}`}
                value={kind}
                aria-describedby={`document-lot-target-${kind}-help`}
                className="mt-1"
              />
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`document-lot-target-${kind}`}
                  className="text-base"
                >
                  {t(`targets.${kind}.label`)}
                </Label>
                <p
                  id={`document-lot-target-${kind}-help`}
                  className="text-muted-foreground text-[14px]"
                >
                  {t(`targets.${kind}.help`)}
                </p>
              </div>
            </div>
            {kind === 'group' && targetKind === 'group' && (
              <div className="flex flex-col gap-2 sm:pl-12">
                <Label htmlFor={FIELD_IDS.groupId} className="text-base">
                  {t('groupLabel')}
                </Label>
                <Select
                  value={groupId || undefined}
                  onValueChange={onGroup}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={FIELD_IDS.groupId}
                    aria-invalid={groupError ? true : undefined}
                    className="aria-invalid:border-2"
                  >
                    <SelectValue placeholder={t('groupPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                        className="text-[17px]"
                      >
                        {t('groupOption', {
                          name: group.name,
                          count: group.profileCount,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {groupError && (
                  <p className={FIELD_MESSAGE_CLASS}>{groupError}</p>
                )}
                <Link
                  href={RECIPIENT_GROUPS_PATH}
                  className="text-[15px] underline underline-offset-4"
                >
                  {t('manageGroups')}
                </Link>
              </div>
            )}
          </div>
        ))}
      </RadioGroup>
      {targetError && <p className={FIELD_MESSAGE_CLASS}>{targetError}</p>}
    </fieldset>
  )
}

/** Le decompte en fiches (§3.13) ; `skeleton` sur les nombres pendant la lecture. */
function ReachCounter({reach, targetKind}: {reach: Reach; targetKind: string}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  if (reach.kind === 'none') return null
  if (reach.kind === 'error') {
    return (
      <Alert role="alert" variant="destructive" className="border-2">
        <CircleAlert strokeWidth={1.75} />
        <AlertDescription className="text-foreground">
          {reach.message}
        </AlertDescription>
      </Alert>
    )
  }

  const values =
    reach.kind === 'ready'
      ? [
          ['profiles', reach.reach.total],
          ['withoutParcel', reach.reach.withoutCurrentParcel],
          ['documents', reach.reach.total],
        ]
      : [
          ['profiles', null],
          ['withoutParcel', null],
          ['documents', null],
        ]

  return (
    <div className="flex flex-col gap-3">
      <dl
        role="group"
        aria-label={t('counter.label')}
        aria-busy={reach.kind === 'loading' ? true : undefined}
        className="flex flex-wrap gap-6"
      >
        {values.map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-muted-foreground text-[15px]">
              {t(`counter.${key}`)}
            </dt>
            <dd className={`${DATA_CLASS} text-2xl`}>
              {value === null ? <Skeleton className="h-8 w-12" /> : value}
            </dd>
          </div>
        ))}
      </dl>
      {reach.kind === 'ready' &&
        reach.reach.total === 0 &&
        (CAMPAIGN_TARGET_KINDS as readonly string[]).includes(targetKind) && (
          <Alert role="note" className="bg-muted">
            <Info aria-hidden="true" />
            <AlertDescription className="text-foreground">
              {t(`empty.${targetKind}`)}
            </AlertDescription>
          </Alert>
        )}
    </div>
  )
}

/** 4b : barre determinee, sans pourcentage ; la phrase porte le decompte. */
function LotProgress({phase}: {phase: Extract<Phase, {kind: 'running'}>}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  return (
    <div className="flex flex-col gap-3">
      <Alert
        role="note"
        className="border-warning-border bg-warning text-warning-foreground"
      >
        <AlertTriangle aria-hidden="true" />
        <AlertTitle className="line-clamp-none">{t('stayTitle')}</AlertTitle>
        <AlertDescription className="text-warning-foreground text-base">
          {t('stayDescription')}
        </AlertDescription>
      </Alert>
      <Progress
        value={(phase.done / phase.total) * 100}
        aria-label={t('progressLabel')}
      />
      <p aria-live="polite" className="text-[15px]">
        {t('progress', {done: phase.done, total: phase.total})}
      </p>
      <p className="text-muted-foreground text-[15px]">
        {t('current', {name: phase.current})}
      </p>
    </div>
  )
}

/** 4c : le bilan, qui est le succes du lot. */
function LotDone({lines}: {lines: ReportLine[]}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')
  const deposited = lines.filter(
    (line) => line.result.status === 'deposited'
  ).length
  const failed = lines.length - deposited

  return (
    <div className="flex flex-col gap-6">
      <Alert role="status">
        <CircleCheck aria-hidden="true" className="text-primary" />
        <AlertTitle className="text-[15px] whitespace-normal">
          {t('done', {deposited, failed})}
        </AlertTitle>
        <AlertDescription className="text-foreground">
          {t('doneDescription')}
        </AlertDescription>
      </Alert>
      <dl className="flex flex-wrap gap-6">
        {(
          [
            ['deposited', deposited],
            ['failed', failed],
            ['total', lines.length],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-muted-foreground text-[15px]">
              {t(`result.${key}`)}
            </dt>
            <dd className={`${DATA_CLASS} text-2xl`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-[15px]">{t('notKept')}</p>
    </div>
  )
}

/** Le rapport ligne a ligne, echecs en tete. */
function LotReport({lines}: {lines: ReportLine[]}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')
  const ordered = reportOrderOf(lines)

  return (
    <>
      <div className="hidden sm:block">
        <Table aria-label={t('reportCaption')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.profile')}</TableHead>
              <TableHead>{t('columns.result')}</TableHead>
              <TableHead>{t('columns.target')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((line) => (
              <TableRow key={line.profile.id} className="h-14">
                <TableCell className="whitespace-normal">
                  <ProfileLink profile={line.profile} />
                </TableCell>
                <TableCell>
                  <ResultBadge line={line} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <LineDetail line={line} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-4 sm:hidden">
        {ordered.map((line) => (
          <li key={line.profile.id}>
            <Card className="gap-3 px-4 py-4 shadow-none">
              <ProfileLink profile={line.profile} />
              <ResultBadge line={line} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                <dt className="text-muted-foreground">
                  {line.result.status === 'deposited'
                    ? t('terrainLabel')
                    : t('reasonLabel')}
                </dt>
                <dd>
                  <LineDetail line={line} />
                </dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

function ProfileLink({profile}: {profile: DocumentLotProfileDTO}) {
  return (
    <Link
      href={memberProfilePathOf(profile.id)}
      className="font-semibold underline underline-offset-4"
    >
      {profile.name}
    </Link>
  )
}

function ResultBadge({line}: {line: ReportLine}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  return line.result.status === 'deposited' ? (
    <Badge variant="outline" className="text-muted-foreground">
      {t('resultDeposited')}
    </Badge>
  ) : (
    <Badge variant="destructive">{t('resultFailed')}</Badge>
  )
}

/** La raison ecrite d'un echec ; pour un depot, une fiche sans parcelle le dit. */
function LineDetail({line}: {line: ReportLine}) {
  const t = useTranslations('DocumentTemplatesBureau.lot')

  if (line.result.status === 'failed') return <>{line.result.reason}</>
  return line.profile.hasCurrentParcel ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="text-muted-foreground">{t('noParcel')}</span>
  )
}
