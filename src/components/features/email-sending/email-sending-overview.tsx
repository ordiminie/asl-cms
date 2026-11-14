import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Card} from '@/components/ui/card'
import {Progress} from '@/components/ui/progress'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  EmailSendingOverviewDTO,
  PendingSendDTO,
} from '@/services/types/domain/email-send-types'

import {dayLabelOf, shortDayLabelOf} from '../campaigns/campaign-format'
import {CampaignPageLink} from '../campaigns/campaign-list'
import {campaignPathOf} from '../campaigns/campaign-paths'

/** La page des envois d'emails du bureau (s52). */
export const EMAIL_SENDING_PATH = '/bureau/envois'

/** Lignes du tableau « En attente » par page (design s52, §3.13). */
const PENDING_PAGE_SIZE = 25

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('fr', {
  weekday: 'long',
  timeZone: 'UTC',
})

/** Le jour de la semaine d'un jour ISO `YYYY-MM-DD`, en toutes lettres. */
const weekdayOf = (day: string): string =>
  WEEKDAY_FORMAT.format(new Date(`${day}T12:00:00Z`))

const pagePathOf = (page: number): string =>
  page > 1 ? `${EMAIL_SENDING_PATH}?page=${page}` : EMAIL_SENDING_PATH

/** Titre, phrase et fil d'Ariane, communs aux cinq etats de l'ecran 1. */
function EmailSendingFrame({
  limit,
  children,
}: {
  limit?: number
  children: ReactNode
}) {
  const t = useTranslations('EmailSendingBureau')

  return (
    <div className="flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList className="text-[15px]">
            <BreadcrumbItem>{t('breadcrumb.association')}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('breadcrumb.current')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        {limit !== undefined && (
          <p className="text-muted-foreground max-w-[68ch] text-[17px]">
            {t('intro', {limit})}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[24px] leading-snug font-semibold">
      {children}
    </h2>
  )
}

/** Un report, jamais un refus : `warning` + `AlertTriangle` (§3.13). */
function WarningBanner({children}: {children: ReactNode}) {
  return (
    <Alert
      role="status"
      className="border-warning-border bg-warning text-warning-foreground [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-[17px]">
        <p>{children}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Un seul bandeau a la fois : la reserve epuisee prime sur la limite. */
function StateBanner({overview}: {overview: EmailSendingOverviewDTO}) {
  const t = useTranslations('EmailSendingBureau.banner')

  if (overview.reserveExhausted) {
    return (
      <WarningBanner>
        {t.rich('reserveExhausted', {strong, reserve: overview.reserve})}
      </WarningBanner>
    )
  }
  if (!overview.limitReached) return null
  return (
    <WarningBanner>
      {t.rich('limitReached', {
        strong,
        count: overview.pendingRecipientTotal,
        date: overview.nextSendOn ? dayLabelOf(overview.nextSendOn) : '',
      })}
    </WarningBanner>
  )
}

/** La carte « Aujourd'hui » : progression sans pourcentage, quatre paires. */
function TodayCard({overview}: {overview: EmailSendingOverviewDTO}) {
  const t = useTranslations('EmailSendingBureau.today')
  const label = t('progress', {sent: overview.sentToday, limit: overview.limit})
  const counter: [string, string | number][] = [
    [t('counter.sent'), overview.sentToday],
    [t('counter.login'), overview.loginSentToday],
    [t('counter.remaining'), overview.remainingReportable],
    [t('counter.reset'), t('resetValue')],
  ]

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>
        {t('title', {
          weekday: weekdayOf(overview.day),
          date: dayLabelOf(overview.day),
        })}
      </CardHeading>
      <p className="text-[17px]" id="email-sending-progress">
        {label}
      </p>
      <Progress
        value={Math.min(100, (overview.sentToday / overview.limit) * 100)}
        aria-labelledby="email-sending-progress"
        aria-valuetext={label}
      />
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
        {counter.map(([term, value]) => (
          <div
            key={term}
            className="flex flex-row justify-between gap-1 sm:flex-col"
          >
            <dt className="text-muted-foreground text-[15px]">{term}</dt>
            <dd
              className={
                typeof value === 'number'
                  ? 'font-mono text-[17px] font-medium tabular-nums'
                  : 'text-[17px] font-medium'
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-[15px]">
        {t('reserveNote', {reserve: overview.reserve})}
      </p>
    </Card>
  )
}

type PendingTexts = {
  title: string
  detail: string | null
  action: {href: string; label: string} | null
}

/** Ce qu'une ligne dit d'un envoi : jamais une adresse ni un contenu. */
function usePendingTexts() {
  const t = useTranslations('EmailSendingBureau.pending')

  return (send: PendingSendDTO): PendingTexts => {
    const reference = send.reference
    if (reference?.type === 'campaign') {
      return {
        title: t('titles.campaign', {subject: send.campaignSubject ?? ''}),
        detail:
          send.partNumber !== null && send.partCount !== null
            ? t('details.part', {
                number: send.partNumber,
                total: send.partCount,
              })
            : null,
        action: {
          href: campaignPathOf(reference.id),
          label: t('actions.campaign'),
        },
      }
    }
    if (reference?.type === 'contact_message') {
      return {
        title: t('titles.contact_message'),
        detail: t('details.contact_message'),
        action: {
          href: `/bureau/messages/${reference.id}`,
          label: t('actions.contact_message'),
        },
      }
    }
    if (reference?.type === 'incident_report') {
      return {
        title: t('titles.incident_report'),
        detail: null,
        action: {
          href: `/bureau/signalements/${reference.id}`,
          label: t('actions.incident_report'),
        },
      }
    }
    return {title: t('titles.other'), detail: null, action: null}
  }
}

function PendingStateBadge({sendOn}: {sendOn: string}) {
  const t = useTranslations('EmailSendingBureau.pending')
  return (
    <Badge variant="secondary" className="text-[15px]">
      {t('state', {date: shortDayLabelOf(sendOn)})}
    </Badge>
  )
}

function PendingAction({
  action,
  className,
}: {
  action: PendingTexts['action']
  className?: string
}) {
  if (!action) return null
  return (
    <Link
      href={action.href}
      className={`text-link inline-flex min-h-11 items-center underline ${className ?? ''}`}
    >
      {action.label}
    </Link>
  )
}

function PendingTable({sends}: {sends: readonly PendingSendDTO[]}) {
  const t = useTranslations('EmailSendingBureau.pending')
  const textsOf = usePendingTexts()

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.send')}</TableHead>
            <TableHead>{t('columns.nature')}</TableHead>
            <TableHead className="text-right">
              {t('columns.recipients')}
            </TableHead>
            <TableHead>{t('columns.state')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('columns.action')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sends.map((send) => {
            const texts = textsOf(send)
            return (
              <TableRow key={send.key} className="h-14">
                <TableCell className="min-w-60 text-[17px] font-semibold whitespace-normal">
                  {texts.title}
                  {texts.detail && (
                    <span className="text-muted-foreground block text-[15px] font-normal">
                      {texts.detail}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-[17px]">
                  {t(`natures.${send.nature}`)}
                </TableCell>
                <TableCell className="text-right font-mono text-[17px] tabular-nums">
                  {send.recipientCount}
                </TableCell>
                <TableCell>
                  <PendingStateBadge sendOn={send.sendOn} />
                </TableCell>
                <TableCell>
                  <PendingAction action={texts.action} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Sous 640 px : cartes empilees (§3.5), le titre de l'envoi en tete. */
function PendingCards({sends}: {sends: readonly PendingSendDTO[]}) {
  const t = useTranslations('EmailSendingBureau.pending')
  const textsOf = usePendingTexts()

  return (
    <ul className="flex flex-col gap-3 sm:hidden">
      {sends.map((send) => {
        const texts = textsOf(send)
        return (
          <li
            key={send.key}
            data-testid="pending-send-card"
            className="border-border flex flex-col gap-2 rounded-lg border p-4"
          >
            <h3 className="text-lg leading-snug font-semibold">
              {texts.title}
            </h3>
            {texts.detail && (
              <p className="text-muted-foreground text-[15px]">
                {texts.detail}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
              <dt className="text-muted-foreground">{t('columns.nature')}</dt>
              <dd>{t(`natures.${send.nature}`)}</dd>
              <dt className="text-muted-foreground">
                {t('columns.recipients')}
              </dt>
              <dd className="font-mono tabular-nums">{send.recipientCount}</dd>
              <dt className="text-muted-foreground">{t('columns.state')}</dt>
              <dd>
                <PendingStateBadge sendOn={send.sendOn} />
              </dd>
            </dl>
            <PendingAction action={texts.action} />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Pagination ecrite (§3.13) : un controle desactive reste annonce, le bureau
 * lit qu'il est au bout de la liste.
 */
function PendingPagination({
  page,
  totalPages,
  count,
}: {
  page: number
  totalPages: number
  count: number
}) {
  const t = useTranslations('EmailSendingBureau.pagination')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('label')}
    >
      <CampaignPageLink
        href={pagePathOf(page - 1)}
        disabled={page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('position', {page, total: totalPages, count})}
      </span>
      <CampaignPageLink
        href={pagePathOf(page + 1)}
        disabled={page >= totalPages}
        label={t('next')}
      />
    </nav>
  )
}

/** La carte « En attente » : ce qui partira seul, une ligne par envoi. */
function PendingCard({
  pending,
  page,
}: {
  pending: readonly PendingSendDTO[]
  page: number
}) {
  const t = useTranslations('EmailSendingBureau.pending')
  const totalPages = Math.max(1, Math.ceil(pending.length / PENDING_PAGE_SIZE))
  const current = Math.min(Math.max(1, page), totalPages)
  const sends = pending.slice(
    (current - 1) * PENDING_PAGE_SIZE,
    current * PENDING_PAGE_SIZE
  )

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      {pending.length === 0 ? (
        <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-[17px]">
            {t('description')}
          </p>
          <PendingTable sends={sends} />
          <PendingCards sends={sends} />
          <PendingPagination
            page={current}
            totalPages={totalPages}
            count={pending.length}
          />
        </>
      )}
    </Card>
  )
}

/**
 * Les envois d'emails de l'association (s52, ecran 1) : ce qui est parti
 * aujourd'hui, ce qui attend demain. **Aucun bouton** : il n'y a rien a
 * declencher (critere 5), et « envoyer maintenant » depasserait la limite.
 */
export function EmailSendingOverview({
  overview,
  page,
}: {
  overview: EmailSendingOverviewDTO
  page: number
}) {
  return (
    <EmailSendingFrame limit={overview.limit}>
      <StateBanner overview={overview} />
      <TodayCard overview={overview} />
      <PendingCard pending={overview.pending} page={page} />
    </EmailSendingFrame>
  )
}

const SKELETON_ROWS = 2

/** Chargement (1d) : titres visibles, `skeleton` dans les deux cartes. */
export function EmailSendingSkeleton() {
  const t = useTranslations('EmailSendingBureau')

  return (
    <EmailSendingFrame>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('today.loadingTitle')}</CardHeading>
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-2 w-full" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
          {Array.from({length: 4}, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      </Card>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('pending.title')}</CardHeading>
        {Array.from({length: SKELETON_ROWS}, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </Card>
    </EmailSendingFrame>
  )
}

/** Erreur de lecture (1e) : `destructive` 2 px, les cartes ne s'affichent pas. */
export function EmailSendingError() {
  const t = useTranslations('EmailSendingBureau.banner')

  return (
    <EmailSendingFrame>
      <Alert variant="destructive" className="border-2">
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-[17px]">
          <p>{t.rich('loadFailed', {strong})}</p>
        </AlertDescription>
      </Alert>
    </EmailSendingFrame>
  )
}
