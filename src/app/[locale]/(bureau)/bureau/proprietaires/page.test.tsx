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

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentMemberProfilesDal,
  getMemberProfilesPageForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauMemberProfilesPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async (searchParams: {page?: string; q?: string} = {}) => {
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
      'dub'
    )
    expect(screen.getByRole('searchbox')).toHaveValue('dub')
  })

  it('lit la première page, sans recherche, quand l’URL ne dit rien', async () => {
    vi.mocked(canManageCurrentMemberProfilesDal).mockResolvedValue(true)

    await renderPage()

    expect(getMemberProfilesPageForBureauDal).toHaveBeenCalledWith(
      TENANT_ID,
      1,
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
