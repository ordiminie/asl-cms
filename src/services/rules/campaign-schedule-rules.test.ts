import {describe, expect, it} from 'vitest'

import {calendarDayOf} from '../types/domain/water-analysis-types'
import {
  addDays,
  parisDayStart,
  partRunAfter,
  planCampaignParts,
  retryDelayMs,
} from './campaign-schedule-rules'

const TODAY = '2026-11-12'

const counts = (parts: {count: number}[]) => parts.map((part) => part.count)

describe('planCampaignParts — parts quotidiennes sous le plafond (critères 1 à 4)', () => {
  it.each([
    [100, [100]],
    [101, [100, 1]],
    [200, [100, 100]],
    [201, [100, 100, 1]],
    [250, [100, 100, 50]],
    [300, [100, 100, 100]],
  ])('%i destinataires, plafond 100 → %j', (recipients, expected) => {
    expect(counts(planCampaignParts(recipients, 100, {}, TODAY))).toEqual(
      expected
    )
  })

  it('250 destinataires : un jour par part, le premier aujourd’hui', () => {
    expect(planCampaignParts(250, 100, {}, TODAY)).toEqual([
      {day: '2026-11-12', count: 100},
      {day: '2026-11-13', count: 100},
      {day: '2026-11-14', count: 50},
    ])
  })

  it('le plafond est celui du tenant : 500 fait partir 400 destinataires en une fois', () => {
    expect(planCampaignParts(400, 500, {}, TODAY)).toEqual([
      {day: TODAY, count: 400},
    ])
  })

  it('le plafond du jour est partagé : 40 déjà programmés aujourd’hui → 60 puis 100…', () => {
    expect(planCampaignParts(296, 100, {[TODAY]: 40}, TODAY)).toEqual([
      {day: '2026-11-12', count: 60},
      {day: '2026-11-13', count: 100},
      {day: '2026-11-14', count: 100},
      {day: '2026-11-15', count: 36},
    ])
  })

  it('deux campagnes le même jour se partagent les 100 envois', () => {
    const first = planCampaignParts(70, 100, {}, TODAY)
    const allotted = Object.fromEntries(
      first.map((part) => [part.day, part.count])
    )
    const second = planCampaignParts(70, 100, allotted, TODAY)

    expect(first).toEqual([{day: TODAY, count: 70}])
    expect(second).toEqual([
      {day: '2026-11-12', count: 30},
      {day: '2026-11-13', count: 40},
    ])
  })

  it('un jour déjà plein est sauté, jamais une part nulle', () => {
    const parts = planCampaignParts(
      150,
      100,
      {[TODAY]: 100, '2026-11-13': 120, '2026-11-14': 30},
      TODAY
    )

    expect(parts).toEqual([
      {day: '2026-11-14', count: 70},
      {day: '2026-11-15', count: 80},
    ])
    expect(parts.every((part) => part.count > 0)).toBe(true)
  })

  it('aucun destinataire → aucune part', () => {
    expect(planCampaignParts(0, 100, {}, TODAY)).toEqual([])
  })

  it('refuse un plafond qui ne permet aucun envoi', () => {
    expect(() => planCampaignParts(10, 0, {}, TODAY)).toThrow()
  })
})

describe('addDays — calendrier, sans fuseau', () => {
  it('passe les fins de mois et d’année', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
  })
})

describe('parisDayStart — minuit à Paris, changements d’heure compris', () => {
  it('en heure d’hiver, minuit à Paris est 23 h UTC la veille', () => {
    expect(parisDayStart('2026-11-13').toISOString()).toBe(
      '2026-11-12T23:00:00.000Z'
    )
  })

  it('en heure d’été, minuit à Paris est 22 h UTC la veille', () => {
    expect(parisDayStart('2026-07-01').toISOString()).toBe(
      '2026-06-30T22:00:00.000Z'
    )
  })

  it('le 29/03/2026 (passage à l’heure d’été à 2 h), minuit est encore en hiver', () => {
    expect(parisDayStart('2026-03-29').toISOString()).toBe(
      '2026-03-28T23:00:00.000Z'
    )
    expect(parisDayStart('2026-03-30').toISOString()).toBe(
      '2026-03-29T22:00:00.000Z'
    )
  })

  it('le 25/10/2026 (retour à l’heure d’hiver à 3 h), minuit est encore en été', () => {
    expect(parisDayStart('2026-10-25').toISOString()).toBe(
      '2026-10-24T22:00:00.000Z'
    )
    expect(parisDayStart('2026-10-26').toISOString()).toBe(
      '2026-10-25T23:00:00.000Z'
    )
  })

  it('est bien le premier instant du jour de Paris', () => {
    for (const day of ['2026-03-29', '2026-10-25', '2026-11-13']) {
      const start = parisDayStart(day)
      expect(calendarDayOf(start)).toBe(day)
      expect(calendarDayOf(new Date(start.getTime() - 1))).toBe(
        addDays(day, -1)
      )
    }
  })
})

describe('partRunAfter — échéance de la tâche d’une part', () => {
  const now = new Date('2026-11-12T13:32:00.000Z')

  it('une part du jour part maintenant', () => {
    expect(partRunAfter('2026-11-12', now)).toEqual(now)
  })

  it('une part d’un jour suivant part à minuit, heure de Paris', () => {
    expect(partRunAfter('2026-11-13', now).toISOString()).toBe(
      '2026-11-12T23:00:00.000Z'
    )
  })
})

describe('retryDelayMs — reprise après un échec', () => {
  it('attend 30 minutes de plus à chaque tentative', () => {
    expect(retryDelayMs(1)).toBe(30 * 60 * 1000)
    expect(retryDelayMs(2)).toBe(60 * 60 * 1000)
    expect(retryDelayMs(3)).toBe(90 * 60 * 1000)
  })
})
