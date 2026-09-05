'use client'
import {motion} from 'framer-motion'
import {Check} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import React from 'react'
import {toast} from 'sonner'

import {PriceRecap} from '@/components/features/checkout-stripe/actions'
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
import {env} from '@/env'
import {authClient} from '@/lib/better-auth/auth-client'
import {AvailablePlan} from '@/lib/stripe/stripe-types'

// Type pour les subscriptions venant de Better Auth
type ActiveSubscription = {
  id: string
  plan: string
  status?: string
  /** L'id Stripe (`sub_…`), seul accepté par le plugin — jamais `id`. */
  stripeSubscriptionId?: string | null
  referenceId?: string
  cancelAtPeriodEnd?: boolean
  /** Date d'annulation programmée : Stripe la pose au lieu du booléen. */
  cancelAt?: string | Date | null
  periodEnd?: string | Date | null
  /** 'month' | 'year', écrit par le plugin depuis le prix Stripe. */
  billingInterval?: string | null
  [key: string]: unknown // Permet d'autres propriétés sans contraintes
}

/**
 * Quel tunnel de paiement le CTA déclenche.
 *
 * - `better-auth` : le mode par DÉFAUT de /pricing, et le seul qui doive
 *   fonctionner à 100 %. Connecté -> `authClient.subscription.upgrade()` ;
 *   non connecté -> inscription, car la route `/subscription/upgrade` du plugin
 *   passe par `sessionMiddleware` et répond 401 sans session.
 *   Quand `NEXT_PUBLIC_GUEST_CHECKOUT_ENABLED` est actif, et seulement dans ce
 *   cas, le visiteur non connecté est envoyé sur le tunnel maison plutôt que
 *   sur l'inscription. C'est l'UNIQUE endroit du produit qui lit ce drapeau :
 *   le remettre à `false` suffit à retirer le mode invité.
 * - `custom` : l'ancien tunnel maison pour tout le monde, conservé sur
 *   /pricing_old. Il ne sait pas REMPLACER un abonnement, seulement en ajouter
 *   un — un client Pro qui y choisit Enterprise se retrouve avec les deux,
 *   facturés.
 *
 * Les deux modes partagent la même grille : toute divergence visuelle est un
 * bug, pas un choix.
 */
export type PricingCheckoutMode = 'custom' | 'better-auth'

/**
 * Plans que le plugin Better Auth sait piloter. `lifetime` en est exclu : il
 * est `is_recurring = false` en base, donc un paiement unique, là où le plugin
 * ouvre systématiquement un Checkout Stripe en mode `subscription`. Sa carte
 * reste donc sur le tunnel maison, dans les deux modes.
 */
type BetterAuthPlanKey = 'pro' | 'enterprise'

