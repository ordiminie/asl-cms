'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  AlertDialog,
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
import {Card, CardContent} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AssociationCategoryListDTO,
  CATEGORY_NAME_MAX_LENGTH,
  type ManagedCategoryDTO,
} from '@/services/types/domain/association-category-types'

import {
  CATEGORY_FORM_FIELDS,
  type CategoryActionResult,
  type CategoryDeleteResult,
  type CategoryFormField,
  type CategoryFormSchemaType,
  createCategoryFormSchema,
} from './category-form-validation'
import {REPORTS_PATH} from './report-paths'

type CategoryFormAction = (
  prevState: CategoryActionResult | undefined,
  formData: FormData
) => Promise<CategoryActionResult>

/**
 * Les espaces de libelles des ecrans de categories : signalements (s10),
 * sujets des questions des membres (s23) et categories des documents
 * partages (s31). Memes cles, textes adaptes.
 */
export type CategoryLabelsNamespace =
  | 'BureauReportCategoriesPage'
  | 'BureauQuestionCategoriesPage'
  | 'BureauDocumentCategoriesPage'
  | 'BureauMemberDocumentCategoriesPage'

const CategoryLabelsContext = createContext<CategoryLabelsNamespace>(
  'BureauReportCategoriesPage'
)

/** Les libelles de l'ecran, ou d'une de ses sections (`dialog`…). */
const useCategoryTranslations = (section?: string) => {
  const namespace = useContext(CategoryLabelsContext)
  return useTranslations(section ? `${namespace}.${section}` : namespace)
}

type ReportCategoriesManagerProps = {
  list: AssociationCategoryListDTO
  createAction: CategoryFormAction
  updateAction: CategoryFormAction
  deleteAction: (categoryId: string) => Promise<CategoryDeleteResult>
  /** Espace de libelles ; par defaut, celui des signalements (s10). */
  labels?: CategoryLabelsNamespace
  /** Le lien de retour du fil d'Ariane ; par defaut, la file des signalements. */
  backHref?: string
  /** Une phrase sous le compteur (s23 : le routage des questions). */
  intro?: ReactNode
  /** Une colonne du nombre d'objets portant chaque categorie (s23). */
  showUsageCount?: boolean
  /**
   * L'adresse de routage, colonne et champ du `dialog` ; masquee pour un
   * domaine qui n'envoie rien (s31 : les documents partages).
   */
  showRoutingEmail?: boolean
}

type Editing = {mode: 'add'} | {mode: 'edit'; category: ManagedCategoryDTO}

type Notice =
  | {kind: 'saved'; name: string}
  | {kind: 'deleted'; name: string}
  | {kind: 'limit'; max: number}
  | {kind: 'error'; message: string}

const FIELD_MESSAGE_CLASS = 'text-base font-medium'
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'

/**
 * Categories de signalement (ecran 4 du design s10). Le bouton d'ajout reste
 * **toujours actif** (gap 5) : au plafond, le refus arrive en `alert`
 * `destructive` ancre sous le titre. Ajout et modification dans un `dialog` a
 * deux champs ; la suppression part du `dialog` de modification et passe par
 * un `alert-dialog` qui dit combien de signalements sont conserves.
 *
 * Parametre par son espace de libelles et son lien de retour, il sert aussi
 * les sujets des questions des membres (s23), sans copie de l'ecran.
 */
export function ReportCategoriesManager({
  labels = 'BureauReportCategoriesPage',
  ...props
}: ReportCategoriesManagerProps) {
  return (
    <CategoryLabelsContext.Provider value={labels}>
      <CategoriesScreen {...props} />
    </CategoryLabelsContext.Provider>
  )
}

