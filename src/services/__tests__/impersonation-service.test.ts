import {beforeEach, describe, expect, it, vi} from 'vitest'

const {scope, calls, requestHeaders} = vi.hoisted(() => ({
  scope: {current: undefined as string | undefined},
  calls: [] as string[],
  requestHeaders: {current: new Headers()},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => requestHeaders.current),
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {impersonateUser: vi.fn(), stopImpersonating: vi.fn()}},
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByDomainDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/impersonation-event-repository', () => ({
  insertImpersonationEventDao: vi.fn(),
}))

import {APIError} from 'better-auth/api'

import {insertImpersonationEventDao} from '@/db/repositories/impersonation-event-repository'
import {getOrganizationByDomainDao} from '@/db/repositories/organization-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'
import {auth} from '@/lib/better-auth/auth'

import {
  getActingContext,
  getAuthUser,
  getSessionAuth,
} from '../authentication/auth-service'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  openImpersonationService,
  stopImpersonationService,
} from '../impersonation-service'
import {User} from '../types/domain/user-types'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const TARGET_ID = '44444444-4444-4444-8444-444444444444'
const SUPPORT_ID = '55555555-5555-4555-8555-555555555555'

const support: User = {...userTestSuperAdmin, id: SUPPORT_ID, name: 'Zoé'}

const target = (overrides: Partial<User> = {}): User => ({
  ...userTest,
  id: TARGET_ID,
  name: 'Claire Montel',
  role: 'user',
  banned: false,
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: TARGET_ID,
      role: 'owner',
      createdAt: new Date(),
    },
  ],
  ...overrides,
})

const open = (input: Record<string, unknown> = {}) =>
  openImpersonationService({
    organizationId: ORG_ID,
    userId: TARGET_ID,
    ...input,
  } as never)

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  scope.current = undefined
  requestHeaders.current = new Headers({host: 'clos-fleuri.test:3000'})
  vi.mocked(getAuthUser).mockResolvedValue(support)
  vi.mocked(getActingContext).mockResolvedValue({user: support})
  vi.mocked(getOrganizationByDomainDao).mockImplementation(
    async (domain: string) =>
      (domain === 'clos-fleuri.test'
        ? {id: ORG_ID, domain}
        : domain === 'autre.test'
          ? {id: OTHER_ORG_ID, domain}
          : undefined) as never
  )
  vi.mocked(getUserByIdDao).mockResolvedValue(target())
  vi.mocked(auth.api.impersonateUser).mockImplementation((async () => {
    calls.push('impersonate')
    return {session: {id: 'session-imitee'}, user: {id: TARGET_ID}}
  }) as never)
  vi.mocked(insertImpersonationEventDao).mockImplementation(async () => {
    calls.push(`trace:${scope.current}`)
  })
})

