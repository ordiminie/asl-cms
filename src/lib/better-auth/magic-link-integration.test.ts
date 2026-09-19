import {betterAuth} from 'better-auth'
import {memoryAdapter} from 'better-auth/adapters/memory'
import {magicLink} from 'better-auth/plugins'
import {createTranslator} from 'next-intl'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {createMemoryTransport} from '@/lib/emails/transport/memory-transport'

import messages from '../../../messages/fr.json'

const memoryTransport = createMemoryTransport()

vi.mock('server-only', () => ({}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  getUserByStripeCustomerIdDao: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))
vi.mock('@/lib/emails/transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/emails/transport')>()),
  getEmailTransport: vi.fn(() => memoryTransport),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (namespace: string) =>
    createTranslator({locale: 'fr', messages, namespace: namespace as never})
  ),
  getLocale: vi.fn(async () => 'fr'),
}))
vi.mock('@/services/app-settings-service', () => ({
  getBooleanSettingService: vi.fn(async () => true),
  getStringSettingService: vi.fn(async () => ''),
}))
vi.mock('@/services/subscription-service', () => ({
  getPlanByPriceIdService: vi.fn(),
}))
vi.mock('@/lib/stripe/stripe-utils', () => ({
  getFormattedPriceFromSubscription: vi.fn(),
  getSubscriptionDetails: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getTenantByDomainDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/services/notification-service', () => ({
  createTypedNotificationService: vi.fn(),
}))

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getTenantByDomainDal} from '@/app/dal/tenant-dal'
import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {logger} from '@/lib/logger'
import {createTypedNotificationService} from '@/services/notification-service'

import {MAGIC_LINK_EXPIRES_IN_SECONDS} from './magic-link-constants'
import {magicLinkOptions, sendMagicLink} from './magic-link-integration'

const email = 'membre@exemple.test'
const url =
  'https://asl-les-pins.test/api/auth/magic-link/verify?token=secret-token&callbackURL=%2Fdashboard'

const tenant = (logoKey: string | null) => ({
  id: 'org-1',
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'asl-les-pins.test',
  enabledModules: [],
  logoKey,
  faviconKey: null,
})

const requestContext = (host = 'asl-les-pins.test') => ({
  headers: new Headers({host, 'x-forwarded-proto': 'https'}),
})

const htmlOf = (index = 0) =>
  new DOMParser().parseFromString(
    memoryTransport.messages[index].html ?? '',
    'text/html'
  )

function isRedirectApiError(
  error: unknown
): error is {status: string; headers: Headers} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'headers' in error &&
    error.headers instanceof Headers
  )
}

function containsSecret(
  value: unknown,
  secrets: string[],
  seen = new WeakSet<object>()
): boolean {
  if (typeof value === 'string') {
    return secrets.some((secret) => value.includes(secret))
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false
  }

  seen.add(value)
  if (value instanceof Error && containsSecret(value.message, secrets, seen)) {
    return true
  }

  return Reflect.ownKeys(value).some((key) =>
    containsSecret(Reflect.get(value, key), secrets, seen)
  )
}

describe('sendMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memoryTransport.messages.length = 0
    vi.mocked(getTenantByDomainDal).mockResolvedValue(
      tenant('organizations/org-1/identity/logo-42.png')
    )
    vi.mocked(getAssociationSettingsDal).mockResolvedValue({
      'identity.accent_hue': {
        value: 150,
        storedValue: '150',
        defaultFromKey: null,
      },
    })
  })

  it('n’envoie rien quand aucun compte ne possède l’adresse', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)

    await sendMagicLink({email, url}, requestContext())

    expect(memoryTransport.messages).toHaveLength(0)
    expect(createTypedNotificationService).not.toHaveBeenCalled()
  })

  it('envoie par le transport l’email de l’association du domaine appelé', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)

    await sendMagicLink({email, url}, requestContext())

    expect(getTenantByDomainDal).toHaveBeenCalledWith('asl-les-pins.test')
    expect(getAssociationSettingsDal).toHaveBeenCalledWith('org-1')
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe(email)
    expect(sent.subject).toMatch(/ASL Les Pins — votre lien de connexion$/)
    expect(sent.text).toContain(url)

    const doc = htmlOf()
    const logo = doc.querySelector('img')
    expect(logo?.getAttribute('src')).toBe(
      'https://asl-les-pins.test/api/identity/logo?v=42'
    )
    expect(logo?.getAttribute('alt')).toBe('ASL Les Pins')
    expect(sent.html?.toLowerCase()).toContain('#e7f5ec')
    expect(createTypedNotificationService).not.toHaveBeenCalled()
  })

  it('écrit le nom seul quand le logo est en WebP', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    vi.mocked(getTenantByDomainDal).mockResolvedValue(
      tenant('organizations/org-1/identity/logo-42.webp')
    )

    await sendMagicLink({email, url}, requestContext())

    expect(htmlOf().querySelector('img')).toBeNull()
    expect(htmlOf().body.textContent).toContain('ASL Les Pins')
  })

  it('écrit le nom seul quand l’association n’a pas de logo', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    vi.mocked(getTenantByDomainDal).mockResolvedValue(tenant(null))

    await sendMagicLink({email, url}, requestContext())

    expect(htmlOf().querySelector('img')).toBeNull()
  })

  it('lit le domaine derrière le proxy (x-forwarded-host)', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)

    await sendMagicLink(
      {email, url},
      {
        headers: new Headers({
          host: 'app:3000',
          'x-forwarded-host': 'asl-les-pins.test',
          'x-forwarded-proto': 'https',
        }),
      }
    )

    expect(getTenantByDomainDal).toHaveBeenCalledWith('asl-les-pins.test')
    expect(htmlOf().querySelector('img')?.getAttribute('src')).toBe(
      'https://asl-les-pins.test/api/identity/logo?v=42'
    )
  })

  it('n’envoie rien sur un domaine qui ne sert aucune association', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    vi.mocked(getTenantByDomainDal).mockResolvedValue(undefined)

    await sendMagicLink({email, url}, requestContext('inconnu.test'))

    expect(memoryTransport.messages).toHaveLength(0)
  })

  it('laisse remonter l’échec du transport jusqu’à Better Auth', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    const failing = {
      send: vi.fn(() => Promise.reject(new Error('provider refused'))),
    }
    const {getEmailTransport} = await import('@/lib/emails/transport')
    vi.mocked(getEmailTransport).mockReturnValueOnce(failing)

    await expect(sendMagicLink({email, url}, requestContext())).rejects.toThrow(
      'provider refused'
    )
  })

  it('ne journalise ni URL ni jeton', async () => {
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
    await sendMagicLink({email, url}, requestContext())
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    await sendMagicLink({email, url}, requestContext())
    vi.mocked(getTenantByDomainDal).mockResolvedValue(undefined)
    await sendMagicLink({email, url}, requestContext('inconnu.test'))

    const structuredLogs = [
      ...vi.mocked(logger.debug).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...consoleLog.mock.calls,
      ...consoleError.mock.calls,
    ]

    expect(containsSecret(structuredLogs, [url, 'secret-token'])).toBe(false)

    consoleLog.mockRestore()
    consoleError.mockRestore()
  })
})

