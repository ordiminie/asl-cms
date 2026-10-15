import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
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
