import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {
  NewsDTO,
  NewsListPageDTO,
  NewsStatus,
} from '@/services/types/domain/news-types'

import {NewsList} from './news-list'

const item = (
  id: string,
  status: NewsStatus,
  overrides: Partial<NewsDTO> = {}
): NewsDTO => ({
  id,
  organizationId: '22222222-2222-4222-8222-222222222222',
  slug: `actualite-${id}`,
  title: `Actualité ${id}`,
  publishedOn: '2026-09-02',
  imageKey: null,
  imageAlt: '',
  content: '',
  status,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-02T10:00:00Z'),
  ...overrides,
})

const listOf = (
  items: NewsDTO[],
  overrides: Partial<NewsListPageDTO> = {}
): NewsListPageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  ...overrides,
})

describe('NewsList — état vide', () => {
  it('propose d’écrire la première actualité', async () => {
    const createAction = vi.fn(async () => {})
    render(<NewsList list={listOf([])} createAction={createAction} />)

    expect(
      screen.getByText(/Aucune actualité pour l'instant/)
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {name: 'Écrire la première'})
    )

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1))
  })
})

describe('NewsList — lignes', () => {
  it('écrit les trois statuts, jamais la couleur seule', () => {
    render(
      <NewsList
        list={listOf([
          item('a', 'published'),
          item('b', 'draft'),
          item('c', 'unpublished'),
        ])}
        createAction={vi.fn()}
      />
    )

    expect(screen.getByText('Publiée')).toBeInTheDocument()
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByText('Dépubliée')).toBeInTheDocument()
  })

  it('une seule action « Modifier » par ligne, vers son éditeur', () => {
    render(
      <NewsList
        list={listOf([item('a', 'published'), item('b', 'draft')])}
        createAction={vi.fn()}
      />
    )

    const links = screen.getAllByRole('link', {name: 'Modifier'})
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/bureau/actualites/a')
  })

  it('affiche la date au format jj/mm/aaaa', () => {
    render(
      <NewsList
        list={listOf([item('a', 'published', {publishedOn: '2026-09-02'})])}
        createAction={vi.fn()}
      />
    )

    expect(screen.getByText('02/09/2026')).toBeInTheDocument()
  })
})

describe('NewsList — pagination', () => {
  it('annonce la page courante et le total', () => {
    render(
      <NewsList
        list={listOf([item('a', 'published')], {
          page: 2,
          total: 30,
          totalPages: 2,
        })}
        createAction={vi.fn()}
      />
    )

    expect(screen.getByText('Page 2 sur 2')).toBeInTheDocument()
  })
})
