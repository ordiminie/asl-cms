'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleAlert, CircleCheck, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useEffect, useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {z} from 'zod'

import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
} from '@/components/features/member-profile/member-profile-paths'
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
import {FileUpload} from '@/components/ui/file-upload'
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
import {Label} from '@/components/ui/label'
import {Progress} from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import type {MemberDocumentBatchReachDTO} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {NoCategoryNotice} from './member-document-form'
import {
  MEMBER_DOCUMENT_MAX_BYTES,
  MEMBER_DOCUMENT_MAX_MEGABYTES,
  MEMBER_DOCUMENT_PDF_TYPE,
  type MemberDocumentBatchLineActionResult,
  memberDocumentCommonFieldsOf,
} from './member-document-form-validation'
import {MemberDocumentParcels} from './member-document-parcels'
import {MEMBER_DOCUMENTS_PATH} from './member-document-paths'

export type MemberDocumentBatchAction = (
  formData: FormData
) => Promise<MemberDocumentBatchLineActionResult>

const DATA_CLASS = 'font-mono font-medium tabular-nums'
const FILE_NAMES_SHOWN = 5

const FIELD_IDS = {
  title: 'member-document-batch-title',
  categoryId: 'member-document-batch-category',
  documentDate: 'member-document-batch-date',
  files: 'member-document-batch-files',
} as const

type BatchField = keyof typeof FIELD_IDS
const BATCH_FIELDS: readonly BatchField[] = [
  'title',
  'categoryId',
  'documentDate',
  'files',
]

const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'

const data = (chunks: ReactNode) => <span className={DATA_CLASS}>{chunks}</span>

/** Une ligne du rapport : le resultat du serveur, avec le poids du fichier. */
type ReportLine = MemberDocumentBatchLineActionResult & {fileBytes: number}

type Progression = {done: number; total: number; current?: string}

const createBatchSchema = (
  t: (key: string, values?: Record<string, string | number>) => string,
  categoryIds: readonly string[],
  formT: (key: string, values?: Record<string, string | number>) => string
) =>
  z.object({
    ...memberDocumentCommonFieldsOf(formT, categoryIds),
    files: z.array(z.custom<File>()).min(1, {message: t('filesMissing')}),
  })

type BatchValues = z.infer<ReturnType<typeof createBatchSchema>>

/** Les ecartes d'abord, dans l'ordre d'envoi ; puis les deposes. */
const reportOrderOf = (lines: readonly ReportLine[]): ReportLine[] => [
  ...lines.filter((line) => line.status !== 'deposited'),
  ...lines.filter((line) => line.status === 'deposited'),
]

/**
 * « Deposer en lot » (design s32, ecran 5, critere 7). Le navigateur envoie
 * **un fichier par appel**, l'un apres l'autre ; le serveur seul rapproche
 * chaque fichier de sa fiche, et le rapport reprend ses reponses telles
 * quelles. Le rapport est ephemere : il n'est ni conserve ni journalise.
 */
export function MemberDocumentBatch({
  categories,
  today,
  reach,
  batchAction,
}: {
  categories: PublicCategoryDTO[]
  /** Le jour calendaire de Paris, ISO : la date proposee au lot. */
  today: string
  reach: MemberDocumentBatchReachDTO
  batchAction: MemberDocumentBatchAction
}) {
  const t = useTranslations('BureauMemberDocuments.batch')

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={MEMBER_DOCUMENTS_PATH}>{t('breadcrumb.parent')}</Link>
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

      {reach.profilesWithReference === 0 ? (
        <Alert className="bg-muted">
          <Info aria-hidden="true" />
          <AlertTitle className="line-clamp-none">
            {t('noReachable.title')}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {t('noReachable.description')}
          </AlertDescription>
        </Alert>
      ) : categories.length === 0 ? (
        <NoCategoryNotice />
      ) : (
        <BatchRun
          categories={categories}
          today={today}
          reach={reach}
          batchAction={batchAction}
        />
      )}
    </div>
  )
}

