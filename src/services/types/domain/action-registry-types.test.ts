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

describe("ACTION_REGISTRY — analyses d'eau (s09)", () => {
  it('water.analysis.manage autorise la Presidente et le bureau', () => {
    expect(ActionIdConst.WATER_ANALYSIS_MANAGE).toBe('water.analysis.manage')
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.WATER_ANALYSIS_MANAGE,
        'owner'
      )
    ).toBe(true)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.WATER_ANALYSIS_MANAGE,
        'board'
      )
    ).toBe(true)
  })

  it('refuse un membre simple et un role inconnu', () => {
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.WATER_ANALYSIS_MANAGE,
        'member'
      )
    ).toBe(false)
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.WATER_ANALYSIS_MANAGE,
        'intruder' as never
      )
    ).toBe(false)
  })
})

describe('ACTION_REGISTRY — factures des membres (s19, ADR 059)', () => {
  it('member.invoice.manage autorise la Presidente et le bureau, refuse un membre simple', () => {
    expect(ActionIdConst.INVOICE_MANAGE).toBe('member.invoice.manage')
    for (const role of ['owner', 'board'] as const) {
      expect(
        isActionAllowedForRole(
          ACTION_REGISTRY,
          ActionIdConst.INVOICE_MANAGE,
          role
        ),
        role
      ).toBe(true)
    }
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.INVOICE_MANAGE,
        'member'
      )
    ).toBe(false)
  })
})

describe('ACTION_REGISTRY — documents partagés (s31, ADR 069)', () => {
  it('shared.document.manage autorise la Presidente et le bureau, refuse un membre simple', () => {
    expect(ActionIdConst.SHARED_DOCUMENT_MANAGE).toBe('shared.document.manage')
    for (const role of ['owner', 'board'] as const) {
      expect(
        isActionAllowedForRole(
          ACTION_REGISTRY,
          ActionIdConst.SHARED_DOCUMENT_MANAGE,
          role
        ),
        role
      ).toBe(true)
    }
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.SHARED_DOCUMENT_MANAGE,
        'member'
      )
    ).toBe(false)
  })

  it('shared.document.read autorise tout membre de l association', () => {
    expect(ActionIdConst.SHARED_DOCUMENT_READ).toBe('shared.document.read')
    for (const role of ['owner', 'board', 'member'] as const) {
      expect(
        isActionAllowedForRole(
          ACTION_REGISTRY,
          ActionIdConst.SHARED_DOCUMENT_READ,
          role
        ),
        role
      ).toBe(true)
    }
  })
})

describe('ACTION_REGISTRY — documents nominatifs (s32, ADR 073)', () => {
  it('member.document.manage autorise la Presidente et le bureau, refuse un membre simple', () => {
    expect(ActionIdConst.MEMBER_DOCUMENT_MANAGE).toBe('member.document.manage')
    for (const role of ['owner', 'board'] as const) {
      expect(
        isActionAllowedForRole(
          ACTION_REGISTRY,
          ActionIdConst.MEMBER_DOCUMENT_MANAGE,
          role
        ),
        role
      ).toBe(true)
    }
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.MEMBER_DOCUMENT_MANAGE,
        'member'
      )
    ).toBe(false)
  })

  it("n'ajoute aucune action de lecture : la lecture membre passe par la possession", () => {
    expect(Object.values(ActionIdConst)).not.toContain('member.document.read')
  })
})

describe('ACTION_REGISTRY — modèles de documents (s36, ADR 074)', () => {
  it('document.template.manage autorise la Présidente et le bureau, refuse un membre simple', () => {
    expect(ActionIdConst.DOCUMENT_TEMPLATE_MANAGE).toBe(
      'document.template.manage'
    )
    for (const role of ['owner', 'board'] as const) {
      expect(
        isActionAllowedForRole(
          ACTION_REGISTRY,
          ActionIdConst.DOCUMENT_TEMPLATE_MANAGE,
          role
        ),
        role
      ).toBe(true)
    }
    expect(
      isActionAllowedForRole(
        ACTION_REGISTRY,
        ActionIdConst.DOCUMENT_TEMPLATE_MANAGE,
        'member'
      )
    ).toBe(false)
  })
})
