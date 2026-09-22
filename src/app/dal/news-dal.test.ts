import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/news-service-facade', () => ({
  canManageNewsService: vi.fn(),
  getNewsBySlugService: vi.fn(),
  getNewsForBureauService: vi.fn(),
  getNewsItemForBureauService: vi.fn(),
  getPublishedNewsPageService: vi.fn(),
}))

import {NotFoundError} from '@/services/errors/not-found-error'
import {
  getNewsBySlugService,
  getNewsItemForBureauService,
  getPublishedNewsPageService,
} from '@/services/facades/news-service-facade'
import {NewsDTO, NewsStatus} from '@/services/types/domain/news-types'

import {
  getNewsBySlugForPreviewDal,
  getNewsItemForBureauDal,
  getPublicNewsBySlugDal,
  getPublicNewsPageDal,
  newsImageUrl,
  newsItemTag,
  newsListTag,
} from './news-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const newsOf = (status: NewsStatus): NewsDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_A,
  slug: 'assemblee-generale',
  title: 'Assemblée générale',
  publishedOn: '2026-10-10',
  imageKey: null,
  imageAlt: '',
  content: 'Rendez-vous le 10 octobre.',
  status,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublishedNewsPageService).mockResolvedValue({
    items: [newsOf('published')],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  })
})

describe('tags de cache', () => {
  it('un tag de liste par association, un tag par actualité', () => {
    expect(newsListTag(ORG_A)).toBe(`news:${ORG_A}`)
    expect(newsListTag(ORG_A)).not.toBe(newsListTag(ORG_B))
    expect(newsItemTag(ORG_A, 'assemblee-generale')).toBe(
      `news:${ORG_A}:assemblee-generale`
    )
  })
})

describe('getPublicNewsBySlugDal — le visiteur ne voit que les publiées', () => {
  it.each([['draft'], ['unpublished']] as const)(
    'une actualité %s n’existe pas pour le site public',
    async (status) => {
      vi.mocked(getNewsBySlugService).mockResolvedValue(newsOf(status))

      expect(
        await getPublicNewsBySlugDal(ORG_A, 'assemblee-generale')
      ).toBeUndefined()
    }
  )

  it('rend une actualité publiée', async () => {
    vi.mocked(getNewsBySlugService).mockResolvedValue(newsOf('published'))

    const item = await getPublicNewsBySlugDal(ORG_A, 'assemblee-generale')

    expect(item?.title).toBe('Assemblée générale')
    expect(getNewsBySlugService).toHaveBeenCalledWith(
      ORG_A,
      'assemblee-generale'
    )
  })

  it('un slug inconnu ne rend rien', async () => {
    vi.mocked(getNewsBySlugService).mockResolvedValue(undefined)

    expect(await getPublicNewsBySlugDal(ORG_A, 'inconnue')).toBeUndefined()
  })

  it("l'aperçu du bureau rend le brouillon, lui, et sans cache", async () => {
    vi.mocked(getNewsBySlugService).mockResolvedValue(newsOf('draft'))

    const item = await getNewsBySlugForPreviewDal(ORG_A, 'assemblee-generale')

    expect(item?.status).toBe('draft')
  })
})

describe('getPublicNewsPageDal', () => {
  it('demande la page au service public de cette association', async () => {
    const page = await getPublicNewsPageDal(ORG_A, 2)

    expect(getPublishedNewsPageService).toHaveBeenCalledWith(ORG_A, 2)
    expect(page.items).toHaveLength(1)
  })
})

describe('getNewsItemForBureauDal', () => {
  it("rend undefined quand l'actualité n'existe pas", async () => {
    vi.mocked(getNewsItemForBureauService).mockRejectedValue(
      new NotFoundError('Actualité introuvable')
    )

    expect(
      await getNewsItemForBureauDal(
        ORG_A,
        '44444444-4444-4444-8444-444444444444'
      )
    ).toBeUndefined()
  })

  it('laisse remonter toute autre erreur, au lieu de la déguiser en 404', async () => {
    vi.mocked(getNewsItemForBureauService).mockRejectedValue(
      new Error('connexion à la base perdue')
    )

    await expect(
      getNewsItemForBureauDal(ORG_A, '55555555-5555-4555-8555-555555555555')
    ).rejects.toThrow('connexion à la base perdue')
  })
})

describe('newsImageUrl', () => {
  it('pointe vers la route de fichiers de contenu', () => {
    expect(newsImageUrl(`${ORG_A}/news/abc/image-1.png`)).toBe(
      `/api/files/${ORG_A}/news/abc/image-1.png`
    )
  })
})
