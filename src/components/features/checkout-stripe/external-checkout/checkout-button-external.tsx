'use client'

import {useTranslations} from 'next-intl'
import React, {useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'

import {createCheckoutSession} from './actions'

type CheckoutButtonProps = {
  priceId: string
  variant?: 'default' | 'secondary' | 'outline'
  seats: number
  guest?: boolean
}

export default function CheckoutButtonExternal({
  priceId,
  variant = 'default',
  seats = 1,
  guest = false,
}: CheckoutButtonProps) {
  const t = useTranslations('Checkout.errors')
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    setIsLoading(true)

    try {
      const result = await createCheckoutSession(priceId, seats, guest)

      if (!result.success) {
        throw new Error(result.error)
      }

      window.location.href = result.url ?? '' // Redirect to the checkout session
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('title'), {
        description: error instanceof Error ? error.message : t('generic'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCheckout}
      disabled={isLoading}
      variant={variant}
      className="w-full rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black transition-colors hover:bg-yellow-500 disabled:opacity-50"
    >
      {isLoading
        ? 'Processing...'
        : guest
          ? 'Guest Checkout'
          : 'Checkout Session'}
    </Button>
  )
}
