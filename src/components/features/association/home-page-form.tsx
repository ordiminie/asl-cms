'use client'

import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  TriangleAlert,
} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {ReactNode, useId, useState, useTransition} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {cn} from '@/lib/utils'
import {HomePageForBureauDTO} from '@/services/types/domain/home-page-types'
import {PageStatus} from '@/services/types/domain/page-types'

export type HomePageActionResult =
  | {status: 'saved'}
  | {status: 'not_published'; message: string}
  | {status: 'error'; message: string}

type HomePageChoice = 'automatic' | 'page'

type BureauPageOption = {id: string; title: string; status: PageStatus}

type CurrentHomePage = HomePageForBureauDTO['page']

type HomePageFormProps = {
  current: CurrentHomePage
  pages: BureauPageOption[]
  saveAction: (pageId: string | null) => Promise<HomePageActionResult>
}

type Notice = {kind: 'page'; title: string} | {kind: 'automatic'}

const unpublishedOf = (page: CurrentHomePage): BureauPageOption | null =>
  page !== null && page.status !== 'published' ? page : null

/**
 * Ecran « Page d'accueil » du bureau (design s44, ecran 1, etats a a f).
 *
 * Deux choix : l'accueil automatique, ou une page **publiee** du site. Sans
 * page publiee, le second choix est desactive et la raison est ecrite (etat
 * c). Une page designee puis depubliee reste choisie, signalee par un
 * avertissement en tete de carte (etat d). Succes et echec sont des `alert`
 * ancrees, jamais des toasts ; un seul bouton `default`.
 */
export function HomePageForm({current, pages, saveAction}: HomePageFormProps) {
  const t = useTranslations('BureauHomePage')
  const fieldId = useId()

  const publishedPages = pages.filter((page) => page.status === 'published')
  const canChoosePage = publishedPages.length > 0

  const [saved, setSaved] = useState<CurrentHomePage>(current)
  const [choice, setChoice] = useState<HomePageChoice>(
    current && (canChoosePage || !unpublishedOf(current)) ? 'page' : 'automatic'
  )
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(
    current?.id ?? publishedPages[0]?.id
  )
  const [notice, setNotice] = useState<Notice>()
  const [failure, setFailure] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const unpublished = unpublishedOf(saved)

  const save = () => {
    if (isPending) return
    const pageId = choice === 'page' ? (selectedPageId ?? null) : null
    setNotice(undefined)
    setFailure(undefined)

    startTransition(async () => {
      try {
        const result = await saveAction(pageId)
        if (result.status !== 'saved') {
          setFailure(result.message)
          return
        }

        const chosen = publishedPages.find((page) => page.id === pageId)
        setSaved(chosen ?? null)
        setNotice(
          chosen ? {kind: 'page', title: chosen.title} : {kind: 'automatic'}
        )
      } catch {
        setFailure(t('errors.failed'))
      }
    })
  }

  return (
    <div className="flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">{t('intro')}</p>
      </div>

      <Card className="gap-4 px-4 py-4 shadow-none sm:px-6 sm:py-6">
        <CardHeader className="gap-1 px-0">
          <CardTitle>
            <h3 className="text-xl leading-snug font-semibold">
              {t('cardTitle')}
            </h3>
          </CardTitle>
          <p className="text-muted-foreground text-[15px]">
            {currentStatusOf(saved, t)}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 px-0">
          {unpublished && (
            <Alert className="border-warning-border bg-warning text-warning-foreground">
              <TriangleAlert strokeWidth={1.75} />
              <AlertDescription className="text-warning-foreground text-[15px]">
                <p>{t('warning.body', {title: unpublished.title})}</p>
                <Link
                  href={`/bureau/pages/${unpublished.id}`}
                  className="underline underline-offset-4"
                >
                  {t('warning.open')}
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <RadioGroup
            aria-label={t('choices.label')}
            value={choice}
            onValueChange={(value) => setChoice(value as HomePageChoice)}
            className="gap-3"
          >
            <ChoiceOption
              id={`${fieldId}-automatic`}
              value="automatic"
              selected={choice === 'automatic'}
              label={t('choices.automatic.label')}
              help={t('choices.automatic.help')}
            />
            <ChoiceOption
              id={`${fieldId}-page`}
              value="page"
              selected={choice === 'page'}
              disabled={!canChoosePage}
              label={t('choices.page.label')}
              help={t('choices.page.help')}
            >
              {!canChoosePage && (
                <p className="text-[15px]">
                  {t('choices.page.noPublished')}{' '}
                  <Link
                    href="/bureau/pages"
                    className="text-foreground underline underline-offset-4"
                  >
                    {t('choices.page.publish')}
                  </Link>
                </p>
              )}
            </ChoiceOption>
          </RadioGroup>

          {choice === 'page' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-select`}>{t('select.label')}</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger
                  id={`${fieldId}-select`}
                  aria-describedby={`${fieldId}-select-help`}
                  className="h-14 w-full text-[17px] sm:h-12"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unpublished && (
                    <SelectItem value={unpublished.id} disabled>
                      {t('select.unpublished', {title: unpublished.title})}
                    </SelectItem>
                  )}
                  {publishedPages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                id={`${fieldId}-select-help`}
                className="text-muted-foreground text-[15px]"
              >
                {t('select.help')}
              </p>
            </div>
          )}

          {failure && (
            <Alert
              variant="destructive"
              className="border-destructive border-2"
            >
              <CircleAlert strokeWidth={1.75} />
              <AlertDescription className="text-foreground text-[15px]">
                {failure}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              disabled={isPending}
              aria-busy={isPending}
              onClick={save}
              className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-64"
            >
              {isPending ? t('actions.saving') : t('actions.save')}
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full sm:h-12 sm:w-auto"
            >
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('actions.viewLabel')}
              >
                <ExternalLink aria-hidden="true" strokeWidth={1.75} />
                {t('actions.view')}
              </a>
            </Button>
          </div>

          {notice && (
            <Alert role="status">
              <CircleCheck className="text-primary" strokeWidth={1.75} />
              <AlertDescription className="text-foreground text-[15px]">
                {notice.kind === 'page'
                  ? t('notices.savedPage', {title: notice.title})
                  : t('notices.savedAutomatic')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const currentStatusOf = (
  saved: CurrentHomePage,
  t: ReturnType<typeof useTranslations<'BureauHomePage'>>
): string => {
  if (saved === null) return t('current.automatic')
  if (saved.status !== 'published') {
    return t('current.unpublished', {title: saved.title})
  }
  return t('current.page', {title: saved.title})
}

/**
 * Un choix du `radio-group` : selectionne, bordure 2 px `primary` et point
 * `primary` — jamais la couleur seule ; desactive, fond `muted` et la raison
 * ecrite dessous (`children`).
 */
function ChoiceOption({
  id,
  value,
  selected,
  disabled = false,
  label,
  help,
  children,
}: {
  id: string
  value: HomePageChoice
  selected: boolean
  disabled?: boolean
  label: string
  help: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-4',
        selected ? 'border-primary border-2' : 'border-border',
        disabled && 'bg-muted text-muted-foreground'
      )}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={`${id}-help`}
          className="mt-1"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={id} className="text-[16px] font-medium">
            {label}
          </Label>
          <p id={`${id}-help`} className="text-[17px]">
            {help}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
