import {describe, expect, it} from 'vitest'

import {TEST_SETTINGS_REGISTRY} from '@/services/__tests__/association-settings-test-registry'
import {getSettingsForPage} from '@/services/types/domain/association-settings-types'

import {
  createAssociationSettingsFormSchema,
  toSettingFieldName,
  toSettingKey,
} from './association-settings-form-validation'

const definitions = getSettingsForPage(TEST_SETTINGS_REGISTRY, 'settings')

const validValues = () =>
  Object.fromEntries(
    Object.entries({
      'test.required_email': 'secretariat@asl.test',
      'test.optional_email': '',
      'test.number': '12',
      'test.boolean': 'false',
      'test.choice_few': 'monthly',
      'test.choice_many': '',
    }).map(([key, value]) => [toSettingFieldName(key), value])
  )

describe('toSettingFieldName — nom de champ react-hook-form d une cle du registre', () => {
  it('ne contient aucun caractere que react-hook-form lit comme un chemin', () => {
    for (const key of ['contact.email', 'a[0].b', 'forage.responsable.email']) {
      expect(toSettingFieldName(key)).not.toMatch(/[.[\]]/)
    }
  })

  it('se retraduit exactement en la cle, sans collision', () => {
    const keys = ['contact.email', 'a%2Eb', 'a.b', 'a[0].b', 'test.choice_few']
    const names = keys.map(toSettingFieldName)

    expect(names.map(toSettingKey)).toEqual(keys)
    expect(new Set(names).size).toBe(keys.length)
  })
})

describe('createAssociationSettingsFormSchema — les regles du registre', () => {
  it('accepte des valeurs conformes au registre', () => {
    const schema = createAssociationSettingsFormSchema(definitions)

    expect(schema.safeParse(validValues()).success).toBe(true)
  })

  it('refuse avec le code du registre, sur le champ de la cle fautive', () => {
    const schema = createAssociationSettingsFormSchema(definitions)

    const result = schema.safeParse({
      ...validValues(),
      [toSettingFieldName('test.required_email')]: '  ',
      [toSettingFieldName('test.optional_email')]: 'tresorier@asl',
      [toSettingFieldName('test.number')]: '400',
      [toSettingFieldName('test.choice_many')]: 'center',
    })

    expect(result.success).toBe(false)
    const issues = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [
        issue.path.join('.'),
        issue.message,
      ])
    )
    expect(issues).toEqual({
      [toSettingFieldName('test.required_email')]: 'required',
      [toSettingFieldName('test.optional_email')]: 'invalidEmail',
      [toSettingFieldName('test.number')]: 'aboveMax',
      [toSettingFieldName('test.choice_many')]: 'invalidChoice',
    })
  })
})
