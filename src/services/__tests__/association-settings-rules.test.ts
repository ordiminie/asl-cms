import {describe, expect, it} from 'vitest'

import fr from '../../../messages/fr.json'
import {
  ACCENT_HUE_SETTING_KEY,
  ACCENT_HUES,
  ASSOCIATION_DESCRIPTION_SETTING_KEY,
  ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
  ASSOCIATION_LEGAL_NAME_SETTING_KEY,
  ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
  ASSOCIATION_SETTING_ERROR_CODES,
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingDefinition,
  AssociationSettingsRegistry,
  BILLING_ALERT_EMAIL_SETTING_KEY,
  BILLING_INVOICE_SUBJECT_SETTING_KEY,
  BILLING_PROVIDER_SETTING_KEY,
  BILLING_REMINDER_BODY_SETTING_KEY,
  BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS,
  BILLING_REMINDER_ENABLED_SETTING_KEY,
  BILLING_REMINDER_SUBJECT_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_STATUS_LABELS_SETTING_KEY,
  BILLING_STATUS_LIST_MAX_LENGTH,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
  CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
  campaignNatureSettingKeyOf,
  CONTACT_EMAIL_SETTING_KEY,
  CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
  DEFAULT_ACCENT_HUE,
  EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
  EMAIL_LOGIN_RESERVE_SETTING_KEY,
  extractGoogleVerificationCode,
  FORAGE_EMAIL_SETTING_KEY,
  getAccentHue,
  getAssociationDescription,
  getCampaignDailySendCap,
  getCampaignNature,
  getCampaignSendMaxAttempts,
  getContactMessagesPerHourLimit,
  getDefaultLandAddress,
  getEmailDailySendLimit,
  getEmailLoginReserve,
  getGoogleVerificationCode,
  getInvitationLetterText,
  getInvitationLinkDays,
  getInvitationText,
  getLetterAddressOffset,
  getMagicLinkDailyRequestLimit,
  getMemberAccessAfterSaleMonths,
  getMemberEmailConfirmationDays,
  getSettingsForPage,
  getStatutoryTemplateIds,
  getUnpaidReminderSettings,
  GOOGLE_VERIFICATION_SETTING_KEY,
  hasSettingReferenceCycle,
  INVITATION_LETTER_TEXT_SETTING_KEY,
  INVITATION_LINK_DAYS_SETTING_KEY,
  INVITATION_TEXT_SETTING_KEY,
  isSuperAdminOnlySetting,
  LETTER_ADDRESS_OFFSET_X_SETTING_KEY,
  LETTER_ADDRESS_OFFSET_Y_SETTING_KEY,
  MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
  MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY,
  MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
  MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
  MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
  parseSettingValue,
  resolveSettings,
  validateSettingsChanges,
} from '../types/domain/association-settings-types'
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_SEND_KINDS,
  CAMPAIGN_SUBJECT_MAX_TOTAL,
  CAMPAIGN_TEMPLATE_IDS,
  isMemberInvitationKind,
  MEMBER_INVITATION_LAUNCH_SEND_KIND,
  MEMBER_INVITATION_REMINDER_SEND_KIND,
} from '../types/domain/campaign-types'
import {TEST_SETTINGS_REGISTRY} from './association-settings-test-registry'

const definitionOf = (
  registry: AssociationSettingsRegistry,
  key: string
): AssociationSettingDefinition => {
  const definition = registry.find((candidate) => candidate.key === key)
  if (!definition) throw new Error(`cle absente du registre : ${key}`)
  return definition
}

const testDefinition = (key: string) =>
  definitionOf(TEST_SETTINGS_REGISTRY, key)

