import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const {createTranslator} = await import('next-intl')
  const messages = (await import('../../../../messages/fr.json')).default

  const translatorFor = createTranslator as unknown as (options: {
    locale: string
    messages: typeof messages
    namespace: string
  }) => (key: string) => string

  return {
    getTranslations: async (namespace: string) =>
      translatorFor({locale: 'fr', messages, namespace}),
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/app/dal/home-page-dal', () => ({
  getCurrentPublicHomePageDal: vi.fn(),
}))
vi.mock('@/app/dal/seo-dal', () => ({
  getCurrentAssociationSeoDal: vi.fn(),
}))
vi.mock('@/app/dal/news-dal', () => ({
  getPublicNewsPageDal: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getCurrentPublicHomePageDal} from '@/app/dal/home-page-dal'
import {getPublicNewsPageDal} from '@/app/dal/news-dal'
import {getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NewsDTO} from '@/services/types/domain/news-types'
import {PageBlockTypeConst} from '@/services/types/domain/page-block-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import PublicHomePage from './page'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ORIGIN = 'https://lesamisdeletang.fr'

const homePage: PageWithBlocksDTO = {
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: ORG_ID,
  slug: 'bienvenue',
  title: 'Bienvenue aux Amis de l’Étang',
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  blocks: [
    {
      id: 'b1',
      type: PageBlockTypeConst.TEXT,
      rank: 0,
      data: {type: PageBlockTypeConst.TEXT, markdown: 'Le mot du président'},
    },
  ],
}

const newsItem = (index: number): NewsDTO => ({
  id: `news-${index}`,
  organizationId: ORG_ID,
  slug: `actualite-${index}`,
  title: `Actualité ${index}`,
  publishedOn: '2026-10-12',
  imageKey: null,
  imageAlt: '',
  content: 'Texte',
  seoDescription: null,
  status: 'published',
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-02'),
})

const newsPage = (items: NewsDTO[]) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: 1,
})

/** La page rend un composant serveur asynchrone : on le resout avant. */
const renderHome = async () => {
  const element = (await PublicHomePage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement
  const type = element.type as (props: unknown) => Promise<ReactElement>
  return render(await type(element.props))
}

const expectNoBoilerplateShowcase = (container: HTMLElement) => {
  expect(screen.queryByText(/Essayez gratuitement/)).toBeNull()
  expect(container.querySelector('a[href="/pricing"]')).toBeNull()
  expect(container.querySelector('a[href="/register"]')).toBeNull()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: ORG_ID,
    name: 'Les Amis de l’Étang',
  } as never)
  vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue({
    name: 'Les Amis de l’Étang',
    description: 'Association syndicale libre.',
    googleVerification: undefined,
    logoVersion: undefined,
    hue: 195,
    origin: ORIGIN,
  })
  vi.mocked(getPublicNewsPageDal).mockResolvedValue(newsPage([]))
})

describe('/ — page désignée par le bureau (critère 1)', () => {
  it('rend la page désignée : son titre en h1 et ses blocs', async () => {
    vi.mocked(getCurrentPublicHomePageDal).mockResolvedValue(homePage)

    const {container} = await renderHome()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Bienvenue aux Amis de l’Étang',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Le mot du président')).toBeInTheDocument()
    expect(screen.queryByText('Dernières actualités')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expectNoBoilerplateShowcase(container)
  })
})

describe('/ — accueil automatique (critère 2)', () => {
  beforeEach(() => {
    vi.mocked(getCurrentPublicHomePageDal).mockResolvedValue(undefined)
  })

  it('pose le nom de l association en h1, avec sa description', async () => {
    const {container} = await renderHome()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Les Amis de l’Étang'})
    ).toBeInTheDocument()
    expect(screen.getByText('Association syndicale libre.')).toBeInTheDocument()
    expectNoBoilerplateShowcase(container)
  })

  it('lit la première page des actualités publiées et en montre trois au plus', async () => {
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      newsPage([1, 2, 3, 4].map((index) => newsItem(index)))
    )

    await renderHome()

    expect(getPublicNewsPageDal).toHaveBeenCalledWith(ORG_ID, 1)
    expect(screen.getAllByRole('heading', {level: 3})).toHaveLength(3)
  })

  it('sans actualité : l état vide', async () => {
    const {container} = await renderHome()

    expect(
      screen.getByText('Aucune actualité pour l’instant.')
    ).toBeInTheDocument()
    expectNoBoilerplateShowcase(container)
  })
})
