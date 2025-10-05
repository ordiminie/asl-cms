'use client'

import type {LucideIcon} from 'lucide-react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  DollarSign,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import {AdminDashboardStatsDTO} from '@/app/dal/admin-dashboard-dal'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {Separator} from '@/components/ui/separator'
import {MRRStats} from '@/services/types/domain/subscription-types'

interface AdminDashboardProps {
  stats: AdminDashboardStatsDTO
  mrrStats: MRRStats
}

export function AdminDashboard({stats, mrrStats}: AdminDashboardProps) {
  const {totalUsers, totalOrganizations, userGrowth, organizationGrowth} = stats

  const formatCurrency = (amount: number, currency: string = 'eur') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value)
  }

  // Transformer les données pour les graphiques avec des noms de mois plus lisibles
  const formatMonthData = (data: {month: string; count: number}[]) => {
    return data.map((item) => ({
      ...item,
      monthLabel: new Date(`${item.month}-01`).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      }),
    }))
  }

  const formattedUserGrowth = formatMonthData(userGrowth)
  const formattedOrganizationGrowth = formatMonthData(organizationGrowth)

  // Préparer les données MRR pour le graphique
  const mrrChartData = mrrStats.planBreakdowns.map((plan) => ({
    plan: plan.planName,
    totalMRR: plan.totalMRR / 100, // Convertir en euros pour l'affichage
    subscriptions: plan.subscriptionCount,
  }))

  // Préparer les données de croissance des subscriptions
  const formattedSubscriptionGrowth = formatMonthData(
    mrrStats.subscriptionGrowth
  )

  const planLeaderboard = [...mrrStats.planBreakdowns].sort(
    (a, b) => b.totalMRR - a.totalMRR
  )
  const topPlan = planLeaderboard[0]
  const topPlanShare =
    topPlan && mrrStats.totalMRR > 0
      ? Math.round((topPlan.totalMRR / mrrStats.totalMRR) * 100)
      : 0

  const lastUserPoint = formattedUserGrowth.at(-1)
  const latestSubscriptionPoint = formattedSubscriptionGrowth.at(-1)

  const bestSubscriptionMonth =
    formattedSubscriptionGrowth.length > 0
      ? formattedSubscriptionGrowth.reduce((best, item) => {
          return item.count > best.count ? item : best
        })
      : undefined

  const bestUserMonth =
    formattedUserGrowth.length > 0
      ? formattedUserGrowth.reduce((best, item) => {
          return item.count > best.count ? item : best
        })
      : undefined

  const averageUsersPerOrg =
    totalOrganizations > 0 ? Math.round(totalUsers / totalOrganizations) : 0

  const cumulativeNewUsers = userGrowth.reduce(
    (sum, item) => sum + item.count,
    0
  )

  // Configuration des graphiques ShadCN
  const userChartConfig = {
    count: {
      label: 'Utilisateurs',
      theme: {
        light: 'var(--chart-1)',
        dark: 'var(--chart-1)',
      },
    },
  } satisfies ChartConfig

  const organizationChartConfig = {
    count: {
      label: 'Organisations',
      theme: {
        light: 'var(--chart-2)',
        dark: 'var(--chart-2)',
      },
    },
  } satisfies ChartConfig

  const mrrChartConfig = {
    totalMRR: {
      label: 'MRR',
      theme: {
        light: 'var(--chart-3)',
        dark: 'var(--chart-3)',
      },
    },
  } satisfies ChartConfig

  const subscriptionChartConfig = {
    count: {
      label: 'Abonnements',
      theme: {
        light: 'var(--chart-4)',
        dark: 'var(--chart-4)',
      },
    },
  } satisfies ChartConfig

  // Calculer les pourcentages de croissance
  const calculateGrowth = (data: {count: number}[]) => {
    if (data.length < 2) return 0
    const current = data[data.length - 1].count
    const previous = data[data.length - 2].count
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const userGrowthPercent = calculateGrowth(userGrowth)
  const orgGrowthPercent = calculateGrowth(organizationGrowth)

  const heroMetrics = [
    {
      title: 'MRR total',
      value: formatCurrency(mrrStats.totalMRR, mrrStats.currency),
      subtitle: `${
        mrrStats.subscriptionGrowthPercent >= 0 ? '+' : ''
      }${mrrStats.subscriptionGrowthPercent}% vs mois dernier`,
      icon: DollarSign,
    },
    {
      title: 'Abonnements actifs',
      value: formatNumber(mrrStats.totalActiveSubscriptions),
      subtitle: topPlan
        ? `${topPlanShare}% générés par ${topPlan.planName}`
        : 'Répartition multi-plans',
      icon: Sparkles,
    },
    {
      title: 'Nouvelles souscriptions',
      value: formatNumber(mrrStats.newSubscriptionsThisMonth),
      subtitle: latestSubscriptionPoint
        ? `${formatNumber(latestSubscriptionPoint.count)} en ${latestSubscriptionPoint.monthLabel}`
        : 'Suivi mensuel des signatures',
      icon: TrendingUp,
    },
  ] as const

  const mainStatCards = [
    {
      title: 'Total utilisateurs',
      value: formatNumber(totalUsers),
      icon: Users,
      growth: userGrowthPercent,
      description: lastUserPoint
        ? `${formatNumber(lastUserPoint.count)} nouveaux ce mois-ci`
        : 'Population active',
      accent: 'from-sky-500/25 via-sky-500/0 to-transparent',
    },
    {
      title: 'Total organisations',
      value: formatNumber(totalOrganizations),
      icon: Building2,
      growth: orgGrowthPercent,
      description: `${formatNumber(averageUsersPerOrg)} utilisateurs par organisation`,
      accent: 'from-violet-500/25 via-violet-500/0 to-transparent',
    },
    {
      title: 'MRR total',
      value: formatCurrency(mrrStats.totalMRR, mrrStats.currency),
      icon: DollarSign,
      growth: mrrStats.subscriptionGrowthPercent,
      description: `${formatNumber(mrrStats.totalActiveSubscriptions)} abonnements actifs`,
      accent: 'from-emerald-500/25 via-emerald-500/0 to-transparent',
    },
    {
      title: 'Nouvelles souscriptions',
      value: formatNumber(mrrStats.newSubscriptionsThisMonth),
      icon: TrendingUp,
      growth: mrrStats.subscriptionGrowthPercent,
      description: latestSubscriptionPoint
        ? `${formatNumber(latestSubscriptionPoint.count)} en ${latestSubscriptionPoint.monthLabel}`
        : 'Croissance mensuelle',
      accent: 'from-amber-500/25 via-amber-500/0 to-transparent',
    },
  ] as const

  const secondaryHighlights = [
    {
      title: 'MRR annuel projeté',
      value: formatCurrency(mrrStats.yearlyMRR, mrrStats.currency),
      description: 'Projection sur 12 mois',
      icon: Sparkles,
    },
    {
      title: 'ARPU global',
      value: formatCurrency(mrrStats.averageRevenuePerUser, mrrStats.currency),
      description: `${formatNumber(totalUsers)} utilisateurs actifs`,
      icon: Users,
    },
  ] as const

  const insightItems = [
    topPlan && {
      title: 'Plan phare',
      value: topPlan.planName,
      details: `${formatNumber(topPlan.subscriptionCount)} abonnements • ${formatCurrency(topPlan.totalMRR, topPlan.currency)} (${topPlanShare}% du MRR)`,
      icon: Trophy,
    },
    bestSubscriptionMonth && {
      title: 'Meilleur mois abonnements',
      value: bestSubscriptionMonth.monthLabel,
      details: `${formatNumber(bestSubscriptionMonth.count)} signatures`,
      icon: TrendingUp,
    },
    bestUserMonth && {
      title: 'Pic de nouveaux utilisateurs',
      value: bestUserMonth.monthLabel,
      details: `${formatNumber(bestUserMonth.count)} créations de compte`,
      icon: Users,
    },
    {
      title: 'Nouveaux utilisateurs (12 mois)',
      value: formatNumber(cumulativeNewUsers),
      details: `${formatNumber(totalUsers)} utilisateurs au total`,
      icon: Sparkles,
    },
  ].filter(Boolean) as {
    title: string
    value: string
    details: string
    icon: LucideIcon
  }[]

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge className="w-max border-white/20 bg-white/10 text-xs tracking-wide text-white/80 uppercase">
              Tableau de bord exécutif
            </Badge>
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Performance SaaS en temps réel
              </h2>
              <p className="text-sm text-white/70">
                Aperçu consolidé des utilisateurs, organisations et revenus
                récurrents.
              </p>
            </div>
          </div>
          <Sparkles className="hidden h-12 w-12 text-white/60 sm:block" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {heroMetrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div
                  key={metric.title}
                  className="rounded-xl border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur transition-all hover:bg-white/15"
                >
                  <div className="flex items-center justify-between text-xs tracking-wide text-white/70 uppercase">
                    <span>{metric.title}</span>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metric.value}
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    {metric.subtitle}
                  </p>
                </div>
              )
            })}
          </div>
          <Separator className="bg-white/10" />
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <Badge className="flex items-center gap-1 border border-emerald-400/20 bg-emerald-500/15 text-emerald-100">
              <ArrowUpRight className="h-3 w-3" />
              {userGrowthPercent >= 0
                ? `+${userGrowthPercent}%`
                : `${userGrowthPercent}%`}{' '}
              utilisateurs
            </Badge>
            {topPlan && (
              <Badge className="flex items-center gap-1 border border-white/20 bg-white/10 text-white">
                <Trophy className="h-3 w-3" />
                Plan {topPlan.planName} · {topPlanShare}% du MRR
              </Badge>
            )}
            {latestSubscriptionPoint && (
              <span className="text-white/70">
                Dernier pic : {latestSubscriptionPoint.monthLabel} avec{' '}
                {formatNumber(latestSubscriptionPoint.count)} souscriptions
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cartes de statistiques */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mainStatCards.map((card) => {
          const Icon = card.icon
          const isPositive = card.growth >= 0
          const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight
          const trendClass = isPositive
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300'

          return (
            <Card
              key={card.title}
              className="border-border/50 relative overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`}
              />
              <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {card.title}
                  </CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {card.description}
                  </p>
                </div>
                <div className="bg-background/80 rounded-full p-2 shadow-sm">
                  <Icon className="text-muted-foreground h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative space-y-3">
                <div className="text-3xl font-semibold">{card.value}</div>
                <Badge className={`w-max border ${trendClass}`}>
                  <TrendIcon className="mr-1 h-3 w-3" />
                  {card.growth >= 0 ? `+${card.growth}%` : `${card.growth}%`} ce
                  mois
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Deuxième ligne - MRR par Plan + Stats complémentaires */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Répartition MRR par Plan - 2 colonnes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              MRR par Plan
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Répartition du revenu par plan d&apos;abonnement
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mrrStats.planBreakdowns.map((plan) => (
                <div
                  key={plan.planCode}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <div className="font-medium">{plan.planName}</div>
                    <div className="text-muted-foreground text-sm">
                      {plan.subscriptionCount} abonnement
                      {plan.subscriptionCount > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(plan.totalMRR, plan.currency)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Moy: {formatCurrency(plan.averageAmount, plan.currency)}
                    </div>
                  </div>
                </div>
              ))}
              {mrrStats.planBreakdowns.length === 0 && (
                <div className="text-muted-foreground py-4 text-center">
                  Aucun abonnement actif
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats complémentaires - 1 colonne chacune */}
        {secondaryHighlights.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="border-border/50 h-fit border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {card.title}
                </CardTitle>
                <Icon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{card.value}</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Graphiques Abonnements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Répartition MRR par Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Répartition MRR
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              MRR par plan d&apos;abonnement
            </p>
          </CardHeader>
          <CardContent className="w-full">
            <ChartContainer
              className="min-h-[320px] w-full"
              config={mrrChartConfig}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={mrrChartData}
                  margin={{top: 20, right: 12, left: 12, bottom: 20}}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="plan"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(value) => `${value}€`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          if (name === 'totalMRR') {
                            return [`${Number(value).toFixed(2)}€`, 'MRR']
                          }
                          return [value, 'Abonnements']
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="totalMRR"
                    fill="var(--color-totalMRR)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Croissance des abonnements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Croissance Abonnements
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Nouveaux abonnements par mois
            </p>
          </CardHeader>
          <CardContent className="w-full">
            <ChartContainer
              className="min-h-[320px] w-full"
              config={subscriptionChartConfig}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  accessibilityLayer
                  data={formattedSubscriptionGrowth}
                  margin={{top: 20, right: 12, left: 12, bottom: 20}}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${value.toLocaleString()}`,
                          'Nouveaux abonnements',
                        ]}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    strokeWidth={2}
                    dot={{r: 4}}
                    activeDot={{r: 6}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques Utilisateurs & Organisations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Croissance des utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Croissance des Utilisateurs
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Évolution mensuelle des nouveaux utilisateurs
            </p>
          </CardHeader>
          <CardContent className="w-full">
            <ChartContainer
              className="min-h-[320px] w-full"
              config={userChartConfig}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  accessibilityLayer
                  data={formattedUserGrowth}
                  margin={{top: 20, right: 12, left: 12, bottom: 20}}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${value.toLocaleString()}`,
                          'Utilisateurs',
                        ]}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    strokeWidth={2}
                    dot={{r: 4}}
                    activeDot={{r: 6}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Croissance des organisations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Croissance des Organisations
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Évolution mensuelle des nouvelles organisations
            </p>
          </CardHeader>
          <CardContent className="w-full">
            <ChartContainer
              className="min-h-[320px] w-full"
              config={organizationChartConfig}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={formattedOrganizationGrowth}
                  margin={{top: 20, right: 12, left: 12, bottom: 20}}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${value}`, 'Organisations']}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Insights clés</CardTitle>
          <p className="text-muted-foreground text-sm">
            Synthèse des signaux forts pour prioriser vos prochaines actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {insightItems.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Aucune donnée disponible pour le moment.
            </p>
          )}
          {insightItems.map((insight, index) => {
            const Icon = insight.icon
            return (
              <div key={`${insight.title}-${index}`} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-muted/60 flex h-10 w-10 items-center justify-center rounded-full">
                      <Icon className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">{insight.title}</div>
                      <p className="text-muted-foreground text-sm">
                        {insight.details}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {insight.value}
                  </div>
                </div>
                {index < insightItems.length - 1 && (
                  <Separator className="bg-border/70" />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
