import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {cn} from '@/lib/utils'
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import type {
  IncidentReportListItemDTO,
  IncidentReportListPageDTO,
} from '@/services/types/domain/incident-report-types'

import {
  REPORT_CATEGORIES_PATH,
  reportPathOf,
  REPORTS_PATH,
} from './report-paths'
import {ReportStatusBadges} from './report-status-badges'

/**
 * File de suivi des signalements (ecran 2 du design s10) : triee par date
 * decroissante par le service, 25 lignes par page. Un tableau en desktop, des
 * cartes empilees sous 640 px (§3.5), les deux dans l'ordre des colonnes, la
 * meme pagination serveur (decision H).
 */
export function IncidentReportList({list}: {list: IncidentReportListPageDTO}) {
  const t = useTranslations('BureauReportsPage')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[34px] leading-tight font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-[15px]">
            {t('counts', {
              reported: list.counts.reported,
              inProgress: list.counts.in_progress,
            })}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          <Link href={REPORT_CATEGORIES_PATH}>{t('manageCategories')}</Link>
        </Button>
      </div>

      {list.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <ReportsTable items={list.items} />
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.items.map((item) => (
              <li key={item.id}>
                <ReportCard item={item} />
              </li>
            ))}
          </ul>
          <Pagination page={list.page} totalPages={list.totalPages} />
        </>
      )}
    </div>
  )
}

function ReportsTable({items}: {items: IncidentReportListItemDTO[]}) {
  return (
    <Table>
      <ReportsTableHeader />
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="h-14">
            <TableCell className="px-4">
              <CategoryName item={item} />
            </TableCell>
            <TableCell className="max-w-64 truncate text-[17px]">
              {item.location}
            </TableCell>
            <TableCell>
              <Reporter item={item} />
            </TableCell>
            <TableCell>
              <ReceivedOn createdAt={item.createdAt} />
            </TableCell>
            <TableCell>
              <ReportStatusBadges
                status={item.status}
                notificationFailed={item.notificationFailed}
              />
            </TableCell>
            <TableCell>
              <OpenReport id={item.id} className="h-11" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ReportCard({item}: {item: IncidentReportListItemDTO}) {
  const t = useTranslations('BureauReportsPage')

  return (
    <Card
      data-testid="incident-report-card"
      className="gap-3 px-4 py-4 shadow-none"
    >
      <h2 className="text-lg leading-snug">
        <CategoryName item={item} />
      </h2>
      <ReportStatusBadges
        status={item.status}
        notificationFailed={item.notificationFailed}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.location')}</dt>
        <dd className="break-words">{item.location}</dd>
        <dt className="text-muted-foreground">{t('columns.reporter')}</dt>
        <dd>
          <Reporter item={item} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.receivedAt')}</dt>
        <dd>
          <ReceivedOn createdAt={item.createdAt} />
        </dd>
      </dl>
      <OpenReport id={item.id} className="h-14 w-full" />
    </Card>
  )
}

/**
 * Le nom de la categorie, meme supprimee depuis — suivi alors de la mention
 * en `meta` (critere 5) ; « Sans categorie » quand il n'y en a pas.
 */
function CategoryName({item}: {item: IncidentReportListItemDTO}) {
  const t = useTranslations('BureauReportsPage')

  if (!item.categoryName) {
    return (
      <span className="text-muted-foreground text-[17px]">
        {t('noCategory')}
      </span>
    )
  }

  return (
    <>
      <span className="text-[17px] font-semibold">{item.categoryName}</span>
      {item.categoryDeleted && (
        <span className="text-muted-foreground block text-[15px]">
          {t('categoryDeleted')}
        </span>
      )}
    </>
  )
}

/** Le nom, sinon l'email, sinon le telephone, sinon « Anonyme ». */
function Reporter({item}: {item: IncidentReportListItemDTO}) {
  const t = useTranslations('BureauReportsPage')
  const [first, second] = [
    item.reporterName,
    item.reporterEmail,
    item.reporterPhone,
  ].filter((value): value is string => Boolean(value))

  if (!first) {
    return <span className="text-muted-foreground">{t('anonymous')}</span>
  }

  return (
    <>
      <div className="break-all">{first}</div>
      {second && (
        <div className="text-muted-foreground text-[15px] break-all">
          {second}
        </div>
      )}
    </>
  )
}

function ReceivedOn({createdAt}: {createdAt: Date}) {
  const locale = useLocale()

  return (
    <span className="font-mono tabular-nums">
      {receivedAtPartsOf(createdAt, locale).shortDate}
    </span>
  )
}

function OpenReport({id, className}: {id: string; className?: string}) {
  const t = useTranslations('BureauReportsPage')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={reportPathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

function EmptyState() {
  const t = useTranslations('BureauReportsPage')

  return (
    <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
      <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full sm:h-11 sm:w-auto"
      >
        <Link href="/signaler">{t('emptyAction')}</Link>
      </Button>
    </Card>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste.
 */
function Pagination({page, totalPages}: {page: number; totalPages: number}) {
  const t = useTranslations('BureauReportsPage')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('title')}
    >
      <PageLink
        page={page - 1}
        disabled={page <= 1}
        label={t('pagination.previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('pagination.position', {page, total: totalPages})}
      </span>
      <PageLink
        page={page + 1}
        disabled={page >= totalPages}
        label={t('pagination.next')}
      />
    </nav>
  )
}

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
      <Link href={`${REPORTS_PATH}?page=${page}`}>{label}</Link>
    </Button>
  )
}

const REPORT_COLUMNS = [
  'category',
  'location',
  'reporter',
  'receivedAt',
  'status',
  'action',
] as const

const SKELETON_ROWS = 4

function ReportsTableHeader() {
  const t = useTranslations('BureauReportsPage')

  return (
    <TableHeader>
      <TableRow>
        {REPORT_COLUMNS.map((column, index) => (
          <TableHead key={column} className={cn(index === 0 && 'px-4')}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/**
 * Chargement de la file (etat `2.D`) : l'en-tete du tableau est deja en
 * place, seules les lignes sont en `skeleton` (§3.2).
 */
export function IncidentReportListSkeleton() {
  const rows = Array.from({length: SKELETON_ROWS}, (_, index) => index)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Card className="hidden py-0 shadow-none sm:block">
        <CardContent className="px-0">
          <Table>
            <ReportsTableHeader />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row} className="h-14">
                  {REPORT_COLUMNS.map((column, index) => (
                    <TableCell
                      key={column}
                      className={cn(index === 0 && 'px-4')}
                    >
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4 sm:hidden">
        {rows.map((row) => (
          <Skeleton key={row} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}
