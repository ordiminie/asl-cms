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
vi.mock('@/app/[locale]/(auth)/action', () => ({
  requestMagicLinkAction: vi.fn(),
}))

import LoginPage from './page'

describe('/login — écran A', () => {
  it('propose la connexion par lien, sans mot de passe', async () => {
    render(await LoginPage({params: Promise.resolve({locale: 'fr'})}))

    expect(
      screen.getByRole('heading', {level: 1, name: 'Se connecter à votre espace'})
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email')).toBeInTheDocument()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(
      screen.getByRole('link', {name: 'Accès prestataire'})
    ).toHaveAttribute('href', '/login/prestataire')
  })
})
