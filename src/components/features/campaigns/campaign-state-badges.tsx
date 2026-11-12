import {useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'
import type {
  CampaignDisplayState,
  CampaignPartDisplayState,
  CampaignRecipientDTO,
} from '@/services/types/domain/campaign-types'

import {sentAtPartsOf, shortDayLabelOf} from './campaign-format'

/**
 * Les etats d'un envoi (design s26, composition de §3.10) : **le mot porte
 * l'information**, la variante existante du `badge` la souligne, aucune
 * couleur nouvelle. Termine en `outline` muet, a venir ou en cours en
 * `secondary`, a verifier en `outline` + point `primary`, echec en
 * `destructive`.
 */

function DoneBadge({label}: {label: string}) {
  return (
    <Badge variant="outline" className="text-muted-foreground text-[15px]">
      {label}
    </Badge>
  )
}

function UnderWayBadge({label}: {label: string}) {
  return (
    <Badge variant="secondary" className="text-[15px]">
      {label}
    </Badge>
  )
}

function ToVerifyBadge({label}: {label: string}) {
  return (
    <Badge variant="outline" className="gap-2 text-[15px]">
      <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
      {label}
    </Badge>
  )
}

function FailedBadge({label}: {label: string}) {
  return (
    <Badge variant="destructive" className="text-[15px]">
      {label}
    </Badge>
  )
}

/** L'etat d'une campagne : en-tete de l'ecran 2 et colonne de l'archive. */
export function CampaignStateBadge({state}: {state: CampaignDisplayState}) {
  const t = useTranslations('CampaignsBureau.states')

  if (state === 'sending') return <UnderWayBadge label={t(state)} />
  if (state === 'to_verify') return <ToVerifyBadge label={t(state)} />
  if (state === 'failed') return <FailedBadge label={t(state)} />
  return <DoneBadge label={t(state)} />
}

/** L'etat d'une part ; une part programmee n'est jamais « bloquee ». */
export function PartStateBadge({
  state,
  day,
}: {
  state: CampaignPartDisplayState
  day: string
}) {
  const t = useTranslations('CampaignsBureau.partStates')

  if (state === 'scheduled') {
    return <UnderWayBadge label={t(state, {date: shortDayLabelOf(day)})} />
  }
  if (state === 'sending') return <UnderWayBadge label={t(state)} />
  if (state === 'to_verify') return <ToVerifyBadge label={t(state)} />
  if (state === 'failed') return <FailedBadge label={t(state)} />
  return <DoneBadge label={t(state)} />
}

/** L'etat d'un destinataire ; la date de reception est ecrite hors du badge. */
export function RecipientState({recipient}: {recipient: CampaignRecipientDTO}) {
  const t = useTranslations('CampaignsBureau.recipientStates')

  switch (recipient.status) {
    case 'sent':
      return (
        <span className="flex flex-wrap items-center gap-2">
          <DoneBadge label={t('sent')} />
          {recipient.sentAt && (
            <span className="text-muted-foreground font-mono text-[15px] tabular-nums">
              {t('receivedOn', {date: sentAtPartsOf(recipient.sentAt).date})}
            </span>
          )}
        </span>
      )
    case 'pending':
      return (
        <UnderWayBadge
          label={t('pending', {date: shortDayLabelOf(recipient.scheduledFor)})}
        />
      )
    case 'sending':
      return <UnderWayBadge label={t('sending')} />
    case 'to_verify':
      return <ToVerifyBadge label={t('to_verify')} />
    case 'failed':
      return <FailedBadge label={t('failed')} />
    case 'unsubscribed':
      return <DoneBadge label={t('unsubscribed')} />
  }
}
