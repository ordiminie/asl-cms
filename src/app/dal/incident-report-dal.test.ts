import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/incident-report-service-facade', () => ({
  canManageIncidentReportsService: vi.fn(),
  getIncidentReportService: vi.fn(),
  getIncidentReportsPageService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageIncidentReportsService,
  getIncidentReportService,
  getIncidentReportsPageService,
} from '@/services/facades/incident-report-service-facade'

import {
  canManageCurrentReportsDal,
  getIncidentReportForBureauDal,
  getIncidentReportsForBureauDal,
} from './incident-report-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const REPORT_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('incident-report-dal', () => {
  it('rend la page de la file telle que le service la donne', async () => {
    const list = {
      items: [],
      page: 2,
      pageSize: 25,
      total: 26,
      totalPages: 2,
      counts: {reported: 1, in_progress: 0, resolved: 25},
    }
    vi.mocked(getIncidentReportsPageService).mockResolvedValue(list)

    await expect(getIncidentReportsForBureauDal(ORG_A, 2)).resolves.toBe(list)
    expect(getIncidentReportsPageService).toHaveBeenCalledWith(ORG_A, 2)
  })

  it.each([
    ['introuvable', new NotFoundError()],
    ['malformé', new ValidationParsedZodError()],
  ])(
    'traduit un signalement %s en undefined, que la page rend en 404',
    async (_label, error) => {
      vi.mocked(getIncidentReportService).mockRejectedValue(error)

      await expect(
        getIncidentReportForBureauDal(ORG_A, `${REPORT_ID}-${_label}`)
      ).resolves.toBeUndefined()
    }
  )

  it('laisse remonter un refus', async () => {
    vi.mocked(getIncidentReportService).mockRejectedValue(
      new AuthorizationError()
    )

    await expect(
      getIncidentReportForBureauDal(ORG_A, `${REPORT_ID}-refus`)
    ).rejects.toThrow(AuthorizationError)
  })

  it('demande au service si l’utilisateur suit les signalements du domaine appelé', async () => {
    vi.mocked(canManageIncidentReportsService).mockResolvedValue(true)

    await expect(canManageCurrentReportsDal()).resolves.toBe(true)
    expect(canManageIncidentReportsService).toHaveBeenCalledWith(ORG_A)
  })
})
