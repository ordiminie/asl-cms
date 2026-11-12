import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Button} from '@/components/ui/button'
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
import {renderRestrictedMarkdown} from '@/lib/cms/render-page-block'
import {finalSubject} from '@/services/rules/campaign-rules'
import type {
  CampaignDTO,
  CampaignRecipientFilter,
  CampaignRecipientsPageDTO,
} from '@/services/types/domain/campaign-types'

import {dayLabelOf, daysInWordsOf, sentAtPartsOf} from './campaign-format'
import {CampaignPageLink} from './campaign-list'
import {campaignRecipientsPathOf, CAMPAIGNS_PATH} from './campaign-paths'
import {CampaignProgressRefresh} from './campaign-progress-refresh'
import {CampaignRecipientFilterSelect} from './campaign-recipient-filter'
import {
  CampaignStateBadge,
  PartStateBadge,
  RecipientState,
} from './campaign-state-badges'

type CampaignDetailProps = {
  campaign: CampaignDTO
  /** La page demandee des destinataires ; `null` si elle n'a pas pu etre lue. */
  recipients: CampaignRecipientsPageDTO | null
  associationName: string
  /** Le plafond quotidien des campagnes de l'association (Resume). */
  dailySendCap: number
  /** Arrivee depuis l'envoi (`?envoi=1`) : « Campagne lancee » s'affiche. */
  justSent: boolean
}

const data = (chunks: ReactNode) => (
  <span className="font-mono text-[16px] tabular-nums">{chunks}</span>
)
const strong = (chunks: ReactNode) => (
  <strong className="font-semibold">{chunks}</strong>
)

/**
 * Une campagne (ecran 2 du design s26), en lecture seule : un bandeau d'etat
 * a la fois, l'avancement, les envois par jour, les destinataires filtres et
 * pagines, le resume et le contenu tel qu'ecrit. Aucune action de renvoi : une
 * ligne « A verifier » renvoie a l'equipe technique (ADR 052).
 */
export function CampaignDetail({
  campaign,
  recipients,
  associationName,
  dailySendCap,
  justSent,
}: CampaignDetailProps) {
  return (
    <CampaignFrame current={campaign.subject}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {campaign.subject}
        </h1>
        <CampaignStateBadge state={campaign.displayState} />
      </div>

      <StateBanner campaign={campaign} justSent={justSent} />
      <ProgressCard campaign={campaign} />
      {campaign.parts.length > 1 && <PartsCard campaign={campaign} />}
      <RecipientsCard campaign={campaign} recipients={recipients} />
      <Summary campaign={campaign} dailySendCap={dailySendCap} />
      <SentContent campaign={campaign} associationName={associationName} />

      <BackToCampaigns />
    </CampaignFrame>
  )
}

function CampaignFrame({
  current,
  children,
}: {
  current?: string
  children: ReactNode
}) {
  const t = useTranslations('CampaignsBureau.breadcrumb')

  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Breadcrumb aria-label={t('label')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            {current ? (
              <BreadcrumbLink asChild>
                <Link href={CAMPAIGNS_PATH}>{t('list')}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{t('list')}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {current && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{current}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </div>
  )
}

/** Un seul bandeau a la fois (etats a, b, c, d, j). */
function StateBanner({
  campaign,
  justSent,
}: {
  campaign: CampaignDTO
  justSent: boolean
}) {
  if (justSent) return <LaunchedAlert campaign={campaign} />
  if (campaign.displayState === 'failed') {
    return <FailedAlert campaign={campaign} />
  }
  if (campaign.displayState === 'to_verify') {
    return <ToVerifyAlert campaign={campaign} />
  }
  if (campaign.displayState === 'sent') return <DoneAlert campaign={campaign} />
  return <ContinuesAlert campaign={campaign} />
}

function SuccessAlert({children}: {children: ReactNode}) {
  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-[17px]">
        <p>{children}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Juste apres la confirmation (etat j) : la suite part seule. */
function LaunchedAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.banner')
  const [first, ...rest] = campaign.parts

  return (
    <SuccessAlert>
      {t.rich('launched', {
        strong,
        count: first?.recipientCount ?? campaign.recipientCount,
        today: String(!first || first.day === campaign.sendDate),
        date: first ? dayLabelOf(first.day) : '',
        rest: rest.length,
        days: daysInWordsOf(rest.map((part) => part.day)),
      })}
    </SuccessAlert>
  )
}

/** Terminee (etat b) : succes neutre. */
function DoneAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.banner')

  return (
    <SuccessAlert>
      {t.rich('done', {data, count: campaign.recipientCounts.received})}
    </SuccessAlert>
  )
}

/**
 * En cours (etat a) : annonce l'avenir, fond `muted` **sans icone** (gap 2) ;
 * rien tant qu'aucune part n'est programmee.
 */
function ContinuesAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.banner')
  const next = campaign.parts.find((part) => part.displayState === 'scheduled')
  if (!next) return null

  return (
    <Alert role="status" className="bg-muted">
      <AlertDescription className="text-foreground text-[17px]">
        <p>
          {t.rich('continues', {
            data,
            date: dayLabelOf(next.day),
            count: next.recipientCount,
          })}
        </p>
      </AlertDescription>
    </Alert>
  )
}

/** A verifier (etat c) : le lien applique le filtre. */
function ToVerifyAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.banner')
  const count = campaign.recipientCounts.toVerify

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground flex flex-col gap-2 text-[17px]">
        <p>{t.rich('toVerify', {strong, count})}</p>
        <Link
          href={campaignRecipientsPathOf(campaign.id, 'to_verify')}
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          {t('showToVerify', {count})}
        </Link>
      </AlertDescription>
    </Alert>
  )
}

