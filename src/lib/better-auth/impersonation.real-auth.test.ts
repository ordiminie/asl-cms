import {betterAuth} from 'better-auth'
import {memoryAdapter} from 'better-auth/adapters/memory'
import {admin, twoFactor} from 'better-auth/plugins'
import {adminAc, userAc} from 'better-auth/plugins/admin/access'
import {afterAll, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Sous jsdom, `TextEncoder` rend un `Uint8Array` d'un autre royaume que le
 * `Uint8Array` global : `jose`, qui signe le cache de session, le refuse. Meme
 * contournement que `email-verification-link.real-auth.test.ts`.
 */
const {OriginalTextEncoder} = vi.hoisted(() => {
  const OriginalTextEncoder = globalThis.TextEncoder
  class SameRealmTextEncoder extends OriginalTextEncoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = SameRealmTextEncoder
  return {OriginalTextEncoder}
})

afterAll(() => {
  globalThis.TextEncoder = OriginalTextEncoder
})

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {associationSessionGuard} from './association-session-guard'
import {
  IMPERSONATION_DISABLED_HTTP_PATHS,
  IMPERSONATION_FORBIDDEN_CODE,
  impersonationGuard,
} from './impersonation-guard'

/**
 * s48, ADR 041 et 042, sur un vrai Better Auth 1.7.1 en memoire : ce que le
 * plugin admin() fait vraiment de l'imitation, avec le controle d'association
 * (ADR 034) et le garde des ecritures sensibles montes comme dans `auth.ts`.
 */

const HOST_A = 'asso-a.test'
const HOST_B = 'asso-b.test'
const ASSOCIATIONS: Record<string, Organization> = {
  [HOST_A]: {id: 'org-a', domain: HOST_A} as Organization,
  [HOST_B]: {id: 'org-b', domain: HOST_B} as Organization,
}
const PASSWORD = 'mot-de-passe-solide'
const DURATION_SECONDS = 600

/** Role global et associations de chaque compte du jeu, par email. */
const PROFILES: Record<string, {role: string; organizations: string[]}> = {
  'superadmin@exemple.test': {role: 'super_admin', organizations: []},
  'autre-superadmin@exemple.test': {role: 'super_admin', organizations: []},
  'membre-a@exemple.test': {role: 'user', organizations: ['org-a']},
  'bureau-a@exemple.test': {role: 'user', organizations: ['org-a']},
  'membre-b@exemple.test': {role: 'user', organizations: ['org-b']},
}

type Jar = Map<string, string>

/** Applique les `Set-Cookie` d'une reponse a un pot de cookies. */
const absorb = (jar: Jar, responseHeaders: Headers) => {
  for (const line of responseHeaders.getSetCookie()) {
    const [pair, ...attributes] = line.split(';')
    const separator = pair.indexOf('=')
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    const expired = attributes.some((attribute) =>
      /^\s*max-age=0\s*$/i.test(attribute)
    )
    if (expired || value === '') jar.delete(name)
    else jar.set(name, value)
  }
  return jar
}

const headersOf = (jar: Jar, host: string) =>
  new Headers({
    host,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
  })

const createLocalAuth = () => {
  const memoryDb: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
  }
  const localAuth = betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'local-test-secret-long-enough-for-better-auth',
    database: memoryAdapter(memoryDb),
    rateLimit: {enabled: false},
    disabledPaths: [...IMPERSONATION_DISABLED_HTTP_PATHS],
    session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
    emailAndPassword: {enabled: true},
    emailVerification: {sendVerificationEmail: async () => {}},
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async () => {},
      },
    },
    plugins: [
      associationSessionGuard(),
      impersonationGuard(),
      twoFactor({issuer: 'test', skipVerificationOnEnable: true}),
      admin({
        adminRoles: ['super_admin'],
        roles: {user: userAc, super_admin: adminAc},
        impersonationSessionDuration: DURATION_SECONDS,
      }),
    ],
  })
  return {localAuth, memoryDb}
}

type LocalAuth = ReturnType<typeof createLocalAuth>['localAuth']

/**
 * Le compte, tel que le lit `getUserByIdDao` : role global et associations.
 * Lu par Better Auth lui-meme, car l'adaptateur en memoire travaille sur une
 * copie pendant une transaction (inscription).
 */
const readAccountsThrough = (localAuth: LocalAuth) =>
  vi.mocked(getUserByIdDao).mockImplementation(async (id: string) => {
    const context = await localAuth.$context
    const row = await context.internalAdapter.findUserById(id)
    if (!row) return undefined as never
    const profile = PROFILES[row.email]
    return {
      id,
      role: profile.role,
      organizations: profile.organizations.map((organizationId) => ({
        organizationId,
      })),
    } as never
  })

