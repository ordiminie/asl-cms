import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Qui agit (s48, ADR 041) : `getActingContext()` rend le compte vu et, pendant
 * une session a la place d'un compte, le SuperAdmin qui agit. Le module est
 * globalement simule par `setup-mocks.ts` : on charge ici le vrai.
 */

const requestHeaders = vi.hoisted(() => ({current: new Headers()}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => requestHeaders.current),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {getSession: vi.fn()}},
}))
vi.mock('@/lib/better-auth/association-membership', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/better-auth/association-membership')
  >()),
  organizationOfRequest: vi.fn(),
}))

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {organizationOfRequest} from '@/lib/better-auth/association-membership'
import {auth} from '@/lib/better-auth/auth'

import type * as AuthService from '../authentication/auth-service'
import {Organization} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {userTest, userTestSuperAdmin} from './service-test-data'

const {getActingContext} = await vi.importActual<typeof AuthService>(
  '../authentication/auth-service'
)

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const association = {id: ORG_ID, domain: 'clos-fleuri.test'} as Organization

const member: User = {
  ...userTest,
  name: 'Claire Montel',
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: userTest.id,
      role: 'owner',
      createdAt: new Date(),
    },
  ],
}

const sessionOf = (user: User, impersonatedBy?: string | null) =>
  ({session: {userId: user.id, impersonatedBy}, user}) as never

beforeEach(() => {
  vi.clearAllMocks()
  requestHeaders.current = new Headers({host: 'clos-fleuri.test'})
  vi.mocked(organizationOfRequest).mockResolvedValue(association)
})

describe('getActingContext (s48)', () => {
  it('hors imitation : le compte vu, sans imitateur', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(sessionOf(member, null))

    expect(await getActingContext()).toEqual({user: member})
    expect(getUserByIdDao).not.toHaveBeenCalled()
  })

  it('pendant l’imitation : le compte vu et le SuperAdmin qui agit', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(
      sessionOf(member, userTestSuperAdmin.id)
    )
    vi.mocked(getUserByIdDao).mockResolvedValue(userTestSuperAdmin as never)

    expect(await getActingContext()).toEqual({
      user: member,
      impersonator: {id: userTestSuperAdmin.id, name: userTestSuperAdmin.name},
    })
    expect(getUserByIdDao).toHaveBeenCalledWith(userTestSuperAdmin.id)
  })

  it('refuse d’attribuer à personne quand le compte imitateur a disparu', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(
      sessionOf(member, 'compte-disparu')
    )
    vi.mocked(getUserByIdDao).mockResolvedValue(undefined)

    await expect(getActingContext()).rejects.toThrow()
  })

  it('rend undefined sans session valable ici', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    expect(await getActingContext()).toBeUndefined()
  })
})
