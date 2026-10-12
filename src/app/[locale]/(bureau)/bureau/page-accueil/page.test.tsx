import {ReactElement} from 'react'
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/home-page-dal', () => ({
  canManageCurrentHomePageDal: vi.fn(),
  getHomePageForBureauDal: vi.fn(),
  homePageTag: (organizationId: string) => `home-page:${organizationId}`,
}))
vi.mock('@/app/dal/page-dal', () => ({
  getPagesForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({saveHomePageAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {
  canManageCurrentHomePageDal,
  getHomePageForBureauDal,
} from '@/app/dal/home-page-dal'
import {getPagesForBureauDal} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {PageDTO} from '@/services/types/domain/page-types'

import BureauHomePage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const pageDto = (overrides: Partial<PageDTO> = {}): PageDTO => ({
  id: '33333333-3333-4333-8333-333333333333',
  organizationId: TENANT_ID,
  slug: 'bienvenue',
  title: 'Bienvenue aux Amis de l’Étang',
  status: 'published',
  seoTitle: null,
  seoDescription: null,
  shareImageKey: null,
  shareImageAlt: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
  ...overrides,
})

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async () => {
  const element = (await BureauHomePage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getHomePageForBureauDal).mockResolvedValue({
    page: {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Bienvenue aux Amis de l’Étang',
      status: 'published',
    },
  })
  vi.mocked(getPagesForBureauDal).mockResolvedValue([pageDto()])
})

describe('/bureau/page-accueil — accès par rôle (critère 4)', () => {
  it('laisse le bureau choisir l accueil, page désignée comprise', async () => {
    vi.mocked(canManageCurrentHomePageDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Page d’accueil'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Aujourd’hui : la page « Bienvenue aux Amis de l’Étang ».'
      )
    ).toBeInTheDocument()
    expect(getHomePageForBureauDal).toHaveBeenCalledWith(TENANT_ID)
    expect(getPagesForBureauDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('refuse un membre hors du bureau, sans rien lire', async () => {
    vi.mocked(canManageCurrentHomePageDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(getHomePageForBureauDal).not.toHaveBeenCalled()
    expect(getPagesForBureauDal).not.toHaveBeenCalled()
  })
})
