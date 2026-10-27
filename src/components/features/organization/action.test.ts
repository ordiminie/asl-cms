import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/headers', () => ({headers: vi.fn(async () => new Headers())}))
vi.mock('@/app/dal/user-dal', () => ({
  requireActionAuth: vi.fn(async () => ({id: 'user-1'})),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {createInvitation: vi.fn(async () => ({ok: true}))}},
}))
vi.mock('@/lib/helper/subscription-helper', () => ({
  getReferenceIdByBillingMode: vi.fn(() => 'reference'),
}))
vi.mock('@/services/authorization/organization-authorization', () => ({
  canInviteToOrganization: vi.fn(async () => true),
  checkMembersLimit: vi.fn(async () => ({allowed: true})),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  createOrganizationMemberService: vi.fn(),
  removeUserFromOrganizationService: vi.fn(),
  updateOrganizationService: vi.fn(),
}))
vi.mock('@/services/user-service', () => ({getUserByEmailService: vi.fn()}))

import {auth} from '@/lib/better-auth/auth'
import {createOrganizationMemberService} from '@/services/facades/organization-service-facade'

import {addUserToOrganizationAction} from './action'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '33333333-3333-4333-8333-333333333333'

const callWithForgedRole = (role: string, sendInvitationEmail: boolean) =>
  (addUserToOrganizationAction as (...args: unknown[]) => Promise<unknown>)(
    ORG_ID,
    USER_ID,
    'm@asl.test',
    sendInvitationEmail,
    role
  )

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * s14, ADR 039 : un ajout de membre ne pose jamais un role du bureau. Un role
 * ne se pose que depuis la fiche du membre, par le service trace.
 */
describe('addUserToOrganizationAction — rôle Membre seulement (s14)', () => {
  it.each(['owner', 'board'])(
    'ignore un rôle « %s » forgé à l’ajout direct',
    async (role) => {
      await callWithForgedRole(role, false)

      expect(createOrganizationMemberService).toHaveBeenCalledWith(
        expect.objectContaining({role: 'member'})
      )
    }
  )

  it('ignore un rôle forgé dans une invitation', async () => {
    await callWithForgedRole('owner', true)

    expect(auth.api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({role: 'member'}),
      })
    )
  })
})
