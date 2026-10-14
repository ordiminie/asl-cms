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

describe('/account — sécurité du compte (s46, critere 1)', () => {
  it('titre unique « Sécurité du compte », avec son chapeau', async () => {
    render(await renderServerPage(await AccountPage({})))

    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1)
    expect(
      screen.getByRole('heading', {level: 1, name: 'Sécurité du compte'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Votre adresse email, votre mot de passe et les appareils connectés à votre compte.'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('security-section')).toBeInTheDocument()
  })

  it('ramène à l espace membre', async () => {
    render(await renderServerPage(await AccountPage({})))

    expect(
      screen.getByRole('link', {name: 'Revenir à mon espace'})
    ).toHaveAttribute('href', '/dashboard')
  })

  it('ne garde ni « Mon Compte », ni le sous-titre « Sécurité », ni profil', async () => {
    render(await renderServerPage(await AccountPage({})))

    expect(screen.queryByText('Mon Compte')).toBeNull()
    expect(screen.queryByRole('heading', {level: 2})).toBeNull()
    expect(screen.queryByText(/authentification/i)).toBeNull()
    expect(screen.queryByText('Profil')).toBeNull()
    expect(screen.queryByLabelText('Nom')).toBeNull()
  })
})
