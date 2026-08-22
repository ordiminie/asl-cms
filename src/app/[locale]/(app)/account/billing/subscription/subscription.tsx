'use client'

import {Subscription} from '@better-auth/stripe'
import {Calendar, CheckCircle} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import React, {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {
  useOrganization,
  useOrganizationRole,
} from '@/components/context/organization-provider'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {authClient} from '@/lib/better-auth/auth-client'
import {AvailablePlan} from '@/lib/stripe/stripe-types'

import {getPriceIdFromSubscriptionIdAction, isYearlyPrice} from './action'

// Type pour les plans disponibles

type SubscriptionPageProps = {
  availablePlans: AvailablePlan[]
}

type LoadedSubscriptions = {
  subscriptions: Subscription[]
  isYearly: boolean
}

const findActiveSubscription = (subscriptions: Subscription[]) =>
  subscriptions.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  )

const fetchSubscriptions = async (
  referenceId: string | undefined
): Promise<LoadedSubscriptions> => {
  const {data} = await authClient.subscription.list({
    query: {referenceId: referenceId || ''},
  })
  const subscriptions = data || []

  // Hack time to get the yearly price from the subscription id
  // https://github.com/better-auth/better-auth/pull/3239
  const stripeSubscriptionId =
    findActiveSubscription(subscriptions)?.stripeSubscriptionId
  if (!stripeSubscriptionId) {
    return {subscriptions, isYearly: false}
  }

  const priceId = await getPriceIdFromSubscriptionIdAction(stripeSubscriptionId)
  return {subscriptions, isYearly: await isYearlyPrice(priceId || '')}
}

