'use client'

import {CheckCircle2} from 'lucide-react'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

import {confirmSubscription} from '@/components/features/checkout-stripe/react-stripe/actions'
import {Button} from '@/components/ui/button'

export default function SuccessPage() {
  const t = useTranslations('Checkout.success')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  )
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()

  // Gestion des différents types de paiement
  const paymentIntent = searchParams.get('payment_intent')
  const setupIntent = searchParams.get('setup_intent')
  const redirectStatus = searchParams.get('redirect_status')

  useEffect(() => {
    const handlePaymentVerification = async () => {
      if (redirectStatus === 'succeeded') {
        // Si c'est un setup intent (abonnement), finaliser l'abonnement
        if (setupIntent) {
          try {
            setMessage(t('creatingSubscription'))
            const result = await confirmSubscription(setupIntent)

            if (result.success) {
              setStatus('success')
              setMessage(t('subscriptionCreated'))
            } else {
              setStatus('error')
              setMessage(result.error || t('subscriptionError'))
            }
          } catch {
            setStatus('error')
            setMessage(t('unexpectedError'))
          }
        } else {
          // Paiement unique classique
          setStatus('success')
          setMessage(t('paymentProcessed'))
        }
      } else {
        setStatus('error')
        setMessage(t('paymentCancelled'))
      }
    }

    handlePaymentVerification()
  }, [redirectStatus, setupIntent, t])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-yellow-400">⚪</div>
          <p className="mt-2 text-zinc-400">{message || t('verifying')}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-red-500">❌</div>
          <h1 className="mt-4 text-2xl font-bold">{t('failureTitle')}</h1>
          <p className="mt-2 text-zinc-400">{message || t('verifying')}</p>
          <Button asChild className="mt-4">
            <Link href="/pricing">{t('retry')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-white">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {setupIntent ? t('subscriptionTitle') : t('paymentTitle')}
        </h1>
        <p className="mt-2 text-zinc-400">{message || t('verifying')}</p>

        {(paymentIntent || setupIntent) && (
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-400">
              {setupIntent ? t('setupIntentId') : t('paymentId')}
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-300">
              {setupIntent || paymentIntent}
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link href="/dashboard">{t('goToDashboard')}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{t('returnHome')}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
