import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {render} from '@/__tests__/customRender'

import {Sidebar, SidebarProvider} from './sidebar'

/**
 * ADR 027 : la colonne desktop de la barre laterale est **dans le flux**
 * (`sticky`), pour que le bandeau d'alerte pose en tete de `<body>` la pousse
 * vers le bas au lieu d'etre recouvert par elle.
 */
const renderDesktopSidebar = (defaultOpen = true) => {
  const {container} = render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar>
        <p>Contenu</p>
      </Sidebar>
    </SidebarProvider>
  )
  const outer = container.querySelector('[data-slot="sidebar"]')
  if (!outer) throw new Error('barre laterale absente')
  return outer
}

describe('Sidebar — colonne desktop dans le flux (ADR 027)', () => {
  it('s epingle en haut du viewport au lieu d etre fixee', () => {
    const outer = renderDesktopSidebar()
    const column = outer.firstElementChild

    expect(column).toHaveClass('sticky', 'top-0', 'h-svh')
    expect(column?.className).not.toMatch(/\bfixed\b|inset-y-0/)
  })

  it('porte sa largeur elle-meme : plus de bloc d espacement', () => {
    const outer = renderDesktopSidebar()

    expect(outer.children).toHaveLength(1)
    expect(outer.firstElementChild).toHaveClass('w-(--sidebar-width)')
  })

  it('se replie hors ecran par une marge negative', () => {
    const outer = renderDesktopSidebar(false)

    expect(outer).toHaveAttribute('data-collapsible', 'offcanvas')
    expect(outer.firstElementChild?.className).toContain(
      'group-data-[collapsible=offcanvas]:-ml-(--sidebar-width)'
    )
  })
})

describe('docs/layout — aucun ancetre ne neutralise sticky', () => {
  it('coupe le debordement horizontal sans creer de defilement', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../../app/[locale]/docs/layout.tsx'),
      'utf8'
    )

    expect(source).not.toContain('overflow-x-hidden')
    expect(source.match(/overflow-x-clip/g)).toHaveLength(2)
  })
})
