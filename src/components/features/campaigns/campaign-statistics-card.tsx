import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Card} from '@/components/ui/card'
import type {
  CampaignPartDTO,
  CampaignStatisticsDTO,
} from '@/services/types/domain/campaign-types'

import {CardHeading} from './campaign-card-heading'
import {dayLabelOf, sentAtPartsOf} from './campaign-format'

type CampaignStatisticsCardProps = {
  statistics: CampaignStatisticsDTO
  /** Les parts de la campagne : la portee ne s'ecrit qu'au-dela d'une. */
  parts: CampaignPartDTO[]
}

/**
 * La carte « Ouvertures et clics » d'une campagne (s30, design s30). **Un
 * chiffre n'est rendu que dans l'etat `available`** : tout autre etat dit
 * qu'il n'y en a pas encore, ou pas du tout, sans zero trompeur (critere 3).
 */
export function CampaignStatisticsCard({
  statistics,
  parts,
}: CampaignStatisticsCardProps) {
  return (
    <StatisticsFrame>
      <StatisticsBody statistics={statistics} parts={parts} />
    </StatisticsFrame>
  )
}

/** Chargement isole de la carte : titre et phrase, pas de `skeleton`. */
export function CampaignStatisticsCardFallback() {
  const t = useTranslations('CampaignsBureau.detail.statistics')

  return (
    <StatisticsFrame>
      <Meta>{t('loading')}</Meta>
    </StatisticsFrame>
  )
}

function StatisticsFrame({children}: {children: ReactNode}) {
  const t = useTranslations('CampaignsBureau.detail.statistics')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      {children}
    </Card>
  )
}

function Meta({children}: {children: ReactNode}) {
  return <p className="text-muted-foreground text-[15px]">{children}</p>
}

function StatisticsBody({statistics, parts}: CampaignStatisticsCardProps) {
  const t = useTranslations('CampaignsBureau.detail.statistics')

  switch (statistics.state) {
    case 'available':
      return <AvailableStatistics statistics={statistics} parts={parts} />
    case 'pending_sending':
      return (
        <PendingAlert
          title={t('pendingSending.title')}
          description={t('pendingSending.description', {
            date: dayLabelOf(statistics.lastSendDay),
          })}
        />
      )
    case 'pending_provider':
      return (
        <PendingAlert
          title={t('pendingProvider.title')}
          description={t('pendingProvider.description')}
        />
      )
    case 'unavailable':
      return (
        <div className="flex flex-col gap-1">
          <p className="text-[17px]">{t('unavailable')}</p>
          <Meta>{t(`reasons.${statistics.reason}`)}</Meta>
        </div>
      )
    case 'nothing_sent':
      return <Meta>{t('nothingSent')}</Meta>
  }
}

/** « Pas encore » : `alert` neutre sans icone, il annonce l'avenir. */
function PendingAlert({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Alert role="status" className="bg-muted">
      <AlertTitle className="text-[17px] whitespace-normal">{title}</AlertTitle>
      <AlertDescription className="text-foreground text-[17px]">
        <p>{description}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Le compteur (motif « Compteur »), puis portee, lecture et source. */
function AvailableStatistics({
  statistics,
  parts,
}: {
  statistics: Extract<CampaignStatisticsDTO, {state: 'available'}>
  parts: CampaignPartDTO[]
}) {
  const t = useTranslations('CampaignsBureau.detail.statistics')
  const counter: [string, string][] = [
    [t('counter.sent'), String(statistics.sentCount)],
    [
      t('counter.opens'),
      t('countWithRate', {
        count: statistics.uniqueOpens,
        rate: statistics.openRate,
      }),
    ],
    [
      t('counter.clicks'),
      t('countWithRate', {
        count: statistics.uniqueClicks,
        rate: statistics.clickRate,
      }),
    ],
  ]
  const first = parts.at(0)

  return (
    <>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
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
      {parts.length > 1 && first && (
        <Meta>
          {t('scope', {
            parts: parts.length,
            from: dayLabelOf(first.day),
            to: dayLabelOf(lastDayOf(parts)),
          })}
        </Meta>
      )}
      <Meta>{t('reading')}</Meta>
      <Meta>{t('source', sentAtPartsOf(statistics.readAt))}</Meta>
    </>
  )
}

/**
 * Le dernier jour d'envoi : le plus tardif des jours et des reports des
 * parts, comme la fenetre de lecture du service (jours ISO, ordre lexical).
 */
function lastDayOf(parts: CampaignPartDTO[]): string {
  return parts
    .flatMap((part) =>
      part.deferredUntil ? [part.day, part.deferredUntil] : [part.day]
    )
    .reduce((latest, day) => (day > latest ? day : latest))
}