export default function SubscriptionPage({
  availablePlans,
}: SubscriptionPageProps) {
  const t = useTranslations('Subscription')
  const tCommon = useTranslations('Common')
  const tCredits = useTranslations('Credits')
  const locale = useLocale()
  const {referenceId} = useOrganization()
  const {isOwner} = useOrganizationRole()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loadedReferenceId, setLoadedReferenceId] = useState<
    string | undefined | null
  >(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [isYearly, setIsYearly] = useState(false)
  const [activeSubscriptionIsYearly, setActiveSubscriptionIsYearly] =
    useState(false)
  const [selectedSeats, setSelectedSeats] = useState<{
    [planId: string]: number
  }>({
    free: 1,
    pro: 5,
    enterprise: 10,
  })

  const loading = loadedReferenceId !== referenceId

  const applySubscriptions = (loaded: LoadedSubscriptions) => {
    setSubscriptions(loaded.subscriptions)
    setIsYearly(loaded.isYearly)
    setActiveSubscriptionIsYearly(loaded.isYearly)

    const activeSubscription = findActiveSubscription(loaded.subscriptions)
    if (activeSubscription) {
      setSelectedSeats((prev) => ({
        ...prev,
        [activeSubscription.plan]: activeSubscription.seats || 1,
      }))
    }
  }

  const notifyLoadError = (error: unknown) => {
    console.error('Erreur lors du chargement des abonnements:', error)
    toast.error(t('errors.loadFailed'), {
      description: !isOwner ? t('errors.notOwnerOfThis') : '',
    })
  }

  const loadSubscriptions = async () => {
    try {
      applySubscriptions(await fetchSubscriptions(referenceId))
    } catch (error) {
      notifyLoadError(error)
    } finally {
      setLoadedReferenceId(referenceId)
    }
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const loaded = await fetchSubscriptions(referenceId)
        if (cancelled) return
        applySubscriptions(loaded)
      } catch (error) {
        if (cancelled) return
        notifyLoadError(error)
      } finally {
        if (!cancelled) setLoadedReferenceId(referenceId)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceId])

  const handleUpgrade = async (planId: string, annual = false) => {
    try {
      setActionLoading(`upgrade-${planId}`)

      const activeSubscription = subscriptions.find(
        (sub) => sub.status === 'active' || sub.status === 'trialing'
      )

      const seats = selectedSeats[planId] || 1

      // Déterminer le mode selon la présence d'une subscription active
      const isUpdateMode = activeSubscription?.id
      const isCreateMode = !activeSubscription && referenceId

      if (!isUpdateMode && !isCreateMode) {
        toast.error(t('errors.modeUnknown'))
        return
      }

      // Préparer les paramètres selon le mode
      const upgradeParams: {
        plan: string
        successUrl: string
        cancelUrl: string
        annual: boolean
        seats: number
        subscriptionId?: string
        referenceId?: string
      } = {
        plan: planId,
        successUrl: '/account/billing/subscription',
        cancelUrl: '/account/billing/subscription',
        annual,
        seats,
      }

      if (isUpdateMode) {
        // Mode UPDATE : modifier une subscription existante
        upgradeParams.subscriptionId = activeSubscription.id
      } else if (isCreateMode) {
        // Mode CREATE : créer une nouvelle subscription
        upgradeParams.referenceId = referenceId
      }

      const {error} = await authClient.subscription.upgrade(upgradeParams)

      if (error) {
        console.error('Erreur upgrade détails:', error)
        toast.error(
          error.message || error.statusText || t('errors.updateFailed'),
          {
            description: !isOwner
              ? t('errors.notOwner')
              : error.message
                ? ''
                : JSON.stringify(error),
          }
        )
      } else {
        toast.success(t('success.redirecting'))
      }
    } catch (error) {
      console.error('Erreur upgrade:', error)
      toast.error(t('errors.updateFailed'), {
        description: !isOwner ? t('errors.notOwnerOfThis') : '',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (referenceId: string) => {
    try {
      setActionLoading('cancel')
      const {data, error} = await authClient.subscription.cancel({
        returnUrl: '/account/billing/subscription',
        referenceId,
      })

      if (error) {
        toast.error(error.message || t('errors.cancelFailed'), {
          description: !isOwner ? t('errors.notOwnerOfThis') : '',
        })
      } else if (data?.url) {
        window.location.assign(data.url)
      } else {
        toast.success(t('success.canceled'))
        await loadSubscriptions()
      }
    } catch (error) {
      console.error('Erreur cancel:', error)
      toast.error(t('errors.cancelFailed'), {
        description: !isOwner ? t('errors.notOwnerOfThis') : '',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestore = async () => {
    try {
      setActionLoading('restore')
      const {error} = await authClient.subscription.restore()

      if (error) {
        toast.error(error.message || t('errors.restoreFailed'), {
          description: !isOwner ? t('errors.notOwnerOfThis') : '',
        })
      } else {
        toast.success(t('success.restored'))
        await loadSubscriptions()
      }
    } catch (error) {
      console.error('Erreur restore:', error)
      toast.error(t('errors.restoreFailed'), {
        description: !isOwner ? t('errors.notOwnerOfThis') : '',
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Fonctions helper pour l'approche Zapier
  const isCurrentPlan = (planId: string) => {
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    )
    return activeSubscription?.plan === planId
  }

  const hasSeatsChanged = (planId: string) => {
    if (!isCurrentPlan(planId)) return false
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    )
    return selectedSeats[planId] !== activeSubscription?.seats
  }

  const hasBillingChanged = (planId: string) => {
    if (!isCurrentPlan(planId)) return false
    // Détecter si le mode de facturation a changé
    // On suppose que l'abonnement actuel est mensuel si pas d'info spécifique
    const currentIsYearly = activeSubscriptionIsYearly
    return isYearly !== currentIsYearly
  }

  const hasPlanChanged = (planId: string) => {
    return hasSeatsChanged(planId) || hasBillingChanged(planId)
  }

  const getActionButton = (plan: (typeof availablePlans)[0]) => {
    const isCurrent = isCurrentPlan(plan.id)
    const hasChanged = hasPlanChanged(plan.id)
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    )

    // Cas spécial pour le plan gratuit
    if (plan.id === 'free') {
      // Si on est déjà sur le plan gratuit (pas d'abonnement actif)
      if (!activeSubscription) {
        return (
          <Button variant="outline" disabled className="w-full">
            Plan actuel
          </Button>
        )
      }
      // Si abonnement payant se termine, plan gratuit devient le futur plan
      if (activeSubscription.cancelAtPeriodEnd) {
        return (
          <Button variant="outline" disabled className="w-full">
            {t('actions.startingFrom', {
              date: formatDate(activeSubscription.periodEnd?.toISOString()),
            })}
          </Button>
        )
      }
      // Si on a un abonnement payant actif, permettre de downgrader vers gratuit
      return (
        <Button
          variant="destructive"
          onClick={() => handleCancel(activeSubscription.referenceId || '')}
          disabled={actionLoading === 'cancel'}
          className="w-full"
        >
          {actionLoading === 'cancel'
            ? t('actions.canceling')
            : t('actions.downgradeFree')}
        </Button>
      )
    }

    // Logique existante pour les plans payants
    if (isCurrent && !hasChanged) {
      // Si l'abonnement est déjà marqué pour annulation, afficher le bouton pour continuer
      if (activeSubscription?.cancelAtPeriodEnd) {
        const planName = plan.name
        return (
          <Button
            variant="default"
            onClick={handleRestore}
            disabled={actionLoading === 'restore'}
            className="w-full"
          >
            {actionLoading === 'restore'
              ? t('actions.restoring')
              : t('actions.continuePlan', {plan: planName})}
          </Button>
        )
      }

      // Sinon, afficher le bouton annuler
      return (
        <Button
          variant="destructive"
          onClick={() => handleCancel(activeSubscription?.referenceId || '')}
          disabled={actionLoading === 'cancel'}
          className="w-full"
        >
          {actionLoading === 'cancel'
            ? t('actions.canceling')
            : tCommon('actions.cancel')}
        </Button>
      )
    }

    if (isCurrent && hasChanged) {
      return (
        <Button
          onClick={() => handleUpgrade(plan.id, isYearly)}
          disabled={actionLoading === `upgrade-${plan.id}`}
          className="w-full"
        >
          {actionLoading === `upgrade-${plan.id}`
            ? t('actions.updating')
            : t('actions.update')}
        </Button>
      )
    }

    return (
      <Button
        variant={plan.popular ? 'default' : 'outline'}
        onClick={() => handleUpgrade(plan.id, isYearly)}
        disabled={actionLoading === `upgrade-${plan.id}`}
        className="w-full"
      >
        {actionLoading === `upgrade-${plan.id}`
          ? t('actions.redirecting')
          : t('actions.switchTo', {plan: plan.name})}
      </Button>
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString(locale)
  }

  // Calcul des prix totaux avec le nombre de sièges
  const calculatePrice = (planId: string) => {
    const plan = availablePlans.find((p: AvailablePlan) => p.id === planId)
    if (!plan) return 0

    const seats = selectedSeats[planId] || 1
    const basePrice = isYearly ? plan.yearlyPrice : (plan.price ?? 0)

    return basePrice * seats
  }

  const formatPrice = (price: number) => {
    return `€${price}`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold">Abonnements</h1>
          <p className="text-muted-foreground">
            Gérez vos abonnements et facturation
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                <div className="h-3 w-1/2 rounded bg-gray-200"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 rounded bg-gray-200"></div>
                  <div className="h-3 w-5/6 rounded bg-gray-200"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const activeSubscription = subscriptions.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  )

  // Utiliser le vrai priceId récupéré via Stripe pour déterminer si l'abonnement est annuel
  // const activeSubscriptionIsYearly = realPriceId
  //   ? await isYearlyPrice(realPriceId)
  //   : false

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <Tabs defaultValue="plans" className="w-fit">
        <TabsList>
          <TabsTrigger value="credits" asChild>
            <Link href="/account/billing/credit">
              {tCredits('tabs.credits')}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="usage" asChild>
            <Link href="/account/billing/usage">{tCredits('tabs.usage')}</Link>
          </TabsTrigger>
          <TabsTrigger value="plans">{tCredits('tabs.plans')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Header */}
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground">
          {activeSubscription ? t('subheadingActive') : t('subheadingNew')}
        </p>

        {/* Récapitulatif discret de l&apos;offre en cours */}
        {activeSubscription && (
          <p className="text-muted-foreground text-sm italic">
            {t('recap', {
              plan:
                availablePlans.find(
                  (p: AvailablePlan) => p.id === activeSubscription.plan
                )?.name || activeSubscription.plan,
              seats: activeSubscription.seats || 1,
              billing: activeSubscriptionIsYearly
                ? t('billing.yearly')
                : t('billing.monthly'),
              ending: activeSubscription.cancelAtPeriodEnd ? 'yes' : 'no',
              date: formatDate(activeSubscription.periodEnd?.toISOString()),
              autoFree: activeSubscription.cancelAtPeriodEnd ? 'yes' : 'no',
            })}
          </p>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-8 pt-8">
          <div className="flex items-center gap-4">
            <Label
              htmlFor="billing-toggle"
              className="text-foreground text-lg font-medium"
            >
              {t('billing.monthly')}
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-yellow-500"
            />
            <div className="flex items-center gap-2">
              <Label
                htmlFor="billing-toggle"
                className="text-foreground text-lg font-medium"
              >
                {t('billing.yearly')}
              </Label>
              <span className="inline-block rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500">
                {t('billing.save')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grille des plans - Approche Zapier */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availablePlans.map((plan) => {
          const isCurrent =
            plan.id === 'free'
              ? !activeSubscription // Pour le plan gratuit, on est "actuel" s'il n'y a pas d'abonnement du tout
              : isCurrentPlan(plan.id) // Pour les autres plans, logique normale
          // État spécial pour plan gratuit quand abonnement se termine
          const isFutureFree =
            plan.id === 'free' && activeSubscription?.cancelAtPeriodEnd
          // État spécial pour plan payant qui se termine
          const isEnding = isCurrent && activeSubscription?.cancelAtPeriodEnd

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrent ? 'ring-2 ring-blue-500' : ''} ${isFutureFree ? 'ring-2 ring-green-500' : ''} ${plan.popular && !isCurrent && !isFutureFree ? 'ring-2 ring-yellow-500' : ''}`}
            >
              {/* Badges selon l'état */}
              {isCurrent && !isEnding && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                  <Badge className="bg-blue-500">{t('badge.current')}</Badge>
                </div>
              )}
              {isEnding && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                  <Badge className="bg-orange-500">
                    {t('badge.endingOn', {
                      date: formatDate(
                        activeSubscription?.periodEnd?.toISOString()
                      ),
                    })}
                  </Badge>
                </div>
              )}
              {isFutureFree && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                  <Badge className="bg-green-500">
                    {t('badge.futureFree', {
                      date: formatDate(
                        activeSubscription?.periodEnd?.toISOString()
                      ),
                    })}
                  </Badge>
                </div>
              )}
              {plan.popular && !isCurrent && !isFutureFree && !isEnding && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                  <Badge className="bg-yellow-500 text-black">
                    {t('badge.popular')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <div className="mb-2 flex items-center justify-center space-x-2">
                  <div className={`rounded-full p-2 ${plan.color} text-white`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-bold">
                    {plan.id === 'free'
                      ? plan.priceDisplay
                      : `${formatPrice(calculatePrice(plan.id))}/${isYearly ? t('billing.perYear') : t('billing.perMonth')}`}
                  </div>
                  {isYearly && plan.id !== 'free' && (
                    <div className="text-sm text-yellow-500">
                      {t('billing.monthsFree')}
                    </div>
                  )}
                  {plan.id !== 'free' && selectedSeats[plan.id] > 1 && (
                    <div className="text-muted-foreground text-xs">
                      {formatPrice(
                        isYearly ? plan.yearlyPrice : (plan.price ?? 0)
                      )}{' '}
                      {t('billing.perUser')}
                    </div>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>

                {/* Informations de l'abonnement actuel */}
                {isCurrent && activeSubscription && !isEnding && (
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="text-muted-foreground flex items-center justify-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {t('nextBilling', {
                          date: formatDate(
                            activeSubscription.periodEnd?.toISOString()
                          ),
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {plan.features.map((feature: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Sélecteur de sièges - masqué pour le plan gratuit */}
                {plan.id !== 'free' && (
                  <div className="space-y-2 border-t pt-2">
                    <Label className="text-sm font-medium">
                      {t('seats.label')}
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={selectedSeats[plan.id]?.toString() || '1'}
                        onValueChange={(value) =>
                          setSelectedSeats((prev) => ({
                            ...prev,
                            [plan.id]: parseInt(value),
                          }))
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 50, 100].map(
                            (seats) => (
                              <SelectItem key={seats} value={seats.toString()}>
                                {seats}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground text-sm">
                        {t('seats.unit')}
                      </span>
                      {hasSeatsChanged(plan.id) && (
                        <Badge variant="outline" className="text-orange-600">
                          {t('badge.modified')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t('seats.priceNote')}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex-col space-y-2">
                {getActionButton(plan)}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Note d'information */}
      <div className="bg-muted/50 text-muted-foreground rounded-lg p-4 text-center text-sm">
        <p>{t('trialNote')}</p>
      </div>
    </div>
  )
}
