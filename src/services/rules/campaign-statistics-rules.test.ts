import {describe, expect, it} from 'vitest'

import {
  campaignStatisticsOf,
  type CampaignStatisticsRuleInput,
  campaignStatisticsWindowOf,
  needsProviderReading,
} from './campaign-statistics-rules'

const READ_AT = '2026-11-21T09:32:00.000Z'

const consolidated = {
  status: 'found' as const,
  requests: 302,
  delivered: 300,
  uniqueOpens: 154,
  uniqueClicks: 42,
}

const input = (
  overrides: Partial<CampaignStatisticsRuleInput> = {}
): CampaignStatisticsRuleInput => ({
  status: 'sent',
  sentCount: 302,
  statsTracked: true,
  createdDay: '2026-11-12',
  today: '2026-11-21',
  lastSendDay: '2026-11-14',
  snapshot: null,
  reading: consolidated,
  readAt: READ_AT,
  ...overrides,
})

const snapshot = {
  uniqueOpens: 150,
  uniqueClicks: 40,
  readAt: '2026-11-18T08:00:00.000Z',
}

describe('campaignStatisticsWindowOf — fenêtre de lecture (ADR 068 §6)', () => {
  it('de la veille du jour de création à aujourd’hui', () => {
    expect(campaignStatisticsWindowOf('2026-11-12', '2026-11-21')).toEqual({
      startDate: '2026-11-11',
      endDate: '2026-11-21',
    })
  })

  it('une plage de 89 jours (88 jours d’écart) se lit encore', () => {
    expect(campaignStatisticsWindowOf('2026-01-02', '2026-03-30')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-03-30',
    })
  })

  it('une plage de 90 jours (89 jours d’écart) ne se lit plus', () => {
    expect(campaignStatisticsWindowOf('2026-01-02', '2026-03-31')).toBeNull()
  })
})

describe('needsProviderReading — interroger le fournisseur ou non', () => {
  it('une campagne suivie, terminée, dans la fenêtre : oui', () => {
    expect(needsProviderReading(input())).toBe(true)
    expect(needsProviderReading(input({status: 'interrupted'}))).toBe(true)
  })

  it.each([
    ['en cours d’envoi', {status: 'sending' as const}],
    ['sans aucun email parti', {sentCount: 0}],
    ['non suivie', {statsTracked: false}],
    ['hors fenêtre', {createdDay: '2026-01-02', today: '2026-04-01'}],
  ])('%s : non', (_label, overrides) => {
    expect(needsProviderReading(input(overrides))).toBe(false)
  })
})

