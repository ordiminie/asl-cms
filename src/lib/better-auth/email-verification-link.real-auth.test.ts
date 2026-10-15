import {betterAuth} from 'better-auth'
import {memoryAdapter} from 'better-auth/adapters/memory'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Sous jsdom, `TextEncoder` rend un `Uint8Array` d'un autre royaume que le
 * `Uint8Array` global : `jose`, qui signe les jetons de verification, le
 * refuse. Le contenu est recopie dans le `Uint8Array` global, avant que
 * `jose` ne cree son encodeur au chargement.
 */
vi.hoisted(() => {
  class SameRealmTextEncoder extends TextEncoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input))
    }
  }
  globalThis.TextEncoder = SameRealmTextEncoder
})

vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {headers} from 'next/headers'

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {trustedOriginsOf} from './association-origin'
import {associationSessionGuard} from './association-session-guard'
import {verificationLinkOnAssociation} from './email-verification-link'

/**
 * Revue M2 de s46b, sur un vrai Better Auth 1.7.1 : ce que la bibliotheque
 * passe aux callbacks d'envoi, et le parcours complet du changement d'adresse
 * et de la verification d'email, avec le controle d'association (ADR 034).
 */

const ASSOCIATION_HOST = 'asso-a.test'
const ASSOCIATION_ORIGIN = 'http://asso-a.test:3000'
const PLATFORM_HOST = 'localhost:3000'
const association = {id: 'org-a', domain: ASSOCIATION_HOST} as Organization

const EMAIL = 'membre@exemple.test'
const NEW_EMAIL = 'nouvelle@exemple.test'
const PASSWORD = 'mot-de-passe-solide'

type Sent = {
  kind: 'verification' | 'change-confirmation'
  platformUrl: string
  url: string
  request: Request | undefined
}

const createLocalAuth = () => {
  const memoryDb: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  }
  const sent: Sent[] = []
  const record =
    (kind: Sent['kind']) =>
    async ({url}: {url: string}, request?: Request) => {
      sent.push({
        kind,
        platformUrl: url,
        url: await verificationLinkOnAssociation(url, request),
        request,
      })
    }

  const localAuth = betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'local-test-secret-long-enough-for-better-auth',
    database: memoryAdapter(memoryDb),
    rateLimit: {enabled: false},
    trustedOrigins: trustedOriginsOf,
    emailAndPassword: {enabled: true},
    emailVerification: {
      sendVerificationEmail: record('verification'),
      autoSignInAfterVerification: true,
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: record('change-confirmation'),
      },
    },
    plugins: [associationSessionGuard()],
  })

  return {localAuth, memoryDb, sent}
}

/** Un lien d'email ouvert dans un navigateur neuf, sur l'hote donne. */
const open = (
  localAuth: ReturnType<typeof createLocalAuth>['localAuth'],
  link: string,
  host: string
) => {
  const {pathname, search} = new URL(link)
  return localAuth.handler(
    new Request(`http://${host}${pathname}${search}`, {headers: {host}})
  )
}

const cookieOf = (setCookie: string | null) =>
  (setCookie ?? '')
    .split(/,(?=\s*[^;,=\s]+=)/)
    .map((cookie) => cookie.split(';')[0].trim())
    .join('; ')

