import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/member-profile-dal', () => ({
  canManageCurrentMemberProfilesDal: vi.fn(),
  getMemberProfilesPageForBureauDal: vi.fn(),
}))
vi.mock('@/app/dal/member-annual-import-dal', () => ({
  canImportCurrentMemberContactsDal: vi.fn(),
}))
vi.mock('@/app/dal/recipient-group-dal', () => ({
  canManageCurrentRecipientGroupsDal: vi.fn(),
  getRecipientGroupsForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  addToRecipientGroupAction: vi.fn(),
  removeFromRecipientGroupAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}))

import {render, screen} from '@/__tests__/customRender'
import {canImportCurrentMemberContactsDal} from '@/app/dal/member-annual-import-dal'
import {
  canManageCurrentMemberProfilesDal,
  getMemberProfilesPageForBureauDal,
} from '@/app/dal/member-profile-dal'
import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupsForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberProfilesPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (
  searchParams: {page?: string; q?: string; groupe?: string} = {}
) => {
  const element = (await BureauMemberProfilesPage({
    params: Promise.resolve({locale: 'fr'}),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getMemberProfilesPageForBureauDal).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
    profileCount: 0,
    incompleteCount: 0,
  })
  vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(false)
  vi.mocked(canImportCurrentMemberContactsDal).mockResolvedValue(false)
  vi.mocked(getRecipientGroupsForBureauDal).mockResolvedValue([])
})

describe('/bureau/proprietaires — accès par rôle', () => {
  it('montre la liste au bureau, à la page et pour la recherche demandées', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage({page: '2', q: 'dub'})

    expect(
      screen.getByRole('heading', {level: 1, name: 'Propriétaires'})
    ).toBeInTheDocument()
    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      2,
      'dub',
      undefined
    )
    expect(screen.getByRole('searchbox')).toHaveValue('dub')
  })

  it('lit la première page, sans recherche, quand l’URL ne dit rien', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()

    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      1,
      undefined,
      undefined
    )
  })

  it('refuse un membre simple, sans lire la liste', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(getMemberProfilesPageForBureauDal).not.toHaveBeenCalled()
  })

  it('charge avec l’en-tête du tableau en place', async () => {
    const element = (await BureauMemberProfilesPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve({}),
    })) as ReactElement<{fallback: ReactElement}>

    render(element.props.fallback)

    expect(
      screen.getByRole('columnheader', {name: 'Propriétaire'})
    ).toBeInTheDocument()
  })
})

describe('/bureau/proprietaires — groupes de destinataires (s27)', () => {
  const GROUP_ID = '99999999-9999-4999-8999-999999999999'
  const withOneProfile = () =>
    vi.mocked(getMemberProfilesPageForBureauDal).mockResolvedValue({
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          organizationId: TENANT_ID,
          name: 'Claire Meunier',
          email: 'claire@example.fr',
          phone: null,
          homeAddressLine: null,
          homeAddressComplement: null,
          homePostalCode: null,
          homeCity: null,
          landAddressLine: null,
          landAddressComplement: null,
          landPostalCode: null,
          landCity: null,
          companyName: null,
          mailOnly: false,
          incomplete: false,
          currentParcelNumbers: [],
          boardRole: null,
          accountProfileCount: 0,
          otherEmailCount: 0,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      profileCount: 1,
      incompleteCount: 0,
    })

  it('à qui compose les groupes : filtre lu dans ?groupe=, cases à cocher', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)
    vi.mocked(getRecipientGroupsForBureauDal).mockResolvedValue([
      {id: GROUP_ID, name: 'Riverains', profileCount: 1},
    ])
    withOneProfile()

    await renderPage({groupe: GROUP_ID})

    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      1,
      undefined,
      GROUP_ID
    )
    expect(screen.getByRole('combobox', {name: 'Groupe'})).toHaveTextContent(
      'Riverains'
    )
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
  })

  it('sans ce droit : ni filtre ni cases, le paramètre est ignoré', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    withOneProfile()

    await renderPage({groupe: GROUP_ID})

    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      1,
      undefined,
      undefined
    )
    expect(getRecipientGroupsForBureauDal).not.toHaveBeenCalled()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('un ?groupe= malformé est ignoré', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(canManageCurrentRecipientGroupsDal).mockResolvedValue(true)

    await renderPage({groupe: 'pas-un-uuid'})

    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      1,
      undefined,
      undefined
    )
  })
})

describe('/bureau/proprietaires — mise à jour annuelle (s56, écran 0)', () => {
  it('la présidence voit « Mettre à jour les coordonnées », vers la sous-route', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(canImportCurrentMemberContactsDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('link', {name: 'Mettre à jour les coordonnées'})
    ).toHaveAttribute('href', '/bureau/proprietaires/mise-a-jour')
  })

  it('un membre du Bureau ne voit pas le bouton', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)
    vi.mocked(canImportCurrentMemberContactsDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.queryByRole('link', {name: 'Mettre à jour les coordonnées'})
    ).toBeNull()
  })
})
