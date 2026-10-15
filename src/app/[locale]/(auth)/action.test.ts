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
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))

import {isRedirectError} from 'next/dist/client/components/redirect-error'
import {headers} from 'next/headers'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {auth} from '@/lib/better-auth/auth'
import {MAGIC_LINK_REQUEST_MIN_DURATION_MS} from '@/lib/better-auth/magic-link-constants'
import {EmailTransportError} from '@/lib/emails/transport'
import {logger} from '@/lib/logger'
import {POST_LOGIN_PATHS} from '@/services/authorization/association-authorization'
import {getUserByEmailService} from '@/services/facades/user-service-facade'

import {
  loginCredentialAction,
  requestMagicLinkAction,
  verifyBackupCodeAction,
  verifyOTPAction,
} from './action'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const tenantA = {
  id: ORG_A,
  name: 'ASL A',
  slug: 'asl-a',
  domain: 'asso-a.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const accountOf = (role: string, memberships: [string, string][] = []) =>
  ({
    id: 'user-1',
    email: 'membre@exemple.test',
    role,
    organizations: memberships.map(([organizationId, memberRole]) => ({
      organizationId,
      role: memberRole,
    })),
  }) as never

/** Chaque role, et la page finale ou il arrive sur le domaine de A. */
const DESTINATIONS = [
  ['le SuperAdmin', '/admin', accountOf('super_admin')],
  [
    'le SuperAdmin membre de A',
    '/admin',
    accountOf('super_admin', [[ORG_A, 'owner']]),
  ],
  [
    'la Présidence de A',
    '/bureau/pages',
    accountOf('user', [[ORG_A, 'owner']]),
  ],
  ['le bureau de A', '/bureau/pages', accountOf('user', [[ORG_A, 'board']])],
  ['le bureau de B', '/dashboard', accountOf('user', [[ORG_B, 'board']])],
  ['un membre de A', '/dashboard', accountOf('user', [[ORG_A, 'member']])],
] as const

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
      jsonResponse(401, {
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

  /**
   * Revue M1 : la Server Action redirige vers la page finale. Une adresse qui
   * redirige encore (Route Handler, `/bureau`) laisserait la barre d'adresse
   * sur l'adresse demandee.
   */
  it.each(DESTINATIONS)(
    'connexion réussie : envoie %s directement sur %s',
    async (_, path, account) => {
      vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantA)
      vi.mocked(getUserByEmailService).mockResolvedValue(account)
      vi.mocked(auth.api.signInEmail).mockResolvedValue(
        jsonResponse(200, {redirect: false, token: 't'}) as never
      )

      await loginCredentialAction({success: false}, loginFormData())

      expect(getUserByEmailService).toHaveBeenCalledWith('membre@exemple.test')
      expect(redirect).toHaveBeenCalledTimes(1)
      expect(redirect).toHaveBeenCalledWith(path)
      expect(POST_LOGIN_PATHS).toContain(path)
    }
  )

  it('connexion réussie sur un domaine sans association : espace membre', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)
    vi.mocked(getUserByEmailService).mockResolvedValue(
      accountOf('user', [[ORG_A, 'owner']])
    )
    vi.mocked(auth.api.signInEmail).mockResolvedValue(
      jsonResponse(200, {redirect: false, token: 't'}) as never
    )

    await loginCredentialAction({success: false}, loginFormData())

    expect(redirect).toHaveBeenCalledWith('/dashboard')
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

describe('double authentification — destination (s46b, revue M1)', () => {
  const codeFormData = () => {
    const formData = new FormData()
    formData.set('code', '123456')
    return formData
  }

  const signedIn = {email: 'membre@exemple.test', id: 'user-1'}

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'asso-a.test'}) as never
    )
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantA)
  })

  it.each(DESTINATIONS)(
    'un code de sauvegarde valide envoie %s directement sur %s',
    async (_, path, account) => {
      vi.mocked(getUserByEmailService).mockResolvedValue(account)
      vi.mocked(auth.api.verifyBackupCode).mockResolvedValue({
        token: 't',
        user: signedIn,
      } as never)

      await verifyBackupCodeAction({success: false}, codeFormData())

      expect(getUserByEmailService).toHaveBeenCalledWith('membre@exemple.test')
      expect(redirect).toHaveBeenCalledTimes(1)
      expect(redirect).toHaveBeenCalledWith(path)
    }
  )

  it.each(DESTINATIONS)(
    'un code OTP valide envoie %s directement sur %s',
    async (_, path, account) => {
      vi.mocked(getUserByEmailService).mockResolvedValue(account)
      vi.mocked(auth.api.verifyTwoFactorOTP).mockResolvedValue(
        new Response(JSON.stringify({token: 't', user: signedIn}), {
          status: 200,
        }) as never
      )

      await verifyOTPAction({success: false}, codeFormData())

      expect(getUserByEmailService).toHaveBeenCalledWith('membre@exemple.test')
      expect(redirect).toHaveBeenCalledTimes(1)
      expect(redirect).toHaveBeenCalledWith(path)
    }
  )
})