describe('registre de production', () => {
  it('declare les cles de s02, s03, s06, s08b, s11, s19, s25, s26 et s54, avec leurs types et leur page', () => {
    expect(
      ASSOCIATION_SETTINGS_REGISTRY.map(({key, type, required, page}) => ({
        key,
        type,
        required,
        page,
      }))
    ).toEqual([
      {
        key: CONTACT_EMAIL_SETTING_KEY,
        type: 'email',
        required: true,
        page: 'settings',
      },
      {
        key: FORAGE_EMAIL_SETTING_KEY,
        type: 'email',
        required: false,
        page: 'settings',
      },
      {
        key: ACCENT_HUE_SETTING_KEY,
        type: 'choice',
        required: false,
        page: 'identity',
      },
      {
        key: MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: ASSOCIATION_DESCRIPTION_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: GOOGLE_VERIFICATION_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: ASSOCIATION_LEGAL_NAME_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: EMAIL_LOGIN_RESERVE_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      ...CAMPAIGN_SEND_KINDS.map((templateId) => ({
        key: `campaign.nature.${templateId}`,
        type: 'choice',
        required: false,
        page: 'settings',
      })),
      {
        key: MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_PROVIDER_SETTING_KEY,
        type: 'choice',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_INVOICE_SUBJECT_SETTING_KEY,
        type: 'text',
        required: true,
        page: 'settings',
      },
      {
        key: BILLING_UNPAID_STATUSES_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_SETTLED_STATUSES_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_STATUS_LABELS_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_ALERT_EMAIL_SETTING_KEY,
        type: 'email',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_REMINDER_ENABLED_SETTING_KEY,
        type: 'boolean',
        required: false,
        page: 'settings',
      },
      ...BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS.map((key) => ({
        key,
        type: 'number',
        required: false,
        page: 'settings',
      })),
      {
        key: BILLING_REMINDER_SUBJECT_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: BILLING_REMINDER_BODY_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: LETTER_ADDRESS_OFFSET_X_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: LETTER_ADDRESS_OFFSET_Y_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: INVITATION_TEXT_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: INVITATION_LETTER_TEXT_SETTING_KEY,
        type: 'text',
        required: false,
        page: 'settings',
      },
      {
        key: INVITATION_LINK_DAYS_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
      {
        key: MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY,
        type: 'number',
        required: false,
        page: 'settings',
      },
    ])
  })

  describe('calage du courrier (s28, ADR 067 §4)', () => {
    it.each([
      [LETTER_ADDRESS_OFFSET_X_SETTING_KEY, 'letter.address_offset_x_mm'],
      [LETTER_ADDRESS_OFFSET_Y_SETTING_KEY, 'letter.address_offset_y_mm'],
    ])(
      '%s : un entier de −10 à +10 mm, 0 par défaut, carte « Courrier »',
      (key, expected) => {
        const definition = definitionOf(ASSOCIATION_SETTINGS_REGISTRY, key)

        expect(key).toBe(expected)
        expect(definition).toMatchObject({
          type: 'number',
          required: false,
          integer: true,
          min: -10,
          max: 10,
          default: {value: '0'},
          unitKey: 'units.millimeters',
          section: 'letter',
        })
        expect(parseSettingValue(definition, '-11')).toMatchObject({
          valid: false,
          error: {code: 'belowMin'},
        })
        expect(parseSettingValue(definition, '11')).toMatchObject({
          valid: false,
          error: {code: 'aboveMax'},
        })
        expect(parseSettingValue(definition, '1.5')).toMatchObject({
          valid: false,
        })
        expect(parseSettingValue(definition, '-10')).toMatchObject({
          valid: true,
          value: -10,
        })
        expect(parseSettingValue(definition, '10')).toMatchObject({
          valid: true,
          value: 10,
        })
      }
    )

    it('rend 0 mm par défaut, puis la valeur de l’association', () => {
      expect(
        getLetterAddressOffset(
          resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
        )
      ).toEqual({xMm: 0, yMm: 0})
      expect(
        getLetterAddressOffset(
          resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
            {key: LETTER_ADDRESS_OFFSET_X_SETTING_KEY, value: '-3'},
            {key: LETTER_ADDRESS_OFFSET_Y_SETTING_KEY, value: '4'},
          ])
        )
      ).toEqual({xMm: -3, yMm: 4})
    })

    it('libellés, aides, unité et carte traduits', () => {
      const settings = fr.AssociationSettings as unknown as {
        fields: Record<string, {label: string; help: string}>
        units: Record<string, string>
      }
      expect(settings.fields.letterAddressOffsetX.label).toBeTruthy()
      expect(settings.fields.letterAddressOffsetY.help).toBeTruthy()
      expect(settings.units.millimeters).toBe('mm')
      expect(fr.BureauSettingsPage.cards.letter.title).toBe('Courrier')
    })
  })

  describe('factures des membres (s19, ADR 059)', () => {
    const definition = (key: string) =>
      definitionOf(ASSOCIATION_SETTINGS_REGISTRY, key)

    it('porte les cinq clés dans la carte « Factures »', () => {
      expect([
        BILLING_PROVIDER_SETTING_KEY,
        BILLING_INVOICE_SUBJECT_SETTING_KEY,
        BILLING_UNPAID_STATUSES_SETTING_KEY,
        BILLING_SETTLED_STATUSES_SETTING_KEY,
        BILLING_ALERT_EMAIL_SETTING_KEY,
      ]).toEqual([
        'billing.provider',
        'billing.invoice_subject',
        'billing.unpaid_statuses',
        'billing.settled_statuses',
        'billing.alert_email',
      ])
      for (const key of [
        BILLING_PROVIDER_SETTING_KEY,
        BILLING_INVOICE_SUBJECT_SETTING_KEY,
        BILLING_UNPAID_STATUSES_SETTING_KEY,
        BILLING_SETTLED_STATUSES_SETTING_KEY,
        BILLING_ALERT_EMAIL_SETTING_KEY,
      ]) {
        expect(definition(key).section, key).toBe('billing')
      }
    })

    it('le fournisseur est « manuel » par défaut, « pennylane » en option (s20), réservé au SuperAdmin', () => {
      const provider = definition(BILLING_PROVIDER_SETTING_KEY)
      expect(provider).toMatchObject({
        type: 'choice',
        default: {value: 'manual'},
      })
      expect(
        provider.type === 'choice' && provider.options.map((o) => o.value)
      ).toEqual(['manual', 'pennylane'])
      expect(
        provider.type === 'choice' &&
          provider.options.find((o) => o.value === 'pennylane')?.labelKey
      ).toBe('billingProviders.pennylane')
      expect(fr.AssociationSettings.billingProviders.pennylane).toBe(
        'Pennylane'
      )
      expect(isSuperAdminOnlySetting(provider)).toBe(true)
      expect(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])[
          BILLING_PROVIDER_SETTING_KEY
        ].value
      ).toBe('manual')
    })

    it('les deux listes de statuts sont des textes multilignes, vides, modifiables par le bureau', () => {
      for (const key of [
        BILLING_UNPAID_STATUSES_SETTING_KEY,
        BILLING_SETTLED_STATUSES_SETTING_KEY,
      ]) {
        expect(definition(key), key).toMatchObject({
          type: 'text',
          multiline: true,
          required: false,
        })
        expect(definition(key).default, key).toBeUndefined()
        expect(isSuperAdminOnlySetting(definition(key)), key).toBe(false)
      }
    })

    it('les libellés des statuts : texte multiligne, vide par défaut, modifiable par le bureau (s20, ADR 062 §5)', () => {
      expect(BILLING_STATUS_LABELS_SETTING_KEY).toBe('billing.status_labels')
      const labels = definition(BILLING_STATUS_LABELS_SETTING_KEY)
      expect(labels).toMatchObject({
        type: 'text',
        multiline: true,
        required: false,
        maxLength: BILLING_STATUS_LIST_MAX_LENGTH,
        section: 'billing',
        labelKey: 'fields.statusLabels.label',
        helpKey: 'fields.statusLabels.help',
      })
      expect(labels.default).toBeUndefined()
      expect(isSuperAdminOnlySetting(labels)).toBe(false)
      const field = (
        fr.AssociationSettings.fields as Record<
          string,
          {label: string; help: string; whenEmpty?: string}
        >
      ).statusLabels
      expect(field.label).toBe('Libellés des statuts')
      expect(field.help).toEqual(expect.any(String))
      expect(field.whenEmpty).toEqual(expect.any(String))
    })

    it('l’objet a un défaut neutre ; le destinataire se replie sur l’adresse de contact', () => {
      expect(definition(BILLING_INVOICE_SUBJECT_SETTING_KEY).default).toEqual({
        value: 'Facture {année}',
      })
      expect(definition(BILLING_ALERT_EMAIL_SETTING_KEY).default).toEqual({
        fromKey: CONTACT_EMAIL_SETTING_KEY,
      })
      const resolved = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
      ])
      expect(resolved[BILLING_ALERT_EMAIL_SETTING_KEY].value).toBe(
        'contact@asl.test'
      )
    })

    it('ont leurs libellés et leurs aides en français', () => {
      const fields = fr.AssociationSettings.fields as Record<
        string,
        {label: string; help: string}
      >
      for (const key of [
        BILLING_PROVIDER_SETTING_KEY,
        BILLING_INVOICE_SUBJECT_SETTING_KEY,
        BILLING_UNPAID_STATUSES_SETTING_KEY,
        BILLING_SETTLED_STATUSES_SETTING_KEY,
        BILLING_ALERT_EMAIL_SETTING_KEY,
      ]) {
        const [, field] = definition(key).labelKey.split('.')
        expect(fields[field]?.label, key).toEqual(expect.any(String))
        expect(fields[field]?.help.length, key).toBeGreaterThan(20)
      }
    })
  })

  describe('terrain par défaut d’une fiche importée (s55, ADR 058)', () => {
    const postalCode = () =>
      definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY
      )
    const city = () =>
      definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        MEMBER_DEFAULT_LAND_CITY_SETTING_KEY
      )

    it('porte deux clés facultatives, sans défaut, modifiables par le bureau', () => {
      expect(MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY).toBe(
        'member.default_land_postal_code'
      )
      expect(MEMBER_DEFAULT_LAND_CITY_SETTING_KEY).toBe(
        'member.default_land_city'
      )
      for (const definition of [postalCode(), city()]) {
        expect(definition.required).toBe(false)
        expect(definition.default).toBeUndefined()
        expect(isSuperAdminOnlySetting(definition)).toBe(false)
      }
      const resolved = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      expect(getDefaultLandAddress(resolved)).toEqual({
        postalCode: null,
        city: null,
      })
    })

    it('accepte une valeur vide : le réglage revient à « non renseigné »', () => {
      expect(
        validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
          [MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY]: '',
          [MEMBER_DEFAULT_LAND_CITY_SETTING_KEY]: '  ',
        })
      ).toEqual({
        valid: true,
        upserts: [],
        deletions: [
          MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
          MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
        ],
      })
    })

    it('refuse un code postal qui ne compte pas cinq chiffres, avec un message propre', () => {
      expect(parseSettingValue(postalCode(), '4060')).toEqual({
        valid: false,
        error: {code: 'invalidCode'},
      })
      expect(parseSettingValue(postalCode(), '40 600')).toMatchObject({
        valid: false,
      })
      expect(parseSettingValue(postalCode(), ' 40600 ')).toEqual({
        valid: true,
        value: '40600',
        normalized: '40600',
      })
      const key = postalCode().errorMessageKeys?.invalidCode
      expect(key).toEqual(expect.any(String))
      const [, field, , code] = (key ?? '').split('.')
      const fields = fr.AssociationSettings.fields as Record<
        string,
        {errors?: Record<string, string>}
      >
      expect(fields[field]?.errors?.[code]).toMatch(/cinq chiffres/)
    })

    it('lit les valeurs du bureau', () => {
      const resolved = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY, value: '40600'},
        {key: MEMBER_DEFAULT_LAND_CITY_SETTING_KEY, value: 'Biscarrosse'},
      ])
      expect(getDefaultLandAddress(resolved)).toEqual({
        postalCode: '40600',
        city: 'Biscarrosse',
      })
    })

    it('ont leurs libellés et leurs aides en français', () => {
      const fields = fr.AssociationSettings.fields as Record<
        string,
        {label: string; help: string}
      >
      for (const definition of [postalCode(), city()]) {
        const [, field] = definition.labelKey.split('.')
        expect(fields[field]?.label, definition.key).toEqual(expect.any(String))
        expect(fields[field]?.help.length, definition.key).toBeGreaterThan(20)
      }
    })
  })

  it('le délai de confirmation d’une adresse ajoutée par le membre est un entier de jours, 7 par défaut, carte « Envois » (s54)', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY
    )
    expect(MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY).toBe(
      'member.email_confirmation_days'
    )
    expect(definition).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      default: {value: '7'},
      unitKey: 'units.days',
      section: 'sending',
    })
    expect(parseSettingValue(definition, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '1.5')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '14')).toMatchObject({valid: true})
    expect(
      getMemberEmailConfirmationDays(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe(7)
  })

  it('le plafond quotidien des campagnes est un entier d’au moins 1, 100 par défaut, carte « Envois » (s26)', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY
    )
    expect(CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY).toBe('campaign.daily_send_cap')
    expect(definition).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      default: {value: '100'},
      unitKey: 'units.sendsPerDay',
      section: 'sending',
    })
    expect(definition.type === 'number' && definition.max).toBeUndefined()
    expect(parseSettingValue(definition, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '2.5')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '500')).toMatchObject({valid: true})
  })

  it('les tentatives d’envoi d’une part sont un entier de 1 à 10, 3 par défaut, carte « Envois » (s26)', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY
    )
    expect(CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY).toBe(
      'campaign.send_max_attempts'
    )
    expect(definition).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      max: 10,
      default: {value: '3'},
      unitKey: 'units.attempts',
      section: 'sending',
    })
    expect(parseSettingValue(definition, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '11')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '10')).toMatchObject({valid: true})
  })

  it('les accesseurs des envois rendent la valeur du bureau, sinon le défaut', () => {
    const defaults = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    expect(getCampaignDailySendCap(defaults)).toBe(100)
    expect(getCampaignSendMaxAttempts(defaults)).toBe(3)

    const custom = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY, value: '500'},
      {key: CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY, value: '5'},
    ])
    expect(getCampaignDailySendCap(custom)).toBe(500)
    expect(getCampaignSendMaxAttempts(custom)).toBe(5)
  })

  it('la carte « Envois » et ses deux champs ont leurs libellés en français', () => {
    const fields = fr.AssociationSettings.fields as Record<
      string,
      {label: string; help: string; errors?: Record<string, string>}
    >
    for (const key of [
      CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
      CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
    ]) {
      const definition = definitionOf(ASSOCIATION_SETTINGS_REGISTRY, key)
      const [, field] = definition.labelKey.split('.')
      expect(fields[field]?.label, key).toEqual(expect.any(String))
      expect(fields[field]?.help.length, key).toBeGreaterThan(20)
      if (definition.type === 'number' && definition.unitKey) {
        const [, unit] = definition.unitKey.split('.')
        expect(
          (fr.AssociationSettings.units as Record<string, string>)[unit],
          key
        ).toEqual(expect.any(String))
      }
    }
    expect(fields.campaignDailySendCap.label).toBe(
      'Plafond quotidien des campagnes'
    )
    expect(fields.campaignDailySendCap.errors?.belowMin).toBe(
      'Saisissez un nombre entier supérieur à 0.'
    )
    expect(
      (
        fr.BureauSettingsPage.cards as Record<
          string,
          {title: string; description?: string}
        >
      ).sending
    ).toMatchObject({title: 'Envois', description: expect.any(String)})
  })

  it('les mentions du pied de page des campagnes sont facultatives, sans défaut, dans la carte « legal » (s25)', () => {
    const legalName = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      ASSOCIATION_LEGAL_NAME_SETTING_KEY
    )
    const mentions = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY
    )

    expect(legalName).toMatchObject({
      type: 'text',
      required: false,
      multiline: false,
      section: 'legal',
    })
    expect(legalName?.default).toBeUndefined()
    expect(mentions).toMatchObject({
      type: 'text',
      required: false,
      multiline: true,
      section: 'legal',
    })
    expect(mentions?.default).toBeUndefined()
  })

  it('le seuil des formulaires publics est un entier de 1 a 20 par heure, 3 par defaut', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      CONTACT_MESSAGES_PER_HOUR_SETTING_KEY
    )
    expect(CONTACT_MESSAGES_PER_HOUR_SETTING_KEY).toBe(
      'contact.messages_per_visitor_per_hour'
    )
    expect(definition).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      max: 20,
      default: {value: '3'},
      unitKey: 'units.messagesPerHour',
    })
    expect(parseSettingValue(definition, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '21')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '1.5')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '1')).toMatchObject({valid: true})
  })

  it('le nombre de membres est un entier positif, sans valeur par defaut', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      ASSOCIATION_MEMBER_COUNT_SETTING_KEY
    )
    expect(ASSOCIATION_MEMBER_COUNT_SETTING_KEY).toBe(
      'association.member_count'
    )
    expect(definition).toMatchObject({type: 'number', integer: true, min: 0})
    expect(definition.default).toBeUndefined()
  })

  it('le seuil de demande de lien est un entier de 1 a 20, 3 par defaut', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY
    )
    expect(MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY).toBe(
      'login.link_requests_per_address_per_day'
    )
    expect(definition).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      max: 20,
      default: {value: '3'},
    })
    expect(parseSettingValue(definition, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '21')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '2.5')).toMatchObject({valid: false})
    expect(parseSettingValue(definition, '20')).toMatchObject({valid: true})
  })

  it('les seuils horaires par adresse et par acces internet ont disparu', () => {
    const keys = ASSOCIATION_SETTINGS_REGISTRY.map(({key}) => key)
    expect(keys).not.toContain('login.link_requests_per_address_per_hour')
    expect(keys).not.toContain('login.link_requests_per_network_per_hour')
  })

  it('chaque cle a son libelle et son aide en francais', () => {
    for (const messages of [fr]) {
      const namespace = messages.AssociationSettings as Record<string, unknown>
      const lookup = (dotted: string) =>
        dotted
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[part]
                : undefined,
            namespace
          )
      for (const definition of ASSOCIATION_SETTINGS_REGISTRY) {
        const keys = [definition.labelKey, definition.helpKey]
        if (definition.type === 'number' && definition.unitKey) {
          keys.push(definition.unitKey)
        }
        for (const key of keys) {
          expect(lookup(key), `${definition.key} ${key}`).toEqual(
            expect.any(String)
          )
        }
      }
    }
  })

  it('l adresse de contact n a aucun defaut : elle est saisie au provisioning', () => {
    expect(
      definitionOf(ASSOCIATION_SETTINGS_REGISTRY, CONTACT_EMAIL_SETTING_KEY)
        .default
    ).toBeUndefined()
  })

  it('l adresse du forage a pour defaut l adresse de contact', () => {
    expect(
      definitionOf(ASSOCIATION_SETTINGS_REGISTRY, FORAGE_EMAIL_SETTING_KEY)
        .default
    ).toEqual({fromKey: CONTACT_EMAIL_SETTING_KEY})
  })

  it('la teinte ne se choisit que parmi les six teintes validees, 195 par defaut', () => {
    const hue = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      ACCENT_HUE_SETTING_KEY
    )
    expect(hue.type).toBe('choice')
    expect(hue.type === 'choice' && hue.options.map((o) => o.value)).toEqual([
      '195',
      '150',
      '255',
      '40',
      '300',
      '95',
    ])
    expect(hue.default).toEqual({value: '195'})
    expect(ACCENT_HUES.map(({hue: value}) => value)).toEqual([
      195, 150, 255, 40, 300, 95,
    ])
    expect(DEFAULT_ACCENT_HUE).toBe(195)
  })

  it('ne porte aucune reference circulaire', () => {
    expect(hasSettingReferenceCycle(ASSOCIATION_SETTINGS_REGISTRY)).toBe(false)
    expect(hasSettingReferenceCycle(TEST_SETTINGS_REGISTRY)).toBe(false)
  })

  it('detecte une reference circulaire', () => {
    const cyclic: AssociationSettingsRegistry = [
      {
        key: 'a',
        type: 'email',
        required: false,
        default: {fromKey: 'b'},
        labelKey: 'a',
        helpKey: 'a',
        page: 'settings',
      },
      {
        key: 'b',
        type: 'email',
        required: false,
        default: {fromKey: 'a'},
        labelKey: 'b',
        helpKey: 'b',
        page: 'settings',
      },
    ]
    expect(hasSettingReferenceCycle(cyclic)).toBe(true)
  })

  it('range chaque cle sur sa page', () => {
    expect(
      getSettingsForPage(ASSOCIATION_SETTINGS_REGISTRY, 'settings').map(
        (definition) => definition.key
      )
    ).toEqual([
      CONTACT_EMAIL_SETTING_KEY,
      FORAGE_EMAIL_SETTING_KEY,
      MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
      ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
      CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
      ASSOCIATION_DESCRIPTION_SETTING_KEY,
      GOOGLE_VERIFICATION_SETTING_KEY,
      ASSOCIATION_LEGAL_NAME_SETTING_KEY,
      ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
      EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
      EMAIL_LOGIN_RESERVE_SETTING_KEY,
      CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
      CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
      MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
      'campaign.nature.free',
      'campaign.nature.reminder',
      'campaign.nature.invoice',
      'campaign.nature.general_assembly',
      'campaign.nature.post_assembly_documents',
      'campaign.nature.unpaid_reminder',
      'campaign.nature.member_invitation_launch',
      'campaign.nature.member_invitation_reminder',
      MEMBER_DEFAULT_LAND_POSTAL_CODE_SETTING_KEY,
      MEMBER_DEFAULT_LAND_CITY_SETTING_KEY,
      BILLING_PROVIDER_SETTING_KEY,
      BILLING_INVOICE_SUBJECT_SETTING_KEY,
      BILLING_UNPAID_STATUSES_SETTING_KEY,
      BILLING_SETTLED_STATUSES_SETTING_KEY,
      BILLING_STATUS_LABELS_SETTING_KEY,
      BILLING_ALERT_EMAIL_SETTING_KEY,
      BILLING_REMINDER_ENABLED_SETTING_KEY,
      ...BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS,
      BILLING_REMINDER_SUBJECT_SETTING_KEY,
      BILLING_REMINDER_BODY_SETTING_KEY,
      LETTER_ADDRESS_OFFSET_X_SETTING_KEY,
      LETTER_ADDRESS_OFFSET_Y_SETTING_KEY,
      INVITATION_TEXT_SETTING_KEY,
      INVITATION_LETTER_TEXT_SETTING_KEY,
      INVITATION_LINK_DAYS_SETTING_KEY,
      MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY,
    ])
    expect(
      getSettingsForPage(ASSOCIATION_SETTINGS_REGISTRY, 'identity').map(
        (definition) => definition.key
      )
    ).toEqual([ACCENT_HUE_SETTING_KEY])
  })

  it('chaque refus a un message explicite en francais', () => {
    for (const messages of [fr]) {
      const errors = messages.AssociationSettings.errors as Record<
        string,
        string
      >
      for (const code of ASSOCIATION_SETTING_ERROR_CODES) {
        expect(errors[code], code).toEqual(expect.any(String))
        expect(errors[code].length, code).toBeGreaterThan(10)
      }
    }
  })
})

