import {fr} from 'date-fns/locale'
import {describe, expect, it} from 'vitest'

import {
  formatDate,
  formatDistanceToNowLocalized,
  getDateFnsLocale,
} from './date-helper'

/** Locale unique, le français (ADR 008) : sans locale fournie, les dates sont en français. */
describe('date-helper — français par défaut (s46, critère 5)', () => {
  it('formatDate sans locale écrit le mois en français', () => {
    expect(formatDate(new Date(2026, 9, 13))).toBe('13 octobre 2026')
  })

  it('formatDistanceToNowLocalized sans locale écrit « il y a »', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    expect(formatDistanceToNowLocalized(twoDaysAgo)).toBe('il y a 2 jours')
  })

  it('une locale inconnue retombe sur le français', () => {
    expect(getDateFnsLocale()).toBe(fr)
    expect(getDateFnsLocale('de')).toBe(fr)
  })
})
