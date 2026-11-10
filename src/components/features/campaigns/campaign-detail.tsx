import {AlertTriangle, CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
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
import {renderRestrictedMarkdown} from '@/lib/cms/render-page-block'
import {finalSubject} from '@/services/rules/campaign-rules'
import type {
  CampaignDTO,
  CampaignStatus,
} from '@/services/types/domain/campaign-types'

import {sentAtPartsOf} from './campaign-format'
import {CAMPAIGNS_PATH} from './campaign-paths'
import {CampaignProgressRefresh} from './campaign-progress-refresh'

type CampaignDetailProps = {
  campaign: CampaignDTO
  /** Statut **effectif**, calcule par la page avec son propre `now`. */
  status: CampaignStatus
  associationName: string
  /** Arrivee depuis l'envoi (`?envoi=1`) : l'alerte de succes s'affiche. */
  justSent: boolean
}

/**
 * Une campagne archivee, en lecture seule (ecran 4 du design s25) : resume
 * aux decomptes figes, contenu tel qu'ecrit (variables **non remplacees**).
 * Pendant l'envoi, l'avancement « n sur N membres » et la relecture de la
 * page ; une interruption s'annonce sans proposer de reprise (ADR 051).
 */
export function CampaignDetail({
  campaign,
  status,
  associationName,
  justSent,
}: CampaignDetailProps) {
  const t = useTranslations('CampaignsBureau')

  return (
    <CampaignFrame current={campaign.subject}>
      {status === 'sent' && justSent && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertTitle className="text-[17px] whitespace-normal">
            {t('detail.success', {count: campaign.sentCount})}
          </AlertTitle>
        </Alert>
      )}
      {status === 'sending' && <SendingProgress campaign={campaign} />}
      {status === 'interrupted' && <InterruptedAlert campaign={campaign} />}

      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {campaign.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`status.${status}`)}</Badge>
        </div>
      </div>

      <Summary campaign={campaign} />
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

function SendingProgress({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail')
  const total = campaign.recipientCount
  const value = total === 0 ? 0 : (campaign.sentCount / total) * 100
  const label = t('progress', {sent: campaign.sentCount, total})

  return (
    <Card className="gap-3 px-4 py-4 shadow-none sm:px-6">
      <p className="text-[17px] font-semibold" id="campaign-progress-label">
        {label}
      </p>
      <Progress
        value={value}
        aria-labelledby="campaign-progress-label"
        aria-valuetext={label}
      />
      <p className="text-muted-foreground text-[15px]">{t('progressNote')}</p>
      <CampaignProgressRefresh />
    </Card>
  )
}

function InterruptedAlert({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau.detail')
  const values = {
    sent: campaign.sentCount,
    total: campaign.recipientCount,
    rest: campaign.recipientCount - campaign.sentCount,
  }

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {t('interruptedTitle', values)}
      </AlertTitle>
      <AlertDescription className="text-[15px]">
        {t('interruptedDescription', values)}
      </AlertDescription>
    </Alert>
  )
}

function Summary({campaign}: {campaign: CampaignDTO}) {
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
  ]

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <h2 className="font-serif text-[24px] leading-snug font-semibold">
        {t('detail.summary')}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[17px]">
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
      <h2 className="font-serif text-[24px] leading-snug font-semibold">
        {t('content')}
      </h2>
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

/** Campagne introuvable, ou d'une autre association (etat c). */
export function CampaignNotFound() {
  const t = useTranslations('CampaignsBureau.detail')

  return (
    <CampaignFrame>
      <p className="text-[17px]">{t('notFound')}</p>
      <BackToCampaigns />
    </CampaignFrame>
  )
}

/** Chargement de la campagne (etat b). */
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