/**
 * Revue m7 : la session est deja ouverte quand la destination se calcule. Un
 * compte introuvable ou une lecture qui echoue ne renvoie ni vers `/login` ni
 * vers un message d'erreur, mais vers l'espace membre, et l'erreur est
 * journalisee. La redirection de Next n'est pas avalee.
 */
describe('destination introuvable après une connexion réussie (s46b, revue m7)', () => {
  const redirectSignal = new Error('NEXT_REDIRECT')
  const signedIn = {email: 'membre@exemple.test', id: 'user-1'}

  const loginForm = () => {
    const formData = new FormData()
    formData.set('email', 'membre@exemple.test')
    formData.set('password', 'mot-de-passe')
    return formData
  }

  const codeForm = () => {
    const formData = new FormData()
    formData.set('code', '123456')
    return formData
  }

  const SIGNED_IN_ACTIONS = [
    [
      'mot de passe',
      () => {
        vi.mocked(auth.api.signInEmail).mockResolvedValue(
          new Response(JSON.stringify({redirect: false, token: 't'}), {
            status: 200,
          }) as never
        )
        return loginCredentialAction({success: false}, loginForm())
      },
    ],
    [
      'code de sauvegarde',
      () => {
        vi.mocked(auth.api.verifyBackupCode).mockResolvedValue({
          token: 't',
          user: signedIn,
        } as never)
        return verifyBackupCodeAction({success: false}, codeForm())
      },
    ],
    [
      'code OTP',
      () => {
        vi.mocked(auth.api.verifyTwoFactorOTP).mockResolvedValue(
          new Response(JSON.stringify({token: 't', user: signedIn}), {
            status: 200,
          }) as never
        )
        return verifyOTPAction({success: false}, codeForm())
      },
    ],
  ] as const

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'asso-a.test'}) as never
    )
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantA)
    vi.mocked(redirect).mockImplementation(() => {
      throw redirectSignal
    })
    vi.mocked(isRedirectError).mockImplementation(
      (error: unknown) => error === redirectSignal
    )
  })

  afterEach(() => {
    vi.mocked(redirect).mockReset()
    vi.mocked(isRedirectError).mockReset().mockReturnValue(false)
  })

  it.each(SIGNED_IN_ACTIONS)(
    '%s : compte introuvable, envoie sur l’espace membre et journalise',
    async (_, act) => {
      vi.mocked(getUserByEmailService).mockResolvedValue(undefined)

      await expect(act()).rejects.toBe(redirectSignal)

      expect(redirect).toHaveBeenCalledTimes(1)
      expect(redirect).toHaveBeenCalledWith('/dashboard')
      expect(POST_LOGIN_PATHS).toContain('/dashboard')
      expect(logger.error).toHaveBeenCalled()
    }
  )

  it.each(SIGNED_IN_ACTIONS)(
    '%s : lecture du compte en échec, envoie sur l’espace membre et journalise',
    async (_, act) => {
      const failure = new Error('base indisponible')
      vi.mocked(getUserByEmailService).mockRejectedValue(failure)

      await expect(act()).rejects.toBe(redirectSignal)

      expect(redirect).toHaveBeenCalledTimes(1)
      expect(redirect).toHaveBeenCalledWith('/dashboard')
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({error: failure})
      )
    }
  )
})