describe('options du plugin lien magique', () => {
  it('valent 20 minutes et interdisent l’inscription', () => {
    expect(MAGIC_LINK_EXPIRES_IN_SECONDS).toBe(1200)
    expect(magicLinkOptions.expiresIn).toBe(MAGIC_LINK_EXPIRES_IN_SECONDS)
    expect(magicLinkOptions.disableSignUp).toBe(true)
    expect(magicLinkOptions.sendMagicLink).toBe(sendMagicLink)
  })
})

describe('contrat Better Auth du lien magique, avec nos options', () => {
  const setup = (users: Record<string, unknown>[] = []) => {
    const memoryDb: Record<string, Record<string, unknown>[]> = {
      user: users,
      session: [],
      account: [],
      verification: [],
    }
    const captured: string[] = []
    const localAuth = betterAuth({
      baseURL: 'http://localhost:3000',
      secret: 'local-test-secret-long-enough-for-better-auth',
      database: memoryAdapter(memoryDb),
      rateLimit: {enabled: false},
      plugins: [
        magicLink({
          ...magicLinkOptions,
          sendMagicLink: ({url: generatedUrl}) => {
            captured.push(generatedUrl)
          },
        }),
      ],
    })
    const headers = new Headers({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    })
    const request = async (address: string) => {
      await localAuth.api.signInMagicLink({
        headers,
        body: {
          email: address,
          callbackURL: '/dashboard',
          errorCallbackURL: '/login/lien-invalide',
        },
      })
      const token = new URL(captured.at(-1) ?? '').searchParams.get('token')
      if (!token) throw new Error('Better Auth did not generate a token')
      return token
    }
    const verify = async (token: string) => {
      try {
        return {
          ok: await localAuth.api.magicLinkVerify({
            headers,
            query: {
              token,
              callbackURL: '/dashboard',
              errorCallbackURL: '/login/lien-invalide',
            },
          }),
        }
      } catch (error) {
        return {error}
      }
    }
    return {memoryDb, request, verify}
  }

  const existingUser = {
    id: 'user-1',
    name: 'Membre',
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('fixe l’échéance du jeton à 20 minutes', async () => {
    const {memoryDb, request} = setup([existingUser])
    const before = Date.now()

    await request(email)

    const [verification] = memoryDb.verification
    const expiresAt = new Date(verification.expiresAt as Date).getTime()
    expect(expiresAt - before).toBeGreaterThanOrEqual(1200 * 1000 - 1000)
    expect(expiresAt - before).toBeLessThanOrEqual(1200 * 1000 + 1000)
  })

  it('ouvre une session au premier clic et refuse le rejeu', async () => {
    const {memoryDb, request, verify} = setup([existingUser])
    const token = await request(email)

    const first = await verify(token)
    expect(isRedirectApiError(first.error)).toBe(true)
    if (!isRedirectApiError(first.error)) throw new Error('no redirect')
    expect(first.error.headers.get('location')).toContain('/dashboard')
    expect(memoryDb.session).toHaveLength(1)

    const replay = await verify(token)
    expect(isRedirectApiError(replay.error)).toBe(true)
    if (!isRedirectApiError(replay.error)) throw new Error('no redirect')
    expect(replay.error.headers.get('location')).toContain(
      '/login/lien-invalide?error=INVALID_TOKEN'
    )
    expect(memoryDb.session).toHaveLength(1)
  })

  it('ne crée jamais de compte pour une adresse inconnue', async () => {
    const {memoryDb, request, verify} = setup()
    const token = await request('inconnu@exemple.test')

    const result = await verify(token)

    expect(isRedirectApiError(result.error)).toBe(true)
    expect(memoryDb.user).toHaveLength(0)
    expect(memoryDb.session).toHaveLength(0)
  })
})
