import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {MyQuestionFormState} from '@/app/[locale]/(app)/dashboard/question/question-form-validation'
import type {MyQuestionIdentityDTO} from '@/services/types/domain/member-question-types'

import {MyQuestionForm} from './my-question-form'

const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const CATEGORIES = [
  {id: CATEGORY_ID, name: 'Voirie et portails'},
  {id: '66666666-6666-4666-8666-666666666666', name: 'Factures et cotisation'},
]
const IDENTITY: MyQuestionIdentityDTO = {
  name: 'Lucie Moreau',
  email: 'lucie.moreau@exemple.fr',
}

const action =
  vi.fn<
    (
      state: MyQuestionFormState,
      formData: FormData
    ) => Promise<MyQuestionFormState>
  >()

const renderForm = (identity: MyQuestionIdentityDTO = IDENTITY) =>
  render(
    <MyQuestionForm
      categories={CATEGORIES}
      identity={identity}
      action={action}
    />
  )

const categoryField = () =>
  screen.getByRole('combobox', {name: 'Sujet de votre question'})
const bodyField = () => screen.getByRole('textbox', {name: 'Votre question'})
const submitButton = () =>
  screen.getByRole('button', {name: 'Envoyer la question'})

const chooseCategory = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(categoryField())
  await user.click(screen.getByRole('option', {name: 'Voirie et portails'}))
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({status: 'idle'})
})

describe('MyQuestionForm — écran B du design s23', () => {
  it('B1 : deux champs, aucun champ d’identité, et ce que le bureau reçoit avant les boutons', () => {
    renderForm()

    expect(categoryField()).toBeInTheDocument()
    expect(bodyField().tagName).toBe('TEXTAREA')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(
      screen.getByText(
        'Votre question part vers la personne du bureau chargée de ce sujet.'
      )
    ).toBeInTheDocument()

    const intro = screen.getByText(
      'Le bureau saura que c’est vous : nous lui transmettons votre nom et votre adresse email.'
    )
    const values = screen.getByText('Lucie Moreau · lucie.moreau@exemple.fr')
    expect(
      bodyField().compareDocumentPosition(intro) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      values.compareDocumentPosition(submitButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('B1 : sans adresse email, la fiche le dit', () => {
    renderForm({...IDENTITY, email: null})

    expect(
      screen.getByText('Lucie Moreau · Sans adresse email')
    ).toBeInTheDocument()
  })

  it('B1 : un compteur sur 2 000 suit la saisie', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByText(/^0\s\/\s2\s000$/)).toBeInTheDocument()
    await user.type(bodyField(), 'Bonjour')
    expect(screen.getByText(/^7\s\/\s2\s000$/)).toBeInTheDocument()
  })

  it('B1 : un seul bouton default, « Annuler » en outline vers l’espace', () => {
    renderForm()

    const primary = document.querySelectorAll('[data-slot="button"].bg-primary')
    expect(primary).toHaveLength(1)
    expect(primary[0]).toBe(submitButton())
    const cancel = screen.getByRole('link', {name: 'Annuler'})
    expect(cancel).toHaveAttribute('href', '/dashboard')
    expect(cancel).not.toHaveClass('bg-primary')
  })

  it('B2 : erreurs sous chaque champ, résumé ancré, sans envoi', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Deux points à corriger')
    await waitFor(() => expect(summary).toHaveFocus())
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual([
      'Choisissez le sujet de votre question.',
      'Écrivez votre question.',
    ])
    expect(bodyField()).toHaveAttribute('aria-invalid', 'true')
    expect(action).not.toHaveBeenCalled()
  })

  it('envoie le sujet, le texte et la locale, rien d’autre', async () => {
    const user = userEvent.setup()
    renderForm()

    await chooseCategory(user)
    await user.type(bodyField(), 'Qui faut-il prévenir ?')
    await user.click(submitButton())

    await waitFor(() => expect(action).toHaveBeenCalled())
    const [, formData] = action.mock.calls[0]
    expect([...formData.keys()].sort()).toEqual([
      'body',
      'categoryId',
      'locale',
    ])
    expect(formData.get('categoryId')).toBe(CATEGORY_ID)
    expect(formData.get('body')).toBe('Qui faut-il prévenir ?')
    expect(formData.get('locale')).toBe('fr')
  })

  it('B3 : pendant l’envoi, le bouton est désactivé et dit « Envoi en cours… »', async () => {
    action.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    renderForm()

    await chooseCategory(user)
    await user.type(bodyField(), 'Qui faut-il prévenir ?')
    await user.click(submitButton())

    const pending = await screen.findByRole('button', {
      name: 'Envoi en cours…',
    })
    expect(pending).toBeDisabled()
  })

  it('B3 : un échec technique s’annonce, le texte saisi conservé', async () => {
    action.mockResolvedValue({status: 'failed'})
    const user = userEvent.setup()
    renderForm()

    await chooseCategory(user)
    await user.type(bodyField(), 'Qui faut-il prévenir ?')
    await user.click(submitButton())

    expect(
      await screen.findByText(
        'Votre question n’a pas pu être envoyée. Rien n’est perdu : votre texte est toujours là. Réessayez dans un instant.'
      )
    ).toBeInTheDocument()
    expect(bodyField()).toHaveValue('Qui faut-il prévenir ?')
    expect(submitButton()).toBeEnabled()
  })

  it('reporte les erreurs rendues par le serveur sous leur champ', async () => {
    action.mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'categoryId', message: 'Sujet refusé par le serveur.'}],
    })
    const user = userEvent.setup()
    renderForm()

    await chooseCategory(user)
    await user.type(bodyField(), 'Qui faut-il prévenir ?')
    await user.click(submitButton())

    expect(
      await screen.findAllByText('Sujet refusé par le serveur.')
    ).not.toHaveLength(0)
  })
})
