import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'

import {MemberEmailConfirmationPanel} from './member-email-confirmation-panel'

const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')
const confirmAction = vi.fn()

const renderPanel = (
  initialState:
    | {status: 'confirm'; email: string; parcelNumbers: string[]}
    | {status: 'invalid'}
) =>
  render(
    <MemberEmailConfirmationPanel
      token={TOKEN}
      associationName="Clos-Fleuri"
      initialState={initialState}
      confirmAction={confirmAction}
    />
  )

const CONFIRM = {
  status: 'confirm' as const,
  email: 'marc.dubois@exemple.fr',
  parcelNumbers: ['21'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/confirmer-adresse/[jeton] — écran 3 du design s54', () => {
  it('3a · à confirmer : l’adresse, ce qu’elle permettra, un bouton ; rien n’est écrit au rendu', () => {
    renderPanel(CONFIRM)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Confirmer votre adresse'})
    ).toBeInTheDocument()
    expect(screen.getByText('marc.dubois@exemple.fr')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Elle pourra se connecter à l’espace membre de la parcelle 21 et recevra les envois de Clos-Fleuri.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Confirmer cette adresse'})
    ).toBeEnabled()
    expect(confirmAction).not.toHaveBeenCalled()
  })

  it('3b · confirmée : le bouton envoie le jeton, la page le dit et mène à la connexion', async () => {
    confirmAction.mockResolvedValue({status: 'confirmed', replaced: false})
    renderPanel(CONFIRM)

    await userEvent.click(
      screen.getByRole('button', {name: 'Confirmer cette adresse'})
    )

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      'Adresse confirmée. Vous pouvez vous connecter avec elle.'
    )
    const formData = confirmAction.mock.calls[0][1] as FormData
    expect(formData.get('token')).toBe(TOKEN)
    expect(screen.getByRole('link', {name: 'Se connecter'})).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('3b · une modification confirmée dit que l’ancienne adresse ne sert plus', async () => {
    confirmAction.mockResolvedValue({status: 'confirmed', replaced: true})
    renderPanel(CONFIRM)

    await userEvent.click(
      screen.getByRole('button', {name: 'Confirmer cette adresse'})
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Votre ancienne adresse ne sert plus à vous connecter.'
    )
  })

  it('3c · lien inutilisable : un seul message, sans faute, vers la page Contact', () => {
    renderPanel({status: 'invalid'})

    expect(screen.getByText('Ce lien ne sert plus.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Vous n’avez rien fait de mal. Demandez à la personne qui a ajouté l’adresse de la renvoyer depuis son espace, ou écrivez au bureau.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Page Contact'})).toHaveAttribute(
      'href',
      '/contact'
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('3d · adresse prise entre-temps : rien n’est activé, écrire au bureau', async () => {
    confirmAction.mockResolvedValue({status: 'taken'})
    renderPanel(CONFIRM)

    await userEvent.click(
      screen.getByRole('button', {name: 'Confirmer cette adresse'})
    )

    expect(
      await screen.findByText('Cette adresse ne peut pas être ajoutée ici.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Écrivez au bureau, qui fera le lien.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: 'Se connecter'})).toBeNull()
  })

  it('3c · refusé au clic (lien devenu inutilisable entre-temps) : le même message, sans cause', async () => {
    confirmAction.mockResolvedValue({status: 'invalid'})
    renderPanel(CONFIRM)

    await userEvent.click(
      screen.getByRole('button', {name: 'Confirmer cette adresse'})
    )

    expect(await screen.findByText('Ce lien ne sert plus.')).toBeInTheDocument()
    expect(screen.queryByText(/n’a plus accès/)).toBeNull()
    expect(screen.queryByRole('link', {name: 'Se connecter'})).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