function BatchRun({
  categories,
  today,
  reach,
  batchAction,
}: {
  categories: PublicCategoryDTO[]
  today: string
  reach: MemberDocumentBatchReachDTO
  batchAction: MemberDocumentBatchAction
}) {
  const t = useTranslations('BureauMemberDocuments.batch')
  const formT = useTranslations('BureauMemberDocuments.form')
  const [lines, setLines] = useState<ReportLine[]>([])
  const [progression, setProgression] = useState<Progression | null>(null)
  const [finished, setFinished] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const sending = progression !== null && !finished

  useLeaveGuard(sending)

  const restart = () => {
    setLines([])
    setProgression(null)
    setFinished(false)
    setRunKey((key) => key + 1)
  }

  const send = async (values: BatchValues) => {
    const total = values.files.length
    const documentDate = frenchDateToIso(values.documentDate) ?? ''
    setLines([])
    setFinished(false)
    setProgression({done: 0, total, current: values.files[0]?.name})

    for (const [index, file] of values.files.entries()) {
      setProgression({done: index, total, current: file.name})
      const formData = new FormData()
      formData.set('title', values.title.trim())
      formData.set('categoryId', values.categoryId)
      formData.set('documentDate', documentDate)
      formData.set('file', file)

      let result: MemberDocumentBatchLineActionResult
      try {
        result = await batchAction(formData)
      } catch {
        result = {
          status: 'error',
          fileName: file.name,
          message: t('reasons.failed'),
        }
      }
      setLines((previous) => [...previous, {...result, fileBytes: file.size}])
    }

    setProgression({done: total, total})
    setFinished(true)
  }

  return (
    <>
      <Alert role="note" className="bg-muted">
        <Info aria-hidden="true" />
        <AlertDescription className="text-foreground text-base">
          {t.rich('rule', {data})}
        </AlertDescription>
      </Alert>

      {!finished && (
        <BatchForm
          key={runKey}
          categories={categories}
          today={today}
          sending={sending}
          onSend={send}
          formT={formT}
        />
      )}

      {sending && progression && <BatchProgress progression={progression} />}

      {finished && (
        <BatchDone
          lines={lines}
          onRestart={restart}
          profilesWithoutReference={reach.profilesWithoutReference}
        />
      )}

      {sending && lines.length > 0 && <BatchReport lines={lines} />}
    </>
  )
}

/** Retient le depart de la page pendant l'envoi (manque n° 2 du design). */
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

