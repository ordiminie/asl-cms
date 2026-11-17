import {Activity} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn()}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

import {render, screen, userEvent, within} from '@/__tests__/customRender'

import {MemberProfileForm} from './member-profile-form'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const MAIL_ONLY_NOTICE =
  'Sans adresse email, ce propriétaire sera joignable par courrier uniquement. Son adresse postale est alors indispensable.'

const HOLDER_ID = '77777777-7777-4777-8777-777777777777'

const EMAIL_SHARED = {
  status: 'email_shared',
  holder: {
    userId: HOLDER_ID,
    name: 'Bernard Lefèvre',
    profiles: [
      {id: 'fiche-12', name: 'Bernard Lefèvre', parcelNumbers: ['12']},
      {id: 'fiche-27', name: 'Bernard Lefèvre', parcelNumbers: ['27', '28']},
    ],
  },
} as const

const saveAction = vi.fn()

const renderForm = () => render(<MemberProfileForm saveAction={saveAction} />)

const field = (name: RegExp | string) => screen.getByLabelText(name)

/** Un champ du domicile ou du terrain : les deux groupes ont les memes libelles (s55). */
const groupField = (group: 'domicile' | 'terrain', name: string) =>
  within(
    screen.getByRole('group', {
      name: group === 'domicile' ? /Adresse de domicile/ : /Adresse du terrain/,
    })
  ).getByLabelText(name)

const submit = async () =>
  userEvent.click(
    screen.getByRole('button', {name: 'Enregistrer le propriétaire'})
  )

const sentFields = (): Record<string, string> =>
  Object.fromEntries(
    [...(saveAction.mock.calls[0][1] as FormData).entries()].map(
      ([key, value]) => [key, String(value)]
    )
  )

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'saved', memberProfileId: PROFILE_ID})
})

