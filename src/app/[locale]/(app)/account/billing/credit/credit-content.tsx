'use client'

import {useEffect, useState} from 'react'

import {useOrganization} from '@/components/context/organization-provider'
import {BuyCreditsSection} from '@/components/features/credits/buy-credits-section'
import {CreditActivityTimeline} from '@/components/features/credits/credit-activity-timeline'
import {CreditBalanceCard} from '@/components/features/credits/credit-balance-card'
import {CreditUsageGraph} from '@/components/features/credits/credit-usage-graph'
import {Skeleton} from '@/components/ui/skeleton'
import {
  CreditActivityItem,
  CreditBalanceDetails,
  CreditPackConfig,
  CreditUsageDay,
} from '@/services/types/domain/credit-types'

import {
  getCreditBalanceAction,
  getCreditUsageGraphAction,
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  )
}

export function CreditPageContent({packs}: CreditPageContentProps) {
  const {referenceId} = useOrganization()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<CreditBalanceDetails | null>(null)
  const [activities, setActivities] = useState<CreditActivityItem[]>([])
  const [usageData, setUsageData] = useState<CreditUsageDay[]>([])

  useEffect(() => {
    const loadData = async () => {
      if (!referenceId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const [balanceResult, activitiesResult] = await Promise.all([
          getCreditBalanceAction(referenceId),
          getRecentCreditActivityAction(referenceId, 20),
        ])

        if (balanceResult.success && balanceResult.data) {
          setBalance(balanceResult.data)

          if (balanceResult.data.periodStart && balanceResult.data.periodEnd) {
            const usageResult = await getCreditUsageGraphAction(
              referenceId,
              balanceResult.data.periodStart,
              balanceResult.data.periodEnd
            )
            if (usageResult.success && usageResult.data) {
              setUsageData(usageResult.data)
            }
          }
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

      <div className="grid gap-6 lg:grid-cols-2">
        <CreditUsageGraph data={usageData} />
        <CreditActivityTimeline activities={activities} />
      </div>

      <BuyCreditsSection packs={packs} organizationId={referenceId} />
    </div>
  )
}