function BatchForm({
  categories,
  today,
  sending,
  onSend,
  formT,
}: {
  categories: PublicCategoryDTO[]
  today: string
  sending: boolean
  onSend: (values: BatchValues) => Promise<void>
  formT: ReturnType<typeof useTranslations>
}) {
  const t = useTranslations('BureauMemberDocuments.batch')
  const form = useForm<BatchValues>({
    resolver: zodResolver(
      createBatchSchema(
        t,
        categories.map((category) => category.id),
        formT
      )
    ),
    defaultValues: {
      title: '',
      categoryId: '',
      documentDate: isoToFrenchDate(today),
      files: [],
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, submitCount} = form.formState
  const files = useWatch({control: form.control, name: 'files'})
  const fileInput = useRef<HTMLInputElement>(null)

  const chooseFiles = (chosen: File[]) =>
    form.setValue('files', chosen, {shouldValidate: submitCount > 0})

  const invalidFields = BATCH_FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={form.handleSubmit(onSend)}
      >
        {invalidFields.length > 0 && (
          <Alert
            role="alert"
            variant="destructive"
            className="border-destructive border-2"
          >
            <CircleAlert strokeWidth={1.75} />
            <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
              {t('errorSummaryTitle')}
            </AlertTitle>
            <AlertDescription className="text-foreground">
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

        <FormField
          control={form.control}
          name="title"
          render={({field}) => (
            <FormItem>
              <FormLabel htmlFor={FIELD_IDS.title} className="text-base">
                {t('titleLabel')}
              </FormLabel>
              <FormControl>
                <Input
                  id={FIELD_IDS.title}
                  className="aria-invalid:border-2"
                  disabled={sending}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[14px]">
                {t('titleHelp')}
              </FormDescription>
              <FormMessage className={FIELD_MESSAGE_CLASS} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({field}) => (
            <FormItem>
              <FormLabel htmlFor={FIELD_IDS.categoryId} className="text-base">
                {formT('categoryLabel')}
              </FormLabel>
              <Select
                value={field.value === '' ? undefined : field.value}
                onValueChange={field.onChange}
                disabled={sending}
              >
                <FormControl>
                  <SelectTrigger
                    id={FIELD_IDS.categoryId}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    className="aria-invalid:border-2"
                  >
                    <SelectValue placeholder={formT('categoryPlaceholder')} />
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

        <FormField
          control={form.control}
          name="documentDate"
          render={({field}) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.documentDate} className="text-base">
                {formT('dateLabel')}
              </Label>
              <DateField
                id={FIELD_IDS.documentDate}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                disabled={sending}
                placeholder={formT('dateFormat')}
                error={errors.documentDate?.message}
              />
            </div>
          )}
        />

        <div className="flex flex-col gap-3">
          <label htmlFor={FIELD_IDS.files} className="text-base font-medium">
            {t('filesLabel')}
          </label>
          <p
            id={`${FIELD_IDS.files}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('filesHelp', {maxSize: MEMBER_DOCUMENT_MAX_MEGABYTES})}
          </p>
          <input
            ref={fileInput}
            id={FIELD_IDS.files}
            name="files"
            type="file"
            multiple
            accept={MEMBER_DOCUMENT_PDF_TYPE}
            tabIndex={-1}
            className="sr-only"
            aria-invalid={errors.files ? true : undefined}
            aria-describedby={`${FIELD_IDS.files}-help`}
            onChange={(event) =>
              chooseFiles(Array.from(event.target.files ?? []))
            }
          />
          {files.length === 0 && (
            <div className="hidden sm:block">
              <FileUpload
                multi
                maxSize={MEMBER_DOCUMENT_MAX_BYTES}
                isUploading={sending}
                onChange={chooseFiles}
              />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto sm:self-start"
            aria-describedby={`${FIELD_IDS.files}-help`}
            disabled={sending}
            onClick={() => fileInput.current?.click()}
          >
            {t('chooseFiles')}
          </Button>
          {files.length > 0 && <ChosenFiles files={files} />}
          {errors.files?.message && (
            <p className={FIELD_MESSAGE_CLASS}>{errors.files.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            disabled={sending}
            className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-65"
          >
            {sending ? t('submitting') : t('submit', {count: files.length})}
          </Button>
          {!sending && (
            <Button
              asChild
              variant="outline"
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              <Link href={MEMBER_DOCUMENTS_PATH}>{t('cancel')}</Link>
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}

/** « 12 fichiers choisis » et les premiers noms, « … et 7 autres ». */
function ChosenFiles({files}: {files: File[]}) {
  const t = useTranslations('BureauMemberDocuments.batch')
  const hidden = files.length - FILE_NAMES_SHOWN

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[15px] font-medium">
        {t('chosenCount', {count: files.length})}
      </p>
      <ul className="flex flex-col gap-1">
        {files.slice(0, FILE_NAMES_SHOWN).map((file, index) => (
          <li
            key={`${file.name}-${index}`}
            className={`${DATA_CLASS} text-[15px] [overflow-wrap:anywhere]`}
          >
            {file.name}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="text-muted-foreground text-[15px]">
          {t('moreFiles', {count: hidden})}
        </p>
      )}
    </div>
  )
}

/** 5c : barre determinee, sans pourcentage ; la phrase porte le decompte. */
function BatchProgress({progression}: {progression: Progression}) {
  const t = useTranslations('BureauMemberDocuments.batch')

  return (
    <div className="flex flex-col gap-3">
      <Progress
        value={(progression.done / progression.total) * 100}
        aria-label={t('progressLabel')}
      />
      <p aria-live="polite" className="text-[15px]">
        {t('progress', {done: progression.done, total: progression.total})}
      </p>
      {progression.current && (
        <p className="text-muted-foreground text-[15px] [overflow-wrap:anywhere]">
          {t('sending', {name: progression.current})}
        </p>
      )}
      <Alert
        role="note"
        className="border-warning-border bg-warning text-warning-foreground"
      >
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-warning-foreground text-base">
          {t('stayWarning')}
        </AlertDescription>
      </Alert>
    </div>
  )
}

/** 5d : le rapport final, qui est le succes du lot. */
function BatchDone({
  lines,
  onRestart,
  profilesWithoutReference,
}: {
  lines: ReportLine[]
  onRestart: () => void
  profilesWithoutReference: number
}) {
  const t = useTranslations('BureauMemberDocuments.batch')
  const deposited = lines.filter((line) => line.status === 'deposited').length
  const rejected = lines.length - deposited

  return (
    <div className="flex flex-col gap-6">
      <Alert role="status" className="[&>svg]:size-5">
        <CircleCheck aria-hidden="true" className="text-primary" />
        <AlertDescription className="text-foreground text-base">
          {t('done', {deposited, rejected})}
        </AlertDescription>
      </Alert>
      <dl className="flex flex-wrap gap-6">
        {(
          [
            ['deposited', deposited],
            ['rejected', rejected],
            ['total', lines.length],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-muted-foreground text-[15px]">
              {t(`counter.${key}`)}
            </dt>
            <dd className={`${DATA_CLASS} text-2xl`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-[15px]">{t('notKept')}</p>
      <BatchReport lines={lines} />
      {profilesWithoutReference > 0 && (
        <Alert role="note" className="bg-muted">
          <Info aria-hidden="true" />
          <AlertDescription className="text-foreground">
            <p>{t('withoutReference', {count: profilesWithoutReference})}</p>
            <Link
              href={MEMBER_PROFILES_PATH}
              className="underline underline-offset-4"
            >
              <span aria-hidden="true">→ </span>
              {t('withoutReferenceAction')}
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="h-14 w-full sm:h-12 sm:w-auto"
          onClick={onRestart}
        >
          {t('another')}
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto"
        >
          <Link href={MEMBER_DOCUMENTS_PATH}>{t('backToOverview')}</Link>
        </Button>
      </div>
    </div>
  )
}

/** Le rapport ligne a ligne, ecartes en tete (5c puis 5d). */
function BatchReport({lines}: {lines: ReportLine[]}) {
  const t = useTranslations('BureauMemberDocuments.batch')
  const ordered = reportOrderOf(lines)

  return (
    <>
      <div className="hidden sm:block">
        <Table aria-label={t('reportCaption')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.file')}</TableHead>
              <TableHead>{t('columns.result')}</TableHead>
              <TableHead>{t('columns.target')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((line, index) => (
              <TableRow key={`${line.fileName}-${index}`} className="h-14">
                <TableCell
                  className={`${DATA_CLASS} [overflow-wrap:anywhere] whitespace-normal`}
                >
                  {line.fileName}
                </TableCell>
                <TableCell>
                  <ResultBadge line={line} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <LineTarget line={line} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-4 sm:hidden">
        {ordered.map((line, index) => (
          <li key={`${line.fileName}-${index}`}>
            <Card className="gap-3 px-4 py-4 shadow-none">
              <p
                className={`${DATA_CLASS} text-[17px] [overflow-wrap:anywhere]`}
              >
                {line.fileName}
              </p>
              <ResultBadge line={line} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                <dt className="text-muted-foreground">
                  {line.status === 'deposited'
                    ? t('profileLabel')
                    : t('reasonLabel')}
                </dt>
                <dd>
                  <LineTarget line={line} />
                </dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

function ResultBadge({line}: {line: ReportLine}) {
  const t = useTranslations('BureauMemberDocuments.batch')

  return line.status === 'deposited' ? (
    <Badge variant="outline" className="text-muted-foreground">
      {t('resultDeposited')}
    </Badge>
  ) : (
    <Badge variant="destructive">{t('resultRejected')}</Badge>
  )
}

/** La fiche d'un depose, ou la raison ecrite d'un ecarte. */
function LineTarget({line}: {line: ReportLine}) {
  const t = useTranslations('BureauMemberDocuments.batch')

  if (line.status === 'deposited') {
    return (
      <span className="flex flex-col">
        <Link
          href={memberProfilePathOf(line.memberProfileId)}
          className="font-semibold underline underline-offset-4"
        >
          {line.memberProfileName}
        </Link>
        <span className="text-muted-foreground text-[15px]">
          <MemberDocumentParcels
            parcelNumbers={line.parcelNumbers}
            meterNumber={line.meterNumber}
          />
        </span>
      </span>
    )
  }
  if (line.status === 'error') return <span>{line.message}</span>

  return (
    <span>
      {t(`reasons.${line.reason}`, {
        reference: line.reference ?? '',
        weight: formatFileWeight(line.fileBytes),
        maxSize: MEMBER_DOCUMENT_MAX_MEGABYTES,
      })}
    </span>
  )
}
