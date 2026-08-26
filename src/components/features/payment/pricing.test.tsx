import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import PricingPlans from './pricing'

const mocks = vi.hoisted(() => ({
  upgrade: vi.fn(async () => ({error: undefined})),
  cancel: vi.fn(async () => ({data: undefined, error: undefined})),
  restore: vi.fn(async () => ({error: undefined})),
  guestEnabled: false,
  session: {data: null} as {data: unknown},
}))

vi.mock('@/env', () => ({
  get env() {
    return {NEXT_PUBLIC_GUEST_CHECKOUT_ENABLED: mocks.guestEnabled}
  },
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => {
    const values: Record<string, string> = {
      'plans.free.name': 'Free',
      'plans.pro.name': 'Pro',
      'plans.enterprise.name': 'Enterprise',
      'plans.lifetime.name': 'Lifetime',
      'cta.getStarted': 'Get started',
      'cta.subscribe': 'Subscribe',
      'cta.buyLifetime': 'Buy lifetime',
      'actions.cancel': 'Cancel',
      'actions.canceling': 'Cancelling...',
      'actions.restoring': 'Restoring...',
      'actions.redirecting': 'Redirecting...',
      'actions.downgradeFree': 'Downgrade to free',
      'badge.current': 'Current plan',
      'badge.currentPlan': 'Current plan',
      'badge.mostPopular': 'Most popular',
    }
    const interpolated: Record<string, (value?: string) => string> = {
      'actions.switchTo': (plan) => `Switch to ${plan}`,
      'actions.update': () => 'Update',
      'actions.continuePlan': (plan) => `Keep ${plan}`,
      'actions.startingFrom': (date) => `Starting ${date}`,
      'badge.endingOn': (date) => `Ends on ${date}`,
    }
    const translate = (key: string, params?: {plan?: string; date?: string}) =>
      interpolated[key]?.(params?.plan ?? params?.date) ?? values[key] ?? key
    translate.raw = () => []
    return translate
  },
}))

vi.mock('@/lib/better-auth/auth-client', () => ({
  authClient: {
    useSession: () => mocks.session,
    subscription: {
      upgrade: mocks.upgrade,
      cancel: mocks.cancel,
      restore: mocks.restore,
    },
  },
}))

const recap = (price: number, priceId: string) => ({
  price,
  priceId,
  planName: 'plan',
  originalPrice: price,
  discount: 0,
  description: null,
  currency: 'eur',
  seats: 1,
  unitPrice: price,
  unitOriginalPrice: price,
  unitDiscount: 0,
})

const availablePlans = ['free', 'pro', 'enterprise', 'lifetime'].map((id) => ({
  id,
  name: id,
  price: 0,
  yearlyPrice: 0,
  priceDisplay: '€0',
  yearlyPriceDisplay: '€0',
  description: id,
  features: [],
  icon: null,
  color: 'bg-gray-500',
  popular: id === 'pro',
})) as never

const prices = {
  priceProMonthly: recap(19, 'price_pro_monthly'),
  priceProYearly: recap(190, 'price_pro_yearly'),
  priceEntrepriseMonthly: recap(200, 'price_enterprise_monthly'),
  priceEntrepriseYearly: recap(2000, 'price_enterprise_yearly'),
  priceLifetime: recap(70, 'price_lifetime'),
}

const renderPricing = (props: Record<string, unknown> = {}) =>
  render(
    <PricingPlans availablePlans={availablePlans} {...prices} {...props} />
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guestEnabled = false
  mocks.session = {data: null}
})

/**
 * Mode `custom` (/pricing_old) : le comportement historique ne bouge pas.
 * Tout le monde part sur le tunnel maison, connecté ou non.
 */
describe('PricingPlans custom checkout mode', () => {
  it('keeps every CTA on the in-house tunnel', () => {
    renderPricing({checkoutMode: 'custom'})

    expect(screen.getAllByRole('link', {name: 'Subscribe'})[0]).toHaveAttribute(
      'href',
      '/checkout/price_pro_monthly?guest=true&seats=1'
    )
    expect(mocks.upgrade).not.toHaveBeenCalled()
  })
})

/**
 * Mode `better-auth` : ce qui est vérifié ici, c'est le CONTRAT envoyé au
 * plugin — les trois paramètres dont chacun a déjà cassé la production.
 */
