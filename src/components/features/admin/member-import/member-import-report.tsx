'use client'

import {AlertTriangle, CircleCheck, Lock, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {ReactNode, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  ImportRejectionDTO,
  ImportRemarkDTO,
  ImportReportDTO,
} from '@/services/types/domain/member-import-types'

import {organizationEditPathOf} from './member-import-paths'

/** Lignes par page : 25 en tableau, 10 en cartes sous 640 px (§3.5). */
const TABLE_PAGE_SIZE = 25
const CARD_PAGE_SIZE = 10

type MemberImportReportProps = {
  report: ImportReportDTO
  fileName: string
  organizationId: string
  organizationName: string
  /** Fin de l'import, ISO 8601. */
  importedAt: string
  onImportAnother: () => void
}

type ReportKind = 'done' | 'clean' | 'nothing_new' | 'all_rejected'

const kindOf = (report: ImportReportDTO): ReportKind => {
  const wroteNothing =
    report.membersCreated === 0 && report.parcelsAttached === 0
  if (wroteNothing && report.alreadyPresent > 0) return 'nothing_new'
  if (wroteNothing && report.linesRejected > 0) return 'all_rejected'
  return report.linesRejected === 0 ? 'clean' : 'done'
}

const formatImportedAt = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))

/** Une ligne du rapport, prete a afficher : rejet ou remarque. */
type ReportRow = {key: string; line: number; client: string; text: string}

/**
 * Ecran 2 du design s13 : le rapport d'import, rendu avec le resultat de
 * l'action et conserve nulle part (ADR 047). Bilan en six chiffres, lignes
 * rejetees, lignes importees avec une remarque.
 */
export function MemberImportReport({
  report,
  fileName,
  organizationId,
  organizationName,
  importedAt,
  onImportAnother,
}: MemberImportReportProps) {
  const t = useTranslations('AdminMemberImport.report')
  const kind = kindOf(report)
  const showRemarks =
    report.remarks.length > 0 &&
    kind !== 'nothing_new' &&
    kind !== 'all_rejected'

  const rejectionRows = report.rejections.map(
    (rejection: ImportRejectionDTO): ReportRow => ({
      key: `${rejection.line}-${rejection.reason}`,
      line: rejection.line,
      client: rejection.client || t('noName'),
      text: t(`reasons.${rejection.reason}`),
    })
  )
  const remarkRows = report.remarks.map(
    (remark: ImportRemarkDTO): ReportRow => ({
      key: `${remark.line}-${remark.remark}`,
      line: remark.line,
      client: remark.client || t('noName'),
      text: t(`remarks.${remark.remark}`, {line: remark.relatedLine ?? 0}),
    })
  )

  return (
    <div className="flex w-full max-w-[960px] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          {fileName} · {organizationName} ·{' '}
          <span className="font-mono">{formatImportedAt(importedAt)}</span>
        </p>
      </div>

      <ResultBanner report={report} kind={kind} />

      <section className="flex flex-col gap-4" aria-labelledby="import-summary">
        <h2
          id="import-summary"
          className="font-serif text-[26px] font-semibold"
        >
          {t('summaryTitle')}
        </h2>
        <Summary report={report} />
        {report.alreadyPresent > 0 && (
          <Card className="py-4 shadow-none">
            <CardContent className="text-[17px]">
              {t('alreadyPresent', {count: report.alreadyPresent})}
            </CardContent>
          </Card>
        )}
      </section>

      <section
        className="flex flex-col gap-4"
        aria-labelledby="import-rejections"
      >
        <h2
          id="import-rejections"
          className="font-serif text-[26px] font-semibold"
        >
          {t('rejectionsTitle')}
        </h2>
        <p className="text-muted-foreground flex items-start gap-2 text-[14px]">
          <Lock aria-hidden="true" className="mt-0.5 size-[15px] shrink-0" />
          {t('privacy')}
        </p>
        {rejectionRows.length === 0 ? (
          <p className="text-[17px]">{t('noRejection')}</p>
        ) : (
          <>
            <p className="text-[15px]">
              {kind === 'all_rejected'
                ? t('rejectionsAllIntro')
                : t('rejectionsIntro')}
            </p>
            <PagedRows
              caption={t('rejectionsTitle')}
              textColumn={t('columns.reason')}
              rows={rejectionRows}
            />
          </>
        )}
      </section>

      {showRemarks && (
        <section
          className="flex flex-col gap-4"
          aria-labelledby="import-remarks"
        >
          <h2
            id="import-remarks"
            className="font-serif text-[26px] font-semibold"
          >
            {t('remarksTitle')}
          </h2>
          <p className="text-[15px]">{t('remarksIntro')}</p>
          <PagedRows
            caption={t('remarksTitle')}
            textColumn={t('columns.remark')}
            rows={remarkRows}
          />
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={organizationEditPathOf(organizationId)}>
            {t('backToOrganization')}
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-12 sm:w-auto"
          onClick={onImportAnother}
        >
          <Upload aria-hidden="true" />
          {t('importAnother')}
        </Button>
      </div>
    </div>
  )
}

function ResultBanner({
  report,
  kind,
}: {
  report: ImportReportDTO
  kind: ReportKind
}) {
  const t = useTranslations('AdminMemberImport.report')

  if (kind === 'all_rejected') {
    return (
      <Alert variant="destructive" className="border-2">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>{t('allRejectedTitle')}</AlertTitle>
        <AlertDescription>{t('allRejectedBody')}</AlertDescription>
      </Alert>
    )
  }

  const message: Record<Exclude<ReportKind, 'all_rejected'>, string> = {
    done: t('done', {
      created: report.membersCreated,
      toReview: report.linesRejected,
    }),
    clean: t('doneClean'),
    nothing_new: t('nothingNew'),
  }

  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" />
      <AlertTitle className="text-[17px]">{message[kind]}</AlertTitle>
    </Alert>
  )
}

function Summary({report}: {report: ImportReportDTO}) {
  const t = useTranslations('AdminMemberImport.report.summary')
  const figures: [string, number][] = [
    [t('linesRead'), report.linesRead],
    [t('membersCreated'), report.membersCreated],
    [t('accountsOpened'), report.accountsOpened],
    [t('mailOnlyMembers'), report.mailOnlyMembers],
    [t('parcelsAttached'), report.parcelsAttached],
    [t('linesRejected'), report.linesRejected],
  ]

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {figures.map(([label, value]) => (
        <Card key={label} className="gap-1 py-4 shadow-none">
          <CardContent className="flex flex-col-reverse gap-1">
            <dt className="text-muted-foreground text-[14px]">{label}</dt>
            <dd className="font-mono text-[26px] font-semibold">{value}</dd>
          </CardContent>
        </Card>
      ))}
    </dl>
  )
}

