import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/page-repository', () => ({
  getPublishedPagesForSitemapDao: vi.fn(),
}))
vi.mock('@/db/repositories/news-repository', () => ({
  getPublishedNewsForSitemapDao: vi.fn(),
}))

import {getPublishedNewsForSitemapDao} from '@/db/repositories/news-repository'
import {getPublishedPagesForSitemapDao} from '@/db/repositories/page-repository'

import {getAuthUser} from '../authentication/auth-service'
import {getPublishedSitemapEntriesService} from '../sitemap-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublishedPagesForSitemapDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [{slug: 'qualite-de-l-eau', updatedAt: new Date('2026-09-02')}]
  })
  vi.mocked(getPublishedNewsForSitemapDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [{slug: 'fete-de-l-etang', publishedOn: '2026-10-12'}]
  })
})

describe('[PUBLIC] getPublishedSitemapEntriesService (s11)', () => {
  it('lit les pages et actualites publiees sous le scope de l association, sans session', async () => {
    expect(await getPublishedSitemapEntriesService(ORG_ID)).toEqual({
      pages: [{slug: 'qualite-de-l-eau', updatedAt: new Date('2026-09-02')}],
      news: [{slug: 'fete-de-l-etang', publishedOn: '2026-10-12'}],
    })
    expect(getPublishedPagesForSitemapDao).toHaveBeenCalledWith(ORG_ID)
    expect(getPublishedNewsForSitemapDao).toHaveBeenCalledWith(ORG_ID)
    expect(getAuthUser).not.toHaveBeenCalled()
  })

  it('un identifiant d association mal forme ne lit rien', async () => {
    await expect(
      getPublishedSitemapEntriesService('pas-un-uuid')
    ).rejects.toThrow()
    expect(getPublishedPagesForSitemapDao).not.toHaveBeenCalled()
    expect(getPublishedNewsForSitemapDao).not.toHaveBeenCalled()
  })
})
