'use client'

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {CreditUsageDay} from '@/services/types/domain/credit-types'

interface CreditUsageGraphProps {
  data: CreditUsageDay[]
}

export function CreditUsageGraph({data}: CreditUsageGraphProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Utilisation quotidienne</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucune donnée d&apos;utilisation pour cette période
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculer le maximum pour la mise à l'échelle
  const maxUsage = Math.max(...data.map((d) => d.creditsUsed), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utilisation quotidienne</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-[200px] items-end gap-1">
          {data.map((day) => {
            const height = (day.creditsUsed / maxUsage) * 100
            const date = new Date(day.day)
            const dayLabel = date.getDate().toString()

            return (
              <div key={day.day} className="group relative flex-1">
                <div
                  className="bg-primary/80 hover:bg-primary w-full rounded-t transition-colors"
                  style={{height: `${Math.max(height, 2)}%`}}
                />
                <div className="text-muted-foreground mt-1 text-center text-xs">
                  {dayLabel}
                </div>
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-white">
                    {day.creditsUsed} crédits
                    <br />
                    {new Intl.DateTimeFormat('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    }).format(date)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
