import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/lib/helper/page-navigation.client', () => ({
  reloadPageAt: vi.fn(),
}))

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'

import {ImpersonationDialog} from './impersonation-dialog'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '44444444-4444-4444-8444-444444444444'

const action = vi.fn()

const renderDialog = (
  otherDomain?: {domain: string; url: string},
  durationMinutes = 30
) =>
  render(
    <ImpersonationDialog
      organizationId={ORG_ID}
      userId={USER_ID}
      name="Claire Montel"
      roleLabel="Président(e)"
      organizationName="Rives Vertes"
      durationMinutes={durationMinutes}
      otherDomain={otherDomain}
      action={action}
    />
  )

const openDialog = () =>
  userEvent.click(screen.getByRole('button', {name: 'Agir à sa place'}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ImpersonationDialog (s48, écran 2)', () => {
  it('confirme l’ouverture : titre, attribution, durée lue des props, motif facultatif', async () => {
    renderDialog(undefined, 20)
    await openDialog()

    expect(
      screen.getByRole('dialog', {
        name: 'Agir à la place de Claire Montel\u00a0?',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /exactement ce que Claire Montel voit et fait \(Président\(e\), Rives Vertes\)/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('La session s’arrête d’elle-même au bout de 20 minutes.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Motif/)).toHaveAttribute('maxlength', '200')
    expect(screen.getByRole('button', {name: 'Annuler'})).toBeInTheDocument()
  })

  it('ouvre la session avec le motif, puis recharge la page entière à l’adresse rendue', async () => {
    action.mockResolvedValue({success: true, url: '/bureau/pages'})
    renderDialog()
    await openDialog()

    await userEvent.type(screen.getByLabelText(/Motif/), 'Passation bloquée')
    await userEvent.click(
      screen.getByRole('button', {name: 'Agir à la place de Claire Montel'})
    )

    expect(action).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
      reason: 'Passation bloquée',
    })
    await waitFor(() =>
      expect(reloadPageAt).toHaveBeenCalledWith('/bureau/pages')
    )
  })

  it('pendant l’envoi : libellé « Ouverture… », bouton désactivé', async () => {
    action.mockReturnValue(new Promise(() => {}))
    renderDialog()
    await openDialog()

    await userEvent.click(
      screen.getByRole('button', {name: 'Agir à la place de Claire Montel'})
    )

    expect(
      await screen.findByRole('button', {name: 'Ouverture…'})
    ).toBeDisabled()
  })

  it('montre l’erreur dans la boîte, sans recharger la page', async () => {
    action.mockResolvedValue({
      success: false,
      message: 'Ce compte est suspendu. Rien n’a été modifié.',
    })
    renderDialog()
    await openDialog()

    await userEvent.click(
      screen.getByRole('button', {name: 'Agir à la place de Claire Montel'})
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce compte est suspendu. Rien n’a été modifié.'
    )
    expect(reloadPageAt).not.toHaveBeenCalled()
  })

  it('autre domaine : le bouton principal est un lien vers le site de l’association', async () => {
    renderDialog({
      domain: 'rives-vertes.fr',
      url: `https://rives-vertes.fr/admin/organizations/${ORG_ID}/edit`,
    })
    await openDialog()

    expect(
      screen.getByText(/Vous allez ouvrir le site de Rives Vertes, adresse/)
    ).toHaveTextContent('rives-vertes.fr')
    expect(
      screen.getByRole('link', {name: 'Ouvrir le site de Rives Vertes'})
    ).toHaveAttribute(
      'href',
      `https://rives-vertes.fr/admin/organizations/${ORG_ID}/edit`
    )
    expect(
      screen.queryByRole('button', {name: 'Agir à la place de Claire Montel'})
    ).not.toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })
})
