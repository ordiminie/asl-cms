import {describe, expect, it, vi} from 'vitest'

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
  }
})

import {render, screen, within} from '@/__tests__/customRender'
import {NewsDTO} from '@/services/types/domain/news-types'

import {HomeMinimal} from './home-minimal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const newsItem = (
  index: number,
  overrides: Partial<NewsDTO> = {}
): NewsDTO => ({
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
  ...overrides,
})

const renderHome = async (props: Parameters<typeof HomeMinimal>[0]) =>
  render(await HomeMinimal(props))

describe('HomeMinimal — accueil automatique (s44, écran 3)', () => {
  it('pose le nom de l association en h1', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [],
    })

    expect(
      screen.getByRole('heading', {level: 1, name: 'Les Amis de l’Étang'})
    ).toBeInTheDocument()
  })

  it('affiche la description quand elle existe', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: 'Association syndicale libre du domaine de l’Étang.',
      news: [],
    })

    expect(
      screen.getByText('Association syndicale libre du domaine de l’Étang.')
    ).toBeInTheDocument()
  })

  it('sans description : aucun paragraphe vide sous le titre', async () => {
    const {container} = await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [],
    })

    expect(container.querySelector('[data-slot="home-description"]')).toBeNull()
  })

  it('liste les actualités : titre en h3 qui est le lien, date en clair, lien vers toutes', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [newsItem(1)],
    })

    expect(
      screen.getByRole('heading', {level: 2, name: 'Dernières actualités'})
    ).toBeInTheDocument()
    const title = screen.getByRole('heading', {level: 3, name: 'Actualité 1'})
    expect(within(title).getByRole('link')).toHaveAttribute(
      'href',
      '/actualites/actualite-1'
    )
    expect(screen.getByText('12 octobre 2026')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Toutes les actualités'})
    ).toHaveAttribute('href', '/actualites')
  })

  it('vignette seulement pour une actualité qui a une image', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [
        newsItem(1, {
          imageKey: `${ORG_ID}/news/n/image.webp`,
          imageAlt: 'Le bord de l’étang',
        }),
        newsItem(2),
      ],
    })

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('alt', 'Le bord de l’étang')
  })

  it('trois actualités au plus', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [1, 2, 3, 4, 5].map((index) => newsItem(index)),
    })

    expect(screen.getAllByRole('heading', {level: 3})).toHaveLength(3)
    expect(screen.queryByText('Actualité 4')).toBeNull()
  })

  it('sans actualité : la section reste, avec la phrase de l état vide, sans lien', async () => {
    await renderHome({
      name: 'Les Amis de l’Étang',
      description: null,
      news: [],
    })

    expect(
      screen.getByRole('heading', {level: 2, name: 'Dernières actualités'})
    ).toBeInTheDocument()
    expect(
      screen.getByText('Aucune actualité pour l’instant.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
