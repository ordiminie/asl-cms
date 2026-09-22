'use client'

import {AlertCircle, CircleCheck, Plus, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

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
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {SortableList} from '@/components/ui/sortable-list'
import {Switch} from '@/components/ui/switch'
import {cn} from '@/lib/utils'
import {PageDTO, PageStatus} from '@/services/types/domain/page-types'
import {MenuItemDTO} from '@/services/types/domain/site-navigation-types'

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
  {status: 'added'; item: MenuItemDTO} | {status: 'error'; message: string}

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
}: SiteNavigationManagerProps) {
  const t = useTranslations('BureauNavigationPage')
  const [items, setItems] = useState(menu)
  const [removal, setRemoval] = useState<Removal>()
  const [menuError, setMenuError] = useState<string>()
  const [, startTransition] = useTransition()

  const addablePages = pages.filter(
    (candidate) => !items.some((item) => item.pageId === candidate.id)
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
        const result = await addAction(removed.pageId)
        if (result.status === 'error') {
          setMenuError(result.message)
          return
        }

        const restored = previousMenu.map((item) =>
          item.id === removed.id ? result.item : item
        )
        setItems(restored)
        await reorderAction(restored.map((item) => item.id))
      } catch {
        setMenuError(t('errors.failed'))
      }
    })
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
              getLabel={(item) => item.pageTitle}
              onReorder={(nextItems) => reorder(nextItems)}
              renderItem={(item) => (
                <MenuItemRow
                  item={item}
                  onToggleVisibility={() => toggleVisibility(item)}
                  onRemove={() => remove(item)}
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
                {t('menu.removedBanner', {title: removal.removed.pageTitle})}
              </span>
              <Button type="button" variant="outline" onClick={undoRemoval}>
                {t('menu.undo')}
              </Button>
            </div>
          )}

          <AddMenuEntry pages={addablePages} onAdd={add} />
        </CardContent>
      </Card>

      <SiteFooterCard content={footerContent} saveAction={saveFooterAction} />
    </div>
  )
}

function MenuItemRow({
  item,
  onToggleVisibility,
  onRemove,
}: {
  item: MenuItemDTO
  onToggleVisibility: () => void
  onRemove: () => void
}) {
  const t = useTranslations('BureauNavigationPage')
  const switchId = `menu-item-visible-${item.id}`

  return (
    <div className="flex flex-col gap-3">
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
          className="h-14 w-full sm:h-11 sm:w-auto sm:self-start"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('menu.add')}
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
