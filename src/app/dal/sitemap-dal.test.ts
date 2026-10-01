import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/sitemap-service-facade', () => ({
  getPublishedSitemapEntriesService: vi.fn(async () => ({
    pages: [],
    news: [],
  })),
}))

import {getPublishedSitemapEntriesService} from '@/services/facades/sitemap-service-facade'

import {getPublishedSitemapEntriesDal} from './sitemap-dal'

describe('getPublishedSitemapEntriesDal (s11)', () => {
  it('lit le contenu publie de l association demandee, par le service public', async () => {
    const ORG_ID = '11111111-1111-4111-8111-111111111111'

    expect(await getPublishedSitemapEntriesDal(ORG_ID)).toEqual({
      pages: [],
      news: [],
    })
    expect(getPublishedSitemapEntriesService).toHaveBeenCalledWith(ORG_ID)
  })
})
