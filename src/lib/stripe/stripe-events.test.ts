import type Stripe from 'stripe'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  logger: {debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn()},
}))
vi.mock('@/db/repositories/user-repository', () => ({
  createUserDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
}))
vi.mock('@/services/facades/subscription-service-facade', () => ({
  createSubscriptionFromStripeService: vi.fn(),
}))
vi.mock('@/lib/better-auth/auth', () => ({
  auth: {api: {createUser: vi.fn(), signInMagicLink: vi.fn()}},
}))
vi.mock('./stripe-client', () => ({
  stripeClient: {customers: {create: vi.fn()}},
}))

import {
  createUserDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'
import {auth} from '@/lib/better-auth/auth'
import {logger} from '@/lib/logger'
import {createSubscriptionFromStripeService} from '@/services/facades/subscription-service-facade'

import {stripeClient} from './stripe-client'
import {onStripeEvent} from './stripe-events'

const UNKNOWN_EMAIL = 'inconnu@exemple.test'

const checkoutCompleted = (
  metadata: Record<string, string>,
  session: Partial<Stripe.Checkout.Session> = {}
) =>
  ({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        customer: null,
        customer_details: {email: UNKNOWN_EMAIL, name: 'Inconnu'},
        subscription: 'sub_stripe_1',
        metadata,
        ...session,
      },
    },
  }) as unknown as Stripe.Event

const expectNoAccountCreated = () => {
  expect(createUserDao).not.toHaveBeenCalled()
  expect(auth.api.createUser).not.toHaveBeenCalled()
  expect(stripeClient.customers.create).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
})

describe('onStripeEvent — aucun compte créé par le webhook (s46b, décision K)', () => {
  it.each([
    ['invité', {referenceId: 'guest'}],
    ['invité par drapeau', {guest_checkout: 'true'}],
    ['connecté', {referenceId: 'user-1'}],
  ])(
    'un checkout maison %s ne crée aucun utilisateur et ne lève pas',
    async (_, extra) => {
      const event = checkoutCompleted({
        source: 'custom_checkout',
        subscriptionId: 'sub-uuid-1',
        customerEmail: UNKNOWN_EMAIL,
        ...extra,
      })

      await expect(onStripeEvent(event)).resolves.toBeUndefined()

      expectNoAccountCreated()
    }
  )

  it('un paiement en plusieurs fois invité pour une adresse inconnue échoue sur « non trouvé », sans créer de compte', async () => {
    const event = checkoutCompleted({
      source: 'installment_checkout',
      referenceId: 'guest',
      customerEmail: UNKNOWN_EMAIL,
      plan: 'pro',
      seats: '1',
      number_of_payments: '3',
      schedule_id: 'sch_1',
    })

    await onStripeEvent(event)

    expectNoAccountCreated()
    expect(createSubscriptionFromStripeService).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: expect.stringContaining('non trouvé'),
      })
    )
  })

  it('un paiement en plusieurs fois d’un compte existant crée l’abonnement comme avant', async () => {
    vi.mocked(getUserByEmailDao).mockResolvedValue({
      id: 'user-1',
      email: 'membre@exemple.test',
      stripeCustomerId: 'cus_1',
    } as never)
    const event = checkoutCompleted(
      {
        source: 'installment_checkout',
        referenceId: 'user-1',
        customerEmail: 'membre@exemple.test',
        plan: 'pro',
        seats: '2',
        number_of_payments: '3',
        schedule_id: 'sch_1',
      },
      {customer: 'cus_1'}
    )

    await onStripeEvent(event)

    expectNoAccountCreated()
    expect(createSubscriptionFromStripeService).toHaveBeenCalledWith(
      'membre@exemple.test',
      'pro',
      false,
      'sub_stripe_1',
      'cus_1',
      2,
      expect.any(Date)
    )
  })
})
