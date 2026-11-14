import {describe, expect, it} from 'vitest'

import {
  addDays,
  partRunAfter,
  planCampaignParts,
  retryDelayMs,
  slidePartsAfterDeferral,
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

describe('partRunAfter — échéance de la tâche d’une part', () => {
  const now = new Date('2026-11-12T13:32:00.000Z')

  it('une part du jour part maintenant', () => {
    expect(partRunAfter('2026-11-12', now)).toEqual(now)
  })

  it('une part d’un jour suivant part à 02:00, heure de Paris (ADR 053 §6)', () => {
    expect(partRunAfter('2026-11-13', now).toISOString()).toBe(
      '2026-11-13T01:00:00.000Z'
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

describe('partRunAfter — la marge de 02:00, en hiver et en été (ADR 053 §6)', () => {
  it('une part d’un jour suivant part à 02:00 heure de Paris, jamais à minuit', () => {
    const now = new Date('2026-11-12T13:32:00.000Z')
    expect(partRunAfter('2026-11-13', now).toISOString()).toBe(
      '2026-11-13T01:00:00.000Z'
    )
    expect(
      partRunAfter('2026-07-02', new Date('2026-07-01T10:00:00Z')).toISOString()
    ).toBe('2026-07-02T00:00:00.000Z')
  })

  it('une part en retard part maintenant', () => {
    const now = new Date('2026-11-14T08:00:00.000Z')
    expect(partRunAfter('2026-11-13', now)).toEqual(now)
  })
})

describe('slidePartsAfterDeferral — le plafond des campagnes tient le lendemain d’un report (revue s52, n° 1)', () => {
  const CAP = 100
  const loadOf = (
    allotted: Record<string, number>,
    moves: {id: string; day: string}[],
    parts: {id: string; day: string; count: number}[]
  ) => {
    const load = {...allotted}
    for (const move of moves) {
      const part = parts.find((candidate) => candidate.id === move.id)
      if (!part) throw new Error(`part inconnue : ${move.id}`)
      load[part.day] -= part.count
      load[move.day] = (load[move.day] ?? 0) + part.count
    }
    return load
  }

  it('la maquette : 40 reportés au 15/11 partent d’abord, la part 3 (96) glisse au 16/11', () => {
    const parts = [{id: 'p3', campaignId: 'a', day: '2026-11-15', count: 96}]
    const allotted = {'2026-11-15': 96 + 40}

    const moves = slidePartsAfterDeferral({
      parts,
      allottedByDay: allotted,
      dailyCap: CAP,
      floorByCampaign: {a: '2026-11-15'},
    })

    expect(moves).toEqual([{id: 'p3', day: '2026-11-16'}])
    expect(loadOf(allotted, moves, parts)).toEqual({
      '2026-11-15': 40,
      '2026-11-16': 96,
    })
  })

  it('tout le reste de la campagne glisse d’un jour, dans l’ordre de ses parts', () => {
    const parts = [
      {id: 'p2', campaignId: 'a', day: '2026-11-13', count: 100},
      {id: 'p3', campaignId: 'a', day: '2026-11-14', count: 96},
    ]

    expect(
      slidePartsAfterDeferral({
        parts,
        allottedByDay: {'2026-11-13': 100 + 40, '2026-11-14': 96},
        dailyCap: CAP,
        floorByCampaign: {a: '2026-11-13'},
      })
    ).toEqual([
      {id: 'p2', day: '2026-11-14'},
      {id: 'p3', day: '2026-11-15'},
    ])
  })

  it('les parts des autres campagnes glissent aussi quand il le faut : aucun jour ne dépasse le plafond, toutes campagnes confondues', () => {
    const parts = [
      {id: 'a2', campaignId: 'a', day: '2026-11-13', count: 50},
      {id: 'b1', campaignId: 'b', day: '2026-11-13', count: 50},
      {id: 'b2', campaignId: 'b', day: '2026-11-14', count: 100},
      {id: 'c1', campaignId: 'c', day: '2026-11-15', count: 30},
    ]
    const allotted = {
      '2026-11-13': 50 + 50 + 40,
      '2026-11-14': 100,
      '2026-11-15': 30,
    }

    const moves = slidePartsAfterDeferral({
      parts,
      allottedByDay: allotted,
      dailyCap: CAP,
      floorByCampaign: {a: '2026-11-13'},
    })

    const load = loadOf(allotted, moves, parts)
    for (const total of Object.values(load))
      expect(total).toBeLessThanOrEqual(CAP)
    expect(load['2026-11-13']).toBeGreaterThanOrEqual(40)
    const dayOf = (id: string) =>
      moves.find((move) => move.id === id)?.day ??
      parts.find((part) => part.id === id)?.day ??
      ''
    expect(dayOf('a2') > '2026-11-13').toBe(true)
    expect(dayOf('b2') > dayOf('b1')).toBe(true)
  })

  it('rien ne glisse quand le lendemain a la place : le plan de s26 est gardé', () => {
    expect(
      slidePartsAfterDeferral({
        parts: [{id: 'b1', campaignId: 'b', day: '2026-11-13', count: 30}],
        allottedByDay: {'2026-11-13': 30 + 40},
        dailyCap: CAP,
        floorByCampaign: {a: '2026-11-13'},
      })
    ).toEqual([])
  })

  it('une part plus grande que le plafond abaissé depuis prend un jour libre, sans boucler', () => {
    expect(
      slidePartsAfterDeferral({
        parts: [{id: 'p2', campaignId: 'a', day: '2026-11-13', count: 100}],
        allottedByDay: {'2026-11-13': 100 + 20, '2026-11-14': 10},
        dailyCap: 50,
        floorByCampaign: {a: '2026-11-13'},
      })
    ).toEqual([{id: 'p2', day: '2026-11-15'}])
  })

  it('une part ne glisse jamais avant son jour', () => {
    expect(
      slidePartsAfterDeferral({
        parts: [{id: 'b3', campaignId: 'b', day: '2026-11-20', count: 100}],
        allottedByDay: {'2026-11-13': 40, '2026-11-20': 100},
        dailyCap: CAP,
        floorByCampaign: {a: '2026-11-13'},
      })
    ).toEqual([])
  })
})
