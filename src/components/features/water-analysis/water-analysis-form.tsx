'use client'

import {CircleAlert, FileText, Info} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {
  type ReactNode,
  type RefObject,
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button, buttonVariants} from '@/components/ui/button'
import {DateField} from '@/components/ui/date-field'
import {
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field-format'
import {FileUpload} from '@/components/ui/file-upload'
import {Label} from '@/components/ui/label'
import {Progress} from '@/components/ui/progress'
import {Separator} from '@/components/ui/separator'
import {Textarea} from '@/components/ui/textarea'
import {formatContentDate} from '@/lib/cms/format-content-date'
import {
  CONTENT_FILE_CONTENT_TYPES,
  CONTENT_FILE_MAX_BYTES,
  contentFileUrl,
} from '@/services/types/domain/content-file-types'
import {
  formatFileWeight,
  isSampledOnInFuture,
  WATER_ANALYSIS_CONTENT_MAX_LENGTH,
  WaterAnalysisDTO,
  WaterAnalysisIssue,
  WaterAnalysisIssueConst,
} from '@/services/types/domain/water-analysis-types'

export type WaterAnalysisFormState =
  | {status: 'idle'}
  | {status: 'rejected'; issues: WaterAnalysisIssue[]}
  | {status: 'error'; message: string}

type WaterAnalysisFormProps = {
  /** Absente : publication. Presente : correction d'une analyse en ligne. */
  analysis?: WaterAnalysisDTO
  /** Le jour calendaire courant (ISO), lu par le serveur. */
  today: string
  saveAction: (
    state: WaterAnalysisFormState,
    formData: FormData
  ) => Promise<WaterAnalysisFormState>
  deleteAction?: (analysisId: string) => Promise<WaterAnalysisFormState>
}

type Field = 'date' | 'poster' | 'content' | 'report'

/** Refus propre au formulaire : une date incomplete ne part jamais au serveur. */
type FormIssue = WaterAnalysisIssue | 'date_invalid'

const FIELD_ORDER: Field[] = ['date', 'poster', 'content', 'report']

const FIELD_IDS: Record<Field, string> = {
  date: 'water-analysis-date',
  poster: 'water-analysis-poster',
  content: 'water-analysis-content',
  report: 'water-analysis-report',
}

const ISSUE_FIELD: Record<FormIssue, Field> = {
  date_invalid: 'date',
  [WaterAnalysisIssueConst.FUTURE_DATE]: 'date',
  [WaterAnalysisIssueConst.CONTENT_TOO_LONG]: 'content',
  [WaterAnalysisIssueConst.POSTER_FORMAT]: 'poster',
  [WaterAnalysisIssueConst.POSTER_SIZE]: 'poster',
  [WaterAnalysisIssueConst.MISSING_POSTER]: 'poster',
  [WaterAnalysisIssueConst.REPORT_FORMAT]: 'report',
  [WaterAnalysisIssueConst.REPORT_SIZE]: 'report',
  [WaterAnalysisIssueConst.MISSING_REPORT]: 'report',
}

const ISSUE_MESSAGE_KEY: Record<FormIssue, string> = {
  date_invalid: 'dateInvalid',
  [WaterAnalysisIssueConst.FUTURE_DATE]: 'futureDate',
  [WaterAnalysisIssueConst.CONTENT_TOO_LONG]: 'contentTooLong',
  [WaterAnalysisIssueConst.POSTER_FORMAT]: 'posterFormat',
  [WaterAnalysisIssueConst.POSTER_SIZE]: 'posterSize',
  [WaterAnalysisIssueConst.MISSING_POSTER]: 'missingPoster',
  [WaterAnalysisIssueConst.REPORT_FORMAT]: 'reportFormat',
  [WaterAnalysisIssueConst.REPORT_SIZE]: 'reportSize',
  [WaterAnalysisIssueConst.MISSING_REPORT]: 'missingReport',
}

/** Formats acceptes, annonces au selecteur de fichiers : ceux que le serveur juge. */
const POSTER_TYPES = [
  CONTENT_FILE_CONTENT_TYPES.png,
  CONTENT_FILE_CONTENT_TYPES.jpeg,
  CONTENT_FILE_CONTENT_TYPES.webp,
]
const REPORT_TYPES = [CONTENT_FILE_CONTENT_TYPES.pdf]

/** Les plafonds ecrits sous les champs sont ceux reellement appliques (ADR 026). */
const POSTER_MAX_MEGABYTES = CONTENT_FILE_MAX_BYTES.image / (1024 * 1024)
const REPORT_MAX_MEGABYTES = CONTENT_FILE_MAX_BYTES.document / (1024 * 1024)

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

/**
 * Controles du navigateur avant l'envoi : format, poids, date et longueur. Le
 * serveur revalide tout, et c'est lui qui decide.
 */
const checkForm = (input: {
  dateText: string
  today: string
  content: string
  poster?: File
  report?: File
  requireFiles: boolean
}): FormIssue[] => {
  const issues: FormIssue[] = []
  const iso = frenchDateToIso(input.dateText)

  if (!iso) issues.push('date_invalid')
  else if (isSampledOnInFuture(iso, input.today)) {
    issues.push(WaterAnalysisIssueConst.FUTURE_DATE)
  }

  if (input.poster) {
    if (!POSTER_TYPES.includes(input.poster.type)) {
      issues.push(WaterAnalysisIssueConst.POSTER_FORMAT)
    } else if (input.poster.size > CONTENT_FILE_MAX_BYTES.image) {
      issues.push(WaterAnalysisIssueConst.POSTER_SIZE)
    }
  } else if (input.requireFiles) {
    issues.push(WaterAnalysisIssueConst.MISSING_POSTER)
  }

  if (input.content.length > WATER_ANALYSIS_CONTENT_MAX_LENGTH) {
    issues.push(WaterAnalysisIssueConst.CONTENT_TOO_LONG)
  }

  if (input.report) {
    if (!REPORT_TYPES.includes(input.report.type)) {
      issues.push(WaterAnalysisIssueConst.REPORT_FORMAT)
    } else if (input.report.size > CONTENT_FILE_MAX_BYTES.document) {
      issues.push(WaterAnalysisIssueConst.REPORT_SIZE)
    }
  } else if (input.requireFiles) {
    issues.push(WaterAnalysisIssueConst.MISSING_REPORT)
  }

  return issues
}

/** Apercu local d'une affiche choisie, libere des qu'il ne sert plus. */
const useObjectUrl = (file: File | undefined): string | undefined => {
  const url = useMemo(
    () =>
      file && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined,
    [file]
  )

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )

  return url
}

