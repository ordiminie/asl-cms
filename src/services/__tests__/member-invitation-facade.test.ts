import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../member-invitation-service', () => ({
  inviteMemberProfileService: vi.fn(async () => ({
    status: 'sent',
    sent: ['jean.dubois@exemple.test'],
    deferred: [],
  })),
  recordFirstSignIn: vi.fn(),
}))

import {logger} from '@/lib/logger'

import * as memberInvitationFacade from '../facades/member-invitation-service-facade'

describe('façade de l’invitation d’un membre (s42a)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('expose l’invitation, jamais la trace de première connexion', () => {
    expect(Object.keys(memberInvitationFacade)).toEqual([
      'inviteMemberProfileService',
    ])
  })

  it('ne journalise ni les arguments ni le résultat', async () => {
    await memberInvitationFacade.inviteMemberProfileService({
      organizationId: '11111111-1111-4111-8111-111111111111',
      memberProfileId: '33333333-3333-4333-8333-333333333333',
    })

    const logged = JSON.stringify(
      Object.values(vi.mocked(logger)).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain('33333333-3333-4333-8333-333333333333')
    expect(logged).not.toContain('jean.dubois@exemple.test')
  })
})