describe('parseSettingValue — adresse email', () => {
  const email = testDefinition('test.optional_email')

  it('accepte une adresse conforme, espaces retires', () => {
    expect(parseSettingValue(email, '  tresorier@asl.test ')).toEqual({
      valid: true,
      value: 'tresorier@asl.test',
      normalized: 'tresorier@asl.test',
    })
  })

  it.each(['tresorier', 'tresorier@', '@asl.test', 'a b@asl.test'])(
    'refuse %s',
    (raw) => {
      expect(parseSettingValue(email, raw)).toEqual({
        valid: false,
        error: {code: 'invalidEmail'},
      })
    }
  )
})

describe('parseSettingValue — nombre', () => {
  const number = testDefinition('test.number')

  it('accepte un nombre dans ses bornes', () => {
    expect(parseSettingValue(number, ' 45 ')).toEqual({
      valid: true,
      value: 45,
      normalized: '45',
    })
  })

  it.each(['abc', '12abc', '4.5'])('refuse %s', (raw) => {
    expect(parseSettingValue(number, raw)).toEqual({
      valid: false,
      error: {code: 'invalidNumber'},
    })
  })

  it('refuse sous le minimum, en disant la borne', () => {
    expect(parseSettingValue(number, '0')).toEqual({
      valid: false,
      error: {code: 'belowMin', min: 1},
    })
  })

  it('refuse au-dessus du maximum, en disant la borne', () => {
    expect(parseSettingValue(number, '366')).toEqual({
      valid: false,
      error: {code: 'aboveMax', max: 365},
    })
  })
})

