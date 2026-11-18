import {beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn(), refresh: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {
  MemberProfileListItemDTO,
  MemberProfilePageDTO,
} from '@/services/types/domain/member-profile-types'
import type {RecipientGroupSelectionActionResult} from '@/services/types/domain/recipient-group-types'

import {MemberProfileList} from './member-profile-list'

const item = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: '11111111-1111-4111-8111-111111111111',
  name: 'Claire Meunier',
  email: 'claire.meunier@example.fr',
  phone: null,
  homeAddressLine: '14 allée des Aulnes',
  homeAddressComplement: null,
  homePostalCode: '33680',
  homeCity: 'Lacanau',
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
  mailOnly: false,
  incomplete: false,
  currentParcelNumbers: ['12', '13'],
  boardRole: null,
  accountProfileCount: 1,
  otherEmailCount: 0,
  ...overrides,
})

const mailOnly = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO => item({email: null, mailOnly: true, ...overrides})

const incomplete = (
  overrides: Partial<MemberProfileListItemDTO> = {}
): MemberProfileListItemDTO =>
  mailOnly({
    homeAddressLine: null,
    homePostalCode: null,
    homeCity: null,
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
            homeAddressLine: '8 chemin des Pins',
            homePostalCode: '33680',
            homeCity: 'Lacanau',
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

/** s14, écran B : un badge de rôle à côté du nom, rien pour un Membre. */
describe('MemberProfileList — badge de rôle (s14, B1 et B2)', () => {
  const list = () =>
    page([
      item({id: 'a', name: 'Hélène Roux', boardRole: 'owner'}),
      item({id: 'b', name: 'Paul Vidal', boardRole: 'board'}),
      item({id: 'c', name: 'Lucie Moreau', boardRole: null}),
    ])

  it('B1 : badge « Président(e) » ou « Bureau » dans la cellule du nom', () => {
    render(<MemberProfileList list={list()} />)

    const [helene, paul, lucie] = tableRows()
    const nameCell = (row: HTMLElement) => within(row).getAllByRole('cell')[0]
    expect(within(nameCell(helene)).getByText('Président(e)')).toBeVisible()
    expect(within(nameCell(paul)).getByText('Bureau')).toBeVisible()
    expect(within(nameCell(lucie)).queryByText('Bureau')).toBeNull()
    expect(within(nameCell(lucie)).queryByText('Président(e)')).toBeNull()
  })

  it('B2 : sur mobile, le badge passe sous le nom de la carte', () => {
    render(<MemberProfileList list={list()} />)

    const [helene, , lucie] = cards()
    const heading = within(helene).getByRole('heading', {name: 'Hélène Roux'})
    const badge = within(helene).getByText('Président(e)')
    expect(
      heading.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(heading).not.toContainElement(badge)
    expect(within(lucie).queryByText('Bureau')).toBeNull()
  })
})

describe('MemberProfileList — compte de plusieurs terrains (s53, état 4a)', () => {
  it('écrit « Compte de 3 terrains » sous l’adresse, au tableau et sur la carte', () => {
    render(
      <MemberProfileList
        list={page([
          item({
            name: 'SCI Les Pins',
            email: 'bernard.lefevre@exemple.fr',
            accountProfileCount: 3,
          }),
        ])}
      />
    )

    const [row] = tableRows()
    expect(within(row).getByText('Compte de 3 terrains')).toBeInTheDocument()
    expect(
      within(cards()[0]).getByText('Compte de 3 terrains')
    ).toBeInTheDocument()
  })

  it('n’écrit rien pour un compte d’un seul terrain ni pour une fiche sans compte', () => {
    render(
      <MemberProfileList
        list={page([
          item({accountProfileCount: 1}),
          mailOnly({
            id: '44444444-4444-4444-8444-444444444444',
            accountProfileCount: 0,
          }),
        ])}
      />
    )

    expect(screen.queryByText(/Compte de \d+ terrains/)).toBeNull()
  })
})

describe('MemberProfileList — autres adresses de la fiche (s54, état 5a)', () => {
  it('écrit « + 2 autres adresses » sous la titulaire, au tableau et sur la carte', () => {
    render(
      <MemberProfileList
        list={page([
          item({email: 'jean.dubois@exemple.fr', otherEmailCount: 2}),
        ])}
      />
    )

    const [row] = tableRows()
    expect(within(row).getByText('+ 2 autres adresses')).toBeInTheDocument()
    expect(
      within(cards()[0]).getByText('+ 2 autres adresses')
    ).toBeInTheDocument()
  })

  it('met le compte de plusieurs terrains et les autres adresses sur la même ligne, séparés par « · »', () => {
    render(
      <MemberProfileList
        list={page([
          item({
            email: 'bernard.lefevre@exemple.fr',
            accountProfileCount: 3,
            otherEmailCount: 1,
          }),
        ])}
      />
    )

    const [row] = tableRows()
    expect(
      within(row).getByText('Compte de 3 terrains · + 1 autre adresse')
    ).toBeInTheDocument()
  })

  it('n’écrit rien sans autre adresse active', () => {
    render(<MemberProfileList list={page([item({otherEmailCount: 0})])} />)

    expect(screen.queryByText(/autres? adresses?/)).toBeNull()
  })
})

// Radix Select s'appuie sur des API de pointeur absentes de jsdom.
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

describe('MemberProfileList — groupes de destinataires (s27, écran 2)', () => {
  const GROUP_A = '99999999-9999-4999-8999-999999999999'
  const GROUP_B = '88888888-8888-4888-8888-888888888888'
  const CLAIRE = '33333333-3333-4333-8333-333333333333'
  const PAUL = '44444444-4444-4444-8444-444444444444'
  const groups = [
    {id: GROUP_A, name: 'Riverains', profileCount: 36},
    {id: GROUP_B, name: 'Bord de mer', profileCount: 4},
  ]
  const items = [item(), item({id: PAUL, name: 'Paul Renaud'})]

  type Action = (
    state: RecipientGroupSelectionActionResult | undefined,
    formData: FormData
  ) => Promise<RecipientGroupSelectionActionResult>
  let addAction: ReturnType<typeof vi.fn<Action>>
  let removeAction: ReturnType<typeof vi.fn<Action>>

  beforeEach(() => {
    vi.clearAllMocks()
    addAction = vi.fn(async () => ({
      status: 'saved' as const,
      groupId: GROUP_A,
      groupName: 'Riverains',
      changed: 2,
      profileCount: 38,
    }))
    removeAction = vi.fn(async () => ({
      status: 'saved' as const,
      groupId: GROUP_A,
      groupName: 'Riverains',
      changed: 1,
      profileCount: 35,
    }))
  })

  const renderList = (
    overrides: {groupId?: string; groups?: typeof groups; list?: never} = {}
  ) =>
    render(
      <MemberProfileList
        list={page(items)}
        groupSelection={{
          groups: overrides.groups ?? groups,
          groupId: overrides.groupId,
          addAction,
          removeAction,
        }}
      />
    )

  const table = () => screen.getByRole('table')
  const sentFields = (action: {mock: {calls: unknown[][]}}) =>
    action.mock.calls[0][1] as FormData

  it('sans groupes de destinataires à gérer, ni cases ni filtre', () => {
    render(<MemberProfileList list={page(items)} />)

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('combobox', {name: 'Groupe'})).toBeNull()
  })

  it('propose le filtre « Groupe », « Tous les propriétaires » par défaut, qui pose ?groupe=', async () => {
    renderList()

    const filter = screen.getByRole('combobox', {name: 'Groupe'})
    expect(filter).toHaveTextContent('Tous les propriétaires')
    await userEvent.click(filter)
    await userEvent.click(screen.getByRole('option', {name: 'Riverains'}))

    expect(router.push).toHaveBeenCalledWith(
      `/bureau/proprietaires?groupe=${GROUP_A}`
    )
  })

  it('cocher une fiche fait paraître la barre de sélection, annoncée', async () => {
    renderList()
    expect(screen.queryByText(/sélectionnée/)).toBeNull()

    await userEvent.click(
      within(table()).getByRole('checkbox', {name: 'Sélectionner Paul Renaud'})
    )

    const status = screen.getByText('1 fiche sélectionnée')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(
      screen.getByRole('button', {name: 'Ajouter au groupe'})
    ).toBeInTheDocument()
  })

  it('la case de l’en-tête sélectionne toute la page, puis l’ajout part au groupe choisi', async () => {
    renderList()

    await userEvent.click(
      within(table()).getByRole('checkbox', {
        name: 'Tout sélectionner sur cette page',
      })
    )
    expect(screen.getByText('2 fiches sélectionnées')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter au groupe'})
    )

    await waitFor(() => expect(addAction).toHaveBeenCalledTimes(1))
    const sent = sentFields(addAction)
    expect(sent.get('groupId')).toBe(GROUP_A)
    expect(sent.getAll('memberProfileIds')).toEqual([CLAIRE, PAUL])
    expect(
      await screen.findByText(
        '2 fiches ajoutées au groupe « Riverains ». Le groupe compte 38 fiches.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Voir le groupe'})).toHaveAttribute(
      'href',
      `/bureau/groupes/${GROUP_A}`
    )
    expect(screen.queryByText(/sélectionnée/)).toBeNull()
  })

  it('un échec dit que rien n’a changé, la sélection reste', async () => {
    addAction.mockResolvedValue({
      status: 'error',
      message:
        'Les fiches n’ont pas été ajoutées au groupe. Rien n’a changé. Réessayez.',
    })
    renderList()

    await userEvent.click(
      within(table()).getByRole('checkbox', {name: 'Sélectionner Paul Renaud'})
    )
    await userEvent.click(
      screen.getByRole('button', {name: 'Ajouter au groupe'})
    )

    expect(
      await screen.findByText(
        'Les fiches n’ont pas été ajoutées au groupe. Rien n’a changé. Réessayez.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('1 fiche sélectionnée')).toBeInTheDocument()
  })

  it('filtrée sur un groupe, la barre propose « Retirer du groupe »', async () => {
    renderList({groupId: GROUP_A})

    expect(screen.getByRole('combobox', {name: 'Groupe'})).toHaveTextContent(
      'Riverains'
    )
    await userEvent.click(
      within(table()).getByRole('checkbox', {name: 'Sélectionner Paul Renaud'})
    )
    expect(screen.queryByRole('button', {name: 'Ajouter au groupe'})).toBeNull()
    await userEvent.click(
      screen.getByRole('button', {name: 'Retirer du groupe'})
    )

    await waitFor(() => expect(removeAction).toHaveBeenCalledTimes(1))
    expect(sentFields(removeAction).get('groupId')).toBe(GROUP_A)
    expect(sentFields(removeAction).getAll('memberProfileIds')).toEqual([PAUL])
    expect(
      await screen.findByText(
        '1 fiche retirée du groupe « Riverains ». Le groupe compte 35 fiches.'
      )
    ).toBeInTheDocument()
  })

  it('un groupe vide dit comment le composer', () => {
    render(
      <MemberProfileList
        list={page([], {profileCount: 12})}
        groupSelection={{groups, groupId: GROUP_B, addAction, removeAction}}
      />
    )

    expect(
      screen.getByText(
        'Ce groupe n’a encore aucune fiche. Choisissez « Tous les propriétaires », cochez des fiches, puis « Ajouter au groupe ».'
      )
    ).toBeInTheDocument()
  })

  it('aucun groupe : la barre le dit, avec un lien pour en créer un', async () => {
    renderList({groups: []})

    await userEvent.click(
      within(table()).getByRole('checkbox', {name: 'Sélectionner Paul Renaud'})
    )

    expect(screen.getByText(/Aucun groupe pour l’instant/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Créer un groupe'})).toHaveAttribute(
      'href',
      '/bureau/groupes'
    )
    expect(screen.queryByRole('button', {name: 'Ajouter au groupe'})).toBeNull()
  })

  it('en carte mobile, la case est dans le titre de la carte', () => {
    renderList()

    expect(
      within(cards()[1]).getByRole('checkbox', {
        name: 'Sélectionner Paul Renaud',
      })
    ).toBeInTheDocument()
  })
})
