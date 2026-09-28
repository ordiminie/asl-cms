import {CircleCheck} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {contentFileUrl} from '@/services/types/domain/content-file-types'
import {
  formatFileWeight,
  WaterAnalysisListPageDTO,
} from '@/services/types/domain/water-analysis-types'

/** Ce que la liste confirme apres une publication, une correction ou une suppression. */
export type WaterAnalysisNotice = 'published' | 'saved' | 'deleted'

const LIST_PATH = '/bureau/analyses-eau'
const NEW_PATH = '/bureau/analyses-eau/nouvelle'

/**
 * Liste des analyses d'eau du bureau (design s09, ecran 1) : la date du
 * prelevement, une vignette, le **poids** du PDF — jamais le nom du fichier —
 * et un seul lien « Modifier » par ligne. Aucun statut : toute analyse listee
 * est en ligne. Sous 640 px, le tableau devient une pile de cartes.
 */
export function WaterAnalysisList({
  list,
  notice,
}: {
  list: WaterAnalysisListPageDTO
  notice?: WaterAnalysisNotice
}) {
  const t = useTranslations('BureauWaterAnalysisPage')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={NEW_PATH}>{t('newAction')}</Link>
        </Button>
      </div>

      {notice && (
        <Alert role="status">
          <CircleCheck className="text-primary" />
          <AlertDescription>{t(`notice.${notice}`)}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-none sm:border">
        <CardHeader className="px-0 sm:px-6">
          <CardTitle>{t('tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-0 sm:px-6">
          {list.items.length === 0 ? (
            <p className="text-[17px]">
              {t('empty')}{' '}
              <Link href={NEW_PATH} className="underline underline-offset-4">
                → {t('emptyAction')}
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader className="max-sm:sr-only">
                <TableRow>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.poster')}</TableHead>
                  <TableHead>{t('columns.report')}</TableHead>
                  <TableHead>{t('columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((item) => {
                  const date = isoToFrenchDate(item.sampledOn)
                  return (
                    <TableRow
                      key={item.id}
                      className="max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:rounded-lg max-sm:border max-sm:p-4"
                    >
                      <TableCell className="font-mono text-[17px] tabular-nums max-sm:p-0 max-sm:text-[20px] max-sm:font-semibold">
                        {date}
                      </TableCell>
                      <TableCell className="max-sm:flex max-sm:items-center max-sm:justify-between max-sm:p-0">
                        <span
                          aria-hidden="true"
                          className="text-muted-foreground text-[15px] sm:hidden"
                        >
                          {t('columns.poster')}
                        </span>
                        <Image
                          src={contentFileUrl(item.posterKey)}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="size-11 rounded-md object-cover"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[15px] tabular-nums max-sm:flex max-sm:items-center max-sm:justify-between max-sm:p-0">
                        <span aria-hidden="true" className="sm:hidden">
                          {t('columns.report')}
                        </span>
                        {formatFileWeight(item.reportBytes)}
                      </TableCell>
                      <TableCell className="max-sm:p-0">
                        <Button
                          asChild
                          variant="outline"
                          className="h-14 w-full sm:h-11 sm:w-auto"
                        >
                          <Link href={`${LIST_PATH}/${item.id}`}>
                            {t('edit')}
                            <span className="sr-only">
                              {' '}
                              {t('editLabel', {date})}
                            </span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {list.items.length > 0 && (
            <nav
              className="flex flex-wrap items-center justify-between gap-3"
              aria-label={t('pagination.label')}
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
      <Link href={`${LIST_PATH}?page=${page}`}>{label}</Link>
    </Button>
  )
}
