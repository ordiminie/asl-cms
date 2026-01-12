'use client'

import {eachDayOfInterval, format} from 'date-fns'
import {fr} from 'date-fns/locale'
import {Coins} from 'lucide-react'
import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from 'recharts'

import {useOrganization} from '@/components/context/organization-provider'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {Skeleton} from '@/components/ui/skeleton'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {
  CreditBalanceDetails,
  CreditUsageDay,
} from '@/services/types/domain/credit-types'

import {
  getCreditBalanceAction,
  getCreditUsageGraphAction,
} from '../credit/actions'

const chartConfig = {
  creditsUsed: {
    label: 'Credits Used',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[500px]" />
    </div>
  )
}

export default function UsagePage() {
  const {referenceId} = useOrganization()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<CreditBalanceDetails | null>(null)
  const [usageData, setUsageData] = useState<CreditUsageDay[]>([])

  useEffect(() => {
    const loadData = async () => {
      if (!referenceId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const balanceResult = await getCreditBalanceAction(referenceId)

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
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [referenceId])

  // Générer tous les jours de la période avec les données d'usage
  const chartData = useMemo(() => {
    if (!balance?.periodStart || !balance?.periodEnd) return []

    const start = new Date(balance.periodStart)
    const end = new Date(balance.periodEnd)

    // Créer un map des jours avec usage
    const usageMap = new Map(usageData.map((d) => [d.day, d.creditsUsed]))

    // Générer tous les jours de la période
    const allDays = eachDayOfInterval({start, end})

    return allDays.map((date) => {
      const dayKey = format(date, 'yyyy-MM-dd')
      return {
        day: format(date, 'd MMM', {locale: fr}),
        creditsUsed: usageMap.get(dayKey) ?? 0,
      }
    })
  }, [balance, usageData])

  const totalUsed = usageData.reduce((sum, day) => sum + day.creditsUsed, 0)

  const periodStartFormatted = balance?.periodStart
    ? format(new Date(balance.periodStart), 'd MMM yyyy', {locale: fr})
    : ''
  const periodEndFormatted = balance?.periodEnd
    ? format(new Date(balance.periodEnd), 'd MMM yyyy', {locale: fr})
    : ''

  if (!referenceId) {
    return (
      <div>
        <div className="text-muted-foreground">
          Veuillez sélectionner une organisation
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Credits
          </h2>
          <p className="text-muted-foreground">
            Manage your image generation credits
          </p>
        </div>
      </div>

      <Tabs defaultValue="usage" className="w-fit">
        <TabsList>
          <TabsTrigger value="credits" asChild>
            <Link href="/account/billing/credit">Credits</Link>
          </TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="plans" asChild>
            <Link href="/account/billing/subscription">Plans</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Credits Usage</CardTitle>
            <p className="text-muted-foreground text-sm">
              Period: {periodStartFormatted} - {periodEndFormatted}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm">Credits Used</p>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(totalUsed)}
            </p>
            <p className="text-muted-foreground text-sm">
              Balance:{' '}
              {new Intl.NumberFormat('fr-FR').format(balance?.balance ?? 0)}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4">
              <Coins className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground">
                Aucune donnée d&apos;utilisation pour cette période
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{top: 20, right: 20, bottom: 20, left: 20}}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    interval={Math.floor(chartData.length / 10)}
                  />
                  <ChartTooltip
                    cursor={{fill: 'hsl(var(--muted))'}}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="creditsUsed"
                    fill="hsl(35, 92%, 50%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-[hsl(35,92%,50%)]" />
            <span className="text-muted-foreground text-sm">Credits Used</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
