'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {CircleAlert, CircleCheck, Download, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'
import {z} from 'zod'

import {MemberDocumentParcels} from '@/components/features/member-documents/member-document-parcels'
import {
  MEMBER_DOCUMENT_CATEGORIES_PATH,
  memberDocumentDownloadPathOf,
} from '@/components/features/member-documents/member-document-paths'
import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
} from '@/components/features/member-profile/member-profile-paths'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {
  DateField,
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import {
  type DocumentLotLineResult,
  documentTemplateFileNameOf,
} from '@/services/types/domain/document-template-types'
import {
  MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
  type MemberDocumentIssue,
} from '@/services/types/domain/member-document-types'

import {
  DOCUMENT_TEMPLATES_PATH,
  NEW_DOCUMENT_TEMPLATE_PATH,
  templateDocumentDownloadPathOf,
} from './document-template-paths'

export type TemplateDocumentDepositAction = (
  formData: FormData
) => Promise<DocumentLotLineResult>

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

const FIELDS = ['templateId', 'documentDate', 'categoryId', 'title'] as const
type GeneratorField = (typeof FIELDS)[number]

const FIELD_IDS: Record<GeneratorField, string> = {
  templateId: 'template-document-template',
  documentDate: 'template-document-date',
  categoryId: 'template-document-category',
  title: 'template-document-title',
}

const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'

/** Le champ et le message que designe un refus de s32 ; rien pour un fichier. */
const ISSUE_FIELD: Partial<
  Record<MemberDocumentIssue, {field: GeneratorField; key: string}>
> = {
  title_missing: {field: 'title', key: 'titleMissing'},
  title_too_long: {field: 'title', key: 'titleTooLong'},
  category_missing: {field: 'categoryId', key: 'categoryMissing'},
  category_unavailable: {field: 'categoryId', key: 'categoryUnavailable'},
  date_invalid: {field: 'documentDate', key: 'dateInvalid'},
}

const generatorSchemaOf = (t: Translate, categoryIds: readonly string[]) =>
  z
    .object({
      templateId: z.string().min(1, t('issues.templateMissing')),
      documentDate: z
        .string()
        .refine((value) => frenchDateToIso(value) !== undefined, {
          message: t('issues.dateInvalid'),
        }),
      deposit: z.boolean(),
      categoryId: z.string(),
      title: z.string(),
    })
    .superRefine((values, context) => {
      if (!values.deposit) return
      if (!categoryIds.includes(values.categoryId)) {
        context.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: t('issues.categoryMissing'),
        })
      }
      const title = values.title.trim()
      if (title === '') {
        context.addIssue({
          code: 'custom',
          path: ['title'],
          message: t('issues.titleMissing'),
        })
      } else if (title.length > MEMBER_DOCUMENT_TITLE_MAX_LENGTH) {
        context.addIssue({
          code: 'custom',
          path: ['title'],
          message: t('issues.titleTooLong', {
            max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
          }),
        })
      }
    })

type GeneratorValues = z.infer<ReturnType<typeof generatorSchemaOf>>

type Outcome =
  | {kind: 'idle'}
  | {kind: 'renderFailed'}
  | {kind: 'failed'; reason: string}
  | {kind: 'downloaded'; fileName: string; category?: string}
  | {kind: 'depositedNotDownloaded'; category: string}

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Le PDF d'une adresse, enregistre sous un nom sans donnee nominative. */
const downloadPdf = async (
  path: string,
  fileName: string
): Promise<boolean> => {
  try {
    const response = await fetch(path)
    if (!response.ok) return false
    saveBlob(await response.blob(), fileName)
    return true
  } catch {
    return false
  }
}

type TemplateDocumentGeneratorProps = {
  memberProfile: {id: string; name: string}
  parcelNumbers: string[]
  /** L'adresse que la lettre imprimera (ADR 067), lue par le service. */
  addressLines: string[]
  templates: {id: string; name: string}[]
  /**
   * Les categories actives du domaine `member_document` ; `null` quand le
   * compte ne peut pas deposer : la case n'est pas rendue.
   */
  categories: PublicCategoryDTO[] | null
  /** Le jour calendaire de Paris, ISO : la date proposee. */
  today: string
  depositAction: TemplateDocumentDepositAction
}

/**
 * « Generer un document » pour une fiche (ecran 3 de s36, critere 2). Sans la
 * case, le PDF est demande a la route et telecharge : rien n'est conserve.
 * Avec la case, le depot passe **d'abord** ; le navigateur telecharge ensuite
 * le fichier depose. Un refus de depot ne telecharge rien (ADR 074 §4).
 */
