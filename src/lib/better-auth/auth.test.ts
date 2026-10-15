import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('@/db/models/db', () => ({default: {}}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
  getUserByStripeCustomerIdDao: vi.fn(),
}))
vi.mock('@/lib/stripe/stripe-client', () => ({stripeClient: {}}))
vi.mock('@/lib/stripe/stripe-events', () => ({onStripeEvent: vi.fn()}))
vi.mock('@/services/facades/email-service-facade', () => ({
  sendInternalEmailService: vi.fn(),
  sendOrganizationInvitationService: vi.fn(),
}))
vi.mock('@/services/facades/notification-service-facade', () => ({
  createTypedNotificationService: vi.fn(),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
  getOrganizationMembersService: vi.fn(),
}))
vi.mock('@/services/facades/subscription-service-facade', () => ({
  getActivePlansForBetterAuthService: vi.fn(),
}))
vi.mock('@/services/facades/user-service-facade', () => ({
  initializeRegisterUserDataService: vi.fn(),
}))

import {headers} from 'next/headers'

import {createTypedNotificationService} from '@/services/facades/notification-service-facade'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {ASSOCIATION_SESSION_GUARD_ID} from './association-session-guard'
import {auth} from './auth'

const pluginIds = () =>
  (auth.options.plugins ?? []).map((plugin: {id: string}) => plugin.id)

describe('configuration de Better Auth', () => {
  it('place le contrôle d’association en tête des plugins, avant admin() (ADR 034)', () => {
    const ids = pluginIds()

    expect(ids[0]).toBe(ASSOCIATION_SESSION_GUARD_ID)
    expect(ids.indexOf(ASSOCIATION_SESSION_GUARD_ID)).toBeLessThan(
      ids.indexOf('admin')
    )
  })
})

describe('inscription fermée (s46b, décision I)', () => {
  it('refuse la création de compte par mot de passe', () => {
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true)
  })

  it('refuse la création de compte par Google, gardé configuré', () => {
    expect(auth.options.socialProviders?.google?.disableSignUp).toBe(true)
  })
})

describe('liens de vérification d’email sur le domaine de l’association (revue M2)', () => {
  const association = {id: 'org-a', domain: 'asso-a.test'} as Organization
  const user = {id: 'user-1', email: 'membre@exemple.test'} as never
  const platformLink =
    'http://localhost:3000/api/auth/verify-email?token=jeton&callbackURL=%2Faccount'

  const notifiedUrl = () =>
    (
      vi.mocked(createTypedNotificationService).mock.calls[0][0].metadata as {
        url?: string
      }
    ).url

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) =>
        domain === association.domain ? association : undefined
    )
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'asso-a.test'}) as never
    )
  })

  it('vérification d’email : le lien notifié ouvre la session sur l’association', async () => {
    const send = auth.options.emailVerification?.sendVerificationEmail

    await send?.(
      {user, url: platformLink, token: 'jeton'},
      new Request('http://interne/api/auth/verify-email', {
        headers: {host: 'asso-a.test'},
      })
    )

    expect(notifiedUrl()).toBe(
      'http://asso-a.test:3000/api/auth/verify-email?token=jeton&callbackURL=http%3A%2F%2Fasso-a.test%3A3000%2Faccount'
    )
  })

  it('changement d’adresse depuis une Server Action : lien sur l’association', async () => {
    const send = auth.options.user?.changeEmail?.sendChangeEmailConfirmation

    await send?.(
      {
        user,
        newEmail: 'nouvelle@exemple.test',
        url: platformLink,
        token: 'jeton',
      },
      undefined
    )

    expect(new URL(String(notifiedUrl())).origin).toBe(
      'http://asso-a.test:3000'
    )
  })
})

describe('lien de réinitialisation du mot de passe sur le domaine de l’association (revue M1′)', () => {
  const association = {id: 'org-a', domain: 'asso-a.test'} as Organization
  const user = {id: 'user-1', email: 'membre@exemple.test'} as never
  const platformLink =
    'http://localhost:3000/api/auth/reset-password/jeton?callbackURL=%2Freset-password'

  const notifiedUrl = () =>
    (
      vi.mocked(createTypedNotificationService).mock.calls[0][0].metadata as {
        url?: string
      }
    ).url

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) =>
        domain === association.domain ? association : undefined
    )
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'asso-a.test'}) as never
    )
  })

  it('demande par HTTP : le lien notifié et son retour sont sur l’association', async () => {
    const send = auth.options.emailAndPassword?.sendResetPassword

    await send?.(
      {user, url: platformLink, token: 'jeton'},
      new Request('http://interne/api/auth/request-password-reset', {
        headers: {host: 'asso-a.test'},
      })
    )

    expect(notifiedUrl()).toBe(
      'http://asso-a.test:3000/api/auth/reset-password/jeton?callbackURL=http%3A%2F%2Fasso-a.test%3A3000%2Freset-password'
    )
  })

  it('appel direct sans Request : lien sur l’association lue dans les en-têtes Next', async () => {
    const send = auth.options.emailAndPassword?.sendResetPassword

    await send?.({user, url: platformLink, token: 'jeton'}, undefined)

    expect(new URL(String(notifiedUrl())).origin).toBe(
      'http://asso-a.test:3000'
    )
  })
})