/** Un tableau pagine a 25 en ordinateur, des cartes paginees a 10 en mobile. */
function PagedRows({
  caption,
  textColumn,
  rows,
}: {
  caption: string
  textColumn: string
  rows: ReportRow[]
}) {
  const t = useTranslations('AdminMemberImport.report')
  const [tablePage, setTablePage] = useState(1)
  const [cardPage, setCardPage] = useState(1)
  const tableRows = pageOf(rows, tablePage, TABLE_PAGE_SIZE)
  const cardRows = pageOf(rows, cardPage, CARD_PAGE_SIZE)

  return (
    <>
      <div className="hidden flex-col gap-3 sm:flex">
        <Card className="py-0 shadow-none">
          <CardContent className="px-0">
            <Table aria-label={caption}>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-24 px-4">
                    {t('columns.line')}
                  </TableHead>
                  <TableHead>{t('columns.client')}</TableHead>
                  <TableHead>{textColumn}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.key} className="even:bg-muted/40 h-14">
                    <TableCell className="px-4 font-mono">{row.line}</TableCell>
                    <TableCell className="font-semibold">
                      {row.client}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {row.text}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Pager
          page={tablePage}
          pageSize={TABLE_PAGE_SIZE}
          total={rows.length}
          onPage={setTablePage}
        />
      </div>
      <div className="flex flex-col gap-3 sm:hidden">
        <ul className="flex flex-col gap-3">
          {cardRows.map((row) => (
            <li key={row.key}>
              <Card className="gap-1 py-4 shadow-none">
                <CardContent className="flex flex-col gap-1 text-[16px]">
                  <span className="text-muted-foreground font-mono text-[14px]">
                    {t('lineNumber', {line: row.line})}
                  </span>
                  <span className="font-semibold">{row.client}</span>
                  <span>{row.text}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <Pager
          page={cardPage}
          pageSize={CARD_PAGE_SIZE}
          total={rows.length}
          onPage={setCardPage}
          compact
        />
      </div>
    </>
  )
}

const pageOf = <T,>(rows: T[], page: number, size: number): T[] =>
  rows.slice((page - 1) * size, page * size)

function Pager({
  page,
  pageSize,
  total,
  onPage,
  compact = false,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  compact?: boolean
}) {
  const t = useTranslations('AdminMemberImport.report')
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const range = t('range', {from, to, total})
  const position = t('page', {page, total: pages})

  const navButton = (label: string, target: number, disabled: boolean) => (
    <Button
      type="button"
      variant="outline"
      className="h-12"
      disabled={disabled}
      onClick={() => onPage(target)}
    >
      {label}
    </Button>
  )

  return (
    <nav className="flex flex-col gap-3" aria-label={position}>
      <Info compact={compact} range={range} position={position} />
      <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-between">
        {navButton(t('previous'), page - 1, page <= 1)}
        {navButton(t('next'), page + 1, page >= pages)}
      </div>
    </nav>
  )
}

function Info({
  compact,
  range,
  position,
}: {
  compact: boolean
  range: string
  position: string
}): ReactNode {
  if (compact) {
    return (
      <p className="text-muted-foreground text-[14px]">
        {range} · {position}
      </p>
    )
  }
  return (
    <p className="text-muted-foreground flex justify-between text-[14px]">
      <span>{range}</span>
      <span>{position}</span>
    </p>
  )
}
