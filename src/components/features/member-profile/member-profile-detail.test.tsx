import {Activity} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {MemberProfileDTO} from '@/services/types/domain/member-profile-types'
import type {MemberParcelsDTO} from '@/services/types/domain/parcel-ownership-types'

import {MemberProfileDetail} from './member-profile-detail'

const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const FERRAND_ID = '44444444-4444-4444-8444-444444444444'
const PARCEL_47 = '66666666-6666-4666-8666-666666666666'

const profile = (
  overrides: Partial<MemberProfileDTO> = {}
): MemberProfileDTO => ({
  id: PROFILE_ID,
  organizationId: '11111111-1111-4111-8111-111111111111',
  name: 'Hélène Roy',
  email: null,
  phone: null,
  addressLine: '8 chemin des Pins',
  addressComplement: null,
  postalCode: '33680',
  city: 'Lacanau',
  mailOnly: true,
  incomplete: false,
  account: {status: 'mail_only'},
  ...overrides,
})

const OPEN_PROFILE = profile({
  email: 'helene@example.test',
  mailOnly: false,
  account: {status: 'open', loginEmail: 'helene@example.test', boardRole: null},
})

const boardProfile = (boardRole: 'board' | 'owner') =>
  profile({
    email: 'helene@example.test',
    mailOnly: false,
    account: {status: 'open', loginEmail: 'helene@example.test', boardRole},
  })

const NO_PARCELS: MemberParcelsDTO = {current: [], former: []}

const SELLER_PARCELS: MemberParcelsDTO = {
  current: [],
  former: [
    {
      parcelId: PARCEL_47,
      number: '47',
      startsOn: '1998-02-03',
      endsOn: '2026-06-15',
      soldTo: {memberProfileId: FERRAND_ID, name: 'Paul Ferrand'},
    },
  ],
}

const OWNER_PARCELS: MemberParcelsDTO = {
  current: [
    {parcelId: 'p12', number: '12', startsOn: '1998-02-03'},
    {parcelId: 'p13', number: '13', startsOn: '2009-09-11'},
  ],
  former: [],
}

const actions = {
  updateContactAction: vi.fn(),
  attachParcelAction: vi.fn(),
}

type DetailInput = {
  profile?: MemberProfileDTO
  parcels?: MemberParcelsDTO
  created?: boolean
  soldParcelId?: string
}

const detailOf = (input: DetailInput = {}) => (
  <MemberProfileDetail
    profile={input.profile ?? profile()}
    parcels={input.parcels ?? NO_PARCELS}
    today="2026-09-29"
    created={input.created ?? false}
    soldParcelId={input.soldParcelId}
    {...actions}
  />
)

const renderDetail = (input: DetailInput = {}) => render(detailOf(input))

const sentFields = (action: typeof actions.attachParcelAction) =>
  Object.fromEntries(
    [...(action.mock.calls[0][1] as FormData).entries()].map(([key, value]) => [
      key,
      String(value),
    ])
  )

const currentTable = () =>
  screen.getByRole('table', {name: 'Parcelles actuelles'})
const formerTable = () =>
  screen.getByRole('table', {name: 'Anciennes parcelles'})

beforeEach(() => {
  vi.clearAllMocks()
  actions.updateContactAction.mockResolvedValue({
    status: 'saved',
    memberProfileId: PROFILE_ID,
  })
  actions.attachParcelAction.mockResolvedValue({
    status: 'attached',
    parcelNumber: '52',
    parcelCreated: true,
    startsOn: '2026-09-29',
  })
})

