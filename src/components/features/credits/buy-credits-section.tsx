'use client'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {CreditPackConfig} from '@/services/types/domain/credit-types'

import {CreditPackCard} from './credit-pack-card'

interface BuyCreditsSectionProps {
  packs: CreditPackConfig[]
  organizationId: string
}

export function BuyCreditsSection({
  packs,
  organizationId,
}: BuyCreditsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acheter des crédits</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {packs.map((pack) => (
            <CreditPackCard
              key={pack.id}
              pack={pack}
              organizationId={organizationId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
