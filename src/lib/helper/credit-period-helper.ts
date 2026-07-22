import {addMonths, differenceInMonths} from 'date-fns'

export type CreditPeriodInput = {
  periodStart: Date | null
  periodEnd: Date | null
}

export type CreditPeriod = {
  periodStart: Date
  periodEnd: Date
  nextRefreshAt: Date
}

// Au-delà de 32 jours, la période n'est pas mensuelle (plan annuel) :
// on la découpe en tranches mensuelles ancrées sur son periodStart.
const MAX_MONTHLY_SPAN_DAYS = 32

const DAY_MS = 24 * 60 * 60 * 1000

type ValidPeriod = {start: Date; end: Date}

const toValidPeriod = (
  input?: CreditPeriodInput | null
): ValidPeriod | undefined => {
  if (!input?.periodStart || !input.periodEnd) return undefined
  return {start: input.periodStart, end: input.periodEnd}
}

const spanDays = (period: ValidPeriod): number =>
  (period.end.getTime() - period.start.getTime()) / DAY_MS

const isActive = (period: ValidPeriod, now: Date): boolean =>
  period.start <= now && now < period.end

const toCreditPeriod = (period: ValidPeriod): CreditPeriod => ({
  periodStart: period.start,
  periodEnd: period.end,
  nextRefreshAt: period.end,
})

// Tranche mensuelle contenant `now`, ancrée sur `anchor` (date d'anniversaire
// Stripe). addMonths clampe les fins de mois (31 janv + 1 mois = 28 févr),
// differenceInMonths peut donc être décalé de ±1 : on corrige après coup.
const monthlySlice = (anchor: Date, now: Date): CreditPeriod => {
  let n = Math.max(0, differenceInMonths(now, anchor))
  if (now < addMonths(anchor, n) && n > 0) {
    n -= 1
  } else if (now >= addMonths(anchor, n + 1)) {
    n += 1
  }
  return toCreditPeriod({
    start: addMonths(anchor, n),
    end: addMonths(anchor, n + 1),
  })
}

/**
 * Résout la période de crédits courante et la prochaine date de refresh.
 * Priorité : allocation active du ledger > période subscription > mois calendaire.
 */
export const resolveCreditPeriod = (params: {
  allocation?: CreditPeriodInput | null
  subscriptionPeriod?: CreditPeriodInput | null
  now?: Date
}): CreditPeriod => {
  const now = params.now ?? new Date()

  const allocation = toValidPeriod(params.allocation)
  if (allocation && isActive(allocation, now)) {
    if (spanDays(allocation) <= MAX_MONTHLY_SPAN_DAYS) {
      return toCreditPeriod(allocation)
    }
    return monthlySlice(allocation.start, now)
  }

  const subscriptionPeriod = toValidPeriod(params.subscriptionPeriod)
  if (subscriptionPeriod) {
    if (
      isActive(subscriptionPeriod, now) &&
      spanDays(subscriptionPeriod) <= MAX_MONTHLY_SPAN_DAYS
    ) {
      return toCreditPeriod(subscriptionPeriod)
    }
    return monthlySlice(subscriptionPeriod.start, now)
  }

  return toCreditPeriod({
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  })
}
