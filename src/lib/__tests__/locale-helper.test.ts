import {describe, expect, it} from 'vitest'

import {resolveSupportedLocale} from '@/lib/helper/locale-helper'

describe('resolveSupportedLocale', () => {
  it('garde une locale servie par le routage', () => {
    expect(resolveSupportedLocale('fr')).toBe('fr')
  })

  it('ne sert plus les anciennes locales en et es (ADR 008, s43)', () => {
    expect(resolveSupportedLocale('en')).toBe('fr')
    expect(resolveSupportedLocale('es')).toBe('fr')
  })

  it('retombe sur fr (ADR 008) pour une locale absente ou non servie', () => {
    expect(resolveSupportedLocale(undefined)).toBe('fr')
    expect(resolveSupportedLocale(null)).toBe('fr')
    expect(resolveSupportedLocale('')).toBe('fr')
    expect(resolveSupportedLocale('de')).toBe('fr')
    expect(resolveSupportedLocale('../fr')).toBe('fr')
    expect(resolveSupportedLocale(['fr'])).toBe('fr')
  })
})
