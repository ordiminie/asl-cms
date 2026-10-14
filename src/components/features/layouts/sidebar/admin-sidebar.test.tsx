import {describe, expect, it} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import {SidebarProvider} from '@/components/ui/sidebar'

import {AdminSidebar} from './admin-sidebar'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const REMOVED_PATH =
  /^\/(account\/(settings|api-keys|notifications|organizations|invitations|billing)|team)(\/|$)/

const USER = {
  id: '3f5a0a5e-0000-4000-8000-000000000001',
  name: 'Super Admin',
  email: 'superadmin@example.com',
  role: 'super_admin',
  visibility: 'private',
} as never

const renderSidebar = (association?: {name: string}) =>
  render(
    <SidebarProvider>
      <AdminSidebar user={USER} association={association} />
    </SidebarProvider>
  )

const hrefs = () =>
  [...document.querySelectorAll('a[href]')].map(
    (anchor) => anchor.getAttribute('href') ?? ''
  )

describe('barre de /admin — lien vers le back-office de l association (s46, critere 3)', () => {
  it('sur le domaine d une association, ouvre /bureau/pages avec son nom', () => {
    renderSidebar({name: "Les Amis de l'Étang"})

    const entry = screen.getByRole('link', {
      name: "Back-office de l'association Les Amis de l'Étang",
    })
    expect(entry).toHaveAttribute('href', '/bureau/pages')
    expect(entry).toHaveTextContent("Back-office de l'association")
    expect(entry).toHaveTextContent("Les Amis de l'Étang")
    expect(screen.queryByText('Application (front office)')).toBeNull()
    expect(document.querySelector('a[href="/dashboard"]')).toBeNull()
  })

  it('sans association, le groupe n est pas rendu', () => {
    renderSidebar(undefined)

    expect(screen.queryByText(/Back-office de l.association/)).toBeNull()
    expect(screen.queryByText('Application (front office)')).toBeNull()
    expect(document.querySelector('a[href^="/bureau"]')).toBeNull()
  })

  it('aucun lien, menu du compte compris, ne vise une adresse retirée', async () => {
    renderSidebar({name: "Les Amis de l'Étang"})

    await userEvent.click(screen.getByRole('button', {name: /Super Admin/}))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getByRole('link', {name: 'Compte'})).toHaveAttribute(
      'href',
      '/account'
    )
    expect(hrefs().filter((href) => REMOVED_PATH.test(href))).toEqual([])
  })
})
