import {describe, expect, it} from 'vitest'

import {MemberAccountRole} from '../types/domain/member-account-types'
import {MemberRoleChangeInput} from '../types/domain/member-role-types'
import {
  decideMemberRemoval,
  decideRoleChange,
  roleCardFor,
} from './member-role-rules'

const input = (
  overrides: Partial<MemberRoleChangeInput>
): MemberRoleChangeInput => ({
  viewerRole: 'board',
  viewerIsSuperAdmin: false,
  targetRole: 'member',
  nextRole: 'board',
  isSelf: false,
  targetIsSuperAdmin: false,
  capableCount: 2,
  ...overrides,
})

const ROLES: MemberAccountRole[] = ['member', 'board', 'owner']

describe('decideRoleChange — valeurs refusées (critère 6)', () => {
  it.each(['super_admin', 'admin', '', 'OWNER', 'user'])(
    'refuse le rôle « %s »',
    (nextRole) => {
      expect(decideRoleChange(input({nextRole}))).toEqual({
        kind: 'refuse',
        reason: 'invalid_role',
      })
    }
  )

  it('refuse une valeur invalide même pour la Président(e)', () => {
    expect(
      decideRoleChange(input({viewerRole: 'owner', nextRole: 'super_admin'}))
    ).toEqual({kind: 'refuse', reason: 'invalid_role'})
  })
})

describe('decideRoleChange — le Bureau', () => {
  it('promeut un Membre au Bureau', () => {
    expect(decideRoleChange(input({}))).toEqual({kind: 'assign'})
  })

  it('rétrograde un autre membre du Bureau', () => {
    expect(
      decideRoleChange(input({targetRole: 'board', nextRole: 'member'}))
    ).toEqual({kind: 'demote'})
  })

  it('se rétrograde lui-même quand un autre compte capable reste', () => {
    expect(
      decideRoleChange(
        input({targetRole: 'board', nextRole: 'member', isSelf: true})
      )
    ).toEqual({kind: 'demote'})
  })

  it.each(ROLES)('ne touche jamais la Président(e) (vers %s)', (nextRole) => {
    expect(decideRoleChange(input({targetRole: 'owner', nextRole}))).toEqual({
      kind: 'refuse',
      reason: 'presidency_reserved',
    })
  })

  it.each(['member', 'board'] as const)(
    'n’attribue jamais la présidence (depuis %s)',
    (targetRole) => {
      expect(decideRoleChange(input({targetRole, nextRole: 'owner'}))).toEqual({
        kind: 'refuse',
        reason: 'presidency_reserved',
      })
    }
  )

  it('n’écrit rien quand le choix égale le rôle enregistré', () => {
    expect(
      decideRoleChange(input({targetRole: 'board', nextRole: 'board'}))
    ).toEqual({kind: 'none'})
    expect(
      decideRoleChange(input({targetRole: 'member', nextRole: 'member'}))
    ).toEqual({kind: 'none'})
  })
})

describe('decideRoleChange — le SuperAdmin agit comme le Bureau (D4)', () => {
  it('promeut un Membre au Bureau', () => {
    expect(
      decideRoleChange(input({viewerRole: null, viewerIsSuperAdmin: true}))
    ).toEqual({kind: 'assign'})
  })

  it.each([null, 'owner'] as const)(
    'ne transmet pas la présidence, même titulaire d’une ligne %s',
    (viewerRole) => {
      expect(
        decideRoleChange(
          input({viewerRole, viewerIsSuperAdmin: true, nextRole: 'owner'})
        )
      ).toEqual({kind: 'refuse', reason: 'presidency_reserved'})
    }
  )

  it('ne retire pas la présidence', () => {
    expect(
      decideRoleChange(
        input({
          viewerRole: null,
          viewerIsSuperAdmin: true,
          targetRole: 'owner',
          nextRole: 'board',
        })
      )
    ).toEqual({kind: 'refuse', reason: 'presidency_reserved'})
  })
})

describe('decideRoleChange — la Président(e)', () => {
  const owner = (overrides: Partial<MemberRoleChangeInput>) =>
    input({viewerRole: 'owner', ...overrides})

  it.each(['member', 'board'] as const)(
    'transmet la présidence à un %s',
    (targetRole) => {
      expect(decideRoleChange(owner({targetRole, nextRole: 'owner'}))).toEqual({
        kind: 'transfer_presidency',
      })
    }
  )

  it('transmet même quand elle est le seul compte capable', () => {
    expect(
      decideRoleChange(owner({nextRole: 'owner', capableCount: 1}))
    ).toEqual({kind: 'transfer_presidency'})
  })

  it('promeut et rétrograde comme le Bureau', () => {
    expect(decideRoleChange(owner({}))).toEqual({kind: 'assign'})
    expect(
      decideRoleChange(owner({targetRole: 'board', nextRole: 'member'}))
    ).toEqual({kind: 'demote'})
  })

  it.each(ROLES)('ne modifie pas son propre rôle (vers %s)', (nextRole) => {
    expect(
      decideRoleChange(owner({targetRole: 'owner', isSelf: true, nextRole}))
    ).toEqual({kind: 'refuse', reason: 'own_presidency'})
  })
})

