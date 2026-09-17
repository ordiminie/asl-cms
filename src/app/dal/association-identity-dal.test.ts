import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/association-identity-service-facade', () => ({
  canManageAssociationIdentityService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {canManageAssociationIdentityService} from '@/services/facades/association-identity-service-facade'

import {canManageCurrentAssociationIdentityDal} from './association-identity-dal'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'ASL Les Pins',
    slug: 'asl-les-pins',
    domain: 'localhost',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })
})

describe('canManageCurrentAssociationIdentityDal', () => {
  it('juge l acces sur l association du domaine appele', async () => {
    vi.mocked(canManageAssociationIdentityService).mockResolvedValue(true)

    await expect(canManageCurrentAssociationIdentityDal()).resolves.toBe(true)
    expect(canManageAssociationIdentityService).toHaveBeenCalledWith(TENANT_ID)
  })

  it('rend le refus du service', async () => {
    vi.mocked(canManageAssociationIdentityService).mockResolvedValue(false)

    await expect(canManageCurrentAssociationIdentityDal()).resolves.toBe(false)
  })
})
