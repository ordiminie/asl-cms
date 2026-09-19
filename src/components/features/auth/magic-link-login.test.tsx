import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {MagicLinkRequestState} from '@/app/[locale]/(auth)/action'

import {MagicLinkLogin, MagicLinkRequestAction} from './magic-link-login'

const ADDRESS = 'm.durand@exemple.test'

const resolving = (state: MagicLinkRequestState): MagicLinkRequestAction =>
  vi.fn(async () => state)

const setup = (action: MagicLinkRequestAction = resolving({status: 'sent'})) => {
  const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime})
  render(<MagicLinkLogin requestAction={action} />)
  return {user, action}
}

const emailField = () => screen.getByLabelText('Adresse email')
const submitButton = () =>
  screen.getByRole('button', {name: 'Recevoir mon lien de connexion'})

const requestLink = async (
  user: ReturnType<typeof userEvent.setup>,
  address = ADDRESS
) => {
  await user.type(emailField(), address)
  await user.click(submitButton())
}

describe('MagicLinkLogin — écran A', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true})
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('présente un seul champ adresse, sans mot de passe', () => {
    setup()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Se connecter à votre espace'})
    ).toBeInTheDocument()
    expect(screen.getByText(/aucun mot de passe/)).toBeInTheDocument()
    const field = emailField()
    expect(field).toHaveAttribute('type', 'email')
    expect(field).toHaveAttribute('autocomplete', 'email')
    expect(field).toHaveAttribute('inputmode', 'email')
    expect(field).toHaveAttribute('autocapitalize', 'none')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(submitButton()).toBeInTheDocument()
    expect(
      screen.getByText(/Vous n'avez pas d'adresse email \?/)
    ).toBeInTheDocument()
  })

  it('signale une adresse invalide au blur, et n’envoie rien', async () => {
    const {user, action} = setup()

    await user.type(emailField(), 'pas-une-adresse')
    await user.tab()

    expect(
      await screen.findByText(
        "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"
      )
    ).toBeInTheDocument()
    expect(emailField()).toHaveAttribute('aria-invalid', 'true')

    await user.click(submitButton())
    expect(action).not.toHaveBeenCalled()
  })

  it('affiche l’état de chargement pendant l’envoi', async () => {
    let release: (state: MagicLinkRequestState) => void = () => {}
    const action: MagicLinkRequestAction = vi.fn(
      () =>
        new Promise<MagicLinkRequestState>((resolve) => (release = resolve))
    )
    const {user} = setup(action)

    await requestLink(user)

    const loading = screen.getByRole('button', {name: 'Envoi en cours…'})
    expect(loading).toBeDisabled()

    await act(async () => release({status: 'sent'}))
  })

  it('ancre l’alerte « service en panne » et garde l’adresse', async () => {
    const {user} = setup(resolving({status: 'unavailable'}))

    await requestLink(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Le lien n'a pas pu être envoyé.")
    expect(alert).toHaveTextContent("Votre adresse n'est pas en cause.")
    expect(emailField()).toHaveValue(ADDRESS)
  })

  it('reprend l’erreur de champ renvoyée par le serveur', async () => {
    const {user} = setup(
      resolving({
        status: 'invalid',
        errors: [{field: 'email', message: 'Adresse refusée par le serveur'}],
      })
    )

    await requestLink(user)

    expect(
      await screen.findByText('Adresse refusée par le serveur')
    ).toBeInTheDocument()
  })

  it('mène au formulaire prestataire par un lien discret', () => {
    setup()

    expect(
      screen.getByRole('link', {name: 'Accès prestataire'})
    ).toHaveAttribute('href', '/login/prestataire')
  })
})

describe('MagicLinkLogin — écran B', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true})
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dit quoi faire, en termes conditionnels, sans l’adresse dans l’URL', async () => {
    const {user, action} = setup()
    const urlBefore = window.location.href

    await requestLink(user)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Consultez votre boîte mail',
      })
    ).toBeInTheDocument()
    expect(action).toHaveBeenCalledOnce()
    const sentData = vi.mocked(action).mock.calls[0][1]
    expect(sentData.get('email')).toBe(ADDRESS)
    expect(sentData.get('locale')).toBe('fr')

    const main = screen.getByTestId('magic-link-sent')
    expect(main).toHaveTextContent(
      `Si l'adresse ${ADDRESS} est enregistrée, un lien de connexion vient de lui être envoyé. Il est valable 20 minutes et ne sert qu'une fois.`
    )
    expect(
      screen.getByRole('heading', {level: 2, name: "Rien n'arrive ?"})
    ).toBeInTheDocument()
    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(main).toHaveTextContent('aucune adresse n\'est enregistrée pour votre parcelle')
    expect(main).toHaveTextContent(
      "Besoin d'aide ? Appelez le bureau de votre association."
    )

    expect(window.location.href).toBe(urlBefore)
    expect(window.location.href).not.toContain(encodeURIComponent(ADDRESS))
    expect(window.location.href).not.toContain(ADDRESS)
  })

  it('montre le même texte quelle que soit l’adresse', async () => {
    const textFor = async (address: string) => {
      const {user} = setup()
      await requestLink(user, address)
      const text = (await screen.findByTestId('magic-link-sent')).textContent
      document.body.innerHTML = ''
      return text?.replaceAll(address, '{adresse}')
    }

    const known = await textFor('membre@exemple.test')
    const unknown = await textFor('inconnu@exemple.test')

    expect(unknown).toBe(known)
  })

  it('désactive « Renvoyer un lien » 60 s avec un compte à rebours écrit', async () => {
    const {user, action} = setup()
    await requestLink(user)

    const countdown = await screen.findByRole('button', {
      name: 'Renvoyer un lien (disponible dans 60 s)',
    })
    expect(countdown).toBeDisabled()

    await act(async () => vi.advanceTimersByTime(15_000))
    expect(
      screen.getByRole('button', {name: 'Renvoyer un lien (disponible dans 45 s)'})
    ).toBeDisabled()

    await act(async () => vi.advanceTimersByTime(45_000))
    const resend = screen.getByRole('button', {name: 'Renvoyer un lien'})
    expect(resend).toBeEnabled()

    await user.click(resend)

    expect(action).toHaveBeenCalledTimes(2)
    expect(vi.mocked(action).mock.calls[1][1].get('email')).toBe(ADDRESS)
    expect(vi.mocked(action).mock.calls[1][1].get('locale')).toBe('fr')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Un nouveau lien a été envoyé, si l\'adresse est enregistrée.'
    )
    expect(
      screen.getByRole('button', {name: 'Renvoyer un lien (disponible dans 60 s)'})
    ).toBeDisabled()
  })

  it('« Corriger l’adresse » revient à l’écran A, adresse pré-remplie', async () => {
    const {user} = setup()
    await requestLink(user)

    await user.click(
      await screen.findByRole('button', {name: "Corriger l'adresse"})
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Se connecter à votre espace'})
    ).toBeInTheDocument()
    expect(emailField()).toHaveValue(ADDRESS)
  })
})
