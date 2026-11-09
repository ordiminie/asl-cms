import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {MyReportFormState} from '@/app/[locale]/(app)/dashboard/signaler/my-report-form-validation'
import type {MyReportIdentityDTO} from '@/services/types/domain/incident-report-types'

import {MyReportForm} from './my-report-form'

const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const CATEGORIES = [
  {id: CATEGORY_ID, name: "Fuite d'eau"},
  {id: '66666666-6666-4666-8666-666666666666', name: 'Voirie'},
]
const IDENTITY: MyReportIdentityDTO = {
  name: 'Lucie Moreau',
  email: 'lucie.moreau@exemple.fr',
  phone: '06 12 34 56 78',
}

const action =
  vi.fn<
    (state: MyReportFormState, formData: FormData) => Promise<MyReportFormState>
  >()

const renderForm = (
  overrides: {
    categories?: typeof CATEGORIES
    identity?: MyReportIdentityDTO
  } = {}
) =>
  render(
    <MyReportForm
      categories={overrides.categories ?? CATEGORIES}
      identity={overrides.identity ?? IDENTITY}
      action={action}
    />
  )

const categoryField = () =>
  screen.getByRole('combobox', {name: 'De quoi s’agit-il ?'})
const locationField = () => screen.getByRole('textbox', {name: 'Où ?'})
const descriptionField = () =>
  screen.getByRole('textbox', {name: 'Que se passe-t-il ?'})
const submitButton = () =>
  screen.getByRole('button', {name: 'Envoyer le signalement'})

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({status: 'idle'})
})

describe('MyReportForm — écran B du design s22', () => {
  it('B1 : les trois champs, aucun champ d’identité, et ce que le bureau reçoit avant les boutons', () => {
    renderForm()

    expect(categoryField()).toBeInTheDocument()
    expect(descriptionField().tagName).toBe('TEXTAREA')
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.queryByRole('textbox', {name: /nom/i})).toBeNull()
    expect(screen.queryByRole('textbox', {name: /email/i})).toBeNull()
    expect(screen.queryByRole('textbox', {name: /téléphone/i})).toBeNull()

    const intro = screen.getByText(
      'Le bureau saura que c’est vous : nous lui transmettons votre nom, votre adresse email et votre téléphone.'
    )
    const values = screen.getByText(
      'Lucie Moreau · lucie.moreau@exemple.fr · 06 12 34 56 78'
    )
    expect(
      descriptionField().compareDocumentPosition(intro) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      values.compareDocumentPosition(submitButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('B1 : un seul bouton default, « Annuler » en outline vers l’espace', () => {
    renderForm()

    const primary = document.querySelectorAll('[data-slot="button"].bg-primary')
    expect(primary).toHaveLength(1)
    expect(primary[0]).toBe(submitButton())
    const cancel = screen.getByRole('link', {name: 'Annuler'})
    expect(cancel).toHaveAttribute('href', '/dashboard')
    expect(cancel).toHaveClass('border-input')
    expect(cancel).not.toHaveClass('bg-primary')
  })

  it('B2 : erreurs de s10 sous chaque champ, résumé ancré, valeurs conservées, sans envoi', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(descriptionField(), 'L’eau sort du robinet commun.')
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Le signalement n’a pas été envoyé.')
    await waitFor(() => expect(summary).toHaveFocus())
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['De quoi s’agit-il ?', 'Où ?'])
    expect(
      screen.getByText('Choisissez ce que vous signalez.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Indiquez où : une adresse, un numéro de parcelle ou un repère.'
      )
    ).toBeInTheDocument()
    expect(locationField()).toHaveAttribute('aria-invalid', 'true')
    expect(descriptionField()).toHaveValue('L’eau sort du robinet commun.')
    expect(action).not.toHaveBeenCalled()
  })

  it('envoie la catégorie, le lieu, la description et la locale, rien d’autre', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(categoryField())
    await user.click(screen.getByRole('option', {name: "Fuite d'eau"}))
    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    await waitFor(() => expect(action).toHaveBeenCalled())
    const [, formData] = action.mock.calls[0]
    expect([...formData.keys()].sort()).toEqual([
      'categoryId',
      'description',
      'locale',
      'location',
    ])
    expect(formData.get('categoryId')).toBe(CATEGORY_ID)
    expect(formData.get('location')).toBe('Chemin des Pins')
    expect(formData.get('description')).toBe('Ça coule fort.')
    expect(formData.get('locale')).toBe('fr')
  })

  it('B3 : pendant l’envoi, le bouton est désactivé et dit « Envoi en cours… »', async () => {
    action.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    renderForm({categories: []})

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    const pending = await screen.findByRole('button', {
      name: 'Envoi en cours…',
    })
    expect(pending).toBeDisabled()
  })

  it('B4 : un échec technique s’annonce en tête, le texte saisi conservé', async () => {
    action.mockResolvedValue({status: 'failed'})
    const user = userEvent.setup()
    renderForm({categories: []})

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    expect(
      await screen.findByText(
        'Le signalement n’a pas pu être envoyé. Votre texte est conservé : réessayez dans un instant.'
      )
    ).toBeInTheDocument()
    expect(locationField()).toHaveValue('Chemin des Pins')
    expect(descriptionField()).toHaveValue('Ça coule fort.')
    expect(submitButton()).toBeEnabled()
  })

  it('B5 : sans catégorie, le champ disparaît et le formulaire commence par « Où ? »', () => {
    renderForm({categories: []})

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('De quoi s’agit-il ?')).toBeNull()
    expect(locationField()).toBeInTheDocument()
  })

  it('B6 : sans téléphone, la phrase s’adapte et propose d’ajouter le téléphone', () => {
    renderForm({identity: {...IDENTITY, phone: null}})

    expect(
      screen.getByText(
        'Le bureau saura que c’est vous : nous lui transmettons votre nom et votre adresse email.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Lucie Moreau · lucie.moreau@exemple.fr · téléphone non renseigné'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Ajouter mon téléphone'})
    ).toHaveAttribute('href', '/dashboard#mes-coordonnees')
  })

  it('B1 : avec un téléphone, aucun lien pour l’ajouter', () => {
    renderForm()

    expect(
      screen.queryByRole('link', {name: 'Ajouter mon téléphone'})
    ).toBeNull()
  })
})
