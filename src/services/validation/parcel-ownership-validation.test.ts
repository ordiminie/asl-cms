import {describe, expect, it} from 'vitest'

import {PARCEL_NUMBER_MAX_LENGTH} from '../types/domain/parcel-ownership-types'
import {
  attachParcelServiceSchema,
  parcelNumberSchema,
} from './parcel-ownership-validation'

describe('parcelNumberSchema — numéro normalisé en majuscules', () => {
  it.each([
    ['a12', 'A12'],
    ['A12', 'A12'],
    ['  b 7 bis ', 'B 7 BIS'],
    ['47', '47'],
  ])('« %s » → « %s »', (input, expected) => {
    expect(parcelNumberSchema.parse(input)).toBe(expected)
  })

  it('refuse un numéro vide ou fait d’espaces', () => {
    expect(parcelNumberSchema.safeParse('').success).toBe(false)
    expect(parcelNumberSchema.safeParse('   ').success).toBe(false)
  })

  it('mesure la longueur après le retrait des espaces', () => {
    const longest = 'a'.repeat(PARCEL_NUMBER_MAX_LENGTH)

    expect(parcelNumberSchema.parse(` ${longest} `)).toBe(longest.toUpperCase())
    expect(parcelNumberSchema.safeParse(`${longest}a`).success).toBe(false)
  })

  it('normalise le numéro de tout rattachement qui passe par le service', () => {
    const parsed = attachParcelServiceSchema.parse({
      organizationId: '11111111-1111-4111-8111-111111111111',
      memberProfileId: '33333333-3333-4333-8333-333333333333',
      parcelNumber: ' a12 ',
      startsOn: '1998-02-03',
    })

    expect(parsed.parcelNumber).toBe('A12')
  })
})
