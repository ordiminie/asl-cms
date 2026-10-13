import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/env', () => ({env: {BETTER_AUTH_URL: 'https://plateforme.test'}}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/sitemap-dal', () => ({
  getPublishedSitemapEntriesDal: vi.fn(),
}))
vi.mock('@/app/dal/home-page-dal', () => ({
  getPublicHomePageDal: vi.fn(),
}))

import {getPublicHomePageDal} from '@/app/dal/home-page-dal'
import {getPublishedSitemapEntriesDal} from '@/app/dal/sitemap-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import sitemap from './sitemap'

const tenantOf = (id: string, domain: string) => ({
  id,
  name: domain,
  slug: domain,
  domain,
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
})

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const urlsOf = async () => (await sitemap()).map((entry) => entry.url)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicHomePageDal).mockResolvedValue(undefined)
  vi.mocked(getCurrentTenantDal).mockResolvedValue(
    tenantOf(ORG_A, 'lesamisdeletang.fr')
  )
  vi.mocked(getPublishedSitemapEntriesDal).mockImplementation(async (id) =>
    id === ORG_A
      ? {
          pages: [
            {slug: 'qualite-de-l-eau', updatedAt: new Date('2026-09-02')},
          ],
          news: [{slug: 'fete-de-l-etang', publishedOn: '2026-10-12'}],
        }
      : {
          pages: [{slug: 'adherer', updatedAt: new Date('2026-08-01')}],
          news: [],
        }
  )
})

describe('sitemap.ts — une association par domaine (criteres 1 et 5)', () => {
  it('liste l accueil, les pages fixes, les pages et actualites publiees, sur l origine de l association', async () => {
    const entries = await sitemap()

    expect(entries).toEqual([
      {url: 'https://lesamisdeletang.fr/'},
      {url: 'https://lesamisdeletang.fr/actualites'},
      {url: 'https://lesamisdeletang.fr/analyses-eau'},
      {url: 'https://lesamisdeletang.fr/le-bureau'},
      {url: 'https://lesamisdeletang.fr/contact'},
      {url: 'https://lesamisdeletang.fr/signaler'},
      {
        url: 'https://lesamisdeletang.fr/qualite-de-l-eau',
        lastModified: new Date('2026-09-02'),
      },
      {
        url: 'https://lesamisdeletang.fr/actualites/fete-de-l-etang',
        lastModified: '2026-10-12',
      },
    ])
    expect(getPublishedSitemapEntriesDal).toHaveBeenCalledWith(ORG_A)
  })

  it('aucune adresse prefixee par une locale, aucune alternative de langue', async () => {
    const entries = await sitemap()

    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/(fr|en|es)(\/|$)/)
      expect(entry).not.toHaveProperty('alternates')
    }
  })

  it('ni le blog herite, ni les pages du produit', async () => {
    const urls = await urlsOf()

    expect(urls.some((url) => url.includes('/blog'))).toBe(false)
    for (const path of ['/pricing', '/faq', '/terms', '/privacy']) {
      expect(urls).not.toContain(`https://lesamisdeletang.fr${path}`)
    }
  })

  it('une autre association sur son domaine : ses seules pages', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(
      tenantOf(ORG_B, 'laforche.fr')
    )

    const urls = await urlsOf()

    expect(urls).toContain('https://laforche.fr/adherer')
    expect(urls.some((url) => url.includes('lesamisdeletang.fr'))).toBe(false)
    expect(urls).not.toContain('https://laforche.fr/qualite-de-l-eau')
  })

  it('domaine qui ne sert aucune association : sitemap vide', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    expect(await sitemap()).toEqual([])
    expect(getPublishedSitemapEntriesDal).not.toHaveBeenCalled()
  })
})

const homePageOf = (slug: string, updatedAt: Date): PageWithBlocksDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_A,
  slug,
  title: 'Qualité de l’eau',
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt,
  blocks: [],
})

describe('sitemap.ts — la page d accueil une seule fois, sous / (s44, critere 6)', () => {
  it('liste / une fois, date de la page, et jamais son adresse propre', async () => {
    vi.mocked(getPublicHomePageDal).mockResolvedValue(
      homePageOf('qualite-de-l-eau', new Date('2026-09-02'))
    )

    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(
      urls.filter((url) => url === 'https://lesamisdeletang.fr/')
    ).toHaveLength(1)
    expect(urls).not.toContain('https://lesamisdeletang.fr/qualite-de-l-eau')
    expect(entries[0]).toEqual({
      url: 'https://lesamisdeletang.fr/',
      lastModified: new Date('2026-09-02'),
    })
    expect(getPublicHomePageDal).toHaveBeenCalledWith(ORG_A)
  })

  it('page designee depubliee : / sans date, son adresse absente comme toute page non publiee', async () => {
    vi.mocked(getPublicHomePageDal).mockResolvedValue(undefined)
    vi.mocked(getPublishedSitemapEntriesDal).mockResolvedValue({
      pages: [],
      news: [],
    })

    const entries = await sitemap()

    expect(entries[0]).toEqual({url: 'https://lesamisdeletang.fr/'})
    expect(entries.map((entry) => entry.url)).not.toContain(
      'https://lesamisdeletang.fr/qualite-de-l-eau'
    )
  })

  it('une autre page designee : les autres pages restent listees', async () => {
    vi.mocked(getPublicHomePageDal).mockResolvedValue(
      homePageOf('bienvenue', new Date('2026-09-05'))
    )

    expect(await urlsOf()).toContain(
      'https://lesamisdeletang.fr/qualite-de-l-eau'
    )
  })
})
