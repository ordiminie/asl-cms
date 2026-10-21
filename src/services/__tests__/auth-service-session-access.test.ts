import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Coupure a la lecture (s12d, ADR 038) : `getAuthUser()` applique a chaque
 * lecture la regle d'ouverture de session de l'ADR 034. Le module est
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

import {organizationOfRequest} from '@/lib/better-auth/association-membership'
import {auth} from '@/lib/better-auth/auth'

import type * as AuthService from '../authentication/auth-service'
import {Organization} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {userTest, userTestSuperAdmin} from './service-test-data'

const {getAuthUser} = await vi.importActual<typeof AuthService>(
  '../authentication/auth-service'
)

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'

const association = {
  id: ORG_ID,
  domain: 'clos-fleuri.test',
} as Organization

const memberOf = (organizationId: string): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role: 'member',
      createdAt: new Date(),
    },
  ],
})

const sessionOf = (user: User) => ({session: {userId: user.id}, user}) as never

beforeEach(() => {
  vi.clearAllMocks()
  requestHeaders.current = new Headers({host: 'clos-fleuri.test'})
  vi.mocked(organizationOfRequest).mockResolvedValue(association)
})

describe('getAuthUser — accès vérifié à chaque lecture (ADR 038)', () => {
  it('accepte un membre de l’association du domaine appelé', async () => {
    const member = memberOf(ORG_ID)
    vi.mocked(auth.api.getSession).mockResolvedValue(sessionOf(member))

    expect(await getAuthUser()).toEqual(member)
    expect(organizationOfRequest).toHaveBeenCalledWith('clos-fleuri.test')
  })

  it('refuse un compte qui n’a plus de ligne member ici, même avec une session ouverte', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(
      sessionOf(memberOf(OTHER_ORG_ID))
    )

    expect(await getAuthUser()).toBeUndefined()
  })

  it('accepte le SuperAdmin sur tout domaine, même sans association', async () => {
    vi.mocked(organizationOfRequest).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(
      sessionOf(userTestSuperAdmin)
    )

    expect(await getAuthUser()).toEqual(userTestSuperAdmin)
  })

  it('refuse tout autre compte sur un domaine sans association', async () => {
    vi.mocked(organizationOfRequest).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue(
      sessionOf(memberOf(ORG_ID))
    )

    expect(await getAuthUser()).toBeUndefined()
  })

  it('rend undefined sans session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    expect(await getAuthUser()).toBeUndefined()
  })
})
