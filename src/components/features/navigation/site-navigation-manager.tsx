'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {AlertCircle, CircleCheck, ExternalLink, Plus, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useId, useRef, useState, useTransition} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {RestrictedMarkdownEditor} from '@/components/features/pages/blocks/restricted-markdown-editor'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {SortableList} from '@/components/ui/sortable-list'
import {Switch} from '@/components/ui/switch'
import {cn} from '@/lib/utils'
import {PageDTO, PageStatus} from '@/services/types/domain/page-types'
import {
  MENU_LINK_LABEL_MAX_LENGTH,
  MenuItemDTO,
  MenuLinkItemDTO,
  MenuPageItemDTO,
} from '@/services/types/domain/site-navigation-types'

import {
  createMenuLinkFormSchema,
  MENU_LINK_FORM_FIELDS,
  type MenuLinkActionResult,
  type MenuLinkFormSchemaType,
  menuLinkLabelExcess,
} from './menu-link-form-validation'

/**
 * Statut -> token du design system (§1.1), meme correspondance que la liste des
 * pages de s04 : brouillon neutre, publiee en accent, depubliee en `warning`.
 */
const STATUS_DOT_CLASS: Record<PageStatus, string> = {
  draft: 'bg-muted-foreground',
  published: 'bg-accent-solid',
  unpublished: 'bg-warning-border',
}

export type SiteNavigationActionResult =
  {status: 'ok'} | {status: 'error'; message: string}

export type SiteNavigationAddResult =
  {status: 'added'; item: MenuPageItemDTO} | {status: 'error'; message: string}

/** Ajout ou modification d'une entree libre (s50) : signature `useActionState`. */
export type MenuLinkFormAction = (
  prevState: MenuLinkActionResult | undefined,
  formData: FormData
) => Promise<MenuLinkActionResult>

type SiteNavigationManagerProps = {
  menu: MenuItemDTO[]
  /** Toutes les pages de l'association : le selecteur exclut celles deja au menu. */
  pages: PageDTO[]
  footerContent: string
  addAction: (pageId: string) => Promise<SiteNavigationAddResult>
  removeAction: (menuItemId: string) => Promise<SiteNavigationActionResult>
  reorderAction: (orderedIds: string[]) => Promise<SiteNavigationActionResult>
  setVisibilityAction: (
    menuItemId: string,
    visible: boolean
  ) => Promise<SiteNavigationActionResult>
  saveFooterAction: (content: string) => Promise<SiteNavigationActionResult>
  addLinkAction: MenuLinkFormAction
  updateLinkAction: MenuLinkFormAction
}

/** L'entree ouverte dans le `dialog` d'une adresse : un ajout ou une modification. */
type LinkEditing = {mode: 'add'} | {mode: 'edit'; item: MenuLinkItemDTO}

/** Le texte d'une entree : le titre de sa page, ou le libelle de l'entree libre. */
const labelOf = (item: MenuItemDTO): string =>
  item.kind === 'page' ? item.pageTitle : item.label

const linkFormData = (
  values: MenuLinkFormSchemaType,
  menuItemId?: string
): FormData => {
  const formData = new FormData()
  if (menuItemId) formData.set('menuItemId', menuItemId)
  formData.set('label', values.label)
  formData.set('address', values.address)
  return formData
}

/** L'entree retiree, gardee le temps de pouvoir revenir dessus. */
type Removal = {previousMenu: MenuItemDTO[]; removed: MenuItemDTO}

const UNDO_WINDOW_MS = 10_000

/**
 * Ecran « Navigation du site » (design s04b, ecran 1) : le menu se compose a
 * effet immediat — ajouter, retirer, reordonner, basculer la visibilite — et le
 * pied de page a le seul bouton « Enregistrer » de l'ecran.
 *
 * `<SortableList />` est reutilise **tel quel** (livre par s04) : boutons
 * Monter/Descendre toujours visibles, annonce `aria-live`, annulation du
 * deplacement. Un echec s'ecrit dans la page, ancre, jamais en toast (§5).
 *
 * Une entree libre (s50, ADR 078) s'ajoute et se modifie dans un seul `dialog`
 * a deux champs ; une entree de page n'a qu'une action, « Retirer du menu ».
 */
