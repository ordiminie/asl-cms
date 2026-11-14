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
const HOUR_MS = 60 * 60 * 1000
const PARIS_TIME_ZONE = 'Europe/Paris'
/**
 * Heure de Paris avant laquelle rien de reportable ne part un jour suivant
 * (ADR 053 §6) : couvre une remise a zero du fournisseur a minuit UTC.
 */
const NEXT_DAY_SEND_HOUR = 2

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

/** Jour et heure de Paris d'un instant, pour comparaison lexicale. */
const parisDayAndHour = (instant: Date): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: PARIS_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
    })
      .formatToParts(instant)
      .map(({type, value}) => [type, value])
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`
}

/**
 * Le premier instant du jour `day` ou Paris lit 02:00 ou plus. Paris est a
 * UTC+1 ou UTC+2 : l'instant est l'un des deux candidats, le plus tot qui
 * convient. Le jour du passage a l'heure d'ete, 02:00 n'existe pas : 03:00.
 * Jamais avant minuit UTC du meme jour.
 */
export const parisTwoAm = (day: string): Date => {
  const wallClockAsUtc = Date.parse(
    `${day}T${String(NEXT_DAY_SEND_HOUR).padStart(2, '0')}:00:00Z`
  )
  const target = `${day}T${String(NEXT_DAY_SEND_HOUR).padStart(2, '0')}`
  const candidates = [2, 1].map(
    (offsetHours) => new Date(wallClockAsUtc - offsetHours * HOUR_MS)
  )
  return (
    candidates.find((candidate) => parisDayAndHour(candidate) >= target) ??
    candidates[1]
  )
}

/**
 * L'echeance de la tache d'une part : maintenant pour une part du jour (ou en
 * retard), 02:00 a Paris pour une part d'un jour suivant (ADR 053 §6).
 */
export const partRunAfter = (day: string, now: Date): Date => {
  const start = parisTwoAm(day)
  return start.getTime() > now.getTime() ? start : now
}

/** Delai avant la nouvelle tentative d'une part : 30 min x tentative. */
export const retryDelayMs = (attempt: number): number =>
  CAMPAIGN_PART_RETRY_STEP_MS * attempt

/** Une part encore programmee, qui peut glisser a un jour suivant. */
export type SlidablePart = {
  id: string
  campaignId: string
  day: string
  count: number
}

export type SlidePartsInput = {
  /** Les parts programmees a partir du jour du reste reporte. */
  parts: readonly SlidablePart[]
  /** Destinataires programmes par jour, ces parts et les restes compris. */
  allottedByDay: AllottedByDay
  dailyCap: number
  /**
   * Par campagne, le jour de son reste reporte : ses parts suivantes partent
   * apres lui, jamais avant ni le meme jour.
   */
  floorByCampaign: Readonly<Record<string, string>>
}

/**
 * Apres un report faute de budget (revue s52, n° 1) : le reste reporte part
 * d'abord, le lendemain, et les parts programmees glissent au premier jour
 * suivant qui les tient sous le plafond, toutes campagnes confondues — dans
 * l'ordre de leurs jours, chaque campagne apres ses parts precedentes. Une
 * part ne glisse jamais avant son jour ; une part plus grande que le plafond
 * (abaisse depuis la creation) prend un jour libre. Rend les seules parts
 * deplacees, avec leur nouveau jour.
 */
export const slidePartsAfterDeferral = ({
  parts,
  allottedByDay,
  dailyCap,
  floorByCampaign,
}: SlidePartsInput): {id: string; day: string}[] => {
  const load: Record<string, number> = {...allottedByDay}
  for (const part of parts) load[part.day] = (load[part.day] ?? 0) - part.count
  const floor: Record<string, string> = {...floorByCampaign}
  const fits = (day: string, count: number): boolean => {
    const taken = load[day] ?? 0
    return taken <= 0 || taken + count <= dailyCap
  }

  const moves: {id: string; day: string}[] = []
  const ordered = [...parts].sort((a, b) => a.day.localeCompare(b.day))
  for (const part of ordered) {
    const after = floor[part.campaignId]
    let day =
      after && addDays(after, 1) > part.day ? addDays(after, 1) : part.day
    while (!fits(day, part.count)) day = addDays(day, 1)
    load[day] = (load[day] ?? 0) + part.count
    floor[part.campaignId] = day
    if (day !== part.day) moves.push({id: part.id, day})
  }
  return moves
}
