import {describe, expect, it} from 'vitest'

import {fitAddressLines} from './letter-address-fit'

/** Une police fictive : chaque caractere fait la moitie du corps, en points. */
const widthOf = (text: string, sizePt: number) => text.length * sizePt * 0.5
/** 255 pt : 42 caracteres a 12 pt, 51 a 10 pt. */
const MAX_WIDTH_PT = 255

const fit = (lines: string[]) => fitAddressLines(lines, widthOf, MAX_WIDTH_PT)

describe('fitAddressLines — chaque ligne tient dans le cadre de 90 mm (M1, §6.1)', () => {
  it('une adresse qui tient reste a 12 pt, telle quelle', () => {
    const lines = ['Marcel Laurent', '4 rue des Lilas', '69003 Lyon']

    expect(fit(lines)).toEqual({fits: true, sizePt: 12, lines})
  })

  it('une ligne trop large : le corps se reduit, par demi-point, jusqu’a ce qu’elle tienne', () => {
    const long = 'x'.repeat(45)

    expect(fit(['Marcel Laurent', long, '69003 Lyon'])).toEqual({
      fits: true,
      sizePt: 11,
      lines: ['Marcel Laurent', long, '69003 Lyon'],
    })
  })

  it('jamais sous 10 pt : au-dela, la ligne est coupee apres une virgule', () => {
    const long = `${'a'.repeat(30)}, ${'b'.repeat(15)}, ${'c'.repeat(10)}`

    expect(fit(['Marcel Laurent', long, '69003 Lyon'])).toEqual({
      fits: true,
      sizePt: 10,
      lines: [
        'Marcel Laurent',
        `${'a'.repeat(30)}, ${'b'.repeat(15)},`,
        'c'.repeat(10),
        '69003 Lyon',
      ],
    })
  })

  it('la coupure ne depasse jamais 4 lignes : sinon, l’adresse ne tient pas', () => {
    const long = `${'a'.repeat(30)}, ${'b'.repeat(30)}`
    const lines = ['Marcel Laurent', 'SARL Laurent', long, '69003 Lyon']

    expect(fit(lines)).toEqual({fits: false, sizePt: 10, lines})
  })

  it('sans virgule ou avec un morceau trop large, l’adresse ne tient pas', () => {
    const noComma = ['Marcel Laurent', 'y'.repeat(60), '69003 Lyon']
    const wideSegment = ['Marcel Laurent', `${'z'.repeat(55)}, Bat. B`]

    expect(fit(noComma)).toEqual({fits: false, sizePt: 10, lines: noComma})
    expect(fit(wideSegment)).toEqual({
      fits: false,
      sizePt: 10,
      lines: wideSegment,
    })
  })
})
