import {act} from 'react'
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {DocumentLotReachDTO} from '@/services/types/domain/document-template-types'

import {DocumentTemplateLot} from './document-template-lot'

const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const GROUP_ID = '66666666-6666-4666-8666-666666666666'

const profile = (id: string, name: string, hasCurrentParcel = true) => ({
  id,
  name,
  hasCurrentParcel,
})

const REACH: DocumentLotReachDTO = {
  profiles: [
    profile('p1', 'Claire Arnaud'),
    profile('p2', 'Paul Barbier'),
    profile('p3', 'Indivision Faure', false),
  ],
  total: 3,
  withoutCurrentParcel: 1,
}

const reachAction = vi.fn()
const depositAction = vi.fn()

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  reachAction.mockResolvedValue({status: 'ready', reach: REACH})
  depositAction.mockImplementation(async (formData: FormData) => ({
    status: 'deposited',
    documentId: `d-${formData.get('memberProfileId')}`,
  }))
})

const renderLot = () =>
  render(
    <DocumentTemplateLot
      templates={[{id: TEMPLATE_ID, name: 'Convocation AG'}]}
      preselectedTemplateId={TEMPLATE_ID}
      groups={[{id: GROUP_ID, name: 'Riverains', profileCount: 3}]}
      categories={[{id: CATEGORY_ID, name: 'Convocation'}]}
      today="2026-11-25"
      reachAction={reachAction}
      depositAction={depositAction}
    />
  )

const prepare = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', {name: /Tous les membres/}))
  await screen.findByText('Générer et déposer les 3 documents')
  await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
  await user.click(screen.getByRole('option', {name: 'Convocation'}))
  await user.type(
    screen.getByRole('textbox', {name: 'Titre des documents'}),
    'Convocation AG'
  )
}

const launch = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', {name: /Générer et déposer/}))

