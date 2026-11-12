import {CAMPAIGN_PART_RETRY_STEP_MS} from '../types/domain/campaign-types'

/**
 * Regles pures de l'etalement d'une campagne en parts quotidiennes (s26,
 * ADR 052). Aucun acces a la base ni a l'horloge : l'instant et le jour du
 * jour viennent de l'appelant (`calendarDayOf(instant)`). Le jour est celui
 * de Paris, au format ISO `YYYY-MM-DD`.
 */

/** Une part : un jour de Paris et le nombre de destinataires qu'il recoit. */
export type PlannedCampaignPart = {day: string; count: number}

/** Destinataires deja programmes, par jour, toutes campagnes confondues. */
export type AllottedByDay = Readonly<Record<string, number>>

const DAY_MS = 24 * 60 * 60 * 1000
const PARIS_TIME_ZONE = 'Europe/Paris'

/** Le jour calendaire `days` jours apres (ou avant) `day`, sans fuseau. */
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)

/**
 * Le plan d'envoi : les jours sont remplis dans l'ordre a partir d'aujourd'hui,
 * chacun a hauteur de `plafond − deja programme ce jour-la`. Un jour plein est
 * saute ; aucune part n'est nulle. Le nombre de parts decoule des
 * destinataires et du plafond, il n'est jamais fixe.
 */
export const planCampaignParts = (
  recipientCount: number,
  dailyCap: number,
  allottedByDay: AllottedByDay,
  today: string
): PlannedCampaignPart[] => {
  if (!Number.isInteger(dailyCap) || dailyCap < 1) {
    throw new Error('Plafond quotidien des campagnes invalide')
  }

  const parts: PlannedCampaignPart[] = []
  let left = recipientCount
  let day = today
  while (left > 0) {
    const free = Math.max(0, dailyCap - (allottedByDay[day] ?? 0))
    if (free > 0) {
      const count = Math.min(free, left)
      parts.push({day, count})
      left -= count
    }
    day = addDays(day, 1)
  }
  return parts
}

/** Decalage de Paris par rapport a UTC a un instant donne, en millisecondes. */
const parisOffsetMsAt = (instant: Date): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PARIS_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(({type, value}) => [type, Number(value)])
  )
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Minuit a Paris du jour donne. Le changement d'heure a lieu a 2 h ou 3 h
 * locales : le decalage a minuit UTC du jour est celui de minuit a Paris.
 */
export const parisDayStart = (day: string): Date => {
  const utcMidnight = new Date(`${day}T00:00:00Z`)
  return new Date(utcMidnight.getTime() - parisOffsetMsAt(utcMidnight))
}

/**
 * L'echeance de la tache d'une part : maintenant pour une part du jour (ou en
 * retard), minuit a Paris pour une part d'un jour suivant.
 */
export const partRunAfter = (day: string, now: Date): Date => {
  const start = parisDayStart(day)
  return start.getTime() > now.getTime() ? start : now
}

/** Delai avant la nouvelle tentative d'une part : 30 min x tentative. */
export const retryDelayMs = (attempt: number): number =>
  CAMPAIGN_PART_RETRY_STEP_MS * attempt
