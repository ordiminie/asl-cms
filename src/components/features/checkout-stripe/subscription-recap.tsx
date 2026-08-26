'use client'

import {Package2Icon} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'

import {Card} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'

interface SubscriptionRecapProps {
  planName?: string
  price?: number
  originalPrice?: number
  discount?: number
  features?: string[]
  description?: string
  currency?: string
}

export default function SubscriptionRecap({
  planName = 'Pro Bundle',
  price = 197,
  originalPrice = 400,
  discount = 203,
  features = [
    'Introduction Course / Components',
    'PRO: Complete Email Integration Guide',
    'PRO: All CodeMail.io Features Access',
    'PRO: Code Review Sessions',
  ],
  currency = 'eur',
}: SubscriptionRecapProps) {
  const t = useTranslations('Checkout.recap')
  const locale = useLocale()
  // Fonction utilitaire pour formater la devise
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  return (
    <Card className="bg-card text-foreground w-full border-0 sm:border">
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="bg-muted rounded-lg p-2">
            <Package2Icon className="h-6 w-6 text-yellow-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold sm:text-xl">
              {planName}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('lifetimeAccess')}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="sm:hidden">
          <ScrollArea className="h-[150px] pr-2">
            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="hidden sm:block">
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <p className="text-muted-foreground">{feature}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Price Breakdown */}
        <div className="border-border space-y-3 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm sm:text-base">
              {t('subtotal')}
            </span>
            <span className="text-foreground text-sm sm:text-base">
              {formatCurrency(originalPrice)}
            </span>
          </div>
          <div className="flex justify-between text-yellow-400">
            <span className="text-sm sm:text-base">{t('discount')}</span>
            <span className="text-sm sm:text-base">
              -{formatCurrency(discount)}
            </span>
          </div>
          <div className="border-border flex justify-between border-t pt-2 text-lg font-bold">
            <span>{t('total')}</span>
            <span>{formatCurrency(price)}</span>
          </div>
        </div>

        {/* Payment Options */}
        <div className="text-muted-foreground text-center text-xs sm:text-sm">
          {t('installmentsNotice')}
        </div>
      </div>
    </Card>
  )
}
