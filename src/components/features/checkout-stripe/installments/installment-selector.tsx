'use client'

import {Calendar, CreditCard} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'

import {
  calculateInstallmentAmount,
  InstallmentPlans,
  InstallmentType,
} from './types'

interface InstallmentSelectorProps {
  totalAmount: number
  currency: string
  onInstallmentTypeChange: (installmentType: InstallmentType) => void
  selectedInstallmentType: InstallmentType
  isRecurring?: boolean
}

export default function InstallmentSelector({
  totalAmount,
  currency,
  onInstallmentTypeChange,
  selectedInstallmentType,
  isRecurring = false,
}: InstallmentSelectorProps) {
  const t = useTranslations('Checkout.installments')
  const locale = useLocale()
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100) // Convertir les centimes en euros
  }

  // Ne pas afficher les options d'échéancier pour les abonnements récurrents
  const availableOptions = isRecurring
    ? [InstallmentType.FULL_PAYMENT]
    : Object.values(InstallmentType)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>{t('selectorTitle')}</CardTitle>
        </div>
        <CardDescription>
          {isRecurring ? t('recurringNotice') : t('selectorDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedInstallmentType}
          onValueChange={(value) =>
            onInstallmentTypeChange(value as InstallmentType)
          }
          className="space-y-3"
        >
          {availableOptions.map((installmentType) => {
            const plan = InstallmentPlans[installmentType]
            const isSelected = selectedInstallmentType === installmentType

            let paymentDetails = ''
            let savingsText = ''

            if (installmentType === InstallmentType.FULL_PAYMENT) {
              paymentDetails = formatCurrency(totalAmount)
              savingsText = t('noExtraFees')
            } else {
              const {installmentAmount} = calculateInstallmentAmount(
                totalAmount,
                plan.numberOfPayments
              )
              paymentDetails = `${plan.numberOfPayments} × ${formatCurrency(installmentAmount)}`
              savingsText = t('firstPaymentToday')
            }

            return (
              <div
                key={installmentType}
                className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <RadioGroupItem value={installmentType} id={installmentType} />
                <Label
                  htmlFor={installmentType}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{plan.description}</span>
                        {installmentType === InstallmentType.FULL_PAYMENT && (
                          <Badge variant="secondary" className="text-xs">
                            {t('recommended')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {savingsText}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{paymentDetails}</div>
                      {installmentType !== InstallmentType.FULL_PAYMENT && (
                        <div className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          {t('monthly')}
                        </div>
                      )}
                    </div>
                  </div>
                </Label>
              </div>
            )
          })}
        </RadioGroup>

        {selectedInstallmentType !== InstallmentType.FULL_PAYMENT && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <div className="mb-1 font-medium">{t('schedule')}</div>
              <ul className="space-y-1">
                {Array.from({
                  length:
                    InstallmentPlans[selectedInstallmentType].numberOfPayments,
                }).map((_, index) => {
                  const {installmentAmount, lastPaymentAmount} =
                    calculateInstallmentAmount(
                      totalAmount,
                      InstallmentPlans[selectedInstallmentType].numberOfPayments
                    )
                  const isLastPayment =
                    index ===
                    InstallmentPlans[selectedInstallmentType].numberOfPayments -
                      1
                  const amount = isLastPayment
                    ? lastPaymentAmount
                    : installmentAmount

                  const paymentDate = new Date()
                  paymentDate.setMonth(paymentDate.getMonth() + index)

                  return (
                    <li key={index} className="flex justify-between">
                      <span>
                        Paiement {index + 1} -{' '}
                        {paymentDate.toLocaleDateString(locale, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(amount)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        <div className="text-muted-foreground mt-4 text-xs">
          💳 Tous les paiements sont sécurisés par Stripe
        </div>
      </CardContent>
    </Card>
  )
}

// Fonction utilitaire pour calculer les montants d'échéancier