/** Cree le compte, lui donne son role global, puis le connecte sur l'hote. */
const signedIn = async (localAuth: LocalAuth, email: string, host: string) => {
  const context = await localAuth.$context
  const registrationHost =
    PROFILES[email].organizations[0] === 'org-b' ? HOST_B : HOST_A
  await localAuth.api.signUpEmail({
    headers: new Headers({host: registrationHost}),
    body: {email, password: PASSWORD, name: email.split('@')[0]},
  })
  await context.internalAdapter.updateUserByEmail(email, {
    role: PROFILES[email].role,
  })
  const {headers: responseHeaders, response} = await localAuth.api.signInEmail({
    headers: new Headers({host}),
    body: {email, password: PASSWORD},
    returnHeaders: true,
  })
  return {jar: absorb(new Map(), responseHeaders), userId: response.user.id}
}

const impersonate = async (
  localAuth: LocalAuth,
  jar: Jar,
  host: string,
  userId: string
) => {
  const {headers: responseHeaders, response} =
    await localAuth.api.impersonateUser({
      headers: headersOf(jar, host),
      body: {userId},
      returnHeaders: true,
    })
  return {jar: absorb(new Map(jar), responseHeaders), response}
}

describe('imitation sur un vrai Better Auth (s48)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) => ASSOCIATIONS[domain]
    )
  })

  /** Un SuperAdmin et ses comptes visables, connectes sur l'hote de A. */
  const world = async () => {
    const {localAuth, memoryDb} = createLocalAuth()
    readAccountsThrough(localAuth)
    const superAdmin = await signedIn(
      localAuth,
      'superadmin@exemple.test',
      HOST_A
    )
    const member = await signedIn(localAuth, 'membre-a@exemple.test', HOST_A)
    const board = await signedIn(localAuth, 'bureau-a@exemple.test', HOST_A)
    const otherAdmin = await signedIn(
      localAuth,
      'autre-superadmin@exemple.test',
      HOST_A
    )
    const memberB = await signedIn(localAuth, 'membre-b@exemple.test', HOST_B)
    return {localAuth, memoryDb, superAdmin, member, board, otherAdmin, memberB}
  }

  it('un compte user, Bureau compris, reçoit 403', async () => {
    const {localAuth, board, member} = await world()

    await expect(
      localAuth.api.impersonateUser({
        headers: headersOf(board.jar, HOST_A),
        body: {userId: member.userId},
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      body: {code: 'YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS'},
    })
  })

  it('viser un autre SuperAdmin donne 403', async () => {
    const {localAuth, superAdmin, otherAdmin} = await world()

    await expect(
      localAuth.api.impersonateUser({
        headers: headersOf(superAdmin.jar, HOST_A),
        body: {userId: otherAdmin.userId},
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      body: {code: 'YOU_CANNOT_IMPERSONATE_ADMINS'},
    })
  })

  it('enchaîner une seconde imitation donne 403', async () => {
    const {localAuth, superAdmin, member, board} = await world()
    const impersonating = await impersonate(
      localAuth,
      superAdmin.jar,
      HOST_A,
      member.userId
    )

    await expect(
      localAuth.api.impersonateUser({
        headers: headersOf(impersonating.jar, HOST_A),
        body: {userId: board.userId},
      })
    ).rejects.toMatchObject({statusCode: 403})
  })

  it('ouvre la session du compte visé, marquée et bornée par la durée', async () => {
    const {localAuth, superAdmin, member} = await world()
    const before = Date.now()

    const {jar} = await impersonate(
      localAuth,
      superAdmin.jar,
      HOST_A,
      member.userId
    )
    const session = await localAuth.api.getSession({
      headers: headersOf(jar, HOST_A),
    })

    expect(session?.user.id).toBe(member.userId)
    expect(session?.session.impersonatedBy).toBe(superAdmin.userId)
    const expiresAt = new Date(String(session?.session.expiresAt)).getTime()
    expect(expiresAt - before).toBeGreaterThanOrEqual(
      DURATION_SECONDS * 1000 - 1000
    )
    expect(expiresAt - before).toBeLessThanOrEqual(
      DURATION_SECONDS * 1000 + 5000
    )
  })

  it('le cookie cache porte impersonatedBy (D4)', async () => {
    const {localAuth, memoryDb, superAdmin, member} = await world()
    const {jar} = await impersonate(
      localAuth,
      superAdmin.jar,
      HOST_A,
      member.userId
    )
    const row = memoryDb.session.find((s) => s.impersonatedBy)
    if (!row) throw new Error('aucune session à la place d’un compte en base')
    row.impersonatedBy = null

    const cached = await localAuth.api.getSession({
      headers: headersOf(jar, HOST_A),
    })
    const fromDatabase = await localAuth.api.getSession({
      headers: headersOf(jar, HOST_A),
      query: {disableCookieCache: true},
    })

    expect(cached?.session.impersonatedBy).toBe(superAdmin.userId)
    expect(fromDatabase?.session.impersonatedBy).toBeNull()
  })

  it('le contrôle d’association s’applique à la session imitée', async () => {
    const {localAuth, memoryDb, superAdmin, memberB} = await world()
    const sessionsBefore = memoryDb.session.length

    await expect(
      localAuth.api.impersonateUser({
        headers: headersOf(superAdmin.jar, HOST_A),
        body: {userId: memberB.userId},
      })
    ).rejects.toMatchObject({statusCode: 500})
    expect(memoryDb.session).toHaveLength(sessionsBefore)
  })

  it('stopImpersonating rend la session SuperAdmin d’origine', async () => {
    const {localAuth, memoryDb, superAdmin, member} = await world()
    const impersonating = await impersonate(
      localAuth,
      superAdmin.jar,
      HOST_A,
      member.userId
    )

    const {headers: responseHeaders} = await localAuth.api.stopImpersonating({
      headers: headersOf(impersonating.jar, HOST_A),
      returnHeaders: true,
    })
    const back = absorb(new Map(impersonating.jar), responseHeaders)
    const session = await localAuth.api.getSession({
      headers: headersOf(back, HOST_A),
    })

    expect(session?.user.id).toBe(superAdmin.userId)
    expect(session?.session.impersonatedBy ?? null).toBeNull()
    expect(memoryDb.session.some((s) => s.impersonatedBy)).toBe(false)
  })

  it.each([...IMPERSONATION_DISABLED_HTTP_PATHS])(
    'POST %s répond 404 par HTTP',
    async (path) => {
      const {localAuth, superAdmin, member} = await world()
      const headers = headersOf(superAdmin.jar, HOST_A)
      headers.set('content-type', 'application/json')
      headers.set('origin', 'http://localhost:3000')

      const response = await localAuth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({userId: member.userId}),
        })
      )

      expect(response.status).toBe(404)
    }
  )
})

