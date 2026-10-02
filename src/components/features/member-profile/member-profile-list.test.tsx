import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  MemberProfileListItemDTO,
  MemberProfilePageDTO,
} from '@/services/types/domain/member-profile-types'

import {MemberProfileList} from './member-profile-list'

const item = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: '11111111-1111-4111-8111-111111111111',
  name: 'Claire Meunier',
  email: 'claire.meunier@example.fr',
  phone: null,
  addressLine: '14 allée des Aulnes',
  addressComplement: null,
  postalCode: '33680',
  city: 'Lacanau',
  mailOnly: false,
  incomplete: false,
  currentParcelNumbers: ['12', '13'],
  ...overrides,
})

const mailOnly = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO => item({email: null, mailOnly: true, ...overrides})

const incomplete = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO =>
  mailOnly({
    addressLine: null,
    postalCode: null,
    city: null,
    incomplete: true,
    ...overrides,
  })

const page = (
  items: MemberProfileListItemDTO[],
  overrides: Partial<MemberProfilePageDTO> = {}
): MemberProfilePageDTO => ({
  items,
  page: 1,
  pageSize: 25,
  total: items.length,
  totalPages: 1,
  profileCount: items.length,
  incompleteCount: 0,
  ...overrides,
})

const tableRows = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

const cards = () => screen.getAllByTestId('member-profile-card')

describe('MemberProfileList — écran 1 du design s12', () => {
  it('titre la liste, compte les fiches et mène à l’ajout', () => {
    render(
      <MemberProfileList
        list={page([item()], {profileCount: 412, incompleteCount: 1})}
      />
    )

    expect(
      screen.getByRole('heading', {level: 1, name: 'Propriétaires'})
    ).toBeInTheDocument()
    expect(
      screen.getByText('412 propriétaires · 1 fiche incomplète')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Ajouter un propriétaire'})
    ).toHaveAttribute('href', '/bureau/proprietaires/nouveau')
  })

  it('écrit plusieurs parcelles actuelles sur une seule ligne (critère 5)', () => {
    render(
      <MemberProfileList
        list={page([item({currentParcelNumbers: ['5', '6', '30']})])}
      />
    )

    expect(tableRows()).toHaveLength(1)
    expect(within(tableRows()[0]).getByText('5, 6, 30')).toBeInTheDocument()
  })

  it('écrit « Aucune parcelle actuelle » quand la fiche n’en a pas', () => {
    render(
      <MemberProfileList list={page([item({currentParcelNumbers: []})])} />
    )

    expect(
      within(tableRows()[0]).getByText('Aucune parcelle actuelle')
    ).toBeInTheDocument()
  })

  it('montre l’email, ou le badge « Courrier uniquement » pour une fiche sans email (critère 7)', () => {
    render(
      <MemberProfileList
        list={page([item(), mailOnly({id: 'b', name: 'Jean et Odile Dubois'})])}
      />
    )

    const [withEmail, withoutEmail] = tableRows()
    expect(
      within(withEmail).getByText('claire.meunier@example.fr')
    ).toBeInTheDocument()
    expect(
      within(withEmail).queryByText('Courrier uniquement')
    ).not.toBeInTheDocument()
    expect(
      within(withoutEmail).getByText('Courrier uniquement')
    ).toBeInTheDocument()
  })

  it('ne signale « Fiche incomplète » que pour la fiche sans email ni adresse (critère 8)', () => {
    render(
      <MemberProfileList
        list={page([
          item(),
          mailOnly({id: 'b', name: 'Jean et Odile Dubois'}),
          incomplete({id: 'c', name: 'Hélène Roy'}),
        ])}
      />
    )

    const [withEmail, withAddress, without] = tableRows()
    expect(within(without).getByText('Fiche incomplète')).toBeInTheDocument()
    for (const row of [withEmail, withAddress]) {
      expect(
        within(row).queryByText('Fiche incomplète')
      ).not.toBeInTheDocument()
      expect(within(row).getAllByRole('cell')[3]).toBeEmptyDOMElement()
    }
  })

  it('mène à la fiche de chaque propriétaire', () => {
    render(<MemberProfileList list={page([item({id: 'abc'})])} />)

    expect(
      within(tableRows()[0]).getByRole('link', {name: 'Ouvrir la fiche'})
    ).toHaveAttribute('href', '/bureau/proprietaires/abc')
  })

  it('en carte, le contact est l’email, sinon l’adresse postale, sinon « Aucune adresse »', () => {
    render(
      <MemberProfileList
        list={page([
          item(),
          mailOnly({
            id: 'b',
            addressLine: '8 chemin des Pins',
            postalCode: '33680',
            city: 'Lacanau',
          }),
          incomplete({id: 'c'}),
        ])}
      />
    )

    const [withEmail, withAddress, without] = cards()
    expect(
      within(withEmail).getByText('claire.meunier@example.fr')
    ).toBeInTheDocument()
    expect(
      within(withAddress).getByText('8 chemin des Pins, 33680 Lacanau')
    ).toBeInTheDocument()
    expect(within(without).getByText('Aucune adresse')).toBeInTheDocument()
    expect(within(without).getByText('Fiche incomplète')).toBeInTheDocument()
  })
})

describe('MemberProfileList — recherche et pagination', () => {
  it('propose une recherche écrite, par paramètre d’URL, sans loupe', () => {
    render(<MemberProfileList list={page([item()])} search="dub" />)

    const field = screen.getByRole('searchbox', {
      name: 'Rechercher un nom ou un numéro de parcelle',
    })
    expect(field).toHaveAttribute('name', 'q')
    expect(field).toHaveValue('dub')
    expect(field.closest('form')).toHaveAttribute(
      'action',
      '/bureau/proprietaires'
    )
    expect(screen.getByRole('button', {name: 'Rechercher'})).toBeInTheDocument()
  })

  it('conserve la recherche dans les liens de pagination', () => {
    render(
      <MemberProfileList
        list={page([item()], {page: 2, total: 60, totalPages: 3})}
        search="les pins"
      />
    )

    expect(screen.getByRole('link', {name: '← Précédent'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires?q=les+pins&page=1'
    )
    expect(screen.getByRole('link', {name: 'Suivant →'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires?q=les+pins&page=3'
    )
    expect(
      screen.getByText('Page 2 sur 3 · propriétaires 26 à 26')
    ).toBeInTheDocument()
  })

  it('pagine sans paramètre de recherche quand il n’y en a pas', () => {
    render(
      <MemberProfileList
        list={page([item()], {page: 1, total: 60, totalPages: 3})}
      />
    )

    expect(screen.getByRole('link', {name: 'Suivant →'})).toHaveAttribute(
      'href',
      '/bureau/proprietaires?page=2'
    )
    expect(screen.getByRole('button', {name: '← Précédent'})).toBeDisabled()
  })

  it('dit qu’aucune fiche n’existe encore, et propose d’en ajouter une', () => {
    render(<MemberProfileList list={page([])} />)

    expect(
      screen.getByText(
        'Aucun propriétaire pour l’instant. Ajoutez les propriétaires un par un, ou attendez l’import de la liste existante.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', {name: 'Ajouter un propriétaire'}).length
    ).toBeGreaterThan(0)
  })

  it('dit qu’aucune fiche ne correspond à la recherche, en la citant', () => {
    render(
      <MemberProfileList
        list={page([], {profileCount: 412, total: 0})}
        search="Duboi"
      />
    )

    expect(
      screen.getByText(
        'Aucun propriétaire ne correspond à « Duboi ». Vérifiez l’orthographe, ou cherchez par numéro de parcelle.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('Duboi')
  })
})
