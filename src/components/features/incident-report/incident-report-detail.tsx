'use client'

import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import {type ReactNode, useState, useTransition} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import {
  type IncidentReportDTO,
  type IncidentReportEventDTO,
  type ReportStatus,
  telHrefOf,
} from '@/services/types/domain/incident-report-types'
import {nextReportStatusOf} from '@/services/validation/incident-report-validation'

import {REPORTS_PATH} from './report-paths'
import {ReportStatusBadge} from './report-status-badges'

/** Resultat d'un changement de statut, rendu par la Server Action. */
export type ReportStatusActionResult =
  | {status: 'changed'}
  | {status: 'stale'; message: string}
  | {status: 'error'; message: string}

type Feedback =
  | {kind: 'none'}
  | {kind: 'changed'; to: ReportStatus}
  | {kind: 'error'; message: string}

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

/**
 * Detail d'un signalement (ecran 3 du design s10) : colonne de lecture, la
 * categorie et son statut en titre, puis Ou, Ce qui a ete signale,
 * Coordonnees et Suivi. Le suivi porte **un seul bouton** selon le statut
 * (decision C) — aucun une fois resolu — et l'historique, date et phrase
 * (gap 2 du design).
 */
export function IncidentReportDetail({
  report,
  changeStatusAction,
}: {
  report: IncidentReportDTO
  changeStatusAction: (
    reportId: string,
    to: ReportStatus
  ) => Promise<ReportStatusActionResult>
}) {
  const t = useTranslations('BureauReportsPage')
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>({kind: 'none'})
  const receivedAt = receivedAtPartsOf(report.createdAt, locale)
  const next = nextReportStatusOf(report.status)

  const advance = (to: ReportStatus) => {
    startTransition(async () => {
      const result = await changeStatusAction(report.id, to)
      setFeedback(
        result.status === 'changed'
          ? {kind: 'changed', to}
          : {kind: 'error', message: result.message}
      )
    })
  }

  return (
    <article className="flex w-full max-w-[68ch] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Link
        href={REPORTS_PATH}
        className="text-link self-start text-base underline underline-offset-4"
      >
        {t('detail.back')}
      </Link>

      {feedback.kind === 'changed' && (
        <Alert role="status" className="[&>svg]:size-5">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t(`detail.changed.${feedback.to}` as 'detail.changed.resolved')}
          </AlertDescription>
        </Alert>
      )}
      {feedback.kind === 'error' && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {feedback.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[34px] leading-tight font-semibold break-words">
            {report.categoryName ?? t('noCategory')}
          </h1>
          <ReportStatusBadge status={report.status} />
        </div>
        <p className="text-muted-foreground text-[15px]">
          {t('detail.receivedAt', receivedAt)}
        </p>
        {report.categoryDeleted && (
          <p className="text-muted-foreground text-[15px]">
            {t('detail.categoryDeleted')}
          </p>
        )}
      </div>

      {report.notificationFailed && (
        <Alert variant="destructive" className="border-destructive border-2">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription className="text-foreground flex flex-col items-start gap-2 text-base">
            <p>{t.rich('detail.notificationFailed', {strong})}</p>
            <Link
              href="/bureau/reglages"
              className="text-link underline underline-offset-4"
            >
              {t('detail.openSettings')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Section title={t('detail.sections.location')}>
        <p className="text-[17px] break-words">{report.location}</p>
      </Section>

      <Section title={t('detail.sections.description')}>
        <p
          data-testid="incident-report-description"
          className="text-[17px] leading-relaxed break-words whitespace-pre-line"
        >
          {report.description}
        </p>
      </Section>

      <Section title={t('detail.sections.contact')}>
        <ReporterContact report={report} />
      </Section>

      <Section title={t('detail.sections.followUp')}>
        {next ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => advance(next)}
            className="h-14 w-full self-start text-base sm:h-11 sm:w-auto"
          >
            {t(`detail.actions.${next}` as 'detail.actions.resolved')}
          </Button>
        ) : (
          <p className="text-muted-foreground text-[15px]">
            {t('detail.resolvedNote')}
          </p>
        )}
        <History events={report.events} />
      </Section>
    </article>
  )
}

function Section({title, children}: {title: string; children: ReactNode}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function ReporterContact({report}: {report: IncidentReportDTO}) {
  const t = useTranslations('BureauReportsPage.detail')
  const {reporterName, reporterEmail, reporterPhone} = report

  if (!reporterName && !reporterEmail && !reporterPhone) {
    return <p className="text-muted-foreground text-[17px]">{t('noContact')}</p>
  }

  return (
    <div className="flex flex-col gap-1 text-[17px]">
      {reporterName && <p className="font-semibold">{reporterName}</p>}
      {reporterEmail && (
        <a
          href={`mailto:${reporterEmail}`}
          className="text-link self-start break-all underline underline-offset-4"
        >
          {reporterEmail}
        </a>
      )}
      {reporterPhone && (
        <a
          href={telHrefOf(reporterPhone)}
          className="text-link self-start underline underline-offset-4"
        >
          {reporterPhone}
        </a>
      )}
    </div>
  )
}

/**
 * Historique d'un objet (gap 2 du design) : liste ordonnee, date et heure en
 * `data`, puis une phrase ecrite — « depuis le site » pour le premier
 * evenement, jamais « Anonyme ».
 */
function History({events}: {events: IncidentReportEventDTO[]}) {
  const t = useTranslations('BureauReportsPage.detail.history')
  const locale = useLocale()

  return (
    <ol aria-label={t('label')} className="mt-2 flex flex-col gap-2">
      {events.map((event) => {
        const at = receivedAtPartsOf(event.createdAt, locale)
        return (
          <li key={event.id} className="flex flex-wrap gap-x-4 text-[17px]">
            <span className="text-muted-foreground font-mono tabular-nums">
              {`${at.shortDate} ${at.hour}:${at.minute}`}
            </span>
            <span>
              {event.status === 'reported'
                ? t('reported')
                : t(event.status, {name: event.authorName ?? ''})}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
