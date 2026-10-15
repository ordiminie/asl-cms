import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/dist/client/components/redirect-error', () => ({
  isRedirectError: vi.fn(() => false),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('next/navigation', () => ({redirect: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn((argument: string | {namespace: string}) => {
    const namespace =
      typeof argument === 'string' ? argument : argument.namespace
    return Promise.resolve((key: string) => `${namespace}.${key}`)
  }),
}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      signInMagicLink: vi.fn(),
      verifyBackupCode: vi.fn(),
      verifyTwoFactorOTP: vi.fn(),
    },
  },
}))
vi.mock('@/services/facades/user-service-facade', () => ({
  getUserByEmailService: vi.fn(),
}))

import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {auth} from '@/lib/better-auth/auth'
import {MAGIC_LINK_REQUEST_MIN_DURATION_MS} from '@/lib/better-auth/magic-link-constants'
import {EmailTransportError} from '@/lib/emails/transport'
import {getUserByEmailService} from '@/services/facades/user-service-facade'

import {
  loginCredentialAction,
  requestMagicLinkAction,
  verifyBackupCodeAction,
  verifyOTPAction,
} from './action'

describe('requestMagicLinkAction', () => {
  const requestFormData = (address: string, locale?: string) => {
    const formData = new FormData()
    formData.set('email', address)
    if (locale !== undefined) formData.set('locale', locale)
    return formData
  }

  const requestedLocale = () =>
    vi.mocked(auth.api.signInMagicLink).mock.calls[0][0]?.body.metadata?.locale

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
        callbackURL: '/login/destination',
        errorCallbackURL: '/login/lien-invalide',
        metadata: {locale: 'fr'},
      },
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('transmet à l’email la locale de la page de demande', async () => {
    const pending = requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('membre@exemple.test', 'fr')
    )
    await vi.runAllTimersAsync()
    await pending

    expect(requestedLocale()).toBe('fr')
  })

  it.each(['es', 'en'])(
    'ramène l’ancienne locale %s au français (s43)',
    async (locale) => {
      const pending = requestMagicLinkAction(
        {status: 'idle'},
        requestFormData('membre@exemple.test', locale)
      )
      await vi.runAllTimersAsync()
      await pending

      expect(requestedLocale()).toBe('fr')
    }
  )

  it('retombe sur fr pour une locale non servie (ADR 008)', async () => {
    const pending = requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('membre@exemple.test', 'de')
    )
    await vi.runAllTimersAsync()
    await pending

    expect(requestedLocale()).toBe('fr')
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

  /**
   * L'action demande ses libellés dans la locale de la page. Que next-intl les
   * rende bien dans cette locale depuis une Server Action sans cookie est
   * prouvé sur la vraie chaîne par `src/i18n/request.real-i18n.test.ts`.
   */
  it('traduit l’erreur de champ dans la locale de la page, pas celle du cookie', async () => {
    await requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('pas-une-adresse', 'fr')
    )
    await requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('pas-une-adresse', 'es')
    )

    expect(vi.mocked(getTranslations).mock.calls).toEqual([
      [{locale: 'fr', namespace: 'Auth.MagicLinkLogin'}],
      [{locale: 'fr', namespace: 'Auth.MagicLinkLogin'}],
    ])
  })

  it('rend une erreur de champ pour une adresse invalide, sans rien demander', async () => {
    const result = await requestMagicLinkAction(
      {status: 'idle'},
      requestFormData('pas-une-adresse')
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [{field: 'email', message: 'Auth.MagicLinkLogin.email.invalid'}],
    })
    expect(auth.api.signInMagicLink).not.toHaveBeenCalled()
  })
})

