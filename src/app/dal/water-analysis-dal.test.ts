import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/water-analysis-service-facade', () => ({
  canManageWaterAnalysisService: vi.fn(),
  getPublicWaterAnalysesPageService: vi.fn(),
  getPublicWaterAnalysisPageCountService: vi.fn(),
  getWaterAnalysesForBureauService: vi.fn(),
  getWaterAnalysisForBureauService: vi.fn(),
}))

import {cacheTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  canManageWaterAnalysisService,
  getPublicWaterAnalysesPageService,
  getPublicWaterAnalysisPageCountService,
  getWaterAnalysisForBureauService,
} from '@/services/facades/water-analysis-service-facade'
import {WaterAnalysisListPageDTO} from '@/services/types/domain/water-analysis-types'

import {
  canManageCurrentWaterAnalysisDal,
  getPublicWaterAnalysesPageDal,
  getPublicWaterAnalysisPageCountDal,
  getWaterAnalysisForBureauDal,
  waterAnalysisFileUrl,
  waterAnalysisListTag,
} from './water-analysis-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const page: WaterAnalysisListPageDTO = {
  items: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      organizationId: ORG_A,
      sampledOn: '2026-09-02',
      posterKey: `${ORG_A}/water-analysis/x/poster-1.png`,
      reportKey: `${ORG_A}/water-analysis/x/report-1.pdf`,
      reportBytes: 327_680,
      content: '',
      createdAt: new Date('2026-09-02'),
      updatedAt: new Date('2026-09-02'),
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
  totalPages: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicWaterAnalysesPageService).mockResolvedValue(page)
})

describe('tag de cache', () => {
  it('un tag de liste par association', () => {
    expect(waterAnalysisListTag(ORG_A)).toBe(`water-analysis:${ORG_A}`)
    expect(waterAnalysisListTag(ORG_A)).not.toBe(waterAnalysisListTag(ORG_B))
  })
})

describe('getPublicWaterAnalysesPageDal', () => {
  it('rend ce que rend le service public de cette association, sous son tag', async () => {
    expect(await getPublicWaterAnalysesPageDal(ORG_A, 1)).toEqual(page)
    expect(getPublicWaterAnalysesPageService).toHaveBeenCalledWith(ORG_A, 1)
    expect(cacheTag).toHaveBeenCalledWith(waterAnalysisListTag(ORG_A))
  })
})

describe('getPublicWaterAnalysisPageCountDal', () => {
  it('vaut 1 sur une liste vide, sans lire la liste', async () => {
    vi.mocked(getPublicWaterAnalysisPageCountService).mockResolvedValue(1)

    expect(await getPublicWaterAnalysisPageCountDal(ORG_A)).toBe(1)
    expect(getPublicWaterAnalysisPageCountService).toHaveBeenCalledWith(ORG_A)
    expect(cacheTag).toHaveBeenCalledWith(waterAnalysisListTag(ORG_A))
    expect(getPublicWaterAnalysesPageService).not.toHaveBeenCalled()
  })
})

describe('getWaterAnalysisForBureauDal', () => {
  it("rend undefined quand l'analyse n'existe pas", async () => {
    vi.mocked(getWaterAnalysisForBureauService).mockRejectedValue(
      new NotFoundError("Analyse d'eau introuvable")
    )

    expect(
      await getWaterAnalysisForBureauDal(
        ORG_A,
        '44444444-4444-4444-8444-444444444444'
      )
    ).toBeUndefined()
  })

  it('laisse remonter toute autre erreur', async () => {
    vi.mocked(getWaterAnalysisForBureauService).mockRejectedValue(
      new Error('connexion perdue')
    )

    await expect(
      getWaterAnalysisForBureauDal(
        ORG_A,
        '55555555-5555-4555-8555-555555555555'
      )
    ).rejects.toThrow('connexion perdue')
  })
})

describe('canManageCurrentWaterAnalysisDal', () => {
  it("interroge le service pour l'association du domaine appelé", async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
    vi.mocked(canManageWaterAnalysisService).mockResolvedValue(true)

    expect(await canManageCurrentWaterAnalysisDal()).toBe(true)
    expect(canManageWaterAnalysisService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('waterAnalysisFileUrl', () => {
  it('pointe vers la route de fichiers de contenu', () => {
    expect(
      waterAnalysisFileUrl(`${ORG_A}/water-analysis/abc/report-1.pdf`)
    ).toBe(`/api/files/${ORG_A}/water-analysis/abc/report-1.pdf`)
  })
})
