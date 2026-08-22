'use client'

import {CreditCard} from 'lucide-react'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {PriceRecap} from '../actions'
import CheckoutFormEmbedded from '../embed/checkout-form-embedded'
import {createInstallmentCheckoutSession} from './action'
import InstallmentSelector from './installment-selector'
import {InstallmentType} from './types'

interface CheckoutInstallmentProps {
  priceId: string
  seats: number
  recap: PriceRecap
  isRecurring: boolean
  guest?: boolean
}

export default function CheckoutInstallment({
  priceId,
  seats,
  recap,
  isRecurring,
  guest = false,
}: CheckoutInstallmentProps) {
  const [selectedInstallmentType, setSelectedInstallmentType] =
    useState<InstallmentType>(InstallmentType.FULL_PAYMENT)
  const t = useTranslations('Checkout.installments')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleInstallmentCheckout = async () => {
    if (selectedInstallmentType === InstallmentType.FULL_PAYMENT) {
      // Ne rien faire, le checkout classique gérera
      return
    }

    try {
      setIsProcessing(true)

      const result = await createInstallmentCheckoutSession(
        priceId,
        selectedInstallmentType,
        seats,
        guest
      )

      if (result.success && result.sessionUrl) {
        toast.success(t('redirecting'))
        // Rediriger vers la session Stripe
        window.location.href = result.sessionUrl
      } else {
        toast.error(result.error || t('sessionError'))
      }
    } catch (error) {
      console.error('Erreur checkout échéancier:', error)
      toast.error(t('unexpectedError'))
    } finally {
      setIsProcessing(false)
    }
  }
  if (isRecurring) {
    console.warn(
      'split payment is not supported for recurring plans, please use embed checkout page instead'
    )
  }
  return (
    <div className="space-y-6">
      {/* Sélecteur d'échéanciers - uniquement pour les paiements uniques */}
      {!isRecurring && (
        <InstallmentSelector
          totalAmount={recap.price * 100} // Convertir en centimes
          currency={recap.currency}
          onInstallmentTypeChange={setSelectedInstallmentType}
          selectedInstallmentType={selectedInstallmentType}
          isRecurring={isRecurring}
        />
      )}

      {/* Formulaire de checkout */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>
            {selectedInstallmentType === InstallmentType.FULL_PAYMENT
              ? t('securedByStripe')
              : t('splitPaymentDescription', {
                  plan: selectedInstallmentType.replace('_', ' ').toLowerCase(),
                })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedInstallmentType === InstallmentType.FULL_PAYMENT ? (
            // Checkout classique pour paiement unique
            <CheckoutFormEmbedded
              priceId={priceId}
              seats={seats}
              guest={guest}
            />
          ) : (
            // Bouton pour démarrer le processus d'échéanciers
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  🔄 <strong>{t('noticeTitle')}</strong>
                  <br />
                  {t('noticeText')}
                </p>
              </div>

              <Button
                onClick={handleInstallmentCheckout}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing
                  ? t('preparing')
                  : guest
                    ? t('payGuest', {
                        count: selectedInstallmentType.split('_')[0],
                      })
                    : t('payStart', {
                        count: selectedInstallmentType.split('_')[0],
                      })}
              </Button>

              <p className="text-muted-foreground text-center text-xs">
                En cliquant, vous acceptez que vos prochains paiements soient
                automatiquement débités selon l&apos;échéancier choisi.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {isRecurring && (
        <Card className="bg-blue-50 p-4 dark:bg-blue-950/20">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">📅 Abonnement récurrent</p>
            <p>
              Ce plan sera renouvelé automatiquement chaque{' '}
              {recap.interval === 'year' ? 'année' : 'mois'}.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
