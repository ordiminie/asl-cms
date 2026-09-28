import {describe, expect, it} from 'vitest'

import {formatContentDate} from './format-content-date'

describe('formatContentDate', () => {
  it('écrit une date ISO en clair, en français', () => {
    expect(formatContentDate('2026-09-02')).toBe('2 septembre 2026')
  })

  it('ne glisse pas d’un jour selon le fuseau', () => {
    expect(formatContentDate('2026-01-01')).toBe('1 janvier 2026')
    expect(formatContentDate('2026-12-31')).toBe('31 décembre 2026')
  })
})
