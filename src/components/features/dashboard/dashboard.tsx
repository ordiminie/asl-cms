'use client'

import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Sparkles,
  TrendingUp,
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

import {Badge} from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {Separator} from '@/components/ui/separator'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'

export default function DashboardPage() {
  const revenueData = [
    {date: 'Jan', Revenu: 5250, growth: 12},
    {date: 'Fév', Revenu: 8750, growth: 18},
    {date: 'Mar', Revenu: 7500, growth: -8},
    {date: 'Avr', Revenu: 9000, growth: 12},
    {date: 'Mai', Revenu: 11500, growth: 28},
    {date: 'Juin', Revenu: 15250, growth: 33},
  ]

  const salesData = [
    {name: 'Starter', Ventes: 256},
    {name: 'Growth', Ventes: 450},
    {name: 'Scale', Ventes: 320},
    {name: 'Enterprise', Ventes: 280},
    {name: 'Add-ons', Ventes: 150},
  ]

  const transactions = [
    {id: '#TR-123', client: 'Martin Dupont', amount: 422.5, status: 'Complété'},
    {
      id: '#TR-124',
      client: 'Sophie Laurent',
      amount: 87.25,
      status: 'En attente',
    },
    {
      id: '#TR-125',
      client: 'Julien Moreau',
      amount: 245.99,
      status: 'Complété',
    },
    {id: '#TR-126', client: 'Laura Blanc', amount: 650, status: 'En attente'},
    {id: '#TR-127', client: 'Thomas Petit', amount: 120.75, status: 'Complété'},
  ] as const

  const quarterGoals = [
    {
      title: 'Acquisition',
      progress: 75,
      detail: '4 500 / 6 000 leads',
      color: 'bg-sky-500',
    },
    {
      title: 'Fidélisation',
      progress: 90,
      detail: '2 700 / 3 000 clients actifs',
      color: 'bg-emerald-500',
    },
    {
      title: "Chiffre d'affaires",
      progress: 65,
      detail: '650k / 1M €',
      color: 'bg-indigo-500',
    },
    {
      title: 'Satisfaction client',
      progress: 82,
      detail: 'Note moyenne 4,1 / 5',
      color: 'bg-amber-500',
    },
  ] as const

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.Revenu, 0)
  const lastMonthRevenue = revenueData.at(-1)?.Revenu ?? 0
  const previousMonthRevenue = revenueData.at(-2)?.Revenu ?? lastMonthRevenue
  const revenueTrend = previousMonthRevenue
    ? Math.round(
        ((lastMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      )
    : 0

  const bestRevenueMonth = revenueData.reduce((best, item) =>
    item.Revenu > best.Revenu ? item : best
  )

  const totalSales = salesData.reduce((sum, item) => sum + item.Ventes, 0)
  const bestProduct = salesData.reduce((best, item) =>
    item.Ventes > best.Ventes ? item : best
  )

  const completedTransactions = transactions.filter(
    (transaction) => transaction.status === 'Complété'
  )
  const totalCompletedAmount = completedTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  )

  const averageCompletedTicket =
    completedTransactions.length > 0
      ? totalCompletedAmount / completedTransactions.length
      : 0
  const activeUsers = 8750

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value)
  }

  const revenueChartConfig = {
    Revenu: {
      label: 'Revenu',
      theme: {
        light: 'var(--chart-3)',
        dark: 'var(--chart-3)',
      },
    },
  } satisfies ChartConfig

  const salesChartConfig = {
    Ventes: {
      label: 'Ventes',
      theme: {
        light: 'var(--chart-1)',
        dark: 'var(--chart-1)',
      },
    },
  } satisfies ChartConfig

  const heroMetrics = [
    {
      title: 'Revenu mensuel',
      value: formatCurrency(lastMonthRevenue),
      subtitle:
        revenueTrend >= 0
          ? `+${revenueTrend}% vs mois précédent`
          : `${revenueTrend}% vs mois précédent`,
      icon: DollarSign,
    },
    {
      title: 'Tickets moyens',
      value: formatCurrency(averageCompletedTicket),
      subtitle: `${completedTransactions.length} transactions complétées`,
      icon: CreditCard,
    },
    {
      title: 'Nouveaux clients',
      value: formatNumber(2350),
      subtitle: 'Campagne d’acquisition Q2',
      icon: Users,
    },
  ] as const

  const mainStatCards = [
    {
      title: 'Revenus cumulés (6 mois)',
      value: formatCurrency(totalRevenue),
      description: `Meilleur mois : ${bestRevenueMonth.date}`,
      icon: DollarSign,
      growth: revenueTrend,
      accent: 'from-emerald-500/25 via-emerald-500/0 to-transparent',
    },
    {
      title: 'Volume de ventes',
      value: formatNumber(totalSales),
      description: `${bestProduct.name} est en tête (${formatNumber(bestProduct.Ventes)} ventes)`,
      icon: TrendingUp,
      growth: 14,
      accent: 'from-sky-500/25 via-sky-500/0 to-transparent',
    },
    {
      title: 'Revenu moyen / client',
      value: formatCurrency(averageCompletedTicket),
      description: 'Basé sur les transactions complétées',
      icon: CreditCard,
      growth: 7,
      accent: 'from-violet-500/25 via-violet-500/0 to-transparent',
    },
    {
      title: 'Taux de conversion',
      value: '24,5%',
      description: '+3,2 pts depuis janvier',
      icon: TrendingUp,
      growth: 12,
      accent: 'from-amber-500/25 via-amber-500/0 to-transparent',
    },
  ] as const

  const insightItems = [
    {
      title: 'Produit phare',
      value: bestProduct.name,
      details: `${formatNumber(bestProduct.Ventes)} ventes sur 30 jours`,
      icon: TrendingUp,
    },
    {
      title: 'Croissance la plus forte',
      value: bestRevenueMonth.date,
      details: `${formatCurrency(bestRevenueMonth.Revenu)} générés`,
      icon: Sparkles,
    },
    {
      title: 'Taux de conversion',
      value: '24,5%',
      details: 'Campagnes multi-canales performantes',
      icon: Users,
    },
    {
      title: 'Panier moyen',
      value: formatCurrency(averageCompletedTicket),
      details: 'Combos plan + add-ons en hausse',
      icon: CreditCard,
    },
  ] as const

  return (
    <div className="space-y-6 p-4 pt-6 md:p-8">
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge className="w-max border-white/20 bg-white/10 text-xs tracking-wide text-white/80 uppercase">
              Espace client
            </Badge>
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Vue d&apos;ensemble de votre activité
              </h2>
              <p className="text-sm text-white/70">
                Suivez vos revenus, vos clients et vos opportunités de
                croissance en un coup d’œil.
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
              {revenueTrend >= 0 ? `+${revenueTrend}%` : `${revenueTrend}%`} de
              revenus vs mois dernier
            </Badge>
            <Badge className="flex items-center gap-1 border border-white/20 bg-white/10 text-white">
              <Users className="h-3 w-3" />
              {formatNumber(activeUsers)} utilisateurs actifs
            </Badge>
            <span className="text-white/70">
              Dernier pic : {bestRevenueMonth.date} avec{' '}
              {formatCurrency(bestRevenueMonth.Revenu)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="analytics">Analytiques</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                      {card.growth >= 0
                        ? `+${card.growth}%`
                        : `${card.growth}%`}{' '}
                      ce mois
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/50 border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Revenus mensuels
                </CardTitle>
                <CardDescription>
                  Détail des revenus récurrents sur 6 mois
                </CardDescription>
              </CardHeader>
              <CardContent className="w-full">
                <ChartContainer
                  className="min-h-[320px] w-full"
                  config={revenueChartConfig}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      accessibilityLayer
                      data={revenueData}
                      margin={{top: 20, right: 12, left: 12, bottom: 20}}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(value) => `${value.toLocaleString()} €`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [
                              `${value.toLocaleString()} €`,
                              'Revenu',
                            ]}
                          />
                        }
                      />
                      <ChartLegend />
                      <Line
                        type="monotone"
                        dataKey="Revenu"
                        strokeWidth={2}
                        dot={{r: 4}}
                        activeDot={{r: 6}}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Répartition des ventes
                </CardTitle>
                <CardDescription>
                  Ventilation par plans et add-ons
                </CardDescription>
              </CardHeader>
              <CardContent className="w-full">
                <ChartContainer
                  className="min-h-[320px] w-full"
                  config={salesChartConfig}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={salesData}
                      margin={{top: 20, right: 12, left: 12, bottom: 20}}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [`${value}`, 'Ventes']}
                          />
                        }
                      />
                      <ChartLegend />
                      <Bar
                        dataKey="Ventes"
                        fill="var(--color-Ventes)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/50 border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Transactions récentes
                </CardTitle>
                <CardDescription>
                  Les cinq dernières opérations clients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {transactions.map((transaction, index) => {
                  const isCompleted = transaction.status === 'Complété'
                  return (
                    <div key={transaction.id} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{transaction.id}</div>
                          <p className="text-muted-foreground text-sm">
                            {transaction.client}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-semibold">
                            {formatCurrency(transaction.amount)}
                          </div>
                          <Badge
                            className={`border px-2 py-1 text-xs ${
                              isCompleted
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                            }`}
                          >
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                      {index < transactions.length - 1 && (
                        <Separator className="bg-border/60" />
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="border-border/50 border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  Objectifs trimestriels
                </CardTitle>
                <CardDescription>
                  Suivi de vos jalons stratégiques
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {quarterGoals.map((goal) => (
                  <div key={goal.title} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{goal.title}</span>
                      <span className="text-muted-foreground">
                        {goal.progress}% ({goal.detail})
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`${goal.color} h-2 rounded-full`}
                        style={{width: `${goal.progress}%`}}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Insights clés
              </CardTitle>
              <CardDescription>
                Identifiez vos leviers de croissance et priorisez vos actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/50 border">
            <CardHeader>
              <CardTitle>Performances marketing</CardTitle>
              <CardDescription>
                Détail des canaux et campagnes pour vos prochains arbitrages.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <p>
                Ajoutez ici vos rapports personnalisés (ex: CAC, LTV par canal,
                cohortes clients…).
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 border">
            <CardHeader>
              <CardTitle>Pipeline commercial</CardTitle>
              <CardDescription>
                Conversion par étape, valeur des deals et forecast.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <p>
                Branchez vos données CRM pour suivre en direct vos opportunités.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="border-border/50 border">
            <CardHeader>
              <CardTitle>Rapports exportables</CardTitle>
              <CardDescription>
                Téléchargez vos exports financiers et marketing.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <p>
                Connectez vos automatisations (Notion, Looker, Google Sheets…)
                pour alimenter vos reportings.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