/**
 * Formulaire d'une analyse d'eau (design s09, ecrans 2 et 3) : **quatre
 * champs**, un bouton, **une seule soumission** (critere 4, ADR 026). Les deux
 * fichiers partent avec les champs ; rien n'est depose avant.
 *
 * Il n'y a **aucun champ de texte alternatif** : la description de l'affiche
 * se deduit de la date, et la ligne sous l'affiche le dit en clair.
 */
export function WaterAnalysisForm({
  analysis,
  today,
  saveAction,
  deleteAction,
}: WaterAnalysisFormProps) {
  const t = useTranslations('BureauWaterAnalysisPage.form')
  const isEdit = Boolean(analysis)

  const [state, formAction, isPending] = useActionState(saveAction, {
    status: 'idle',
  } as WaterAnalysisFormState)

  const [dateText, setDateText] = useState(
    isoToFrenchDate(analysis?.sampledOn ?? today)
  )
  const [content, setContent] = useState(analysis?.content ?? '')
  const [poster, setPoster] = useState<File>()
  const [report, setReport] = useState<File>()
  const [clientIssues, setClientIssues] = useState<FormIssue[]>()

  const posterInput = useRef<HTMLInputElement>(null)
  const reportInput = useRef<HTMLInputElement>(null)
  const posterPreview = useObjectUrl(poster)

  const issues: FormIssue[] =
    clientIssues ?? (state.status === 'rejected' ? state.issues : [])
  const issueOf = (field: Field): FormIssue | undefined =>
    issues.find((issue) => ISSUE_FIELD[issue] === field)
  const messageOf = (issue: FormIssue): string =>
    t(`issues.${ISSUE_MESSAGE_KEY[issue]}`, {
      max: WATER_ANALYSIS_CONTENT_MAX_LENGTH,
      maxSize:
        ISSUE_FIELD[issue] === 'poster'
          ? POSTER_MAX_MEGABYTES
          : REPORT_MAX_MEGABYTES,
    })
  const fieldError = (field: Field): string | undefined => {
    const issue = issueOf(field)
    return issue ? messageOf(issue) : undefined
  }

  const typedIso = frenchDateToIso(dateText)
  const posterAlt = typedIso
    ? t('posterAlt', {date: formatContentDate(typedIso)})
    : undefined
  const overflow = content.length - WATER_ANALYSIS_CONTENT_MAX_LENGTH
  const hasOverflow = overflow > 0
  const currentPosterSrc =
    posterPreview ??
    (!poster && analysis ? contentFileUrl(analysis.posterKey) : undefined)
  const sendingFiles = [poster?.name, report?.name].filter(Boolean).join(', ')

  const submit = () => {
    if (isPending) return

    const found = checkForm({
      dateText,
      today,
      content,
      poster,
      report,
      requireFiles: !isEdit,
    })
    if (found.length > 0) {
      setClientIssues(found)
      return
    }
    setClientIssues(undefined)

    const formData = new FormData()
    formData.append('sampledOn', frenchDateToIso(dateText) ?? '')
    formData.append('content', content)
    if (analysis) formData.append('analysisId', analysis.id)
    if (poster) formData.append('poster', poster)
    if (report) formData.append('report', report)

    startTransition(() => formAction(formData))
  }

  const faultyFields = FIELD_ORDER.filter((field) => issueOf(field))

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Link href="/bureau/analyses-eau" className="text-[15px] underline">
        ← {t('backToList')}
      </Link>

      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {analysis
          ? t('editTitle', {date: formatContentDate(analysis.sampledOn)})
          : t('newTitle')}
      </h1>

      {analysis ? (
        <Alert role="status">
          <Info />
          <AlertDescription>{t('onlineNotice')}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-[15px]">
          {t('visibleNotice')}
        </p>
      )}

      {(faultyFields.length > 0 || state.status === 'error') && (
        <Alert variant="destructive" className="border-destructive border-2">
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
            {t('errorSummaryTitle')}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {faultyFields.length > 0 ? (
              <ul className="flex list-none flex-col gap-1">
                {faultyFields.map((field) => (
                  <li key={field}>
                    <a
                      href={`#${FIELD_IDS[field]}`}
                      className="text-destructive-text underline underline-offset-4"
                    >
                      {fieldError(field)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              state.status === 'error' && state.message
            )}
          </AlertDescription>
        </Alert>
      )}

      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={FIELD_IDS.date}>{t('dateLabel')}</Label>
          <DateField
            id={FIELD_IDS.date}
            name="sampledOn"
            value={dateText}
            onValueChange={setDateText}
            placeholder={t('datePlaceholder')}
            aria-describedby={`${FIELD_IDS.date}-help`}
            error={fieldError('date')}
          />
          <p
            id={`${FIELD_IDS.date}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('dateHelp')}
          </p>
        </div>

        <FileField
          id={FIELD_IDS.poster}
          name="poster"
          label={t('posterLabel')}
          help={t('posterHelp', {maxSize: POSTER_MAX_MEGABYTES})}
          accept={POSTER_TYPES.join(',')}
          inputRef={posterInput}
          error={fieldError('poster')}
          hasFile={Boolean(poster || analysis)}
          chooseLabel={t('chooseFile')}
          replaceLabel={t('posterReplace')}
          disabled={isPending}
          dropZone={
            <FileUpload
              onlyimage
              maxSize={CONTENT_FILE_MAX_BYTES.image}
              isUploading={isPending}
              onChange={(files) => setPoster(files[0])}
            />
          }
          onFile={setPoster}
        >
          {currentPosterSrc && (
            <Image
              src={currentPosterSrc}
              alt={t('posterPreviewAlt')}
              width={120}
              height={160}
              unoptimized
              className="h-40 w-30 rounded-md border object-contain"
            />
          )}
          {poster && (
            <p className="text-[15px]">
              {t('fileChosen', {
                name: poster.name,
                weight: formatFileWeight(poster.size),
              })}
            </p>
          )}
          {(poster || analysis) && posterAlt && (
            <p className="text-muted-foreground text-[14px]">
              {t('posterAltNotice', {alt: posterAlt})}
            </p>
          )}
        </FileField>

        <div className="flex flex-col gap-2">
          <Label htmlFor={FIELD_IDS.content}>
            {t('contentLabel')} —{' '}
            <span className="text-muted-foreground font-normal">
              {t('optional')}
            </span>
          </Label>
          <p
            id={`${FIELD_IDS.content}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('contentHelp')}
          </p>
          <Textarea
            id={FIELD_IDS.content}
            name="content"
            rows={4}
            value={content}
            aria-invalid={hasOverflow || issueOf('content') ? true : undefined}
            aria-describedby={`${FIELD_IDS.content}-help ${FIELD_IDS.content}-counter`}
            className={
              hasOverflow || issueOf('content')
                ? 'border-destructive border-2'
                : undefined
            }
            onChange={(event) => setContent(event.target.value)}
          />
          <p
            id={`${FIELD_IDS.content}-counter`}
            className={
              hasOverflow
                ? 'text-destructive-text text-right text-[14px] font-semibold tabular-nums'
                : 'text-muted-foreground text-right text-[14px] tabular-nums'
            }
          >
            {t('contentCounter', {
              count: content.length,
              max: WATER_ANALYSIS_CONTENT_MAX_LENGTH,
            })}
          </p>
          {hasOverflow ? (
            <p className="text-destructive-text text-[16px] font-medium">
              {t('contentOverflow', {over: overflow})}
            </p>
          ) : (
            issueOf('content') && (
              <p className="text-destructive-text text-[16px] font-medium">
                {fieldError('content')}
              </p>
            )
          )}
        </div>

        <FileField
          id={FIELD_IDS.report}
          name="report"
          label={t('reportLabel')}
          help={t('reportHelp', {maxSize: REPORT_MAX_MEGABYTES})}
          accept={REPORT_TYPES.join(',')}
          inputRef={reportInput}
          error={fieldError('report')}
          hasFile={Boolean(report || analysis)}
          chooseLabel={t('chooseFile')}
          replaceLabel={t('reportReplace')}
          disabled={isPending}
          dropZone={
            <FileUpload
              maxSize={CONTENT_FILE_MAX_BYTES.document}
              isUploading={isPending}
              onChange={(files) => setReport(files[0])}
            />
          }
          onFile={setReport}
        >
          {(report || analysis) && (
            <p className="flex items-center gap-2 text-[15px]">
              <FileText aria-hidden="true" className="size-5 shrink-0" />
              {report
                ? t('fileChosen', {
                    name: report.name,
                    weight: formatFileWeight(report.size),
                  })
                : analysis &&
                  t('reportCurrent', {
                    date: formatContentDate(analysis.sampledOn),
                    weight: formatFileWeight(analysis.reportBytes),
                  })}
            </p>
          )}
        </FileField>

        {isPending && (
          <div className="flex flex-col gap-2">
            <Progress
              aria-label={
                sendingFiles
                  ? t('sendingFiles', {files: sendingFiles})
                  : t('sending')
              }
            />
            <p className="text-muted-foreground text-[14px]">
              {sendingFiles
                ? t('sendingFiles', {files: sendingFiles})
                : t('sending')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            className="h-14 w-full aria-disabled:pointer-events-none aria-disabled:opacity-45 sm:h-12 sm:w-auto sm:min-w-65"
            aria-disabled={isPending || undefined}
          >
            {isEdit
              ? isPending
                ? t('submittingEdit')
                : t('submitEdit')
              : isPending
                ? t('submittingNew')
                : t('submitNew')}
          </Button>
          <Button asChild variant="link" className="h-14 sm:h-12">
            <Link href="/bureau/analyses-eau">{t('cancel')}</Link>
          </Button>
        </div>
      </form>

      {analysis && deleteAction && (
        <DeleteZone analysis={analysis} deleteAction={deleteAction} />
      )}
    </div>
  )
}

/**
 * Un champ de fichier : le libelle, la consigne ecrite **avant** tout echec,
 * la zone de depot (masquee au tactile) et le bouton qui ouvre le selecteur.
 * Un fichier en place ne se retire jamais : il se remplace.
 */
function FileField({
  id,
  name,
  label,
  help,
  accept,
  inputRef,
  error,
  hasFile,
  chooseLabel,
  replaceLabel,
  disabled,
  dropZone,
  onFile,
  children,
}: {
  id: string
  name: string
  label: string
  help: string
  accept: string
  inputRef: RefObject<HTMLInputElement | null>
  error?: string
  hasFile: boolean
  chooseLabel: string
  replaceLabel: string
  disabled: boolean
  dropZone: ReactNode
  onFile: (file: File | undefined) => void
  children?: ReactNode
}) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id}>{label}</Label>
      <p id={helpId} className="text-muted-foreground text-[14px]">
        {help}
      </p>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {children}
      {!hasFile && <div className="hidden sm:block">{dropZone}</div>}
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full sm:h-11 sm:w-auto sm:self-start"
        aria-describedby={helpId}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {hasFile ? replaceLabel : chooseLabel}
      </Button>
      {error && (
        <p
          id={errorId}
          className="text-destructive-text text-[16px] font-medium"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Suppression d'une analyse, isolee du formulaire par un filet et 48 px :
 * jamais a cote du bouton principal. Le dialogue nomme l'acte et la date.
 */
function DeleteZone({
  analysis,
  deleteAction,
}: {
  analysis: WaterAnalysisDTO
  deleteAction: (analysisId: string) => Promise<WaterAnalysisFormState>
}) {
  const t = useTranslations('BureauWaterAnalysisPage.form.delete')
  const [isPending, startDeleting] = useTransition()
  const [error, setError] = useState<string>()
  const date = formatContentDate(analysis.sampledOn)

  const confirm = () => {
    setError(undefined)
    startDeleting(async () => {
      try {
        const result = await deleteAction(analysis.id)
        if (result.status === 'error') setError(result.message)
      } catch (caught) {
        if (isNavigationSignal(caught)) return
        throw caught
      }
    })
  }

  return (
    <div className="mt-12 flex flex-col gap-4">
      <Separator />
      {error && (
        <Alert variant="destructive">
          <CircleAlert strokeWidth={1.75} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-12 sm:w-auto sm:self-start"
            disabled={isPending}
          >
            {isPending ? t('pending') : t('action')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title', {date})}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('description')} <strong>{t('definitive')}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({variant: 'destructive'})}
              onClick={confirm}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
