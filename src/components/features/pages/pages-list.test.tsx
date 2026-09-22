import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {PageDTO} from '@/services/types/domain/page-types'

import {PagesList} from './pages-list'

const page = (overrides: Partial<PageDTO> = {}): PageDTO => ({
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  slug: 'qualite-de-leau',
  title: "Qualité de l'eau",
  status: 'draft',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-12T14:20:00Z'),
  ...overrides,
})

describe('PagesList — pastilles de statut', () => {
  it('lit le statut au libelle ecrit, pas a la couleur seule', () => {
    render(
      <PagesList
        pages={[
          page({status: 'draft'}),
          page({id: 'b', slug: 'adherer', status: 'published'}),
          page({id: 'c', slug: 'fete', status: 'unpublished'}),
        ]}
        createAction={vi.fn()}
      />
    )

    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByText('Publiée')).toBeInTheDocument()
    expect(screen.getByText('Dépubliée')).toBeInTheDocument()
  })

  it('colore les pastilles avec des tokens du design system, jamais une couleur choisie a la main', () => {
    const {container} = render(
      <PagesList
        pages={[
          page({status: 'draft'}),
          page({id: 'b', slug: 'adherer', status: 'published'}),
          page({id: 'c', slug: 'fete', status: 'unpublished'}),
        ]}
        createAction={vi.fn()}
      />
    )

    const dots = [...container.querySelectorAll('[aria-hidden="true"]')]
    expect(dots).toHaveLength(3)

    for (const dot of dots) {
      expect(dot.className).not.toContain('oklch')
    }

    expect(dots[0].className).toContain('bg-muted-foreground')
    expect(dots[1].className).toContain('bg-accent-solid')
    expect(dots[2].className).toContain('bg-warning-border')
  })
})

describe('PagesList — creation d une page', () => {
  it('ouvre la creation sans afficher d erreur quand elle aboutit', async () => {
    const createAction = vi.fn(async () => {})
    render(<PagesList pages={[]} createAction={createAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Nouvelle page'}))

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /**
   * `createPageAction` peut echouer — au-dela de 50 slugs pris, elle leve. Sans
   * rattrapage, la promesse part en rejet non gere et le bureau reste devant un
   * bouton muet. L'echec doit s'ecrire dans la page, ancre, jamais en toast
   * (design system §5).
   */
  it('affiche un echec ancre quand la creation echoue, sans rejet non gere', async () => {
    const createAction = vi.fn(async () => {
      throw new Error('Impossible de trouver un slug libre pour une page')
    })
    render(<PagesList pages={[]} createAction={createAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Nouvelle page'}))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/n'a pas pu être créée/i)
    expect(screen.getByRole('button', {name: 'Nouvelle page'})).toBeEnabled()
  })

  it('ne prend pas la navigation vers le nouvel editeur pour un echec', async () => {
    const createAction = vi.fn(async () => {
      const redirection = Object.assign(new Error('NEXT_REDIRECT'), {
        digest: 'NEXT_REDIRECT;replace;/bureau/pages/abc;307;',
      })
      throw redirection
    })
    render(<PagesList pages={[]} createAction={createAction} />)

    await userEvent.click(screen.getByRole('button', {name: 'Nouvelle page'}))

    await waitFor(() => expect(createAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
