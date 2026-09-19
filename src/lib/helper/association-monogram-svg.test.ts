import {describe, expect, it} from 'vitest'

import {renderAssociationMonogramSvg} from './association-monogram-svg'

describe('renderAssociationMonogramSvg — teinte de l association', () => {
  it('peint l aplat accent-solid de la teinte donnee', () => {
    const svg = renderAssociationMonogramSvg('ASL Les Pins', 40)

    expect(svg).toContain('fill="oklch(0.55 0.1 40)"')
    expect(svg).toContain('>LP</text>')
  })

  it('deux teintes, deux aplats distincts', () => {
    expect(renderAssociationMonogramSvg('ASL Les Pins', 195)).toContain(
      'fill="oklch(0.55 0.1 195)"'
    )
    expect(renderAssociationMonogramSvg('ASL Les Pins', 300)).toContain(
      'fill="oklch(0.55 0.1 300)"'
    )
  })

  it('ne porte plus aucune couleur hexadecimale de teinte', () => {
    expect(renderAssociationMonogramSvg('ASL Les Pins', 195)).not.toContain(
      '#17849B'
    )
  })
})
