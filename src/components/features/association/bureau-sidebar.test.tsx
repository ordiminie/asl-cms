import {describe, expect, it, vi} from 'vitest'

const navigation = vi.hoisted(() => ({pathname: '/bureau/identite'}))

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
    renderSidebarAt('/bureau/identite')

    expect(screen.getByRole('link', {name: 'Identité'})).toHaveAttribute(
      'href',
      '/bureau/identite'
    )
    expect(screen.getByRole('link', {name: 'Réglages'})).toHaveAttribute(
      'href',
      '/bureau/reglages'
    )
  })

  it('porte les deux items du groupe « Le site »', () => {
    renderSidebarAt('/bureau/pages')

    expect(screen.getByRole('link', {name: 'Pages'})).toHaveAttribute(
      'href',
      '/bureau/pages'
    )
    expect(screen.getByRole('link', {name: 'Navigation'})).toHaveAttribute(
      'href',
      '/bureau/navigation'
    )
  })

  it('sur la page Navigation, seul « Navigation » est actif', () => {
    renderSidebarAt('/bureau/navigation')

    expect(screen.getByRole('link', {name: 'Navigation'})).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', {name: 'Pages'})).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('sur la page Identite, seul « Identite » est actif', () => {
    renderSidebarAt('/bureau/identite')

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

  it('place « Bandeau d’alerte » en dernier du groupe « Le site »', () => {
    renderSidebarAt('/bureau/pages')

    const link = screen.getByRole('link', {name: 'Bandeau d’alerte'})
    expect(link).toHaveAttribute('href', '/bureau/alerte')
    expect(link.querySelector('svg.lucide-triangle-alert')).not.toBeNull()

    const siteGroup = link.closest('[data-sidebar="group"]')
    const labels = Array.from(siteGroup?.querySelectorAll('a') ?? []).map(
      (anchor) => anchor.textContent
    )
    expect(labels.at(-1)).toBe('Bandeau d’alerte')
    expect(labels).toContain('Navigation')
  })

  it('sur la page Bandeau d’alerte, seul cet item est actif', () => {
    renderSidebarAt('/bureau/alerte')

    expect(
      screen.getByRole('link', {name: 'Bandeau d’alerte'})
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Navigation'})).not.toHaveAttribute(
      'aria-current'
    )
  })
})

describe('BureauSidebar — « Messages reçus » (s08)', () => {
  it('ajoute l’entrée au groupe « Le site », après Navigation, sans icône', () => {
    renderSidebarAt('/bureau/messages')

    const messages = screen.getByRole('link', {name: 'Messages reçus'})
    expect(messages).toHaveAttribute('href', '/bureau/messages')
    expect(messages).toHaveAttribute('aria-current', 'page')
    expect(messages.querySelector('svg')).toBeNull()

    const siteLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(siteLinks.indexOf('/bureau/messages')).toBe(
      siteLinks.indexOf('/bureau/navigation') + 1
    )
  })
})

describe("BureauSidebar — « Analyses d'eau » (s09)", () => {
  it('ajoute l’entrée entre « Actualités » et « Navigation », sans icône', () => {
    renderSidebarAt('/bureau/analyses-eau')

    const entry = screen.getByRole('link', {name: "Analyses d'eau"})
    expect(entry).toHaveAttribute('href', '/bureau/analyses-eau')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const siteLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    const position = siteLinks.indexOf('/bureau/analyses-eau')
    expect(siteLinks[position - 1]).toBe('/bureau/actualites')
    expect(siteLinks[position + 1]).toBe('/bureau/navigation')
  })
})

describe('BureauSidebar — « Signalements » (s10)', () => {
  it('ajoute l’entrée au groupe « Le site », après « Messages reçus », sans icône', () => {
    renderSidebarAt('/bureau/signalements')

    const entry = screen.getByRole('link', {name: 'Signalements'})
    expect(entry).toHaveAttribute('href', '/bureau/signalements')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const siteLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(siteLinks.indexOf('/bureau/signalements')).toBe(
      siteLinks.indexOf('/bureau/messages') + 1
    )
  })
})

