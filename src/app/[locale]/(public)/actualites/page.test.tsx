import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../messages/fr.json')).default

  return {
    getTranslations:
      async (namespace: string) =>
      (key: string, values?: Record<string, string | number>) => {
        const message = [
          ...namespace.split('.'),
          ...key.split('.'),
        ].reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          messages
        )

        return Object.entries(values ?? {}).reduce<string>(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          message as string
        )
      },
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: 'org-1'})),
}))
vi.mock('@/app/dal/news-dal', () => ({
  getPublicNewsPageCountDal: vi.fn(),
  getPublicNewsPageDal: vi.fn(),
  newsImageUrl: (key: string) => `/api/files/${key}`,
}))

import {render, screen} from '@/__tests__/customRender'
import {
  getPublicNewsPageCountDal,
  getPublicNewsPageDal,
} from '@/app/dal/news-dal'
import {NewsDTO, NewsListPageDTO} from '@/services/types/domain/news-types'

import PublicNewsListPage from './page'

const item = (overrides: Partial<NewsDTO> = {}): NewsDTO => ({
  id: 'n1',
  organizationId: 'org-1',
  slug: 'assemblee-generale',
  title: 'Assemblée générale du 10 octobre',
  publishedOn: '2026-09-02',
  imageKey: null,
  imageAlt: '',
  content: 'Rendez-vous le 10 octobre.',
  status: 'published',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const listOf = (
  items: NewsDTO[],
  overrides: Partial<NewsListPageDTO> = {}
): NewsListPageDTO => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: 1,
  ...overrides,
})

const renderList = async (page?: string) =>
  render(
    await PublicNewsListPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(page ? {page} : {}),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicNewsPageCountDal).mockResolvedValue(1)
})

describe('/actualites — liste publique', () => {
  it('rend les actualités dans l’ordre reçu, titre en lien', async () => {
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      listOf([
        item({id: 'n1', slug: 'recente', title: 'La plus récente'}),
        item({
          id: 'n2',
          slug: 'ancienne',
          title: 'La plus ancienne',
          publishedOn: '2026-08-01',
        }),
      ])
    )

    const {container} = await renderList()

    const links = [...container.querySelectorAll('h2 a')].map(
      (link) => link.textContent
    )
    expect(links).toEqual(['La plus récente', 'La plus ancienne'])
    expect(container.querySelector('h2 a')).toHaveAttribute(
      'href',
      '/actualites/recente'
    )
  })

  it('écrit la date en clair', async () => {
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      listOf([item({publishedOn: '2026-09-02'})])
    )

    await renderList()

    expect(screen.getByText('2 septembre 2026')).toBeInTheDocument()
  })

  it('pas de vignette sans image, une vignette avec image', async () => {
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      listOf([item({imageKey: null})])
    )
    const {container: sansImage} = await renderList()
    expect(sansImage.querySelector('img')).toBeNull()

    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      listOf([
        item({imageKey: 'org-1/news/n1/image-a.png', imageAlt: 'La mare'}),
      ])
    )
    const {container: avecImage} = await renderList()
    expect(avecImage.querySelector('img')).toHaveAttribute('alt', 'La mare')
  })

  it('annonce la pagination, « Précédent » désactivé en page 1', async () => {
    vi.mocked(getPublicNewsPageCountDal).mockResolvedValue(3)
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(
      listOf([item()], {page: 1, total: 25, totalPages: 3})
    )

    await renderList()

    expect(screen.getByText('Page 1 sur 3')).toBeInTheDocument()
    expect(screen.getByText('← Précédent')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByRole('link', {name: 'Suivant →'})).toHaveAttribute(
      'href',
      '/actualites?page=2'
    )
  })

  it('état vide sans action', async () => {
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(listOf([]))

    await renderList()

    expect(
      screen.getByText("Aucune actualité pour l'instant.")
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('une page hors bornes rend 404 sans lire la liste cachée', async () => {
    vi.mocked(getPublicNewsPageCountDal).mockResolvedValue(2)

    await expect(renderList('4')).rejects.toThrow('NEXT_NOT_FOUND')
    // La lecture cachee est indexee sur le numero de page : l'atteindre avec
    // un numero hors bornes laisserait un visiteur creer autant d'entrees de
    // cache qu'il essaie de numeros.
    expect(getPublicNewsPageDal).not.toHaveBeenCalled()
  })

  it('un numéro de page absurde ne touche aucune lecture', async () => {
    await expect(renderList('0')).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(renderList('cache')).rejects.toThrow('NEXT_NOT_FOUND')

    expect(getPublicNewsPageDal).not.toHaveBeenCalled()
    expect(getPublicNewsPageCountDal).not.toHaveBeenCalled()
  })

  it('la page 1 d’une liste vide reste la liste vide, jamais un 404', async () => {
    vi.mocked(getPublicNewsPageCountDal).mockResolvedValue(1)
    vi.mocked(getPublicNewsPageDal).mockResolvedValue(listOf([], {total: 0}))

    await renderList('1')

    expect(
      screen.getByText("Aucune actualité pour l'instant.")
    ).toBeInTheDocument()
  })
})
