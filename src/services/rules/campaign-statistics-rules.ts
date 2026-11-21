import type {TagStatisticsResult} from '@/lib/emails/transport'

import {
  CAMPAIGN_STATISTICS_WINDOW_DAYS,
  type CampaignStatisticsDTO,
  type CampaignStatisticsUnavailableReason,
  type CampaignStatus,
} from '../types/domain/campaign-types'
import {addDays} from './campaign-schedule-rules'

/**
 * Regles pures des statistiques d'une campagne (s30, ADR 068 §5-§7). Aucun
 * acces a la base, au fournisseur ni a l'horloge : les jours (Paris, ISO
 * `YYYY-MM-DD`) et l'instant de lecture viennent de l'appelant.
 */

/** Ce que la lecture du fournisseur a rendu ; `null` : aucune lecture. */
export type CampaignStatisticsReading =
  TagStatisticsResult | {status: 'error'} | null

/** Le dernier releve conserve sur la campagne (ADR 068 §4). */
export type CampaignStatisticsSnapshot = {
  uniqueOpens: number
  uniqueClicks: number
  /** Instant du releve, ISO. */
  readAt: string
}

export type CampaignStatisticsRuleInput = {
  status: CampaignStatus
  sentCount: number
  statsTracked: boolean
  /** Jour de Paris de la creation de la campagne. */
  createdDay: string
  /** Jour de Paris de la lecture. */
  today: string
  /** Dernier jour d'envoi prevu, pour une campagne en cours. */
  lastSendDay: string
  snapshot: CampaignStatisticsSnapshot | null
  reading: CampaignStatisticsReading
  /** Instant de cette lecture, ISO : celui d'un releve a ecrire. */
  readAt: string
}

export type CampaignStatisticsOutcome = {
  statistics: CampaignStatisticsDTO
  /** L'agregat est consolide : le releve est a ecrire (ADR 068 §4). */
  shouldSave: boolean
}

/**
 * La plage lue chez le fournisseur (ADR 068 §6) : de la veille du jour de
 * creation a aujourd'hui, si elle tient en `CAMPAIGN_STATISTICS_WINDOW_DAYS`
 * jours inclusifs ; sinon `null`, rien ne se lit.
 */
export const campaignStatisticsWindowOf = (
  createdDay: string,
  today: string
): {startDate: string; endDate: string} | null => {
  const startDate = addDays(createdDay, -1)
  if (today > addDays(startDate, CAMPAIGN_STATISTICS_WINDOW_DAYS - 1)) {
    return null
  }
  return {startDate, endDate: today}
}

/**
 * La plage envoyee au fournisseur (ADR 068 §6) : sa fin est le plus tot du
 * jour de Paris et du jour UTC de la lecture. Entre minuit a Paris et minuit
 * UTC, le jour de Paris serait « demain » pour Brevo, qui compte en UTC.
 */
export const providerStatisticsWindowOf = (
  window: {startDate: string; endDate: string},
  utcToday: string
): {startDate: string; endDate: string} => ({
  startDate: window.startDate,
  endDate: window.endDate < utcToday ? window.endDate : utcToday,
})

/**
 * Le fournisseur n'est interroge que pour une campagne terminee, dont un
 * email au moins est parti, suivie et encore dans la fenetre.
 */
export const needsProviderReading = (
  input: Pick<
    CampaignStatisticsRuleInput,
    'status' | 'sentCount' | 'statsTracked' | 'createdDay' | 'today'
  >
): boolean =>
  input.sentCount > 0 &&
  input.status !== 'sending' &&
  input.statsTracked &&
  campaignStatisticsWindowOf(input.createdDay, input.today) !== null

/**
 * Taux arrondi a l'entier, sur les emails envoyes, plafonne a 100 (ADR 068
 * §7) : un email `to_verify` reellement parti n'est pas dans `sent_count`.
 */
const rateOf = (unique: number, sentCount: number): number =>
  Math.min(100, Math.round((unique * 100) / sentCount))

const availableOf = (
  sentCount: number,
  counts: {uniqueOpens: number; uniqueClicks: number},
  readAt: string,
  fromSnapshot: boolean
): CampaignStatisticsDTO => ({
  state: 'available',
  sentCount,
  uniqueOpens: counts.uniqueOpens,
  uniqueClicks: counts.uniqueClicks,
  openRate: rateOf(counts.uniqueOpens, sentCount),
  clickRate: rateOf(counts.uniqueClicks, sentCount),
  readAt,
  fromSnapshot,
})

const shown = (
  statistics: CampaignStatisticsDTO
): CampaignStatisticsOutcome => ({
  statistics,
  shouldSave: false,
})

/** Faute de lecture : le dernier releve s'il existe, sinon la raison. */
const fallbackOf = (
  input: CampaignStatisticsRuleInput,
  reason: CampaignStatisticsUnavailableReason
): CampaignStatisticsOutcome =>
  input.snapshot
    ? shown(
        availableOf(
          input.sentCount,
          input.snapshot,
          input.snapshot.readAt,
          true
        )
      )
    : shown({state: 'unavailable', reason})

/**
 * L'etat affiche (ADR 068 §5), dans l'ordre : campagne en cours, rien de
 * parti, non suivie, hors fenetre, puis la lecture. Consolide = `requests`
 * du fournisseur >= `sentCount` : alors seulement des chiffres, et un releve
 * a ecrire. Une campagne `sending` sans email encore parti attend son
 * dernier envoi : « rien a mesurer » est reserve a une campagne terminee.
 */
export const campaignStatisticsOf = (
  input: CampaignStatisticsRuleInput
): CampaignStatisticsOutcome => {
  if (input.status === 'sending') {
    return shown({state: 'pending_sending', lastSendDay: input.lastSendDay})
  }
  if (input.sentCount === 0) return shown({state: 'nothing_sent'})
  if (!input.statsTracked) {
    return shown({state: 'unavailable', reason: 'untracked'})
  }
  if (!campaignStatisticsWindowOf(input.createdDay, input.today)) {
    return fallbackOf(input, 'expired')
  }

  const {reading} = input
  if (!reading || reading.status === 'error') {
    return fallbackOf(input, 'unreachable')
  }
  if (reading.status === 'unsupported') {
    return fallbackOf(input, 'unsupported')
  }
  if (reading.requests < input.sentCount) {
    return shown({state: 'pending_provider'})
  }
  return {
    statistics: availableOf(input.sentCount, reading, input.readAt, false),
    shouldSave: true,
  }
}
