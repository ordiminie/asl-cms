import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
  setRequestLocale: vi.fn(),
}))

// Seules les metadonnees exportees sont lues : l'habillage des layouts
// (barres laterales, fournisseurs, DAL) est double pour que l'import reste
// leger, sans quoi il depasse le delai sur un poste charge.
const {component, named} = vi.hoisted(() => ({
  component: () => ({default: () => null}),
  named: (...names: string[]) =>
    Object.fromEntries(names.map((name) => [name, () => null])),
}))
vi.mock('@/components/features/auth/with-auth', () => ({
  withAuthAdmin: (layout: unknown) => layout,
}))
vi.mock('@/app/dal/user-dal', () => named('getCurrentUserDal'))
vi.mock('@/app/dal/tenant-dal', () => named('requireCurrentTenantDal'))
vi.mock('@/app/dal/association-identity-dal', () =>
  named('canManageCurrentAssociationIdentityDal')
)
vi.mock('@/components/context/auth-provider', component)
vi.mock('@/components/context/organization-provider', () =>
  named('OrganizationProvider')
)
vi.mock('@/components/context/organization-sync', () =>
  named('OrganizationSync')
)
vi.mock('@/components/context/user-preferences-sync', () =>
  named('UserPreferencesSync')
)
vi.mock('@/components/features/app-breadcrumb', () => named('AppBreadcrumb'))
vi.mock('@/components/features/layouts/sidebar/app-sidebar', () =>
  named('AppSidebar')
)
vi.mock('@/components/features/layouts/sidebar/admin-sidebar', () =>
  named('AdminSidebar')
)
vi.mock('@/components/features/layouts/sidebar/sidebar-skeleton', () =>
  named('SidebarSkeleton')
)
vi.mock('@/components/features/quick-feedback-button', () =>
  named('QuickFeedbackButton')
)
vi.mock('@/components/features/association/association-mark', () =>
  named('AssociationMark')
)
vi.mock('@/components/features/association/bureau-access-denied', () =>
  named('BureauAccessDenied')
)
vi.mock('@/components/features/association/bureau-menu-button', () =>
  named('BureauMenuButton')
)
vi.mock('@/components/features/association/bureau-sidebar', () =>
  named('BureauSidebar')
)
vi.mock('@/components/ui/sidebar', () =>
  named('SidebarInset', 'SidebarProvider', 'SidebarTrigger')
)

/**
 * Critere 3, seconde protection (decision D) : toute route creee **sous** un
 * layout authentifie est `noindex` par construction, quel que soit son
 * segment — robots.txt ne couvre que les prefixes declares au proxy.
 */
describe('layouts authentifies : noindex, nofollow (s11)', () => {
  const NOINDEX = {index: false, follow: false}

  it('(app) — espace utilisateur', async () => {
    const {metadata} = await import('./(app)/layout')
    expect(metadata.robots).toEqual(NOINDEX)
  })

  it('(bureau) — back-office de l association', async () => {
    const {metadata} = await import('./(bureau)/layout')
    expect(metadata.robots).toEqual(NOINDEX)
  })

  it('admin — espace SuperAdmin', async () => {
    const {metadata} = await import('./admin/layout')
    expect(metadata.robots).toEqual(NOINDEX)
  })

  it('(auth) — ecrans de connexion', async () => {
    const {generateMetadata} = await import('./(auth)/layout')
    const metadata = await generateMetadata({
      params: Promise.resolve({locale: 'fr'}),
    })
    expect(metadata.robots).toEqual(NOINDEX)
  })
})
