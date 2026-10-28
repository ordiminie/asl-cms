import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import type {MyContactActionResult} from '@/components/features/member-profile/member-profile-form-validation'
import type {MyContactDTO} from '@/services/types/domain/member-space-types'

import {MyContactCard} from './my-contact-card'

const FULL: MyContactDTO = {
  email: 'lucie.moreau@exemple.fr',
  phone: '06 12 34 56 78',
  addressLine: '4 chemin des Oliviers',
  addressComplement: 'Bâtiment B',
  postalCode: '13100',
  city: 'Aix-en-Provence',
}

const EMPTY: MyContactDTO = {
  email: 'lucie.moreau@exemple.fr',
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
}

const action =
  vi.fn<
    (
      prev: MyContactActionResult | undefined,
      formData: FormData
    ) => Promise<MyContactActionResult>
  >()

const openEditing = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', {name: 'Modifier mes coordonnées'})
  )
}

const save = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', {name: 'Enregistrer mes coordonnées'})
  )
}

beforeEach(() => {
  action.mockReset()
})

describe('MyContactCard — lecture (C1, C2)', () => {
  it('C1 : affiche l’adresse email, le téléphone et l’adresse postale', () => {
    render(<MyContactCard contact={FULL} action={action} />)

    expect(
      screen.getByRole('heading', {level: 2, name: 'Mes coordonnées'})
    ).toBeInTheDocument()
    expect(screen.getByText('lucie.moreau@exemple.fr')).toBeInTheDocument()
    expect(
      screen.getByText(
        'C’est aussi l’adresse avec laquelle vous vous connectez. Pour la changer, écrivez au bureau.',
        {exact: false}
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Page Contact'})).toHaveAttribute(
      'href',
      '/contact'
    )
    expect(screen.getByText('06 12 34 56 78')).toBeInTheDocument()
    expect(screen.getByText('4 chemin des Oliviers')).toBeInTheDocument()
    expect(screen.getByText('Bâtiment B')).toBeInTheDocument()
    expect(screen.getByText('13100 Aix-en-Provence')).toBeInTheDocument()
  })

  it('C2 : « Non renseigné » / « Non renseignée » quand rien n’est saisi', () => {
    render(<MyContactCard contact={EMPTY} action={action} />)

    expect(screen.getByText('Non renseigné')).toBeInTheDocument()
    expect(screen.getByText('Non renseignée')).toBeInTheDocument()
  })
})

describe('MyContactCard — modification (C3)', () => {
  it('n’offre aucun champ email : l’adresse reste un texte', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)

    expect(screen.getByLabelText(/Téléphone/)).toHaveValue('06 12 34 56 78')
    expect(screen.queryByLabelText(/Adresse email/)).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('lucie.moreau@exemple.fr')
    ).not.toBeInTheDocument()
    expect(screen.getByText('lucie.moreau@exemple.fr')).toBeInTheDocument()
  })

  it('pose l’autocomplete sur les cinq champs', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)

    expect(screen.getByLabelText(/Téléphone/)).toHaveAttribute(
      'autocomplete',
      'tel'
    )
    expect(screen.getByLabelText(/^Adresse/)).toHaveAttribute(
      'autocomplete',
      'address-line1'
    )
    expect(screen.getByLabelText(/Complément/)).toHaveAttribute(
      'autocomplete',
      'address-line2'
    )
    expect(screen.getByLabelText(/Code postal/)).toHaveAttribute(
      'autocomplete',
      'postal-code'
    )
    expect(screen.getByLabelText(/Commune/)).toHaveAttribute(
      'autocomplete',
      'address-level2'
    )
  })

  it('« Annuler » rend les valeurs d’origine', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await user.clear(screen.getByLabelText(/Téléphone/))
    await user.type(screen.getByLabelText(/Téléphone/), '07 45 12 89 30')
    await user.click(screen.getByRole('button', {name: 'Annuler'}))

    expect(screen.getByText('06 12 34 56 78')).toBeInTheDocument()
    expect(screen.queryByText('07 45 12 89 30')).not.toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })
})

