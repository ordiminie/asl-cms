import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'

import {SharedDocumentForm} from './shared-document-form'

const CATEGORIES: PublicCategoryDTO[] = [
  {id: '44444444-4444-4444-8444-444444444444', name: 'Ordres du jour'},
  {id: '55555555-5555-4555-8555-555555555555', name: 'Statuts'},
]

const saveAction = vi.fn()

const pdf = (size = 4) =>
  new File([new Uint8Array(size)], 'ordre-du-jour-ag-2026.pdf', {
    type: 'application/pdf',
  })
const png = () =>
  new File([new Uint8Array([0x89, 0x50])], 'photo.png', {type: 'image/png'})

const renderForm = (categories = CATEGORIES) =>
  render(<SharedDocumentForm categories={categories} saveAction={saveAction} />)

const titleField = () => screen.getByRole('textbox', {name: 'Titre'})
const categoryField = () => screen.getByRole('combobox', {name: 'Catégorie'})
const fileField = () => screen.getByLabelText('Fichier')
const submitButton = () =>
  screen.getByRole('button', {name: /Déposer le document|Dépôt en cours/})

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(titleField(), 'Ordre du jour de l’AG 2026')
  await user.click(categoryField())
  await user.click(screen.getByRole('option', {name: 'Ordres du jour'}))
  await user.upload(fileField(), pdf())
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'idle'})
})

describe('SharedDocumentForm — écran 3 du design s31', () => {
  it('3a : trois champs, consignes annoncées avant tout dépôt, fil d’Ariane', () => {
    renderForm()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Déposer un document'})
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Documents'})).toHaveAttribute(
      'href',
      '/bureau/documents'
    )
    expect(titleField()).toBeInTheDocument()
    expect(categoryField()).toBeInTheDocument()
    expect(fileField()).toHaveAttribute('accept', 'application/pdf')
    expect(
      screen.getByText(
        'Le titre que lisent les membres, par exemple « Procès-verbal de l’AG du 14 juin 2025 ».'
      )
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('PDF uniquement, 10 Mo au plus.').length
    ).toBeGreaterThan(0)
    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      '/bureau/documents'
    )
  })

  it('3a : compte le titre sur 120', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(titleField(), 'Statuts')

    expect(screen.getByText('7 / 120')).toBeInTheDocument()
  })

  it('envoie le titre, la catégorie et le PDF en une seule soumission', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(saveAction).toHaveBeenCalledTimes(1)
    const formData = saveAction.mock.calls[0][1] as FormData
    expect(formData.get('title')).toBe('Ordre du jour de l’AG 2026')
    expect(formData.get('categoryId')).toBe(CATEGORIES[0].id)
    expect((formData.get('file') as File).name).toBe(
      'ordre-du-jour-ag-2026.pdf'
    )
  })

  it('3b : refuse sans envoyer un titre vide, sans catégorie, un non-PDF — résumé ancré et messages', async () => {
    const user = userEvent.setup({applyAccept: false})
    renderForm()

    await user.upload(fileField(), png())
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(
      'Le document n’a pas été déposé. Rien n’est perdu.'
    )
    const links = within(summary).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Saisissez un titre, par exemple « Statuts de l’ASL ».',
      'Choisissez une catégorie.',
      'Ce fichier n’est pas un PDF. Enregistrez le document en PDF puis déposez-le à nouveau.',
    ])
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('3b : dit le poids d’un PDF au-delà de 10 Mo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(titleField(), 'Gros PV')
    await user.click(categoryField())
    await user.click(screen.getByRole('option', {name: 'Statuts'}))
    await user.upload(fileField(), pdf(Math.round(14.2 * 1024 * 1024)))
    await user.click(submitButton())

    expect(
      (
        await screen.findAllByText(
          'Ce fichier pèse 14,2 Mo : le plafond est de 10 Mo.'
        )
      ).length
    ).toBeGreaterThan(0)
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('3b : affiche sous le bon champ un refus rendu par le serveur', async () => {
    saveAction.mockResolvedValue({status: 'rejected', issues: ['file_format']})
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findAllByText(
        'Ce fichier n’est pas un PDF. Enregistrez le document en PDF puis déposez-le à nouveau.'
      )
    ).toHaveLength(2)
  })

  it('3b : une panne serveur est dite dans le résumé', async () => {
    saveAction.mockResolvedValue({status: 'error', message: 'Réessayez.'})
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Réessayez.')
  })

  it('3c : sans catégorie active, le formulaire n’est pas proposé', () => {
    renderForm([])

    expect(screen.queryByRole('textbox', {name: 'Titre'})).toBeNull()
    expect(
      screen.getByText('Aucune catégorie de document.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer les catégories'})
    ).toHaveAttribute('href', '/bureau/documents/categories')
  })

  it('3d : pendant le dépôt, progression indéterminée et bouton désactivé', async () => {
    let finish: (value: unknown) => void = () => undefined
    saveAction.mockImplementation(
      () => new Promise((resolve) => (finish = resolve))
    )
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByRole('button', {name: 'Dépôt en cours…'})
    ).toBeDisabled()
    expect(
      screen.getByRole('progressbar', {
        name: 'Envoi de ordre-du-jour-ag-2026.pdf',
      })
    ).toBeInTheDocument()

    finish({status: 'idle'})
  })
})
