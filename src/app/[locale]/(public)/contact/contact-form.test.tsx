import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'

vi.mock('./actions', () => ({submitContactAction: vi.fn()}))

import {type ContactFormState, submitContactAction} from './actions'
import {ContactForm} from './contact-form'

const nameField = () => screen.getByRole('textbox', {name: /Votre nom/})
const emailField = () =>
  screen.getByRole('textbox', {name: 'Votre adresse email'})
const subjectField = () => screen.getByRole('textbox', {name: 'Objet'})
const messageField = () => screen.getByRole('textbox', {name: 'Votre message'})
const submitButton = () =>
  screen.getByRole('button', {name: 'Envoyer le message'})

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(nameField(), 'Claire Meunier')
  await user.type(emailField(), 'claire.meunier@example.fr')
  await user.type(subjectField(), "Analyse d'eau du forage")
  await user.type(messageField(), 'Bonjour ?')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(submitContactAction).mockResolvedValue({status: 'sent'})
})

describe('ContactForm — écran 1 du design s08', () => {
  it('présente quatre champs, le nom dit facultatif en clair', () => {
    render(<ContactForm />)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Contacter le bureau'})
    ).toBeInTheDocument()
    expect(screen.getByText('Facultatif')).toBeInTheDocument()
    expect(emailField()).toHaveAttribute('type', 'email')
    expect(emailField()).toHaveAttribute('autocomplete', 'email')
    expect(emailField()).toHaveAttribute('inputmode', 'email')
    expect(subjectField().tagName).toBe('INPUT')
    expect(messageField().tagName).toBe('TEXTAREA')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('refuse un envoi invalide : résumé focalisé, liens d’ancrage, message sous chaque champ', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)

    await user.type(emailField(), 'claire.meunier')
    await user.type(subjectField(), "Analyse d'eau")
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    await waitFor(() => expect(summary).toHaveFocus())
    expect(summary).toHaveAttribute('tabindex', '-1')
    expect(
      within(summary).getByText('Le message n’a pas été envoyé.')
    ).toBeInTheDocument()
    const links = within(summary).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Votre adresse email',
      'Votre message',
    ])
    expect(links[0].getAttribute('href')).toBe(
      `#${emailField().closest('[data-slot="form-item"]')?.id}`
    )

    expect(emailField()).toHaveAttribute('aria-invalid', 'true')
    expect(subjectField()).toHaveAttribute('aria-invalid', 'false')
    const emailError = screen.getByText(
      'Cette adresse email n’est pas valide. Vérifiez qu’elle contient un @ et un nom de domaine.'
    )
    expect(emailField().getAttribute('aria-describedby')).toContain(
      emailError.id
    )
    expect(
      screen.getByText('Écrivez votre message avant de l’envoyer.')
    ).toBeInTheDocument()
    expect(submitContactAction).not.toHaveBeenCalled()
  })

  it('rend les erreurs renvoyées par le serveur sous leur champ', async () => {
    const user = userEvent.setup()
    vi.mocked(submitContactAction).mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'subject', message: 'Objet refusé par le serveur'}],
    })
    render(<ContactForm />)

    await fillValid(user)
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(
      within(summary).getByRole('link', {name: 'Objet'})
    ).toBeInTheDocument()
    expect(screen.getByText('Objet refusé par le serveur')).toBeInTheDocument()
    expect(subjectField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('envoie la locale de la page avec les champs', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)

    await fillValid(user)
    await user.click(submitButton())

    await waitFor(() => expect(submitContactAction).toHaveBeenCalled())
    const [, formData] = vi.mocked(submitContactAction).mock.calls[0]
    expect(Object.fromEntries(formData.entries())).toEqual({
      locale: 'fr',
      name: 'Claire Meunier',
      email: 'claire.meunier@example.fr',
      subject: "Analyse d'eau du forage",
      content: 'Bonjour ?',
    })
  })

  it('remplace le libellé pendant l’envoi, bouton désactivé', async () => {
    const user = userEvent.setup()
    let release: (state: ContactFormState) => void = () => {}
    vi.mocked(submitContactAction).mockImplementation(
      () => new Promise((resolve) => (release = resolve))
    )
    render(<ContactForm />)

    await fillValid(user)
    await user.click(submitButton())

    const pending = await screen.findByRole('button', {name: 'Envoi en cours…'})
    expect(pending).toBeDisabled()
    expect(messageField()).toHaveValue('Bonjour ?')
    release({status: 'sent'})
    await screen.findByRole('status')
  })

  it('remplace le formulaire par un alert neutre, sans vert, et permet d’en écrire un autre', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)

    await fillValid(user)
    await user.click(submitButton())

    const success = await screen.findByRole('status')
    expect(within(success).getByText('Message envoyé.')).toBeInTheDocument()
    expect(success).toHaveTextContent(
      'Le bureau de l’association l’a reçu et vous répondra à l’adresse claire.meunier@example.fr.'
    )
    expect(success.outerHTML).not.toMatch(/green/)
    expect(screen.queryByRole('textbox')).toBeNull()

    await user.click(
      screen.getByRole('button', {name: 'Écrire un autre message'})
    )
    expect(messageField()).toHaveValue('')
  })
})
