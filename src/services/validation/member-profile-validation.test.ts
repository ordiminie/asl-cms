import {describe, expect, it} from 'vitest'

import {updateMyContactServiceSchema} from './member-profile-validation'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const VALID_CONTACT = {
  phone: '06 12 34 56 78',
  addressLine: '4 chemin des Oliviers',
  addressComplement: 'Bâtiment B',
  postalCode: '13100',
  city: 'Aix-en-Provence',
}

const parse = (input: Record<string, unknown>) =>
  updateMyContactServiceSchema.safeParse({organizationId: ORG_ID, ...input})

describe('updateMyContactServiceSchema — coordonnées du membre (s16)', () => {
  it('accepte des coordonnées valides', () => {
    const result = parse(VALID_CONTACT)

    expect(result.success).toBe(true)
    expect(result.data).toEqual({organizationId: ORG_ID, ...VALID_CONTACT})
  })

  it('rend `null` pour un champ vide ou fait d’espaces', () => {
    const result = parse({
      phone: '',
      addressLine: '   ',
      addressComplement: undefined,
      postalCode: ' ',
      city: '',
    })

    expect(result.data).toEqual({
      organizationId: ORG_ID,
      phone: null,
      addressLine: null,
      addressComplement: null,
      postalCode: null,
      city: null,
    })
  })

  it('refuse un code postal à 4 chiffres', () => {
    const result = parse({...VALID_CONTACT, postalCode: '1310'})

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['postalCode'])
  })

  it('refuse un téléphone qui contient des lettres', () => {
    const result = parse({...VALID_CONTACT, phone: '06 12 AB 56 78'})

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['phone'])
  })

  it('retire `email` et `memberProfileId` de la sortie', () => {
    const result = parse({
      ...VALID_CONTACT,
      email: 'autre@exemple.fr',
      memberProfileId: '22222222-2222-4222-8222-222222222222',
    })

    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('email')
    expect(result.data).not.toHaveProperty('memberProfileId')
  })
})