describe('decideRoleChange — le dernier compte capable (critère 3)', () => {
  it.each(['board', 'owner'] as const)(
    'refuse de rétrograder le dernier compte %s',
    (targetRole) => {
      expect(
        decideRoleChange(
          input({
            viewerRole: 'owner',
            targetRole,
            nextRole: 'member',
            capableCount: 1,
          })
        )
      ).toEqual({kind: 'refuse', reason: 'last_capable'})
    }
  )

  it('refuse sa propre rétrogradation au dernier membre du Bureau', () => {
    expect(
      decideRoleChange(
        input({
          targetRole: 'board',
          nextRole: 'member',
          isSelf: true,
          capableCount: 1,
        })
      )
    ).toEqual({kind: 'refuse', reason: 'last_capable'})
  })

  it('refuse quand le décompte est déjà nul', () => {
    expect(
      decideRoleChange(
        input({targetRole: 'board', nextRole: 'member', capableCount: 0})
      )
    ).toEqual({kind: 'refuse', reason: 'last_capable'})
  })

  it('ne compte pas la promotion d’un Membre (le décompte monte)', () => {
    expect(decideRoleChange(input({capableCount: 1}))).toEqual({
      kind: 'assign',
    })
  })

  it.each([0, 1])(
    'rétrograde une cible SuperAdmin, hors décompte, même avec %i compte capable (revue 1)',
    (capableCount) => {
      expect(
        decideRoleChange(
          input({
            targetRole: 'board',
            nextRole: 'member',
            targetIsSuperAdmin: true,
            capableCount,
          })
        )
      ).toEqual({kind: 'demote'})
    }
  )

  it('rétrograde quand deux comptes capables restent', () => {
    expect(
      decideRoleChange(
        input({targetRole: 'board', nextRole: 'member', capableCount: 2})
      )
    ).toEqual({kind: 'demote'})
  })
})

describe('roleCardFor — la carte « Rôle dans l’association »', () => {
  const viewer = (
    role: MemberAccountRole | null,
    overrides: {isSuperAdmin?: boolean; isSelf?: boolean} = {}
  ) => ({role, isSuperAdmin: false, isSelf: false, ...overrides})

  it('fiche sans compte : aucun rôle possible, pas de bouton (A11)', () => {
    expect(roleCardFor(viewer('owner'), {role: null})).toEqual({
      reading: 'no_account',
      canEdit: false,
      notice: null,
      options: [],
      self: false,
    })
  })

  it.each(['member', 'board'] as const)(
    'le Bureau modifie une fiche %s, entre Membre et Bureau',
    (role) => {
      expect(roleCardFor(viewer('board'), {role})).toEqual({
        reading: role,
        canEdit: true,
        notice: null,
        options: ['member', 'board'],
        self: false,
      })
    }
  )

  it('le Bureau lit la fiche de la Président(e) sans bouton (A5)', () => {
    expect(roleCardFor(viewer('board'), {role: 'owner'})).toEqual({
      reading: 'owner',
      canEdit: false,
      notice: 'presidency_reserved',
      options: [],
      self: false,
    })
  })

  it('la Président(e) propose aussi la présidence (A6)', () => {
    expect(roleCardFor(viewer('owner'), {role: 'member'})).toEqual({
      reading: 'member',
      canEdit: true,
      notice: null,
      options: ['member', 'board', 'owner'],
      self: false,
    })
  })

  it('la Président(e) sur sa propre fiche : pas de bouton', () => {
    expect(
      roleCardFor(viewer('owner', {isSelf: true}), {role: 'owner'})
    ).toEqual({
      reading: 'owner',
      canEdit: false,
      notice: 'own_presidency',
      options: [],
      self: true,
    })
  })

  it('le Bureau sur sa propre fiche peut se rétrograder (A9)', () => {
    expect(
      roleCardFor(viewer('board', {isSelf: true}), {role: 'board'})
    ).toEqual({
      reading: 'board',
      canEdit: true,
      notice: null,
      options: ['member', 'board'],
      self: true,
    })
  })

  it('le SuperAdmin voit la carte comme le Bureau, même ligne owner', () => {
    expect(
      roleCardFor(viewer('owner', {isSuperAdmin: true}), {role: 'member'})
    ).toEqual({
      reading: 'member',
      canEdit: true,
      notice: null,
      options: ['member', 'board'],
      self: false,
    })
    expect(
      roleCardFor(viewer(null, {isSuperAdmin: true}), {role: 'owner'})
    ).toEqual({
      reading: 'owner',
      canEdit: false,
      notice: 'presidency_reserved',
      options: [],
      self: false,
    })
  })

  it('aucune option n’est jamais le SuperAdmin (critère 6)', () => {
    for (const viewerRole of ROLES) {
      for (const role of ROLES) {
        const card = roleCardFor(viewer(viewerRole), {role})
        expect(card.options.every((o) => ROLES.includes(o))).toBe(true)
      }
    }
  })
})

describe('decideMemberRemoval — retrait d’une ligne member (s14, D2)', () => {
  it.each(['board', 'owner'] as const)(
    'refuse de retirer le dernier compte %s',
    (targetRole) => {
      expect(decideMemberRemoval({targetRole, capableCount: 1})).toEqual({
        kind: 'refuse',
        reason: 'last_capable',
      })
    }
  )

  it('retire un compte capable quand un autre reste', () => {
    expect(decideMemberRemoval({targetRole: 'board', capableCount: 2})).toEqual(
      {kind: 'remove'}
    )
  })

  it('retire un simple membre quel que soit le décompte', () => {
    expect(
      decideMemberRemoval({targetRole: 'member', capableCount: 0})
    ).toEqual({kind: 'remove'})
  })
})
