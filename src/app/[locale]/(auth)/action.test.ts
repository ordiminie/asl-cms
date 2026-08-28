import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/dist/client/components/redirect-error', () => ({
  isRedirectError: vi.fn(() => false),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('next/navigation', () => ({redirect: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `registerMagicLink.${key}`)
  ),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {
    api: {
      signInMagicLink: vi.fn(),
    },
  },
  AuthAppConfig: {requireEmailVerification: true},
}))
vi.mock('@/services/facades/user-service-facade', () => ({
  getUserByEmailService: vi.fn(),
  isEmailAvailableService: vi.fn(),
}))

import {headers} from 'next/headers'
import {redirect} from 'next/navigation'

import {auth} from '@/lib/better-auth/auth'
import {isEmailAvailableService} from '@/services/facades/user-service-facade'

import {registerMagicLinkAction} from './action'

const email = 'new-user@example.test'

function registrationFormData() {
  const formData = new FormData()
  formData.set('email', email)
  return formData
}

describe('registerMagicLinkAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockResolvedValue(new Headers() as never)
    vi.mocked(isEmailAvailableService).mockResolvedValue(true)
    vi.mocked(auth.api.signInMagicLink).mockResolvedValue({status: true})
  })

  it('demande le lien puis redirige vers la confirmation', async () => {
    await registerMagicLinkAction({success: false}, registrationFormData())

    expect(auth.api.signInMagicLink).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {email, callbackURL: '/dashboard'},
    })
    expect(redirect).toHaveBeenCalledWith('/verify-request')
  })

  it('rend l’erreur d’envoi localisée quand Better Auth rejette', async () => {
    vi.mocked(auth.api.signInMagicLink).mockRejectedValue(
      new Error('provider refused')
    )

    const result = await registerMagicLinkAction(
      {success: false},
      registrationFormData()
    )

    expect(result).toEqual({
      success: false,
      message: 'registerMagicLink.sendError',
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})
