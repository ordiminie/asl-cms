import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation')

  return {
    ...actual,
    useParams: () => ({locale: 'fr'}),
    usePathname: () => '/',
    useRouter: () => ({replace: vi.fn(), push: vi.fn()}),
    notFound: vi.fn(),
  }
})
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({
    id: 'org-1',
    name: 'Les Amis de l’Étang',
    slug: 'amis-etang',
    domain: 'amis-etang.test',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })),
}))
vi.mock('@/app/dal/site-navigation-dal', () => ({
  getCurrentPublicSiteNavigationDal: vi.fn(),
}))
vi.mock('@/components/features/layouts/public-footer', () => ({
  default: () => <footer>pied de page</footer>,
}))

import {render, screen} from '@/__tests__/customRender'
import {getCurrentPublicSiteNavigationDal} from '@/app/dal/site-navigation-dal'
import {PublicMenuEntryDTO} from '@/services/types/domain/site-navigation-types'

import PublicLayout from './layout'

const withMenu = (menu: PublicMenuEntryDTO[]) => {
  vi.mocked(getCurrentPublicSiteNavigationDal).mockResolvedValue({
    menu,
    footerContent: '',
  })
}

const renderLayout = async () =>
  render(await PublicLayout({children: <p>contenu</p>}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PublicLayout — la navigation composee par le bureau', () => {
  it('rend les entrees du menu dans leur ordre, vers les pages du site', async () => {
    withMenu([
      {id: '1', title: "Qualité de l'eau", slug: 'qualite-de-leau'},
      {id: '2', title: 'Adhérer', slug: 'adherer'},
    ])

    await renderLayout()

    const nav = screen.getByRole('navigation', {name: 'Menu du site'})
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((link) => link.textContent)).toEqual([
      "Qualité de l'eau",
      'Adhérer',
    ])
    expect(links[0]).toHaveAttribute('href', '/qualite-de-leau')
  })

  it('ne rend aucune zone de navigation quand le menu est vide', async () => {
    withMenu([])

    await renderLayout()

    expect(screen.queryByRole('navigation', {name: 'Menu du site'})).toBeNull()
    expect(screen.getByRole('main')).toHaveTextContent('contenu')
  })

  it('ne rend plus la navigation de demonstration du socle', async () => {
    withMenu([{id: '1', title: "Qualité de l'eau", slug: 'qualite-de-leau'}])

    await renderLayout()

    expect(screen.queryByRole('link', {name: 'Privacy'})).toBeNull()
    expect(screen.queryByRole('link', {name: 'Terms'})).toBeNull()
    expect(screen.queryByRole('link', {name: 'Docs'})).toBeNull()
    expect(screen.queryByRole('link', {name: 'Blog'})).toBeNull()
  })
})
