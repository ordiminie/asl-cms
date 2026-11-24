import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/server', () => ({after: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `MemberInvitationsBureau.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-invitation-campaign-service-facade', () => ({
  launchMemberInvitationsService: vi.fn(),
  remindNeverSignedInService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'
import {after} from 'next/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  launchMemberInvitationsService,
  remindNeverSignedInService,
} from '@/services/facades/member-invitation-campaign-service-facade'

import {
  launchMemberInvitationsAction,
  remindNeverSignedInAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const SUBMISSION_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'Clos-Fleuri',
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({} as never)
})

describe('launchMemberInvitationsAction (s42b)', () => {
  it('lance sur l’association du domaine, pose la livraison dans after(), relit la page', async () => {
    const deliver = vi.fn()
    vi.mocked(launchMemberInvitationsService).mockResolvedValue({
      status: 'created',
      campaignId: CAMPAIGN_ID,
      deliver,
    })

    await expect(launchMemberInvitationsAction()).resolves.toEqual({
      status: 'created',
      campaignId: CAMPAIGN_ID,
    })
    expect(requireActionAuth).toHaveBeenCalled()
    expect(launchMemberInvitationsService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
    })
    expect(after).toHaveBeenCalledWith(deliver)
    expect(revalidatePath).toHaveBeenCalledWith('/bureau/invitations')
    expect(deliver).not.toHaveBeenCalled()
  })

  it('un refus métier est rendu tel quel, rien n’est posé', async () => {
    vi.mocked(launchMemberInvitationsService).mockResolvedValue({
      status: 'already_launched',
      campaignId: CAMPAIGN_ID,
      sendDate: '2026-11-24',
      authorName: 'Anne Martin',
    })

    await expect(launchMemberInvitationsAction()).resolves.toEqual({
      status: 'already_launched',
      campaignId: CAMPAIGN_ID,
      sendDate: '2026-11-24',
      authorName: 'Anne Martin',
    })
    expect(after).not.toHaveBeenCalled()
  })

  it('un refus d’autorisation ou une panne devient une erreur lisible', async () => {
    vi.mocked(launchMemberInvitationsService).mockRejectedValueOnce(
      new AuthorizationError('refus')
    )
    await expect(launchMemberInvitationsAction()).resolves.toEqual({
      status: 'error',
      message: 'MemberInvitationsBureau.errors.forbidden',
    })

    vi.mocked(launchMemberInvitationsService).mockRejectedValueOnce(
      new Error('panne')
    )
    await expect(launchMemberInvitationsAction()).resolves.toEqual({
      status: 'error',
      message: 'MemberInvitationsBureau.errors.failed',
    })
  })

  it('une session absente : erreur, la façade n’est pas appelée', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(
      new AuthorizationError('session')
    )

    await expect(launchMemberInvitationsAction()).resolves.toMatchObject({
      status: 'error',
    })
    expect(launchMemberInvitationsService).not.toHaveBeenCalled()
  })
})

describe('remindNeverSignedInAction (s42b)', () => {
  it('relance avec la soumission reçue ; une relance rejouée ne repose aucune livraison', async () => {
    vi.mocked(remindNeverSignedInService).mockResolvedValue({
      status: 'created',
      campaignId: CAMPAIGN_ID,
      deliver: null,
    })

    await expect(remindNeverSignedInAction(SUBMISSION_ID)).resolves.toEqual({
      status: 'created',
      campaignId: CAMPAIGN_ID,
    })
    expect(remindNeverSignedInService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      submissionId: SUBMISSION_ID,
    })
    expect(after).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/bureau/invitations')
  })

  it('en cours : rendu tel quel', async () => {
    vi.mocked(remindNeverSignedInService).mockResolvedValue({
      status: 'in_progress',
    })

    await expect(remindNeverSignedInAction(SUBMISSION_ID)).resolves.toEqual({
      status: 'in_progress',
    })
  })
})
