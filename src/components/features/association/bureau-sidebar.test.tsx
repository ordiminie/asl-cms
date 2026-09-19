import {describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({pathname: '/fr/bureau/identite'}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

import {render, screen} from '@/__tests__/customRender'
import {SidebarProvider} from '@/components/ui/sidebar'

import {BureauSidebar} from './bureau-sidebar'

const renderSidebarAt = (pathname: string) => {
  navigation.pathname = pathname
  render(
    <SidebarProvider>
      <BureauSidebar associationName="ASL Les Pins" />
    </SidebarProvider>
  )
}

describe('BureauSidebar — item actif selon la route', () => {
  it('porte les deux items du groupe « L association »', () => {
    renderSidebarAt('/fr/bureau/identite')

    expect(screen.getByRole('link', {name: 'Identité'})).toHaveAttribute(
      'href',
      '/bureau/identite'
    )
    expect(screen.getByRole('link', {name: 'Réglages'})).toHaveAttribute(
      'href',
      '/bureau/reglages'
    )
  })

  it('sur la page Identite, seul « Identite » est actif', () => {
    renderSidebarAt('/fr/bureau/identite')

    expect(screen.getByRole('link', {name: 'Identité'})).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', {name: 'Réglages'})).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('sur la page Reglages, seul « Reglages » est actif', () => {
    renderSidebarAt('/bureau/reglages')

    expect(screen.getByRole('link', {name: 'Réglages'})).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', {name: 'Identité'})).not.toHaveAttribute(
      'aria-current'
    )
  })
})
