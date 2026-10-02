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

const saveAction = vi.fn()

const renderForm = () => render(<MemberProfileForm saveAction={saveAction} />)

const field = (name: RegExp | string) => screen.getByLabelText(name)

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
      addressLine: '',
      addressComplement: '',
      postalCode: '',
      city: '',
    })
    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires/${PROFILE_ID}?cree=1`
    )
  })

  it('refuse l’envoi et résume les champs à corriger, chaque ligne menant au champ (état 2d)', async () => {
    renderForm()

    await userEvent.type(field(/Adresse email/), 'marcel.laurent@example')
    await userEvent.type(field('Code postal'), '3368')
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
        name: 'Un code postal compte 5 chiffres.',
      })
    ).toBeInTheDocument()
    expect(field('Nom')).toHaveAttribute('aria-invalid', 'true')
    expect(saveAction).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('dit quelle fiche porte déjà l’email, avec le lien vers elle (état 2e)', async () => {
    saveAction.mockResolvedValue({
      status: 'email_taken',
      memberProfileId: 'other-id',
      name: 'Claire Meunier',
    })
    renderForm()

    await userEvent.type(field('Nom'), 'Claire M.')
    await userEvent.type(field(/Adresse email/), 'claire.meunier@example.fr')
    await submit()

    expect(
      await screen.findByText(
        'Cette adresse est déjà celle de la fiche de Claire Meunier.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Ouvrir la fiche de Claire Meunier'})
    ).toHaveAttribute('href', '/bureau/proprietaires/other-id')
    expect(router.push).not.toHaveBeenCalled()
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