describe('MemberProfileDetail — écran 3 du design s12', () => {
  it('titre la fiche du nom, avec le fil d’Ariane et le badge « Courrier uniquement »', () => {
    renderDetail()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Hélène Roy'})
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Propriétaires'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires'
    )
    expect(screen.getByText('Courrier uniquement')).toBeInTheDocument()
    expect(screen.queryByText('Fiche incomplète')).not.toBeInTheDocument()
  })

  it('ne porte aucun badge pour une fiche qui a un email', () => {
    renderDetail({
      profile: profile({email: 'claire@example.fr', mailOnly: false}),
    })

    expect(screen.queryByText('Courrier uniquement')).not.toBeInTheDocument()
    expect(screen.getByText('claire@example.fr')).toBeInTheDocument()
  })

  it('accorde « Non renseignée » et « Non renseigné » aux libellés', () => {
    renderDetail({
      profile: profile({
        addressLine: null,
        postalCode: null,
        city: null,
        incomplete: true,
      }),
    })

    const contact = screen.getByRole('region', {name: 'Coordonnées'})
    const valueOf = (label: string) =>
      within(contact).getByText(label).nextElementSibling

    expect(valueOf('Adresse email')).toHaveTextContent(/^Non renseignée$/)
    expect(valueOf('Téléphone')).toHaveTextContent(/^Non renseigné$/)
    expect(valueOf('Adresse postale')).toHaveTextContent(/^Non renseignée$/)
  })

  it('signale la fiche incomplète en tête, et mène à la saisie de l’adresse (état 3d)', async () => {
    renderDetail({
      profile: profile({
        addressLine: null,
        postalCode: null,
        city: null,
        incomplete: true,
      }),
    })

    expect(screen.getByText('Fiche incomplète')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Cette fiche n’a ni adresse email ni adresse postale : aucun envoi ne peut atteindre ce propriétaire\./
      )
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter une adresse postale'})
    )

    expect(screen.getByLabelText('Adresse')).toHaveFocus()
  })

  it('n’affiche pas l’alerte d’une fiche complète', () => {
    renderDetail()

    expect(
      screen.queryByRole('button', {name: 'Ajouter une adresse postale'})
    ).not.toBeInTheDocument()
  })

  it('modifie les coordonnées en place, puis le dit (critère 6)', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    expect(screen.getByLabelText('Adresse')).toHaveValue('8 chemin des Pins')

    await userEvent.type(screen.getByLabelText(/Téléphone/), '06 12 34 56 78')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

    expect(sentFields(actions.updateContactAction)).toEqual({
      memberProfileId: PROFILE_ID,
      email: '',
      phone: '06 12 34 56 78',
      addressLine: '8 chemin des Pins',
      addressComplement: '',
      postalCode: '33680',
      city: 'Lacanau',
    })
    expect(
      await screen.findByText('Coordonnées enregistrées.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    ).toBeInTheDocument()
  })

  it('abandonne la modification sans rien envoyer', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    await userEvent.click(screen.getByRole('button', {name: 'Annuler'}))

    expect(actions.updateContactAction).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Adresse')).not.toBeInTheDocument()
  })

  it('dit « Propriétaire enregistré. » à l’arrivée depuis la création', () => {
    renderDetail({created: true})

    expect(screen.getByRole('status')).toHaveTextContent(
      'Propriétaire enregistré.'
    )
  })

  it('dit la vente qui vient d’être enregistrée, avec le lien vers l’acquéreur (état 5h)', () => {
    renderDetail({parcels: SELLER_PARCELS, soldParcelId: PARCEL_47})

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      'Vente enregistrée. La parcelle 47 est à Paul Ferrand depuis le 15/06/2026.'
    )
    expect(
      within(status).getByRole('link', {
        name: 'Ouvrir la fiche de Paul Ferrand',
      })
    ).toHaveAttribute('href', `/bureau/proprietaires/${FERRAND_ID}`)
  })

  it('ne dit rien d’une vente qui ne figure pas parmi les anciennes parcelles', () => {
    renderDetail({parcels: NO_PARCELS, soldParcelId: PARCEL_47})

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('MemberProfileDetail — carte Parcelles', () => {
  it('liste les parcelles actuelles, chacune avec « Enregistrer une vente » (critère 5)', () => {
    renderDetail({parcels: OWNER_PARCELS})

    const rows = within(currentTable()).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('1203/02/1998'),
      expect.stringContaining('1311/09/2009'),
    ])
    expect(
      within(rows[0]).getByRole('link', {name: 'Enregistrer une vente'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_ID}/vente/p12`)
    expect(screen.queryByText('Anciennes parcelles')).not.toBeInTheDocument()
  })

  it('écrit « Aucune parcelle actuelle. » quand il n’y en a pas', () => {
    renderDetail({parcels: SELLER_PARCELS})

    expect(screen.getByText('Aucune parcelle actuelle.')).toBeInTheDocument()
  })

  it('écrit la période d’une ancienne parcelle jusqu’à la veille de la vente (ADR 029)', () => {
    renderDetail({parcels: SELLER_PARCELS})

    const [row] = within(formerTable()).getAllByRole('row').slice(1)
    expect(row).toHaveTextContent('du 03/02/1998 au 14/06/2026')
    expect(row).not.toHaveTextContent('15/06/2026')
    expect(
      within(row).getByRole('link', {name: 'Paul Ferrand'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${FERRAND_ID}`)
  })

  it('n’offre aucune action sur une ancienne parcelle, et dit pourquoi', () => {
    renderDetail({parcels: SELLER_PARCELS})

    expect(
      screen.getByText('Les périodes closes ne se modifient pas.')
    ).toBeInTheDocument()
    expect(within(formerTable()).queryByRole('button')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', {name: 'Enregistrer une vente'})
    ).not.toBeInTheDocument()
    expect(
      within(formerTable()).queryByRole('columnheader', {name: 'Action'})
    ).not.toBeInTheDocument()
  })
})

describe('MemberProfileDetail — rattacher une parcelle (écran 4)', () => {
  const openDialog = async () => {
    await userEvent.click(
      screen.getByRole('button', {name: 'Rattacher une parcelle'})
    )
    return screen.getByRole('dialog', {
      name: 'Rattacher une parcelle à Hélène Roy',
    })
  }

  it('ouvre un dialog à deux champs, la date pré-remplie à aujourd’hui, sans croix', async () => {
    renderDetail()

    const dialog = await openDialog()

    expect(within(dialog).getByLabelText('Numéro de parcelle')).toHaveValue('')
    expect(within(dialog).getByLabelText('Propriétaire depuis le')).toHaveValue(
      '29/09/2026'
    )
    expect(
      within(dialog).getByRole('button', {name: 'Annuler'})
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', {name: 'Close'})
    ).not.toBeInTheDocument()
  })

  it('refuse un numéro vide et une date qui n’existe pas, sans rien envoyer (état 4b)', async () => {
    renderDetail()
    const dialog = await openDialog()

    const date = within(dialog).getByLabelText('Propriétaire depuis le')
    await userEvent.clear(date)
    await userEvent.type(date, '31022026')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(
      await within(dialog).findByText('Indiquez le numéro de la parcelle.')
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Cette date n’existe pas. Écrivez-la sous la forme jj/mm/aaaa.'
      )
    ).toBeInTheDocument()
    expect(actions.attachParcelAction).not.toHaveBeenCalled()
  })

  it('rattache la parcelle, ferme le dialog et dit qu’elle a été créée (état 4d)', async () => {
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '52'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(sentFields(actions.attachParcelAction)).toEqual({
      memberProfileId: PROFILE_ID,
      parcelNumber: '52',
      startsOn: '29/09/2026',
    })
    expect(
      await screen.findByText(
        'Parcelle 52 ajoutée et rattachée à Hélène Roy depuis le 29/09/2026.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('montre le numéro en majuscules pendant la saisie, l’envoie tel quel et le cite dans la confirmation', async () => {
    actions.attachParcelAction.mockResolvedValue({
      status: 'attached',
      parcelNumber: 'A12',
      parcelCreated: false,
      startsOn: '2026-09-29',
    })
    renderDetail()
    const dialog = await openDialog()
    const number = within(dialog).getByLabelText('Numéro de parcelle')

    await userEvent.type(number, 'a1')
    expect(number).toHaveValue('A1')
    await userEvent.type(number, '2')
    expect(number).toHaveValue('A12')

    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(sentFields(actions.attachParcelAction).parcelNumber).toBe('A12')
    expect(
      await screen.findByText(
        'Parcelle A12 rattachée à Hélène Roy depuis le 29/09/2026.'
      )
    ).toBeInTheDocument()
  })

  it('cite le numéro en majuscules dans le refus de chevauchement, et le garde dans le champ', async () => {
    actions.attachParcelAction.mockResolvedValue({
      status: 'overlap',
      parcelNumber: 'A12',
      conflict: {
        memberProfileId: FERRAND_ID,
        name: 'Paul Ferrand',
        startsOn: '2026-06-15',
        endsOn: null,
      },
    })
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      'a12'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'La parcelle A12 appartient à Paul Ferrand depuis le 15/06/2026.'
    )
    expect(within(dialog).getByLabelText('Numéro de parcelle')).toHaveValue(
      'A12'
    )
  })

  it('dit simplement « rattachée » quand la parcelle existait déjà', async () => {
    actions.attachParcelAction.mockResolvedValue({
      status: 'attached',
      parcelNumber: '21',
      parcelCreated: false,
      startsOn: '2014-05-12',
    })
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '21'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(
      await screen.findByText(
        'Parcelle 21 rattachée à Hélène Roy depuis le 12/05/2014.'
      )
    ).toBeInTheDocument()
  })

  it('refuse un chevauchement en nommant le propriétaire en place et sa date, champs conservés (critère 4)', async () => {
    actions.attachParcelAction.mockResolvedValue({
      status: 'overlap',
      parcelNumber: '47',
      conflict: {
        memberProfileId: FERRAND_ID,
        name: 'Paul Ferrand',
        startsOn: '2026-06-15',
        endsOn: null,
      },
    })
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '47'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(
      'La parcelle 47 appartient à Paul Ferrand depuis le 15/06/2026. Elle ne peut pas avoir deux propriétaires en même temps. Si elle a été vendue, enregistrez la vente depuis la fiche de Paul Ferrand.'
    )
    expect(
      within(alert).getByRole('link', {name: 'Ouvrir la fiche de Paul Ferrand'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${FERRAND_ID}`)
    expect(within(dialog).getByLabelText('Numéro de parcelle')).toHaveValue(
      '47'
    )
  })

  it('nomme l’ancien propriétaire et sa période quand la date tombe dans une période close', async () => {
    actions.attachParcelAction.mockResolvedValue({
      status: 'overlap',
      parcelNumber: '47',
      conflict: {
        memberProfileId: FERRAND_ID,
        name: 'Jean et Odile Dubois',
        startsOn: '1998-02-03',
        endsOn: '2026-06-15',
      },
    })
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '47'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'La parcelle 47 appartenait à Jean et Odile Dubois du 03/02/1998 au 14/06/2026.'
    )
  })

  it('refuse une date postérieure à aujourd’hui sous le champ de date, sans rien envoyer', async () => {
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '52'
    )
    const date = within(dialog).getByLabelText('Propriétaire depuis le')
    await userEvent.clear(date)
    await userEvent.type(date, '30092026')
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(
      await within(dialog).findByText(
        'Cette date ne peut pas être postérieure à aujourd’hui.'
      )
    ).toBeInTheDocument()
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(actions.attachParcelAction).not.toHaveBeenCalled()
  })

  it('affiche sous le champ de date le refus d’une date future rendu par le serveur, dialog ouvert', async () => {
    actions.attachParcelAction.mockResolvedValue({status: 'future_date'})
    renderDetail()
    const dialog = await openDialog()

    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '52'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )

    expect(
      await within(dialog).findByText(
        'Cette date ne peut pas être postérieure à aujourd’hui.'
      )
    ).toBeInTheDocument()
    expect(actions.attachParcelAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ferme le dialog par « Annuler », sans rien envoyer', async () => {
    renderDetail()
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('button', {name: 'Annuler'}))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(actions.attachParcelAction).not.toHaveBeenCalled()
  })
})

/**
 * Sous Cache Components, Next garde la fiche montee entre deux navigations
 * (`<Activity>`, cle de route sans parametres de recherche) : la meme instance
 * est masquee, puis rendue de nouveau avec les props de la nouvelle URL.
 */
describe('MemberProfileDetail — l’alerte d’arrivée suit l’URL courante', () => {
  const SOLD = {parcels: SELLER_PARCELS, soldParcelId: PARCEL_47}

  it('dit la vente quand la fiche ouverte après une création revient avec « ?vente= »', () => {
    const {rerender} = renderDetail({created: true})
    expect(screen.getByRole('status')).toHaveTextContent(
      'Propriétaire enregistré.'
    )

    rerender(detailOf(SOLD))

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      'Vente enregistrée. La parcelle 47 est à Paul Ferrand depuis le 15/06/2026.'
    )
    expect(status).not.toHaveTextContent('Propriétaire enregistré.')
  })

  it('ne dit plus rien quand la fiche revient sans « ?cree= » ni « ?vente= »', () => {
    const {rerender} = renderDetail({created: true})

    rerender(detailOf())

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('oublie une alerte née dans la page quand la fiche est masquée, puis dit la vente au retour', async () => {
    const shown = (visible: boolean, input: DetailInput) => (
      <Activity mode={visible ? 'visible' : 'hidden'}>
        {detailOf(input)}
      </Activity>
    )
    const {rerender} = render(shown(true, {created: true}))

    await userEvent.click(
      screen.getByRole('button', {name: 'Rattacher une parcelle'})
    )
    const dialog = screen.getByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('Numéro de parcelle'),
      '52'
    )
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Rattacher la parcelle'})
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Parcelle 52 ajoutée et rattachée à Hélène Roy depuis le 29/09/2026.'
    )

    rerender(shown(false, {created: true}))
    rerender(shown(true, SOLD))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Vente enregistrée. La parcelle 47 est à Paul Ferrand depuis le 15/06/2026.'
    )
  })

  it('garde le focus sur l’alerte des coordonnées enregistrées', async () => {
    renderDetail({created: true})

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Coordonnées enregistrées.')
    expect(status).toHaveFocus()
  })
})

describe('MemberProfileDetail — carte « Accès à l’espace membre » (s12d)', () => {
  const accessCard = () =>
    screen.getByRole('region', {name: 'Accès à l’espace membre'})

  it('dit qu’une fiche sans adresse n’a pas de compte, sans aucune action', () => {
    renderDetail()

    expect(accessCard()).toHaveTextContent(
      'Joignable par courrier uniquement. Aucun compte : ajoutez une adresse email pour lui ouvrir son espace.'
    )
    expect(within(accessCard()).queryByRole('button')).toBeNull()
    expect(within(accessCard()).queryByRole('link')).toBeNull()
  })

  it('dit le compte ouvert et l’adresse de connexion', () => {
    renderDetail({profile: OPEN_PROFILE})

    expect(accessCard()).toHaveTextContent(
      'Compte ouvert. Hélène Roy peut se connecter à son espace avec helene@example.test.'
    )
    expect(accessCard()).not.toHaveTextContent('Membre du bureau')
  })

  it.each([
    [
      'board',
      'Membre du bureau : son adresse peut être modifiée, pas supprimée.',
    ],
    ['owner', 'Président(e) : son adresse peut être modifiée, pas supprimée.'],
  ] as const)('dit le rôle %s au bureau', (role, text) => {
    renderDetail({profile: boardProfile(role)})

    expect(accessCard()).toHaveTextContent(text)
  })

  it('montre l’état enregistré pendant une modification non validée', async () => {
    renderDetail({profile: OPEN_PROFILE})

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    await userEvent.clear(screen.getByLabelText(/Adresse email/))

    expect(accessCard()).toHaveTextContent(
      'Compte ouvert. Hélène Roy peut se connecter à son espace avec helene@example.test.'
    )
  })
})

describe('MemberProfileDetail — création (écran B, s12d)', () => {
  it('dit le compte ouvert à l’arrivée d’une fiche créée avec une adresse (B1)', () => {
    renderDetail({created: true, profile: OPEN_PROFILE})

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Propriétaire enregistré.')
    expect(status).toHaveTextContent(
      'Compte ouvert : Hélène Roy peut se connecter avec helene@example.test.'
    )
  })

  it('ne dit que l’enregistrement pour une fiche créée sans adresse (B2)', () => {
    renderDetail({created: true})

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/^Propriétaire enregistré\.$/)
  })
})

describe('MemberProfileDetail — l’accès suit l’adresse (écran A, s12d)', () => {
  const editContact = async () => {
    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    return screen.getByLabelText(/Adresse email/)
  }

  const save = () =>
    userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

  it('avertit sous le champ, avant l’enregistrement, quand l’adresse est vidée (A3)', async () => {
    renderDetail({profile: OPEN_PROFILE})
    const email = await editContact()

    await userEvent.clear(email)

    expect(
      screen.getByText(
        /Sans adresse email, Hélène Roy ne pourra plus se connecter à son espace\. Sa fiche, ses parcelles et son historique sont conservés\. Les envois partiront par courrier\./
      )
    ).toBeInTheDocument()
    expect(actions.updateContactAction).not.toHaveBeenCalled()
  })

  it('avertit quand l’adresse est remplacée (A6)', async () => {
    renderDetail({profile: OPEN_PROFILE})
    const email = await editContact()

    await userEvent.clear(email)
    await userEvent.type(email, 'h.roy@example.test')

    expect(
      screen.getByText(
        /Hélène Roy ne pourra plus se connecter avec helene@example\.test\. Son espace s’ouvrira avec h\.roy@example\.test\./
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Son rôle au bureau suit la nouvelle adresse.')
    ).toBeNull()
  })

  it('dit au bureau que le rôle suit la nouvelle adresse (A10)', async () => {
    renderDetail({profile: boardProfile('board')})
    const email = await editContact()

    await userEvent.clear(email)
    await userEvent.type(email, 'h.roy@example.test')

    expect(
      screen.getByText(/Son rôle au bureau suit la nouvelle adresse\./)
    ).toBeInTheDocument()
  })

  it('n’avertit pas quand seule la casse change', async () => {
    renderDetail({profile: OPEN_PROFILE})
    const email = await editContact()

    await userEvent.clear(email)
    await userEvent.type(email, 'Helene@Example.test')

    expect(screen.queryByText(/ne pourra plus se connecter/)).toBeNull()
  })

  it('n’écrit pas « Facultatif » sur l’adresse d’un membre du bureau', async () => {
    renderDetail({profile: boardProfile('owner')})
    await editContact()

    expect(
      screen.getByText('Adresse email', {selector: 'label'})
    ).not.toHaveTextContent('Facultatif')
  })

  it.each([
    ['closed', '', 'Accès à l’espace fermé.'],
    [
      'opened',
      'helene@example.test',
      'Compte ouvert : Hélène Roy peut désormais se connecter avec helene@example.test.',
    ],
    [
      'replaced',
      'H.Roy@example.test',
      'Hélène Roy se connecte désormais avec h.roy@example.test. L’accès avec helene@example.test est fermé.',
    ],
  ] as const)(
    'confirme le changement d’accès %s (A4, A5, A7)',
    async (accountChange, next, text) => {
      actions.updateContactAction.mockResolvedValue({
        status: 'saved',
        memberProfileId: PROFILE_ID,
        accountChange,
      })
      renderDetail({
        profile: accountChange === 'opened' ? profile() : OPEN_PROFILE,
      })
      const email = await editContact()

      await userEvent.clear(email)
      if (next) await userEvent.type(email, next)
      await save()

      const status = await screen.findByRole('status')
      expect(status).toHaveTextContent('Coordonnées enregistrées.')
      expect(status).toHaveTextContent(text)
    }
  )

  it('refuse de vider l’adresse d’un membre du bureau : résumé, message sous le champ, rien n’est enregistré (A9)', async () => {
    actions.updateContactAction.mockResolvedValue({
      status: 'board_email_required',
    })
    renderDetail({profile: boardProfile('board')})
    const email = await editContact()

    await userEvent.clear(email)
    await save()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hélène Roy fait partie du bureau : son adresse lui sert à se connecter. Vous pouvez la modifier, pas la supprimer. Rien n’a été enregistré.'
    )
    expect(
      screen.getByText(
        'Saisissez une adresse email : celle d’un membre du bureau ne peut pas être supprimée.'
      )
    ).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('oublie la confirmation d’accès quand la fiche est masquée par <Activity>', async () => {
    actions.updateContactAction.mockResolvedValue({
      status: 'saved',
      memberProfileId: PROFILE_ID,
      accountChange: 'closed',
    })
    const shown = (visible: boolean) => (
      <Activity mode={visible ? 'visible' : 'hidden'}>
        {detailOf({profile: OPEN_PROFILE})}
      </Activity>
    )
    const {rerender} = render(shown(true))
    const email = await editContact()
    await userEvent.clear(email)
    await save()
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Accès à l’espace fermé.'
    )

    rerender(shown(false))
    rerender(shown(true))

    expect(screen.queryByText('Accès à l’espace fermé.')).toBeNull()
  })
})
