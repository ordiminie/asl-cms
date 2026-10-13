import {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: "Les Amis de l'Étang",
    slug: 'amis-etang',
    domain: 'lesamisdeletang.fr',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })),
}))
vi.mock('@/app/[locale]/(auth)/action', () => ({logoutAction: vi.fn()}))

import AppLayout from './layout'

const renderLayout = async () =>
  render(
    (await AppLayout({
      children: <p>Contenu de la page</p>,
    })) as ReactElement
  )

describe('(app) — coquille de l espace membre (s46, design system §3.12)', () => {
  it('ouvre sur un lien d evitement vers le contenu principal', async () => {
    await renderLayout()

    const skip = screen.getByRole('link', {name: 'Aller au contenu'})
    expect(skip).toHaveAttribute('href', '#contenu')
    expect(document.querySelector('a')).toBe(skip)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu')
    expect(screen.getByRole('main')).toHaveTextContent('Contenu de la page')
  })

  it('porte le nom de l association, lien vers l accueil, et « Se déconnecter »', async () => {
    await renderLayout()

    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent("Les Amis de l'Étang")
    expect(
      screen.getByRole('link', {name: /Les Amis de l'Étang/})
    ).toHaveAttribute('href', '/')
    expect(
      screen.getByRole('button', {name: 'Se déconnecter'})
    ).toBeInTheDocument()
  })

  it('ne monte aucune barre latérale ni menu hérité', async () => {
    await renderLayout()

    expect(document.querySelector('[data-sidebar]')).toBeNull()
    expect(document.querySelector('[data-slot="sidebar-wrapper"]')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByText(/retour d.expérience|feedback/i)).toBeNull()
  })
})
