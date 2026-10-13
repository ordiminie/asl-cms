import {ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  forbidden: vi.fn(),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(async () => ({
    id: '3f5a0a5e-0000-4000-8000-000000000001',
    name: 'Membre Test',
    email: 'membre@example.com',
    role: 'user',
    visibility: 'private',
  })),
}))

import DashboardPage from './page'

/** `withAuth` rend un composant serveur asynchrone : on resout les deux niveaux. */
const renderServerPage = async (element: ReactElement) => {
  const type = element.type as (props: unknown) => Promise<ReactElement>

  return await type(element.props)
}

describe('/dashboard — espace membre (s46, critere 2)', () => {
  it('titre l espace membre, sans phrase sous le titre', async () => {
    render(await renderServerPage(await DashboardPage({})))

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Votre espace membre',
    })
    expect(heading).toBeInTheDocument()
    expect(heading.nextElementSibling?.tagName).not.toBe('P')
  })

  it('propose la sécurité du compte par un lien vers /account', async () => {
    render(await renderServerPage(await DashboardPage({})))

    expect(screen.getByText('Sécurité du compte')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Votre adresse email, votre mot de passe et les appareils connectés à votre compte.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {name: 'Gérer la sécurité du compte'})
    ).toHaveAttribute('href', '/account')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('ne garde rien du tableau de bord hérité', async () => {
    render(await renderServerPage(await DashboardPage({})))

    for (const text of [
      "Vue d'ensemble de votre activité",
      'Espace client',
      'Revenu mensuel',
      'Aperçu',
      'Total Revenue',
      'Subscriptions',
    ]) {
      expect(screen.queryByText(text, {exact: false}), text).toBeNull()
    }
    expect(screen.queryByText('Membre Test')).toBeNull()
  })
})