describe('parseSettingValue — booleen', () => {
  const flag = testDefinition('test.boolean')

  it.each([
    ['true', true],
    ['false', false],
  ])('accepte %s', (raw, value) => {
    expect(parseSettingValue(flag, raw)).toEqual({
      valid: true,
      value,
      normalized: raw,
    })
  })

  it.each(['oui', '1', 'TRUE '])('refuse %s', (raw) => {
    expect(parseSettingValue(flag, raw)).toEqual({
      valid: false,
      error: {code: 'invalidBoolean'},
    })
  })
})

describe('parseSettingValue — choix dans une liste fermee', () => {
  const choice = testDefinition('test.choice_few')

  it('accepte une option de la liste', () => {
    expect(parseSettingValue(choice, 'weekly')).toEqual({
      valid: true,
      value: 'weekly',
      normalized: 'weekly',
    })
  })

  it('refuse une valeur hors liste', () => {
    expect(parseSettingValue(choice, 'daily')).toEqual({
      valid: false,
      error: {code: 'invalidChoice'},
    })
  })

  it('refuse une teinte hors des six teintes validees', () => {
    const hue = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      ACCENT_HUE_SETTING_KEY
    )
    expect(parseSettingValue(hue, '10')).toEqual({
      valid: false,
      error: {code: 'invalidChoice'},
    })
    expect(parseSettingValue(hue, '40')).toMatchObject({valid: true})
  })
})

describe('resolveSettings — lecture', () => {
  it('un parametre jamais renseigne se lit a son defaut constant', () => {
    const settings = resolveSettings(TEST_SETTINGS_REGISTRY, [])

    expect(settings['test.number']).toEqual({
      value: 30,
      storedValue: null,
      defaultFromKey: null,
    })
    expect(settings['test.boolean'].value).toBe(false)
    expect(settings['test.choice_few'].value).toBe('monthly')
    expect(settings['test.choice_many'].value).toBeNull()
  })

  it('une valeur renseignee l emporte sur le defaut', () => {
    const settings = resolveSettings(TEST_SETTINGS_REGISTRY, [
      {key: 'test.number', value: '90'},
      {key: 'test.boolean', value: 'true'},
    ])

    expect(settings['test.number']).toEqual({
      value: 90,
      storedValue: '90',
      defaultFromKey: null,
    })
    expect(settings['test.boolean'].value).toBe(true)
  })

  it('le forage vide se lit a l adresse de contact', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
    ])

    expect(settings[FORAGE_EMAIL_SETTING_KEY]).toEqual({
      value: 'contact@asl.test',
      storedValue: null,
      defaultFromKey: CONTACT_EMAIL_SETTING_KEY,
    })
  })

  it('le forage renseigne garde sa propre adresse', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
      {key: FORAGE_EMAIL_SETTING_KEY, value: 'forage@asl.test'},
    ])

    expect(settings[FORAGE_EMAIL_SETTING_KEY]).toEqual({
      value: 'forage@asl.test',
      storedValue: 'forage@asl.test',
      defaultFromKey: null,
    })
  })

  it('ignore une ligne dont la cle n est plus au registre', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: 'ancienne.cle', value: 'x'},
    ])

    expect(settings).not.toHaveProperty('ancienne.cle')
  })

  it('une valeur stockee invalide se lit comme absente', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: ACCENT_HUE_SETTING_KEY, value: '12'},
    ])

    expect(settings[ACCENT_HUE_SETTING_KEY]).toEqual({
      value: '195',
      storedValue: null,
      defaultFromKey: null,
    })
    expect(getAccentHue(settings)).toBe(195)
  })

  it('lit la teinte choisie comme un nombre', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: ACCENT_HUE_SETTING_KEY, value: '300'},
    ])

    expect(getAccentHue(settings)).toBe(300)
  })

  it('sans teinte connue, la teinte par defaut', () => {
    expect(getAccentHue({})).toBe(195)
  })
})

describe('validateSettingsChanges — tout ou rien', () => {
  it('accepte une valeur conforme de chaque type', () => {
    expect(
      validateSettingsChanges(TEST_SETTINGS_REGISTRY, {
        'test.required_email': 'secretariat@asl.test',
        'test.number': '12',
        'test.boolean': 'true',
        'test.choice_many': 'east',
      })
    ).toEqual({
      valid: true,
      upserts: [
        {key: 'test.required_email', value: 'secretariat@asl.test'},
        {key: 'test.number', value: '12'},
        {key: 'test.boolean', value: 'true'},
        {key: 'test.choice_many', value: 'east'},
      ],
      deletions: [],
    })
  })

  it('refuse le tout si une seule valeur est non conforme, erreur par cle', () => {
    expect(
      validateSettingsChanges(TEST_SETTINGS_REGISTRY, {
        'test.required_email': 'secretariat@asl.test',
        'test.optional_email': 'pas-une-adresse',
        'test.number': '1000',
      })
    ).toEqual({
      valid: false,
      errors: {
        'test.optional_email': {code: 'invalidEmail'},
        'test.number': {code: 'aboveMax', max: 365},
      },
    })
  })

  it('refuse de vider un parametre obligatoire', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [CONTACT_EMAIL_SETTING_KEY]: '   ',
        [FORAGE_EMAIL_SETTING_KEY]: 'forage@asl.test',
      })
    ).toEqual({
      valid: false,
      errors: {[CONTACT_EMAIL_SETTING_KEY]: {code: 'required'}},
    })
  })

  it('vider un parametre facultatif le supprime, ce qui le ramene au defaut', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
        [FORAGE_EMAIL_SETTING_KEY]: '',
      })
    ).toEqual({
      valid: true,
      upserts: [{key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'}],
      deletions: [FORAGE_EMAIL_SETTING_KEY],
    })
  })

  it('refuse une cle inconnue du registre', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        'cle.inconnue': 'x',
      })
    ).toEqual({
      valid: false,
      errors: {'cle.inconnue': {code: 'unknownKey'}},
    })
  })
})

describe('getMagicLinkDailyRequestLimit — seuil de demande de lien', () => {
  it('sans reglage, le defaut du registre : 3 par jour', () => {
    expect(
      getMagicLinkDailyRequestLimit(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe(3)
  })

  it('la valeur renseignee par le bureau l emporte', () => {
    expect(
      getMagicLinkDailyRequestLimit(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY, value: '7'},
        ])
      )
    ).toBe(7)
  })
})

describe('getContactMessagesPerHourLimit — seuil des formulaires publics', () => {
  it('sans reglage, le defaut du registre : 3 par heure', () => {
    expect(
      getContactMessagesPerHourLimit(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe(3)
  })

  it('la valeur renseignee par le bureau l emporte', () => {
    expect(
      getContactMessagesPerHourLimit(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: CONTACT_MESSAGES_PER_HOUR_SETTING_KEY, value: '1'},
        ])
      )
    ).toBe(1)
  })
})

