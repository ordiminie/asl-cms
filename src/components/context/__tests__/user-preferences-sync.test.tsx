import {Suspense} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {act, render, waitFor} from '@/__tests__/customRender'
import type {CurrentUserContext} from '@/app/dal/user-dal'
import AuthProvider from '@/components/context/auth-provider'
import {UserPreferencesSync} from '@/components/context/user-preferences-sync'
import {Language, User} from '@/services/types/domain/user-types'

const replaceMock = vi.fn()
const pathnameMock = vi.fn<() => string>()
const paramsMock = vi.fn<() => Record<string, string>>()

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({replace: replaceMock, push: vi.fn()}),
  usePathname: () => pathnameMock(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => paramsMock(),
}))

const buildUser = (language: Language): User =>
  ({
    id: 'ae760f8e-4aa6-4d71-a4c8-344429b7ae21',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    role: 'user',
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
    banned: null,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    stripeCustomerId: null,
    settings: {language},
  }) as User

// La session est une promesse déroulée par `use()` : le rendu suspend, donc il
// faut un act() attendu pour que React reprenne après résolution.
const renderSync = async (language: Language) => {
  const userPromise: Promise<CurrentUserContext> = Promise.resolve({
    user: buildUser(language),
    activeOrganization: null,
  })

  await act(async () => {
    render(
      <AuthProvider userPromise={userPromise}>
        <Suspense fallback={null}>
          <UserPreferencesSync />
        </Suspense>
      </AuthProvider>
    )
  })
}

describe('UserPreferencesSync - bascule de locale du profil', () => {
  it('ne re-préfixe pas un pathname déjà préfixé par la locale', async () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/fr/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    await renderSync('en')

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/dashboard', {locale: 'en'})
    )
  })

  it('laisse intact un pathname non préfixé', async () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    await renderSync('es')

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/dashboard', {locale: 'es'})
    )
  })

  it('ne redirige pas quand la langue du profil est déjà la locale courante', async () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/fr/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    await renderSync('fr')

    await waitFor(() => expect(replaceMock).not.toHaveBeenCalled())
  })
})
