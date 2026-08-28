import {betterAuth} from 'better-auth'
import {memoryAdapter} from 'better-auth/adapters/memory'
import {magicLink} from 'better-auth/plugins'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
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
vi.mock('@/services/email-service', () => ({
  sendMagicLinkEmailService: vi.fn(),
}))
vi.mock('@/services/notification-service', () => ({
  createTypedNotificationService: vi.fn(),
}))

import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {logger} from '@/lib/logger'
import {sendMagicLinkEmailService} from '@/services/email-service'
import {createTypedNotificationService} from '@/services/notification-service'
import {NotificationTypeConst} from '@/services/types/domain/notification-types'

import {sendMagicLink} from './magic-link-integration'

const email = 'new-user@example.test'
const url = 'https://example.test/api/auth/magic-link/verify?token=secret'

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
    vi.mocked(sendMagicLinkEmailService).mockResolvedValue(undefined)
  })

  it('envoie directement le lien quand aucun compte ne possède encore l’adresse', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)

    await sendMagicLink({email, url})

    expect(getUserByEmailDao).toHaveBeenCalledOnce()
    expect(sendMagicLinkEmailService).toHaveBeenCalledOnce()
    expect(sendMagicLinkEmailService).toHaveBeenCalledWith({email, url})
    expect(createTypedNotificationService).not.toHaveBeenCalled()
  })

  it('notifie le compte existant sans envoyer un second e-mail directement', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)

    await sendMagicLink({email, url})

    expect(createTypedNotificationService).toHaveBeenCalledOnce()
    expect(createTypedNotificationService).toHaveBeenCalledWith({
      userId: 'user-1',
      type: NotificationTypeConst.magic_link,
      metadata: {url, email},
    })
    expect(sendMagicLinkEmailService).not.toHaveBeenCalled()
  })

  it('laisse remonter le refus du wrapper direct jusqu’à Better Auth', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
    vi.mocked(sendMagicLinkEmailService).mockRejectedValue(
      new Error('provider refused')
    )

    await expect(sendMagicLink({email, url})).rejects.toThrow(
      'provider refused'
    )
  })

  it('ne journalise ni URL ni bearer token', async () => {
    const consoleLog = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
    await sendMagicLink({email, url})

    vi.mocked(getUserByEmailDao).mockResolvedValue({id: 'user-1'} as never)
    vi.mocked(createTypedNotificationService).mockResolvedValue({
      metadata: {url, email},
    } as never)
    await sendMagicLink({email, url})

    vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
    vi.mocked(sendMagicLinkEmailService).mockRejectedValueOnce(
      new Error(`provider refused ${url}`)
    )
    await expect(sendMagicLink({email, url})).rejects.toThrow(
      'provider refused'
    )

    const structuredLogs = [
      ...vi.mocked(logger.debug).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...consoleLog.mock.calls,
      ...consoleError.mock.calls,
    ]

    expect(containsSecret(structuredLogs, [url, 'secret'])).toBe(false)

    consoleLog.mockRestore()
    consoleError.mockRestore()
  })
})

describe('contrat Better Auth du lien magique', () => {
  it('crée un compte vérifié au premier clic et refuse le rejeu', async () => {
    const memoryDb: Record<string, unknown[]> = {
      user: [],
      session: [],
      account: [],
      verification: [],
    }
    let capturedUrl = ''
    const localAuth = betterAuth({
      baseURL: 'http://localhost:3000',
      secret: 'local-test-secret-long-enough-for-better-auth',
      database: memoryAdapter(memoryDb),
      rateLimit: {enabled: false},
      plugins: [
        magicLink({
          sendMagicLink: ({url: generatedUrl}) => {
            capturedUrl = generatedUrl
          },
        }),
      ],
    })
    const requestHeaders = new Headers({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    })

    await localAuth.api.signInMagicLink({
      headers: requestHeaders,
      body: {email},
    })

    expect(memoryDb.user).toHaveLength(0)
    expect(memoryDb.session).toHaveLength(0)
    const token = new URL(capturedUrl).searchParams.get('token')
    expect(token).toBeTruthy()
    if (!token) {
      throw new Error('Better Auth did not generate a magic-link token')
    }

    const verified = await localAuth.api.magicLinkVerify({
      headers: requestHeaders,
      query: {token},
    })

    expect(verified.user.email).toBe(email)
    expect(verified.user.emailVerified).toBe(true)
    expect(memoryDb.user).toHaveLength(1)
    expect(memoryDb.session).toHaveLength(1)

    let replayError: unknown
    try {
      await localAuth.api.magicLinkVerify({
        headers: requestHeaders,
        query: {token},
      })
    } catch (error) {
      replayError = error
    }

    expect(isRedirectApiError(replayError)).toBe(true)
    if (!isRedirectApiError(replayError)) {
      throw new Error('Better Auth did not reject the replay')
    }
    expect(replayError.status).toBe('FOUND')
    expect(replayError.headers.get('location')).toContain('error=INVALID_TOKEN')
    expect(memoryDb.user).toHaveLength(1)
    expect(memoryDb.session).toHaveLength(1)
  })
})