describe('openImpersonationService (s48)', () => {
  it('ouvre la session puis trace l’ouverture, sous le tenant visé', async () => {
    const result = await open({reason: '  Passation bloquée  '})

    expect(result).toEqual({status: 'opened', url: '/bureau/pages'})
    expect(auth.api.impersonateUser).toHaveBeenCalledWith({
      headers: requestHeaders.current,
      body: {userId: TARGET_ID},
    })
    expect(calls).toEqual(['impersonate', `trace:${ORG_ID}`])
    expect(insertImpersonationEventDao).toHaveBeenCalledTimes(1)
    expect(insertImpersonationEventDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: 'opened',
      adminUserId: SUPPORT_ID,
      adminName: 'Zoé',
      targetUserId: TARGET_ID,
      targetName: 'Claire Montel',
      sessionId: 'session-imitee',
      reason: 'Passation bloquée',
    })
  })

  it('atterrit dans l’espace membre pour un simple membre', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(
      target({
        organizations: [
          {
            id: 'membership',
            organizationId: ORG_ID,
            userId: TARGET_ID,
            role: 'member',
            createdAt: new Date(),
          },
        ],
      })
    )

    expect(await open()).toEqual({status: 'opened', url: '/dashboard'})
  })

  it('motif vide : colonne nulle', async () => {
    await open({reason: '   '})

    expect(insertImpersonationEventDao).toHaveBeenCalledWith(
      expect.objectContaining({reason: null})
    )
  })

  it('refuse un compte user, Bureau compris, sans rien ouvrir', async () => {
    const board = target()
    vi.mocked(getAuthUser).mockResolvedValue(board)
    vi.mocked(getActingContext).mockResolvedValue({user: board})

    expect(await open()).toEqual({status: 'forbidden'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
    expect(insertImpersonationEventDao).not.toHaveBeenCalled()
  })

  it('refuse sans session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)
    vi.mocked(getActingContext).mockResolvedValue(undefined)

    expect(await open()).toEqual({status: 'forbidden'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it('refuse d’enchaîner une seconde session à la place', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(target())
    vi.mocked(getActingContext).mockResolvedValue({
      user: target(),
      impersonator: {id: SUPPORT_ID, name: 'Zoé'},
    })

    expect(await open()).toEqual({status: 'already_impersonating'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it('refuse des identifiants mal formés et un motif trop long', async () => {
    await expect(open({organizationId: 'x'})).rejects.toThrow(
      ValidationParsedZodError
    )
    await expect(open({reason: 'a'.repeat(201)})).rejects.toThrow(
      ValidationParsedZodError
    )
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it.each(['autre.test', 'inconnu.test'])(
    'refuse quand le domaine appelé (%s) n’est pas celui de l’association',
    async (host) => {
      requestHeaders.current = new Headers({host})

      expect(await open()).toEqual({status: 'wrong_domain'})
      expect(auth.api.impersonateUser).not.toHaveBeenCalled()
    }
  )

  it('refuse un compte inconnu ou absent de l’association', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValueOnce(undefined)
    expect(await open()).toEqual({status: 'target_not_found'})

    vi.mocked(getUserByIdDao).mockResolvedValueOnce(target({organizations: []}))
    expect(await open()).toEqual({status: 'target_not_found'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it('refuse de viser un SuperAdmin', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(target({role: 'super_admin'}))

    expect(await open()).toEqual({status: 'target_is_admin'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it('refuse un compte suspendu', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(target({banned: true}))

    expect(await open()).toEqual({status: 'suspended'})
    expect(auth.api.impersonateUser).not.toHaveBeenCalled()
  })

  it.each([
    ['BANNED_USER', 'suspended'],
    ['YOU_CANNOT_IMPERSONATE_ADMINS', 'target_is_admin'],
    ['YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS', 'forbidden'],
  ])('traduit le refus %s de Better Auth, sans trace', async (code, status) => {
    vi.mocked(auth.api.impersonateUser).mockRejectedValue(
      new APIError('FORBIDDEN', {code, message: code})
    )

    expect(await open()).toEqual({status})
    expect(insertImpersonationEventDao).not.toHaveBeenCalled()
  })

  it('une session qui n’a pas pu s’ouvrir ne laisse aucune trace', async () => {
    vi.mocked(auth.api.impersonateUser).mockRejectedValue(
      new APIError('INTERNAL_SERVER_ERROR', {message: 'Failed'})
    )

    await expect(open()).rejects.toThrow()
    expect(insertImpersonationEventDao).not.toHaveBeenCalled()
  })

  it('appelle Better Auth hors de tout scope de tenant (pool à une connexion)', async () => {
    const scopeAtImpersonate: (string | undefined)[] = []
    vi.mocked(auth.api.impersonateUser).mockImplementation((async () => {
      scopeAtImpersonate.push(scope.current)
      return {session: {id: 'session-imitee'}, user: {id: TARGET_ID}}
    }) as never)
    const scopeAtTargetRead: (string | undefined)[] = []
    vi.mocked(getUserByIdDao).mockImplementation(async () => {
      scopeAtTargetRead.push(scope.current)
      return target()
    })

    expect(await open()).toEqual({status: 'opened', url: '/bureau/pages'})
    expect(scopeAtImpersonate).toEqual([undefined])
    expect(scopeAtTargetRead).toEqual([ORG_ID])
    expect(insertImpersonationEventDao).toHaveBeenCalledTimes(1)
  })

  it('trace impossible : la session ouverte est refermée, l’erreur remonte', async () => {
    const traceFailure = new Error('insert failed')
    vi.mocked(insertImpersonationEventDao).mockRejectedValue(traceFailure)
    vi.mocked(auth.api.stopImpersonating).mockImplementation((async () => {
      calls.push(`stop:${scope.current}`)
      return {}
    }) as never)

    await expect(open()).rejects.toBe(traceFailure)
    expect(auth.api.stopImpersonating).toHaveBeenCalledWith({
      headers: requestHeaders.current,
    })
    expect(calls).toEqual(['impersonate', 'stop:undefined'])
  })

  it('trace impossible et fermeture échouée : l’erreur de trace remonte', async () => {
    const traceFailure = new Error('insert failed')
    vi.mocked(insertImpersonationEventDao).mockRejectedValue(traceFailure)
    vi.mocked(auth.api.stopImpersonating).mockRejectedValue(
      new Error('stop failed')
    )

    await expect(open()).rejects.toBe(traceFailure)
    expect(auth.api.stopImpersonating).toHaveBeenCalledTimes(1)
  })
})

describe('stopImpersonationService (s48)', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(target())
    vi.mocked(getActingContext).mockResolvedValue({
      user: target(),
      impersonator: {id: SUPPORT_ID, name: 'Zoé'},
    })
    vi.mocked(getSessionAuth).mockResolvedValue({
      session: {id: 'session-imitee', impersonatedBy: SUPPORT_ID},
    } as never)
    vi.mocked(auth.api.stopImpersonating).mockImplementation((async () => {
      calls.push('stop')
      return {}
    }) as never)
  })

  it('rend la session d’origine puis trace la sortie, sous le tenant du domaine', async () => {
    const result = await stopImpersonationService()

    expect(result).toEqual({
      status: 'closed',
      url: `/admin/organizations/${ORG_ID}/edit?retour=1`,
    })
    expect(auth.api.stopImpersonating).toHaveBeenCalledWith({
      headers: requestHeaders.current,
    })
    expect(calls).toEqual(['stop', `trace:${ORG_ID}`])
    expect(insertImpersonationEventDao).toHaveBeenCalledTimes(1)
    expect(insertImpersonationEventDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      kind: 'closed',
      adminUserId: SUPPORT_ID,
      adminName: 'Zoé',
      targetUserId: TARGET_ID,
      targetName: 'Claire Montel',
      sessionId: 'session-imitee',
      reason: null,
    })
  })

  it('hors imitation : refus, rien n’est appelé', async () => {
    vi.mocked(getActingContext).mockResolvedValue({user: target()})

    expect(await stopImpersonationService()).toEqual({
      status: 'not_impersonating',
    })
    expect(auth.api.stopImpersonating).not.toHaveBeenCalled()
    expect(insertImpersonationEventDao).not.toHaveBeenCalled()
  })

  it('une sortie échouée ne trace rien', async () => {
    vi.mocked(auth.api.stopImpersonating).mockRejectedValue(
      new APIError('INTERNAL_SERVER_ERROR', {message: 'Failed'})
    )

    await expect(stopImpersonationService()).rejects.toThrow()
    expect(insertImpersonationEventDao).not.toHaveBeenCalled()
  })

  it('appelle Better Auth hors de tout scope de tenant (pool à une connexion)', async () => {
    vi.mocked(auth.api.stopImpersonating).mockImplementation((async () => {
      calls.push(`stop:${scope.current}`)
      return {}
    }) as never)

    await stopImpersonationService()

    expect(calls).toEqual(['stop:undefined', `trace:${ORG_ID}`])
  })
})
