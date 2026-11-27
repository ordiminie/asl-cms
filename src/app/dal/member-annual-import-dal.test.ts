import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-annual-import-service-facade', () => ({
  canImportMemberContactsService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {canImportMemberContactsService} from '@/services/facades/member-annual-import-service-facade'

import {canImportCurrentMemberContactsDal} from './member-annual-import-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('member-annual-import-dal', () => {
  it('demande au service si l’utilisateur peut importer sur l’association du domaine appelé', async () => {
    vi.mocked(canImportMemberContactsService).mockResolvedValue(true)

    await expect(canImportCurrentMemberContactsDal()).resolves.toBe(true)
    expect(canImportMemberContactsService).toHaveBeenCalledWith(ORG_A)
  })

  it('rend le refus du service tel quel', async () => {
    vi.mocked(canImportMemberContactsService).mockResolvedValue(false)

    await expect(canImportCurrentMemberContactsDal()).resolves.toBe(false)
  })
})