describe('loginCredentialAction (s46b, décision E)', () => {
  const loginFormData = (address = 'membre@exemple.test') => {
    const formData = new FormData()
    formData.set('email', address)
    formData.set('password', 'mot-de-passe')
    return formData
  }

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {'Content-Type': 'application/json'},
    })

  const requestHeaders = new Headers({host: 'asso-a.test'})

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockResolvedValue(requestHeaders as never)
  })

  it.each([
    [
      'compte inconnu',
      jsonResponse(401, {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      }),
    ],
    [
      'mauvais mot de passe',
      jsonResponse(401, {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      }),
    ],
    [
      'refus d’association',
      jsonResponse(422, {
        code: 'FAILED_TO_CREATE_SESSION',
        message: 'Failed to create session',
      }),
    ],
  ])('%s : rend le message d’identifiants invalides', async (_, response) => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(response as never)

    const result = await loginCredentialAction(
      {success: false},
      loginFormData()
    )

    expect(result).toEqual({
      success: false,
      message: 'AuthActions.login.invalidCredentials',
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('ne consulte pas le compte avant la connexion', async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(401, {code: 'INVALID_EMAIL_OR_PASSWORD'}) as never
    )

    await loginCredentialAction({success: false}, loginFormData())

    expect(getUserByEmailService).not.toHaveBeenCalled()
  })

  it('transmet les en-têtes de la requête et vise la route de passage', async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(200, {redirect: false, token: 't'}) as never
    )

    await loginCredentialAction({success: false}, loginFormData())

    expect(auth.api.signInEmail).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: {
        email: 'membre@exemple.test',
        password: 'mot-de-passe',
        callbackURL: '/login/destination',
      },
      asResponse: true,
    })
  })

  it('redirige vers la route de passage après une connexion réussie', async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(200, {redirect: false, token: 't'}) as never
    )

    await loginCredentialAction({success: false}, loginFormData())

    expect(redirect).toHaveBeenCalledWith('/login/destination')
  })

  it('redirige un compte banni vers /auth-error avec le message traduit', async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(403, {code: 'BANNED_USER', message: 'banned'}) as never
    )
    vi.mocked(getUserByEmailService).mockResolvedValue({
      banned: true,
      banReason: 'spam',
      banExpires: null,
    } as never)

    await loginCredentialAction({success: false}, loginFormData())

    const expected = [
      'AuthActions.login.userBanned.base',
      'AuthActions.login.userBanned.reason',
      'AuthActions.login.userBanned.permanent',
    ].join(' ')
    expect(getUserByEmailService).toHaveBeenCalledWith('membre@exemple.test')
    expect(redirect).toHaveBeenCalledWith(
      `/auth-error?error=banned&message=${encodeURIComponent(expected)}`
    )
  })

  it('ne révèle pas le bannissement sans le bon mot de passe', async () => {
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(401, {code: 'INVALID_EMAIL_OR_PASSWORD'}) as never
    )
    vi.mocked(getUserByEmailService).mockResolvedValue({
      banned: true,
      banReason: 'spam',
    } as never)

    const result = await loginCredentialAction(
      {success: false},
      loginFormData()
    )

    expect(result).toEqual({
      success: false,
      message: 'AuthActions.login.invalidCredentials',
    })
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([
    ['otp', '/verify-request/otp'],
    ['totp', '/verify-request/totp'],
  ])(
    'double authentification %s : redirige vers %s',
    async (twoFactorType, path) => {
      vi.mocked(auth.api.signInEmail).mockResolvedValue(
        jsonResponse(200, {twoFactorRedirect: true}) as never
      )
      vi.mocked(getUserByEmailService).mockResolvedValue({
        settings: {twoFactorType},
      } as never)

      await loginCredentialAction({success: false}, loginFormData())

      expect(redirect).toHaveBeenCalledWith(path)
    }
  )
})

describe('double authentification — destination (s46b, décision F)', () => {
  const codeFormData = () => {
    const formData = new FormData()
    formData.set('code', '123456')
    return formData
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockResolvedValue(new Headers() as never)
  })

  it('un code de sauvegarde valide mène à la route de passage', async () => {
    vi.mocked(auth.api.verifyBackupCode).mockResolvedValue({
      token: 't',
    } as never)

    await verifyBackupCodeAction({success: false}, codeFormData())

    expect(redirect).toHaveBeenCalledWith('/login/destination')
  })

  it('un code OTP valide mène à la route de passage', async () => {
    vi.mocked(auth.api.verifyTwoFactorOTP).mockResolvedValue(
      new Response('{}', {status: 200}) as never
    )

    await verifyOTPAction({success: false}, codeFormData())

    expect(redirect).toHaveBeenCalledWith('/login/destination')
  })
})
