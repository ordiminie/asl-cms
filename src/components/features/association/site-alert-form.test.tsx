import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'

import {SiteAlertActionResult, SiteAlertForm} from './site-alert-form'

const MESSAGE = 'Coupure d’eau rue des Pins, jeudi de 8 h à 12 h.'

const saveAction =
  vi.fn<(message: string, active: boolean) => Promise<SiteAlertActionResult>>()
const removeAction = vi.fn<() => Promise<SiteAlertActionResult>>()

const renderForm = (initial = {message: '', active: false}) =>
  render(
    <SiteAlertForm
      initialAlert={initial}
      saveAction={saveAction}
      removeAction={removeAction}
    />
  )

const field = () => screen.getByLabelText('Message de l’alerte')
const showButton = () =>
  screen.getByRole('button', {name: 'Afficher le bandeau sur le site'})

beforeEach(() => {
  saveAction.mockReset()
  removeAction.mockReset()
  saveAction.mockImplementation(async (_, active) => ({
    status: 'saved',
    active,
  }))
  removeAction.mockResolvedValue({status: 'saved', active: false})
})

describe('SiteAlertForm — 1a vide', () => {
  it('premiere visite : compteur a zero, pas d apercu, un seul bouton', () => {
    renderForm()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Bandeau d’alerte'})
    ).toBeInTheDocument()
    expect(field()).toHaveValue('')
    expect(field()).toHaveAttribute('rows', '4')
    expect(
      screen.getByText(
        '280 caractères au maximum. Texte simple, sans lien : écrivez la date, l’heure et le lieu.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('0 / 280')).toHaveClass(
      'tabular-nums',
      'text-muted-foreground'
    )
    expect(
      screen.getByText('Écrivez un message pour voir l’aperçu.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.getByText('Bandeau masqué')).toBeInTheDocument()
    expect(showButton()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Retirer le bandeau'})
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('l apercu rend le vrai bandeau des la saisie', async () => {
    renderForm()

    await userEvent.type(field(), 'Coupure')

    expect(
      screen.getByRole('region', {name: "Alerte de l'association"})
    ).toHaveTextContent('Coupure')
    expect(screen.getByText('7 / 280')).toBeInTheDocument()
  })
})

describe('SiteAlertForm — 1b chargement', () => {
  it('remplace le libelle et desactive le bouton pendant l enregistrement', async () => {
    let finish: (result: SiteAlertActionResult) => void = () => {}
    saveAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    renderForm()

    await userEvent.type(field(), MESSAGE)
    await userEvent.click(showButton())

    const button = await screen.findByRole('button', {
      name: 'Enregistrement…',
    })
    expect(button).toBeDisabled()
    expect(saveAction).toHaveBeenCalledWith(MESSAGE, true)

    // Une action asynchrone en suspens retient toutes les transitions de
    // React : elle doit se terminer avant le test suivant.
    finish({status: 'saved', active: true})
    expect(
      await screen.findByRole('button', {name: 'Enregistrer le message'})
    ).toBeEnabled()
  })
})

describe('SiteAlertForm — 1c message vide a la soumission', () => {
  it('ecrit l erreur au champ sans appeler l action', async () => {
    renderForm()

    await userEvent.click(showButton())

    expect(
      screen.getByText('Écrivez le message avant d’afficher le bandeau.')
    ).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveClass('border-2', 'border-destructive')
    expect(saveAction).not.toHaveBeenCalled()
  })
})

describe('SiteAlertForm — 1d plus de 280 caracteres', () => {
  it('compteur, bordure et message ecrit au depassement', async () => {
    renderForm({message: 'a'.repeat(313), active: false})

    const counter = screen.getByText('313 / 280')
    expect(counter).toHaveClass('text-destructive-text', 'font-semibold')
    expect(field()).toHaveClass('border-2', 'border-destructive')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('33 caractères de trop.')).toBeInTheDocument()

    await userEvent.click(showButton())

    expect(saveAction).not.toHaveBeenCalled()
  })

  it('a 280 caracteres pile, pas d erreur', () => {
    renderForm({message: 'a'.repeat(280), active: false})

    expect(screen.getByText('280 / 280')).toHaveClass('text-muted-foreground')
    expect(field()).not.toHaveAttribute('aria-invalid')
  })
})

describe('SiteAlertForm — 1e echec d enregistrement', () => {
  it('alerte ancree en tete, role alert, message conserve dans le champ', async () => {
    saveAction.mockResolvedValue({
      status: 'error',
      message:
        'Rien n’est perdu : votre message est toujours dans le champ. Réessayez dans un instant.',
    })
    renderForm()

    await userEvent.type(field(), MESSAGE)
    await userEvent.click(showButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Le bandeau n’a pas pu être enregistré.')
    expect(alert).toHaveTextContent('Rien n’est perdu')
    expect(field()).toHaveValue(MESSAGE)
    expect(screen.getByText('Bandeau masqué')).toBeInTheDocument()
  })

  it('une erreur de validation du serveur est ecrite au champ', async () => {
    saveAction.mockResolvedValue({
      status: 'invalid',
      message: 'Écrivez le message avant d’afficher le bandeau.',
    })
    renderForm()

    await userEvent.type(field(), '   ')
    await userEvent.click(showButton())

    expect(
      await screen.findByText('Écrivez le message avant d’afficher le bandeau.')
    ).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('une panne du transport est rendue sans lever', async () => {
    saveAction.mockRejectedValue(new Error('reseau'))
    renderForm()

    await userEvent.type(field(), MESSAGE)
    await userEvent.click(showButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Rien n’est perdu'
    )
  })
})

describe('SiteAlertForm — 1f succes', () => {
  it('alerte neutre role status, etat affiche, libelles du bandeau actif', async () => {
    renderForm()

    await userEvent.type(field(), MESSAGE)
    await userEvent.click(showButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Bandeau affiché sur tout le site, avec votre message.'
    )
    expect(screen.getByText('Bandeau affiché sur le site')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', {name: 'Enregistrer le message'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Retirer le bandeau'})
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un bandeau deja affiche s enregistre avec « Enregistrer le message »', async () => {
    renderForm({message: MESSAGE, active: true})

    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le message'})
    )

    await waitFor(() => expect(saveAction).toHaveBeenCalledWith(MESSAGE, true))
  })
})

describe('SiteAlertForm — 1g masque, message conserve', () => {
  it('retire le bandeau sans confirmation et laisse le message dans le champ', async () => {
    renderForm({message: MESSAGE, active: true})

    await userEvent.click(
      screen.getByRole('button', {name: 'Retirer le bandeau'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Bandeau retiré du site. Le message est conservé : vous pourrez l’afficher à nouveau.'
    )
    expect(removeAction).toHaveBeenCalledTimes(1)
    expect(field()).toHaveValue(MESSAGE)
    expect(screen.getByText('Bandeau masqué')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', {
        name: 'Afficher le bandeau sur le site',
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {name: 'Retirer le bandeau'})
    ).not.toBeInTheDocument()
  })
})
