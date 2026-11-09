import {CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {type ReactNode, useId} from 'react'

import {ReportStatusBadge} from '@/components/features/incident-report/report-status-badges'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import type {MyIncidentReportDTO} from '@/services/types/domain/incident-report-types'

/** Le formulaire de declaration de l'espace membre (s22, ecran B). */
export const MY_REPORT_PATH = '/dashboard/signaler'

/**
 * « Mes signalements » (s22, ecran A) : tous les signalements du membre, le
 * plus recent d'abord, statut courant et deux dates. Composant serveur, sans
 * etat client. Aucun bouton `default` : signaler est une action secondaire de
 * l'espace.
 */
export function MyReportsCard({
  reports,
  sent,
}: {
  reports: MyIncidentReportDTO[]
  sent: boolean
}) {
  const t = useTranslations('MemberSpacePage.reports')

  return (
    <MyReportsSection>
      {sent && (
        <Alert role="status" className="[&>svg]:size-5">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t('sent')}
          </AlertDescription>
        </Alert>
      )}
      {reports.length === 0 ? (
        <p className="text-[17px]">{t('empty')}</p>
      ) : (
        <ul className="divide-y">
          {reports.map((report) => (
            <MyReportLine key={report.id} report={report} />
          ))}
        </ul>
      )}
    </MyReportsSection>
  )
}

/** A3 : la liste en `skeleton`, le bouton reste visible. */
export function MyReportsCardLoading() {
  return (
    <MyReportsSection busy>
      <Skeleton className="bg-muted h-14 w-full" />
      <Skeleton className="bg-muted h-14 w-full" />
    </MyReportsSection>
  )
}

function MyReportsSection({
  busy = false,
  children,
}: {
  busy?: boolean
  children: ReactNode
}) {
  const t = useTranslations('MemberSpacePage.reports')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {children}
        <Button
          asChild
          variant="outline"
          className="h-14 w-full text-base sm:h-12 sm:w-auto sm:self-start"
        >
          <Link href={MY_REPORT_PATH}>{t('report')}</Link>
        </Button>
      </Card>
    </section>
  )
}

function MyReportLine({report}: {report: MyIncidentReportDTO}) {
  const t = useTranslations('MemberSpacePage.reports')

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[17px] font-semibold">
          {report.categoryName ?? t('noCategory')}
        </span>
        <span className="truncate text-[17px]">{report.location}</span>
        <span className="text-muted-foreground flex flex-wrap gap-x-4 text-[15px]">
          <span>
            {t('sentOn')} <ShortDate date={report.createdAt} />
          </span>
          {report.updatedAt && (
            <span>
              {t('updatedOn')} <ShortDate date={report.updatedAt} />
            </span>
          )}
        </span>
      </div>
      <div className="shrink-0">
        <ReportStatusBadge status={report.status} />
      </div>
    </li>
  )
}

function ShortDate({date}: {date: Date}) {
  const locale = useLocale()

  return (
    <span className="font-mono tabular-nums">
      {receivedAtPartsOf(date, locale).shortDate}
    </span>
  )
}
