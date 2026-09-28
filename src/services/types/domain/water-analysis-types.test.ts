import {describe, expect, it} from 'vitest'

import {
  calendarDayOf,
  countWaterAnalysisPages,
  formatFileWeight,
  isSampledOnInFuture,
  isWaterAnalysisFileKeyAllowed,
  WATER_ANALYSIS_BUREAU_PAGE_SIZE,
  WATER_ANALYSIS_PUBLIC_PAGE_SIZE,
  waterAnalysisDownloadName,
} from './water-analysis-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const ANALYSIS_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_ANALYSIS_ID = '44444444-4444-4444-8444-444444444444'

/** Espace fine insecable : le separateur de milliers de `fr-FR`. */
const THIN_SPACE = ' '

describe('formatFileWeight — poids écrit en clair', () => {
  it("écrit un poids de moins d'un kilo-octet en octets", () => {
    expect(formatFileWeight(999)).toBe('999 octets')
  })

  it('écrit les kilo-octets arrondis, séparateur de milliers compris', () => {
    expect(formatFileWeight(320 * 1024)).toBe('320 Ko')
    expect(formatFileWeight(1023 * 1024)).toBe(`1${THIN_SPACE}023 Ko`)
  })

  it('passe aux mégaoctets à 1 Mo pile, sans décimale inutile', () => {
    expect(formatFileWeight(1024 * 1024)).toBe('1 Mo')
  })

  it('garde une décimale, à la virgule', () => {
    expect(formatFileWeight(4.25 * 1024 * 1024)).toBe('4,3 Mo')
    expect(formatFileWeight(4.2 * 1024 * 1024)).toBe('4,2 Mo')
  })
})

describe('waterAnalysisDownloadName', () => {
  it("nomme le PDF proposé au téléchargement d'après la date", () => {
    expect(waterAnalysisDownloadName('2026-09-02')).toBe(
      'analyse-eau-2026-09-02.pdf'
    )
  })
})

describe('isSampledOnInFuture — le jour courant est un argument', () => {
  const today = '2026-09-02'

  it('refuse une date future', () => {
    expect(isSampledOnInFuture('2026-09-03', today)).toBe(true)
    expect(isSampledOnInFuture('2027-01-01', today)).toBe(true)
  })

  it('accepte la date du jour', () => {
    expect(isSampledOnInFuture('2026-09-02', today)).toBe(false)
  })

  it('accepte une date passée', () => {
    expect(isSampledOnInFuture('2026-08-31', today)).toBe(false)
    expect(isSampledOnInFuture('2025-12-31', today)).toBe(false)
  })
})

describe('isWaterAnalysisFileKeyAllowed', () => {
  const key = `${ORG_ID}/water-analysis/${ANALYSIS_ID}/report-abc.pdf`

  it('accepte une clé de cette analyse', () => {
    expect(isWaterAnalysisFileKeyAllowed(ORG_ID, ANALYSIS_ID, key)).toBe(true)
  })

  it("refuse la clé d'une autre analyse", () => {
    expect(isWaterAnalysisFileKeyAllowed(ORG_ID, OTHER_ANALYSIS_ID, key)).toBe(
      false
    )
  })

  it("refuse la clé d'une autre association", () => {
    expect(isWaterAnalysisFileKeyAllowed(OTHER_ORG_ID, ANALYSIS_ID, key)).toBe(
      false
    )
  })

  it("refuse une clé d'une autre portée", () => {
    expect(
      isWaterAnalysisFileKeyAllowed(
        ORG_ID,
        ANALYSIS_ID,
        `${ORG_ID}/news/${ANALYSIS_ID}/image-abc.png`
      )
    ).toBe(false)
  })
})

describe('pagination', () => {
  it('10 analyses par page au public, 25 au bureau', () => {
    expect(WATER_ANALYSIS_PUBLIC_PAGE_SIZE).toBe(10)
    expect(WATER_ANALYSIS_BUREAU_PAGE_SIZE).toBe(25)
  })

  it('une liste vide a quand même sa page 1', () => {
    expect(countWaterAnalysisPages(0, 10)).toBe(1)
  })

  it('compte les pages pleines et la page entamée', () => {
    expect(countWaterAnalysisPages(10, 10)).toBe(1)
    expect(countWaterAnalysisPages(11, 10)).toBe(2)
  })
})

describe('calendarDayOf — le jour calendaire de Paris', () => {
  it("rend la date ISO du jour a Paris, pas celle d'UTC", () => {
    expect(calendarDayOf(new Date('2026-09-01T23:30:00Z'))).toBe('2026-09-02')
    expect(calendarDayOf(new Date('2026-09-02T12:00:00Z'))).toBe('2026-09-02')
  })
})
