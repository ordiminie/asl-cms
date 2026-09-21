'use client'

import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useTransition} from 'react'

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
import {PageDTO} from '@/services/types/domain/page-types'

const STATUS_DOT_CLASS: Record<PageDTO['status'], string> = {
  draft: 'bg-[oklch(0.72_0.14_75)]',
  published: 'bg-[oklch(0.68_0.15_150)]',
  unpublished: 'bg-[oklch(0.72_0.02_250)]',
}

/**
 * Liste des pages du bureau (ecran 1 du design s04) : une seule action en
 * clair par ligne, et un statut qui se lit a son point **et** a son libelle
 * ecrit, jamais a la couleur seule.
 */
export function PagesList({
  pages,
  createAction,
}: {
  pages: PageDTO[]
  createAction: () => Promise<void>
}) {
  const t = useTranslations('BureauPagesPage')
  const [isPending, startTransition] = useTransition()

  const create = () => startTransition(() => createAction())

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
          {t('newPage.action')}
        </Button>
      </div>

      <Card className="border-0 sm:border">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>{t('tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {pages.length === 0 ? (
            <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.title')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('columns.updatedAt')}
                  </TableHead>
                  <TableHead>{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell>
                      <div className="font-medium">{page.title}</div>
                      <div className="text-muted-foreground text-sm">
                        /{page.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 rounded-full',
                            STATUS_DOT_CLASS[page.status]
                          )}
                        />
                        {t(`status.${page.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {page.updatedAt.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="outline"
                        className="h-14 w-full sm:h-11 sm:w-auto"
                      >
                        <Link href={`/bureau/pages/${page.id}`}>
                          {t('edit')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