describe('BureauSidebar — « Propriétaires » (s12)', () => {
  it('ajoute l’entrée en tête du groupe « L’association », avant Identité, sans icône', () => {
    renderSidebarAt('/bureau/proprietaires')

    const entry = screen.getByRole('link', {name: 'Propriétaires'})
    expect(entry).toHaveAttribute('href', '/bureau/proprietaires')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const group = entry.closest('[data-sidebar="group"]')
    const labels = Array.from(group?.querySelectorAll('a') ?? []).map(
      (anchor) => anchor.textContent
    )
    expect(labels).toEqual([
      'Propriétaires',
      'Questions des membres',
      'Documents',
      'Documents nominatifs',
      'Modèles de documents',
      'Groupes',
      'Campagnes',
      'Relances',
      'Invitations',
      'Envois',
      'Identité',
      'Réglages',
    ])
  })
})

describe('BureauSidebar — « Propriétaires » sur ses sous-routes (s56)', () => {
  it.each([
    '/bureau/proprietaires/mise-a-jour',
    '/bureau/proprietaires/nouveau',
    '/bureau/proprietaires/33333333-3333-4333-8333-333333333333',
  ])('reste actif sur %s', (pathname) => {
    renderSidebarAt(pathname)

    expect(screen.getByRole('link', {name: 'Propriétaires'})).toHaveAttribute(
      'aria-current',
      'page'
    )
  })
})

describe('BureauSidebar — « Campagnes » (s25)', () => {
  it('ajoute l’entrée au groupe « L’association », après « Propriétaires », sans icône', () => {
    renderSidebarAt('/bureau/campagnes')

    const entry = screen.getByRole('link', {name: 'Campagnes'})
    expect(entry).toHaveAttribute('href', '/bureau/campagnes')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()
    expect(
      screen.getByRole('link', {name: 'Propriétaires'})
    ).not.toHaveAttribute('aria-current')
  })

  it.each(['/bureau/campagnes/nouvelle', '/bureau/campagnes/3c1e'])(
    'reste actif sur %s',
    (pathname) => {
      renderSidebarAt(pathname)

      expect(screen.getByRole('link', {name: 'Campagnes'})).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  )
})

describe('BureauSidebar — « Page d’accueil » (s44)', () => {
  it('ajoute l’entrée au groupe « Le site », entre « Pages » et « Actualités », sans icône', () => {
    renderSidebarAt('/bureau/pages')

    const entry = screen.getByRole('link', {name: 'Page d’accueil'})
    expect(entry).toHaveAttribute('href', '/bureau/page-accueil')
    expect(entry.querySelector('svg')).toBeNull()

    const siteLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    const position = siteLinks.indexOf('/bureau/page-accueil')
    expect(siteLinks[position - 1]).toBe('/bureau/pages')
    expect(siteLinks[position + 1]).toBe('/bureau/actualites')
  })

  it('sur l’écran « Page d’accueil », seul cet item est actif', () => {
    renderSidebarAt('/bureau/page-accueil')

    expect(screen.getByRole('link', {name: 'Page d’accueil'})).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('link', {name: 'Pages'})).not.toHaveAttribute(
      'aria-current'
    )
  })
})

describe('BureauSidebar — entrée « Envois » (s52)', () => {
  it('suit « Invitations » (s42b) dans le groupe « L’association », active sur sa route', () => {
    renderSidebarAt('/bureau/envois')

    const sends = screen.getByRole('link', {name: 'Envois'})
    expect(sends).toHaveAttribute('href', '/bureau/envois')
    expect(sends).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Campagnes'})).not.toHaveAttribute(
      'aria-current'
    )

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/envois')).toBe(
      links.indexOf('/bureau/invitations') + 1
    )
  })
})

describe('BureauSidebar — « Questions des membres » (s23)', () => {
  it('ajoute l’entrée au groupe « L’association », après « Propriétaires », sans icône', () => {
    renderSidebarAt('/bureau/questions')

    const entry = screen.getByRole('link', {name: 'Questions des membres'})
    expect(entry).toHaveAttribute('href', '/bureau/questions')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/questions')).toBe(
      links.indexOf('/bureau/proprietaires') + 1
    )
  })

  it.each(['/bureau/questions/sujets', '/bureau/questions/3c1e'])(
    'reste actif sur %s',
    (pathname) => {
      renderSidebarAt(pathname)

      expect(
        screen.getByRole('link', {name: 'Questions des membres'})
      ).toHaveAttribute('aria-current', 'page')
    }
  )
})