describe('MyContactCard — erreurs de saisie (C4)', () => {
  it('affiche les erreurs client par champ sans appeler l’action', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await user.clear(screen.getByLabelText(/Téléphone/))
    await user.type(screen.getByLabelText(/Téléphone/), '06 12 AB 56 78')
    await user.clear(screen.getByLabelText(/Code postal/))
    await user.type(screen.getByLabelText(/Code postal/), '1310')
    await save(user)

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(
      'Vos coordonnées n’ont pas été enregistrées. Corrigez les champs signalés.'
    )
    expect(summary).toHaveFocus()
    expect(screen.getByRole('link', {name: 'Téléphone'})).toHaveAttribute(
      'href',
      `#${screen.getByLabelText(/Téléphone/).id}`
    )
    expect(screen.getByRole('link', {name: 'Code postal'})).toBeInTheDocument()
    expect(
      screen.getByText('Un code postal compte 5 chiffres.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Code postal/)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByLabelText(/Code postal/)).toHaveValue('1310')
    expect(action).not.toHaveBeenCalled()
  })

  it('pose sur les champs les erreurs rendues par le serveur', async () => {
    const user = userEvent.setup()
    action.mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'city', message: 'Ce nom de commune est trop long.'}],
    })
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await save(user)

    expect(
      await screen.findByText('Ce nom de commune est trop long.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Commune/)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByRole('alert')).toHaveFocus()
  })
})

describe('MyContactCard — envoi', () => {
  it('n’envoie que les cinq champs : ni identifiant de fiche, ni email', async () => {
    const user = userEvent.setup()
    action.mockResolvedValue({status: 'saved', contact: FULL})
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await save(user)

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0][1]
    expect([...formData.keys()].sort()).toEqual([
      'addressComplement',
      'addressLine',
      'city',
      'phone',
      'postalCode',
    ])
    expect(formData.get('phone')).toBe('06 12 34 56 78')
  })

  it('C5 : repasse en lecture avec les nouvelles valeurs et focalise la confirmation', async () => {
    const user = userEvent.setup()
    action.mockResolvedValue({
      status: 'saved',
      contact: {
        ...FULL,
        phone: '07 45 12 89 30',
        addressComplement: 'Bâtiment C',
      },
    })
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await user.clear(screen.getByLabelText(/Téléphone/))
    await user.type(screen.getByLabelText(/Téléphone/), '07 45 12 89 30')
    await save(user)

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Coordonnées enregistrées.')
    expect(status).toHaveTextContent(
      'Le bureau voit dès maintenant vos nouvelles coordonnées.'
    )
    expect(status).toHaveFocus()
    expect(screen.getByText('07 45 12 89 30')).toBeInTheDocument()
    expect(screen.getByText('Bâtiment C')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Téléphone/)).not.toBeInTheDocument()
  })

  it('C6 : sur un échec technique, reste en modification avec les saisies', async () => {
    const user = userEvent.setup()
    action.mockResolvedValue({status: 'error', message: 'échec'})
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await user.clear(screen.getByLabelText(/Téléphone/))
    await user.type(screen.getByLabelText(/Téléphone/), '07 45 12 89 30')
    await save(user)

    const failure = await screen.findByRole('alert')
    expect(failure).toHaveTextContent(
      'Vos coordonnées n’ont pas pu être enregistrées.'
    )
    expect(failure).toHaveTextContent(
      'Réessayez dans un instant. Rien n’a été enregistré.'
    )
    expect(screen.getByLabelText(/Téléphone/)).toHaveValue('07 45 12 89 30')
    expect(
      screen.getByRole('button', {name: 'Enregistrer mes coordonnées'})
    ).toBeEnabled()
  })

  it('pendant l’envoi : « Enregistrement… », bouton désactivé', async () => {
    const user = userEvent.setup()
    let finish: (result: MyContactActionResult) => void = () => {}
    action.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)
    await save(user)

    const pending = await screen.findByRole('button', {
      name: 'Enregistrement…',
    })
    expect(pending).toBeDisabled()
    finish({status: 'saved', contact: FULL})
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
