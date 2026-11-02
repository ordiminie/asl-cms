import {describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}))
vi.mock('next/navigation', () => ({redirect: vi.fn()}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(async () => undefined),
}))
vi.mock('@/components/features/auth/forms/login', () => ({
  LoginForm: () => <form aria-label="Connexion prestataire" />,
}))

import ProviderLoginPage from './page'

const renderPage = async (searchParams: {session?: string} = {}) =>
  render(
    await ProviderLoginPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(searchParams),
    })
  )

describe('/login/prestataire — fin d’une session à la place d’un compte (s48, 4c)', () => {
  it('affiche l’alerte d’expiration au-dessus du formulaire', async () => {
    await renderPage({session: 'terminee'})

    expect(screen.getByRole('status')).toHaveTextContent(
      'La session à la place d’un compte s’est terminée.'
    )
    expect(
      screen.getByRole('form', {name: 'Connexion prestataire'})
    ).toBeInTheDocument()
  })

  it('sans paramètre : le formulaire seul', async () => {
    await renderPage()

    expect(screen.queryByRole('status')).toBeNull()
  })
})
