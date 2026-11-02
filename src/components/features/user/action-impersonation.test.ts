import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * s48, critère 7 (défense en profondeur) : pendant une session à la place d'un
 * compte, les actions de /account qui changeraient le mot de passe, l'adresse
 * ou la double vérification refusent d'elles-mêmes, en plus du plugin
 * `impersonationGuard()`. Hors imitation, elles atteignent Better Auth.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/headers', () => ({headers: vi.fn(async () => new Headers())}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../messages/fr.json')).default
  return {
    getTranslations:
      async (namespace: string) =>
      (key: string, values?: Record<string, string>) => {
        const template = [
          ...namespace.split('.'),
          ...key.split('.'),
        ].reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          messages
        ) as string
        return Object.entries(values ?? {}).reduce(
          (text, [name, value]) => text.replace(`{${name}}`, value),
          template
        )
      },
  }
})
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/authentication/auth-service', () => ({
  getActingContext: vi.fn(),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {
    api: {
      changePassword: vi.fn(async () => ({token: 't'})),
      changeEmail: vi.fn(async () => ({status: true})),
      enableTwoFactor: vi.fn(async () => ({
        method: 'totp',
        totpURI: 'otpauth://x',
        backupCodes: [],
      })),
      disableTwoFactor: vi.fn(async () => ({status: true})),
      verifyTOTP: vi.fn(async () => ({token: 't'})),
    },
  },
}))
vi.mock('@/services/facades/user-service-facade', () => ({
  updateUserService: vi.fn(),
  updateUserSettingsService: vi.fn(),
}))
vi.mock('@/services/notification-service', () => ({
  createTypedNotificationService: vi.fn(),
}))

import {requireActionAuth} from '@/app/dal/user-dal'
import {auth} from '@/lib/better-auth/auth'
import {getActingContext} from '@/services/authentication/auth-service'

import {
  changeEmailAction,
  changePasswordAction,
  update2FAAction,
  verifyTotpAction,
} from './action'

const viewed = {id: 'compte-vise', name: 'Claire Montel'} as never

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const cases = [
  {
    name: 'changePasswordAction',
    call: () =>
      changePasswordAction(
        undefined,
        form({
          currentPassword: 'Ancien-mot-de-passe-1',
          newPassword: 'Nouveau-mot-de-passe-1',
          confirmPassword: 'Nouveau-mot-de-passe-1',
        })
      ),
    api: () => auth.api.changePassword,
  },
  {
    name: 'changeEmailAction',
    call: () =>
      changeEmailAction(undefined, form({newEmail: 'nouvelle@example.test'})),
    api: () => auth.api.changeEmail,
  },
  {
    name: 'update2FAAction',
    call: () =>
      update2FAAction(
        undefined,
        form({action: 'enable', password: 'Mot-de-passe-1'})
      ),
    api: () => auth.api.enableTwoFactor,
  },
  {
    name: 'verifyTotpAction',
    call: () => verifyTotpAction(undefined, form({code: '123456'})),
    api: () => auth.api.verifyTOTP,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionAuth).mockResolvedValue(viewed)
})

describe('actions sensibles de /account pendant l’imitation (s48)', () => {
  it.each(cases)(
    '$name refuse, sans appeler Better Auth',
    async ({call, api}) => {
      vi.mocked(getActingContext).mockResolvedValue({
        user: viewed,
        impersonator: {id: 'superadmin', name: 'Zoé Support'},
      })

      const result = await call()

      expect(result).toMatchObject({
        success: false,
        message:
          'Indisponible pendant que vous agissez à la place de Claire Montel. Revenez à votre compte pour y accéder.',
      })
      expect(api()).not.toHaveBeenCalled()
    }
  )

  it.each(cases)('$name passe hors imitation', async ({call, api}) => {
    vi.mocked(getActingContext).mockResolvedValue({user: viewed})

    await call()

    expect(api()).toHaveBeenCalledTimes(1)
  })
})
