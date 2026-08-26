import {getTranslations} from 'next-intl/server'
import React from 'react'

import {
  getSubscriptionRecapInfo,
  PriceRecap,
} from '@/components/features/checkout-stripe/actions'
import CheckoutFormEmbedded from '@/components/features/checkout-stripe/embed/checkout-form-embedded'
import {Card} from '@/components/ui/card'
import {env} from '@/env'
import {StripeCheckoutConst} from '@/lib/stripe/stripe-types'

import CheckoutButtonExternal from './external-checkout/checkout-button-external'
import CheckoutInstallment from './installments/checkout-installment'
import CheckoutPaymentLink from './payment-link/checkout-payment-link'
import CheckoutButtonReactStripe from './react-stripe/checkout-button-react-stripe'
import SubscriptionRecap from './subscription-recap'

export default async function CheckoutPage({
  priceId,
  couponId,
  seats = 1,
  guest = false,
  enableInstallments = false,
}: {
  priceId: string
  couponId: string
  seats: number
  guest: boolean
  enableInstallments?: boolean
}) {
  const t = await getTranslations('Checkout.page')
  let recapInfo
  try {
    recapInfo = await getSubscriptionRecapInfo(priceId, couponId, seats)
  } catch (error) {
    console.error('Error getting stripe subscription recap:', error)
    recapInfo = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }

  const isRecurring = recapInfo.success
    ? recapInfo.recap?.interval !== undefined &&
      recapInfo.recap?.interval !== null
    : false

  // Configuration du checkout
  const checkoutConfig = getCheckoutConfig({
    enableInstallments,
    recapInfo,
    priceId,
    seats,
    guest,
    isRecurring,
    t,
  })

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-0 py-4 sm:px-2 md:px-4">
        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Left side - Subscription Recap */}
          <div className="lg:sticky lg:top-4">
            {recapInfo.success ? (
              <SubscriptionRecap
                planName={recapInfo.recap?.planName}
                price={recapInfo.recap?.price}
                originalPrice={recapInfo.recap?.originalPrice}
                discount={recapInfo.recap?.discount}
                features={recapInfo.recap?.features}
                currency={recapInfo.recap?.currency}
              />
            ) : (
              <div className="text-red-500">
                Error loading subscription details:
              </div>
            )}
            {recapInfo.warning && (
              <div className="text-red-500">Warning: {recapInfo.warning}</div>
            )}
          </div>

          {/* Right side - Checkout */}
          <Card className="bg-card text-foreground space-y-6 border-0 p-4 sm:border sm:p-6">
            <div>
              <h2 className="mb-1 text-xl font-bold">{t('title')}</h2>

              {/* Bannière test pour les installments */}
              {checkoutConfig.showTestBanner && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    🆕 <strong>{t('testBannerLabel')}</strong>{' '}
                    {t('testBannerText')}
                  </p>
                </div>
              )}

              {/* Message du checkout */}
              <p className="text-muted-foreground mb-4">
                {checkoutConfig.message}
              </p>

              {/* Composant de checkout */}
              <div className="mt-4">{checkoutConfig.component}</div>
            </div>

            <div className="text-muted-foreground text-center text-sm">
              {t('secureNotice')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

type CheckoutConfig = {
  component: React.ReactNode
  message: string
  showTestBanner?: boolean
}

type RecapInfo = {
  success: boolean
  recap?: {
    priceId?: string
    planName: string
    price: number
    originalPrice: number
    discount: number
    description: string | null
    features?: string[]
    currency: string
    interval?: string
    intervalCount?: number
    seats: number
    unitPrice: number
    unitOriginalPrice: number
    unitDiscount: number
  }
  warning?: string
  error?: string
}

function getCheckoutConfig({
  enableInstallments,
  recapInfo,
  priceId,
  seats,
  guest,
  isRecurring,
  t,
}: {
  enableInstallments: boolean
  recapInfo: RecapInfo
  priceId: string
  seats: number
  guest: boolean
  isRecurring: boolean
  t: (key: string) => string
}): CheckoutConfig {
  console.log('🔧 getCheckoutConfig', {
    enableInstallments,
    isRecurring,
    recapInfoSuccess: recapInfo.success,
    envStripeCheckoutType: env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE,
    guest,
    priceId,
    seats,
  })
  // Mode installments - prioritaire si activé
  if (enableInstallments && isRecurring) {
    console.warn(
      'Installments are not supported for recurring plans, please use embed checkout page instead'
    )
    return {
      component: <></>,
      message:
        'Installments (split payment) are not supported for recurring plans, please change price id',
    }
  }
  if (enableInstallments) {
    if (!recapInfo.success) {
      return {
        component: <></>,
        message: 'Error loading subscription details',
      }
    }
    return {
      component: (
        <CheckoutInstallment
          priceId={priceId}
          seats={seats}
          recap={recapInfo.recap as PriceRecap}
          isRecurring={isRecurring}
          guest={guest}
        />
      ),
      message: t('chooseMethod'),
      showTestBanner: true,
    }
  }

  // Switch case pour les différents types de checkout
  switch (env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE) {
    case StripeCheckoutConst.PAYMENT_LINK:
      if (guest) {
        return {
          component: (
            <CheckoutPaymentLink
              priceId={priceId}
              seats={seats}
              guest={guest}
            />
          ),
          message: t('clickButton'),
        }
      } else {
        return {
          component: (
            <div>
              <p>{t('paymentLinkGuestOnly')}</p>
              <p></p>
            </div>
          ),
          message: t('clickButton'),
        }
      }

    case StripeCheckoutConst.EMBEDED_FORM:
      return {
        component: (
          <CheckoutFormEmbedded priceId={priceId} seats={seats} guest={guest} />
        ),
        message: t('fillForm'),
      }

    case StripeCheckoutConst.REACT_STRIPE_FORM:
      return {
        component: (
          <CheckoutButtonReactStripe
            priceId={priceId}
            seats={seats}
            guest={guest}
          />
        ),
        message: t('clickButton'),
      }

    case StripeCheckoutConst.EXTERNAL_FORM:
      return {
        component: (
          <CheckoutButtonExternal
            priceId={priceId}
            seats={seats}
            guest={guest}
          />
        ),
        message: t('clickButton'),
      }

    default:
      return {
        component: (
          <div className="text-red-500">
            Type de checkout non supporté:{' '}
            {env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE}. Veuillez vérifier la
            configuration NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE.
          </div>
        ),
        message: 'Configuration de checkout non supportée',
      }
  }
}