describe('registre — carte « Referencement » (s11)', () => {
  const description = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    ASSOCIATION_DESCRIPTION_SETTING_KEY
  )
  const verification = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    GOOGLE_VERIFICATION_SETTING_KEY
  )

  it('porte deux cles texte facultatives, sans defaut, rangees dans la carte « Referencement »', () => {
    expect(ASSOCIATION_DESCRIPTION_SETTING_KEY).toBe('association.description')
    expect(GOOGLE_VERIFICATION_SETTING_KEY).toBe('search.google_verification')
    expect(description).toMatchObject({
      type: 'text',
      maxLength: 160,
      multiline: true,
      section: 'seo',
    })
    expect(verification).toMatchObject({
      type: 'text',
      multiline: false,
      format: 'verification-code',
      section: 'seo',
    })
    expect(description.default).toBeUndefined()
    expect(verification.default).toBeUndefined()
  })

  it('les cles existantes ne changent pas de carte', () => {
    expect(
      ASSOCIATION_SETTINGS_REGISTRY.filter(
        (definition) => definition.section !== undefined
      ).map((definition) => definition.key)
    ).toEqual([
      ASSOCIATION_DESCRIPTION_SETTING_KEY,
      GOOGLE_VERIFICATION_SETTING_KEY,
      ASSOCIATION_LEGAL_NAME_SETTING_KEY,
      ASSOCIATION_LEGAL_MENTIONS_SETTING_KEY,
      EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
      EMAIL_LOGIN_RESERVE_SETTING_KEY,
      CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY,
      CAMPAIGN_SEND_MAX_ATTEMPTS_SETTING_KEY,
      MEMBER_EMAIL_CONFIRMATION_DAYS_SETTING_KEY,
      ...CAMPAIGN_SEND_KINDS.map(campaignNatureSettingKeyOf),
      BILLING_PROVIDER_SETTING_KEY,
      BILLING_INVOICE_SUBJECT_SETTING_KEY,
      BILLING_UNPAID_STATUSES_SETTING_KEY,
      BILLING_SETTLED_STATUSES_SETTING_KEY,
      BILLING_STATUS_LABELS_SETTING_KEY,
      BILLING_ALERT_EMAIL_SETTING_KEY,
      BILLING_REMINDER_ENABLED_SETTING_KEY,
      ...BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS,
      BILLING_REMINDER_SUBJECT_SETTING_KEY,
      BILLING_REMINDER_BODY_SETTING_KEY,
      LETTER_ADDRESS_OFFSET_X_SETTING_KEY,
      LETTER_ADDRESS_OFFSET_Y_SETTING_KEY,
      INVITATION_TEXT_SETTING_KEY,
      INVITATION_LETTER_TEXT_SETTING_KEY,
      INVITATION_LINK_DAYS_SETTING_KEY,
      MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY,
    ])
  })

  it('chaque phrase « Vide : » existe en francais', () => {
    for (const messages of [fr]) {
      const {associationDescription, googleVerification} =
        messages.AssociationSettings.fields
      expect(associationDescription.whenEmpty).toEqual(expect.any(String))
      expect(googleVerification.whenEmpty).toEqual(expect.any(String))
    }
  })
})

describe('extractGoogleVerificationCode — balise collee entiere', () => {
  const CODE = 'k3Jd8-QwX_9mLp2vRtY7aBcDeFgHiJ0kLmNoPq'

  it('extrait le code d une balise complete', () => {
    expect(
      extractGoogleVerificationCode(
        `<meta name="google-site-verification" content="${CODE}" />`
      )
    ).toBe(CODE)
  })

  it('extrait le code d une balise a guillemets simples', () => {
    expect(
      extractGoogleVerificationCode(
        `<meta name='google-site-verification' content='${CODE}'>`
      )
    ).toBe(CODE)
  })

  it('rend le code nu tel quel, espaces retires', () => {
    expect(extractGoogleVerificationCode(`  ${CODE} `)).toBe(CODE)
  })

  it('une balise sans content ne donne aucun code', () => {
    expect(
      extractGoogleVerificationCode('<meta name="google-site-verification">')
    ).toBeUndefined()
  })
})

describe('parseSettingValue — texte (s11)', () => {
  const description = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    ASSOCIATION_DESCRIPTION_SETTING_KEY
  )
  const verification = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    GOOGLE_VERIFICATION_SETTING_KEY
  )

  it('accepte une description de 160 caracteres, espaces de bord retires', () => {
    const text = 'a'.repeat(160)
    expect(parseSettingValue(description, ` ${text} `)).toEqual({
      valid: true,
      value: text,
      normalized: text,
    })
  })

  it('refuse 161 caracteres, en disant le plafond', () => {
    expect(parseSettingValue(description, 'a'.repeat(161))).toEqual({
      valid: false,
      error: {code: 'tooLong', max: 160},
    })
  })

  it('reduit une balise collee a son code, cote serveur aussi', () => {
    expect(
      parseSettingValue(
        verification,
        '<meta name="google-site-verification" content="abc-DEF_123" />'
      )
    ).toEqual({valid: true, value: 'abc-DEF_123', normalized: 'abc-DEF_123'})
  })

  it.each(['k3Jd8 QwX', 'k3Jd8/QwX', 'abc#def', '<meta name="x">'])(
    'refuse le code %s',
    (raw) => {
      expect(parseSettingValue(verification, raw)).toEqual({
        valid: false,
        error: {code: 'invalidCode'},
      })
    }
  )

  it('une valeur vide est absente : la ligne est supprimee', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [ASSOCIATION_DESCRIPTION_SETTING_KEY]: '  ',
        [GOOGLE_VERIFICATION_SETTING_KEY]: '',
      })
    ).toEqual({
      valid: true,
      upserts: [],
      deletions: [
        ASSOCIATION_DESCRIPTION_SETTING_KEY,
        GOOGLE_VERIFICATION_SETTING_KEY,
      ],
    })
  })
})

describe('lecture des reglages de referencement (s11)', () => {
  it('rend la description et le code renseignes', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: ASSOCIATION_DESCRIPTION_SETTING_KEY, value: 'Réseau d’eau privé.'},
      {key: GOOGLE_VERIFICATION_SETTING_KEY, value: 'abc-DEF_123'},
    ])
    expect(getAssociationDescription(settings)).toBe('Réseau d’eau privé.')
    expect(getGoogleVerificationCode(settings)).toBe('abc-DEF_123')
  })

  it('non renseignes : rien, jamais une chaine vide', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    expect(getAssociationDescription(settings)).toBeUndefined()
    expect(getGoogleVerificationCode(settings)).toBeUndefined()
  })

  it('une valeur stockee invalide se lit comme absente', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: GOOGLE_VERIFICATION_SETTING_KEY, value: 'abc def'},
    ])
    expect(getGoogleVerificationCode(settings)).toBeUndefined()
  })
})