describe('DocumentTemplateLot — écran 4 (critère 3)', () => {
  it('4a : la règle écrite d’abord, le décompte en fiches de la cible', async () => {
    const user = userEvent.setup()
    renderLot()

    expect(
      screen.getByText(/Aucun fichier regroupé n’est téléchargé/)
    ).toBeInTheDocument()
    await user.click(screen.getByRole('radio', {name: /Tous les membres/}))

    expect(reachAction).toHaveBeenCalledWith({kind: 'all_members'})
    const counter = await screen.findByRole('group', {name: 'Décompte'})
    expect(
      within(counter).getByText('Fiches de la cible').nextSibling
    ).toHaveTextContent('3')
    expect(
      within(counter).getByText('dont sans parcelle actuelle').nextSibling
    ).toHaveTextContent('1')
  })

  it('un groupe : la cible porte le groupe choisi', async () => {
    const user = userEvent.setup()
    renderLot()

    await user.click(screen.getByRole('radio', {name: /Un groupe/}))
    await user.click(screen.getByRole('combobox', {name: 'Groupe'}))
    await user.click(screen.getByRole('option', {name: 'Riverains (3 fiches)'}))

    expect(reachAction).toHaveBeenLastCalledWith({
      kind: 'group',
      groupId: GROUP_ID,
    })
  })

  it('appels séquentiels, un par fiche, jamais deux en vol', async () => {
    let inFlight = 0
    let maxInFlight = 0
    depositAction.mockImplementation(async (formData: FormData) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return {
        status: 'deposited',
        documentId: `d-${formData.get('memberProfileId')}`,
      }
    })
    const user = userEvent.setup()
    renderLot()

    await prepare(user)
    await launch(user)

    expect(await screen.findByText(/Lot terminé/)).toBeInTheDocument()
    expect(depositAction).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(1)
    expect(
      depositAction.mock.calls.map(([formData]) =>
        Object.fromEntries(formData as FormData)
      )
    ).toEqual(
      ['p1', 'p2', 'p3'].map((memberProfileId) => ({
        templateId: TEMPLATE_ID,
        memberProfileId,
        documentDate: '2026-11-25',
        categoryId: CATEGORY_ID,
        title: 'Convocation AG',
      }))
    )
  })

  it('4c : le rapport reprend les résultats du serveur, échecs en tête', async () => {
    depositAction.mockImplementation(async (formData: FormData) =>
      formData.get('memberProfileId') === 'p2'
        ? {
            status: 'failed',
            reason:
              'Le PDF n’a pas pu être produit pour cette fiche. Rien n’a été déposé.',
          }
        : {status: 'deposited', documentId: 'd'}
    )
    const user = userEvent.setup()
    renderLot()

    await prepare(user)
    await launch(user)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Lot terminé : 2 documents déposés, 1 échec.'
    )
    const table = screen.getByRole('table', {name: 'Rapport du lot'})
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Paul Barbier')
    expect(rows[0]).toHaveTextContent('Échec')
    expect(rows[0]).toHaveTextContent(
      'Le PDF n’a pas pu être produit pour cette fiche. Rien n’a été déposé.'
    )
    expect(rows[1]).toHaveTextContent('Claire Arnaud')
    expect(rows[1]).toHaveTextContent('Déposé')
    expect(rows[2]).toHaveTextContent('Aucune parcelle actuelle')
  })

  it('4f : une erreur réseau arrête le lot, le décompte exact est dit', async () => {
    depositAction
      .mockResolvedValueOnce({status: 'deposited', documentId: 'd1'})
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    renderLot()

    await prepare(user)
    await launch(user)

    const alert = await screen.findByText(
      'Le lot s’est arrêté à la fiche 2 sur 3.'
    )
    expect(alert.closest('[role="alert"]')).toHaveTextContent(
      'Le document déjà déposé le reste ; les 2 fiches suivantes n’ont rien reçu.'
    )
    expect(depositAction).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole('table', {name: 'Rapport du lot'})
    ).toHaveTextContent('Claire Arnaud')
  })

  it('4d : une cible vide le dit, et un clic n’envoie rien', async () => {
    reachAction.mockResolvedValue({
      status: 'ready',
      reach: {profiles: [], total: 0, withoutCurrentParcel: 0},
    })
    const user = userEvent.setup()
    renderLot()

    await user.click(screen.getByRole('radio', {name: /Les membres en impayé/}))
    expect(
      await screen.findByText(
        'Aucun membre n’est en impayé aujourd’hui. Aucun document à générer.'
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
    await user.click(screen.getByRole('option', {name: 'Convocation'}))
    await user.type(
      screen.getByRole('textbox', {name: 'Titre des documents'}),
      'Convocation AG'
    )
    await launch(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La cible ne compte aucune fiche : aucun document à générer.'
    )
    expect(depositAction).not.toHaveBeenCalled()
  })

  it('lecture de la cible en échec : dite, sans repli sur « tous »', async () => {
    reachAction.mockResolvedValue({
      status: 'error',
      message: 'La liste des membres en impayé n’a pas pu être lue.',
    })
    const user = userEvent.setup()
    renderLot()

    await user.click(screen.getByRole('radio', {name: /Les membres en impayé/}))

    expect(
      await screen.findByText(
        'La liste des membres en impayé n’a pas pu être lue.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Générer et déposer les 3 documents')).toBeNull()
  })

  it('garde de sortie posée pendant le lot seulement', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    let release: () => void = () => {}
    depositAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({status: 'deposited', documentId: 'd'})
        })
    )
    const user = userEvent.setup()
    renderLot()

    await prepare(user)
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)
    await launch(user)

    expect(
      await screen.findByText('Restez sur cette page jusqu’à la fin.')
    ).toBeInTheDocument()
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)
    for (let call = 0; call < 3; call++) {
      await act(async () => release())
    }

    await screen.findByText(/Lot terminé/)
    expect(remove.mock.calls.some(([type]) => type === 'beforeunload')).toBe(
      true
    )
  })
})
