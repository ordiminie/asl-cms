import {beforeAll, describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import {PageDTO} from '@/services/types/domain/page-types'
import {
  MenuItemDTO,
  MenuLinkItemDTO,
  MenuPageItemDTO,
} from '@/services/types/domain/site-navigation-types'

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

const menuItem = (
  overrides: Partial<MenuPageItemDTO> = {}
): MenuPageItemDTO => ({
  kind: 'page',
  id: '11111111-1111-4111-8111-111111111111',
  pageId: '22222222-2222-4222-8222-222222222222',
  rank: 0,
  visible: true,
  pageTitle: "Qualité de l'eau",
  pageSlug: 'qualite-de-leau',
  pageStatus: 'published',
  ...overrides,
})

const linkItem = (
  overrides: Partial<MenuLinkItemDTO> = {}
): MenuLinkItemDTO => ({
  kind: 'link',
  id: '44444444-4444-4444-8444-444444444444',
  rank: 1,
  visible: true,
  label: 'Nous contacter',
  address: '/contact',
  target: 'internal',
  ...overrides,
})

const page = (overrides: Partial<PageDTO> = {}): PageDTO => ({
  id: '22222222-2222-4222-8222-222222222222',
  organizationId: '33333333-3333-4333-8333-333333333333',
  slug: 'qualite-de-leau',
  title: "Qualité de l'eau",
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
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
  addLinkAction: vi.fn(async () => ({
    status: 'saved' as const,
    item: linkItem(),
  })),
  updateLinkAction: vi.fn(async () => ({
    status: 'saved' as const,
    item: linkItem(),
  })),
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
    addLinkAction: vi.fn(async (_state: unknown, formData: FormData) => ({
      status: 'saved' as const,
      item: linkItem({
        id: 'nouvelle-adresse',
        rank: 9,
        label: String(formData.get('label')),
        address: String(formData.get('address')),
      }),
    })),
    updateLinkAction: vi.fn(async (_state: unknown, formData: FormData) => ({
      status: 'saved' as const,
      item: linkItem({
        id: String(formData.get('menuItemId')),
        label: String(formData.get('label')),
        address: String(formData.get('address')),
      }),
    })),
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
      screen.getByRole('button', {name: /Ajouter une page/})
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

const menuWithLinks = (): MenuItemDTO[] => [
  menuItem(),
  linkItem(),
  linkItem({
    id: '55555555-5555-4555-8555-555555555555',
    rank: 2,
    label: 'Mairie de Saint-Étang',
    address: 'https://www.saint-etang.fr',
    target: 'external',
  }),
]

const formDataOf = (mock: {mock: {calls: unknown[][]}}, call = 0) =>
  Object.fromEntries(mock.mock.calls[call][1] as FormData)

describe('SiteNavigationManager — entrées libres (s50)', () => {
  it('écrit le type et l adresse d une entrée libre, sans badge de statut', () => {
    renderManager({menu: menuWithLinks()})

    expect(screen.getByText('Nous contacter')).toBeInTheDocument()
    expect(screen.getByText('Adresse du site :')).toBeInTheDocument()
    expect(screen.getByText('/contact')).toBeInTheDocument()
    expect(screen.getByText('Mairie de Saint-Étang')).toBeInTheDocument()
    expect(screen.getByText('Autre site :')).toBeInTheDocument()
    expect(screen.getByText('https://www.saint-etang.fr')).toBeInTheDocument()
    expect(screen.getAllByText('Publiée')).toHaveLength(1)
  })

  it('annonce une adresse refusée déjà en base', () => {
    renderManager({
      menu: [linkItem({address: 'javascript:alert(1)', target: 'refused'})],
    })

    expect(
      screen.getByText('Masquée sur le site public — adresse refusée.')
    ).toBeInTheDocument()
  })

  it('n offre « Modifier » qu aux entrées libres', () => {
    renderManager({menu: menuWithLinks()})

    expect(screen.getAllByRole('button', {name: 'Modifier'})).toHaveLength(2)
    expect(
      screen.getAllByRole('button', {name: 'Retirer du menu'})
    ).toHaveLength(3)
  })

  it('valide au blur sans appeler l action, puis ajoute l entrée en dernier rang', async () => {
    const actions = renderManager({menu: [menuItem()]})

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une adresse/})
    )
    const dialog = await screen.findByRole('dialog')
    const label = within(dialog).getByLabelText('Libellé')
    const address = within(dialog).getByLabelText('Adresse')

    await userEvent.click(label)
    await userEvent.tab()
    expect(
      await within(dialog).findByText(
        'Écrivez le libellé affiché dans le menu.'
      )
    ).toBeInTheDocument()

    await userEvent.type(address, 'http://www.saint-etang.fr')
    await userEvent.tab()
    expect(
      await within(dialog).findByText(/commence par http:\/\//)
    ).toBeInTheDocument()
    expect(actions.addLinkAction).not.toHaveBeenCalled()

    await userEvent.type(label, 'Mairie')
    await userEvent.clear(address)
    await userEvent.type(address, 'https://www.saint-etang.fr')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter au menu'})
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(formDataOf(actions.addLinkAction)).toEqual({
      label: 'Mairie',
      address: 'https://www.saint-etang.fr',
    })
    const rows = screen.getAllByRole('listitem')
    expect(rows.at(-1)).toHaveTextContent('Mairie')
  })

  it('résume les erreurs à la soumission, avec un lien vers chaque champ', async () => {
    const actions = renderManager()

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une adresse/})
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter au menu'})
    )

    const summary = await within(dialog).findByRole('alert')
    expect(summary).toHaveTextContent('2 champs à corriger')
    const links = within(summary).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      `#${within(dialog).getByLabelText('Libellé').id}`
    )
    expect(actions.addLinkAction).not.toHaveBeenCalled()
  })

  it('pose sous le bon champ l erreur rendue par le serveur', async () => {
    const actions = renderManager({
      addLinkAction: vi.fn(async () => ({
        status: 'invalid' as const,
        errors: [
          {
            field: 'address' as const,
            message: 'Adresse refusée par le serveur.',
          },
        ],
      })),
    })

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une adresse/})
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Libellé'), 'Contact')
    await userEvent.type(within(dialog).getByLabelText('Adresse'), '/contact')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter au menu'})
    )

    const address = within(dialog).getByLabelText('Adresse')
    await waitFor(() => expect(address).toHaveAttribute('aria-invalid', 'true'))
    const describedBy = (address.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
    expect(describedBy).toContain('Adresse refusée par le serveur.')
    expect(within(dialog).getByLabelText('Libellé')).toHaveAttribute(
      'aria-invalid',
      'false'
    )
    expect(actions.reorderAction).not.toHaveBeenCalled()
  })

  it('garde le dialog ouvert et écrit un échec sans champ en tête', async () => {
    renderManager({
      addLinkAction: vi.fn(async () => ({
        status: 'error' as const,
        message: 'Seul le bureau peut modifier la navigation du site.',
      })),
    })

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une adresse/})
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Libellé'), 'Contact')
    await userEvent.type(within(dialog).getByLabelText('Adresse'), '/contact')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Ajouter au menu'})
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Seul le bureau peut modifier la navigation du site.'
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modifie une entrée libre à sa place, depuis un dialog pré-rempli', async () => {
    const actions = renderManager({menu: menuWithLinks()})

    const [editContact] = screen.getAllByRole('button', {name: 'Modifier'})
    await userEvent.click(editContact)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/reste une adresse/)).toBeInTheDocument()
    const label = within(dialog).getByLabelText('Libellé')
    expect(label).toHaveValue('Nous contacter')
    expect(within(dialog).getByLabelText('Adresse')).toHaveValue('/contact')

    await userEvent.clear(label)
    await userEvent.type(label, 'Écrire au bureau')
    await userEvent.click(
      within(dialog).getByRole('button', {name: "Enregistrer l'entrée"})
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(formDataOf(actions.updateLinkAction)).toEqual({
      menuItemId: '44444444-4444-4444-8444-444444444444',
      label: 'Écrire au bureau',
      address: '/contact',
    })
    const rows = screen.getAllByRole('listitem')
    expect(rows[1]).toHaveTextContent('Écrire au bureau')
    expect(screen.queryByText('Nous contacter')).toBeNull()
    await waitFor(() =>
      expect(screen.getAllByRole('button', {name: 'Modifier'})[0]).toHaveFocus()
    )
  })

  it('met le compteur en faute au 41ᵉ caractère', async () => {
    renderManager()

    await userEvent.click(
      screen.getByRole('button', {name: /Ajouter une adresse/})
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Libellé'),
      'a'.repeat(41)
    )
    await userEvent.tab()

    expect(within(dialog).getByText('41 / 40')).toBeInTheDocument()
    expect(
      await within(dialog).findByText('1 caractère de trop.')
    ).toBeInTheDocument()
  })

  /**
   * Annuler le retrait d'une entree libre la recree par libelle et adresse —
   * jamais par une page — puis rejoue l'ordre avec son nouvel identifiant.
   */
  it('recrée une entrée libre retirée à sa place, par son libellé et son adresse', async () => {
    const actions = renderManager({menu: menuWithLinks()})

    const removeButtons = screen.getAllByRole('button', {
      name: 'Retirer du menu',
    })
    await userEvent.click(removeButtons[1])
    expect(
      await screen.findByText('Entrée « Nous contacter » retirée du menu.')
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Annuler'}))

    await waitFor(() => expect(actions.reorderAction).toHaveBeenCalled())
    expect(actions.addAction).not.toHaveBeenCalled()
    expect(formDataOf(actions.addLinkAction)).toEqual({
      label: 'Nous contacter',
      address: '/contact',
    })
    expect(actions.reorderAction).toHaveBeenLastCalledWith([
      '11111111-1111-4111-8111-111111111111',
      'nouvelle-adresse',
      '55555555-5555-4555-8555-555555555555',
    ])
  })
})
