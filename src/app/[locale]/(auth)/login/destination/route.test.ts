import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getAuthUser} from '@/services/authentication/auth-service'

import {GET} from './route'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const tenantA = {
  id: ORG_A,
  name: 'ASL A',
  slug: 'asl-a',
  domain: 'localhost',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const accountOf = (role: string, memberships: [string, string][] = []) => ({
  id: 'user-1',
  role,
  organizations: memberships.map(([organizationId, memberRole]) => ({
    organizationId,
    role: memberRole,
  })),
})

const call = () => GET()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantA)
})

describe('GET /login/destination (s46b, décision F)', () => {
  it.each([
    ['le SuperAdmin', accountOf('super_admin'), '/admin'],
    [
      'le SuperAdmin membre de l’association',
      accountOf('super_admin', [[ORG_A, 'owner']]),
      '/admin',
    ],
    ['la Présidence', accountOf('user', [[ORG_A, 'owner']]), '/bureau'],
    ['le bureau', accountOf('user', [[ORG_A, 'board']]), '/bureau'],
    [
      'le bureau d’une autre association',
      accountOf('user', [[ORG_B, 'board']]),
      '/dashboard',
    ],
    ['un membre', accountOf('user', [[ORG_A, 'member']]), '/dashboard'],
  ])('envoie %s vers %s en 307', async (_, user, path) => {
    vi.mocked(getAuthUser).mockResolvedValue(user as never)

    const response = await call()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe(path)
  })

  it('renvoie vers /login sans session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)

    const response = await call()

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('/login')
  })

  it('envoie le bureau à l’espace membre sur un domaine sans association', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)
    vi.mocked(getAuthUser).mockResolvedValue(
      accountOf('user', [[ORG_A, 'owner']]) as never
    )

    const response = await call()

    expect(response.headers.get('Location')).toBe('/dashboard')
  })
})
