'use client'

import {useEffect, useState} from 'react'

import {useOrganization} from '@/components/context/organization-provider'
import {BuyCreditsSection} from '@/components/features/credits/buy-credits-section'
import {CreditActivityTimeline} from '@/components/features/credits/credit-activity-timeline'
import {CreditBalanceCard} from '@/components/features/credits/credit-balance-card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  CreditActivityItem,
  CreditBalanceDetails,
  CreditPackConfig,
} from '@/services/types/domain/credit-types'

import {
  ensureCreditsAllocatedAction,
  getCreditBalanceAction,
  getRecentCreditActivityAction,
} from './actions'

interface CreditPageContentProps {
  packs: CreditPackConfig[]
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
      </div>
      <Skeleton className="h-[350px]" />
    </div>
  )
}

export function CreditPageContent({packs}: CreditPageContentProps) {
  const {referenceId} = useOrganization()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<CreditBalanceDetails | null>(null)
  const [activities, setActivities] = useState<CreditActivityItem[]>([])

  useEffect(() => {
    const loadData = async () => {
      if (!referenceId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Lazy allocation (filet de sécurité pour plans annuels)
        // Non-blocking, appelé avant de récupérer le solde
        await ensureCreditsAllocatedAction(referenceId)

        const [balanceResult, activitiesResult] = await Promise.all([
          getCreditBalanceAction(referenceId),
          getRecentCreditActivityAction(referenceId, 20),
        ])

        if (balanceResult.success && balanceResult.data) {
          setBalance(balanceResult.data)
        }

        if (activitiesResult.success && activitiesResult.data) {
          setActivities(activitiesResult.data)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [referenceId])

  if (!referenceId) {
    return (
      <div className="text-muted-foreground">
        Veuillez sélectionner une organisation
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (!balance) {
    return (
      <div className="text-muted-foreground">
        Impossible de charger les crédits
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CreditBalanceCard balance={balance} />

      <CreditActivityTimeline activities={activities} />

      <BuyCreditsSection packs={packs} organizationId={referenceId} />
    </div>
  )
}
