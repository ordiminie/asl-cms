import {describe, expect, it, vi} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'

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

const renderLogin = async (searchParams: {acces?: string} = {}) =>
  render(
    await LoginPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(searchParams),
    })
  )

describe('/login — écran A', () => {
  it('propose la connexion par lien, sans mot de passe', async () => {
    await renderLogin()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Se connecter à votre espace',
      })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email')).toBeInTheDocument()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(
      screen.getByRole('link', {name: 'Accès prestataire'})
    ).toHaveAttribute('href', '/login/prestataire')
  })
})

describe('/login — écran D, accès fermé (s12d)', () => {
  it('affiche l’encadré neutre après une fermeture d’accès', async () => {
    await renderLogin({acces: 'ferme'})

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Votre accès à l’espace membre est fermé.')
    expect(notice).toHaveTextContent('Pour le rouvrir, écrivez au bureau.')
    expect(
      within(notice).getByRole('link', {name: 'Page Contact'})
    ).toHaveAttribute('href', '/contact')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Se connecter à votre espace',
      })
    ).toBeInTheDocument()
  })

  it.each([{}, {acces: 'autre'}])(
    'n’affiche aucun encadré sans le paramètre (%o)',
    async (searchParams) => {
      await renderLogin(searchParams)

      expect(screen.queryByRole('status')).toBeNull()
      expect(
        screen.queryByText('Votre accès à l’espace membre est fermé.')
      ).toBeNull()
    }
  )
})
