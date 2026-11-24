import {describe, expect, it} from 'vitest'

import {getInvoiceSubjectTemplate} from '@/services/rules/member-invoice-rules'
import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
  getAccentHue,
  getCampaignNature,
  getContactMessagesPerHourLimit,
  getDefaultLandAddress,
  getInvitationLinkDays,
  getMemberEmailConfirmationDays,
  getStatutoryTemplateIds,
  getUnpaidReminderSettings,
  INVITATION_LINK_DAYS_SETTING_KEY,
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

describe('TEST_TENANT_SETTINGS — factures des membres (s19, ADR 059)', () => {
  it('le premier tenant porte l’objet « Cotisation et eau {année} » en valeur de seed', () => {
    expect(getInvoiceSubjectTemplate(settingsOf('techcorp-solutions'))).toBe(
      'Cotisation et eau {année}'
    )
    expect(getInvoiceSubjectTemplate(settingsOf('marketing-pro'))).toBe(
      'Facture {année}'
    )
  })

  it('aucun statut de facture n’est livré dans la configuration des tenants', () => {
    expect(
      TEST_TENANT_SETTINGS.filter((row) =>
        [
          BILLING_UNPAID_STATUSES_SETTING_KEY,
          BILLING_SETTLED_STATUSES_SETTING_KEY,
        ].includes(row.key)
      )
    ).toEqual([])
  })
})

describe('TEST_TENANT_SETTINGS — nature des envois (s27b, ADR 064)', () => {
  it('le premier tenant classe convocation, facture et relance statutaires ; post-AG et message libre facultatifs, en valeurs de seed', () => {
    const settings = settingsOf('techcorp-solutions')

    expect(getStatutoryTemplateIds(settings)).toEqual([
      'reminder',
      'invoice',
      'general_assembly',
      'unpaid_reminder',
      'member_invitation_launch',
      'member_invitation_reminder',
    ])
    expect(getCampaignNature(settings, 'free')).toBe('facultative')
    expect(getCampaignNature(settings, 'post_assembly_documents')).toBe(
      'facultative'
    )
    for (const templateId of [
      'free',
      'reminder',
      'invoice',
      'general_assembly',
      'post_assembly_documents',
    ]) {
      expect(
        TEST_TENANT_SETTINGS.some(
          (row) =>
            row.organizationSlug === 'techcorp-solutions' &&
            row.key === `campaign.nature.${templateId}`
        ),
        templateId
      ).toBe(true)
    }
  })

  it('l’autre tenant ne déclare aucune nature : tout y est facultatif', () => {
    expect(getStatutoryTemplateIds(settingsOf('marketing-pro'))).toEqual([])
  })
})

describe('TEST_TENANT_SETTINGS — relances des impayés (s29, ADR 070 §7)', () => {
  it('le premier tenant active la relance, 3 / 2 / 1 semaines, avec un objet et un texte fictifs, et la relance statutaire', () => {
    const settings = settingsOf('techcorp-solutions')
    const reminder = getUnpaidReminderSettings(settings)

    expect(reminder).toMatchObject({enabled: true, delaysWeeks: [3, 2, 1]})
    expect(reminder.enabled && reminder.subject).toEqual(expect.any(String))
    expect(reminder.enabled && reminder.body).toContain('{factures}')
    expect(getCampaignNature(settings, 'unpaid_reminder')).toBe('statutaire')
  })

  it('l’autre tenant ne déclare rien : relance désactivée', () => {
    expect(getUnpaidReminderSettings(settingsOf('marketing-pro'))).toEqual({
      enabled: false,
      delaysWeeks: null,
    })
  })
})

describe('TEST_TENANT_SETTINGS — lancement des invitations (s42b, ADR 072)', () => {
  it('le premier tenant classe le lancement et sa relance statutaires, en valeurs de seed ; l’autre les laisse facultatifs', () => {
    const settings = settingsOf('techcorp-solutions')
    const other = settingsOf('marketing-pro')
    for (const kind of [
      'member_invitation_launch',
      'member_invitation_reminder',
    ] as const) {
      expect(getCampaignNature(settings, kind), kind).toBe('statutaire')
      expect(
        TEST_TENANT_SETTINGS.some(
          (row) =>
            row.organizationSlug === 'techcorp-solutions' &&
            row.key === `campaign.nature.${kind}`
        ),
        kind
      ).toBe(true)
      expect(getCampaignNature(other, kind), kind).toBe('facultative')
    }
  })
})

describe('TEST_TENANT_SETTINGS — invitation des membres (s42a)', () => {
  it('le premier tenant porte 7 jours de validité du lien d’invitation en valeur de seed', () => {
    const settings = settingsOf('techcorp-solutions')

    expect(settings[INVITATION_LINK_DAYS_SETTING_KEY]).toMatchObject({
      value: 7,
      storedValue: '7',
    })
    expect(getInvitationLinkDays(settings)).toBe(7)
  })
})