describe('campaignStatisticsOf — un chiffre n’est affiché que consolidé (critère 3)', () => {
  it('agrégat consolidé : envois, ouvertures et clics uniques, taux, relevé à écrire', () => {
    expect(campaignStatisticsOf(input())).toEqual({
      statistics: {
        state: 'available',
        sentCount: 302,
        uniqueOpens: 154,
        uniqueClicks: 42,
        openRate: 51,
        clickRate: 14,
        readAt: READ_AT,
        fromSnapshot: false,
      },
      shouldSave: true,
    })
  })

  it('le fournisseur a compté moins d’envois que nous : pas encore, jamais de chiffre', () => {
    const result = campaignStatisticsOf(
      input({reading: {...consolidated, requests: 301}})
    )

    expect(result).toEqual({
      statistics: {state: 'pending_provider'},
      shouldSave: false,
    })
  })

  it('un agrégat vide juste après l’envoi n’est pas « 0 ouverture »', () => {
    const result = campaignStatisticsOf(
      input({
        reading: {
          status: 'found',
          requests: 0,
          delivered: 0,
          uniqueOpens: 0,
          uniqueClicks: 0,
        },
        snapshot,
      })
    )

    expect(result.statistics).toEqual({state: 'pending_provider'})
    expect(result.shouldSave).toBe(false)
  })

  it('un vrai zéro consolidé s’affiche à 0', () => {
    const result = campaignStatisticsOf(
      input({
        sentCount: 3,
        reading: {
          status: 'found',
          requests: 3,
          delivered: 3,
          uniqueOpens: 0,
          uniqueClicks: 0,
        },
      })
    )

    expect(result.statistics).toMatchObject({
      state: 'available',
      sentCount: 3,
      uniqueOpens: 0,
      uniqueClicks: 0,
      openRate: 0,
      clickRate: 0,
    })
    expect(result.shouldSave).toBe(true)
  })

  it('une campagne interrompue, consolidée, a ses chiffres', () => {
    const result = campaignStatisticsOf(
      input({
        status: 'interrupted',
        sentCount: 120,
        reading: {
          ...consolidated,
          requests: 120,
        },
      })
    )

    expect(result.statistics).toMatchObject({
      state: 'available',
      sentCount: 120,
    })
    expect(result.shouldSave).toBe(true)
  })

  it('le taux est arrondi à l’entier : 51,5 % → 52 %', () => {
    const result = campaignStatisticsOf(
      input({
        sentCount: 200,
        reading: {
          status: 'found',
          requests: 200,
          delivered: 200,
          uniqueOpens: 103,
          uniqueClicks: 1,
        },
      })
    )

    expect(result.statistics).toMatchObject({openRate: 52, clickRate: 1})
  })

  it('aucun email parti : rien à mesurer, aucun taux calculé', () => {
    const result = campaignStatisticsOf(
      input({status: 'interrupted', sentCount: 0, reading: null})
    )

    expect(result).toEqual({
      statistics: {state: 'nothing_sent'},
      shouldSave: false,
    })
  })

  it('campagne en cours : après le dernier envoi, même avec un relevé', () => {
    const result = campaignStatisticsOf(
      input({status: 'sending', sentCount: 100, reading: null, snapshot})
    )

    expect(result).toEqual({
      statistics: {state: 'pending_sending', lastSendDay: '2026-11-14'},
      shouldSave: false,
    })
  })

  it('campagne en cours sans email encore parti : après le dernier envoi, pas « rien à mesurer »', () => {
    expect(
      campaignStatisticsOf(
        input({status: 'sending', sentCount: 0, reading: null})
      ).statistics
    ).toEqual({state: 'pending_sending', lastSendDay: '2026-11-14'})
  })

  it('campagne non suivie (antérieure à s30) : indisponible, jamais 0', () => {
    expect(
      campaignStatisticsOf(input({statsTracked: false, reading: null}))
    ).toEqual({
      statistics: {state: 'unavailable', reason: 'untracked'},
      shouldSave: false,
    })
  })

  it('fournisseur injoignable avec un relevé : le relevé, sans rien réécrire', () => {
    expect(
      campaignStatisticsOf(input({reading: {status: 'error'}, snapshot}))
    ).toEqual({
      statistics: {
        state: 'available',
        sentCount: 302,
        uniqueOpens: 150,
        uniqueClicks: 40,
        openRate: 50,
        clickRate: 13,
        readAt: '2026-11-18T08:00:00.000Z',
        fromSnapshot: true,
      },
      shouldSave: false,
    })
  })

  it('fournisseur injoignable sans relevé : indisponible, injoignable', () => {
    expect(campaignStatisticsOf(input({reading: {status: 'error'}}))).toEqual({
      statistics: {state: 'unavailable', reason: 'unreachable'},
      shouldSave: false,
    })
  })

  it('transport sans statistiques sans relevé : indisponible, sans suivi', () => {
    expect(
      campaignStatisticsOf(input({reading: {status: 'unsupported'}}))
    ).toEqual({
      statistics: {state: 'unavailable', reason: 'untracked'},
      shouldSave: false,
    })
  })

  it('hors fenêtre avec un relevé : le relevé conservé (campagne de plus de 90 jours)', () => {
    const result = campaignStatisticsOf(
      input({
        createdDay: '2026-01-02',
        today: '2026-04-01',
        reading: null,
        snapshot,
      })
    )

    expect(result.statistics).toMatchObject({
      state: 'available',
      uniqueOpens: 150,
      fromSnapshot: true,
    })
    expect(result.shouldSave).toBe(false)
  })

  it('hors fenêtre sans relevé : indisponible, fenêtre dépassée', () => {
    expect(
      campaignStatisticsOf(
        input({createdDay: '2026-01-02', today: '2026-04-01', reading: null})
      )
    ).toEqual({
      statistics: {state: 'unavailable', reason: 'expired'},
      shouldSave: false,
    })
  })

  it('hors fenêtre, une lecture fournie est ignorée', () => {
    expect(
      campaignStatisticsOf(
        input({createdDay: '2026-01-02', today: '2026-04-01'})
      ).statistics
    ).toEqual({state: 'unavailable', reason: 'expired'})
  })
})
