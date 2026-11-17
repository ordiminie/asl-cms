import {describe, expect, it} from 'vitest'

import {MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH} from '../types/domain/member-profile-types'
import {
  createMemberProfileServiceSchema,
  updateMemberProfileContactServiceSchema,
  updateMyContactServiceSchema,
} from './member-profile-validation'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const VALID_CONTACT = {
  phone: '06 12 34 56 78',
  homeAddressLine: '4 chemin des Oliviers',
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: '13100',
  homeCity: 'Aix-en-Provence',
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
      homeAddressLine: '   ',
      homeAddressComplement: undefined,
      homePostalCode: ' ',
      homeCity: '',
    })

    expect(result.data).toEqual({
      organizationId: ORG_ID,
      phone: null,
      homeAddressLine: null,
      homeAddressComplement: null,
      homePostalCode: null,
      homeCity: null,
    })
  })

  it('refuse un code postal à 4 chiffres', () => {
    const result = parse({...VALID_CONTACT, homePostalCode: '1310'})

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['homePostalCode'])
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

  it('retire le terrain et le nom de l’entreprise : le membre ne les corrige pas (s55, critère 5)', () => {
    const result = parse({
      ...VALID_CONTACT,
      landAddressLine: '3 allée des Mimosas',
      landPostalCode: '40600',
      landCity: 'Biscarrosse',
      companyName: 'Épicerie fictive',
    })

    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('landAddressLine')
    expect(result.data).not.toHaveProperty('landPostalCode')
    expect(result.data).not.toHaveProperty('landCity')
    expect(result.data).not.toHaveProperty('companyName')
  })
})

describe('updateMemberProfileContactServiceSchema — coordonnées saisies par le bureau (s55)', () => {
  const parseBoard = (input: Record<string, unknown>) =>
    updateMemberProfileContactServiceSchema.safeParse({
      organizationId: ORG_ID,
      memberProfileId: '22222222-2222-4222-8222-222222222222',
      ...input,
    })

  it('accepte domicile, terrain et nom de l’entreprise', () => {
    const result = parseBoard({
      ...VALID_CONTACT,
      landAddressLine: '3 allée des Mimosas',
      landAddressComplement: '',
      landPostalCode: '40600',
      landCity: 'Biscarrosse',
      companyName: ' Épicerie fictive ',
    })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      homePostalCode: '13100',
      landAddressLine: '3 allée des Mimosas',
      landAddressComplement: null,
      landPostalCode: '40600',
      landCity: 'Biscarrosse',
      companyName: 'Épicerie fictive',
    })
  })

  it('refuse un code postal du terrain qui ne compte pas cinq chiffres', () => {
    const result = parseBoard({...VALID_CONTACT, landPostalCode: '4060'})

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['landPostalCode'])
  })

  it('refuse un nom d’entreprise trop long', () => {
    const result = parseBoard({
      ...VALID_CONTACT,
      companyName: 'x'.repeat(MEMBER_PROFILE_COMPANY_NAME_MAX_LENGTH + 1),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['companyName'])
  })
})

describe('createMemberProfileServiceSchema — identifiant Pennylane (s13)', () => {
  const parseCreate = (input: Record<string, unknown>) =>
    createMemberProfileServiceSchema.safeParse({
      organizationId: ORG_ID,
      name: 'Lucie Fictive',
      ...input,
    })

  it('rend `null` quand le champ est absent', () => {
    expect(parseCreate({}).data?.pennylaneCustomerId).toBeNull()
  })

  it('rend `null` quand le champ est vide ou fait d’espaces', () => {
    expect(
      parseCreate({pennylaneCustomerId: '  '}).data?.pennylaneCustomerId
    ).toBeNull()
  })

  it('garde l’identifiant renseigné, sans espaces autour', () => {
    expect(
      parseCreate({pennylaneCustomerId: ' client-fictif-001 '}).data
        ?.pennylaneCustomerId
    ).toBe('client-fictif-001')
  })
})
