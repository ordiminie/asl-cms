'use client'

import {AlertTriangle, CircleCheck, Lock, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {ReactNode, useId, useState} from 'react'

import {
  pageOf,
  Pager,
} from '@/components/features/admin/member-import/member-import-report'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
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
import type {AnnualImportReportDTO} from '@/services/types/domain/member-annual-import-types'

import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  NEW_MEMBER_PROFILE_PATH,
} from '../member-profile-paths'

/** Lignes par page : 25 en tableau, 10 en cartes sous 640 px (§3.5). */
const TABLE_PAGE_SIZE = 25
const CARD_PAGE_SIZE = 10

type AnnualImportReportProps = {
  report: AnnualImportReportDTO
  fileName: string
  associationName: string
  /** Fin de la mise a jour, ISO 8601. */
  importedAt: string
  onImportAnother: () => void
}

type ReportKind = 'done' | 'nothing_changed' | 'none_useful'

const kindOf = (report: AnnualImportReportDTO): ReportKind => {
  if (report.profilesUpdated > 0) return 'done'
  return report.profilesUnchanged > 0 ? 'nothing_changed' : 'none_useful'
}

const pointsToCheckOf = (report: AnnualImportReportDTO): number =>
  report.kept.length +
  report.replaced.length +
  report.designated.length +
  report.disabled.length +
  report.manual.length

const formatImportedAt = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))

const DATA_CLASS = 'font-mono break-all'

/** Une ligne d'une section : des cellules, dans l'ordre des colonnes. */
type SectionRow = {key: string; cells: ReactNode[]}

/**
 * Ecran 2 du design s56 : le rapport de mise a jour, rendu avec le resultat
 * de l'action et conserve nulle part (ADR 047). Bilan (compteur `dl`, §3.13),
 * puis huit sections ; chaque nom de fiche est un lien vers la fiche.
 */
