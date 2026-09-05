import {describe, expect, it} from 'vitest'

import {resolveCreditPeriod} from '@/lib/helper/credit-period-helper'

describe('resolveCreditPeriod', () => {
  const now = new Date('2026-07-16T10:00:00Z')

  it('retourne le mois calendaire courant sans aucune donnée', () => {
    const period = resolveCreditPeriod({now})

    expect(period.periodStart).toEqual(new Date(2026, 6, 1))
    expect(period.periodEnd).toEqual(new Date(2026, 7, 1))
    expect(period.nextRefreshAt).toEqual(new Date(2026, 7, 1))
  })

  it("retourne l'allocation mensuelle active telle quelle", () => {
    const allocation = {
      periodStart: new Date('2026-07-10T00:00:00Z'),
      periodEnd: new Date('2026-08-10T00:00:00Z'),
    }

    const period = resolveCreditPeriod({allocation, now})

    expect(period.periodStart).toEqual(allocation.periodStart)
    expect(period.periodEnd).toEqual(allocation.periodEnd)
    expect(period.nextRefreshAt).toEqual(allocation.periodEnd)
  })

  it("mensualise une allocation annuelle en tranche contenant now, ancrée sur l'anniversaire", () => {
    const allocation = {
      periodStart: new Date('2026-03-05T00:00:00Z'),
      periodEnd: new Date('2027-03-05T00:00:00Z'),
    }

    const period = resolveCreditPeriod({allocation, now})

    expect(period.periodStart).toEqual(new Date('2026-07-05T00:00:00Z'))
    expect(period.periodEnd).toEqual(new Date('2026-08-05T00:00:00Z'))
    expect(period.periodStart <= now && now < period.periodEnd).toBe(true)
  })

  it('ignore une allocation expirée et retombe sur la période subscription', () => {
    const allocation = {
      periodStart: new Date('2026-05-01T00:00:00Z'),
      periodEnd: new Date('2026-06-01T00:00:00Z'),
    }
    const subscriptionPeriod = {
      periodStart: new Date('2026-07-01T00:00:00Z'),
      periodEnd: new Date('2026-08-01T00:00:00Z'),
    }

    const period = resolveCreditPeriod({allocation, subscriptionPeriod, now})

    expect(period.periodStart).toEqual(subscriptionPeriod.periodStart)
    expect(period.periodEnd).toEqual(subscriptionPeriod.periodEnd)
  })

  it('retourne la période subscription mensuelle active telle quelle', () => {
    const subscriptionPeriod = {
      periodStart: new Date('2026-06-20T00:00:00Z'),
      periodEnd: new Date('2026-07-20T00:00:00Z'),
    }

    const period = resolveCreditPeriod({subscriptionPeriod, now})

    expect(period.periodEnd).toEqual(subscriptionPeriod.periodEnd)
  })

  it('avance une période subscription périmée jusqu à contenir now (lag de renouvellement)', () => {
    const subscriptionPeriod = {
      periodStart: new Date('2026-05-12T00:00:00Z'),
      periodEnd: new Date('2026-06-12T00:00:00Z'),
    }

    const period = resolveCreditPeriod({subscriptionPeriod, now})

    expect(period.periodStart).toEqual(new Date('2026-07-12T00:00:00Z'))
    expect(period.periodEnd).toEqual(new Date('2026-08-12T00:00:00Z'))
  })

  it('mensualise une subscription annuelle', () => {
    const subscriptionPeriod = {
      periodStart: new Date('2025-11-20T00:00:00Z'),
      periodEnd: new Date('2026-11-20T00:00:00Z'),
    }

    const period = resolveCreditPeriod({subscriptionPeriod, now})

    expect(period.periodStart).toEqual(new Date('2026-06-20T00:00:00Z'))
    expect(period.periodEnd).toEqual(new Date('2026-07-20T00:00:00Z'))
  })

  it('clampe les ancrages de fin de mois (31 janvier, now en mars)', () => {
    const marchNow = new Date('2026-03-15T10:00:00Z')
    const subscriptionPeriod = {
      periodStart: new Date('2026-01-31T00:00:00Z'),
      periodEnd: new Date('2027-01-31T00:00:00Z'),
    }

    const period = resolveCreditPeriod({subscriptionPeriod, now: marchNow})

    expect(period.periodStart <= marchNow).toBe(true)
    expect(marchNow < period.periodEnd).toBe(true)
    expect(period.periodEnd.getTime()).toBeGreaterThan(
      period.periodStart.getTime()
    )
  })

  it('bascule sur la tranche suivante quand now == periodEnd de l allocation', () => {
    const allocation = {
      periodStart: new Date('2026-06-16T00:00:00Z'),
      periodEnd: new Date('2026-07-16T10:00:00Z'),
    }
    const subscriptionPeriod = {
      periodStart: new Date('2026-06-16T00:00:00Z'),
      periodEnd: new Date('2026-07-16T10:00:00Z'),
    }

    const period = resolveCreditPeriod({allocation, subscriptionPeriod, now})

    expect(period.periodStart <= now && now < period.periodEnd).toBe(true)
  })

  it('ignore une période dont une borne est null', () => {
    const period = resolveCreditPeriod({
      allocation: {periodStart: new Date(), periodEnd: null},
      subscriptionPeriod: {periodStart: null, periodEnd: null},
      now,
    })

    expect(period.periodStart).toEqual(new Date(2026, 6, 1))
    expect(period.periodEnd).toEqual(new Date(2026, 7, 1))
  })
})