describe('MemberProfileForm — écran 2 du design s12', () => {
  it('présente trois cartes : Identité, Coordonnées, Parcelles', () => {
    renderForm()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Ajouter un propriétaire'})
    ).toBeInTheDocument()
    for (const name of ['Identité', 'Coordonnées', 'Parcelles']) {
      expect(screen.getByRole('heading', {level: 2, name})).toBeInTheDocument()
    }
    expect(
      screen.getByText(
        'Vous rattacherez ses parcelles depuis sa fiche, une fois enregistrée.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Propriétaires'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires'
    )
    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires'
    )
  })

  it('reprend les champs de la fiche : domicile et terrain en deux groupes, puis le nom de l’entreprise (s55)', async () => {
    renderForm()

    const home = screen.getByRole('group', {name: /Adresse de domicile/})
    const land = screen.getByRole('group', {name: /Adresse du terrain/})
    expect(home).toHaveTextContent(
      'L’adresse postale de la fiche : là où le propriétaire reçoit le courrier le reste de l’année.'
    )
    expect(land).toHaveTextContent(
      'L’adresse du terrain de vacances dans l’association.'
    )
    for (const group of [home, land]) {
      for (const label of ['Adresse', /Complément/, 'Code postal', 'Commune']) {
        expect(within(group).getByLabelText(label)).toBeInTheDocument()
      }
    }
    expect(field(/Nom de l’entreprise/)).toHaveAccessibleDescription(
      'Pour une entreprise établie sur le terrain (restaurant, supérette). Imprimé dans le bloc adresse du courrier ; ne change rien d’autre.'
    )

    await userEvent.type(field('Nom'), 'Épicerie du Clos')
    await userEvent.type(groupField('terrain', 'Adresse'), '3 rue du Lavoir')
    await userEvent.type(field(/Nom de l’entreprise/), 'Épicerie du Clos')
    await submit()

    expect(sentFields()).toMatchObject({
      landAddressLine: '3 rue du Lavoir',
      companyName: 'Épicerie du Clos',
    })
  })

  it('montre l’encart « courrier uniquement » tant que l’email est vide, et le masque dès qu’il est saisi', async () => {
    renderForm()

    expect(screen.getByText(MAIL_ONLY_NOTICE)).toBeInTheDocument()

    await userEvent.type(field(/Adresse email/), 'c')
    expect(screen.queryByText(MAIL_ONLY_NOTICE)).not.toBeInTheDocument()

    await userEvent.clear(field(/Adresse email/))
    expect(screen.getByText(MAIL_ONLY_NOTICE)).toBeInTheDocument()
  })

  it('enregistre sans email ni adresse postale, puis ouvre la fiche (critères 7 et 8)', async () => {
    renderForm()

    await userEvent.type(field('Nom'), 'Marcel Laurent')
    await submit()

    expect(saveAction).toHaveBeenCalledTimes(1)
    expect(sentFields()).toEqual({
      name: 'Marcel Laurent',
      email: '',
      phone: '',
      homeAddressLine: '',
      homeAddressComplement: '',
      homePostalCode: '',
      homeCity: '',
      landAddressLine: '',
      landAddressComplement: '',
      landPostalCode: '',
      landCity: '',
      companyName: '',
    })
    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires/${PROFILE_ID}?cree=1`
    )
  })

  it('refuse l’envoi et résume les champs à corriger, chaque ligne menant au champ (état 2d)', async () => {
    renderForm()

    await userEvent.type(field(/Adresse email/), 'marcel.laurent@example')
    await userEvent.type(groupField('domicile', 'Code postal'), '3368')
    await submit()

    const summary = screen.getByRole('alert')
    expect(summary).toHaveTextContent(
      '3 champs à corriger. Rien n’a été enregistré.'
    )
    expect(
      within(summary).getByRole('link', {
        name: 'Indiquez le nom du propriétaire.',
      })
    ).toHaveAttribute('href', `#${field('Nom').id}`)
    expect(
      within(summary).getByRole('link', {
        name: 'Cette adresse email n’est pas valide.',
      })
    ).toBeInTheDocument()
    expect(
      within(summary).getByRole('link', {
        name: 'Domicile : le code postal compte cinq chiffres.',
      })
    ).toBeInTheDocument()
    expect(field('Nom')).toHaveAttribute('aria-invalid', 'true')
    expect(saveAction).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('demande confirmation quand l’adresse est celle d’un compte, sans rien enregistrer (état 3a, s53)', async () => {
    saveAction.mockResolvedValue(EMAIL_SHARED)
    renderForm()

    await userEvent.type(field('Nom'), 'SCI Les Pins')
    await userEvent.type(field(/Adresse email/), 'bernard.lefevre@exemple.fr')
    await submit()

    expect(
      await screen.findByText(
        'Cette adresse est déjà celle du compte de Bernard Lefèvre.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Bernard Lefèvre, parcelle 12'})
    ).toHaveAttribute('href', '/bureau/proprietaires/fiche-12')
    expect(
      screen.getByRole('link', {name: 'Bernard Lefèvre, parcelles 27 et 28'})
    ).toHaveAttribute('href', '/bureau/proprietaires/fiche-27')
    expect(screen.getByText(/Rien n’a encore été enregistré\./)).toBeVisible()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('« Oui, relier à son compte » renvoie la saisie avec le compte confirmé (3a → 3b)', async () => {
    saveAction.mockResolvedValueOnce(EMAIL_SHARED).mockResolvedValueOnce({
      status: 'saved',
      memberProfileId: PROFILE_ID,
      accountChange: 'linked',
    })
    renderForm()

    await userEvent.type(field('Nom'), 'SCI Les Pins')
    await userEvent.type(field(/Adresse email/), 'bernard.lefevre@exemple.fr')
    await submit()
    await userEvent.click(
      await screen.findByRole('button', {name: 'Oui, relier à son compte'})
    )

    expect(saveAction).toHaveBeenCalledTimes(2)
    const second = saveAction.mock.calls[1][1] as FormData
    expect(second.get('confirmedAccountUserId')).toBe(HOLDER_ID)
    expect(second.get('name')).toBe('SCI Les Pins')
    expect(second.get('email')).toBe('bernard.lefevre@exemple.fr')
    expect(sentFields()).not.toHaveProperty('confirmedAccountUserId')
    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires/${PROFILE_ID}?cree=1`
    )
  })

  it('« Non, corriger l’adresse » ferme l’encart, rend le focus au champ et n’appelle rien', async () => {
    saveAction.mockResolvedValue(EMAIL_SHARED)
    renderForm()

    await userEvent.type(field('Nom'), 'SCI Les Pins')
    await userEvent.type(field(/Adresse email/), 'bernard.lefevre@exemple.fr')
    await submit()
    await userEvent.click(
      await screen.findByRole('button', {name: 'Non, corriger l’adresse'})
    )

    expect(saveAction).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText(
        'Cette adresse est déjà celle du compte de Bernard Lefèvre.'
      )
    ).not.toBeInTheDocument()
    expect(field(/Adresse email/)).toHaveFocus()
    expect(field('Nom')).toHaveValue('SCI Les Pins')
  })

  it('referme l’encart dès qu’une saisie change', async () => {
    saveAction.mockResolvedValue(EMAIL_SHARED)
    renderForm()

    await userEvent.type(field('Nom'), 'SCI Les Pins')
    await userEvent.type(field(/Adresse email/), 'bernard.lefevre@exemple.fr')
    await submit()
    await screen.findByText(
      'Cette adresse est déjà celle du compte de Bernard Lefèvre.'
    )

    await userEvent.type(field(/Adresse email/), 'x')

    expect(
      screen.queryByText(
        'Cette adresse est déjà celle du compte de Bernard Lefèvre.'
      )
    ).not.toBeInTheDocument()
  })

  it('affiche les erreurs rendues par le serveur sous leur champ', async () => {
    saveAction.mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'phone', message: 'Téléphone refusé par le serveur.'}],
    })
    renderForm()

    await userEvent.type(field('Nom'), 'Marcel Laurent')
    await submit()

    expect(
      await screen.findAllByText('Téléphone refusé par le serveur.')
    ).not.toHaveLength(0)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('dit qu’un échec n’a rien enregistré', async () => {
    saveAction.mockResolvedValue({
      status: 'error',
      message: 'L’enregistrement a échoué.',
    })
    renderForm()

    await userEvent.type(field('Nom'), 'Marcel Laurent')
    await submit()

    expect(
      await screen.findByText('L’enregistrement a échoué.')
    ).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('MemberProfileForm — ouvert depuis une vente (écran 5)', () => {
  const saleReturn = {
    sellerId: 'seller-id',
    parcelId: 'parcel-id',
    date: '2026-06-15',
  }

  it('revient à la vente, l’acquéreur présélectionné et la date conservée', async () => {
    render(
      <MemberProfileForm saveAction={saveAction} saleReturn={saleReturn} />
    )

    await userEvent.type(field('Nom'), 'Paul Ferrand')
    await submit()

    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires/seller-id/vente/parcel-id?acquereur=${PROFILE_ID}&date=2026-06-15`
    )
  })

  it('« Annuler » revient à la vente, la date conservée', () => {
    render(
      <MemberProfileForm saveAction={saveAction} saleReturn={saleReturn} />
    )

    expect(screen.getByRole('link', {name: 'Annuler'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires/seller-id/vente/parcel-id?date=2026-06-15'
    )
  })
})

/**
 * Sous Cache Components, Next garde « Ajouter un proprietaire » monte entre deux
 * navigations (`<Activity>`) : la meme instance est masquee apres le
 * `router.push`, puis reaffichee au retour sur l'ecran.
 */
describe('MemberProfileForm — l’écran conservé revient vierge après une création', () => {
  const FILLED: [() => HTMLElement, string][] = [
    [() => field('Nom'), 'Marcel Laurent'],
    [() => field(/Adresse email/), 'marcel.laurent@example.fr'],
    [() => field(/Téléphone/), '06 12 34 56 78'],
    [() => groupField('domicile', 'Adresse'), '14 allée des Aulnes'],
    [() => groupField('domicile', 'Code postal'), '33680'],
    [() => groupField('domicile', 'Commune'), 'Lacanau'],
    [() => groupField('terrain', 'Commune'), 'Lacanau'],
    [() => field(/Nom de l’entreprise/), 'Épicerie des Aulnes'],
  ]

  const fill = async () => {
    for (const [fieldOf, value] of FILLED) {
      await userEvent.type(fieldOf(), value)
    }
  }

  const shown = (visible: boolean) => (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <MemberProfileForm saveAction={saveAction} />
    </Activity>
  )

  it('montre des champs vides, sans erreur ni résumé, quand on rouvre l’écran après un enregistrement', async () => {
    const {rerender} = render(shown(true))

    await fill()
    await submit()
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledTimes(1))

    rerender(shown(false))
    rerender(shown(true))

    for (const [fieldOf] of FILLED) {
      expect(fieldOf()).toHaveValue('')
    }
    expect(screen.getByText(MAIL_ONLY_NOTICE)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await userEvent.click(field('Nom'))
    await userEvent.tab()

    expect(
      await screen.findByText('Indiquez le nom du propriétaire.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [
      'une erreur de validation du serveur',
      {
        status: 'invalid',
        errors: [{field: 'phone', message: 'Téléphone refusé par le serveur.'}],
      },
    ],
    ['une adresse déjà celle d’un compte', EMAIL_SHARED],
    ['un échec', {status: 'error', message: 'L’enregistrement a échoué.'}],
  ])('garde la saisie après %s', async (_refusal, result) => {
    saveAction.mockResolvedValue(result)
    const {rerender} = render(shown(true))

    await fill()
    await submit()
    await vi.waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(
        screen.getByRole('button', {name: 'Enregistrer le propriétaire'})
      ).toBeEnabled()
    )

    rerender(shown(false))
    rerender(shown(true))

    for (const [fieldOf, value] of FILLED) {
      expect(fieldOf()).toHaveValue(value)
    }
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('MemberProfileForm — l’adresse saisie est la titulaire (s54)', () => {
  it('nomme le champ « Adresse email titulaire » et dit que d’autres s’ajoutent depuis la fiche', () => {
    renderForm()

    const email = screen.getByLabelText(/Adresse email titulaire/)
    expect(email).toHaveAttribute('type', 'email')
    expect(
      screen.getByText(/D’autres adresses s’ajoutent ensuite depuis sa fiche\./)
    ).toBeInTheDocument()
  })
})
