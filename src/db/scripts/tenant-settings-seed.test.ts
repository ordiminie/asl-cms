import {describe, expect, it} from 'vitest'

import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  CONTACT_EMAIL_SETTING_KEY,
  getAccentHue,
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
})
