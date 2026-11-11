import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/campaign-service-facade', () => ({
  canManageCampaignsService: vi.fn(),
  getCampaignComposerContextService: vi.fn(),
  listCampaignsService: vi.fn(),
  getCampaignService: vi.fn(),
}))
vi.mock('@/services/facades/unsubscribe-service-facade', () => ({
  getUnsubscribePageStateService: vi.fn(),
  getMemberUnsubscribeService: vi.fn(),
}))

import {
  canManageCampaignsService,
  getCampaignComposerContextService,
  getCampaignService,
  listCampaignsService,
} from '@/services/facades/campaign-service-facade'
import {
  getMemberUnsubscribeService,
  getUnsubscribePageStateService,
} from '@/services/facades/unsubscribe-service-facade'

import {
  canManageCurrentCampaignsDal,
  getCampaignComposerContextDal,
  getCampaignDal,
  getCampaignsPageDal,
} from './campaign-dal'
import {requireCurrentTenantDal} from './tenant-dal'
import {
  getMemberUnsubscribeForBureauDal,
  getUnsubscribePageStateDal,
} from './unsubscribe-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const TOKEN = 'A'.repeat(43)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('campaign-dal (s25)', () => {
  it('lit le contexte du composeur pour le tenant passé', async () => {
    const context = {associationName: 'ASL Les Pins'}
    vi.mocked(getCampaignComposerContextService).mockResolvedValue(
      context as never
    )

    await expect(getCampaignComposerContextDal(ORG_A)).resolves.toBe(context)
    expect(getCampaignComposerContextService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit une page de l’archive', async () => {
    const page = {items: [], page: 2, pageSize: 25, total: 26, totalPages: 2}
    vi.mocked(listCampaignsService).mockResolvedValue(page)

    await expect(getCampaignsPageDal(ORG_A, 2)).resolves.toBe(page)
    expect(listCampaignsService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      page: 2,
    })
  })

  it('lit une campagne', async () => {
    vi.mocked(getCampaignService).mockResolvedValue({status: 'not_found'})

    await expect(getCampaignDal(ORG_A, CAMPAIGN_ID)).resolves.toEqual({
      status: 'not_found',
    })
    expect(getCampaignService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      campaignId: CAMPAIGN_ID,
    })
  })

  it('dit si le compte gère les campagnes de l’association du domaine', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
    vi.mocked(canManageCampaignsService).mockResolvedValue(false)

    await expect(canManageCurrentCampaignsDal()).resolves.toBe(false)
    expect(canManageCampaignsService).toHaveBeenCalledWith(ORG_A)
  })

  it('laisse remonter un refus d’autorisation', async () => {
    const refusal = new Error('refus')
    vi.mocked(listCampaignsService).mockRejectedValue(refusal)

    await expect(getCampaignsPageDal(ORG_A, 1)).rejects.toBe(refusal)
  })
})

describe('unsubscribe-dal (s25)', () => {
  it('lit l’état de la page du jeton, dans le tenant passé', async () => {
    vi.mocked(getUnsubscribePageStateService).mockResolvedValue({
      status: 'confirm',
    })

    await expect(getUnsubscribePageStateDal(ORG_A, TOKEN)).resolves.toEqual({
      status: 'confirm',
    })
    expect(getUnsubscribePageStateService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      token: TOKEN,
    })
  })
})

describe('unsubscribe-dal — mention sur la fiche (s25)', () => {
  const PROFILE_ID = '44444444-4444-4444-8444-444444444444'

  it('lit le refus de la fiche par le service', async () => {
    vi.mocked(getMemberUnsubscribeService).mockResolvedValue({
      createdAt: '2026-11-12T13:32:00.000Z',
    })

    await expect(
      getMemberUnsubscribeForBureauDal(ORG_A, PROFILE_ID)
    ).resolves.toEqual({createdAt: '2026-11-12T13:32:00.000Z'})
    expect(getMemberUnsubscribeService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      memberProfileId: PROFILE_ID,
    })
  })

  it('un refus d’accès ou une panne n’affiche aucune mention', async () => {
    vi.mocked(getMemberUnsubscribeService).mockRejectedValue(new Error('refus'))

    await expect(
      getMemberUnsubscribeForBureauDal(ORG_A, PROFILE_ID)
    ).resolves.toBeNull()
  })
})

describe('donnée personnelle : jamais de « use cache » (ADR 038)', () => {
  it.each(['campaign-dal.ts', 'unsubscribe-dal.ts'])('%s', (file) => {
    const source = readFileSync(path.resolve(import.meta.dirname, file), 'utf8')
    expect(source).not.toMatch(/['"]use cache/)
    expect(source).not.toContain('unstable_cache')
  })
})
