import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const actual =
    await vi.importActual<typeof import('next-intl/server')>('next-intl/server')

  return {...actual, setRequestLocale: vi.fn()}
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/site-navigation-dal', () => ({
  canManageCurrentSiteNavigationDal: vi.fn(),
  getSiteNavigationForBureauDal: vi.fn(),
  siteNavigationTag: (organizationId: string) =>
    `site-navigation:${organizationId}`,
}))
vi.mock('@/app/dal/page-dal', () => ({getPagesForBureauDal: vi.fn()}))
vi.mock('./actions', () => ({
  addMenuItemAction: vi.fn(),
  removeMenuItemAction: vi.fn(),
  reorderMenuItemsAction: vi.fn(),
  setMenuItemVisibilityAction: vi.fn(),
  saveSiteFooterAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {getPagesForBureauDal} from '@/app/dal/page-dal'
import {
  canManageCurrentSiteNavigationDal,
  getSiteNavigationForBureauDal,
} from '@/app/dal/site-navigation-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'

import BureauNavigationPage from './page'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

/** Le composant de page est asynchrone : on resout son arbre avant de rendre. */
const renderPage = async () => {
  const element = (await BureauNavigationPage({
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{children: ReactElement}>
  const section = element.props.children
  const type = section.type as (props: unknown) => Promise<ReactElement>

  render(await type(section.props))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(getSiteNavigationForBureauDal).mockResolvedValue({
    menu: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        pageId: '33333333-3333-4333-8333-333333333333',
        rank: 0,
        visible: true,
        pageTitle: "Qualité de l'eau",
        pageSlug: 'qualite-de-leau',
        pageStatus: 'published',
      },
    ],
    footerContent: 'Les Amis de l’Étang',
  })
  vi.mocked(getPagesForBureauDal).mockResolvedValue([])
})

describe('/bureau/navigation — acces par role', () => {
  it('laisse le bureau composer le menu et le pied de page', async () => {
    vi.mocked(canManageCurrentSiteNavigationDal).mockResolvedValue(true)

    await renderPage()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Navigation du site'})
    ).toBeInTheDocument()
    expect(screen.getByText("Qualité de l'eau")).toBeInTheDocument()
    expect(screen.getByLabelText('Contenu du pied de page')).toBeInTheDocument()
  })

  it('refuse un membre hors du bureau, sans lire la navigation', async () => {
    vi.mocked(canManageCurrentSiteNavigationDal).mockResolvedValue(false)

    await renderPage()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText("Qualité de l'eau")).toBeNull()
    expect(getSiteNavigationForBureauDal).not.toHaveBeenCalled()
  })
})
