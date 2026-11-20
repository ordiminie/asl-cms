import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/campaign-letter-service-facade', () => ({
  getLetterCalibrationPdfService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {getLetterCalibrationPdfService} from '@/services/facades/campaign-letter-service-facade'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue({
    id: ORG_ID,
    name: 'ASL Les Pins',
    slug: 'asl-les-pins',
    domain: 'asl-les-pins.test',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })
  vi.mocked(getLetterCalibrationPdfService).mockResolvedValue(
    new TextEncoder().encode('%PDF-calage')
  )
})

describe('GET /api/campaigns/calage — la page de calage (ADR 067 §4)', () => {
  it('rend la page de calage de l’association du domaine, en pièce jointe, sans cache', async () => {
    const response = await GET()

    expect(getLetterCalibrationPdfService).toHaveBeenCalledWith(ORG_ID)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="page-de-calage.pdf"'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.text()).toBe('%PDF-calage')
  })

  it('aucune association sur ce domaine : 404', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined as never)

    const response = await GET()
    expect(response.status).toBe(404)
    expect(getLetterCalibrationPdfService).not.toHaveBeenCalled()
  })

  it('sans le droit campaign.manage : 403, sans détail', async () => {
    vi.mocked(getLetterCalibrationPdfService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    const response = await GET()
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('')
  })
})