export function TemplateDocumentGenerator({
  memberProfile,
  parcelNumbers,
  addressLines,
  templates,
  categories,
  today,
  depositAction,
}: TemplateDocumentGeneratorProps) {
  const t = useTranslations('DocumentTemplatesBureau.generate')

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={MEMBER_PROFILES_PATH}>{t('breadcrumb.parent')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={memberProfilePathOf(memberProfile.id)}>
                {memberProfile.name}
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

      <dl className="flex flex-col gap-1">
        <dt className="text-muted-foreground text-[15px]">{t('forLabel')}</dt>
        <dd className="text-[17px] font-semibold">{memberProfile.name}</dd>
        <dd className="text-muted-foreground text-[15px]">
          <MemberDocumentParcels parcelNumbers={parcelNumbers} />
        </dd>
        <dd className="border-border mt-2 border-l-2 pl-3 text-[15px]">
          {addressLines.map((line, index) => (
            <span key={index} className="block">
              {line}
            </span>
          ))}
        </dd>
      </dl>

      {templates.length === 0 ? (
        <NoTemplateNotice />
      ) : (
        <GeneratorForm
          memberProfile={memberProfile}
          hasCurrentParcel={parcelNumbers.length > 0}
          templates={templates}
          categories={categories}
          today={today}
          depositAction={depositAction}
        />
      )}
    </div>
  )
}

/** 3f : sans modele, le formulaire n'est pas propose (ecran 3 et lot). */
export function NoTemplateNotice() {
  const t = useTranslations('DocumentTemplatesBureau.generate.noTemplate')

  return (
    <Alert className="bg-muted">
      <Info aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{t('title')}</AlertTitle>
      <AlertDescription className="text-foreground">
        <p>{t('description')}</p>
        <Link
          href={NEW_DOCUMENT_TEMPLATE_PATH}
          className="underline underline-offset-4"
        >
          <span aria-hidden="true">→ </span>
          {t('action')}
        </Link>
      </AlertDescription>
    </Alert>
  )
}

/** 3g : la case est cochee, mais aucune categorie active n'existe. */
function NoCategoryNotice() {
  const t = useTranslations('DocumentTemplatesBureau.generate.noCategory')

  return (
    <Alert className="bg-muted">
      <Info aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{t('title')}</AlertTitle>
      <AlertDescription className="text-foreground">
        <p>{t('description')}</p>
        <Link
          href={MEMBER_DOCUMENT_CATEGORIES_PATH}
          className="underline underline-offset-4"
        >
          <span aria-hidden="true">→ </span>
          {t('action')}
        </Link>
      </AlertDescription>
    </Alert>
  )
}

const toFormData = (
  memberProfileId: string,
  values: GeneratorValues,
  documentDate: string
): FormData => {
  const formData = new FormData()
  formData.set('templateId', values.templateId)
  formData.set('memberProfileId', memberProfileId)
  formData.set('documentDate', documentDate)
  formData.set('categoryId', values.categoryId)
  formData.set('title', values.title.trim())
  return formData
}

