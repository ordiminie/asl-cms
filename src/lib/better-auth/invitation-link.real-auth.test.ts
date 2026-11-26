import {betterAuth} from 'better-auth'
import {memoryAdapter} from 'better-auth/adapters/memory'
import {magicLink} from 'better-auth/plugins'
import {afterAll, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Sous jsdom, `TextEncoder` rend un `Uint8Array` d'un autre royaume que le
 * `Uint8Array` global : `jose` le refuse. Meme contournement que
 * `email-verification-link.real-auth.test.ts`.
 */
const {OriginalTextEncoder, holder} = vi.hoisted(() => {
  const OriginalTextEncoder = globalThis.TextEncoder
  class SameRealmTextEncoder extends OriginalTextEncoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = SameRealmTextEncoder
  return {OriginalTextEncoder, holder: {auth: undefined as unknown}}
})

afterAll(() => {
  globalThis.TextEncoder = OriginalTextEncoder
})

vi.mock('./auth', () => ({
  get auth() {
    return holder.auth
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
/**
 * Premiere connexion (s42a) : le hook apres creation de session charge ce
 * service a l'appel ; sa trace se prouve dans `association-session-guard.test.ts`.
 */
vi.mock('@/services/member-invitation-service', () => ({
  recordFirstSignIn: vi.fn(),
}))
/** Fiches toujours ouvertes ici : la regle de s57 se prouve ailleurs. */
vi.mock('@/services/facades/member-profile-access-service-facade', () => ({
  hasMemberSpaceAccessService: vi.fn(async () => true),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))
vi.mock('@/services/facades/association-settings-service-facade', () => ({
  getAssociationSettingsService: vi.fn(async () => ({})),
}))
vi.mock('@/services/facades/email-service-facade', () => ({
  sendMagicLinkEmailService: vi.fn(),
}))
vi.mock('@/services/facades/rate-limit-service-facade', () => ({
  consumeMagicLinkRequestQuotaService: vi.fn(async () => ({allowed: true})),
}))

import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {
  getUserByEmailDao,
  getUserByIdDao,
} from '@/db/repositories/user-repository'
import {sendMagicLinkEmailService} from '@/services/facades/email-service-facade'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import {consumeMagicLinkRequestQuotaService} from '@/services/facades/rate-limit-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {associationSessionGuard} from './association-session-guard'
import {
  type InvitationLink,
  issueInvitationLink,
  revokeInvitationLink,
} from './invitation-link'
import {magicLinkOptions} from './magic-link-integration'

/**
 * ADR 071 sur un vrai Better Auth 1.7.1 en memoire : le lien d'invitation nait
 * du seul generateur (`signInMagicLink`), appele **sans requete**, avec des
 * en-tetes construits ; la branche « invitation » de `sendMagicLink` le
 * prolonge, revoque les precedents, le rebase sur l'association et le rend a
 * l'appelant par le canal `metadata`, sans rien envoyer.
 */

const HOST_A = 'asso-a.test'
const HOST_B = 'asso-b.test'
const ORIGIN_A = 'http://asso-a.test:3000'
const ORIGIN_B = 'http://asso-b.test:3000'
const ASSOCIATIONS: Record<string, Organization> = {
  'org-a': {id: 'org-a', name: 'A', domain: HOST_A} as Organization,
  'org-b': {id: 'org-b', name: 'B', domain: HOST_B} as Organization,
}
const EMAIL = 'membre@exemple.test'
const DAY_MS = 24 * 60 * 60 * 1000

const accountOf = (organizations: string[]) =>
  ({
    id: 'user-1',
    email: EMAIL,
    role: 'user',
    organizations: organizations.map((organizationId) => ({organizationId})),
  }) as never

const createLocalAuth = () => {
  const memoryDb: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  }
  const localAuth = betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'local-test-secret-long-enough-for-better-auth',
    database: memoryAdapter(memoryDb),
    rateLimit: {enabled: false},
    trustedOrigins: [ORIGIN_A, ORIGIN_B],
    plugins: [associationSessionGuard(), magicLink(magicLinkOptions)],
  })
  holder.auth = localAuth
  return {localAuth, memoryDb}
}

/** Un lien emis : le test echoue s'il n'y en a pas. */
const issued = async (
  input: Parameters<typeof issueInvitationLink>[0]
): Promise<InvitationLink> => {
  const link = await issueInvitationLink(input)
  if (!link) throw new Error('aucun lien emis')
  return link
}

const verificationRows = (
  memoryDb: Record<string, Record<string, unknown>[]>
) => memoryDb.verification as {identifier: string; expiresAt: Date}[]

describe('issueInvitationLink — lien d’invitation par le générateur du lien magique (ADR 071)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockImplementation(
      async (id: string) => ASSOCIATIONS[id] as never
    )
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) =>
        Object.values(ASSOCIATIONS).find(
          (association) => association.domain === domain
        ) as never
    )
    vi.mocked(getUserByEmailDao).mockResolvedValue(
      accountOf(['org-a', 'org-b'])
    )
    vi.mocked(getUserByIdDao).mockResolvedValue(accountOf(['org-a', 'org-b']))
  })

  it('génère sans requête un lien sur l’origine de l’association A, puis de B', async () => {
    createLocalAuth()

    const onA = await issued({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })
    const onB = await issued({
      organization: ASSOCIATIONS['org-b'],
      email: EMAIL,
      expiresInDays: 7,
    })

    const urlA = new URL(onA.url)
    const urlB = new URL(onB.url)
    expect(urlA.origin).toBe(ORIGIN_A)
    expect(urlB.origin).toBe(ORIGIN_B)
    expect(urlA.pathname).toBe('/api/auth/magic-link/verify')
    expect(urlA.searchParams.get('token')).toBe(onA.token)
    expect(urlA.searchParams.get('callbackURL')).toBe(
      `${ORIGIN_A}/login/destination`
    )
    expect(urlA.searchParams.get('errorCallbackURL')).toBe(
      `${ORIGIN_A}/login/lien-invalide?motif=invitation`
    )
    expect(onA.token).not.toBe(onB.token)
  })

  it('prolonge la ligne du jeton à la durée de l’invitation (J+7), pas aux 20 minutes', async () => {
    const {memoryDb} = createLocalAuth()
    const before = Date.now()

    const link = await issued({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })

    const row = verificationRows(memoryDb).find(
      (candidate) => candidate.identifier === link.token
    )
    expect(row).toBeDefined()
    const expiresAt = new Date(row?.expiresAt ?? 0).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * DAY_MS - 1000)
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS + 1000)
  })

  it('révoque le lien précédent de l’adresse : seul le dernier subsiste', async () => {
    const {memoryDb} = createLocalAuth()

    const first = await issued({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })
    const second = await issued({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })

    const identifiers = verificationRows(memoryDb).map((row) => row.identifier)
    expect(identifiers).toEqual([second.token])
    expect(identifiers).not.toContain(first.token)
  })

  it('ne consomme pas le quota de la demande anonyme et n’envoie aucun email', async () => {
    createLocalAuth()

    await issueInvitationLink({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })

    expect(consumeMagicLinkRequestQuotaService).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailService).not.toHaveBeenCalled()
  })

  it('compte non membre de l’association : aucun lien rendu, aucun jeton conservé', async () => {
    const {memoryDb} = createLocalAuth()
    vi.mocked(getUserByEmailDao).mockResolvedValue(accountOf(['org-b']))

    const link = await issueInvitationLink({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })

    expect(link).toBeNull()
    expect(verificationRows(memoryDb)).toHaveLength(0)
  })

  it('le lien ouvre la session sur le domaine de son association', async () => {
    const {localAuth} = createLocalAuth()
    const context = await localAuth.$context
    await context.internalAdapter.createUser(
      {email: EMAIL, name: 'Membre', emailVerified: true},
      {method: 'test'}
    )

    const link = await issued({
      organization: ASSOCIATIONS['org-b'],
      email: EMAIL,
      expiresInDays: 7,
    })
    const {pathname, search} = new URL(link.url)
    const response = await localAuth.handler(
      new Request(`http://${HOST_B}${pathname}${search}`, {
        headers: {host: HOST_B},
      })
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      `${ORIGIN_B}/login/destination`
    )
    expect(response.headers.getSetCookie().join(';')).toMatch(
      /better-auth\.session_token=/
    )
  })

  it('le chemin de la demande reste inchangé : sans invitation, le quota est compté et l’email part', async () => {
    const {localAuth} = createLocalAuth()

    await localAuth.api.signInMagicLink({
      headers: new Headers({host: HOST_A}),
      body: {email: EMAIL, callbackURL: '/login/destination'},
    })

    expect(consumeMagicLinkRequestQuotaService).toHaveBeenCalledWith({
      organizationId: 'org-a',
      email: EMAIL,
    })
    expect(sendMagicLinkEmailService).toHaveBeenCalledTimes(1)
  })

  it('revokeInvitationLink retire le jeton : le lien ne fonctionne plus (invitation reportée)', async () => {
    const {memoryDb} = createLocalAuth()
    const link = await issued({
      organization: ASSOCIATIONS['org-a'],
      email: EMAIL,
      expiresInDays: 7,
    })

    await revokeInvitationLink(link.token)

    expect(verificationRows(memoryDb)).toHaveLength(0)
  })
})