export function SiteNavigationManager({
  menu,
  pages,
  footerContent,
  addAction,
  removeAction,
  reorderAction,
  setVisibilityAction,
  saveFooterAction,
  addLinkAction,
  updateLinkAction,
}: SiteNavigationManagerProps) {
  const t = useTranslations('BureauNavigationPage')
  const [items, setItems] = useState(menu)
  const [removal, setRemoval] = useState<Removal>()
  const [menuError, setMenuError] = useState<string>()
  const [linkEditing, setLinkEditing] = useState<LinkEditing | null>(null)
  const [, startTransition] = useTransition()
  const linkReturnFocus = useRef<HTMLElement | null>(null)

  /** Le bouton qui ouvre le `dialog` reprend le focus a sa fermeture. */
  const openLinkDialog = (next: LinkEditing) => {
    linkReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setLinkEditing(next)
  }

  const addablePages = pages.filter(
    (candidate) =>
      !items.some(
        (item) => item.kind === 'page' && item.pageId === candidate.id
      )
  )

  const apply = (
    run: () => Promise<SiteNavigationActionResult | SiteNavigationAddResult>
  ) => {
    setMenuError(undefined)
    startTransition(async () => {
      try {
        const result = await run()
        if (result.status === 'error') setMenuError(result.message)
      } catch {
        setMenuError(t('errors.failed'))
      }
    })
  }

  const reorder = (nextItems: MenuItemDTO[]) => {
    setItems(nextItems)
    apply(() => reorderAction(nextItems.map((item) => item.id)))
  }

  const toggleVisibility = (item: MenuItemDTO) => {
    const visible = !item.visible
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? {...candidate, visible} : candidate
      )
    )
    apply(() => setVisibilityAction(item.id, visible))
  }

  const remove = (item: MenuItemDTO) => {
    setRemoval({previousMenu: items, removed: item})
    setItems((current) =>
      current.filter((candidate) => candidate.id !== item.id)
    )
    apply(() => removeAction(item.id))

    setTimeout(() => setRemoval(undefined), UNDO_WINDOW_MS)
  }

  /**
   * Annuler un retrait remet l'entree **a sa place** : la ligne recreee porte
   * un identifiant neuf, l'ordre precedent est donc rejoue avec celui-ci.
   */
  const undoRemoval = () => {
    if (!removal) return
    const {previousMenu, removed} = removal
    setRemoval(undefined)
    setMenuError(undefined)

    startTransition(async () => {
      try {
        const recreated = await recreate(removed)
        if (recreated.status === 'error') {
          setMenuError(recreated.message)
          return
        }

        const restored = previousMenu.map((item) =>
          item.id === removed.id ? recreated.item : item
        )
        setItems(restored)
        await reorderAction(restored.map((item) => item.id))
      } catch {
        setMenuError(t('errors.failed'))
      }
    })
  }

  /**
   * Une entree de page se recree par sa page ; une entree libre par son
   * libelle et son adresse — jamais par une page qu'elle n'a pas.
   */
  const recreate = async (
    removed: MenuItemDTO
  ): Promise<
    {status: 'ok'; item: MenuItemDTO} | {status: 'error'; message: string}
  > => {
    if (removed.kind === 'page') {
      const result = await addAction(removed.pageId)
      return result.status === 'added'
        ? {status: 'ok', item: result.item}
        : result
    }

    const result = await addLinkAction(undefined, linkFormData(removed))
    if (result.status === 'saved') return {status: 'ok', item: result.item}
    return {
      status: 'error',
      message: result.status === 'error' ? result.message : t('errors.failed'),
    }
  }

  const onLinkSaved = (saved: MenuLinkItemDTO) => {
    setItems((current) =>
      current.some((item) => item.id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved]
    )
    setLinkEditing(null)
  }

  const add = (pageId: string) => {
    setMenuError(undefined)
    startTransition(async () => {
      try {
        const result = await addAction(pageId)
        if (result.status === 'error') {
          setMenuError(result.message)
          return
        }
        setItems((current) => [...current, result.item])
      } catch {
        setMenuError(t('errors.failed'))
      }
    })
  }

  return (
    <div className="flex w-full max-w-190 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
        {t('title')}
      </h1>

      <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
        <CardHeader className="px-0">
          <CardTitle>
            <h2 className="text-xl leading-snug font-semibold">
              {t('menu.title')}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          {menuError && (
            <Alert variant="destructive" className="border-destructive">
              <AlertCircle strokeWidth={1.75} />
              <AlertTitle>{t('errors.title')}</AlertTitle>
              <AlertDescription className="text-foreground">
                {menuError}
              </AlertDescription>
            </Alert>
          )}

          {items.length === 0 ? (
            <p className="text-muted-foreground text-[17px]">
              {t('menu.empty')}
            </p>
          ) : (
            <SortableList
              items={items}
              getId={(item) => item.id}
              getLabel={labelOf}
              onReorder={(nextItems) => reorder(nextItems)}
              renderItem={(item) => (
                <MenuItemRow
                  item={item}
                  onToggleVisibility={() => toggleVisibility(item)}
                  onRemove={() => remove(item)}
                  onEdit={
                    item.kind === 'link'
                      ? () => openLinkDialog({mode: 'edit', item})
                      : undefined
                  }
                />
              )}
            />
          )}

          {removal && (
            <div
              role="status"
              className="bg-warning text-warning-foreground flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3 text-[15px]"
            >
              <span>
                {t('menu.removedBanner', {title: labelOf(removal.removed)})}
              </span>
              <Button type="button" variant="outline" onClick={undoRemoval}>
                {t('menu.undo')}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <AddMenuEntry pages={addablePages} onAdd={add} />
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full sm:h-11 sm:w-auto"
              onClick={() => openLinkDialog({mode: 'add'})}
            >
              <Plus aria-hidden="true" className="size-4" />
              {t('menu.addLink')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <MenuLinkDialog
        editing={linkEditing}
        onClose={() => setLinkEditing(null)}
        onSaved={onLinkSaved}
        returnFocus={linkReturnFocus}
        addLinkAction={addLinkAction}
        updateLinkAction={updateLinkAction}
      />

      <SiteFooterCard content={footerContent} saveAction={saveFooterAction} />
    </div>
  )
}

function MenuItemRow({
  item,
  onToggleVisibility,
  onRemove,
  onEdit,
}: {
  item: MenuItemDTO
  onToggleVisibility: () => void
  onRemove: () => void
  /** Present pour une entree libre seulement : une page ne se modifie pas ici. */
  onEdit?: () => void
}) {
  const t = useTranslations('BureauNavigationPage')
  const switchId = `menu-item-visible-${item.id}`

  return (
    <div className="flex flex-col gap-3">
      {item.kind === 'page' ? (
        <PageEntryHeading item={item} />
      ) : (
        <LinkEntryHeading item={item} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id={switchId}
            checked={item.visible}
            onCheckedChange={onToggleVisibility}
          />
          <Label htmlFor={switchId} className="text-[15px]">
            {t('menu.visible')}
          </Label>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full sm:h-11 sm:w-auto"
              onClick={onEdit}
            >
              {t('menu.edit')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto"
            onClick={onRemove}
          >
            <X aria-hidden="true" className="size-4" />
            {t('menu.remove')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PageEntryHeading({item}: {item: MenuPageItemDTO}) {
  const t = useTranslations('BureauNavigationPage')

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[17px] font-medium">{item.pageTitle}</span>
        <Badge variant="outline" className="gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-2 rounded-full',
              STATUS_DOT_CLASS[item.pageStatus]
            )}
          />
          {t(`status.${item.pageStatus}`)}
        </Badge>
      </div>

      {item.pageStatus !== 'published' && (
        <p className="text-muted-foreground text-[15px]">
          {t('menu.hiddenBecauseUnpublished')}
        </p>
      )}
    </>
  )
}

/**
 * Une entree libre n'a pas de badge — un badge est un statut. Le **mot** ecrit
 * distingue l'adresse du site d'un autre site ; l'adresse est en `data`,
 * coupee n'importe ou pour ne jamais faire defiler la ligne.
 */
function LinkEntryHeading({item}: {item: MenuLinkItemDTO}) {
  const t = useTranslations('BureauNavigationPage')

  return (
    <>
      <span className="text-[17px] font-medium">{item.label}</span>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[15px]">
        {item.target === 'external' && (
          <ExternalLink aria-hidden="true" className="size-4" />
        )}
        {item.target !== 'refused' && (
          <span>
            {item.target === 'internal'
              ? t('menu.linkInternal')
              : t('menu.linkExternal')}
          </span>
        )}
        <span className="text-foreground font-mono text-[15px] [overflow-wrap:anywhere]">
          {item.address}
        </span>
      </p>

      {item.target === 'refused' && (
        <p className="text-muted-foreground text-[15px]">
          {t('menu.hiddenBecauseRefused')}
        </p>
      )}
    </>
  )
}

/**
 * Selecteur des pages pas encore au menu (`command`, recherche). Une page deja
 * presente n'y figure pas : la contrainte unique de la base n'est qu'un dernier
 * recours.
 */
function AddMenuEntry({
  pages,
  onAdd,
}: {
  pages: PageDTO[]
  onAdd: (pageId: string) => void
}) {
  const t = useTranslations('BureauNavigationPage')
  const [open, setOpen] = useState(false)

  const select = (pageId: string) => {
    setOpen(false)
    onAdd(pageId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('menu.addPage')}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[22rem] p-0">
        <Command>
          <CommandInput
            placeholder={t('menu.searchPlaceholder')}
            aria-label={t('menu.searchLabel')}
          />
          <CommandList>
            <CommandEmpty>{t('menu.noResult')}</CommandEmpty>
            <CommandGroup>
              {pages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={page.title}
                  onSelect={() => select(page.id)}
                  className="flex items-center justify-between gap-3"
                >
                  <span>{page.title}</span>
                  <Badge variant="outline">{t(`status.${page.status}`)}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SiteFooterCard({
  content,
  saveAction,
}: {
  content: string
  saveAction: (content: string) => Promise<SiteNavigationActionResult>
}) {
  const t = useTranslations('BureauNavigationPage')
  const [value, setValue] = useState(content)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<
    {status: 'success'} | {status: 'error'; message: string}
  >()

  const save = async () => {
    setFeedback(undefined)
    setIsSaving(true)
    try {
      const result = await saveAction(value)
      setFeedback(
        result.status === 'ok'
          ? {status: 'success'}
          : {status: 'error', message: result.message}
      )
    } catch {
      setFeedback({status: 'error', message: t('errors.failed')})
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
      <CardHeader className="px-0">
        <CardTitle>
          <h2 className="text-xl leading-snug font-semibold">
            {t('footer.title')}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {feedback?.status === 'error' && (
          <Alert variant="destructive" className="border-destructive">
            <AlertCircle strokeWidth={1.75} />
            <AlertTitle>{t('errors.title')}</AlertTitle>
            <AlertDescription className="text-foreground">
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}
        {feedback?.status === 'success' && (
          <Alert role="status">
            <CircleCheck className="text-primary" strokeWidth={1.75} />
            <AlertDescription className="text-foreground">
              {t('footer.success')}
            </AlertDescription>
          </Alert>
        )}

        <RestrictedMarkdownEditor
          value={value}
          onChange={setValue}
          label={t('footer.label')}
        />
        <p className="text-muted-foreground text-[15px]">{t('footer.help')}</p>

        <Button
          type="button"
          disabled={isSaving}
          onClick={save}
          className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-64 sm:self-start"
        >
          {isSaving ? t('footer.saving') : t('footer.save')}
        </Button>
      </CardContent>
    </Card>
  )
}

const FIELD_MESSAGE_CLASS = 'text-base font-medium'
const FIELD_INVALID_CLASS = 'aria-invalid:border-2'

/**
 * Le `dialog` d'une entree libre (s50, question 1 du plan : option `dialog`) :
 * le meme pour l'ajout et la modification, deux champs (§2.1). Plein ecran
 * sous 640 px, comme celui des categories.
 */
function MenuLinkDialog({
  editing,
  onClose,
  onSaved,
  returnFocus,
  addLinkAction,
  updateLinkAction,
}: {
  editing: LinkEditing | null
  onClose: () => void
  onSaved: (item: MenuLinkItemDTO) => void
  returnFocus: React.RefObject<HTMLElement | null>
  addLinkAction: MenuLinkFormAction
  updateLinkAction: MenuLinkFormAction
}) {
  const t = useTranslations('BureauNavigationPage.linkDialog')

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none"
        onCloseAutoFocus={(event) => {
          if (!returnFocus.current?.isConnected) return
          event.preventDefault()
          returnFocus.current.focus()
        }}
      >
        {editing && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">
                {editing.mode === 'add' ? t('addTitle') : t('editTitle')}
              </DialogTitle>
              {editing.mode === 'edit' && (
                <DialogDescription className="text-[15px]">
                  {t('editLegend')}
                </DialogDescription>
              )}
            </DialogHeader>
            <MenuLinkForm
              key={editing.mode === 'edit' ? editing.item.id : 'add'}
              editing={editing}
              onCancel={onClose}
              onSaved={onSaved}
              action={editing.mode === 'add' ? addLinkAction : updateLinkAction}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MenuLinkForm({
  editing,
  onCancel,
  onSaved,
  action,
}: {
  editing: LinkEditing
  onCancel: () => void
  onSaved: (item: MenuLinkItemDTO) => void
  action: MenuLinkFormAction
}) {
  const t = useTranslations('BureauNavigationPage')
  const item = editing.mode === 'edit' ? editing.item : undefined
  const form = useForm<MenuLinkFormSchemaType>({
    resolver: zodResolver(createMenuLinkFormSchema(t)),
    defaultValues: {label: item?.label ?? '', address: item?.address ?? ''},
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: false,
  })
  const {errors, isSubmitting} = form.formState
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [focusRequest, setFocusRequest] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)
  const idPrefix = useId()
  const fieldIds = {label: `${idPrefix}-label`, address: `${idPrefix}-address`}
  const label = useWatch({control: form.control, name: 'label'})
  const labelOverflows = menuLinkLabelExcess(label) > 0
  const invalidFields = MENU_LINK_FORM_FIELDS.flatMap((field) => {
    const message = errors[field]?.message
    return message ? [{field, message}] : []
  })

  useEffect(() => {
    if (focusRequest > 0) summaryRef.current?.focus()
  }, [focusRequest])

  const requestFocus = () => {
    setSubmitted(true)
    setFocusRequest((count) => count + 1)
  }

  const onValid = async (values: MenuLinkFormSchemaType) => {
    setFailure(undefined)
    try {
      const result = await action(undefined, linkFormData(values, item?.id))
      if (result.status === 'saved') {
        onSaved(result.item)
      } else if (result.status === 'invalid') {
        for (const error of result.errors) {
          form.setError(error.field, {message: error.message})
        }
        requestFocus()
      } else {
        setFailure(result.message)
      }
    } catch {
      setFailure(t('errors.failed'))
    }
  }

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(onValid, requestFocus)}
      >
        {submitted && invalidFields.length > 0 && (
          <Alert
            ref={summaryRef}
            tabIndex={-1}
            variant="destructive"
            className="border-destructive border-2"
          >
            <AlertCircle strokeWidth={1.75} />
            <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
              {t('errors.summary', {count: invalidFields.length})}
            </AlertTitle>
            <AlertDescription className="text-foreground">
              <ul className="flex list-none flex-col gap-1">
                {invalidFields.map(({field, message}) => (
                  <li key={field}>
                    <a
                      href={`#${fieldIds[field]}`}
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
        {failure && (
          <Alert variant="destructive" className="border-destructive border-2">
            <AlertCircle strokeWidth={1.75} />
            <AlertTitle>{t('errors.title')}</AlertTitle>
            <AlertDescription className="text-foreground">
              {failure}
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="label"
          render={({field}) => (
            <FormItem>
              <FormLabel htmlFor={fieldIds.label} className="text-base">
                {t('linkDialog.label')}
              </FormLabel>
              <FormControl>
                <Input
                  id={fieldIds.label}
                  className={cn(
                    FIELD_INVALID_CLASS,
                    labelOverflows && 'border-destructive border-2'
                  )}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[15px]">
                {t('linkDialog.labelHelp')}
              </FormDescription>
              <p
                className={cn(
                  'text-right text-[15px] tabular-nums',
                  labelOverflows
                    ? 'text-destructive-text font-semibold'
                    : 'text-muted-foreground'
                )}
              >
                {t('linkDialog.counter', {
                  count: label.trim().length,
                  max: MENU_LINK_LABEL_MAX_LENGTH,
                })}
              </p>
              <FormMessage className={FIELD_MESSAGE_CLASS} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({field}) => (
            <FormItem>
              <FormLabel htmlFor={fieldIds.address} className="text-base">
                {t('linkDialog.address')}
              </FormLabel>
              <FormControl>
                <Input
                  id={fieldIds.address}
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={cn(FIELD_INVALID_CLASS, 'font-mono')}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[15px]">
                {t('linkDialog.addressHelp')}
              </FormDescription>
              <FormMessage className={FIELD_MESSAGE_CLASS} />
            </FormItem>
          )}
        />

        <DialogFooter className="flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full sm:h-11 sm:w-auto"
            onClick={onCancel}
          >
            {t('linkDialog.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-14 w-full sm:h-11 sm:w-auto"
          >
            {editing.mode === 'add'
              ? isSubmitting
                ? t('linkDialog.adding')
                : t('linkDialog.add')
              : isSubmitting
                ? t('linkDialog.saving')
                : t('linkDialog.save')}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
