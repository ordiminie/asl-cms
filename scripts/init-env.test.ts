import {describe, expect, it} from 'vitest'

import {generateDefaultValue, getVariableExample} from './init-env'

describe('init-env — changement d’adresse fermé par défaut (s12d, tâche 7)', () => {
  it('propose false pour NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL', () => {
    expect(generateDefaultValue('NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL')).toBe(
      'false'
    )
    expect(getVariableExample('NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL')).toBe(
      'false'
    )
  })

  it('laisse le changement de mot de passe ouvert par défaut', () => {
    expect(
      generateDefaultValue('NEXT_PUBLIC_BETTER_AUTH_CHANGE_PASSWORD')
    ).toBe('true')
  })
})