/** En echec (etat d) : la part qui n'est pas partie, rien n'est renvoye. */
function FailedAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.banner')
  const failedPart = campaign.parts.find(
    (part) => part.displayState === 'failed'
  )
  const received = campaign.recipientCounts.received

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {t.rich('failedTitle', {
          data,
          date: failedPart ? dayLabelOf(failedPart.day) : '',
        })}
      </AlertTitle>
      <AlertDescription className="text-foreground text-[17px]">
        <p>
          {t('failedDescription', {
            received,
            notReceived: campaign.recipientCount - received,
          })}
        </p>
      </AlertDescription>
    </Alert>
  )
}

function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[24px] leading-snug font-semibold">
      {children}
    </h2>
  )
}

/** Avancement : `progress` « n sur N » sans pourcentage, compteur en `dl`. */
function ProgressCard({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.progress')
  const counts = campaign.recipientCounts
  const total = campaign.recipientCount
  const values = {received: counts.received, total}
  const label = t('valueText', values)
  const counter: [string, number][] = [
    [t('counter.received'), counts.received],
    [t('counter.scheduled'), counts.scheduled + counts.sending],
    [t('counter.toVerify'), counts.toVerify],
    [t('counter.failed'), counts.failed],
  ]
  const sending = campaign.parts.some((part) => part.displayState === 'sending')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <p className="text-[17px]" id={`campaign-progress-${campaign.id}`}>
        {t.rich('sentence', {strong, data, ...values})}
      </p>
      <Progress
        value={total === 0 ? 0 : (counts.received / total) * 100}
        aria-labelledby={`campaign-progress-${campaign.id}`}
        aria-valuetext={label}
      />
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
        {counter.map(([term, value]) => (
          <div
            key={term}
            className="flex flex-row justify-between gap-1 sm:flex-col"
          >
            <dt className="text-muted-foreground text-[15px]">{term}</dt>
            <dd className="font-mono text-[17px] font-medium tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {sending && <CampaignProgressRefresh />}
    </Card>
  )
}

/** Envois par jour : tableau en bureau, cartes empilees sous 640 px. */
function PartsCard({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail.parts')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.number')}</TableHead>
              <TableHead>{t('columns.day')}</TableHead>
              <TableHead>{t('columns.recipients')}</TableHead>
              <TableHead>{t('columns.state')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaign.parts.map((part) => (
              <TableRow key={part.number} className="h-14">
                <TableCell className="font-mono">{part.number}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {dayLabelOf(part.day)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {part.recipientCount}
                </TableCell>
                <TableCell>
                  <PartStateBadge state={part.displayState} day={part.day} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-3 sm:hidden">
        {campaign.parts.map((part) => (
          <li
            key={part.number}
            data-testid="campaign-part-card"
            className="border-border flex flex-col gap-2 rounded-lg border p-4"
          >
            <p className="font-semibold">
              {t('cardTitle', {number: part.number})}
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground text-[15px]">
                {t('columns.day')}
              </span>
              <span className="font-mono">{dayLabelOf(part.day)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-muted-foreground text-[15px]">
                {t('columns.recipients')}
              </span>
              <span className="font-mono">{part.recipientCount}</span>
            </p>
            <PartStateBadge state={part.displayState} day={part.day} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

const filterCountsOf = (
  campaign: CampaignDTO
): Record<CampaignRecipientFilter, number> => {
  const counts = campaign.recipientCounts
  return {
    all: Object.values(counts).reduce((sum, value) => sum + value, 0),
    received: counts.received,
    scheduled: counts.scheduled + counts.sending,
    to_verify: counts.toVerify,
    failed: counts.failed,
  }
}

/**
 * Destinataires : filtre « Afficher », resume annonce (`aria-live`), tableau
 * pagine (cartes sous 640 px). **Aucun jeton de desinscription.**
 */
function RecipientsCard({
  campaign,
  recipients,
}: {
  campaign: CampaignDTO
  recipients: CampaignRecipientsPageDTO | null
}) {
  const t = useTranslations('CampaignsBureau.recipients')
  const filter = recipients?.filter ?? 'all'
  const counts = filterCountsOf(campaign)

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <div className="flex flex-col gap-2">
        <CampaignRecipientFilterSelect
          campaignId={campaign.id}
          filter={filter}
          counts={counts}
        />
        <p aria-live="polite" className="text-muted-foreground text-[15px]">
          {t('summary', {
            count: recipients?.total ?? counts[filter],
            label: t(`summaryLabels.${filter}`, {
              count: recipients?.total ?? counts[filter],
            }),
          })}
        </p>
      </div>
      {!recipients ? (
        <p className="text-[17px]">{t('loadFailed')}</p>
      ) : recipients.items.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border px-4 py-6 text-center text-[17px]">
          {t(`empty.${filter}`)}
        </p>
      ) : (
        <RecipientsList campaignId={campaign.id} recipients={recipients} />
      )}
    </Card>
  )
}

function RecipientsList({
  campaignId,
  recipients,
}: {
  campaignId: string
  recipients: CampaignRecipientsPageDTO
}) {
  const t = useTranslations('CampaignsBureau.recipients')
  const tPages = useTranslations('CampaignsBureau.pagination')
  const nameOf = (name: string | null) => name ?? t('deletedProfile')
  const pathOf = (page: number) =>
    campaignRecipientsPathOf(campaignId, recipients.filter, page)

  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.parcel')}</TableHead>
              <TableHead>{t('columns.state')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.items.map((recipient) => (
              <TableRow key={recipient.id} className="h-14">
                <TableCell className="text-[17px] whitespace-normal">
                  {nameOf(recipient.name)}
                </TableCell>
                <TableCell className="font-mono">
                  {recipient.parcelNumbers.join(', ')}
                </TableCell>
                <TableCell>
                  <RecipientState recipient={recipient} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2 sm:hidden">
        {recipients.items.map((recipient) => (
          <li
            key={recipient.id}
            className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3"
          >
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{nameOf(recipient.name)}</span>
              <span className="text-muted-foreground font-mono text-[15px]">
                {recipient.parcelNumbers.join(', ')}
              </span>
            </p>
            <RecipientState recipient={recipient} />
          </li>
        ))}
      </ul>
      {recipients.totalPages > 1 && (
        <nav
          aria-label={t('paginationLabel')}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <CampaignPageLink
            href={pathOf(recipients.page - 1)}
            disabled={recipients.page <= 1}
            label={tPages('previous')}
          />
          <span className="text-muted-foreground font-mono text-[15px]">
            {tPages('position', {
              page: recipients.page,
              total: recipients.totalPages,
            })}
          </span>
          <CampaignPageLink
            href={pathOf(recipients.page + 1)}
            disabled={recipients.page >= recipients.totalPages}
            label={tPages('next')}
          />
        </nav>
      )}
    </>
  )
}

function Summary({
  campaign,
  dailySendCap,
}: {
  campaign: CampaignDTO
  dailySendCap: number
}) {
  const t = useTranslations('CampaignsBureau')
  const rows: [string, ReactNode][] = [
    [t('detail.fields.sentAt'), t('sentAt', sentAtPartsOf(campaign.createdAt))],
    [t('detail.fields.author'), campaign.authorName ?? t('unknownAuthor')],
    [
      t('detail.fields.template'),
      t(`templateNames.${campaign.templateId ?? 'free'}`),
    ],
    [t('detail.fields.target'), t(`detail.targetKinds.${campaign.targetKind}`)],
    [t('detail.fields.recipients'), campaign.recipientCount],
    [t('detail.fields.withoutEmail'), campaign.withoutEmailCount],
    [t('detail.fields.unsubscribed'), campaign.unsubscribedCount],
    [
      t('detail.fields.dailySendCap'),
      t.rich('detail.fields.dailySendCapValue', {data, cap: dailySendCap}),
    ],
  ]

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('detail.summary')}</CardHeading>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[17px] sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function SentContent({
  campaign,
  associationName,
}: {
  campaign: CampaignDTO
  associationName: string
}) {
  const t = useTranslations('CampaignsBureau.detail')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('content')}</CardHeading>
      <p className="text-[17px]">
        {t('subjectLine', {
          subject: finalSubject(associationName, campaign.subject),
        })}
      </p>
      {campaign.preheader && (
        <p className="text-muted-foreground text-[17px]">
          {t('preheaderLine', {preheader: campaign.preheader})}
        </p>
      )}
      <div
        className="page-block border-border rounded-md border px-4 py-4 text-[17px] leading-[1.6]"
        dangerouslySetInnerHTML={{
          __html: renderRestrictedMarkdown(campaign.bodyMarkdown),
        }}
      />
      <p className="text-muted-foreground text-[15px]">{t('contentNote')}</p>
    </Card>
  )
}

function BackToCampaigns() {
  const t = useTranslations('CampaignsBureau.detail')

  return (
    <Button
      asChild
      variant="outline"
      className="h-14 w-full self-start sm:h-11 sm:w-auto"
    >
      <Link href={CAMPAIGNS_PATH}>{t('back')}</Link>
    </Button>
  )
}

/** Campagne introuvable, ou d'une autre association (etat f). */
export function CampaignNotFound() {
  const t = useTranslations('CampaignsBureau.detail')

  return (
    <CampaignFrame>
      <p className="text-[17px]">{t('notFound')}</p>
      <BackToCampaigns />
    </CampaignFrame>
  )
}

/** Chargement de la campagne (etat e). */
export function CampaignDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
