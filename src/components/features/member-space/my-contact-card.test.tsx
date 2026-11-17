import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'
import type {MyContactActionResult} from '@/components/features/member-profile/member-profile-form-validation'
import type {MyContactDTO} from '@/services/types/domain/member-space-types'

import {MyContactCard} from './my-contact-card'

const FULL: MyContactDTO = {
  phone: '06 12 34 56 78',
  homeAddressLine: '4 chemin des Oliviers',
  homeAddressComplement: 'Bâtiment B',
  homePostalCode: '13100',
  homeCity: 'Aix-en-Provence',
  landCount: 1,
  divergent: false,
  groups: [],
}

const EMPTY: MyContactDTO = {
  phone: null,
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landCount: 1,
  divergent: false,
  groups: [],
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
  it('C1 : affiche le téléphone et l’adresse postale ; plus d’adresse email, elle a sa carte (s54)', () => {
    render(<MyContactCard contact={FULL} action={action} />)

    expect(
      screen.getByRole('heading', {level: 2, name: 'Mes coordonnées'})
    ).toBeInTheDocument()
    expect(screen.queryByText('Adresse email')).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        'C’est aussi l’adresse avec laquelle vous vous connectez',
        {exact: false}
      )
    ).not.toBeInTheDocument()
    expect(screen.getByText('06 12 34 56 78')).toBeInTheDocument()
    expect(screen.getByText('4 chemin des Oliviers')).toBeInTheDocument()
    expect(screen.getByText('Bâtiment B')).toBeInTheDocument()
    expect(screen.getByText('13100 Aix-en-Provence')).toBeInTheDocument()
  })

  it('nomme l’adresse « Adresse de domicile » et dit que le courrier y part (s55)', () => {
    render(<MyContactCard contact={FULL} action={action} />)

    expect(
      screen.getByText(
        'L’association vous écrit par courrier à votre adresse de domicile.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Adresse de domicile').nextElementSibling
    ).toHaveTextContent('4 chemin des Oliviers')
    expect(screen.queryByText('Adresse postale')).not.toBeInTheDocument()
    expect(screen.queryByText('Adresse du terrain')).not.toBeInTheDocument()
  })

  it('C2 : « Non renseigné » / « Non renseignée » quand rien n’est saisi', () => {
    render(<MyContactCard contact={EMPTY} action={action} />)

    expect(screen.getByText('Non renseigné')).toBeInTheDocument()
    expect(screen.getByText('Non renseignée')).toBeInTheDocument()
  })
})

describe('MyContactCard — ancre « Ajouter mon téléphone » (s22, B6)', () => {
  it('porte l’ancre #mes-coordonnees sur sa région', () => {
    render(<MyContactCard contact={FULL} action={action} />)

    expect(
      screen.getByRole('region', {name: 'Mes coordonnées'})
    ).toHaveAttribute('id', 'mes-coordonnees')
  })
})

describe('MyContactCard — modification (C3)', () => {
  it('n’offre aucun champ email : l’adresse reste un texte', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)

    expect(screen.getByLabelText(/Téléphone/)).toHaveValue('06 12 34 56 78')
    expect(screen.queryByLabelText(/Adresse email/)).not.toBeInTheDocument()
  })

  it('groupe le domicile sous « Adresse de domicile » ; ni terrain ni nom d’entreprise (s55, critère 5)', async () => {
    const user = userEvent.setup()
    render(<MyContactCard contact={FULL} action={action} />)

    await openEditing(user)

    expect(
      screen.getByRole('group', {name: /Adresse de domicile/})
    ).toContainElement(screen.getByLabelText(/Code postal/))
    expect(
      screen.queryByRole('group', {name: /Adresse du terrain/})
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Nom de l’entreprise/)
    ).not.toBeInTheDocument()
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
      screen.getByText('Domicile : le code postal compte cinq chiffres.')
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
      errors: [
        {field: 'homeCity', message: 'Ce nom de commune est trop long.'},
      ],
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
      'homeAddressComplement',
      'homeAddressLine',
      'homeCity',
      'homePostalCode',
      'phone',
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
        homeAddressComplement: 'Bâtiment C',
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

describe('MyContactCard — un compte à plusieurs terrains (s53, écran 2)', () => {
  const SHARED: MyContactDTO = {...FULL, landCount: 3}

  it('2a : dit que les coordonnées valent pour tous les terrains', () => {
    render(<MyContactCard contact={SHARED} action={action} />)

    expect(
      screen.getByText('Elles valent pour vos 3 terrains.')
    ).toBeInTheDocument()
  })

  it('un seul terrain : rien de plus que s16', () => {
    render(<MyContactCard contact={FULL} action={action} />)

    expect(screen.queryByText(/Elles valent pour vos/)).toBeNull()
  })

  it('2b : coordonnées divergentes, une information et un groupe par jeu', () => {
    render(
      <MyContactCard
        contact={{
          ...SHARED,
          divergent: true,
          groups: [
            {
              parcelNumbers: ['12', '27'],
              names: [],
              phone: FULL.phone,
              homeAddressLine: FULL.homeAddressLine,
              homeAddressComplement: null,
              homePostalCode: FULL.homePostalCode,
              homeCity: FULL.homeCity,
            },
            {
              parcelNumbers: ['31'],
              names: ['SCI Les Pins'],
              phone: null,
              homeAddressLine: '1 allée des Pins',
              homeAddressComplement: null,
              homePostalCode: '13100',
              homeCity: 'Aix-en-Provence',
            },
          ],
        }}
        action={action}
      />
    )

    expect(
      screen.getByText('Vos terrains n’ont pas tous les mêmes coordonnées.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /En les modifiant, vous les mettez à jour pour vos 3 terrains\./
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {level: 3, name: 'Parcelles 12 et 27'})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Parcelle 31 · SCI Les Pins',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('1 allée des Pins')).toBeInTheDocument()
  })

  it('2c : le succès dit que les coordonnées valent désormais pour tous les terrains', async () => {
    const user = userEvent.setup()
    action.mockResolvedValue({status: 'saved', contact: SHARED})
    render(<MyContactCard contact={SHARED} action={action} />)

    await openEditing(user)
    await save(user)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Elles valent désormais pour vos 3 terrains. Le bureau les voit dès maintenant.'
    )
  })
})
