'use client'

import {AlertCircle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {cn} from '@/lib/utils'
import {NewsListPageDTO, NewsStatus} from '@/services/types/domain/news-types'

/**
 * Statut -> token du design system (§1.1), exactement la correspondance de la
 * liste des pages (s04) : jamais une couleur choisie a la main, et jamais de
 * vert — ce systeme n'en a pas.
 */
const STATUS_DOT_CLASS: Record<NewsStatus, string> = {
  draft: 'bg-muted-foreground',
  published: 'bg-accent-solid',
  unpublished: 'bg-warning-border',
}

/** Un `redirect()` de Next voyage avec un `digest` prefixe `NEXT_REDIRECT`. */
const isNavigationSignal = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'digest' in error &&
  String((error as {digest: unknown}).digest).startsWith('NEXT_REDIRECT')

/** `2026-09-02` -> `02/09/2026`, sans passer par un fuseau. */
const toFrenchDate = (isoDate: string): string =>
  isoDate.split('-').reverse().join('/')

/**
 * La date du jour **du navigateur du bureau**, au format ISO. Elle est envoyee
 * a la Server Action : le service ne lit pas l'horloge, et la date proposee
 * reste celle que le bureau a sous les yeux.
 */
const todayIso = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Liste des actualites du bureau (ecran 1 du design s05) : une seule action en
 * clair par ligne, et un statut qui se lit a son point **et** a son libelle
 * ecrit.
 */
export function NewsList({
  list,
  createAction,
}: {
  list: NewsListPageDTO
  createAction: (publishedOn: string) => Promise<void>
}) {
  const t = useTranslations('BureauNewsPage')
  const [isPending, startTransition] = useTransition()
  const [createError, setCreateError] = useState<string>()

  const create = () => {
    setCreateError(undefined)
    startTransition(async () => {
      try {
        await createAction(todayIso())
      } catch (error) {
        if (isNavigationSignal(error)) return
        setCreateError(t('errors.createFailed'))
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <Button
          type="button"
          className="h-14 w-full sm:h-11 sm:w-auto"
          disabled={isPending}
          onClick={create}
        >
          {t('newNews.action')}
        </Button>
      </div>

      {createError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('errors.createFailedTitle')}</AlertTitle>
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 sm:border">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>{t('tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-4 sm:px-6">
          {list.items.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
              <Button
                type="button"
                variant="outline"
                className="h-14 w-full sm:h-11 sm:w-auto"
                disabled={isPending}
                onClick={create}
              >
                {t('emptyAction')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.title')}</TableHead>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead>{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.title}</div>
                      {item.slug && (
                        <div className="text-muted-foreground text-sm">
                          /actualites/{item.slug}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {toFrenchDate(item.publishedOn)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 rounded-full',
                            STATUS_DOT_CLASS[item.status]
                          )}
                        />
                        {t(`status.${item.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="outline"
                        className="h-14 w-full sm:h-11 sm:w-auto"
                      >
                        <Link href={`/bureau/actualites/${item.id}`}>
                          {t('edit')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {list.items.length > 0 && (
            <nav
              className="flex flex-wrap items-center justify-between gap-3"
              aria-label={t('title')}
            >
              <PageLink
                page={list.page - 1}
                disabled={list.page <= 1}
                label={t('pagination.previous')}
              />
              <span className="text-muted-foreground text-[15px]">
                {t('pagination.position', {
                  page: list.page,
                  total: list.totalPages,
                })}
              </span>
              <PageLink
                page={list.page + 1}
                disabled={list.page >= list.totalPages}
                label={t('pagination.next')}
              />
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Un controle de pagination desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste, pas seulement le deviner.
 */
function PageLink({
  page,
  disabled,
  label,
}: {
  page: number
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-14 sm:h-11"
        disabled
        aria-disabled="true"
      >
        {label}
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" className="h-14 sm:h-11">
      <Link href={`/bureau/actualites?page=${page}`}>{label}</Link>
    </Button>
  )
}
