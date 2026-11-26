import type {
  ProfileAccess,
  ProfileAccessWindow,
  ProfileOwnershipPeriod,
} from '../types/domain/member-profile-access-types'
import {addDays} from './campaign-schedule-rules'

/**
 * Règles pures de l'accès à une fiche après la vente (s57, ADR 075 §1). Ni
 * base ni horloge : le jour calendaire de Paris `today` et le délai viennent
 * de l'appelant. Jours au format ISO `YYYY-MM-DD`.
 */

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

/**
 * Le jour calendaire `months` mois après `day`, sans fuseau ; un jour qui
 * n'existe pas dans le mois d'arrivée est ramené au dernier jour du mois
 * (31/08 + 6 mois = 28/02, ou 29/02 une année bissextile).
 */
export const addMonthsToDay = (day: string, months: number): string => {
  const [year, month, date] = day.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const targetYear = target.getUTCFullYear()
  const targetMonth = target.getUTCMonth()
  const clampedDate = Math.min(date, daysInMonth(targetYear, targetMonth))
  return new Date(Date.UTC(targetYear, targetMonth, clampedDate))
    .toISOString()
    .slice(0, 10)
}

const latestDay = (days: string[]): string =>
  days.reduce((latest, day) => (day > latest ? day : latest))

/** L'état d'une fiche à partir de ses périodes, du délai en mois et du jour. */
export const profileAccessOf = (
  periods: readonly ProfileOwnershipPeriod[],
  months: number,
  today: string
): ProfileAccess => {
  if (periods.length === 0) return {status: 'out_of_rule'}
  if (periods.some((period) => period.endsOn === null)) {
    return {status: 'owner'}
  }
  const soldOn = latestDay(periods.map((period) => period.endsOn as string))
  const closesOn = addMonthsToDay(soldOn, months)
  return today < closesOn
    ? {status: 'grace', soldOn, closesOn}
    : {status: 'closed', soldOn, closesOn}
}

/**
 * Vrai si un élément daté `day` reste visible : toujours, hors délai ; dans
 * le délai, seulement strictement avant la vente (le jour de la vente est le
 * premier jour de l'acquéreur).
 */
export const isBeforeSale = (day: string, access: ProfileAccess): boolean =>
  access.status !== 'grace' || day < access.soldOn

/** La fin d'accès lue par le bureau, ou rien hors délai et hors fermeture. */
export const accessWindowOf = (
  access: ProfileAccess
): ProfileAccessWindow | null => {
  if (access.status === 'grace') {
    return {
      status: 'grace',
      soldOn: access.soldOn,
      openUntil: addDays(access.closesOn, -1),
    }
  }
  if (access.status === 'closed') {
    return {
      status: 'closed',
      soldOn: access.soldOn,
      closedSince: access.closesOn,
    }
  }
  return null
}