export function AnnualImportReport({
  report,
  fileName,
  associationName,
  importedAt,
  onImportAnother,
}: AnnualImportReportProps) {
  const t = useTranslations('BureauMemberAnnualImport.report')
  const tImport = useTranslations('AdminMemberImport.report')
  const kind = kindOf(report)
  const profileCell = (profile: {memberProfileId: string; name: string}) => (
    <Link
      href={memberProfilePathOf(profile.memberProfileId)}
      className="font-semibold underline underline-offset-4"
    >
      {profile.name}
    </Link>
  )
  const data = (value: string | null) => (
    <span className={DATA_CLASS}>{value ?? t('noValue')}</span>
  )

  return (
    <div className="flex w-full max-w-[960px] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          <span className="font-mono">{fileName}</span> · {associationName} ·{' '}
          <span className="font-mono">{formatImportedAt(importedAt)}</span>
        </p>
      </div>

      <ResultBanner report={report} kind={kind} />

      <p className="text-muted-foreground flex items-start gap-2 text-[14px]">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {tImport('privacy')}
      </p>

      <Summary report={report} />

      <ReportSection
        name="updated"
        columns={[t('columns.profile'), t('columns.updatedGroups')]}
        rows={report.updated.map((row) => ({
          key: row.memberProfileId,
          cells: [
            profileCell(row),
            row.groups.map((group) => t(`groups.${group}`)).join(', '),
          ],
        }))}
      />
      <ReportSection
        name="kept"
        columns={[
          t('columns.profile'),
          t('columns.group'),
          t('columns.kept'),
          t('columns.file'),
        ]}
        rows={report.kept.map((row) => ({
          key: `${row.memberProfileId}-${row.group}`,
          cells: [
            profileCell(row),
            t(`groups.${row.group}`),
            data(row.current),
            data(row.file),
          ],
        }))}
      />
      <ReportSection
        name="replaced"
        columns={[
          t('columns.profile'),
          t('columns.oldHolder'),
          t('columns.newHolder'),
        ]}
        rows={report.replaced.map((row) => ({
          key: row.memberProfileId,
          cells: [profileCell(row), data(row.oldEmail), data(row.newEmail)],
        }))}
      />
      <ReportSection
        name="designated"
        columns={[
          t('columns.profile'),
          t('columns.oldHolder'),
          t('columns.newHolder'),
        ]}
        rows={report.designated.map((row) => ({
          key: row.memberProfileId,
          cells: [
            profileCell(row),
            data(row.oldEmail),
            row.newEmail ? (
              data(row.newEmail)
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {t('noActiveEmail')}
                <Badge variant="outline">{t('mailOnly')}</Badge>
              </span>
            ),
          ],
        }))}
      />
      <ReportSection
        name="disabled"
        columns={[t('columns.profile'), t('columns.address')]}
        rows={report.disabled.map((row) => ({
          key: `${row.memberProfileId}-${row.email}`,
          cells: [profileCell(row), data(row.email)],
        }))}
      />
      <ReportSection
        name="manual"
        columns={[t('columns.profile'), t('columns.holder'), t('columns.file')]}
        rows={report.manual.map((row) => ({
          key: row.memberProfileId,
          cells: [profileCell(row), data(row.holderEmail), data(row.file)],
        }))}
      />
      <ReportSection
        name="toCreate"
        columns={[
          t('columns.line'),
          t('columns.customerId'),
          t('columns.client'),
        ]}
        rows={report.toCreate.map((row) => ({
          key: `${row.line}-${row.pennylaneCustomerId}`,
          cells: [
            <span key="line" className="font-mono">
              {row.line}
            </span>,
            data(row.pennylaneCustomerId),
            row.client || tImport('noName'),
          ],
        }))}
        action={
          <Button
            asChild
            variant="outline"
            className="h-14 w-full sm:h-12 sm:w-auto sm:self-start"
          >
            <Link href={NEW_MEMBER_PROFILE_PATH}>{t('addMember')}</Link>
          </Button>
        }
      />
      <ReportSection
        name="rejections"
        columns={[t('columns.line'), t('columns.client'), t('columns.reason')]}
        rows={report.rejections.map((row) => ({
          key: `${row.line}-${row.reason}`,
          cells: [
            <span key="line" className="font-mono">
              {row.line}
            </span>,
            row.client || tImport('noName'),
            tImport(`reasons.${row.reason}`),
          ],
        }))}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={MEMBER_PROFILES_PATH}>{t('backToList')}</Link>
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
  report: AnnualImportReportDTO
  kind: ReportKind
}) {
  const t = useTranslations('BureauMemberAnnualImport.report')

  if (kind === 'none_useful') {
    return (
      <Alert variant="destructive" className="border-2">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>{t('noneUpdatedTitle')}</AlertTitle>
        <AlertDescription>{t('noneUpdatedBody')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" />
      <AlertTitle className="text-[17px]">
        {kind === 'done'
          ? t('done', {count: report.profilesUpdated})
          : t('nothingChanged')}
      </AlertTitle>
      {kind === 'done' && (
        <AlertDescription>
          {t('toReview', {
            points: pointsToCheckOf(report),
            toCreate: report.membersToCreate,
          })}
        </AlertDescription>
      )}
    </Alert>
  )
}

/** Le bilan : un compteur `dl` (§3.13), une paire par ligne sous 640 px. */
function Summary({report}: {report: AnnualImportReportDTO}) {
  const t = useTranslations('BureauMemberAnnualImport.report')
  const headingId = useId()
  const totals: [string, number][] = [
    [t('summary.linesRead'), report.linesRead],
    [t('summary.profilesUpdated'), report.profilesUpdated],
    [t('summary.profilesUnchanged'), report.profilesUnchanged],
    [t('summary.membersToCreate'), report.membersToCreate],
    [t('summary.linesRejected'), report.linesRejected],
  ]
  const toCheck: [string, number][] = [
    [t('summary.kept'), report.kept.length],
    [t('summary.replaced'), report.replaced.length],
    [t('summary.designated'), report.designated.length],
    [t('summary.disabled'), report.disabled.length],
    [t('summary.manual'), report.manual.length],
  ]

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 shadow-none">
        <CardContent className="flex flex-col gap-4">
          <h2 id={headingId} className="font-serif text-[22px] font-semibold">
            {t('summaryTitle')}
          </h2>
          <Figures figures={totals} />
          <hr className="border-border" />
          <h3 className="text-[15px] font-semibold">{t('summary.toCheck')}</h3>
          <Figures figures={toCheck} />
        </CardContent>
      </Card>
    </section>
  )
}

function Figures({figures}: {figures: [string, number][]}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-4">
      {figures.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-1"
        >
          <dt className="text-muted-foreground text-[14px]">{label}</dt>
          <dd className="font-mono text-[22px] font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

type SectionName =
  | 'updated'
  | 'kept'
  | 'replaced'
  | 'designated'
  | 'disabled'
  | 'manual'
  | 'toCreate'
  | 'rejections'

/**
 * Une carte de section : titre et decompte, phrase d'usage, tableau pagine a
 * 25 en ordinateur, cartes paginees a 10 sous 640 px. Vide, elle se reduit a
 * son titre « (0) » et une ligne en `muted-foreground`.
 */
function ReportSection({
  name,
  columns,
  rows,
  action,
}: {
  name: SectionName
  columns: string[]
  rows: SectionRow[]
  action?: ReactNode
}) {
  const t = useTranslations('BureauMemberAnnualImport.report.sections')
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 shadow-none">
        <CardContent className="flex flex-col gap-4">
          <h3 id={headingId} className="font-serif text-[20px] font-semibold">
            {t(`${name}.title`)}{' '}
            <span className="font-mono font-medium">({rows.length})</span>
          </h3>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-[15px]">
              {t(`${name}.empty`)}
            </p>
          ) : (
            <>
              <p className="text-[15px]">{t(`${name}.intro`)}</p>
              <PagedRows
                caption={t(`${name}.title`)}
                columns={columns}
                rows={rows}
              />
              {action}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function PagedRows({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: SectionRow[]
}) {
  const [tablePage, setTablePage] = useState(1)
  const [cardPage, setCardPage] = useState(1)
  const tableRows = pageOf(rows, tablePage, TABLE_PAGE_SIZE)
  const cardRows = pageOf(rows, cardPage, CARD_PAGE_SIZE)

  return (
    <>
      <div className="hidden flex-col gap-3 sm:flex">
        <Table aria-label={caption}>
          <TableHeader className="bg-muted">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.key} className="even:bg-muted/40 h-14">
                {row.cells.map((cell, index) => (
                  <TableCell key={columns[index]} className="whitespace-normal">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                <CardContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[16px]">
                    {row.cells.map((cell, index) => (
                      <CardPair
                        key={columns[index]}
                        label={columns[index]}
                        value={cell}
                      />
                    ))}
                  </dl>
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

function CardPair({label, value}: {label: string; value: ReactNode}) {
  return (
    <>
      <dt className="text-muted-foreground text-[14px]">{label}</dt>
      <dd>{value}</dd>
    </>
  )
}
