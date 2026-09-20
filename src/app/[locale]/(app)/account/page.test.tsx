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
vi.mock('@/components/features/user/security-section', () => ({
  UserSecurityFactorSection: () => <div data-testid="security-section" />,
}))

import AccountPage from './page'

/**
 * `withAuth` rend un composant serveur asynchrone : il faut resoudre l'arbre
 * une seconde fois avant de le confier au moteur de rendu de test.
 */
const renderServerPage = async (element: ReactElement) => {
  const type = element.type as (props: unknown) => Promise<ReactElement>

  return await type(element.props)
}

describe('/account', () => {
  it('rend ses sections restantes sans formulaire de profil herite', async () => {
    render(await renderServerPage(await AccountPage({})))

    expect(
      screen.getByRole('heading', {level: 1, name: 'Mon Compte'})
    ).toBeInTheDocument()
    expect(screen.getByText('Sécurité')).toBeInTheDocument()
    expect(screen.getByTestId('security-section')).toBeInTheDocument()
    expect(screen.queryByText('Profil')).toBeNull()
    expect(screen.queryByLabelText('Nom')).toBeNull()
  })
})
