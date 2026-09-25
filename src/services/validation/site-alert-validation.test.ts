import {describe, expect, it} from 'vitest'

import {SITE_ALERT_MAX_LENGTH} from '../types/domain/site-alert-types'
import {saveSiteAlertServiceSchema} from './site-alert-validation'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const parse = (message: string, active: boolean) =>
  saveSiteAlertServiceSchema.safeParse({
    organizationId: ORG_ID,
    message,
    active,
  })

describe('saveSiteAlertServiceSchema — bornes du message', () => {
  it('le plafond est de 280 caracteres', () => {
    expect(SITE_ALERT_MAX_LENGTH).toBe(280)
  })

  it('accepte un message de 280 caracteres exactement', () => {
    expect(parse('a'.repeat(280), true).success).toBe(true)
  })

  it('refuse un message de 281 caracteres', () => {
    const result = parse('a'.repeat(281), true)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['message'])
  })

  it('juge la longueur apres retrait des espaces de bord', () => {
    expect(parse(`  ${'a'.repeat(280)}  `, true).success).toBe(true)
  })
})

describe('saveSiteAlertServiceSchema — message requis pour afficher', () => {
  it('refuse un bandeau affiche avec un message vide', () => {
    const result = parse('', true)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['message'])
  })

  it('refuse un bandeau affiche avec un message fait d espaces', () => {
    expect(parse('   \n ', true).success).toBe(false)
  })

  it('accepte un message vide quand le bandeau est masque', () => {
    const result = parse('', false)

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      organizationId: ORG_ID,
      message: '',
      active: false,
    })
  })
})

describe('saveSiteAlertServiceSchema — message conserve tel quel', () => {
  it('garde les espaces internes et les retours a la ligne', () => {
    const message = 'Coupure  d’eau\nrue des Pins, 8 h – 12 h'

    const result = parse(message, true)

    expect(result.data?.message).toBe(message)
  })

  it('refuse un identifiant d association invalide', () => {
    expect(
      saveSiteAlertServiceSchema.safeParse({
        organizationId: 'pas-un-uuid',
        message: 'Coupure',
        active: true,
      }).success
    ).toBe(false)
  })

  it('refuse un etat qui n est pas un booleen', () => {
    expect(
      saveSiteAlertServiceSchema.safeParse({
        organizationId: ORG_ID,
        message: 'Coupure',
        active: 'true',
      }).success
    ).toBe(false)
  })
})