describe('PricingPlans better-auth checkout mode', () => {
  it('sends a signed-out visitor to register instead of a failing button', () => {
    renderPricing({checkoutMode: 'better-auth'})

    expect(screen.getAllByRole('link', {name: 'Subscribe'})[0]).toHaveAttribute(
      'href',
      '/register'
    )
    expect(mocks.upgrade).not.toHaveBeenCalled()
  })

  it('switches an existing plan with the STRIPE id, never the row id', async () => {
    const user = userEvent.setup()
    mocks.session = {data: {user: {id: 'user_1'}}}
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [
        {
          id: 'row-uuid-1',
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_123',
        },
      ],
    })

    await user.click(screen.getByRole('button', {name: 'Switch to Enterprise'}))

    expect(mocks.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'enterprise',
        subscriptionId: 'sub_123',
        referenceId: 'org_1',
        returnUrl: '/account/billing/subscription',
      })
    )
    // L'id de notre ligne lèverait SUBSCRIPTION_NOT_FOUND côté plugin.
    expect(mocks.upgrade).not.toHaveBeenCalledWith(
      expect.objectContaining({subscriptionId: 'row-uuid-1'})
    )
  })

  it('falls back to referenceId when the row has no stripe id', async () => {
    const user = userEvent.setup()
    mocks.session = {data: {user: {id: 'user_1'}}}
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [{id: 'row-uuid-1', plan: 'pro', status: 'active'}],
    })

    await user.click(screen.getByRole('button', {name: 'Switch to Enterprise'}))

    expect(mocks.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({referenceId: 'org_1'})
    )
    expect(mocks.upgrade).not.toHaveBeenCalledWith(
      expect.objectContaining({subscriptionId: expect.anything()})
    )
  })

  it('leaves the lifetime plan on the in-house tunnel', () => {
    mocks.session = {data: {user: {id: 'user_1'}}}
    renderPricing({checkoutMode: 'better-auth', referenceId: 'org_1'})

    // Paiement unique : le plugin ouvrirait un Checkout en mode subscription.
    expect(screen.getByRole('link', {name: 'Buy lifetime'})).toHaveAttribute(
      'href',
      '/checkout/price_lifetime?seats=1'
    )
  })
})

/**
 * L'écran reprend la machine à états de /account/billing/subscription : un
 * client déjà abonné ne doit jamais se voir proposer de racheter son offre.
 */
describe('PricingPlans subscriber actions', () => {
  beforeEach(() => {
    mocks.session = {data: {user: {id: 'user_1'}}}
  })

  it('offers cancelling on the current plan, never buying it again', async () => {
    const user = userEvent.setup()
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [
        {
          id: 'row-1',
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          referenceId: 'org_1',
        },
      ],
    })

    expect(screen.queryByRole('button', {name: 'Subscribe'})).toBeNull()
    await user.click(screen.getByRole('button', {name: 'Cancel'}))

    expect(mocks.cancel).toHaveBeenCalledWith(
      expect.objectContaining({referenceId: 'org_1'})
    )
    expect(mocks.upgrade).not.toHaveBeenCalled()
  })

  /**
   * Le coeur du correctif : Stripe ne bascule plus `cancel_at_period_end`, il
   * pose une DATE `cancel_at`. Sans ce test, la regression revient sans bruit.
   */
  it('offers restoring when only cancelAt is set', async () => {
    const user = userEvent.setup()
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [
        {
          id: 'row-1',
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          cancelAt: '2026-09-30T00:00:00.000Z',
        },
      ],
    })

    await user.click(screen.getByRole('button', {name: 'Keep Pro'}))

    expect(mocks.restore).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub_123',
        referenceId: 'org_1',
      })
    )
    expect(mocks.cancel).not.toHaveBeenCalled()
  })

  it('treats a cycle switch on the current plan as an update', async () => {
    const user = userEvent.setup()
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [
        {
          id: 'row-1',
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          billingInterval: 'month',
        },
      ],
    })

    // Sans ce cas, le client mensuel ne voit que « Annuler » sur son offre et
    // n'a aucun moyen de passer a l'annuel.
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', {name: 'Update'}))

    expect(mocks.upgrade).toHaveBeenCalledWith(
      expect.objectContaining({plan: 'pro', annual: true})
    )
  })

  it('announces the end date on the plan that is terminating', () => {
    renderPricing({
      checkoutMode: 'better-auth',
      referenceId: 'org_1',
      subscriptions: [
        {
          id: 'row-1',
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          cancelAt: '2026-09-30T00:00:00.000Z',
          periodEnd: '2026-10-31T00:00:00.000Z',
        },
      ],
    })

    // `cancelAt` prime sur `periodEnd` : c'est la date qui fait foi.
    expect(screen.getByText('Ends on 30/09/2026')).toBeInTheDocument()
  })
})

/**
 * Mode invité : un seul point de branchement dans tout le produit. Ces deux
 * tests sont le garde-fou du « si ça me saoule, je le désactive ».
 */
describe('PricingPlans guest checkout flag', () => {
  it('sends the visitor to register when the flag is off', () => {
    mocks.guestEnabled = false
    renderPricing({checkoutMode: 'better-auth'})

    expect(screen.getAllByRole('link', {name: 'Subscribe'})[0]).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('opens the guest checkout when the flag is on', () => {
    mocks.guestEnabled = true
    renderPricing({checkoutMode: 'better-auth'})

    expect(screen.getAllByRole('link', {name: 'Subscribe'})[0]).toHaveAttribute(
      'href',
      '/checkout/price_pro_monthly?guest=true&seats=1'
    )
  })
})
