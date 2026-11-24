import {Activity} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, screen, userEvent, within} from '@/__tests__/customRender'
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
  homeAddressLine: '8 chemin des Pins',
  homeAddressComplement: null,
  homePostalCode: '33680',
  homeCity: 'Lacanau',
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
  mailOnly: true,
  incomplete: false,
  emails: [],
  account: {status: 'mail_only'},
  pennylaneCustomerId: null,
  roleCard: {
    reading: 'no_account',
    canEdit: false,
    notice: null,
    options: [],
    self: false,
  },
  ...overrides,
})

const OPEN_PROFILE = profile({
  email: 'helene@example.test',
  mailOnly: false,
  account: {
    status: 'open',
    loginEmail: 'helene@example.test',
    boardRole: null,
    accountName: 'Hélène Roy',
    otherProfiles: [],
  },
})

/** Une fiche d'un compte qui porte deux autres terrains (s53). */
const sharedProfile = (boardRole: 'board' | 'owner' | null = null) =>
  profile({
    name: 'SCI Les Pins',
    email: 'bernard.lefevre@exemple.fr',
    mailOnly: false,
    account: {
      status: 'open',
      loginEmail: 'bernard.lefevre@exemple.fr',
      boardRole,
      accountName: 'Bernard Lefèvre',
      otherProfiles: [
        {id: 'fiche-12', name: 'Bernard Lefèvre', parcelNumbers: ['12']},
        {id: 'fiche-27', name: 'Bernard Lefèvre', parcelNumbers: ['27']},
      ],
    },
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
  changeRoleAction: vi.fn(),
  addNoteAction: vi.fn(),
  addExchangeAction: vi.fn(),
  updateNoteAction: vi.fn(),
  deleteNoteAction: vi.fn(),
  addEmailAction: vi.fn(),
  updateEmailAction: vi.fn(),
  removeEmailAction: vi.fn(),
  designateHolderAction: vi.fn(),
  updatePennylaneIdAction: vi.fn(),
  inviteAction: vi.fn(),
}

/**
 * Le fil des notes (s24), deja resolu : `use()` lit une promesse marquee
 * `fulfilled` sans suspendre, la fiche se rend d'un seul tenant.
 */
const EMPTY_NOTES = {items: [], page: 1, pageSize: 10, total: 0, totalPages: 0}
const RESOLVED_NOTES = Object.assign(Promise.resolve(EMPTY_NOTES), {
  status: 'fulfilled',
  value: EMPTY_NOTES,
})

/** Aucun refus des campagnes (s25), deja resolu. */
const NOT_UNSUBSCRIBED = Object.assign(Promise.resolve(null), {
  status: 'fulfilled',
  value: null,
})

/** Un compte qui ne gere pas les factures (s19) : la carte n'est pas rendue. */
const NO_INVOICES = Object.assign(Promise.resolve(undefined), {
  status: 'fulfilled',
  value: undefined,
})

type DetailInput = {
  profile?: MemberProfileDTO
  parcels?: MemberParcelsDTO
  created?: boolean
  soldParcelId?: string
  unsubscribePromise?: Promise<{createdAt: string} | null>
}

const detailOf = (input: DetailInput = {}) => (
  <MemberProfileDetail
    profile={input.profile ?? profile()}
    parcels={input.parcels ?? NO_PARCELS}
    today="2026-09-29"
    created={input.created ?? false}
    soldParcelId={input.soldParcelId}
    notesPromise={RESOLVED_NOTES}
    unsubscribePromise={input.unsubscribePromise ?? NOT_UNSUBSCRIBED}
    invoicesPromise={NO_INVOICES}
    invoiceSaved={false}
    invitationLinkDays={7}
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

  it('ne porte aucun badge pour une fiche qui a un email, listé dans sa carte (s54)', () => {
    renderDetail({
      profile: profile({
        email: 'claire@example.fr',
        mailOnly: false,
        emails: [
          {
            id: 'e1',
            email: 'claire@example.fr',
            role: 'holder',
            status: 'active',
            origin: 'site',
            addedByName: null,
            expiresAt: null,
            replacesEmailId: null,
            boardRole: null,
            otherProfiles: [],
            invitation: {state: 'never', at: null},
          },
        ],
      }),
    })

    expect(screen.queryByText('Courrier uniquement')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', {name: 'Adresses email'})).getAllByText(
        'claire@example.fr'
      ).length
    ).toBeGreaterThan(0)
  })

  it('place la carte « Adresses email » entre « Coordonnées » et « Accès à l’espace membre » (s54, écran 4)', () => {
    renderDetail()

    const titles = screen
      .getAllByRole('heading', {level: 2})
      .map((heading) => heading.textContent)
    expect(titles.indexOf('Adresses email')).toBe(
      titles.indexOf('Coordonnées') + 1
    )
    expect(titles.indexOf('Accès à l’espace membre')).toBe(
      titles.indexOf('Adresses email') + 1
    )
  })

  it('accorde « Non renseignée », « Non renseigné » et « Aucun » aux libellés', () => {
    renderDetail({
      profile: profile({
        homeAddressLine: null,
        homePostalCode: null,
        homeCity: null,
        incomplete: true,
      }),
    })

    const contact = screen.getByRole('region', {name: 'Coordonnées'})
    const valueOf = (label: string) =>
      within(contact).getByText(label).nextElementSibling

    expect(within(contact).queryByText('Adresse email')).toBeNull()
    expect(valueOf('Téléphone')).toHaveTextContent(/^Non renseigné$/)
    expect(valueOf('Adresse de domicile')).toHaveTextContent(/^Non renseignée$/)
    expect(valueOf('Adresse du terrain')).toHaveTextContent(/^Non renseignée$/)
    expect(valueOf('Nom de l’entreprise')).toHaveTextContent(/^Aucun$/)
  })

  it('montre domicile, terrain et nom de l’entreprise dans l’ordre du design, avec leurs mentions (s55)', () => {
    renderDetail({
      profile: profile({
        homeAddressComplement: 'Bâtiment B',
        landAddressLine: '3 rue du Lavoir',
        landPostalCode: '40600',
        landCity: 'Biscarrosse',
        companyName: 'Épicerie du Clos',
      }),
    })

    const contact = screen.getByRole('region', {name: 'Coordonnées'})
    const terms = within(contact)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(terms).toEqual([
      'Téléphone',
      'Adresse de domicile',
      'Adresse du terrain',
      'Nom de l’entreprise',
    ])
    const valueOf = (label: string) =>
      within(contact).getByText(label).nextElementSibling

    expect(valueOf('Adresse de domicile')).toHaveTextContent(
      '8 chemin des PinsBâtiment B33680 LacanauAdresse postale : le courrier de l’association part ici.'
    )
    expect(valueOf('Adresse du terrain')).toHaveTextContent(
      /^3 rue du Lavoir40600 Biscarrosse$/
    )
    expect(valueOf('Nom de l’entreprise')).toHaveTextContent(
      'Épicerie du ClosImprimé dans le bloc adresse du courrier. Ne change ni le rôle, ni les factures, ni le droit de vote.'
    )
  })

  it('signale la fiche incomplète en tête, et mène à la saisie du domicile (état 3d, s55)', async () => {
    renderDetail({
      profile: profile({
        homeAddressLine: null,
        homePostalCode: null,
        homeCity: null,
        landAddressLine: '3 rue du Lavoir',
        landCity: 'Biscarrosse',
        incomplete: true,
      }),
    })

    expect(screen.getByText('Fiche incomplète')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Cette fiche n’a ni adresse email ni adresse de domicile : aucun envoi ne peut atteindre ce propriétaire\./
      )
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter l’adresse de domicile'})
    )

    const home = screen.getByRole('group', {name: /Adresse de domicile/})
    expect(within(home).getByLabelText('Adresse')).toHaveFocus()
  })

  it('n’affiche pas l’alerte d’une fiche complète', () => {
    renderDetail()

    expect(
      screen.queryByRole('button', {name: 'Ajouter l’adresse de domicile'})
    ).not.toBeInTheDocument()
  })

  it('modifie les coordonnées en place, puis le dit (critère 6)', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    const home = screen.getByRole('group', {name: /Adresse de domicile/})
    const land = screen.getByRole('group', {name: /Adresse du terrain/})
    expect(within(home).getByLabelText('Adresse')).toHaveValue(
      '8 chemin des Pins'
    )

    await userEvent.type(screen.getByLabelText(/Téléphone/), '06 12 34 56 78')
    await userEvent.type(
      within(land).getByLabelText('Adresse'),
      '3 rue du Lavoir'
    )
    await userEvent.type(within(land).getByLabelText('Code postal'), '40600')
    await userEvent.type(within(land).getByLabelText('Commune'), 'Biscarrosse')
    await userEvent.type(
      screen.getByLabelText(/Nom de l’entreprise/),
      'Épicerie du Clos'
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

    expect(sentFields(actions.updateContactAction)).toEqual({
      memberProfileId: PROFILE_ID,
      phone: '06 12 34 56 78',
      homeAddressLine: '8 chemin des Pins',
      homeAddressComplement: '',
      homePostalCode: '33680',
      homeCity: 'Lacanau',
      landAddressLine: '3 rue du Lavoir',
      landAddressComplement: '',
      landPostalCode: '40600',
      landCity: 'Biscarrosse',
      companyName: 'Épicerie du Clos',
    })
    expect(
      await screen.findByText('Coordonnées enregistrées.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    ).toBeInTheDocument()
  })

  it('refuse un code postal du terrain invalide, et le message nomme le groupe (état 1e, s55)', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    const land = screen.getByRole('group', {name: /Adresse du terrain/})
    await userEvent.type(within(land).getByLabelText('Code postal'), '4060')
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer les coordonnées'})
    )

    expect(actions.updateContactAction).not.toHaveBeenCalled()
    expect(
      within(land).getByText('Terrain : le code postal compte cinq chiffres.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Terrain : le code postal compte cinq chiffres.',
      })
    ).toBeInTheDocument()
  })

  it('abandonne la modification sans rien envoyer', async () => {
    renderDetail()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier les coordonnées'})
    )
    await userEvent.click(screen.getByRole('button', {name: 'Annuler'}))

    expect(actions.updateContactAction).not.toHaveBeenCalled()
    expect(screen.queryAllByLabelText('Adresse')).toHaveLength(0)
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

  it('ne dit plus le rôle au bureau ni les autres fiches : la carte des adresses les porte, par adresse (s54)', () => {
    renderDetail({profile: sharedProfile('board')})

    expect(accessCard()).not.toHaveTextContent('Membre du bureau')
    expect(accessCard()).not.toHaveTextContent('Ce compte réunit aussi')
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

describe('MemberProfileDetail — carte « Rôle dans l’association » (s14)', () => {
  const memberProfile = profile({
    name: 'Lucie Moreau',
    email: 'lucie@example.test',
    mailOnly: false,
    account: {
      status: 'open',
      loginEmail: 'lucie@example.test',
      boardRole: null,
      accountName: 'Lucie Moreau',
      otherProfiles: [],
    },
    pennylaneCustomerId: null,
    roleCard: {
      reading: 'member',
      canEdit: true,
      notice: null,
      options: ['member', 'board'],
      self: false,
    },
  })

  it('se place après « Accès à l’espace membre » et avant « Parcelles »', () => {
    renderDetail({profile: memberProfile})

    const titles = screen
      .getAllByRole('heading', {level: 2})
      .map((heading) => heading.textContent)
    expect(titles).toEqual([
      'Coordonnées',
      'Adresses email',
      'Accès à l’espace membre',
      'Rôle dans l’association',
      'Parcelles',
      'Facturation',
      'Notes et échanges',
    ])
  })

  it('A3 : confirme « Rôle enregistré. » en haut de la fiche, role="status"', async () => {
    actions.changeRoleAction.mockResolvedValue({
      status: 'saved',
      change: 'assigned',
      message:
        'Lucie Moreau fait maintenant partie du bureau et peut gérer le site de l’association dès maintenant.',
    })
    renderDetail({profile: memberProfile})

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier le rôle'})
    )
    await userEvent.click(screen.getByRole('radio', {name: 'Bureau'}))
    await userEvent.click(
      screen.getByRole('button', {name: 'Enregistrer le rôle'})
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Rôle enregistré.')
    expect(status).toHaveTextContent(
      'Lucie Moreau fait maintenant partie du bureau et peut gérer le site de l’association dès maintenant.'
    )
    expect(
      status.compareDocumentPosition(
        screen.getByRole('heading', {level: 1, name: 'Lucie Moreau'})
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('MemberProfileDetail — parcelle importée (s13, date sentinelle)', () => {
  it('écrit « avant l’import » à la place de la date sentinelle, la date sinon', () => {
    renderDetail({
      parcels: {
        current: [
          {parcelId: 'p12', number: 'ZZ 101', startsOn: '1900-01-01'},
          {parcelId: 'p13', number: 'ZZ 102', startsOn: '2009-09-11'},
        ],
        former: [],
      },
    })

    const rows = within(currentTable()).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('avant l’import')
    expect(rows[0]).not.toHaveTextContent('01/01/1900')
    expect(rows[1]).toHaveTextContent('11/09/2009')
  })

  it('écrit la période d’une ancienne parcelle importée sans la date sentinelle', () => {
    renderDetail({
      parcels: {
        current: [],
        former: [{...SELLER_PARCELS.former[0], startsOn: '1900-01-01'}],
      },
    })

    const [row] = within(formerTable()).getAllByRole('row').slice(1)
    expect(row).toHaveTextContent('d’avant l’import au 14/06/2026')
    expect(row).not.toHaveTextContent('1900')
  })
})

describe('MemberProfileDetail — carte « Notes et échanges » (s24)', () => {
  it('monte la carte des notes internes après « Parcelles » et « Facturation » (s20)', () => {
    renderDetail()

    const titles = screen
      .getAllByRole('heading', {level: 2})
      .map((heading) => heading.textContent)
    expect(titles.at(-1)).toBe('Notes et échanges')
    expect(titles.indexOf('Facturation')).toBe(titles.length - 2)
    expect(titles.indexOf('Parcelles')).toBe(titles.length - 3)
  })
})

describe('MemberProfileDetail — désinscription des campagnes (s25)', () => {
  const unsubscribedSince = (createdAt: string) =>
    Object.assign(Promise.resolve({createdAt}), {
      status: 'fulfilled',
      value: {createdAt},
    })

  it('a · désinscrit : la mention se monte sous le titre de la fiche', () => {
    renderDetail({
      unsubscribePromise: unsubscribedSince('2026-11-12T13:32:00.000Z'),
    })

    const heading = screen.getByRole('heading', {level: 1})
    const badge = screen.getByText('Désinscrit des campagnes')
    expect(
      heading.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(heading.parentElement?.contains(badge)).toBe(true)
  })

  it('b · non désinscrit : aucune mention', () => {
    renderDetail()

    expect(screen.queryByText('Désinscrit des campagnes')).toBeNull()
  })

  it('c · désinscrit et sans email : les deux badges', () => {
    renderDetail({
      profile: profile({email: null, mailOnly: true}),
      unsubscribePromise: unsubscribedSince('2026-11-12T13:32:00.000Z'),
    })

    expect(screen.getByText('Désinscrit des campagnes')).toBeInTheDocument()
    expect(
      screen.getByText('Courrier uniquement', {selector: '[data-slot="badge"]'})
    ).toBeInTheDocument()
  })
})

describe('MemberProfileDetail — un compte, plusieurs terrains (s53)', () => {
  it('3b : à l’arrivée d’une fiche créée et reliée à un compte partagé, le dit', () => {
    renderDetail({created: true, profile: sharedProfile()})

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Propriétaire enregistré.')
    expect(status).toHaveTextContent(
      'Fiche reliée au compte de Bernard Lefèvre : ce terrain apparaît dans son espace.'
    )
  })
})

describe('MemberProfileDetail — carte « Facturation » (s20, critère 4)', () => {
  it('lit l’identifiant client Pennylane de la fiche, entre « Parcelles » et les notes', async () => {
    await act(async () => {
      renderDetail({
        profile: {...profile(), pennylaneCustomerId: 'ref-pennylane-1'},
      })
    })

    const billing = screen.getByRole('region', {name: 'Facturation'})
    expect(billing).toHaveTextContent('ref-pennylane-1')
    const parcels = screen.getByRole('region', {name: 'Parcelles'})
    expect(
      parcels.compareDocumentPosition(billing) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('MemberProfileDetail — invitation depuis « Accès à l’espace membre » (s42a, écran 2)', () => {
  const accessCard = () =>
    screen.getByRole('region', {name: 'Accès à l’espace membre'})

  const activeEmail = (
    address: string,
    invitation: MemberProfileDTO['emails'][number]['invitation'] = {
      state: 'never',
      at: null,
    }
  ): MemberProfileDTO['emails'][number] => ({
    id: address,
    email: address,
    role: address.startsWith('jean') ? 'holder' : 'additional',
    status: 'active',
    origin: 'site',
    addedByName: null,
    expiresAt: null,
    replacesEmailId: null,
    boardRole: null,
    otherProfiles: [],
    invitation,
  })

  const familyProfile = (
    claireInvitation?: MemberProfileDTO['emails'][number]['invitation']
  ) =>
    profile({
      name: 'Jean Dubois',
      email: 'jean.dubois@exemple.fr',
      mailOnly: false,
      emails: [
        activeEmail('jean.dubois@exemple.fr'),
        activeEmail('claire.dubois@exemple.fr', claireInvitation),
      ],
      account: {
        status: 'open',
        loginEmail: 'jean.dubois@exemple.fr',
        boardRole: null,
        accountName: 'Jean Dubois',
        otherProfiles: [],
      },
    })

  const sendButton = (name: RegExp = /invitation/) =>
    within(accessCard()).getByRole('button', {name})

  it('2a jamais invitée : « Envoyer l’invitation », ce qui va se passer, la durée du lien', () => {
    renderDetail({profile: familyProfile()})

    expect(sendButton()).toHaveTextContent('Envoyer l’invitation')
    expect(accessCard()).toHaveTextContent(
      'Un email part à chacune des 2 adresses actives, avec son propre lien de connexion, valable 7 jours.'
    )
  })

  it('2b déjà invitée : « Renvoyer l’invitation », les liens précédents cesseront de fonctionner', () => {
    renderDetail({
      profile: familyProfile({
        state: 'invited',
        at: '2026-11-24T09:15:00.000Z',
      }),
    })

    expect(sendButton()).toHaveTextContent('Renvoyer l’invitation')
    expect(accessCard()).toHaveTextContent(
      'Les liens envoyés le 24/11/2026 cesseront de fonctionner. Un email part à chacune des 2 adresses actives.'
    )
  })

  it('2c puis 2d : envoie la fiche, montre l’envoi en cours, puis l’alerte ancrée qui nomme les adresses', async () => {
    let release: (value: unknown) => void = () => {}
    actions.inviteAction.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(sendButton(/Envoi en cours/)).toBeDisabled()
    expect(
      (actions.inviteAction.mock.calls[0][1] as FormData).get('memberProfileId')
    ).toBe(PROFILE_ID)
    await act(async () =>
      release({
        status: 'sent',
        sent: ['jean.dubois@exemple.fr', 'claire.dubois@exemple.fr'],
      })
    )

    const status = within(accessCard()).getByRole('status')
    expect(status).toHaveTextContent(
      'Invitation envoyée à jean.dubois@exemple.fr et claire.dubois@exemple.fr.'
    )
    expect(status).toHaveFocus()
  })

  it('2e reportée : l’invitation partira demain matin, avec un lien neuf', async () => {
    actions.inviteAction.mockResolvedValue({
      status: 'deferred',
      sent: [],
      deferred: ['jean.dubois@exemple.fr', 'claire.dubois@exemple.fr'],
    })
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(await within(accessCard()).findByRole('status')).toHaveTextContent(
      'L’invitation partira demain matin : l’association a atteint sa limite d’envois du jour. Un lien neuf sera créé au moment de l’envoi.'
    )
  })

  it('2f courrier uniquement : aucun bouton, la phrase du courrier', () => {
    renderDetail()

    expect(within(accessCard()).queryByRole('button')).toBeNull()
    expect(accessCard()).toHaveTextContent(
      'Pas d’invitation possible : ce membre reçoit tout par courrier.'
    )
  })

  it('2f refus rendu par l’action : le membre relève du courrier, jamais une erreur technique', async () => {
    actions.inviteAction.mockResolvedValue({status: 'mail_only'})
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(await within(accessCard()).findByRole('status')).toHaveTextContent(
      'Ce membre relève du courrier. Il n’a plus d’adresse email active : ajoutez-en une pour l’inviter.'
    )
  })

  it('2g échec : alerte destructive ancrée dans la carte, aucun email parti', async () => {
    actions.inviteAction.mockResolvedValue({status: 'failed'})
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(await within(accessCard()).findByRole('alert')).toHaveTextContent(
      'L’invitation n’est pas partie. Aucun email n’a été envoyé ; réessayez dans quelques minutes.'
    )
  })

  it('2g partiel : nomme les adresses servies', async () => {
    actions.inviteAction.mockResolvedValue({
      status: 'partial',
      sent: ['jean.dubois@exemple.fr'],
    })
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(await within(accessCard()).findByRole('alert')).toHaveTextContent(
      'L’invitation n’est partie qu’à jean.dubois@exemple.fr. Réessayez pour les autres adresses.'
    )
  })

  it('refus d’autorisation : le message rendu par l’action', async () => {
    actions.inviteAction.mockResolvedValue({
      status: 'error',
      message: 'Cette action est réservée au bureau de l’association.',
    })
    renderDetail({profile: familyProfile()})

    await userEvent.click(sendButton())

    expect(await within(accessCard()).findByRole('alert')).toHaveTextContent(
      'Cette action est réservée au bureau de l’association.'
    )
  })
})
