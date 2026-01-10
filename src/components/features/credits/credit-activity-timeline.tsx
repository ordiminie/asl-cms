'use client'

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CoinsIcon,
  GiftIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
} from 'lucide-react'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {ScrollArea} from '@/components/ui/scroll-area'
import {
  CreditActivityItem,
  CreditSource,
} from '@/services/types/domain/credit-types'

interface CreditActivityTimelineProps {
  activities: CreditActivityItem[]
}

const sourceConfig: Record<
  CreditSource,
  {icon: typeof CoinsIcon; label: string; color: string}
> = {
  plan: {
    icon: CoinsIcon,
    label: 'Allocation mensuelle',
    color: 'text-green-500',
  },
  admin_grant: {
    icon: GiftIcon,
    label: 'Bonus admin',
    color: 'text-purple-500',
  },
  usage: {
    icon: ArrowDownIcon,
    label: 'Utilisation',
    color: 'text-red-500',
  },
  pack: {
    icon: ShoppingCartIcon,
    label: 'Achat pack',
    color: 'text-blue-500',
  },
  refund: {
    icon: RefreshCwIcon,
    label: 'Remboursement',
    color: 'text-orange-500',
  },
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

export function CreditActivityTimeline({
  activities,
}: CreditActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucune activité récente
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activité récente</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const config = sourceConfig[activity.source]
              const isPositive = activity.amount > 0

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div
                    className={`rounded-full p-2 ${isPositive ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}
                  >
                    {isPositive ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{config.label}</p>
                      <span
                        className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {isPositive ? '+' : ''}
                        {activity.amount}
                      </span>
                    </div>
                    {activity.reason && (
                      <p className="text-muted-foreground text-xs">
                        {activity.reason}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
