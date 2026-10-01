import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async (namespace: string | {namespace: string}) => (key: string) =>
      `${typeof namespace === 'string' ? namespace : namespace.namespace}.${key}`
  ),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/seo-dal', () => ({getCurrentAssociationSeoDal: vi.fn()}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: 'org-1'})),
  getCurrentTenantDal: vi.fn(async () => ({id: 'org-1'})),
  requireEnabledModuleDal: vi.fn(async () => ({id: 'org-1'})),
}))
vi.mock('@/app/dal/page-dal', () => ({
  canManageCurrentPagesDal: vi.fn(async () => false),
  getPageBySlugForPreviewDal: vi.fn(),
  getPublicPageBySlugDal: vi.fn(),
}))
vi.mock('@/app/dal/news-dal', () => ({
  canManageCurrentNewsDal: vi.fn(async () => false),
  getNewsBySlugForPreviewDal: vi.fn(),
  getPublicNewsBySlugDal: vi.fn(),
  newsImageUrl: (key: string) => `/api/files/${key}`,
}))

import type {Metadata} from 'next'

import {getPublicNewsBySlugDal} from '@/app/dal/news-dal'
import {getPublicPageBySlugDal} from '@/app/dal/page-dal'
import {AssociationSeoDTO, getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'
import {shareImageNameKey} from '@/lib/seo/resolve-metadata'
import {NewsDTO} from '@/services/types/domain/news-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import {generateMetadata as homeMetadata} from '../page'
import {generateMetadata as cmsMetadata} from './[slug]/page'
import {generateMetadata as newsItemMetadata} from './actualites/[slug]/page'
import {generateMetadata as newsListMetadata} from './actualites/page'
import {generateMetadata as waterMetadata} from './analyses-eau/page'
import {generateMetadata as contactMetadata} from './contact/page'
import {generateMetadata as boardMetadata} from './le-bureau/page'
import {generateMetadata as reportMetadata} from './signaler/page'

const ORIGIN = 'https://lesamisdeletang.fr'
const ORG_ID = '11111111-1111-4111-8111-111111111111'
const SHARE_KEY = `${ORG_ID}/pages/p/share-66666666-6666-4666-8666-666666666666.webp`
const FALLBACK = `${ORIGIN}/api/identity/share-image?h=195&n=${shareImageNameKey('Les Amis de l’Étang')}`

const association = (
  overrides: Partial<AssociationSeoDTO> = {}
): AssociationSeoDTO => ({
  name: 'Les Amis de l’Étang',
  description: 'Description de l’association.',
  googleVerification: undefined,
  logoVersion: undefined,
  hue: 195,
  origin: ORIGIN,
  ...overrides,
})

const cmsPage = (
  overrides: Partial<PageWithBlocksDTO> = {}
): PageWithBlocksDTO => ({
  id: 'p',
  organizationId: ORG_ID,
  slug: 'qualite-de-l-eau',
  title: 'Qualité de l’eau',
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  blocks: [],
  ...overrides,
})

const newsItem = (overrides: Partial<NewsDTO> = {}): NewsDTO => ({
  id: 'n',
  organizationId: ORG_ID,
  slug: 'fete-de-l-etang',
  title: 'Fête de l’étang',
  publishedOn: '2026-10-12',
  imageKey: null,
  imageAlt: '',
  content: 'Retrouvons-nous au bord de l’étang.',
  seoDescription: null,
  status: 'published',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const localeParams = (locale = 'fr') => ({
  params: Promise.resolve({locale}),
  searchParams: Promise.resolve({}),
})

const slugParams = (slug: string, locale = 'fr') => ({
  params: Promise.resolve({locale, slug}),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(association())
})

describe('page CMS publiee — titre, description et partage du bureau (critere 2)', () => {
  it('reprend ce que le bureau a saisi', async () => {
    vi.mocked(getPublicPageBySlugDal).mockResolvedValue(
      cmsPage({
        seoTitle: 'Qualité de l’eau : analyses',
        seoDescription: 'Résultats des analyses.',
        shareImageKey: SHARE_KEY,
        shareImageAlt: 'Prélèvement',
      })
    )

    const metadata = await cmsMetadata(slugParams('qualite-de-l-eau'))

    expect(metadata.title).toBe('Qualité de l’eau : analyses')
    expect(metadata.description).toBe('Résultats des analyses.')
    expect(metadata.openGraph).toMatchObject({
      title: 'Qualité de l’eau : analyses',
      description: 'Résultats des analyses.',
      url: `${ORIGIN}/qualite-de-l-eau`,
      siteName: 'Les Amis de l’Étang',
      images: [{url: `${ORIGIN}/api/files/${SHARE_KEY}`, alt: 'Prélèvement'}],
    })
    expect(metadata.twitter).toMatchObject({card: 'summary_large_image'})
  })

  it('champs vides : repli sur la page et l association', async () => {
    vi.mocked(getPublicPageBySlugDal).mockResolvedValue(cmsPage())

    const metadata = await cmsMetadata(slugParams('qualite-de-l-eau'))

    expect(metadata.title).toBe('Qualité de l’eau')
    expect(metadata.description).toBe('Description de l’association.')
    expect(metadata.openGraph).toMatchObject({
      images: [{url: FALLBACK, alt: 'Les Amis de l’Étang'}],
    })
  })

  it('canonique sans prefixe, meme appelee sous /fr ou /es', async () => {
    vi.mocked(getPublicPageBySlugDal).mockResolvedValue(cmsPage())

    for (const locale of ['fr', 'es', 'en']) {
      const metadata = await cmsMetadata(slugParams('qualite-de-l-eau', locale))
      expect(metadata.alternates).toEqual({
        canonical: `${ORIGIN}/qualite-de-l-eau`,
      })
    }
  })

  it('page introuvable : aucune metadonnee propre', async () => {
    vi.mocked(getPublicPageBySlugDal).mockResolvedValue(undefined)

    expect(await cmsMetadata(slugParams('absente'))).toEqual({})
  })
})

describe('actualite publiee (critere 2)', () => {
  it('description du bureau, sinon debut du texte ; adresse sans prefixe', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(
      newsItem({seoDescription: 'Pique-nique et balade.'})
    )
    const filled = await newsItemMetadata(slugParams('fete-de-l-etang'))
    expect(filled.description).toBe('Pique-nique et balade.')
    expect(filled.alternates).toEqual({
      canonical: `${ORIGIN}/actualites/fete-de-l-etang`,
    })
    expect(filled.openGraph).toMatchObject({type: 'article'})

    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(newsItem())
    const fallback = await newsItemMetadata(slugParams('fete-de-l-etang'))
    expect(fallback.title).toBe('Fête de l’étang')
    expect(fallback.description).toBe('Retrouvons-nous au bord de l’étang.')
  })
})

describe('pages a adresse fixe et accueil : repli sur l association', () => {
  it.each([
    ['/actualites', () => newsListMetadata(localeParams('es'))],
    ['/analyses-eau', () => waterMetadata(localeParams('es'))],
    ['/le-bureau', () => boardMetadata(localeParams('es'))],
    ['/contact', () => contactMetadata()],
    ['/signaler', () => reportMetadata(localeParams('es'))],
  ])(
    '%s : description de l association, image de repli, canonique sans prefixe',
    async (path, read: () => Promise<Metadata>) => {
      const metadata = await read()

      expect(metadata.description).toBe('Description de l’association.')
      expect(metadata.alternates).toEqual({canonical: `${ORIGIN}${path}`})
      expect(metadata.openGraph).toMatchObject({
        url: `${ORIGIN}${path}`,
        images: [{url: FALLBACK, alt: 'Les Amis de l’Étang'}],
      })
    }
  )

  it('association sans description : aucune description, pas un texte du produit', async () => {
    vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(
      association({description: null})
    )

    expect((await contactMetadata()).description).toBeNull()
    expect((await reportMetadata(localeParams())).description).toBeNull()
  })

  it('accueil : le nom de l association seul, adresse racine', async () => {
    const metadata = await homeMetadata(localeParams('es'))

    expect(metadata.title).toEqual({absolute: 'Les Amis de l’Étang'})
    expect(metadata.alternates).toEqual({canonical: `${ORIGIN}/`})
    expect(metadata.description).toBe('Description de l’association.')
  })
})
