import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/components/hooks/use-unread-notifications', () => ({
  useUnreadNotifications: () => ({unreadCount: 0}),
}))
vi.mock('@/components/hooks/use-subscription', () => ({
  useSubscription: () => ({isFree: true, loading: false}),
}))

import {render, screen, userEvent} from '@/__tests__/customRender'
import {SidebarProvider} from '@/components/ui/sidebar'
import {User} from '@/services/types/domain/user-types'

import {NavUser} from './nav-user'
import {NavUserAdmin} from './nav-user-admin'

const user = {
  id: 'user-1',
  name: 'Julien',
  email: 'julien@example.test',
} as User

const openMenu = async () => {
  await userEvent.click(screen.getByText('Julien'))
  await screen.findByRole('menu')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Menus utilisateur — clair seul (ADR 033)', () => {
  it('le menu de l’application ne propose aucune bascule de thème', async () => {
    render(
      <SidebarProvider>
        <NavUser user={user} />
      </SidebarProvider>
    )

    await openMenu()

    expect(screen.queryByRole('menuitem', {name: /mode sombre/i})).toBeNull()
    expect(screen.queryByRole('menuitem', {name: /mode clair/i})).toBeNull()
  })

  it('le menu de l’administration ne propose aucune bascule de thème', async () => {
    render(
      <SidebarProvider>
        <NavUserAdmin user={user} />
      </SidebarProvider>
    )

    await openMenu()

    expect(screen.queryByRole('menuitem', {name: /mode sombre/i})).toBeNull()
    expect(screen.queryByRole('menuitem', {name: /mode clair/i})).toBeNull()
  })
})