function GeneratorForm({
  memberProfile,
  hasCurrentParcel,
  templates,
  categories,
  today,
  depositAction,
}: {
  memberProfile: {id: string; name: string}
  hasCurrentParcel: boolean
  templates: {id: string; name: string}[]
  categories: PublicCategoryDTO[] | null
  today: string
  depositAction: TemplateDocumentDepositAction
}) {
  const t = useTranslations('DocumentTemplatesBureau.generate')
  const offered = categories ?? []
  const form = useForm<GeneratorValues>({
    resolver: zodResolver(
      generatorSchemaOf(
        t,
        offered.map((category) => category.id)
      )
    ),
    defaultValues: {
      templateId: '',
      documentDate: isoToFrenchDate(today),
      deposit: false,
      categoryId: '',
      title: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const [outcome, setOutcome] = useState<Outcome>({kind: 'idle'})
  const [focusRequest, setFocusRequest] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [deposit, title, templateId, categoryId, documentDate] = useWatch({
    control: form.control,
    name: ['deposit', 'title', 'templateId', 'categoryId', 'documentDate'],
  })

  useEffect(() => {
    if (focusRequest > 0) summaryRef.current?.focus()
  }, [focusRequest])

  const fail = (next: Outcome) => {
    setOutcome(next)
    setFocusRequest((count) => count + 1)
  }

  const categoryNameOf = (id: string): string =>
    offered.find((category) => category.id === id)?.name ?? ''

  const applyRefusal = (
    result: Extract<DocumentLotLineResult, {status: 'failed'}>
  ) => {
    const mapped = (result.issues ?? []).flatMap((issue) => {
      const target = ISSUE_FIELD[issue]
      return target ? [target] : []
    })
    for (const {field, key} of mapped) {
      form.setError(field, {
        message: t(`issues.${key}`, {max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH}),
      })
    }
    fail(
      mapped.length > 0
        ? {kind: 'idle'}
        : {kind: 'failed', reason: result.reason}
    )
  }

  const onValid = async (values: GeneratorValues) => {
    setOutcome({kind: 'idle'})
    const documentDate = frenchDateToIso(values.documentDate) ?? ''
    const fileName = documentTemplateFileNameOf(documentDate)

    if (!values.deposit) {
      const downloaded = await downloadPdf(
        templateDocumentDownloadPathOf(
          values.templateId,
          memberProfile.id,
          documentDate
        ),
        fileName
      )
      if (downloaded) setOutcome({kind: 'downloaded', fileName})
      else fail({kind: 'renderFailed'})
      return
    }

    const result = await depositAction(
      toFormData(memberProfile.id, values, documentDate)
    ).catch((): DocumentLotLineResult => ({
      status: 'failed',
      reason: t('renderFailedDescription'),
    }))
    if (result.status === 'failed') {
      applyRefusal(result)
      return
    }
    const category = categoryNameOf(values.categoryId)
    const downloaded = await downloadPdf(
      memberDocumentDownloadPathOf(result.documentId),
      fileName
    )
    setOutcome(
      downloaded
        ? {kind: 'downloaded', fileName, category}
        : {kind: 'depositedNotDownloaded', category}
    )
  }

  const invalidFields = FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })
  const showSummary = invalidFields.length > 0 || outcome.kind === 'failed'

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={form.handleSubmit(onValid, () =>
        setFocusRequest((count) => count + 1)
      )}
    >
      {showSummary && (
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
              outcome.kind === 'failed' && <p>{outcome.reason}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {outcome.kind === 'renderFailed' && (
        <Alert
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          variant="destructive"
          className="border-destructive border-2"
        >
          <CircleAlert strokeWidth={1.75} />
          <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
            {t('renderFailedTitle')}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {t('renderFailedDescription')}
          </AlertDescription>
        </Alert>
      )}

      {(outcome.kind === 'downloaded' ||
        outcome.kind === 'depositedNotDownloaded') && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertTitle className="text-[15px] whitespace-normal">
            {outcome.kind === 'downloaded'
              ? t('success.title')
              : t('success.downloadFailed', {
                  name: memberProfile.name,
                  category: outcome.category,
                })}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {outcome.kind === 'downloaded' && (
              <p>
                {t('success.file', {fileName: outcome.fileName})}
                {outcome.category !== undefined &&
                  ` ${t('success.deposited', {
                    name: memberProfile.name,
                    category: outcome.category,
                  })}`}
              </p>
            )}
            <Link
              href={memberProfilePathOf(memberProfile.id)}
              className="underline underline-offset-4"
            >
              {t('success.back')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={FIELD_IDS.templateId} className="text-base">
          {t('templateLabel')}
        </Label>
        <Select
          value={templateId || undefined}
          onValueChange={(value) =>
            form.setValue('templateId', value, {shouldValidate: true})
          }
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
          <p className={FIELD_MESSAGE_CLASS}>{errors.templateId.message}</p>
        )}
        <Link
          href={DOCUMENT_TEMPLATES_PATH}
          className="text-[15px] underline underline-offset-4"
        >
          {t('manageTemplates')}
        </Link>
      </div>

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
              shouldValidate: form.formState.submitCount > 0,
            })
          }
          disabled={isSubmitting}
          placeholder={t('dateFormat')}
          aria-describedby={`${FIELD_IDS.documentDate}-help`}
          error={errors.documentDate?.message}
        />
      </div>

      {categories !== null && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="template-document-deposit"
              checked={deposit}
              onCheckedChange={(checked) =>
                form.setValue('deposit', checked === true)
              }
              aria-describedby="template-document-deposit-help"
              className="mt-1 size-5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="template-document-deposit" className="text-base">
                {t('depositLabel')}
              </Label>
              <p
                id="template-document-deposit-help"
                className="text-muted-foreground text-[14px]"
              >
                {t('depositHelp')}
              </p>
            </div>
          </div>

          {deposit && (
            <div className="flex flex-col gap-6 sm:pl-12">
              {offered.length === 0 ? (
                <NoCategoryNotice />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={FIELD_IDS.categoryId} className="text-base">
                      {t('categoryLabel')}
                    </Label>
                    <Select
                      value={categoryId || undefined}
                      onValueChange={(value) =>
                        form.setValue('categoryId', value, {
                          shouldValidate: form.formState.submitCount > 0,
                        })
                      }
                    >
                      <SelectTrigger
                        id={FIELD_IDS.categoryId}
                        aria-invalid={errors.categoryId ? true : undefined}
                        className="aria-invalid:border-2"
                      >
                        <SelectValue placeholder={t('categoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {offered.map((category) => (
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
                    <p className="text-muted-foreground text-right text-[14px] tabular-nums">
                      {t('titleCounter', {
                        count: title.length,
                        max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
                      })}
                    </p>
                    {errors.title?.message && (
                      <p className={FIELD_MESSAGE_CLASS}>
                        {errors.title.message}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!hasCurrentParcel && (
        <Alert role="note" className="bg-muted">
          <Info aria-hidden="true" />
          <AlertDescription className="text-foreground">
            {t('noParcel', {variable: '{parcelle}'})}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-65"
        >
          <Download aria-hidden="true" />
          {isSubmitting
            ? t('preparing')
            : deposit
              ? t('downloadAndDeposit')
              : t('download')}
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto"
        >
          <Link href={memberProfilePathOf(memberProfile.id)}>
            {t('cancel')}
          </Link>
        </Button>
      </div>
    </form>
  )
}
