import {Suspense} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {act, render, waitFor} from '@/__tests__/customRender'
import type {CurrentUserContext} from '@/app/dal/user-dal'
import AuthProvider from '@/components/context/auth-provider'
import {UserPreferencesSync} from '@/components/context/user-preferences-sync'
import {Language, User} from '@/services/types/domain/user-types'

const replaceMock = vi.fn()
const setThemeMock = vi.fn()

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({replace: replaceMock, push: vi.fn()}),
  usePathname: () => '/bureau',
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({locale: 'fr'}),
  useRouter: () => ({replace: replaceMock, push: vi.fn()}),
  usePathname: () => '/bureau',
}))

vi.mock('next-themes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTheme: () => ({theme: 'light', setTheme: setThemeMock}),
}))

const buildUser = (language: Language, theme?: 'light' | 'dark'): User =>
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
    settings: {language, ...(theme ? {theme} : {})},
  }) as User

// La session est une promesse déroulée par `use()` : le rendu suspend, donc il
// faut un act() attendu pour que React reprenne après résolution.
const renderSync = async (language: Language, theme?: 'light' | 'dark') => {
  const userPromise: Promise<CurrentUserContext> = Promise.resolve({
    user: buildUser(language, theme),
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

describe('UserPreferencesSync - locale unique (ADR 008, s43)', () => {
  beforeEach(() => {
    replaceMock.mockClear()
    setThemeMock.mockClear()
  })

  it.each<Language>(['en', 'es', 'fr'])(
    'un compte dont la langue enregistrée est %s ne déclenche aucune navigation',
    async (language) => {
      await renderSync(language)

      await waitFor(() => expect(setThemeMock).not.toHaveBeenCalled())
      expect(replaceMock).not.toHaveBeenCalled()
    }
  )

  it('applique toujours le thème enregistré', async () => {
    await renderSync('en', 'dark')

    await waitFor(() => expect(setThemeMock).toHaveBeenCalledWith('dark'))
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
