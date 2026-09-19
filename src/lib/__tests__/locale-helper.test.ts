import {describe, expect, it} from 'vitest'

import {
  resolveSupportedLocale,
  stripLocalePrefix,
} from '@/lib/helper/locale-helper'

describe('stripLocalePrefix', () => {
  it('retire le préfixe de locale déjà présent dans le chemin', () => {
    expect(stripLocalePrefix('/fr/dashboard', 'fr')).toBe('/dashboard')
  })

  it('retire le préfixe sur un chemin profond', () => {
    expect(stripLocalePrefix('/en/account/settings', 'en')).toBe(
      '/account/settings'
    )
  })

  it('laisse intact un chemin non préfixé', () => {
    expect(stripLocalePrefix('/dashboard', 'fr')).toBe('/dashboard')
  })

  it('laisse intact un chemin préfixé par une autre locale', () => {
    expect(stripLocalePrefix('/en/dashboard', 'fr')).toBe('/en/dashboard')
  })

  it('retourne la racine pour un chemin réduit à la locale', () => {
    expect(stripLocalePrefix('/fr', 'fr')).toBe('/')
  })

  it('retourne la racine pour un chemin locale avec slash final', () => {
    expect(stripLocalePrefix('/fr/', 'fr')).toBe('/')
  })

  it('ne touche pas un segment qui commence par la locale', () => {
    expect(stripLocalePrefix('/french-page', 'fr')).toBe('/french-page')
  })

  it('laisse intact la racine', () => {
    expect(stripLocalePrefix('/', 'fr')).toBe('/')
  })

  it('laisse intact le chemin quand la locale est vide', () => {
    expect(stripLocalePrefix('/fr/dashboard', '')).toBe('/fr/dashboard')
  })

  it('laisse intact la racine quand la locale est vide', () => {
    expect(stripLocalePrefix('/', '')).toBe('/')
  })
})

describe('resolveSupportedLocale', () => {
  it('garde une locale servie par le routage', () => {
    expect(resolveSupportedLocale('fr')).toBe('fr')
    expect(resolveSupportedLocale('en')).toBe('en')
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
