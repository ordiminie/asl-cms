import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getActingContext: vi.fn(),
  getSessionAuth: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  getActingContext,
  getSessionAuth,
} from '@/services/authentication/auth-service'

import {getImpersonationBarDal} from './impersonation-dal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const EXPIRES_AT = new Date('2026-11-02T15:42:00.000Z')

const viewed = {
  id: 'compte-vise',
  name: 'Claire Montel',
  organizations: [{organizationId: ORG_ID, role: 'owner'}],
} as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue({
    id: ORG_ID,
    name: 'Rives Vertes',
  } as never)
  vi.mocked(getSessionAuth).mockResolvedValue({
    session: {expiresAt: EXPIRES_AT, impersonatedBy: 'superadmin'},
  } as never)
})

describe('getImpersonationBarDal (s48)', () => {
  it('hors imitation : rien à montrer', async () => {
    vi.mocked(getActingContext).mockResolvedValue({user: viewed})

    expect(await getImpersonationBarDal()).toBeNull()
  })

  it('sans session : rien à montrer', async () => {
    vi.mocked(getActingContext).mockResolvedValue(undefined)

    expect(await getImpersonationBarDal()).toBeNull()
  })

  it('pendant l’imitation : compte vu, rôle ici, association, fin de session', async () => {
    vi.mocked(getActingContext).mockResolvedValue({
      user: viewed,
      impersonator: {id: 'superadmin', name: 'Zoé Support'},
    })

    expect(await getImpersonationBarDal()).toEqual({
      subjectName: 'Claire Montel',
      role: 'owner',
      organizationName: 'Rives Vertes',
      expiresAt: EXPIRES_AT.toISOString(),
    })
  })
})
