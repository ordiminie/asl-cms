import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Clos-Fleuri',
    slug: 'clos-fleuri',
    domain: 'clos-fleuri.test',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })),
}))
vi.mock('@/app/dal/association-identity-dal', () => ({
  canManageCurrentAssociationIdentityDal: vi.fn(),
}))
vi.mock('@/app/dal/member-space-dal', () => ({
  isPlainMemberOfCurrentAssociationDal: vi.fn(),
}))
vi.mock('@/components/features/association/bureau-sidebar', () => ({
  BureauSidebar: () => <nav aria-label="Menu du bureau" />,
}))
vi.mock('@/components/features/association/bureau-menu-button', () => ({
  BureauMenuButton: () => null,
}))
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({children}: {children: React.ReactNode}) => children,
  SidebarInset: ({children}: {children: React.ReactNode}) => children,
}))

import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {isPlainMemberOfCurrentAssociationDal} from '@/app/dal/member-space-dal'

import BureauLayout from './layout'

/** Le layout rend un `<Suspense>` autour d'une coquille asynchrone. */
const renderLayout = async () => {
  const suspense = BureauLayout({
    children: <p>Fiche de Paul Vidal</p>,
  }) as ReactElement<{children: ReactElement}>
  const shell = suspense.props.children
  const type = shell.type as (props: unknown) => Promise<ReactElement>
  render(await type(shell.props))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('(bureau) — refus selon le compte (s12d, C4)', () => {
  it('montre au propriétaire l’écran C4, qui le renvoie à son espace', async () => {
    vi.mocked(canManageCurrentAssociationIdentityDal).mockResolvedValue(false)
    vi.mocked(isPlainMemberOfCurrentAssociationDal).mockResolvedValue(true)

    await renderLayout()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Cette page ne vous est pas accessible',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Elle est réservée au bureau de l’association.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Revenir à mon espace'})
    ).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByText('Fiche de Paul Vidal')).toBeNull()
    expect(screen.queryByText('Espace personnel')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('garde l’écran de refus actuel pour tout autre compte', async () => {
    vi.mocked(canManageCurrentAssociationIdentityDal).mockResolvedValue(false)
    vi.mocked(isPlainMemberOfCurrentAssociationDal).mockResolvedValue(false)

    await renderLayout()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "Cette page est réservée au bureau de l'association",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText('Revenir à mon espace')).toBeNull()
    expect(screen.queryByText('Fiche de Paul Vidal')).toBeNull()
  })

  it('ouvre le back-office au bureau', async () => {
    vi.mocked(canManageCurrentAssociationIdentityDal).mockResolvedValue(true)
    vi.mocked(isPlainMemberOfCurrentAssociationDal).mockResolvedValue(false)

    await renderLayout()

    expect(screen.getByText('Fiche de Paul Vidal')).toBeInTheDocument()
    expect(
      screen.queryByText('Cette page ne vous est pas accessible')
    ).toBeNull()
  })
})