describe('écritures sensibles pendant l’imitation (s48, critère 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) => ASSOCIATIONS[domain]
    )
  })

  const setup = async () => {
    const {localAuth} = createLocalAuth()
    readAccountsThrough(localAuth)
    const superAdmin = await signedIn(
      localAuth,
      'superadmin@exemple.test',
      HOST_A
    )
    const member = await signedIn(localAuth, 'membre-a@exemple.test', HOST_A)
    const impersonating = await impersonate(
      localAuth,
      superAdmin.jar,
      HOST_A,
      member.userId
    )
    return {localAuth, member, impersonating}
  }

  type Call = (localAuth: LocalAuth, headers: Headers) => Promise<unknown>

  const SENSITIVE: [string, Call][] = [
    [
      'changePassword',
      (localAuth, headers) =>
        localAuth.api.changePassword({
          headers,
          body: {currentPassword: PASSWORD, newPassword: 'nouveau-solide-1'},
        }),
    ],
    [
      'changeEmail',
      (localAuth, headers) =>
        localAuth.api.changeEmail({
          headers,
          body: {newEmail: 'nouvelle@exemple.test'},
        }),
    ],
    [
      'enableTwoFactor',
      (localAuth, headers) =>
        localAuth.api.enableTwoFactor({headers, body: {password: PASSWORD}}),
    ],
  ]

  it.each(SENSITIVE)('%s est refusé pendant l’imitation', async (_, call) => {
    const {localAuth, impersonating} = await setup()

    await expect(
      call(localAuth, headersOf(impersonating.jar, HOST_A))
    ).rejects.toMatchObject({
      statusCode: 403,
      body: {code: IMPERSONATION_FORBIDDEN_CODE},
    })
  })

  it('disableTwoFactor est refusé pendant l’imitation', async () => {
    const {localAuth, impersonating} = await setup()

    await expect(
      localAuth.api.disableTwoFactor({
        headers: headersOf(impersonating.jar, HOST_A),
        body: {password: PASSWORD},
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      body: {code: IMPERSONATION_FORBIDDEN_CODE},
    })
  })

  it.each(SENSITIVE)('%s passe hors imitation', async (_, call) => {
    const {localAuth, member} = await setup()

    await expect(
      call(localAuth, headersOf(member.jar, HOST_A))
    ).resolves.toBeTruthy()
  })

  it('le nom reste modifiable pendant l’imitation (D3)', async () => {
    const {localAuth, impersonating} = await setup()

    await expect(
      localAuth.api.updateUser({
        headers: headersOf(impersonating.jar, HOST_A),
        body: {name: 'Nouveau nom'},
      })
    ).resolves.toMatchObject({status: true})
  })
})
