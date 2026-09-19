import {describe, expect, it} from 'vitest'

import {
  ACCENT_HUES,
  DEFAULT_ACCENT_HUE,
} from '@/services/types/domain/association-settings-types'

import {EMAIL_COLORS, getEmailAccent} from './theme'

const HEX = /^#[0-9A-F]{6}$/

describe('thème de l’email (design system §5.3)', () => {
  it('ne porte que des couleurs hexadécimales', () => {
    const colors = [
      ...Object.values(EMAIL_COLORS),
      ...ACCENT_HUES.flatMap(({hue}) => Object.values(getEmailAccent(hue))),
    ]
    expect(colors.every((color) => HEX.test(color))).toBe(true)
  })

  it('reprend les jumelles de §5.3', () => {
    expect(EMAIL_COLORS).toMatchObject({
      background: '#FFFFFF',
      foreground: '#1B1E26',
      muted: '#F6F7F8',
      mutedForeground: '#52565E',
      border: '#DFE1E5',
      primary: '#2C3F63',
      link: '#2B57A8',
    })
  })

  it('donne le triplet de chacune des six teintes de §1.2', () => {
    expect(getEmailAccent(195)).toEqual({
      solid: '#17849B',
      surface: '#E8F5F8',
      foreground: '#185A66',
    })
    expect(getEmailAccent(150)).toEqual({
      solid: '#2E7D52',
      surface: '#E7F5EC',
      foreground: '#1E4A31',
    })
    expect(getEmailAccent(255)).toEqual({
      solid: '#3A6FB0',
      surface: '#EAF1FA',
      foreground: '#23445F',
    })
    expect(getEmailAccent(40)).toEqual({
      solid: '#A8623A',
      surface: '#F8EDE6',
      foreground: '#5E3421',
    })
    expect(getEmailAccent(300)).toEqual({
      solid: '#7A5AA8',
      surface: '#F1ECF9',
      foreground: '#3F2E5C',
    })
    expect(getEmailAccent(95)).toEqual({
      solid: '#7C7326',
      surface: '#F4F2E2',
      foreground: '#423D14',
    })
  })

  it('retombe sur la teinte par défaut pour une valeur inconnue', () => {
    expect(getEmailAccent(12 as never)).toEqual(
      getEmailAccent(DEFAULT_ACCENT_HUE)
    )
  })
})
