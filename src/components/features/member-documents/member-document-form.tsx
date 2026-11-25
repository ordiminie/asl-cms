'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {CircleAlert, FileText, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useRef, useState} from 'react'
import {useForm, useWatch} from 'react-hook-form'

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
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import {MEMBER_DOCUMENT_TITLE_MAX_LENGTH} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {
  createMemberDocumentFormSchema,
  ISSUE_FIELD,
  issueMessageOf,
  MEMBER_DOCUMENT_FORM_FIELDS,
  MEMBER_DOCUMENT_MAX_BYTES,
  MEMBER_DOCUMENT_MAX_MEGABYTES,
  MEMBER_DOCUMENT_PDF_TYPE,
  type MemberDocumentFormField,
  type MemberDocumentFormState,
  type MemberDocumentFormValues,
} from './member-document-form-validation'
import {MemberDocumentParcels} from './member-document-parcels'
import {MEMBER_DOCUMENT_CATEGORIES_PATH} from './member-document-paths'

export type MemberDocumentFormAction = (
  state: MemberDocumentFormState,
  formData: FormData
) => Promise<MemberDocumentFormState>

const FIELD_IDS: Record<MemberDocumentFormField, string> = {
  title: 'member-document-title',
  categoryId: 'member-document-category',
  documentDate: 'member-document-date',
  file: 'member-document-file',
}

const FIELD_MESSAGE_CLASS = 'text-destructive-text text-[16px] font-medium'

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

const toFormData = (
  memberProfileId: string,
  values: MemberDocumentFormValues
): FormData => {
  const formData = new FormData()
  formData.set('memberProfileId', memberProfileId)
  formData.set('title', values.title.trim())
  formData.set('categoryId', values.categoryId)
  formData.set('documentDate', frenchDateToIso(values.documentDate) ?? '')
  if (values.file) formData.set('file', values.file)
  return formData
}

type MemberDocumentFormProps = {
  memberProfile: {id: string; name: string}
  /** Les parcelles actuelles de la fiche : a qui le bureau depose. */
  parcelNumbers: string[]
  categories: PublicCategoryDTO[]
  /** Le jour calendaire de Paris, ISO : la date proposee. */
  today: string
  saveAction: MemberDocumentFormAction
}

/**
 * « Deposer un document » pour une fiche (design s32, ecran 3) : quatre
 * champs, une page. La fiche visee est ecrite en tete, en lecture seule ;
 * les consignes du fichier sont ecrites **avant** l'echec ; le serveur
 * revalide tout. Sans categorie active, le formulaire n'est pas propose (3c).
 */
export function MemberDocumentForm({
  memberProfile,
  parcelNumbers,
  categories,
  today,
  saveAction,
}: MemberDocumentFormProps) {
  const t = useTranslations('BureauMemberDocuments.form')

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
      </dl>

      {categories.length === 0 ? (
        <NoCategoryNotice />
      ) : (
        <DepositForm
          memberProfileId={memberProfile.id}
          categories={categories}
          today={today}
          saveAction={saveAction}
        />
      )}
    </div>
  )
}

