import {describe, expect, it} from 'vitest'

import {createContactFormSchema} from './contact-form-validation'

const t = (key: string) => key

const valid = {
  name: '',
  email: 'claire.meunier@example.fr',
  subject: "Analyse d'eau",
  content: 'Bonjour ?',
}

const errorPathsOf = (input: Record<string, unknown>) => {
  const result = createContactFormSchema(t).safeParse(input)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      }))
}

describe('createContactFormSchema — décision D', () => {
  it('accepte un message court, le nom étant facultatif', () => {
    expect(errorPathsOf(valid)).toEqual([])
    expect(errorPathsOf({...valid, name: undefined})).toEqual([])
  })

  it('refuse un message vide ou fait d’espaces', () => {
    expect(errorPathsOf({...valid, content: '   \n  '})).toEqual([
      {field: 'content', message: 'validation.contentRequired'},
    ])
  })

  it('plafonne le message à 5 000 caractères', () => {
    expect(errorPathsOf({...valid, content: 'a'.repeat(5001)})).toEqual([
      {field: 'content', message: 'validation.contentMax'},
    ])
  })

  it('refuse un email mal formé, par son propre message', () => {
    expect(errorPathsOf({...valid, email: 'claire.meunier'})).toEqual([
      {field: 'email', message: 'validation.emailInvalid'},
    ])
  })

  it('plafonne le nom à 120 caractères', () => {
    expect(errorPathsOf({...valid, name: 'a'.repeat(121)})).toEqual([
      {field: 'name', message: 'validation.nameMax'},
    ])
  })

  it('garde un objet de 3 à 255 caractères', () => {
    expect(errorPathsOf({...valid, subject: 'ab'})).toEqual([
      {field: 'subject', message: 'validation.subjectRange'},
    ])
  })
})
