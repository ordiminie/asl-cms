import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionAuth: vi.fn(),
}))
vi.mock('@/components/features/auth/forms/logout-form', () => ({
  default: () => null,
}))

import {redirect} from 'next/navigation'

import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'

import LogoutPage from './page'

const openLogout = () => LogoutPage({params: Promise.resolve({locale: 'fr'})})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(undefined)
  vi.mocked(getSessionAuth).mockResolvedValue(null as never)
})

describe('/logout', () => {
  it('propose la déconnexion à une session ouverte', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({id: 'user-1'} as never)
    vi.mocked(getSessionAuth).mockResolvedValue({
      session: {userId: 'user-1'},
    } as never)

    await expect(openLogout()).resolves.toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renvoie à la connexion sans session', async () => {
    await expect(openLogout()).rejects.toThrow('NEXT_REDIRECT /login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('termine une session dont l’accès est fermé (s12d, ADR 038)', async () => {
    vi.mocked(getSessionAuth).mockResolvedValue({
      session: {userId: 'user-1'},
    } as never)

    await expect(openLogout()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login/acces-ferme')
  })
})
