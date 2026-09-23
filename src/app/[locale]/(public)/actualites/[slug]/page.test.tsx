import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../../messages/fr.json')).default

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
  canManageCurrentNewsDal: vi.fn(),
  getNewsBySlugForPreviewDal: vi.fn(),
  getPublicNewsBySlugDal: vi.fn(),
  newsImageUrl: (key: string) => `/api/files/${key}`,
}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentNewsDal,
  getNewsBySlugForPreviewDal,
  getPublicNewsBySlugDal,
} from '@/app/dal/news-dal'
import {NewsDTO} from '@/services/types/domain/news-types'

import PublicNewsItemPage from './page'

const newsOf = (overrides: Partial<NewsDTO> = {}): NewsDTO => ({
  id: 'n1',
  organizationId: 'org-1',
  slug: 'assemblee-generale',
  title: 'Assemblée générale du 10 octobre',
  publishedOn: '2026-09-02',
  imageKey: null,
  imageAlt: '',
  content: '## Ordre du jour\n\nUn **point** important.',
  status: 'published',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

const renderItem = async (slug = 'assemblee-generale') =>
  render(
    await PublicNewsItemPage({
      params: Promise.resolve({locale: 'fr', slug}),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canManageCurrentNewsDal).mockResolvedValue(false)
  vi.mocked(getNewsBySlugForPreviewDal).mockResolvedValue(undefined)
})

describe('/actualites/[slug] — actualité publiée', () => {
  it('rend la date, le titre et le contenu sanitisé', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(newsOf())

    const {container} = await renderItem()

    expect(screen.getByText('2 septembre 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Assemblée générale du 10 octobre',
      })
    ).toBeInTheDocument()
    const body = container.querySelector('.page-block')
    expect(body?.innerHTML).toContain('<h2>Ordre du jour</h2>')
    expect(body?.innerHTML).toContain('<strong>point</strong>')
  })

  it('neutralise un script glissé dans le contenu', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(
      newsOf({content: 'Bonjour <script>alert(1)</script>'})
    )

    const {container} = await renderItem()

    expect(container.querySelector('.page-block')?.innerHTML).not.toContain(
      '<script'
    )
  })

  it('ramène à la liste des actualités', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(newsOf())

    await renderItem()

    expect(
      screen.getByRole('link', {name: '← Toutes les actualités'})
    ).toHaveAttribute('href', '/actualites')
  })

  it("rend l'image en figure quand il y en a une, rien sinon", async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(newsOf())
    const {container: sansImage} = await renderItem()
    expect(sansImage.querySelector('figure')).toBeNull()

    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(
      newsOf({imageKey: 'org-1/news/n1/image-a.png', imageAlt: 'La mare'})
    )
    const {container: avecImage} = await renderItem()
    expect(avecImage.querySelector('figure img')).toHaveAttribute(
      'alt',
      'La mare'
    )
  })
})

describe('/actualites/[slug] — brouillon', () => {
  it('rend 404 pour un visiteur', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(undefined)

    await expect(renderItem()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(getNewsBySlugForPreviewDal).not.toHaveBeenCalled()
  })

  it('reste en aperçu pour le bureau, avec son encart', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(undefined)
    vi.mocked(canManageCurrentNewsDal).mockResolvedValue(true)
    vi.mocked(getNewsBySlugForPreviewDal).mockResolvedValue(
      newsOf({status: 'draft'})
    )

    await renderItem()

    expect(screen.getByRole('status')).toHaveTextContent(/Aperçu/)
  })

  it("reprend l'encart d'aperçu des pages de s04, sans variante", async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(undefined)
    vi.mocked(canManageCurrentNewsDal).mockResolvedValue(true)
    vi.mocked(getNewsBySlugForPreviewDal).mockResolvedValue(
      newsOf({status: 'draft'})
    )

    await renderItem()

    expect(screen.getByRole('status')).toHaveClass(
      'bg-accent',
      'text-accent-foreground',
      'rounded-md',
      'px-4',
      'py-3',
      'text-[15px]'
    )
  })

  it('un slug inconnu rend 404, même pour le bureau', async () => {
    vi.mocked(getPublicNewsBySlugDal).mockResolvedValue(undefined)
    vi.mocked(canManageCurrentNewsDal).mockResolvedValue(true)

    await expect(renderItem('inconnue')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
