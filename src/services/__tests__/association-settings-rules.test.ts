import {describe, expect, it} from 'vitest'

import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import fr from '../../../messages/fr.json'
import {
  ACCENT_HUE_SETTING_KEY,
  ACCENT_HUES,
  ASSOCIATION_DESCRIPTION_SETTING_KEY,
  ASSOCIATION_MEMBER_COUNT_SETTING_KEY,
  ASSOCIATION_SETTING_ERROR_CODES,
  ASSOCIATION_SETTINGS_REGISTRY,
  AssociationSettingDefinition,
  AssociationSettingsRegistry,
  CONTACT_EMAIL_SETTING_KEY,
  CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
  DEFAULT_ACCENT_HUE,
  extractGoogleVerificationCode,
  FORAGE_EMAIL_SETTING_KEY,
  getAccentHue,
  getAssociationDescription,
  getContactMessagesPerHourLimit,
  getGoogleVerificationCode,
  getMagicLinkDailyRequestLimit,
  getSettingsForPage,
  GOOGLE_VERIFICATION_SETTING_KEY,
  hasSettingReferenceCycle,
  MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
  parseSettingValue,
  resolveSettings,
  validateSettingsChanges,
} from '../types/domain/association-settings-types'
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
  it('declare les cles de s02, s03, s06, s08b et s11, avec leurs types et leur page', () => {
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
    ])
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

  it('chaque cle a son libelle et son aide dans les trois langues', () => {
    for (const messages of [fr, en, es]) {
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
    ])
    expect(
      getSettingsForPage(ASSOCIATION_SETTINGS_REGISTRY, 'identity').map(
        (definition) => definition.key
      )
    ).toEqual([ACCENT_HUE_SETTING_KEY])
  })

  it('chaque refus a un message explicite dans les trois langues', () => {
    for (const messages of [fr, en, es]) {
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
    ])
  })

  it('chaque phrase « Vide : » existe dans les trois langues', () => {
    for (const messages of [fr, en, es]) {
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
