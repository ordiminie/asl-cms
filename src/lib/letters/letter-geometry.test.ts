import {describe, expect, it} from 'vitest'

import {
  A4_MM,
  ADDRESS_FRAME_MM,
  addressFrameOf,
  DL_WINDOW_MM,
  FOLD_LINES_MM,
  mmToPt,
} from './letter-geometry'

/**
 * Le gabarit §6.1 du design system (ADR 067 §3) : une norme d'enveloppe,
 * donc des constantes de code, et un decalage qui ne deplace que le cadre de
 * l'adresse.
 */
describe('géométrie de la lettre (§6.1, ADR 067)', () => {
  it('A4 portrait, fenêtre DL gauche x 20 · y 45 · 100 × 35 mm', () => {
    expect(A4_MM).toEqual({width: 210, height: 297})
    expect(DL_WINDOW_MM).toEqual({x: 20, y: 45, width: 100, height: 35})
  })

  it('le cadre de l’adresse garde 5 mm dans la fenêtre, sur les quatre côtés', () => {
    expect(ADDRESS_FRAME_MM).toEqual({x: 25, y: 50, width: 90, height: 25})
    expect(ADDRESS_FRAME_MM.x - DL_WINDOW_MM.x).toBe(5)
    expect(ADDRESS_FRAME_MM.y - DL_WINDOW_MM.y).toBe(5)
    expect(
      DL_WINDOW_MM.x +
        DL_WINDOW_MM.width -
        (ADDRESS_FRAME_MM.x + ADDRESS_FRAME_MM.width)
    ).toBe(5)
    expect(
      DL_WINDOW_MM.y +
        DL_WINDOW_MM.height -
        (ADDRESS_FRAME_MM.y + ADDRESS_FRAME_MM.height)
    ).toBe(5)
  })

  it('deux plis en trois parts égales', () => {
    expect(FOLD_LINES_MM).toEqual([99, 198])
  })

  it('le décalage déplace le seul cadre de l’adresse', () => {
    expect(addressFrameOf({xMm: 3, yMm: -2})).toEqual({
      x: 28,
      y: 48,
      width: 90,
      height: 25,
    })
    expect(addressFrameOf({xMm: 0, yMm: 0})).toEqual(ADDRESS_FRAME_MM)
    expect(DL_WINDOW_MM).toEqual({x: 20, y: 45, width: 100, height: 35})
  })

  it('convertit les millimètres en points PDF', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72)
    expect(mmToPt(A4_MM.width)).toBeCloseTo(595.28, 1)
  })
})
