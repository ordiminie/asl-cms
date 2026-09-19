import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/dist/client/components/redirect-error', () => ({
  isRedirectError: vi.fn(() => false),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('next/navigation', () => ({redirect: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn((namespace: string) =>
    Promise.resolve((key: string) =>
      namespace === 'AuthActions.registerMagicLink'
        ? `registerMagicLink.${key}`
        : `${namespace}.${key}`
    )
  ),
}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
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
import {MAGIC_LINK_REQUEST_MIN_DURATION_MS} from '@/lib/better-auth/magic-link-constants'
import {EmailTransportError} from '@/lib/emails/transport'
import {isEmailAvailableService} from '@/services/facades/user-service-facade'

import {registerMagicLinkAction, requestMagicLinkAction} from './action'

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

describe('requestMagicLinkAction', () => {
  const requestFormData = (address: string) => {
    const formData = new FormData()
    formData.set('email', address)
    return formData
  }

  const settle = async <T>(promise: Promise<T>) => {
    let settled = false
    const tracked = promise.then((value) => {
      settled = true
      return value
    })
    return {tracked, isSettled: () => settled}
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(headers).mockResolvedValue(new Headers() as never)
    vi.mocked(auth.api.signInMagicLink).mockResolvedValue({status: true})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('demande le lien à Better Auth avec les URL de rappel des écrans', async () => {
    const pending = requestMagicLinkAction(
      {status: 'idle'},
      requestFormData(' Membre@Exemple.test ')
    )
    await vi.runAllTimersAsync()
    await pending

    expect(auth.api.signInMagicLink).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        email: 'membre@exemple.test',
        callbackURL: '/dashboard',
        errorCallbackURL: '/login/lien-invalide',
      },
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rend le même résultat, adresse connue ou non', async () => {
    const known = requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('membre@exemple.test')
    )
    await vi.runAllTimersAsync()
    const unknown = requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('inconnu@exemple.test')
    )
    await vi.runAllTimersAsync()

    expect(await known).toEqual({status: 'sent'})
    expect(await unknown).toEqual(await known)
  })

  it('dure au moins le plancher, que l’envoi soit instantané ou non', async () => {
    expect(MAGIC_LINK_REQUEST_MIN_DURATION_MS).toBe(1500)

    const {tracked, isSettled} = await settle(
      requestMagicLinkAction(
        {status: 'idle'},
        requestFormData('inconnu@exemple.test')
      )
    )
    await vi.advanceTimersByTimeAsync(MAGIC_LINK_REQUEST_MIN_DURATION_MS - 1)
    expect(isSettled()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await tracked
    expect(isSettled()).toBe(true)
  })

  it('attend l’envoi quand il dépasse le plancher', async () => {
    vi.mocked(auth.api.signInMagicLink).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({status: true}), 2000)
        ) as never
    )

    const {tracked, isSettled} = await settle(
      requestMagicLinkAction(
        {status: 'idle'},
        requestFormData('membre@exemple.test')
      )
    )
    await vi.advanceTimersByTimeAsync(1999)
    expect(isSettled()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await tracked).toEqual({status: 'sent'})
  })

  it('rend l’état « service en panne » sans lever quand le transport échoue', async () => {
    vi.mocked(auth.api.signInMagicLink).mockRejectedValue(
      new EmailTransportError('brevo', 'refus')
    )

    const {tracked, isSettled} = await settle(
      requestMagicLinkAction(
        {status: 'idle'},
        requestFormData('membre@exemple.test')
      )
    )
    await vi.advanceTimersByTimeAsync(MAGIC_LINK_REQUEST_MIN_DURATION_MS - 1)
    expect(isSettled()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await tracked).toEqual({status: 'unavailable'})
  })

  it('rend une erreur de champ pour une adresse invalide, sans rien demander', async () => {
    const result = await requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('pas-une-adresse')
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {field: 'email', message: 'Auth.MagicLinkLogin.email.invalid'},
      ],
    })
    expect(auth.api.signInMagicLink).not.toHaveBeenCalled()
  })
})
