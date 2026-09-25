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

describe('ACTION_REGISTRY — fiches du bureau (s06)', () => {
  it('board.member.manage autorise la Presidente et le bureau', () => {
    expect(ActionIdConst.BOARD_MEMBER_MANAGE).toBe('board.member.manage')
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.BOARD_MEMBER_MANAGE,
        'owner'
      )
    ).toBe(true)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.BOARD_MEMBER_MANAGE,
        'board'
      )
    ).toBe(true)
  })

  it('refuse un membre simple et un role inconnu', () => {
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.BOARD_MEMBER_MANAGE,
        'member'
      )
    ).toBe(false)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.BOARD_MEMBER_MANAGE,
        'intruder' as never
      )
    ).toBe(false)
  })
})

describe('ACTION_REGISTRY — bandeau d alerte (s07)', () => {
  it('site.alert.manage autorise la Presidente et le bureau', () => {
    expect(ActionIdConst.SITE_ALERT_MANAGE).toBe('site.alert.manage')
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.SITE_ALERT_MANAGE,
        'owner'
      )
    ).toBe(true)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.SITE_ALERT_MANAGE,
        'board'
      )
    ).toBe(true)
  })

  it('refuse un membre simple', () => {
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.SITE_ALERT_MANAGE,
        'member'
      )
    ).toBe(false)
  })
})
