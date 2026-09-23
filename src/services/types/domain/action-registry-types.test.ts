import {describe, expect, it} from 'vitest'

import {
  ACTION_REGISTRY,
  ActionIdConst,
  ActionRegistry,
  isActionAllowedForRole,
} from './action-registry-types'

/**
 * Preuve du critere 3 de s03b : un registre ad hoc, sans dependre du registre
 * de production.
 */
const testRegistry: ActionRegistry = [
  {id: 'test.action', defaultRoles: ['owner']},
]

describe('isActionAllowedForRole', () => {
  it('autorise un role present dans les roles par defaut', () => {
    expect(isActionAllowedForRole(testRegistry, 'test.action', 'owner')).toBe(
      true
    )
  })

  it('refuse un role absent des roles par defaut', () => {
    expect(isActionAllowedForRole(testRegistry, 'test.action', 'member')).toBe(
      false
    )
    expect(isActionAllowedForRole(testRegistry, 'test.action', 'board')).toBe(
      false
    )
  })

  it('refuse un actionId absent du registre — defaut ferme', () => {
    expect(
      isActionAllowedForRole(testRegistry, 'unknown.action', 'owner')
    ).toBe(false)
  })
})

describe('ACTION_REGISTRY — actualites (s05)', () => {
  it('news.manage autorise la Presidente et le bureau, refuse un membre', () => {
    expect(ActionIdConst.NEWS_MANAGE).toBe('news.manage')
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.NEWS_MANAGE,
        'owner'
      )
    ).toBe(true)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.NEWS_MANAGE,
        'board'
      )
    ).toBe(true)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.NEWS_MANAGE,
        'member'
      )
    ).toBe(false)
  })
})