describe('liens de vérification sur un vrai Better Auth (revue M2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) =>
        domain === ASSOCIATION_HOST ? association : undefined
    )
    vi.mocked(getUserByIdDao).mockImplementation(
      async (id: string) =>
        ({
          id,
          role: 'user',
          organizations: [{organizationId: association.id}],
        }) as never
    )
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: ASSOCIATION_HOST}) as never
    )
  })

  /** Un membre de A, connecte sur A, adresse verifiee. */
  const signedInMember = async () => {
    const auth = createLocalAuth()
    const {headers: responseHeaders} = await auth.localAuth.api.signUpEmail({
      headers: new Headers({host: ASSOCIATION_HOST}),
      body: {email: EMAIL, password: PASSWORD, name: 'Membre'},
      returnHeaders: true,
    })
    const context = await auth.localAuth.$context
    await context.internalAdapter.updateUserByEmail(EMAIL, {
      emailVerified: true,
    })
    const sessionHeaders = new Headers({
      host: ASSOCIATION_HOST,
      cookie: cookieOf(responseHeaders.get('set-cookie')),
    })
    return {...auth, sessionHeaders}
  }

  it('changement d’adresse depuis une Server Action : Better Auth ne passe aucune Request, le lien part sur l’association', async () => {
    const {localAuth, sent, sessionHeaders} = await signedInMember()

    await localAuth.api.changeEmail({
      headers: sessionHeaders,
      body: {newEmail: NEW_EMAIL, callbackURL: '/account'},
    })

    expect(sent).toHaveLength(1)
    expect(sent[0].kind).toBe('change-confirmation')
    expect(sent[0].request).toBeUndefined()
    expect(new URL(sent[0].platformUrl).origin).toBe('http://localhost:3000')
    expect(new URL(sent[0].url).origin).toBe(ASSOCIATION_ORIGIN)
  })

  it('change l’adresse au bout des deux liens, ouverts sur l’association', async () => {
    const {localAuth, memoryDb, sent, sessionHeaders} = await signedInMember()
    await localAuth.api.changeEmail({
      headers: sessionHeaders,
      body: {newEmail: NEW_EMAIL, callbackURL: '/account'},
    })

    const confirmed = await open(localAuth, sent[0].url, ASSOCIATION_HOST)
    expect(confirmed.status).toBe(302)
    expect(sent).toHaveLength(2)
    expect(sent[1].kind).toBe('verification')
    expect(sent[1].request?.headers.get('host')).toBe(ASSOCIATION_HOST)
    expect(new URL(sent[1].url).origin).toBe(ASSOCIATION_ORIGIN)

    const verified = await open(localAuth, sent[1].url, ASSOCIATION_HOST)

    expect(verified.status).toBe(302)
    expect(verified.headers.get('location')).toBe(
      `${ASSOCIATION_ORIGIN}/account`
    )
    expect(verified.headers.get('set-cookie')).toContain('session_token')
    expect(memoryDb.user[0].email).toBe(NEW_EMAIL)
  })

  it('sur l’hôte de la plateforme, la session est refusée et l’adresse ne change pas (le défaut corrigé)', async () => {
    const {localAuth, memoryDb, sent, sessionHeaders} = await signedInMember()
    await localAuth.api.changeEmail({
      headers: sessionHeaders,
      body: {newEmail: NEW_EMAIL, callbackURL: '/account'},
    })
    await open(localAuth, sent[0].url, ASSOCIATION_HOST)

    const refused = await open(localAuth, sent[1].platformUrl, PLATFORM_HOST)

    expect(refused.status).toBe(500)
    expect(memoryDb.user[0].email).toBe(EMAIL)
  })

  /** Un membre de A, adresse non verifiee, qui demande le lien sur A. */
  const verificationRequested = async () => {
    const auth = createLocalAuth()
    await auth.localAuth.api.signUpEmail({
      headers: new Headers({host: ASSOCIATION_HOST}),
      body: {email: EMAIL, password: PASSWORD, name: 'Membre'},
    })
    await auth.localAuth.handler(
      new Request(`${ASSOCIATION_ORIGIN}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: {
          host: ASSOCIATION_HOST,
          origin: ASSOCIATION_ORIGIN,
          'content-type': 'application/json',
        },
        body: JSON.stringify({email: EMAIL}),
      })
    )
    return auth
  }

  it('vérification d’email par HTTP : Better Auth passe la Request, le lien ouvre la session sur l’association', async () => {
    const {localAuth, memoryDb, sent} = await verificationRequested()

    expect(sent).toHaveLength(1)
    expect(sent[0].request?.headers.get('host')).toBe(ASSOCIATION_HOST)
    expect(new URL(sent[0].url).origin).toBe(ASSOCIATION_ORIGIN)

    const verified = await open(localAuth, sent[0].url, ASSOCIATION_HOST)

    expect(verified.status).toBe(302)
    expect(verified.headers.get('set-cookie')).toContain('session_token')
    expect(memoryDb.user[0].emailVerified).toBe(true)
  })

  it('vérification d’email sur l’hôte de la plateforme : adresse vérifiée puis erreur 500 (le défaut corrigé)', async () => {
    const {localAuth, memoryDb, sent} = await verificationRequested()

    const refused = await open(localAuth, sent[0].platformUrl, PLATFORM_HOST)

    expect(refused.status).toBe(500)
    expect(memoryDb.user[0].emailVerified).toBe(true)
  })
})