describe('limite d’envoi et réserve de connexion (s52, ADR 053)', () => {
  const limit = () =>
    definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      EMAIL_DAILY_SEND_LIMIT_SETTING_KEY
    )
  const reserve = () =>
    definitionOf(ASSOCIATION_SETTINGS_REGISTRY, EMAIL_LOGIN_RESERVE_SETTING_KEY)

  it('la limite est un entier d’au moins 1, 300 par défaut, en tête de la carte « Envois », réservée au SuperAdmin', () => {
    expect(EMAIL_DAILY_SEND_LIMIT_SETTING_KEY).toBe('email.daily_send_limit')
    expect(limit()).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      default: {value: '300'},
      unitKey: 'units.sendsPerDay',
      section: 'sending',
      editableBy: 'super_admin',
    })
    expect(parseSettingValue(limit(), '0')).toMatchObject({valid: false})
    expect(parseSettingValue(limit(), '1')).toMatchObject({valid: true})
    const sending = getSettingsForPage(
      ASSOCIATION_SETTINGS_REGISTRY,
      'settings'
    ).filter((definition) => definition.section === 'sending')
    expect(sending.map(({key}) => key).slice(0, 2)).toEqual([
      EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
      EMAIL_LOGIN_RESERVE_SETTING_KEY,
    ])
  })

  it('la réserve est un entier d’au moins 0, 100 par défaut, réservée au SuperAdmin', () => {
    expect(EMAIL_LOGIN_RESERVE_SETTING_KEY).toBe('email.login_reserve')
    expect(reserve()).toMatchObject({
      type: 'number',
      integer: true,
      min: 0,
      default: {value: '100'},
      section: 'sending',
      editableBy: 'super_admin',
      lessThanKey: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
    })
    expect(parseSettingValue(reserve(), '-1')).toMatchObject({valid: false})
    expect(parseSettingValue(reserve(), '0')).toMatchObject({valid: true})
  })

  it('seules la limite, la réserve, la nature des envois (s27b), la source des factures (s19) et le délai d’accès après la vente (s57) sont réservées au SuperAdmin', () => {
    expect(
      ASSOCIATION_SETTINGS_REGISTRY.filter(isSuperAdminOnlySetting).map(
        ({key}) => key
      )
    ).toEqual([
      EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
      EMAIL_LOGIN_RESERVE_SETTING_KEY,
      ...CAMPAIGN_SEND_KINDS.map(campaignNatureSettingKeyOf),
      BILLING_PROVIDER_SETTING_KEY,
      MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY,
    ])
  })

  it('les accesseurs rendent 300 et 100 par défaut, sinon la valeur réglée', () => {
    const defaults = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    expect(getEmailDailySendLimit(defaults)).toBe(300)
    expect(getEmailLoginReserve(defaults)).toBe(100)

    const custom = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY, value: '500'},
      {key: EMAIL_LOGIN_RESERVE_SETTING_KEY, value: '50'},
    ])
    expect(getEmailDailySendLimit(custom)).toBe(500)
    expect(getEmailLoginReserve(custom)).toBe(50)
  })

  it('refuse une réserve égale à la limite, l’erreur sur le champ de la réserve', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [EMAIL_DAILY_SEND_LIMIT_SETTING_KEY]: '300',
        [EMAIL_LOGIN_RESERVE_SETTING_KEY]: '300',
      })
    ).toEqual({
      valid: false,
      errors: {[EMAIL_LOGIN_RESERVE_SETTING_KEY]: {code: 'notBelow', max: 300}},
    })
  })

  it('le contrôle croisé lit la valeur enregistrée de l’autre clé', () => {
    const stored = [{key: EMAIL_LOGIN_RESERVE_SETTING_KEY, value: '80'}]
    expect(
      validateSettingsChanges(
        ASSOCIATION_SETTINGS_REGISTRY,
        {[EMAIL_DAILY_SEND_LIMIT_SETTING_KEY]: '80'},
        stored
      )
    ).toEqual({
      valid: false,
      errors: {[EMAIL_LOGIN_RESERVE_SETTING_KEY]: {code: 'notBelow', max: 80}},
    })
    expect(
      validateSettingsChanges(
        ASSOCIATION_SETTINGS_REGISTRY,
        {[EMAIL_DAILY_SEND_LIMIT_SETTING_KEY]: '81'},
        stored
      )
    ).toMatchObject({valid: true})
  })

  it('sans valeur enregistrée, le contrôle croisé lit le défaut du registre', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [EMAIL_DAILY_SEND_LIMIT_SETTING_KEY]: '100',
      })
    ).toMatchObject({
      valid: false,
      errors: {[EMAIL_LOGIN_RESERVE_SETTING_KEY]: {code: 'notBelow'}},
    })
  })

  it('ne contrôle rien quand ni la limite ni la réserve ne changent', () => {
    expect(
      validateSettingsChanges(
        ASSOCIATION_SETTINGS_REGISTRY,
        {[CAMPAIGN_DAILY_SEND_CAP_SETTING_KEY]: '100'},
        [
          {key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY, value: '50'},
          {key: EMAIL_LOGIN_RESERVE_SETTING_KEY, value: '50'},
        ]
      )
    ).toMatchObject({valid: true})
  })

  it('libellés, aides et message du contrôle croisé en français, aide du plafond raccourcie', () => {
    const fields = fr.AssociationSettings.fields as Record<
      string,
      {label: string; help: string; errors?: Record<string, string>}
    >
    expect(fields.emailDailySendLimit.label).toBe(
      'Limite d’envoi quotidienne de la messagerie'
    )
    expect(fields.emailDailySendLimit.help).toContain('Par défaut : 300.')
    expect(fields.emailLoginReserve.label).toBe(
      'Envois gardés pour la connexion'
    )
    expect(fields.emailLoginReserve.help).toContain('Par défaut : 100.')
    expect(fields.emailLoginReserve.errors?.notBelow).toBe(
      'Gardez moins d’envois que la limite quotidienne ({max}).'
    )
    expect(fields.campaignDailySendCap.help).toBe(
      'Nombre maximum d’emails de campagne envoyés par jour, toutes campagnes confondues. Par défaut : 100.'
    )
    expect(fr.AssociationSettings.superAdminOnly).toEqual(expect.any(String))
  })
})

describe('nature des envois (s27b, ADR 064)', () => {
  const natureDefinition = (
    templateId: (typeof CAMPAIGN_TEMPLATE_IDS)[number]
  ) =>
    definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      campaignNatureSettingKeyOf(templateId)
    )
  const lookup = (dotted: string) =>
    dotted
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        fr.AssociationSettings
      )

  it('chaque type d’envoi porte une clé « choix » facultative / statutaire, facultative par défaut, réservée au SuperAdmin (critère 1)', () => {
    for (const templateId of CAMPAIGN_TEMPLATE_IDS) {
      const definition = natureDefinition(templateId)
      expect(definition.key).toBe(`campaign.nature.${templateId}`)
      expect(definition).toMatchObject({
        type: 'choice',
        required: false,
        default: {value: 'facultative'},
        page: 'settings',
        section: 'campaign_nature',
      })
      expect(
        definition.type === 'choice' &&
          definition.options.map((option) => option.value)
      ).toEqual(['facultative', 'statutaire'])
      expect(isSuperAdminOnlySetting(definition)).toBe(true)
    }
  })

  it('sans nature configurée, chaque type d’envoi est facultatif (critère 2)', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    for (const templateId of CAMPAIGN_TEMPLATE_IDS) {
      expect(getCampaignNature(settings, templateId), templateId).toBe(
        'facultative'
      )
    }
    expect(getStatutoryTemplateIds(settings)).toEqual([])
  })

  it('une valeur vide, inconnue ou absente des réglages se lit facultative, jamais statutaire (critère 2)', () => {
    const stored = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: campaignNatureSettingKeyOf('reminder'), value: 'obligatoire'},
      {key: campaignNatureSettingKeyOf('invoice'), value: ''},
    ])
    expect(getCampaignNature(stored, 'reminder')).toBe('facultative')
    expect(getCampaignNature(stored, 'invoice')).toBe('facultative')
    expect(getCampaignNature({}, 'general_assembly')).toBe('facultative')
    expect(
      getCampaignNature(
        {
          [campaignNatureSettingKeyOf('general_assembly')]: {
            value: 'Statutaire',
            storedValue: 'Statutaire',
            defaultFromKey: null,
          },
        },
        'general_assembly'
      )
    ).toBe('facultative')
  })

  it('lit la nature enregistrée et liste les types statutaires dans l’ordre des modèles', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {
        key: campaignNatureSettingKeyOf('general_assembly'),
        value: 'statutaire',
      },
      {key: campaignNatureSettingKeyOf('reminder'), value: 'statutaire'},
      {key: campaignNatureSettingKeyOf('free'), value: 'facultative'},
    ])
    expect(getCampaignNature(settings, 'general_assembly')).toBe('statutaire')
    expect(getCampaignNature(settings, 'free')).toBe('facultative')
    expect(getStatutoryTemplateIds(settings)).toEqual([
      'reminder',
      'general_assembly',
    ])
  })

  it('refuse une nature hors des deux options', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [campaignNatureSettingKeyOf('free')]: 'obligatoire',
      })
    ).toEqual({
      valid: false,
      errors: {[campaignNatureSettingKeyOf('free')]: {code: 'invalidChoice'}},
    })
  })

  it('la carte « Nature des envois » suit la carte « Envois », avec ses libellés en français', () => {
    const sections = getSettingsForPage(
      ASSOCIATION_SETTINGS_REGISTRY,
      'settings'
    ).map((definition) => definition.section)
    expect(sections.indexOf('campaign_nature')).toBe(
      sections.lastIndexOf('sending') + 1
    )
    expect(
      (
        fr.BureauSettingsPage.cards as Record<
          string,
          {title: string; description?: string}
        >
      ).campaign_nature
    ).toEqual({
      title: 'Nature des envois',
      description: expect.stringContaining('statutaire'),
    })
    expect(
      CAMPAIGN_TEMPLATE_IDS.map((templateId) =>
        lookup(natureDefinition(templateId).labelKey)
      )
    ).toEqual([
      'Message libre',
      'Relance manuelle',
      'Facture disponible',
      'Convocation à l’AG',
      'Documents après l’AG',
    ])
    const definition = natureDefinition('free')
    expect(lookup(definition.helpKey)).toEqual(expect.any(String))
    expect(definition.whenEmptyKey && lookup(definition.whenEmptyKey)).toBe(
      'Sans choix enregistré : facultatif.'
    )
    expect(
      definition.readOnlyHelpKey && lookup(definition.readOnlyHelpKey)
    ).toBe(
      'Réglé par l’équipe technique de la plateforme, après avis du conseil RGPD : vous ne pouvez pas le modifier.'
    )
    expect(
      definition.type === 'choice' &&
        definition.options.map((option) => lookup(option.labelKey))
    ).toEqual([
      'Facultatif — les désinscrits ne le reçoivent pas',
      'Statutaire — les désinscrits le reçoivent aussi',
    ])
  })
})

describe('nature de la relance automatique (s29, ADR 070 §8)', () => {
  const lookup = (dotted: string) =>
    dotted
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        fr.AssociationSettings
      )

  it('la relance automatique est un type d’envoi portant une nature, pas un modèle du composeur', () => {
    expect(CAMPAIGN_SEND_KINDS).toEqual([
      ...CAMPAIGN_TEMPLATE_IDS,
      'unpaid_reminder',
      'member_invitation_launch',
      'member_invitation_reminder',
    ])
    expect(CAMPAIGN_TEMPLATE_IDS as readonly string[]).not.toContain(
      'unpaid_reminder'
    )
  })

  it('le réglage campaign.nature.unpaid_reminder existe, facultatif par défaut, réservé au SuperAdmin', () => {
    const definition = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      'campaign.nature.unpaid_reminder'
    )
    expect(definition).toMatchObject({
      type: 'choice',
      required: false,
      default: {value: 'facultative'},
      page: 'settings',
      section: 'campaign_nature',
    })
    expect(isSuperAdminOnlySetting(definition)).toBe(true)
    expect(lookup(definition.labelKey)).toBe('Relance automatique')
    expect(
      getCampaignNature(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, []),
        'unpaid_reminder'
      )
    ).toBe('facultative')
  })

  it('statutaire, elle figure parmi les envois statutaires, après les modèles', () => {
    const settings = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: 'campaign.nature.unpaid_reminder', value: 'statutaire'},
      {key: campaignNatureSettingKeyOf('reminder'), value: 'statutaire'},
    ])
    expect(getStatutoryTemplateIds(settings)).toEqual([
      'reminder',
      'unpaid_reminder',
    ])
  })
})

