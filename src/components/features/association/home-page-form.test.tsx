import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import {PageStatus} from '@/services/types/domain/page-types'

import {HomePageActionResult, HomePageForm} from './home-page-form'

const WELCOME = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Bienvenue aux Amis de l’Étang',
  status: 'published' as PageStatus,
}
const WATER = {
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Qualité de l’eau',
  status: 'published' as PageStatus,
}
const DRAFT = {
  id: '55555555-5555-4555-8555-555555555555',
  title: 'Compte-rendu AG 2025',
  status: 'draft' as PageStatus,
}

const saveAction =
  vi.fn<(pageId: string | null) => Promise<HomePageActionResult>>()

const automaticChoice = () =>
  screen.getByRole('radio', {name: /L’accueil automatique/})
const pageChoice = () => screen.getByRole('radio', {name: /Une page du site/})
const pageSelect = () => screen.getByRole('combobox', {name: 'Page choisie'})
const saveButton = () => screen.getByRole('button')

beforeAll(() => {
  // Radix Select s'appuie sur des API de pointeur absentes de jsdom.
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'saved'})
})

describe('HomePageForm — a. rien de choisi', () => {
  it('l accueil automatique est sélectionné, sans liste de pages', () => {
    render(
      <HomePageForm
        current={null}
        pages={[WELCOME, DRAFT]}
        saveAction={saveAction}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Page d’accueil'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Ce que voient les visiteurs',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Aujourd’hui : l’accueil automatique.')
    ).toBeInTheDocument()
    expect(automaticChoice()).toBeChecked()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('un seul bouton, « Enregistrer l’accueil » ; « Voir l’accueil du site » est un lien vers un nouvel onglet', () => {
    render(
      <HomePageForm current={null} pages={[WELCOME]} saveAction={saveAction} />
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(saveButton()).toHaveTextContent('Enregistrer l’accueil')
    const view = screen.getByRole('link', {
      name: 'Voir l’accueil du site (s’ouvre dans un nouvel onglet)',
    })
    expect(view).toHaveAttribute('href', '/')
    expect(view).toHaveAttribute('target', '_blank')
  })
})

describe('HomePageForm — b. une page choisie, enregistrée', () => {
  it('ne propose que les pages publiées, et enregistre la page choisie', async () => {
    const user = userEvent.setup()
    render(
      <HomePageForm
        current={null}
        pages={[DRAFT, WATER, WELCOME]}
        saveAction={saveAction}
      />
    )

    await user.click(pageChoice())
    await user.click(pageSelect())

    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['Qualité de l’eau', 'Bienvenue aux Amis de l’Étang'])

    await user.click(
      screen.getByRole('option', {name: 'Bienvenue aux Amis de l’Étang'})
    )
    await user.click(saveButton())

    expect(saveAction).toHaveBeenCalledWith(WELCOME.id)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Accueil enregistré. Les visiteurs voient maintenant la page « Bienvenue aux Amis de l’Étang » à l’adresse de l’association.'
    )
    expect(
      screen.getByText(
        'Aujourd’hui : la page « Bienvenue aux Amis de l’Étang ».'
      )
    ).toBeInTheDocument()
  })

  it('page déjà désignée : choix 2 et la page dans la liste', () => {
    render(
      <HomePageForm
        current={WELCOME}
        pages={[WELCOME, WATER]}
        saveAction={saveAction}
      />
    )

    expect(pageChoice()).toBeChecked()
    expect(pageSelect()).toHaveTextContent('Bienvenue aux Amis de l’Étang')
    expect(
      screen.getByText(
        'Aujourd’hui : la page « Bienvenue aux Amis de l’Étang ».'
      )
    ).toBeInTheDocument()
  })

  it('revenir à l accueil automatique enregistre null', async () => {
    const user = userEvent.setup()
    render(
      <HomePageForm
        current={WELCOME}
        pages={[WELCOME]}
        saveAction={saveAction}
      />
    )

    await user.click(automaticChoice())
    await user.click(saveButton())

    expect(saveAction).toHaveBeenCalledWith(null)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Les visiteurs voient maintenant l’accueil automatique'
    )
  })
})

describe('HomePageForm — c. aucune page publiée', () => {
  it('le choix 2 est désactivé, la raison est écrite avec un lien pour publier', () => {
    render(
      <HomePageForm current={null} pages={[DRAFT]} saveAction={saveAction} />
    )

    expect(pageChoice()).toBeDisabled()
    expect(automaticChoice()).toBeChecked()
    expect(
      screen.getByText('Aucune page n’est publiée pour l’instant.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Publier une page'})
    ).toHaveAttribute('href', '/bureau/pages')
  })
})

describe('HomePageForm — d. la page désignée n’est plus publiée', () => {
  it('avertit en tête de carte et montre la page comme non publiée', () => {
    const unpublished = {...WELCOME, status: 'unpublished' as PageStatus}
    render(
      <HomePageForm
        current={unpublished}
        pages={[unpublished, WATER]}
        saveAction={saveAction}
      />
    )

    expect(
      screen.getByText(
        'Aujourd’hui : l’accueil automatique, la page « Bienvenue aux Amis de l’Étang » n’étant plus publiée.'
      )
    ).toBeInTheDocument()
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent(
      'La page « Bienvenue aux Amis de l’Étang » n’est plus publiée.'
    )
    expect(
      within(warning).getByRole('link', {name: 'Ouvrir la page'})
    ).toHaveAttribute('href', `/bureau/pages/${WELCOME.id}`)
    expect(pageChoice()).toBeChecked()
    expect(pageSelect()).toHaveTextContent(
      'Bienvenue aux Amis de l’Étang — non publiée'
    )
  })
})

describe('HomePageForm — e. échec d’enregistrement', () => {
  it('écrit l échec au-dessus des actions, sans toast', async () => {
    const user = userEvent.setup()
    saveAction.mockResolvedValue({
      status: 'error',
      message: 'L’accueil n’a pas été enregistré.',
    })
    render(
      <HomePageForm current={null} pages={[WELCOME]} saveAction={saveAction} />
    )

    await user.click(saveButton())

    const failure = await screen.findByRole('alert')
    expect(failure).toHaveTextContent('L’accueil n’a pas été enregistré.')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('page dépubliée entre-temps : le message du serveur', async () => {
    const user = userEvent.setup()
    saveAction.mockResolvedValue({
      status: 'not_published',
      message: 'Cette page n’est plus publiée. Choisissez-en une autre.',
    })
    render(
      <HomePageForm current={null} pages={[WELCOME]} saveAction={saveAction} />
    )

    await user.click(pageChoice())
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette page n’est plus publiée. Choisissez-en une autre.'
    )
  })
})

describe('HomePageForm — f. enregistrement en cours', () => {
  it('libellé « Enregistrement… », bouton occupé et désactivé, largeur conservée', async () => {
    const user = userEvent.setup()
    let finish: (result: HomePageActionResult) => void = () => {}
    saveAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    render(
      <HomePageForm current={null} pages={[WELCOME]} saveAction={saveAction} />
    )
    const widthClasses = saveButton()
      .className.split(' ')
      .filter((name) => name.includes('min-w') || name.includes('w-full'))

    await user.click(saveButton())

    expect(saveButton()).toHaveTextContent('Enregistrement…')
    expect(saveButton()).toHaveAttribute('aria-busy', 'true')
    expect(saveButton()).toBeDisabled()
    expect(widthClasses.length).toBeGreaterThan(0)
    for (const name of widthClasses) {
      expect(saveButton()).toHaveClass(name)
    }

    finish({status: 'saved'})
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
