'use client'

import {useRouter} from 'next/navigation'
import {useTransition} from 'react'

import {purchaseCreditPackAction} from '@/app/[locale]/(app)/account/billing/credit/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {CreditPackConfig} from '@/services/types/domain/credit-types'

interface CreditPackCardProps {
  pack: CreditPackConfig
  organizationId: string
}

export function CreditPackCard({pack, organizationId}: CreditPackCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handlePurchase = () => {
    startTransition(async () => {
      const result = await purchaseCreditPackAction(organizationId, pack.id)

      if (result.success && result.data?.checkoutUrl) {
        router.push(result.data.checkoutUrl)
      }
    })
  }

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(priceInCents / 100)
  }

  const isConfigured = Boolean(pack.stripePriceId)

  return (
    <Card className={`relative ${pack.popular ? 'border-primary' : ''}`}>
      {pack.popular && (
        <Badge className="absolute -top-2 right-4" variant="default">
          Populaire
        </Badge>
      )}
      <CardHeader>
        <CardTitle>{pack.name}</CardTitle>
        <CardDescription>
          {formatPrice(pack.price)} ({formatPrice(pack.pricePerCredit)}/crédit)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <span className="text-4xl font-bold">{pack.credits}</span>
          <span className="text-muted-foreground ml-2">crédits</span>
        </div>
        {pack.expiresInDays && (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Expire dans {pack.expiresInDays} jours
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handlePurchase}
          disabled={isPending || !isConfigured}
          variant={pack.popular ? 'default' : 'outline'}
        >
          {isPending
            ? 'Redirection...'
            : isConfigured
              ? 'Acheter'
              : 'Bientôt disponible'}
        </Button>
      </CardFooter>
    </Card>
  )
}
