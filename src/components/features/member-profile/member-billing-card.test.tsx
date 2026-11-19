import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
import type {BoardMemberInvoicesDTO} from '@/services/types/domain/member-invoice-types'

import {MemberBillingCard} from './member-billing-card'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const EXTERNAL_REF = '3f2a9c1e-1111-4111-8111-111111111111'

const invoices = (syncedFromPennylane: boolean): BoardMemberInvoicesDTO => ({
  canWrite: !syncedFromPennylane,
  syncedFromPennylane,
  syncedAt: null,
  invoices: [],
})

const action = vi.fn()

const renderCard = async (
  pennylaneCustomerId: string | null,
  invoicesValue: BoardMemberInvoicesDTO | undefined = invoices(true)
) => {
  await act(async () => {
    render(
      <MemberBillingCard
        profile={{id: PROFILE_ID, name: 'Bernard Lefèvre', pennylaneCustomerId}}
        action={action}
        invoicesPromise={Promise.resolve(invoicesValue)}
      />
    )
  })
}

const card = () => screen.getByRole('region', {name: 'Facturation'})

beforeEach(() => {
  action.mockReset()
})

describe('MemberBillingCard — carte « Facturation » de la fiche (s20, écran 2)', () => {
  it('lit l’identifiant client Pennylane de la fiche', async () => {
    await renderCard(EXTERNAL_REF)

    expect(card()).toHaveTextContent('Identifiant client Pennylane')
    expect(within(card()).getByText(EXTERNAL_REF)).toHaveClass('font-mono')
    expect(within(card()).queryByRole('alert')).toBeNull()
  })

  it('2b : sous Pennylane, sans identifiant — l’avertissement que ses factures ne remontent pas', async () => {
    await renderCard(null)

    expect(card()).toHaveTextContent('Non renseigné')
    expect(
      await within(card()).findByText(
        'Cette fiche n’est reliée à aucun client Pennylane. Ses factures ne remontent pas.'
      )
    ).toBeInTheDocument()
  })

  it('saisie sur le site, ou factures non lisibles : aucun avertissement', async () => {
    await renderCard(null, invoices(false))
    expect(within(card()).queryByText(/ne remontent pas/)).toBeNull()
  })

  it('le bureau renseigne l’identifiant (critère 4) : il part avec la fiche', async () => {
    action.mockResolvedValue({status: 'saved'})
    await renderCard(null)

    await userEvent.click(
      within(card()).getByRole('button', {name: 'Modifier l’identifiant'})
    )
    const field = within(card()).getByLabelText(/Identifiant client Pennylane/)
    expect(field).toHaveClass('font-mono')
    expect(card()).toHaveTextContent('L’« Identifiant Client » de ce terrain')
    await userEvent.type(field, EXTERNAL_REF)
    await userEvent.click(
      within(card()).getByRole('button', {name: 'Enregistrer'})
    )

    expect(action).toHaveBeenCalledOnce()
    const formData = action.mock.calls[0][1] as FormData
    expect(formData.get('memberProfileId')).toBe(PROFILE_ID)
    expect(formData.get('pennylaneCustomerId')).toBe(EXTERNAL_REF)
    expect(
      await within(card()).findByText('Identifiant client enregistré.')
    ).toBeInTheDocument()
  })

  it('doublon : le message du serveur sous le champ, bordure d’erreur, la saisie conservée', async () => {
    action.mockResolvedValue({
      status: 'invalid',
      errors: [
        {
          field: 'pennylaneCustomerId',
          message:
            'Cet identifiant est déjà porté par la fiche « Martin Paul ».',
        },
      ],
    })
    await renderCard(null)

    await userEvent.click(
      within(card()).getByRole('button', {name: 'Modifier l’identifiant'})
    )
    const field = within(card()).getByLabelText(/Identifiant client Pennylane/)
    await userEvent.type(field, EXTERNAL_REF)
    await userEvent.click(
      within(card()).getByRole('button', {name: 'Enregistrer'})
    )

    expect(
      await within(card()).findByText(
        'Cet identifiant est déjà porté par la fiche « Martin Paul ».'
      )
    ).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveValue(EXTERNAL_REF)
  })

  it('« Annuler » revient à la lecture sans rien envoyer', async () => {
    await renderCard(EXTERNAL_REF)

    await userEvent.click(
      within(card()).getByRole('button', {name: 'Modifier l’identifiant'})
    )
    await userEvent.click(within(card()).getByRole('button', {name: 'Annuler'}))

    expect(action).not.toHaveBeenCalled()
    expect(within(card()).getByText(EXTERNAL_REF)).toBeInTheDocument()
  })
})
