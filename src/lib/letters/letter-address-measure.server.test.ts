import {describe, expect, it, vi} from 'vitest'

import {letterAddressFitsWindow} from './letter-address-measure.server'

vi.mock('server-only', () => ({}))

describe('letterAddressFitsWindow — mesure sur la police embarquée (M1)', () => {
  it('une adresse ordinaire, ou coupable après une virgule, tient', () => {
    expect(
      letterAddressFitsWindow([
        'Marcel Laurent',
        '4 rue des Lilas',
        '69003 Lyon',
      ])
    ).toBe(true)
    expect(
      letterAddressFitsWindow([
        'Marcel Laurent',
        'Lotissement Les Hauts de la Fourche, Bâtiment B, Esc. 3',
        '07140 Les Vans',
      ])
    ).toBe(true)
  })

  it('une ligne sans virgule plus large que le cadre à 10 pt ne tient pas', () => {
    expect(
      letterAddressFitsWindow([
        'Société civile immobilière des propriétaires du domaine de la Fourche',
        '07140 Les Vans',
      ])
    ).toBe(false)
  })
})