describe('relances des impayés — réglages (s29, ADR 070 §7)', () => {
  const lookup = (dotted: string) =>
    dotted
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        fr.AssociationSettings
      )
  const [DELAY_1, DELAY_2, DELAY_3] = BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS
  const complete = {
    [BILLING_REMINDER_ENABLED_SETTING_KEY]: 'true',
    [DELAY_1]: '3',
    [DELAY_2]: '2',
    [DELAY_3]: '1',
    [BILLING_REMINDER_SUBJECT_SETTING_KEY]: 'Facture impayée',
    [BILLING_REMINDER_BODY_SETTING_KEY]: 'Bonjour {nom},\n\n{factures}',
  }

  it('déclare l’activation, trois intervalles, un objet et un texte, dans la carte « reminder » qui suit « billing »', () => {
    expect(BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS).toEqual([
      'billing.reminder.delay_weeks.1',
      'billing.reminder.delay_weeks.2',
      'billing.reminder.delay_weeks.3',
    ])
    expect(
      definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        BILLING_REMINDER_ENABLED_SETTING_KEY
      )
    ).toMatchObject({
      key: 'billing.reminder.enabled',
      type: 'boolean',
      required: false,
      default: {value: 'false'},
      page: 'settings',
      section: 'reminder',
    })
    for (const key of BILLING_REMINDER_DELAY_WEEKS_SETTING_KEYS) {
      const definition = definitionOf(ASSOCIATION_SETTINGS_REGISTRY, key)
      expect(definition, key).toMatchObject({
        type: 'number',
        required: false,
        min: 1,
        max: 52,
        integer: true,
        section: 'reminder',
      })
      expect(definition.default, key).toBeUndefined()
      expect(
        definition.type === 'number' &&
          definition.unitKey &&
          lookup(definition.unitKey),
        key
      ).toEqual(expect.stringContaining('semaines'))
    }
    expect(
      definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        BILLING_REMINDER_SUBJECT_SETTING_KEY
      )
    ).toMatchObject({
      key: 'billing.reminder.subject',
      type: 'text',
      required: false,
      multiline: false,
      maxLength: CAMPAIGN_SUBJECT_MAX_TOTAL,
      section: 'reminder',
    })
    expect(
      definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        BILLING_REMINDER_BODY_SETTING_KEY
      )
    ).toMatchObject({
      key: 'billing.reminder.body',
      type: 'text',
      required: false,
      multiline: true,
      maxLength: CAMPAIGN_BODY_MAX,
      section: 'reminder',
    })
    for (const key of [
      BILLING_REMINDER_SUBJECT_SETTING_KEY,
      BILLING_REMINDER_BODY_SETTING_KEY,
    ]) {
      expect(
        definitionOf(ASSOCIATION_SETTINGS_REGISTRY, key).default,
        key
      ).toBeUndefined()
    }

    const sections = getSettingsForPage(
      ASSOCIATION_SETTINGS_REGISTRY,
      'settings'
    ).map((definition) => definition.section)
    expect(sections.indexOf('reminder')).toBe(
      sections.lastIndexOf('billing') + 1
    )
    expect(
      (
        fr.BureauSettingsPage.cards as Record<
          string,
          {title: string; description?: string}
        >
      ).reminder.title
    ).toBe('Relances des impayés')
  })

  it('activer avec les cinq autres réglages renseignés passe', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, complete)
    ).toMatchObject({valid: true})
  })

  it.each([
    DELAY_1,
    DELAY_2,
    DELAY_3,
    'billing.reminder.subject',
    'billing.reminder.body',
  ])(
    'activer sans %s refuse, sur ce réglage, avec le code dédié',
    (missing) => {
      const changes = {...complete, [missing]: ''}
      expect(
        validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, changes)
      ).toEqual({
        valid: false,
        errors: {[missing]: {code: 'requiredToEnable'}},
      })
    }
  )

  it('les réglages déjà enregistrés comptent : activer seul passe s’ils sont là', () => {
    const rest = Object.fromEntries(
      Object.entries(complete).filter(
        ([key]) => key !== BILLING_REMINDER_ENABLED_SETTING_KEY
      )
    )
    expect(
      validateSettingsChanges(
        ASSOCIATION_SETTINGS_REGISTRY,
        {[BILLING_REMINDER_ENABLED_SETTING_KEY]: 'true'},
        Object.entries(rest).map(([key, value]) => ({key, value}))
      )
    ).toMatchObject({valid: true})
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [BILLING_REMINDER_ENABLED_SETTING_KEY]: 'true',
      })
    ).toMatchObject({valid: false})
  })

  it('vider un réglage alors que la relance reste activée refuse', () => {
    expect(
      validateSettingsChanges(
        ASSOCIATION_SETTINGS_REGISTRY,
        {[BILLING_REMINDER_BODY_SETTING_KEY]: ''},
        Object.entries(complete).map(([key, value]) => ({key, value}))
      )
    ).toEqual({
      valid: false,
      errors: {[BILLING_REMINDER_BODY_SETTING_KEY]: {code: 'requiredToEnable'}},
    })
  })

  it('la désactivation passe toujours, même sans aucun autre réglage', () => {
    expect(
      validateSettingsChanges(ASSOCIATION_SETTINGS_REGISTRY, {
        [BILLING_REMINDER_ENABLED_SETTING_KEY]: 'false',
        [BILLING_REMINDER_BODY_SETTING_KEY]: '',
      })
    ).toMatchObject({valid: true})
  })

  it('le code dédié a son message, et le texte dit « avant de l’activer »', () => {
    expect(ASSOCIATION_SETTING_ERROR_CODES).toContain('requiredToEnable')
    expect(lookup('errors.requiredToEnable')).toEqual(expect.any(String))
    const body = definitionOf(
      ASSOCIATION_SETTINGS_REGISTRY,
      BILLING_REMINDER_BODY_SETTING_KEY
    )
    expect(lookup(body.errorMessageKeys?.requiredToEnable ?? 'missing')).toBe(
      'Écrivez le texte de la relance avant de l’activer.'
    )
  })

  it('lecteur typé : désactivée par défaut, activée seulement complète', () => {
    expect(
      getUnpaidReminderSettings(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toEqual({enabled: false, delaysWeeks: null})
    const rows = Object.entries(complete).map(([key, value]) => ({key, value}))
    expect(
      getUnpaidReminderSettings(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)
      )
    ).toEqual({
      enabled: true,
      delaysWeeks: [3, 2, 1],
      subject: 'Facture impayée',
      body: 'Bonjour {nom},\n\n{factures}',
    })
    expect(
      getUnpaidReminderSettings(
        resolveSettings(
          ASSOCIATION_SETTINGS_REGISTRY,
          rows.filter((row) => row.key !== BILLING_REMINDER_BODY_SETTING_KEY)
        )
      )
    ).toEqual({enabled: false, delaysWeeks: [3, 2, 1]})
  })
})

