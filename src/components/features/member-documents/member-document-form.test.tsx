import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'

import {MemberDocumentForm} from './member-document-form'

const PROFILE_ID = 'a1200000-0000-4000-8000-000000000008'
const CATEGORIES: PublicCategoryDTO[] = [
  {id: '44444444-4444-4444-8444-444444444444', name: 'Facture'},
  {id: '55555555-5555-4555-8555-555555555555', name: 'Convocation'},
]

const saveAction = vi.fn()

const pdf = (size = 4) =>
  new File([new Uint8Array(size)], 'facture-2026.pdf', {
    type: 'application/pdf',
  })
const png = () =>
  new File([new Uint8Array([0x89, 0x50])], 'photo.png', {type: 'image/png'})

const renderForm = (categories = CATEGORIES) =>
  render(
    <MemberDocumentForm
      memberProfile={{id: PROFILE_ID, name: 'Bernard Lefèvre'}}
      parcelNumbers={['12', '13']}
      categories={categories}
      today="2026-11-25"
      saveAction={saveAction}
    />
  )

const titleField = () => screen.getByRole('textbox', {name: 'Titre'})
const dateField = () => screen.getByRole('textbox', {name: 'Date du document'})
const categoryField = () => screen.getByRole('combobox', {name: 'Catégorie'})
const fileField = () => screen.getByLabelText('Fichier')
const submitButton = () =>
  screen.getByRole('button', {name: /Déposer le document|Dépôt en cours/})

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'idle'})
})

describe('MemberDocumentForm — écran 3 du design s32', () => {
  it('3a : pour qui, quatre champs, date du jour pré-remplie, fil d’Ariane vers la fiche', () => {
    renderForm()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Déposer un document'})
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Bernard Lefèvre'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}`
    )
    expect(screen.getByText('Pour')).toBeInTheDocument()
    expect(screen.getByText(/Parcelles/)).toHaveTextContent(
      'Parcelles 12 et 13'
    )
    expect(titleField()).toBeInTheDocument()
    expect(categoryField()).toBeInTheDocument()
    expect(dateField()).toHaveValue('25/11/2026')
    expect(fileField()).toHaveAttribute('accept', 'application/pdf')
    expect(
      screen.getAllByText('PDF uniquement, 10 Mo au plus.').length
    ).toBeGreaterThan(0)
    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      `/bureau/proprietaires/${PROFILE_ID}`
    )
  })

  it('envoie la fiche, le titre, la catégorie, la date ISO et le PDF en une soumission', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(titleField(), '  Facture 2026 ')
    await user.click(categoryField())
    await user.click(screen.getByRole('option', {name: 'Facture'}))
    await user.clear(dateField())
    await user.type(dateField(), '15032026')
    await user.upload(fileField(), pdf())
    await user.click(submitButton())

    expect(saveAction).toHaveBeenCalledTimes(1)
    const formData = saveAction.mock.calls[0][1] as FormData
    expect(formData.get('memberProfileId')).toBe(PROFILE_ID)
    expect(formData.get('title')).toBe('Facture 2026')
    expect(formData.get('categoryId')).toBe(CATEGORIES[0].id)
    expect(formData.get('documentDate')).toBe('2026-03-15')
    expect((formData.get('file') as File).name).toBe('facture-2026.pdf')
  })

  it('3b : refuse sans envoyer — résumé ancré et messages de champ', async () => {
    const user = userEvent.setup({applyAccept: false})
    renderForm()

    await user.clear(dateField())
    await user.type(dateField(), '3102')
    await user.upload(fileField(), png())
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(
      'Le document n’a pas été déposé. Rien n’est perdu.'
    )
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual([
      'Saisissez un titre, par exemple « Facture 2026 ».',
      'Choisissez une catégorie.',
      'Saisissez une date au format jj/mm/aaaa.',
      'Ce fichier n’est pas un PDF. Enregistrez le document en PDF puis déposez-le à nouveau.',
    ])
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('3b : un refus du serveur s’écrit sous son champ', async () => {
    saveAction.mockResolvedValue({
      status: 'rejected',
      issues: ['file_format'],
    })
    const user = userEvent.setup()
    renderForm()

    await user.type(titleField(), 'Facture 2026')
    await user.click(categoryField())
    await user.click(screen.getByRole('option', {name: 'Facture'}))
    await user.upload(fileField(), pdf())
    await user.click(submitButton())

    expect(
      await screen.findAllByText(
        'Ce fichier n’est pas un PDF. Enregistrez le document en PDF puis déposez-le à nouveau.'
      )
    ).not.toHaveLength(0)
  })

  it('3c : sans catégorie active, le formulaire n’est pas proposé', () => {
    renderForm([])

    expect(
      screen.getByText('Aucune catégorie de document nominatif.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: /Gérer les catégories/})
    ).toHaveAttribute('href', '/bureau/documents-nominatifs/categories')
    expect(screen.queryByRole('textbox', {name: 'Titre'})).toBeNull()
  })
})
