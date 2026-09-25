import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

const css = readFileSync(
  path.resolve(import.meta.dirname, 'globals.css'),
  'utf8'
)

const valuesOf = (token: string) =>
  [...css.matchAll(new RegExp(`\\s${token}:\\s*([^;]+);`, 'g'))].map((match) =>
    match[1].trim()
  )

describe('tokens de s08 (design system §1.9)', () => {
  it('déclare --destructive-text en clair puis en sombre', () => {
    expect(valuesOf('--destructive-text')).toEqual([
      'oklch(0.48 0.17 27)',
      'oklch(0.68 0.17 27)',
    ])
  })

  it('ne garde plus l’ancien nom du token (suffixe -ink)', () => {
    expect(css).not.toContain(['destructive', 'ink'].join('-'))
  })

  it('déclare --table-stripe en clair puis en sombre', () => {
    expect(valuesOf('--table-stripe')).toEqual([
      'oklch(0.99 0.002 250)',
      'oklch(0.235 0.009 255)',
    ])
  })

  it('déclare --table-row-hover en clair puis en sombre', () => {
    expect(valuesOf('--table-row-hover')).toEqual([
      'var(--muted)',
      'oklch(0.29 0.012 250)',
    ])
  })

  it('expose les trois tokens comme couleurs Tailwind', () => {
    expect(css).toContain('--color-destructive-text: var(--destructive-text);')
    expect(css).toContain('--color-table-stripe: var(--table-stripe);')
    expect(css).toContain('--color-table-row-hover: var(--table-row-hover);')
  })
})
