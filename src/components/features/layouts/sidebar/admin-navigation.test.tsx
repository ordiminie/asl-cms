import {SquareTerminal} from 'lucide-react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('@/components/hooks/use-unread-notifications', () => ({
  useUnreadNotifications: () => ({unreadCount: 0}),
}))
vi.mock('@/components/hooks/use-subscription', () => ({
  useSubscription: () => ({isFree: true, loading: false}),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {SidebarProvider} from '@/components/ui/sidebar'

import {AdminSidebar} from './admin-sidebar'
import {NavAdmin} from './nav-admin'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Navigation de /admin — le blog hérité est retiré (s45)', () => {
  it('le menu de l’administration ne cite plus « Blog », garde plans et abonnements', () => {
    render(
      <SidebarProvider>
        <AdminSidebar />
      </SidebarProvider>
    )

    expect(screen.getByRole('link', {name: 'Plans'})).toHaveAttribute(
      'href',
      '/admin/plans'
    )
    expect(screen.getByRole('link', {name: 'Abonnements'})).toHaveAttribute(
      'href',
      '/admin/subscriptions'
    )
    expect(screen.queryByRole('link', {name: 'Blog'})).toBeNull()
    expect(document.querySelector('a[href^="/admin/blog"]')).toBeNull()
  })

  it('le raccourci d’administration de l’application ne mène plus au blog', async () => {
    render(
      <SidebarProvider>
        <NavAdmin
          adminItems={[
            {title: 'Administration', url: '/admin', icon: SquareTerminal},
          ]}
        />
      </SidebarProvider>
    )

    await userEvent.click(screen.getByRole('button', {name: 'More'}))
    await screen.findByRole('menu')

    expect(screen.getByRole('menuitem', {name: 'Plans'})).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', {name: 'Blog'})).toBeNull()
  })
})
