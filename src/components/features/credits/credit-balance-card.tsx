'use client'

import {CoinsIcon, TrendingDownIcon} from 'lucide-react'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {CreditBalanceDTO} from '@/services/types/domain/credit-types'

interface CreditBalanceCardProps {
  balance: CreditBalanceDTO
}

export function CreditBalanceCard({balance}: CreditBalanceCardProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Crédits disponibles
          </CardTitle>
          <CoinsIcon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{balance.available}</div>
          <p className="text-muted-foreground text-xs">
            {balance.monthlyAllocation > 0
              ? `${balance.monthlyAllocation} crédits / mois inclus`
              : 'Pas de crédits mensuels'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Utilisés ce mois
          </CardTitle>
          <TrendingDownIcon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{balance.usedThisPeriod}</div>
          <p className="text-muted-foreground text-xs">
            {balance.periodStart && balance.periodEnd
              ? `Du ${formatDate(balance.periodStart)} au ${formatDate(balance.periodEnd)}`
              : 'Période non définie'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Période actuelle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            {balance.periodStart && balance.periodEnd ? (
              <>
                <p>
                  <span className="font-medium">Début :</span>{' '}
                  {formatDate(balance.periodStart)}
                </p>
                <p>
                  <span className="font-medium">Fin :</span>{' '}
                  {formatDate(balance.periodEnd)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Pas de période active</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
