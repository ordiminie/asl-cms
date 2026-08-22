import Stripe from 'stripe'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/lib/stripe/stripe-client', () => ({
  stripeClient: {
    subscriptions: {retrieve: vi.fn()},
    customers: {create: vi.fn()},
  },
}))

vi.mock('@/services/facades/affiliate-service-facade', () => ({
  recordBountyForPaidInvoiceService: vi.fn(),
  refundBountyByPaymentIntentService: vi.fn(),
  attributeReferralForOrganizationService: vi.fn(),
}))

vi.mock('@/services/facades/credit-service-facade', () => ({
  allocateMonthlyCreditsService: vi.fn(),
  completeCreditPackPurchaseService: vi.fn(),
}))

vi.mock('@/services/facades/subscription-service-facade', () => ({
  createSubscriptionFromStripeService: vi.fn(),
  getBillingContext: vi.fn(),
  getPlanByCodeService: vi.fn(),
  getSubscriptionByUserIdService: vi.fn(),
  updateSubscriptionForWebhookService: vi.fn(),
}))

vi.mock('@/services/facades/user-service-facade', () => ({
  createUserFromStripeService: vi.fn(),
}))

vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))

import {stripeClient} from '@/lib/stripe/stripe-client'
import {onStripeEvent} from '@/lib/stripe/stripe-events'
import {
  recordBountyForPaidInvoiceService,
  refundBountyByPaymentIntentService,
} from '@/services/facades/affiliate-service-facade'

const organizationId = 'd6a3f0e4-1111-4a2b-9c3d-000000000001'

const buildInvoiceEvent = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'evt_1',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_ABC',
        amount_paid: 2900,
        subscription: 'sub_123',
        payments: {
          data: [{payment: {payment_intent: 'pi_123'}}],
        },
        ...overrides,
      },
    },
  }) as unknown as Stripe.Event

const buildChargeRefundedEvent = (paymentIntent: unknown = 'pi_123') =>
  ({
    id: 'evt_2',
    type: 'charge.refunded',
    data: {object: {id: 'ch_1', payment_intent: paymentIntent}},
  }) as unknown as Stripe.Event

const buildDisputeEvent = (paymentIntent: unknown = 'pi_123') =>
  ({
    id: 'evt_3',
    type: 'charge.dispute.created',
    data: {object: {id: 'dp_1', payment_intent: paymentIntent}},
  }) as unknown as Stripe.Event

describe('Webhook Stripe : primes d affiliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stripeClient.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      metadata: {referenceId: organizationId, plan: 'pro'},
    } as never)
    vi.mocked(recordBountyForPaidInvoiceService).mockResolvedValue({
      created: true,
    })
    vi.mocked(refundBountyByPaymentIntentService).mockResolvedValue(1)
  })

  it('enregistre la prime sur une facture réellement encaissée', async () => {
    await onStripeEvent(buildInvoiceEvent())

    expect(recordBountyForPaidInvoiceService).toHaveBeenCalledWith({
      organizationId,
      planCode: 'pro',
      sourceId: 'in_ABC',
      amountPaidCents: 2900,
      stripeSubscriptionId: 'sub_123',
      stripePaymentIntentId: 'pi_123',
    })
  })

  it('n enregistre AUCUNE prime sur une facture à zéro (essai gratuit)', async () => {
    await onStripeEvent(buildInvoiceEvent({amount_paid: 0}))

    expect(recordBountyForPaidInvoiceService).not.toHaveBeenCalled()
  })

  it('ignore une facture sans abonnement', async () => {
    await onStripeEvent(buildInvoiceEvent({subscription: undefined}))

    expect(recordBountyForPaidInvoiceService).not.toHaveBeenCalled()
  })

  it('ignore une facture dont les metadata sont incomplètes', async () => {
    vi.mocked(stripeClient.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      metadata: {},
    } as never)

    await onStripeEvent(buildInvoiceEvent())

    expect(recordBountyForPaidInvoiceService).not.toHaveBeenCalled()
  })

  it('annule la prime sur un remboursement', async () => {
    await onStripeEvent(buildChargeRefundedEvent())

    expect(refundBountyByPaymentIntentService).toHaveBeenCalledWith(
      'pi_123',
      'stripe_refund:ch_1'
    )
  })

  it('annule la prime sur un litige', async () => {
    await onStripeEvent(buildDisputeEvent())

    expect(refundBountyByPaymentIntentService).toHaveBeenCalledWith(
      'pi_123',
      'stripe_dispute:dp_1'
    )
  })

  it('accepte un payment intent expansé plutôt qu un identifiant', async () => {
    await onStripeEvent(buildChargeRefundedEvent({id: 'pi_456'}))

    expect(refundBountyByPaymentIntentService).toHaveBeenCalledWith(
      'pi_456',
      'stripe_refund:ch_1'
    )
  })

  it('ne fait rien si le paiement est absent', async () => {
    await onStripeEvent(buildChargeRefundedEvent(null))

    expect(refundBountyByPaymentIntentService).not.toHaveBeenCalled()
  })

  it('n interrompt pas le webhook si la prime échoue', async () => {
    vi.mocked(recordBountyForPaidInvoiceService).mockRejectedValue(
      new Error('boom')
    )

    await expect(onStripeEvent(buildInvoiceEvent())).resolves.toBeUndefined()
  })
})
