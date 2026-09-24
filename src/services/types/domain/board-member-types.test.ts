import {describe, expect, it} from 'vitest'

import {
  ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from './association-settings-types'
import {
  buildPortraitAlt,
  getPersonInitials,
  PORTRAIT_RENDERED_SIZE,
  PORTRAIT_STORED_SIZE,
} from './board-member-types'
import {
  buildContentFileKey,
  ContentFileScopeConst,
  isContentFileKeyAllowed,
} from './content-file-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const MEMBER_ID = '33333333-3333-4333-8333-333333333333'

describe('getPersonInitials — repli de photo (design system §3.9)', () => {
  it('prend la première lettre du prénom et celle du nom', () => {
    expect(getPersonInitials('Jean-Pierre Vasseur')).toBe('JV')
    expect(getPersonInitials('Claire Besson')).toBe('CB')
  })

  it("d'un nom en un seul mot, prend ses deux premières lettres", () => {
    expect(getPersonInitials('Besson')).toBe('BE')
  })

  it('conserve les accents', () => {
    expect(getPersonInitials('Élise Ångström')).toBe('ÉÅ')
    expect(getPersonInitials('Élise')).toBe('ÉL')
  })

  it('tolère les espaces multiples et les bords', () => {
    expect(getPersonInitials('   Claire    Besson  ')).toBe('CB')
  })

  it("d'un nom vide, ne rend rien plutôt qu'un carré fautif", () => {
    expect(getPersonInitials('   ')).toBe('')
  })
})

describe('buildPortraitAlt — texte alternatif déduit du nom', () => {
  it('nomme la personne, jamais un texte générique', () => {
    expect(buildPortraitAlt('Claire Besson')).toBe('Portrait de Claire Besson')
  })
})

describe('taille de stockage du portrait (ADR 024)', () => {
  it('couvre le plus grand rendu public jusqu’à 4× de densité', () => {
    expect(PORTRAIT_STORED_SIZE).toBe(PORTRAIT_RENDERED_SIZE * 4)
  })
})

describe('portée de fichier « board » (ADR 023)', () => {
  it('construit une clé de photo acceptée par la chaîne partagée', () => {
    const key = buildContentFileKey(
      ORG_ID,
      ContentFileScopeConst.BOARD,
      MEMBER_ID,
      'photo',
      'webp'
    )

    expect(key).toMatch(
      new RegExp(`^${ORG_ID}/board/${MEMBER_ID}/photo-[0-9a-f-]{36}\\.webp$`)
    )
    expect(isContentFileKeyAllowed(ORG_ID, key)).toBe(true)
  })

  it("refuse la clé « board » d'une autre association", () => {
    const key = buildContentFileKey(
      ORG_ID,
      ContentFileScopeConst.BOARD,
      MEMBER_ID,
      'photo',
      'webp'
    )

    expect(isContentFileKeyAllowed(OTHER_ORG_ID, key)).toBe(false)
  })
})

describe('paramètre « nombre de membres » (ADR 016)', () => {
  it('non renseigné, se résout en valeur absente — jamais en 0', () => {
    const resolved = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])

    expect(resolved[ASSOCIATION_MEMBER_COUNT_SETTING_KEY]).toEqual({
      value: null,
      storedValue: null,
      defaultFromKey: null,
    })
  })

  it('accepte un entier positif et refuse une valeur décimale', () => {
    const resolved = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: ASSOCIATION_MEMBER_COUNT_SETTING_KEY, value: '412'},
    ])
    const invalid = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: ASSOCIATION_MEMBER_COUNT_SETTING_KEY, value: '41.2'},
    ])

    expect(resolved[ASSOCIATION_MEMBER_COUNT_SETTING_KEY].value).toBe(412)
    expect(invalid[ASSOCIATION_MEMBER_COUNT_SETTING_KEY].value).toBeNull()
  })
})