/** 3c : sans categorie active, l'alerte dit pourquoi et mene aux categories. */
export function NoCategoryNotice() {
  const t = useTranslations('BureauMemberDocuments.form.noCategory')

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

function DepositForm({
  memberProfileId,
  categories,
  today,
  saveAction,
}: {
  memberProfileId: string
  categories: PublicCategoryDTO[]
  today: string
  saveAction: MemberDocumentFormAction
}) {
  const t = useTranslations('BureauMemberDocuments.form')
  const form = useForm<MemberDocumentFormValues>({
    resolver: zodResolver(
      createMemberDocumentFormSchema(
        t,
        categories.map((category) => category.id)
      )
    ),
    defaultValues: {
      title: '',
      categoryId: '',
      documentDate: isoToFrenchDate(today),
      file: undefined,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting, submitCount} = form.formState
  const [failure, setFailure] = useState<string>()
  const title = useWatch({control: form.control, name: 'title'})
  const file = useWatch({control: form.control, name: 'file'})
  const fileInput = useRef<HTMLInputElement>(null)

  const chooseFile = (chosen: File | undefined) =>
    form.setValue('file', chosen, {shouldValidate: submitCount > 0})

  const onValid = async (values: MemberDocumentFormValues) => {
    setFailure(undefined)
    try {
      const result = await saveAction(
        {status: 'idle'},
        toFormData(memberProfileId, values)
      )
      if (result.status === 'rejected') {
        for (const issue of result.issues) {
          form.setError(ISSUE_FIELD[issue], {
            message: issueMessageOf(
              t,
              issue,
              values.file && formatFileWeight(values.file.size)
            ),
          })
        }
      } else if (result.status === 'error') {
        setFailure(result.message)
      }
    } catch (caught) {
      if (isNavigationSignal(caught)) throw caught
      setFailure(t('failed'))
    }
  }

  const invalidFields = MEMBER_DOCUMENT_FORM_FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={form.handleSubmit(onValid)}
      >
        {(invalidFields.length > 0 || failure) && (
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
                failure
              )}
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
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[14px]">
                {t('titleHelp')}
              </FormDescription>
              <p className="text-muted-foreground text-right text-[14px] tabular-nums">
                {t('titleCounter', {
                  count: title.length,
                  max: MEMBER_DOCUMENT_TITLE_MAX_LENGTH,
                })}
              </p>
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
                {t('categoryLabel')}
              </FormLabel>
              <Select
                value={field.value === '' ? undefined : field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger
                    id={FIELD_IDS.categoryId}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    className="aria-invalid:border-2"
                  >
                    <SelectValue placeholder={t('categoryPlaceholder')} />
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
                {t('dateLabel')}
              </Label>
              <p
                id={`${FIELD_IDS.documentDate}-help`}
                className="text-muted-foreground text-[14px]"
              >
                {t('dateHelp')}
              </p>
              <DateField
                id={FIELD_IDS.documentDate}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isSubmitting}
                placeholder={t('dateFormat')}
                aria-describedby={`${FIELD_IDS.documentDate}-help`}
                error={errors.documentDate?.message}
              />
            </div>
          )}
        />

        <div className="flex flex-col gap-3">
          <label htmlFor={FIELD_IDS.file} className="text-base font-medium">
            {t('fileLabel')}
          </label>
          <p
            id={`${FIELD_IDS.file}-help`}
            className="text-muted-foreground text-[14px]"
          >
            {t('fileHelp', {maxSize: MEMBER_DOCUMENT_MAX_MEGABYTES})}
          </p>
          <input
            ref={fileInput}
            id={FIELD_IDS.file}
            name="file"
            type="file"
            accept={MEMBER_DOCUMENT_PDF_TYPE}
            tabIndex={-1}
            className="sr-only"
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={`${FIELD_IDS.file}-help`}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          {file && (
            <p className="flex items-center gap-2 text-[15px] [overflow-wrap:anywhere]">
              <FileText aria-hidden="true" className="size-5 shrink-0" />
              {t('fileChosen', {
                name: file.name,
                weight: formatFileWeight(file.size),
              })}
            </p>
          )}
          {!file && (
            <div className="hidden sm:block">
              <FileUpload
                maxSize={MEMBER_DOCUMENT_MAX_BYTES}
                isUploading={isSubmitting}
                onChange={(files) => chooseFile(files[0])}
              />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto sm:self-start"
            aria-describedby={`${FIELD_IDS.file}-help`}
            disabled={isSubmitting}
            onClick={() => fileInput.current?.click()}
          >
            {file ? t('replaceFile') : t('chooseFile')}
          </Button>
          {errors.file?.message && (
            <p className={FIELD_MESSAGE_CLASS}>{errors.file.message}</p>
          )}
        </div>

        {isSubmitting && file && (
          <div className="flex flex-col gap-2">
            <Progress aria-label={t('sending', {name: file.name})} />
            <p className="text-muted-foreground text-[14px]">
              {t('sending', {name: file.name})}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-65"
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full sm:h-12 sm:w-auto"
          >
            <Link href={memberProfilePathOf(memberProfileId)}>
              {t('cancel')}
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  )
}
