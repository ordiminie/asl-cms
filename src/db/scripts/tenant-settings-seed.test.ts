import {describe, expect, it} from 'vitest'

import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  CONTACT_EMAIL_SETTING_KEY,
  CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
  getAccentHue,
  getContactMessagesPerHourLimit,
  getDefaultLandAddress,
  getMemberEmailConfirmationDays,
  MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
  resolveSettings,
  validateSettingsChanges,
} from '@/services/types/domain/association-settings-types'

import {TEST_TENANT_SETTINGS} from './tenant-settings-seed'

const settingsOf = (slug: string) =>
  resolveSettings(
    ASSOCIATION_SETTINGS_REGISTRY,
    TEST_TENANT_SETTINGS.filter((row) => row.organizationSlug === slug)
  )

describe('TEST_TENANT_SETTINGS — jeu de parametres des tenants de test', () => {
  it('ne declare que des cles du registre, a des valeurs valides', () => {
    for (const slug of ['techcorp-solutions', 'marketing-pro']) {
      const rows = TEST_TENANT_SETTINGS.filter(
        (row) => row.organizationSlug === slug
      )
      expect(
        validateSettingsChanges(
          ASSOCIATION_SETTINGS_REGISTRY,
          Object.fromEntries(rows.map(({key, value}) => [key, value]))
        ),
        slug
      ).toMatchObject({valid: true, deletions: []})
    }
  })

  it('chaque tenant de test a son adresse de contact, fictive et propre', () => {
    const a = settingsOf('techcorp-solutions')[CONTACT_EMAIL_SETTING_KEY].value
    const b = settingsOf('marketing-pro')[CONTACT_EMAIL_SETTING_KEY].value

    expect(a).toMatch(/@[a-z0-9-]+\.test$/)
    expect(b).toMatch(/@[a-z0-9-]+\.test$/)
    expect(a).not.toBe(b)
  })

  it('les deux domaines servent deux teintes distinctes, dont la teinte par defaut', () => {
    const a = getAccentHue(settingsOf('techcorp-solutions'))
    const b = getAccentHue(settingsOf('marketing-pro'))

    expect(a).not.toBe(b)
    expect(b).toBe(195)
    expect(
      TEST_TENANT_SETTINGS.some(
        (row) =>
          row.organizationSlug === 'marketing-pro' &&
          row.key === ACCENT_HUE_SETTING_KEY
      )
    ).toBe(false)
  })

  it('le seuil des formulaires publics est connu des tenants de test, au defaut du registre', () => {
    for (const slug of ['techcorp-solutions', 'marketing-pro']) {
      const settings = settingsOf(slug)
      expect(settings[CONTACT_MESSAGES_PER_HOUR_SETTING_KEY], slug).toEqual({
        value: 3,
        storedValue: null,
        defaultFromKey: null,
      })
      expect(getContactMessagesPerHourLimit(settings), slug).toBe(3)
    }
  })
})

describe('TEST_TENANT_SETTINGS — délai de confirmation d’une adresse (s54, ADR 056 §5, revue m1)', () => {
  it('le premier tenant porte 7 jours en valeur de seed, pas seulement par le défaut du registre', () => {
    const settings = settingsOf('techcorp-solutions')

    expect(settings[MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY]).toMatchObject({
      value: 7,
      storedValue: '7',
    })
    expect(getMemberEmailConfirmationDays(settings)).toBe(7)
  })
})

describe('TEST_TENANT_SETTINGS — terrain par défaut (s55, ADR 058)', () => {
  it('le premier tenant porte un code postal et une commune fictifs, l’autre aucun', () => {
    expect(getDefaultLandAddress(settingsOf('techcorp-solutions'))).toEqual({
      postalCode: expect.stringMatching(/^\d{5}$/),
      city: expect.any(String),
    })
    expect(getDefaultLandAddress(settingsOf('marketing-pro'))).toEqual({
      postalCode: null,
      city: null,
    })
  })
})