describe('BureauSidebar — « Groupes » (s27, gap 3)', () => {
  it('ajoute l’entrée au groupe « L’association », juste avant « Campagnes », sans icône', () => {
    renderSidebarAt('/bureau/groupes')

    const entry = screen.getByRole('link', {name: 'Groupes'})
    expect(entry).toHaveAttribute('href', '/bureau/groupes')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/campagnes')).toBe(
      links.indexOf('/bureau/groupes') + 1
    )
  })

  it('reste actif sur un groupe ouvert', () => {
    renderSidebarAt('/bureau/groupes/3c1e')

    expect(screen.getByRole('link', {name: 'Groupes'})).toHaveAttribute(
      'aria-current',
      'page'
    )
  })
})

describe('BureauSidebar — « Documents » (s31)', () => {
  it('ajoute l’entrée au groupe « L’association », après « Questions des membres », sans icône', () => {
    renderSidebarAt('/bureau/documents')

    const entry = screen.getByRole('link', {name: 'Documents'})
    expect(entry).toHaveAttribute('href', '/bureau/documents')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/documents')).toBe(
      links.indexOf('/bureau/questions') + 1
    )
  })

  it.each(['/bureau/documents/nouveau', '/bureau/documents/categories'])(
    'reste actif sur %s',
    (pathname) => {
      renderSidebarAt(pathname)

      expect(screen.getByRole('link', {name: 'Documents'})).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  )
})

describe('BureauSidebar — entrée « Relances » (s29)', () => {
  it('suit « Campagnes » dans le groupe « L’association », active sur sa route', () => {
    renderSidebarAt('/bureau/relances')

    const entry = screen.getByRole('link', {name: 'Relances'})
    expect(entry).toHaveAttribute('href', '/bureau/relances')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Campagnes'})).not.toHaveAttribute(
      'aria-current'
    )
    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/relances')).toBe(
      links.indexOf('/bureau/campagnes') + 1
    )
  })
})

describe('BureauSidebar — entrée « Invitations » (s42b)', () => {
  it('suit « Relances » et précède « Envois », active sur sa route, sans icône', () => {
    renderSidebarAt('/bureau/invitations')

    const entry = screen.getByRole('link', {name: 'Invitations'})
    expect(entry).toHaveAttribute('href', '/bureau/invitations')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()
    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/invitations')).toBe(
      links.indexOf('/bureau/relances') + 1
    )
    expect(links.indexOf('/bureau/envois')).toBe(
      links.indexOf('/bureau/invitations') + 1
    )
  })
})

describe('BureauSidebar — « Documents nominatifs » (s32)', () => {
  it('suit « Documents » dans le groupe « L’association », sans icône, active sur sa route', () => {
    renderSidebarAt('/bureau/documents-nominatifs')

    const entry = screen.getByRole('link', {name: 'Documents nominatifs'})
    expect(entry).toHaveAttribute('href', '/bureau/documents-nominatifs')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()
    expect(screen.getByRole('link', {name: 'Documents'})).not.toHaveAttribute(
      'aria-current'
    )

    const links = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(links.indexOf('/bureau/documents-nominatifs')).toBe(
      links.indexOf('/bureau/documents') + 1
    )
  })

  it.each([
    '/bureau/documents-nominatifs/lot',
    '/bureau/documents-nominatifs/categories',
  ])('reste active sur %s', (pathname) => {
    renderSidebarAt(pathname)

    expect(
      screen.getByRole('link', {name: 'Documents nominatifs'})
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', {name: 'Documents'})).not.toHaveAttribute(
      'aria-current'
    )
  })
})

describe('BureauSidebar — « Modèles de documents » (s36)', () => {
  it('suit « Documents nominatifs » dans le groupe « L’association », sans icône', () => {
    renderSidebarAt('/bureau/modeles-documents')

    const entry = screen.getByRole('link', {name: 'Modèles de documents'})
    expect(entry).toHaveAttribute('href', '/bureau/modeles-documents')
    expect(entry).toHaveAttribute('aria-current', 'page')
    expect(entry.querySelector('svg')).toBeNull()

    const group = entry.closest('[data-sidebar="group"]')
    const labels = Array.from(group?.querySelectorAll('a') ?? []).map(
      (anchor) => anchor.textContent
    )
    expect(labels.indexOf('Modèles de documents')).toBe(
      labels.indexOf('Documents nominatifs') + 1
    )
  })

  it.each([
    '/bureau/modeles-documents/nouveau',
    '/bureau/modeles-documents/lot',
    '/bureau/modeles-documents/3c1e',
  ])('reste actif sur %s', (pathname) => {
    renderSidebarAt(pathname)

    expect(
      screen.getByRole('link', {name: 'Modèles de documents'})
    ).toHaveAttribute('aria-current', 'page')
  })
})