export default function PricingPlans({
  priceProMonthly,
  priceProYearly,
  priceLifetime,
  priceEntrepriseMonthly,
  priceEntrepriseYearly,
  subscriptions,
  availablePlans,
  checkoutMode = 'custom',
  referenceId,
}: {
  priceProMonthly?: PriceRecap
  priceProYearly?: PriceRecap
  priceLifetime?: PriceRecap
  priceEntrepriseMonthly?: PriceRecap
  priceEntrepriseYearly?: PriceRecap
  subscriptions?: ActiveSubscription[]
  availablePlans: AvailablePlan[]
  checkoutMode?: PricingCheckoutMode
  /**
   * Qui est facturé : l'organisation en mode `organization`, l'utilisateur
   * sinon. Résolu côté serveur par `getSessionReferenceId()` — le hook
   * `useOrganization` n'est pas disponible ici, son provider ne couvrant que
   * l'espace connecté. Sans lui, `referenceMiddleware` retomberait sur
   * `user.id` et l'abonnement serait invisible de l'application.
   */
  referenceId?: string
}) {
  const t = useTranslations('Pricing')
  // Mêmes libellés que /account/billing/subscription : les deux écrans offrent
  // désormais les mêmes actions, ils ne doivent pas les nommer autrement.
  const tb = useTranslations('Subscription')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const {data: session} = authClient.useSession()

  const [pendingPlan, setPendingPlan] = React.useState<
    BetterAuthPlanKey | undefined
  >()
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)

  const isBetterAuth = checkoutMode === 'better-auth'

  /** L'abonnement qui fait foi pour l'état des boutons. */
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  )
  const currentPlan = activeSubscription?.plan || 'free'

  /**
   * En attente d'annulation. Reprend `isPendingCancel` du plugin :
   *
   *   !!(sub.cancelAtPeriodEnd || sub.cancelAt)
   *
   * Stripe ne bascule plus le booléen `cancel_at_period_end` — il pose une DATE
   * `cancel_at`. Tester le seul booléen laissait le bouton « Annuler » sur un
   * abonnement déjà résilié.
   */
  const isPendingCancel = Boolean(
    activeSubscription?.cancelAtPeriodEnd || activeSubscription?.cancelAt
  )

  /** Date de fin effective : `cancelAt` prime sur la fin de période. */
  const cancelEffectiveAt =
    activeSubscription?.cancelAt ?? activeSubscription?.periodEnd

  const formatPeriodEnd = (value?: string | Date | null) =>
    value ? new Date(value).toLocaleDateString(locale) : ''

  const [isYearly, setIsYearly] = React.useState(false)
  const [seatsByPlan, setSeatsByPlan] = React.useState({
    pro: 1,
    entreprise: 1,
    lifetime: 1,
  })

  // Fonction pour mettre à jour les sièges d'un plan spécifique
  const updateSeats = (
    plan: 'pro' | 'entreprise' | 'lifetime',
    seats: number
  ) => {
    setSeatsByPlan((prev) => ({
      ...prev,
      [plan]: seats,
    }))
  }

  // Calcul des prix totaux avec le nombre de sièges spécifique à chaque plan
  const totalProMonthly = (priceProMonthly?.price || 0) * seatsByPlan.pro
  const totalProYearly = (priceProYearly?.price || 0) * seatsByPlan.pro
  const totalLifetime = (priceLifetime?.price || 0) * seatsByPlan.lifetime
  const totalEntrepriseMonthly =
    (priceEntrepriseMonthly?.price || 0) * seatsByPlan.entreprise
  const totalEntrepriseYearly =
    (priceEntrepriseYearly?.price || 0) * seatsByPlan.entreprise

  const prices = {
    pro: {
      monthly: totalProMonthly,
      yearly: totalProYearly,
      priceId: isYearly ? priceProYearly?.priceId : priceProMonthly?.priceId,
    },
    entreprise: {
      monthly: totalEntrepriseMonthly,
      yearly: totalEntrepriseYearly,
      priceId: isYearly
        ? priceEntrepriseYearly?.priceId
        : priceEntrepriseMonthly?.priceId,
    },
    lifetime: {
      monthly: totalLifetime,
      yearly: totalLifetime,
      priceId: isYearly ? priceLifetime?.priceId : priceLifetime?.priceId,
    },
  }
  const linkFree = session ? '/dashboard' : '/login'
  const linkPro = session
    ? `/checkout/${prices.pro?.priceId}?seats=${seatsByPlan.pro}`
    : `/checkout/${prices.pro?.priceId}?guest=true&seats=${seatsByPlan.pro}`
  const linkEntreprise = session
    ? `/checkout/${prices.entreprise?.priceId}?seats=${seatsByPlan.entreprise}`
    : `/checkout/${prices.entreprise?.priceId}?guest=true&seats=${seatsByPlan.entreprise}`
  const linkLifetime = session
    ? `/checkout/${prices.lifetime?.priceId}?seats=${seatsByPlan.lifetime}`
    : `/checkout/${prices.lifetime?.priceId}?guest=true&seats=${seatsByPlan.lifetime}`

  /**
   * Achat sans compte. C'est l'UNIQUE endroit du produit qui lit le drapeau :
   * à `false`, le visiteur non connecté part sur /register et il ne reste
   * aucune trace du mode invité dans le parcours.
   */
  const guestCheckoutLink = (priceId?: string, seats = 1) => {
    if (!env.NEXT_PUBLIC_GUEST_CHECKOUT_ENABLED || !priceId) {
      return undefined
    }
    return `/checkout/${priceId}?guest=true&seats=${seats}`
  }

  /**
   * Reprend VERBATIM le contrat de /account/billing/subscription, le seul
   * chemin vérifié en production :
   *
   * - le plan est désigné par son CODE (`pro`, `enterprise`), jamais par un
   *   priceId — le plugin fait la correspondance via le catalogue de `auth.ts` ;
   * - `subscriptionId` est l'id STRIPE (`sub_…`). Passer l'id de notre ligne
   *   lève SUBSCRIPTION_NOT_FOUND avant même d'atteindre le portail ;
   * - `returnUrl` est le SEUL paramètre que le portail lit. Sans lui le client
   *   revient sur l'accueil après son changement d'offre ;
   * - `referenceId` est toujours transmis : le plugin vérifie qu'il concorde
   *   avec celui de l'abonnement ciblé.
   *
   * Le plugin choisit ensuite tout seul : pas d'abonnement actif -> Checkout
   * Stripe ; abonnement actif -> portail Stripe en `subscription_update_confirm`,
   * qui gère le changement de plan, le mensuel/annuel et la proration.
   */
  const handleBetterAuthUpgrade = async (
    plan: BetterAuthPlanKey,
    seats: number
  ) => {
    setPendingPlan(plan)

    const {error} = await authClient.subscription.upgrade({
      plan,
      annual: isYearly,
      seats,
      successUrl: '/account/billing/subscription',
      cancelUrl: '/pricing',
      returnUrl: '/account/billing/subscription',
      // Repli sans id Stripe (webhook perdu) : la route retrouve l'abonnement
      // actif par `referenceId` plutôt que d'échouer.
      ...(activeSubscription?.stripeSubscriptionId
        ? {subscriptionId: activeSubscription.stripeSubscriptionId}
        : {}),
      ...(referenceId ? {referenceId} : {}),
    })

    // Pas de reset en cas de succès : la page est en train d'être remplacée par
    // la redirection Stripe, remettre le bouton à l'état normal ferait clignoter.
    if (error) {
      setPendingPlan(undefined)
      toast.error(tb('errors.updateFailed'), {
        description: error.message ?? error.statusText,
      })
    }
  }

  /** Ouvre le portail Stripe en flux d'annulation. */
  const handleCancel = async () => {
    setActionLoading('cancel')
    const {data, error} = await authClient.subscription.cancel({
      returnUrl: '/pricing',
      ...(activeSubscription?.referenceId
        ? {referenceId: activeSubscription.referenceId}
        : referenceId
          ? {referenceId}
          : {}),
    })

    if (error) {
      setActionLoading(null)
      toast.error(tb('errors.cancelFailed'), {
        description: error.message ?? error.statusText,
      })
      return
    }
    if (data?.url) {
      window.location.assign(data.url)
      return
    }
    setActionLoading(null)
  }

  /** Reprend un abonnement marqué pour annulation en fin de période. */
  const handleRestore = async () => {
    setActionLoading('restore')
    // Meme contrat que l'ecran de facturation : sans `referenceId`, la route
    // cherche un abonnement rattache a `user.id` et leve SUBSCRIPTION_NOT_FOUND.
    const {error} = await authClient.subscription.restore({
      ...(activeSubscription?.stripeSubscriptionId
        ? {subscriptionId: activeSubscription.stripeSubscriptionId}
        : {}),
      ...(referenceId ? {referenceId} : {}),
    })

    setActionLoading(null)
    if (error) {
      toast.error(tb('errors.restoreFailed'), {
        description: error.message ?? error.statusText,
      })
    }
  }

  /**
   * Le plan courant se lit sur l'abonnement actif, par son CODE — celui de la
   * base (`free` | `pro` | `enterprise` | `lifetime`). L'ancienne version
   * comparait a `'entreprise'`, orthographe qui n'existe nulle part en base :
   * la pastille ne s'affichait jamais sur cette carte.
   */
  const isCurrentPlan = (
    planType: 'free' | 'pro' | 'enterprise' | 'lifetime'
  ) => {
    if (planType === 'free') {
      return Boolean(session) && !activeSubscription
    }
    return currentPlan === planType
  }

  /**
   * Même offre, mais le visiteur a basculé le cycle : c'est une mise à jour,
   * pas une annulation. Sans ce cas, un client Pro mensuel qui clique
   * « Annuel » ne voit que « Annuler » et n'a aucun moyen de passer à l'année.
   */
  const hasCycleChanged = (planType: BetterAuthPlanKey) =>
    isCurrentPlan(planType) &&
    isYearly !== (activeSubscription?.billingInterval === 'year')

  const planLabel = (planKey: BetterAuthPlanKey) =>
    planKey === 'pro' ? t('plans.pro.name') : t('plans.enterprise.name')

  /**
   * Pastille de la carte. Une offre qui se termine l'annonce AVEC SA DATE :
   * c'est l'information la plus importante de l'écran à ce moment-là, elle
   * prime donc sur « plan actuel » comme sur « le plus populaire ».
   */
  const planBadge = (
    planType: 'free' | 'pro' | 'enterprise' | 'lifetime',
    fallback?: React.ReactNode
  ) => {
    if (isCurrentPlan(planType) && isPendingCancel) {
      return (
        <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-black">
          {tb('badge.endingOn', {date: formatPeriodEnd(cancelEffectiveAt)})}
        </span>
      )
    }
    if (isCurrentPlan(planType)) {
      return (
        <span className="rounded-full bg-green-500 px-3 py-1 text-sm font-medium text-black">
          {t('badge.currentPlan')}
        </span>
      )
    }
    return fallback
  }

  /**
   * Le CTA est le SEUL point qui change entre les modes et les états.
   *
   * En mode `better-auth` connecté, on reprend la machine à états de
   * /account/billing/subscription : un client déjà abonné doit pouvoir annuler
   * ou reprendre son offre, et ne doit jamais se voir proposer de racheter ce
   * qu'il paie déjà.
   */
  const renderCta = ({
    planKey,
    href,
    label,
    className,
    variant,
    seats = 1,
  }: {
    /** `undefined` = carte gratuite ; `lifetime` = paiement unique, hors plugin. */
    planKey?: BetterAuthPlanKey | 'lifetime'
    href: string
    label: string
    className?: string
    variant?: 'default' | 'outline' | 'destructive'
    seats?: number
  }) => {
    const asLink = (
      <Link href={href} className="w-full">
        <Button variant={variant} className={className}>
          {label}
        </Button>
      </Link>
    )

    // Mode maison : tout le monde passe par /checkout/[priceId].
    if (!isBetterAuth) {
      return asLink
    }

    // `lifetime` est un paiement unique : le plugin ne sait pas l'ouvrir, la
    // carte reste sur le tunnel maison même en mode better-auth.
    if (planKey === 'lifetime') {
      return asLink
    }

    // Sans session le plugin répondrait 401. Deux issues, et une seule
    // condition dans tout le produit : achat invité si le drapeau est actif,
    // inscription sinon.
    if (!session) {
      if (!planKey) {
        return asLink
      }
      const priceId =
        planKey === 'pro' ? prices.pro.priceId : prices.entreprise.priceId
      return (
        <Link
          href={guestCheckoutLink(priceId, seats) ?? '/register'}
          className="w-full"
        >
          <Button variant={variant} className={className}>
            {label}
          </Button>
        </Link>
      )
    }

    const busy = actionLoading !== null || pendingPlan !== undefined

    // Carte Gratuit : état courant, date de bascule, ou retour au gratuit.
    if (!planKey) {
      if (!activeSubscription) {
        return (
          <Button variant="outline" disabled className={className}>
            {tb('badge.current')}
          </Button>
        )
      }
      if (isPendingCancel) {
        return (
          <Button variant="outline" disabled className={className}>
            {tb('actions.startingFrom', {
              date: formatPeriodEnd(cancelEffectiveAt),
            })}
          </Button>
        )
      }
      // Pas de rouge ici : « Annuler » sur l'offre en cours porte deja
      // l'action destructrice, deux boutons rouges diluent le signal.
      return (
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={busy}
          className={className}
        >
          {actionLoading === 'cancel'
            ? tb('actions.canceling')
            : tb('actions.downgradeFree')}
        </Button>
      )
    }

    const isCurrent = isCurrentPlan(planKey)
    const cycleChanged = hasCycleChanged(planKey)

    // Son offre, inchangée : annuler, ou reprendre si l'annulation est posée.
    if (isCurrent && !cycleChanged) {
      if (isPendingCancel) {
        return (
          <Button onClick={handleRestore} disabled={busy} className={className}>
            {actionLoading === 'restore'
              ? tb('actions.restoring')
              : tb('actions.continuePlan', {
                  plan: planLabel(planKey),
                })}
          </Button>
        )
      }
      return (
        <Button
          variant="destructive"
          onClick={handleCancel}
          disabled={busy}
          className={className}
        >
          {actionLoading === 'cancel'
            ? tb('actions.canceling')
            : tCommon('actions.cancel')}
        </Button>
      )
    }

    return (
      <Button
        variant={variant}
        className={className}
        disabled={busy}
        onClick={() => handleBetterAuthUpgrade(planKey, seats)}
      >
        {pendingPlan === planKey
          ? cycleChanged
            ? tb('actions.updating')
            : tb('actions.redirecting')
          : cycleChanged
            ? tb('actions.update')
            : activeSubscription
              ? tb('actions.switchTo', {plan: planLabel(planKey)})
              : label}
      </Button>
    )
  }

  return (
    <div className="bg-background min-h-screen py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 space-y-4 text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tighter sm:text-5xl">
            {t('heading')}
          </h2>
          <p className="text-muted-foreground mx-auto max-w-[600px] md:text-xl/relaxed">
            {t('subheading')}
          </p>

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

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Free Plan */}
          <Card className="border-border bg-card text-foreground relative">
            {planBadge('free') && (
              <div className="absolute -top-4 right-0 left-0 flex justify-center">
                {planBadge('free')}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{t('plans.free.name')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('plans.free.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <motion.div
                className="text-4xl font-bold"
                key={`free-${isYearly}`}
                initial={{y: 10, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                transition={{duration: 1}}
              >
                $0
              </motion.div>
              <ul className="space-y-2 text-sm">
                {availablePlans[0].features.map((feature, index) => (
                  <ListItem key={index}>{feature}</ListItem>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderCta({
                href: linkFree,
                label: t('cta.getStarted'),
                className:
                  'bg-background text-foreground border-input hover:bg-muted w-full border',
              })}
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-card text-foreground relative border-yellow-500">
            <div className="absolute -top-4 right-0 left-0 flex justify-center">
              {planBadge(
                'pro',
                <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-medium text-black">
                  {t('badge.mostPopular')}
                </span>
              )}
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">{t('plans.pro.name')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('plans.pro.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <motion.div
                  className="text-4xl font-bold"
                  key={`pro-${isYearly}-${seatsByPlan.pro}`}
                  initial={{y: 10, opacity: 0}}
                  animate={{y: 0, opacity: 1}}
                  transition={{duration: 0.3}}
                >
                  ${isYearly ? prices.pro.yearly : prices.pro.monthly}
                </motion.div>
                <div className="text-muted-foreground text-sm">
                  {isYearly ? t('perYear') : t('perMonth')}
                </div>
                {isYearly && (
                  <div className="text-sm text-yellow-500">
                    {t('monthsFree')}
                  </div>
                )}

                {/* Sélecteur de sièges */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('users')}
                  </span>
                  <Select
                    value={seatsByPlan.pro.toString()}
                    onValueChange={(value) =>
                      updateSeats('pro', parseInt(value))
                    }
                  >
                    <SelectTrigger className="h-6 w-12 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 10}, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {seatsByPlan.pro > 1 && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    ${isYearly ? priceProYearly?.price : priceProMonthly?.price}{' '}
                    {t('perUser')}
                  </div>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                {availablePlans[1].features.map((feature, index) => (
                  <ListItem key={index}>{feature}</ListItem>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderCta({
                planKey: 'pro',
                href: linkPro,
                label: t('cta.subscribe'),
                className:
                  'w-full bg-yellow-500 text-black hover:bg-yellow-400',
                seats: seatsByPlan.pro,
              })}
            </CardFooter>
          </Card>

          {/* Enterprise Plan */}
          <Card className="border-border bg-card text-foreground relative">
            {planBadge('enterprise') && (
              <div className="absolute -top-4 right-0 left-0 flex justify-center">
                {planBadge('enterprise')}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">
                {t('plans.enterprise.name')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('plans.enterprise.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <motion.div
                  className="text-4xl font-bold"
                  key={`entreprise-${isYearly}-${seatsByPlan.entreprise}`}
                  initial={{y: 10, opacity: 0}}
                  animate={{y: 0, opacity: 1}}
                  transition={{duration: 0.3}}
                >
                  $
                  {isYearly
                    ? prices.entreprise.yearly
                    : prices.entreprise.monthly}
                </motion.div>
                <div className="text-muted-foreground text-sm">
                  {isYearly ? t('perYear') : t('perMonth')}
                </div>

                {/* Sélecteur de sièges */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('users')}
                  </span>
                  <Select
                    value={seatsByPlan.entreprise.toString()}
                    onValueChange={(value) =>
                      updateSeats('entreprise', parseInt(value))
                    }
                  >
                    <SelectTrigger className="h-6 w-12 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({length: 10}, (_, i) => i + 1).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {seatsByPlan.entreprise > 1 && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    $
                    {isYearly
                      ? priceEntrepriseYearly?.price
                      : priceEntrepriseMonthly?.price}{' '}
                    {t('perUser')}
                  </div>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                {availablePlans[2].features.map((feature, index) => (
                  <ListItem key={index}>{feature}</ListItem>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderCta({
                planKey: 'enterprise',
                href: linkEntreprise,
                label: t('cta.subscribe'),
                className:
                  'bg-background text-foreground border-input hover:bg-muted w-full border',
                seats: seatsByPlan.entreprise,
              })}
            </CardFooter>
          </Card>

          {/* Lifetime Plan */}
          <Card className="border-border bg-card text-foreground relative">
            {planBadge('lifetime') && (
              <div className="absolute -top-4 right-0 left-0 flex justify-center">
                {planBadge('lifetime')}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">
                {t('plans.lifetime.name')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('plans.lifetime.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <motion.div
                  className="text-4xl font-bold"
                  key={`lifetime-${isYearly}-${seatsByPlan.lifetime}`}
                  initial={{y: 10, opacity: 0}}
                  animate={{y: 0, opacity: 1}}
                  transition={{duration: 0.3}}
                >
                  ${prices.lifetime.monthly}
                </motion.div>
                <div className="text-muted-foreground text-sm">
                  {t('oneTimePayment')}
                </div>

                {seatsByPlan.lifetime > 1 && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    ${priceLifetime?.price} {t('perUser')}
                  </div>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                {availablePlans[3].features.map((feature, index) => (
                  <ListItem key={index}>{feature}</ListItem>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderCta({
                planKey: 'lifetime',
                href: linkLifetime,
                label: t('cta.buyLifetime'),
                className:
                  'bg-background text-foreground border-input hover:bg-muted w-full border',
              })}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ListItem({children}: {children: React.ReactNode}) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-yellow-500" />
      <span>{children}</span>
    </li>
  )
}
