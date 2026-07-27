import {describe, expect, it, vi} from 'vitest'

import {render} from '@/__tests__/customRender'
import AuthProvider from '@/components/context/auth-provider'
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

describe('AuthProvider - bascule de locale du profil', () => {
  it('ne re-préfixe pas un pathname déjà préfixé par la locale', () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/fr/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    render(<AuthProvider initialUser={buildUser('en')}>contenu</AuthProvider>)

    expect(replaceMock).toHaveBeenCalledWith('/dashboard', {locale: 'en'})
  })

  it('laisse intact un pathname non préfixé', () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    render(<AuthProvider initialUser={buildUser('es')}>contenu</AuthProvider>)

    expect(replaceMock).toHaveBeenCalledWith('/dashboard', {locale: 'es'})
  })

  it('ne redirige pas quand la langue du profil est déjà la locale courante', () => {
    replaceMock.mockClear()
    pathnameMock.mockReturnValue('/fr/dashboard')
    paramsMock.mockReturnValue({locale: 'fr'})

    render(<AuthProvider initialUser={buildUser('fr')}>contenu</AuthProvider>)

    expect(replaceMock).not.toHaveBeenCalled()
  })
})
