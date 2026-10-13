import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/page-service-facade', () => ({
  canManagePagesService: vi.fn(),
  getPageBySlugService: vi.fn(),
  getPageForBureauService: vi.fn(),
  getPagesForBureauService: vi.fn(),
}))
vi.mock('@/services/facades/home-page-service-facade', () => ({
  canManageHomePageService: vi.fn(),
  getHomePageForBureauService: vi.fn(),
  getPublicHomePageService: vi.fn(),
  setHomePageService: vi.fn(),
}))

import {cacheTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageHomePageService,
  getHomePageForBureauService,
  getPublicHomePageService,
} from '@/services/facades/home-page-service-facade'
import {PageStatus, PageWithBlocksDTO} from '@/services/types/domain/page-types'

import {
  canManageCurrentHomePageDal,
  getCurrentPublicHomePageDal,
  getHomePageForBureauDal,
  getPublicHomePageDal,
  homePageTag,
} from './home-page-dal'
import {pageTag} from './page-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const pageOf = (status: PageStatus): PageWithBlocksDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_A,
  slug: 'bienvenue',
  title: 'Bienvenue',
  status,
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  blocks: [],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('homePageTag', () => {
  it('un tag par association, distinct de celui des pages', () => {
    expect(homePageTag(ORG_A)).toBe(`home-page:${ORG_A}`)
    expect(homePageTag(ORG_A)).not.toBe(homePageTag(ORG_B))
  })
})

describe('getPublicHomePageDal', () => {
  it('sert la page désignée publiée', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(pageOf('published'))

    const page = await getPublicHomePageDal(ORG_A)

    expect(page?.slug).toBe('bienvenue')
    expect(getPublicHomePageService).toHaveBeenCalledWith(ORG_A)
  })

  it('ne sert pas un brouillon', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(pageOf('draft'))

    expect(await getPublicHomePageDal(ORG_A)).toBeUndefined()
  })

  it('ne sert pas une page dépubliée', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(pageOf('unpublished'))

    expect(await getPublicHomePageDal(ORG_A)).toBeUndefined()
  })

  it('sans page désignée : undefined', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(undefined)

    expect(await getPublicHomePageDal(ORG_A)).toBeUndefined()
  })

  it('pose le tag de l accueil et celui de la page, même en brouillon', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(pageOf('draft'))

    await getPublicHomePageDal(ORG_A)

    const tags = vi.mocked(cacheTag).mock.calls.flat()
    expect(tags).toContain(homePageTag(ORG_A))
    expect(tags).toContain(pageTag(ORG_A, 'bienvenue'))
  })

  it('sans page désignée : seulement le tag de l accueil', async () => {
    vi.mocked(getPublicHomePageService).mockResolvedValue(undefined)

    await getPublicHomePageDal(ORG_A)

    const tags = vi.mocked(cacheTag).mock.calls.flat()
    expect(tags).toEqual([homePageTag(ORG_A)])
  })
})

describe('getCurrentPublicHomePageDal', () => {
  it('lit l accueil de l association du domaine appelé', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({
      id: ORG_B,
    } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
    vi.mocked(getPublicHomePageService).mockResolvedValue(undefined)

    await getCurrentPublicHomePageDal()

    expect(getPublicHomePageService).toHaveBeenCalledWith(ORG_B)
  })
})

describe('lectures du bureau', () => {
  it('getHomePageForBureauDal passe par la facade', async () => {
    vi.mocked(getHomePageForBureauService).mockResolvedValue({page: null})

    expect(await getHomePageForBureauDal(ORG_A)).toEqual({page: null})
    expect(getHomePageForBureauService).toHaveBeenCalledWith(ORG_A)
  })

  it('canManageCurrentHomePageDal vérifie sur l association du domaine', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({
      id: ORG_A,
    } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
    vi.mocked(canManageHomePageService).mockResolvedValue(true)

    expect(await canManageCurrentHomePageDal()).toBe(true)
    expect(canManageHomePageService).toHaveBeenCalledWith(ORG_A)
  })
})
