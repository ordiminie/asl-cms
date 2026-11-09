import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/member-space-service-facade', () => ({
  getMyContactService: vi.fn(),
  getMyParcelsService: vi.fn(),
  isPlainMemberOfService: vi.fn(),
}))
vi.mock('@/services/facades/incident-report-service-facade', () => ({
  getMyIncidentReportsService: vi.fn(),
  getMyReportIdentityService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  getMyIncidentReportsService,
  getMyReportIdentityService,
} from '@/services/facades/incident-report-service-facade'

import {
  getMyIncidentReportsDal,
  getMyReportIdentityDal,
} from './member-space-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('member-space-dal — signalements du membre (s22)', () => {
  it('lit « Mes signalements » sur l’association du domaine, avec son seul identifiant', async () => {
    const reports = [
      {
        id: 'r1',
        categoryName: null,
        location: 'Portail',
        status: 'reported' as const,
        createdAt: new Date(),
        updatedAt: null,
      },
    ]
    vi.mocked(getMyIncidentReportsService).mockResolvedValue(reports)

    await expect(getMyIncidentReportsDal()).resolves.toBe(reports)
    expect(getMyIncidentReportsService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit l’identité transmise au bureau sur l’association du domaine, avec son seul identifiant', async () => {
    const identity = {name: 'Lucie Moreau', email: null, phone: null}
    vi.mocked(getMyReportIdentityService).mockResolvedValue(identity)

    await expect(getMyReportIdentityDal()).resolves.toBe(identity)
    expect(getMyReportIdentityService).toHaveBeenCalledWith(ORG_A)
  })
})
