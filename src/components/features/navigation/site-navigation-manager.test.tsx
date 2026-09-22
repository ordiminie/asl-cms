import {beforeAll, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {PageDTO} from '@/services/types/domain/page-types'
import {MenuItemDTO} from '@/services/types/domain/site-navigation-types'

import {SiteNavigationManager} from './site-navigation-manager'

/**
 * `cmdk`, derriere le selecteur d'ajout, observe la taille de sa liste et fait
 * defiler l'element actif — deux APIs que jsdom n'implemente pas.
 */
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
})

const menuItem = (overrides: Partial<MenuItemDTO> = {}): MenuItemDTO => ({
  id: '11111111-1111-4111-8111-111111111111',
  pageId: '22222222-2222-4222-8222-222222222222',
  rank: 0,
  visible: true,
  pageTitle: "Qualité de l'eau",
  pageSlug: 'qualite-de-leau',
  pageStatus: 'published',
  ...overrides,
})

const page = (overrides: Partial<PageDTO> = {}): PageDTO => ({
  id: '22222222-2222-4222-8222-222222222222',
  organizationId: '33333333-3333-4333-8333-333333333333',
  slug: 'qualite-de-leau',
  title: "Qualité de l'eau",
  status: 'published',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-12T14:20:00Z'),
  ...overrides,
})

const noop = {
  addAction: vi.fn(async () => ({status: 'added' as const, item: menuItem()})),
  removeAction: vi.fn(async () => ({status: 'ok' as const})),
  reorderAction: vi.fn(async () => ({status: 'ok' as const})),
  setVisibilityAction: vi.fn(async () => ({status: 'ok' as const})),
  saveFooterAction: vi.fn(async () => ({status: 'ok' as const})),
}

const renderManager = (
  props: Partial<Parameters<typeof SiteNavigationManager>[0]> = {}
) => {
  const actions = {
    addAction: vi.fn(async () => ({
      status: 'added' as const,
      item: menuItem({id: 'nouvelle-entree'}),
    })),
    removeAction: vi.fn(async () => ({status: 'ok' as const})),
    reorderAction: vi.fn(async () => ({status: 'ok' as const})),
    setVisibilityAction: vi.fn(async () => ({status: 'ok' as const})),
    saveFooterAction: vi.fn(async () => ({status: 'ok' as const})),
  }

  render(
    <SiteNavigationManager
      menu={[menuItem()]}
      pages={[page()]}
      footerContent=""
      {...actions}
      {...props}
    />
  )

  return actions
}

describe('SiteNavigationManager — composition du menu', () => {
  it('affiche chaque entrée avec le titre et le statut écrit de sa page', () => {
    renderManager({
      menu: [
        menuItem(),
        menuItem({
          id: 'b',
          pageId: 'page-b',
          rank: 1,
          pageTitle: 'Compte-rendu AG 2025',
          pageStatus: 'draft',
        }),
      ],
    })

    expect(screen.getByText("Qualité de l'eau")).toBeInTheDocument()
    expect(screen.getByText('Compte-rendu AG 2025')).toBeInTheDocument()
    expect(screen.getByText('Publiée')).toBeInTheDocument()
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
  })

  /**
   * Critere 2 : une entree dont la page n'est pas publiee reste dans la liste
   * du bureau, annotee — etat normal, pas une erreur.
   */
  it('annote l entrée dont la page n est pas publiée', () => {
    renderManager({
      menu: [menuItem({pageStatus: 'unpublished'})],
    })

    expect(screen.getByText(/Masquée sur le site public/)).toBeInTheDocument()
  })

  it('ne l annote pas quand la page est publiée', () => {
    renderManager()

    expect(screen.queryByText(/Masquée sur le site public/)).toBeNull()
  })

  /**
   * Toute action du menu s'applique immediatement : le seul bouton
   * « Enregistrer » de l'ecran est celui du pied de page.
   */
  it('bascule la visibilité sans bouton d enregistrement séparé', async () => {
    const actions = renderManager()

    await userEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(actions.setVisibilityAction).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        false
      )
    )
    expect(screen.getAllByRole('button', {name: 'Enregistrer'})).toHaveLength(1)
  })

  it('retire une entrée et propose de l annuler', async () => {
    const actions = renderManager()

    await userEvent.click(screen.getByRole('button', {name: 'Retirer du menu'}))

    await waitFor(() =>
      expect(actions.removeAction).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111'
      )
    )
    expect(screen.getByText(/retirée du menu/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Annuler'})).toBeInTheDocument()
  })

  it('ne propose à l ajout que les pages absentes du menu', async () => {
    renderManager({
      menu: [menuItem()],
      pages: [
        page(),
        page({
          id: 'page-histoire',
          slug: 'historique',
          title: "Historique de l'étang",
        }),
      ],
    })

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une entrée/})
    )

    expect(await screen.findByText("Historique de l'étang")).toBeVisible()
    expect(screen.getAllByText("Qualité de l'eau")).toHaveLength(1)
  })

  it('annonce l absence d entrée plutôt qu une liste vide muette', () => {
    renderManager({menu: []})

    expect(screen.getByText(/Aucune entrée dans le menu/)).toBeInTheDocument()
  })
})

describe('SiteNavigationManager — pied de page', () => {
  it('enregistre le contenu saisi', async () => {
    const actions = renderManager({footerContent: 'Ancien pied de page'})

    const editor = screen.getByLabelText('Contenu du pied de page')
    await userEvent.clear(editor)
    await userEvent.type(editor, 'Les Amis de l’Étang')
    await userEvent.click(screen.getByRole('button', {name: 'Enregistrer'}))

    await waitFor(() =>
      expect(actions.saveFooterAction).toHaveBeenCalledWith(
        'Les Amis de l’Étang'
      )
    )
  })

  /** Design system §5 : un echec s'ecrit dans la page, ancre, jamais en toast. */
  it('écrit l échec dans la page plutôt qu en toast', async () => {
    const actions = {
      ...noop,
      saveFooterAction: vi.fn(async () => ({
        status: 'error' as const,
        message: "L'enregistrement a échoué. Rien n'est perdu : réessayez.",
      })),
    }

    render(
      <SiteNavigationManager
        menu={[]}
        pages={[]}
        footerContent=""
        {...actions}
      />
    )

    await userEvent.click(screen.getByRole('button', {name: 'Enregistrer'}))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/a échoué/)
  })
})