describe('invitation des membres — réglages (s42a)', () => {
  const text = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    INVITATION_TEXT_SETTING_KEY
  )
  const days = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    INVITATION_LINK_DAYS_SETTING_KEY
  )

  it('le texte de l’invitation est un texte long facultatif, sans défaut, carte « Invitation »', () => {
    expect(INVITATION_TEXT_SETTING_KEY).toBe('invitation.text')
    expect(text).toMatchObject({
      type: 'text',
      required: false,
      multiline: true,
      maxLength: 2000,
      page: 'settings',
      section: 'invitation',
      whenEmptyKey: 'fields.invitationText.whenEmpty',
    })
    expect(text.default).toBeUndefined()
    expect(parseSettingValue(text, 'x'.repeat(2001))).toMatchObject({
      valid: false,
      error: {code: 'tooLong'},
    })
    expect(parseSettingValue(text, 'Bonjour,\n\nBienvenue.')).toMatchObject({
      valid: true,
    })
  })

  it('la durée du lien d’invitation est un entier de 1 à 30 jours, 7 par défaut', () => {
    expect(INVITATION_LINK_DAYS_SETTING_KEY).toBe('invitation.link_days')
    expect(days).toMatchObject({
      type: 'number',
      integer: true,
      min: 1,
      max: 30,
      default: {value: '7'},
      unitKey: 'units.days',
      page: 'settings',
      section: 'invitation',
    })
    expect(parseSettingValue(days, '0')).toMatchObject({valid: false})
    expect(parseSettingValue(days, '31')).toMatchObject({valid: false})
    expect(parseSettingValue(days, '2.5')).toMatchObject({valid: false})
    expect(parseSettingValue(days, '30')).toMatchObject({valid: true})
  })

  it('accesseurs : texte absent → null, durée absente → 7 ; valeurs du bureau sinon', () => {
    const empty = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
    expect(getInvitationText(empty)).toBeNull()
    expect(getInvitationLinkDays(empty)).toBe(7)

    const stored = resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: INVITATION_TEXT_SETTING_KEY, value: 'Bienvenue sur le site.'},
      {key: INVITATION_LINK_DAYS_SETTING_KEY, value: '14'},
    ])
    expect(getInvitationText(stored)).toBe('Bienvenue sur le site.')
    expect(getInvitationLinkDays(stored)).toBe(14)
  })

  it('libellés en français : carte, champs, aides, erreurs et défaut du texte', () => {
    const fields = fr.AssociationSettings.fields as unknown as Record<
      string,
      {
        label: string
        help: string
        whenEmpty?: string
        errors?: Record<string, string>
      }
    >
    expect(fields.invitationText.label).toEqual(expect.any(String))
    expect(fields.invitationText.help.length).toBeGreaterThan(20)
    expect(fields.invitationText.whenEmpty).toContain('Bonjour')
    expect(fields.invitationLinkDays.label).toEqual(expect.any(String))
    expect(fields.invitationLinkDays.help).toContain('20 minutes')
    expect(days.errorMessageKeys).toEqual({
      invalidNumber: 'fields.invitationLinkDays.errors.outOfRange',
      belowMin: 'fields.invitationLinkDays.errors.outOfRange',
      aboveMax: 'fields.invitationLinkDays.errors.outOfRange',
    })
    expect(fields.invitationLinkDays.errors?.outOfRange).toBe(
      'Indiquez un nombre de jours entre 1 et 30.'
    )
    const cards = fr.BureauSettingsPage.cards as unknown as Record<
      string,
      {title: string; description: string}
    >
    expect(cards.invitation.title).toBe('Invitation des membres')
    expect(cards.invitation.description).toEqual(expect.any(String))
  })
})

describe('lancement des invitations — réglages (s42b, ADR 072)', () => {
  const lookup = (dotted: string) =>
    dotted
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        fr.AssociationSettings
      )
  const letter = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    INVITATION_LETTER_TEXT_SETTING_KEY
  )

  it('le lancement et la relance sont deux types d’envoi portant une nature, jamais des modèles du composeur', () => {
    expect(MEMBER_INVITATION_LAUNCH_SEND_KIND).toBe('member_invitation_launch')
    expect(MEMBER_INVITATION_REMINDER_SEND_KIND).toBe(
      'member_invitation_reminder'
    )
    for (const kind of [
      MEMBER_INVITATION_LAUNCH_SEND_KIND,
      MEMBER_INVITATION_REMINDER_SEND_KIND,
    ]) {
      expect(CAMPAIGN_TEMPLATE_IDS as readonly string[]).not.toContain(kind)
      expect(isMemberInvitationKind(kind)).toBe(true)
    }
    for (const kind of [...CAMPAIGN_TEMPLATE_IDS, 'unpaid_reminder', null]) {
      expect(isMemberInvitationKind(kind)).toBe(false)
    }
  })

  it('chaque type a sa nature générée, facultative par défaut, réservée au SuperAdmin, sous son libellé', () => {
    const labels = {
      member_invitation_launch: 'Lancement du site',
      member_invitation_reminder: 'Relance des invitations',
    } as const
    for (const [kind, label] of Object.entries(labels)) {
      const definition = definitionOf(
        ASSOCIATION_SETTINGS_REGISTRY,
        `campaign.nature.${kind}`
      )
      expect(definition).toMatchObject({
        type: 'choice',
        default: {value: 'facultative'},
        section: 'campaign_nature',
      })
      expect(isSuperAdminOnlySetting(definition)).toBe(true)
      expect(lookup(definition.labelKey)).toBe(label)
    }
  })

  it('le texte du courrier de lancement est un texte long facultatif, sans défaut, juste après le texte de l’invitation', () => {
    expect(INVITATION_LETTER_TEXT_SETTING_KEY).toBe('invitation.letter_text')
    expect(letter).toMatchObject({
      type: 'text',
      required: false,
      multiline: true,
      maxLength: 2000,
      page: 'settings',
      section: 'invitation',
      whenEmptyKey: 'fields.invitationLetterText.whenEmpty',
    })
    expect(letter.default).toBeUndefined()
    const keys = ASSOCIATION_SETTINGS_REGISTRY.map(({key}) => key)
    expect(keys.indexOf(INVITATION_LETTER_TEXT_SETTING_KEY)).toBe(
      keys.indexOf(INVITATION_TEXT_SETTING_KEY) + 1
    )
    expect(parseSettingValue(letter, 'x'.repeat(2001))).toMatchObject({
      valid: false,
      error: {code: 'tooLong'},
    })
  })

  it('accesseur : texte absent → null, sinon la valeur du bureau', () => {
    expect(
      getInvitationLetterText(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBeNull()
    expect(
      getInvitationLetterText(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: INVITATION_LETTER_TEXT_SETTING_KEY, value: 'Le site est là.'},
        ])
      )
    ).toBe('Le site est là.')
  })

  it('libellés : le défaut du courrier ne promet aucun accès et ne porte aucun lien', () => {
    const fields = fr.AssociationSettings.fields as unknown as Record<
      string,
      {label: string; help: string; whenEmpty?: string; defaultText?: string}
    >
    const field = fields.invitationLetterText
    expect(field.label).toBe('Texte du courrier de lancement')
    expect(field.help).toContain('aucun lien de connexion')
    expect(field.whenEmpty).toContain('Laissé vide, le courrier reprend')
    const fallback = fr.CampaignsBureau.letters.pdf.memberInvitation.defaultText
    expect(field.whenEmpty).toContain(fallback.split('\n')[0])
    for (const forbidden of ['http', '/login', 'espace', 'connect']) {
      expect(fallback).not.toContain(forbidden)
    }
    expect(fields.invitationText.help).toContain('lancement')
    const cards = fr.BureauSettingsPage.cards as unknown as Record<
      string,
      {title: string; description: string}
    >
    expect(cards.invitation.description).toContain('lancement')
  })
})

describe('accès après la vente — réglage (s57, ADR 075)', () => {
  const months = definitionOf(
    ASSOCIATION_SETTINGS_REGISTRY,
    MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY
  )

  it('un entier de 1 à 60 mois, 6 par défaut, carte « Accès à l’espace membre »', () => {
    expect(MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY).toBe(
      'member.access_after_sale_months'
    )
    expect(months).toMatchObject({
      type: 'number',
      required: false,
      integer: true,
      min: 1,
      max: 60,
      default: {value: '6'},
      unitKey: 'units.months',
      page: 'settings',
      section: 'member_access',
      readOnlyHelpKey: 'campaignNature.superAdminOnly',
    })
  })

  it('refuse 0, un négatif, un décimal, du texte et plus de 60 ; accepte 1 et 60', () => {
    for (const raw of ['0', '-1', '1,5', '1.5', 'six']) {
      expect(parseSettingValue(months, raw), raw).toMatchObject({valid: false})
    }
    expect(parseSettingValue(months, '61')).toMatchObject({
      valid: false,
      error: {code: 'aboveMax', max: 60},
    })
    expect(parseSettingValue(months, '1')).toMatchObject({valid: true})
    expect(parseSettingValue(months, '60')).toMatchObject({valid: true})
  })

  it('un refus de saisie dit « un nombre entier de mois », le maximum garde le message commun', () => {
    expect(months.errorMessageKeys).toEqual({
      invalidNumber: 'fields.memberAccessAfterSaleMonths.errors.invalid',
      belowMin: 'fields.memberAccessAfterSaleMonths.errors.invalid',
    })
    const fields = fr.AssociationSettings.fields as unknown as Record<
      string,
      {label: string; help: string; errors?: Record<string, string>}
    >
    expect(fields.memberAccessAfterSaleMonths.errors?.invalid).toBe(
      'Saisissez un nombre entier de mois supérieur à 0.'
    )
    expect(fields.memberAccessAfterSaleMonths.label).toBe(
      'Délai d’accès après la vente'
    )
    expect(fields.memberAccessAfterSaleMonths.help).toContain('Par défaut : 6.')
    const units = fr.AssociationSettings.units as Record<string, string>
    expect(units.months).toBe('mois')
    const cards = fr.BureauSettingsPage.cards as unknown as Record<
      string,
      {title: string; description: string}
    >
    expect(cards.member_access.title).toBe('Accès à l’espace membre')
    expect(cards.member_access.description).toEqual(expect.any(String))
  })

  it('est réservé au SuperAdmin', () => {
    expect(isSuperAdminOnlySetting(months)).toBe(true)
  })

  it('accesseur : absent → 6, valeur enregistrée sinon', () => {
    expect(
      getMemberAccessAfterSaleMonths(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
      )
    ).toBe(6)
    expect(
      getMemberAccessAfterSaleMonths(
        resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY, value: '12'},
        ])
      )
    ).toBe(12)
  })
})
