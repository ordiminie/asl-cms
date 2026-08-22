'use client'

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import {loadStripe, Stripe} from '@stripe/stripe-js'
import {useTranslations} from 'next-intl'
import React, {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {env} from '@/env'

import {createCheckoutSession} from './actions'

type CheckoutButtonProps = {
  priceId: string
  variant?: 'default' | 'secondary' | 'outline'
  seats: number
  guest?: boolean
}
//Numéro : 4242 4242 4242 4242
// Composant pour le formulaire de configuration du mode de paiement
function CheckoutForm() {
  const t = useTranslations('Checkout.reactStripe')
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    const {error} = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
    })

    if (error) {
      toast.error(t('setupFailed'), {
        description:
          error instanceof Error ? error.message : t('setupFailedDescription'),
      })
    }

    setIsProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="mt-4 w-full"
      >
        {isProcessing ? t('processing') : t('submit')}
      </Button>
    </form>
  )
}

export default function CheckoutButtonReactStripe({
  priceId,
  variant = 'default',
  seats = 1,
  guest = false,
}: CheckoutButtonProps) {
  const t = useTranslations('Checkout.reactStripe')
  const tCommon = useTranslations('Common')
  const [isLoading, setIsLoading] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)

  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [clientSecret, setClientSecret] = useState('')

  useEffect(() => {
    // eslint-disable-next-line promise/catch-or-return
    loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string).then(setStripe)
  }, [])

  const handleInitialClick = () => {
    if (guest) {
      setShowEmailForm(true)
    } else {
      handleCheckout()
    }
  }

  const handleGuestEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestEmail.trim()) {
      toast.error(t('emailRequired'), {
        description: t('emailRequiredDescription'),
      })
      return
    }

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(guestEmail)) {
      toast.error(t('emailInvalid'), {
        description: t('emailInvalidDescription'),
      })
      return
    }

    handleCheckout(guestEmail)
  }

  const handleCheckout = async (email?: string) => {
    setIsLoading(true)
    try {
      const result = await createCheckoutSession(priceId, seats, guest, email)
      if (!result.success) throw new Error(result.error)
      setClientSecret(result.clientSecret || '')
      if (guest) setShowEmailForm(false)
    } catch (error) {
      console.error("Erreur lors de la création de l'abonnement:", error)
      toast.error(t('subscriptionError'), {
        description:
          error instanceof Error ? error.message : t('subscriptionError'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Formulaire d'email pour les guests
  if (guest && showEmailForm && !clientSecret) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{t('guestIntro')}</div>
        <form onSubmit={handleGuestEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium">
              {t('emailLabel')}
            </label>
            <input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLoading}
              variant={variant}
              className="flex-1 rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black transition-colors hover:bg-yellow-500 disabled:opacity-50"
            >
              {isLoading ? t('creating') : t('continueLabel')}
            </Button>
            <Button
              type="button"
              onClick={() => setShowEmailForm(false)}
              variant="outline"
              className="px-4 py-2.5"
            >
              {tCommon('actions.cancel')}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      <Button
        onClick={handleInitialClick}
        disabled={isLoading}
        variant={variant}
        className='disabled:opacity-50" w-full rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black transition-colors hover:bg-yellow-500'
      >
        {isLoading
          ? t('creatingSubscription')
          : guest
            ? t('subscribeGuest')
            : t('subscribeStripe')}
      </Button>

      {clientSecret && stripe && (
        <Elements stripe={stripe} options={{clientSecret}}>
          <div className="mt-4">
            <CheckoutForm />
          </div>
        </Elements>
      )}
    </div>
  )
}
