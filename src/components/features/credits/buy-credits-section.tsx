'use client'

import {useTranslations} from 'next-intl'

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
  const t = useTranslations('CreditsUi')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('buy')}</CardTitle>
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