function CategoriesScreen({
  list,
  createAction,
  updateAction,
  deleteAction,
  backHref = REPORTS_PATH,
  intro,
  showUsageCount = false,
  showRoutingEmail = true,
}: Omit<ReportCategoriesManagerProps, 'labels'>) {
  const t = useCategoryTranslations()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<ManagedCategoryDTO | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  const openAdd = () => {
    if (list.items.length >= list.max) {
      setNotice({kind: 'limit', max: list.max})
      return
    }
    setNotice(null)
    setEditing({mode: 'add'})
  }

  const onSaved = (result: CategoryActionResult) => {
    if (result.status === 'saved') {
      setEditing(null)
      setNotice({kind: 'saved', name: result.name})
    } else if (result.status === 'limit_reached') {
      setEditing(null)
      setNotice({kind: 'limit', max: result.max})
    }
  }

  const confirmDelete = async (category: ManagedCategoryDTO) => {
    const result = await deleteAction(category.id)
    setDeleting(null)
    setNotice(
      result.status === 'deleted'
        ? {kind: 'deleted', name: category.name}
        : {kind: 'error', message: result.message}
    )
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('breadcrumb.label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={backHref}>{t('breadcrumb.parent')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('breadcrumb.categories')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[34px] leading-tight font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-[15px]">
            {t('count', {count: list.items.length, max: list.max})}
          </p>
          {intro && <p className="text-[17px]">{intro}</p>}
        </div>
        <Button
          type="button"
          onClick={openAdd}
          className="h-14 w-full text-base sm:h-11 sm:w-auto"
        >
          {t('add')}
        </Button>
      </div>

      {notice && <NoticeAlert ref={noticeRef} notice={notice} />}

      {list.items.length === 0 ? (
        <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
          <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <CategoriesTable
                items={list.items}
                showUsageCount={showUsageCount}
                showRoutingEmail={showRoutingEmail}
                onEdit={(category) => setEditing({mode: 'edit', category})}
              />
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.items.map((category) => (
              <li key={category.id}>
                <CategoryCard
                  category={category}
                  showUsageCount={showUsageCount}
                  showRoutingEmail={showRoutingEmail}
                  onEdit={() => setEditing({mode: 'edit', category})}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <CategoryDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
        onDelete={(category) => {
          setEditing(null)
          setDeleting(category)
        }}
        createAction={createAction}
        updateAction={updateAction}
        showRoutingEmail={showRoutingEmail}
      />

      <DeleteCategoryDialog
        category={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function NoticeAlert({
  ref,
  notice,
}: {
  ref: React.Ref<HTMLDivElement>
  notice: Notice
}) {
  const t = useCategoryTranslations()

  if (notice.kind === 'saved' || notice.kind === 'deleted') {
    return (
      <Alert ref={ref} tabIndex={-1} role="status" className="[&>svg]:size-5">
        <CircleCheck aria-hidden="true" className="text-primary" />
        <AlertDescription className="text-foreground text-base">
          {t(notice.kind, {name: notice.name})}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        {notice.kind === 'error'
          ? notice.message
          : t('limitReached', {max: notice.max})}
      </AlertDescription>
    </Alert>
  )
}

function RoutingEmail({email}: {email: string | null}) {
  const t = useCategoryTranslations()

  return email ? (
    <span className="break-all">{email}</span>
  ) : (
    <span className="text-muted-foreground">{t('none')}</span>
  )
}

function CategoriesTable({
  items,
  showUsageCount,
  showRoutingEmail,
  onEdit,
}: {
  items: ManagedCategoryDTO[]
  showUsageCount: boolean
  showRoutingEmail: boolean
  onEdit: (category: ManagedCategoryDTO) => void
}) {
  const t = useCategoryTranslations()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">{t('columns.name')}</TableHead>
          {showRoutingEmail && (
            <TableHead>{t('columns.routingEmail')}</TableHead>
          )}
          {showUsageCount && <TableHead>{t('columns.usage')}</TableHead>}
          <TableHead>{t('columns.action')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((category) => (
          <TableRow key={category.id} className="h-14">
            <TableCell className="px-4 text-[17px] font-semibold">
              {category.name}
            </TableCell>
            {showRoutingEmail && (
              <TableCell className="text-[17px]">
                <RoutingEmail email={category.routingEmail} />
              </TableCell>
            )}
            {showUsageCount && (
              <TableCell className="text-[17px] tabular-nums">
                {t('usage', {count: category.usageCount})}
              </TableCell>
            )}
            <TableCell>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => onEdit(category)}
              >
                {t('edit')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CategoryCard({
  category,
  showUsageCount,
  showRoutingEmail,
  onEdit,
}: {
  category: ManagedCategoryDTO
  showUsageCount: boolean
  showRoutingEmail: boolean
  onEdit: () => void
}) {
  const t = useCategoryTranslations()

  return (
    <Card className="gap-3 px-4 py-4 shadow-none">
      <h2 className="text-lg leading-snug font-semibold">{category.name}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        {showRoutingEmail && (
          <>
            <dt className="text-muted-foreground">
              {t('columns.routingEmail')}
            </dt>
            <dd>
              <RoutingEmail email={category.routingEmail} />
            </dd>
          </>
        )}
        {showUsageCount && (
          <>
            <dt className="text-muted-foreground">{t('columns.usage')}</dt>
            <dd className="tabular-nums">
              {t('usage', {count: category.usageCount})}
            </dd>
          </>
        )}
      </dl>
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full"
        onClick={onEdit}
      >
        {t('edit')}
      </Button>
    </Card>
  )
}

/**
 * Le `dialog` a deux champs (etats `4.B`, `4.C`) : nom avec compteur sur 40,
 * adresse de routage facultative. Plein ecran sous 640 px (`4.H`).
 */
function CategoryDialog({
  editing,
  onClose,
  onSaved,
  onDelete,
  createAction,
  updateAction,
  showRoutingEmail,
}: {
  editing: Editing | null
  onClose: () => void
  onSaved: (result: CategoryActionResult) => void
  onDelete: (category: ManagedCategoryDTO) => void
  createAction: CategoryFormAction
  updateAction: CategoryFormAction
  showRoutingEmail: boolean
}) {
  const t = useCategoryTranslations('dialog')

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none"
      >
        {editing && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">
                {editing.mode === 'add' ? t('addTitle') : t('editTitle')}
              </DialogTitle>
            </DialogHeader>
            <CategoryForm
              key={editing.mode === 'edit' ? editing.category.id : 'add'}
              editing={editing}
              onCancel={onClose}
              onSaved={onSaved}
              onDelete={onDelete}
              action={editing.mode === 'add' ? createAction : updateAction}
              showRoutingEmail={showRoutingEmail}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  editing,
  onCancel,
  onSaved,
  onDelete,
  action,
  showRoutingEmail,
}: {
  editing: Editing
  onCancel: () => void
  onSaved: (result: CategoryActionResult) => void
  onDelete: (category: ManagedCategoryDTO) => void
  action: CategoryFormAction
  showRoutingEmail: boolean
}) {
  const t = useCategoryTranslations()
  const category = editing.mode === 'edit' ? editing.category : undefined
  const form = useForm<CategoryFormSchemaType>({
    resolver: zodResolver(createCategoryFormSchema(t)),
    defaultValues: {
      name: category?.name ?? '',
      routingEmail: category?.routingEmail ?? '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {errors, isSubmitting} = form.formState
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const nameLength = useWatch({control: form.control, name: 'name'}).length
  const invalidFields = CATEGORY_FORM_FIELDS.filter((field) => errors[field])

  const onValid = async (values: CategoryFormSchemaType) => {
    setFailure(null)
    const formData = new FormData()
    if (category) formData.set('categoryId', category.id)
    formData.set('name', values.name)
    formData.set('routingEmail', values.routingEmail)

    const result = await action(undefined, formData)
    if (result.status === 'invalid') {
      for (const error of result.errors) {
        form.setError(error.field, {message: error.message})
      }
    } else if (result.status === 'error') {
      setFailure(result.message)
    } else {
      onSaved(result)
    }
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          setSubmitted(true)
          return form.handleSubmit(onValid)(event)
        }}
        className="flex flex-col gap-6"
      >
        {submitted && invalidFields.length > 0 && (
          <ErrorSummary fields={invalidFields} />
        )}
        {failure && (
          <Alert variant="destructive" className="border-2">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription className="text-base">{failure}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({field}) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('dialog.fields.name.label')}
              </FormLabel>
              <FormControl>
                <Input className={FIELD_INVALID_CLASS} {...field} />
              </FormControl>
              <p className="text-muted-foreground text-right text-[14px] tabular-nums">
                {t('dialog.counter', {
                  count: nameLength,
                  max: CATEGORY_NAME_MAX_LENGTH,
                })}
              </p>
              <FormMessage className={FIELD_MESSAGE_CLASS} />
            </FormItem>
          )}
        />

        {showRoutingEmail && (
          <FormField
            control={form.control}
            name="routingEmail"
            render={({field}) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  {t('dialog.fields.routingEmail.label')}{' '}
                  <span className="text-muted-foreground font-normal">
                    {t('dialog.optional')}
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={FIELD_INVALID_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-base">
                  {t('dialog.fields.routingEmail.help')}
                </FormDescription>
                <FormMessage className={FIELD_MESSAGE_CLASS} />
              </FormItem>
            )}
          />
        )}

        <DialogFooter className="gap-3 sm:justify-between">
          {category ? (
            <Button
              type="button"
              variant="destructive"
              className="h-14 sm:h-11"
              onClick={() => onDelete(category)}
            >
              {t('dialog.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-14 sm:h-11"
              onClick={onCancel}
            >
              {t('dialog.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-14 sm:h-11"
            >
              {isSubmitting ? t('dialog.saving') : t('dialog.save')}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  )
}

function ErrorSummary({fields}: {fields: CategoryFormField[]}) {
  const t = useCategoryTranslations('dialog')

  return (
    <Alert
      variant="destructive"
      className="border-destructive border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
        {t('summary')}
      </AlertTitle>
      <AlertDescription className="text-foreground text-base">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {fields.map((field) => (
            <li key={field}>{t(`fields.${field}.label`)}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Confirmation de suppression (etat `4.D`) : la categorie ne sera plus
 * proposee, et les signalements deja recus sont conserves — le nombre est dit.
 */
function DeleteCategoryDialog({
  category,
  onCancel,
  onConfirm,
}: {
  category: ManagedCategoryDTO | null
  onCancel: () => void
  onConfirm: (category: ManagedCategoryDTO) => Promise<void>
}) {
  const t = useCategoryTranslations('deleteDialog')
  const [isPending, setIsPending] = useState(false)

  return (
    <AlertDialog
      open={category !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        {category && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('title', {name: category.name})}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {t('description', {count: category.usageCount})}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-14 sm:h-11">
                {t('cancel')}
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                className="h-14 sm:h-11"
                onClick={async () => {
                  setIsPending(true)
                  await onConfirm(category)
                  setIsPending(false)
                }}
              >
                {t('confirm')}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
