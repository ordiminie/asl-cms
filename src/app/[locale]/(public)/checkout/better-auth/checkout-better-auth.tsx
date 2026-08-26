'use client'

import {Check, CreditCard, Loader2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {toast} from 'sonner'

import {type PriceRecap} from '@/components/features/checkout-stripe/actions'
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
import {authClient} from '@/lib/better-auth/auth-client'

interface CheckoutBetterAuthProps {
  initialPriceRecaps: {
    proMonthly: PriceRecap
    proYearly: PriceRecap
    entrepriseMonthly: PriceRecap
    entrepriseYearly: PriceRecap
  }
  /**
   * Qui est facturé. Résolu côté serveur : sans lui, `referenceMiddleware`
   * retombe sur `user.id` alors que la facturation peut être par organisation,
   * et l'abonnement créé n'est rattaché à personne de visible.
   */
  referenceId?: string
}

export default function CheckoutBetterAuth({
  initialPriceRecaps,
  referenceId,
}: CheckoutBetterAuthProps) {
  const t = useTranslations('CheckoutPlans')
  const [isUpgradingPro, setIsUpgradingPro] = useState(false)
  const [isUpgradingEnterprise, setIsUpgradingEnterprise] = useState(false)
  const [isYearly, setIsYearly] = useState(false)
  const [seats, setSeats] = useState(1)

  // Calcul des prix totaux avec le nombre de sièges
  const totalProMonthly = initialPriceRecaps.proMonthly.unitPrice * seats
  const totalProYearly = initialPriceRecaps.proYearly.unitPrice * seats
  const totalEntrepriseMonthly =
    initialPriceRecaps.entrepriseMonthly.unitPrice * seats
  const totalEntrepriseYearly =
    initialPriceRecaps.entrepriseYearly.unitPrice * seats
  const period = isYearly ? t('billing.yearly') : t('billing.monthly')

  const handleUpgradePro = async () => {
    try {
      setIsUpgradingPro(true)

      const {error} = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: '/checkout/success?redirect_status=succeeded',
        cancelUrl: '/pricing',
        // Le portail Stripe ne lit QUE `returnUrl` : `successUrl` et
        // `cancelUrl` ne servent qu'au Checkout. Sans lui, un client déjà
        // abonné revient sur l'accueil après son changement d'offre.
        returnUrl: '/account/billing/subscription',
        annual: isYearly,
        seats: seats,
        ...(referenceId ? {referenceId} : {}),
      })

      if (error) {
        toast.error(t('toast.error'), {
          description: error.message || error.statusText,
        })
        return
      }

      toast.success(t('toast.redirecting'))
    } catch (error) {
      console.error('Erreur lors de la mise à niveau Pro:', error)
      toast.error(t('toast.errorPro'))
    } finally {
      setIsUpgradingPro(false)
    }
  }

  const handleUpgradeEnterprise = async () => {
    try {
      setIsUpgradingEnterprise(true)

      const {error} = await authClient.subscription.upgrade({
        plan: 'enterprise',
        successUrl: '/checkout/success?redirect_status=succeeded',
        cancelUrl: '/pricing',
        // Le portail Stripe ne lit QUE `returnUrl` : `successUrl` et
        // `cancelUrl` ne servent qu'au Checkout. Sans lui, un client déjà
        // abonné revient sur l'accueil après son changement d'offre.
        returnUrl: '/account/billing/subscription',
        annual: isYearly,
        seats: seats,
        ...(referenceId ? {referenceId} : {}),
      })

      if (error) {
        toast.error(t('toast.error'), {
          description: error.message || error.statusText,
        })
        return
      }

      toast.success(t('toast.redirecting'))
    } catch (error) {
      console.error('Erreur lors de la mise à niveau Enterprise:', error)
      toast.error(t('toast.errorEnterprise'))
    } finally {
      setIsUpgradingEnterprise(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground mt-2">{t('subheading')}</p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {/* Carte FREE */}
        <Card className="relative">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('plans.free.name')}</CardTitle>
            <CardDescription>{t('plans.free.description')}</CardDescription>
            <div className="mt-4 text-5xl font-bold">$0</div>
            <div className="text-muted-foreground text-sm">
              {t('billing.free')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FeatureList features={t.raw('plans.free.features')} />
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              {t('plans.free.cta')}
            </Button>
          </CardFooter>
        </Card>

        {/* Carte PRO */}
        <Card className="relative border-yellow-500">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
            <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-medium text-black">
              {t('badge.mostPopular')}
            </span>
          </div>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('plans.pro.name')}</CardTitle>
            <CardDescription>{t('plans.pro.description')}</CardDescription>

            {/* Toggle annuel/mensuel */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <Label className="text-sm">{t('billing.monthly')}</Label>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t('billing.yearly')}</Label>
                {isYearly && (
                  <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-500">
                    {t('billing.discount')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 text-5xl font-bold">
              ${isYearly ? totalProYearly : totalProMonthly}
            </div>
            <div className="text-muted-foreground text-sm">
              {isYearly ? t('billing.perYear') : t('billing.perMonth')}
            </div>

            {/* Sélecteur minimaliste de sièges */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-muted-foreground text-xs">
                {t('billing.users')}
              </span>
              <Select
                value={seats.toString()}
                onValueChange={(value) => setSeats(parseInt(value))}
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
            {isYearly && (
              <div className="text-sm text-green-500">
                {t('billing.monthsFree')}
              </div>
            )}
            {seats > 1 && (
              <div className="text-muted-foreground mt-1 text-xs">
                $
                {isYearly
                  ? initialPriceRecaps.proYearly.unitPrice
                  : initialPriceRecaps.proMonthly.unitPrice}{' '}
                {t('billing.perUser')}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <FeatureList features={t.raw('plans.pro.features')} />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleUpgradePro}
              disabled={isUpgradingPro}
              className="w-full bg-yellow-500 text-black hover:bg-yellow-400"
              size="lg"
            >
              {isUpgradingPro ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('cta.redirecting')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('cta.subscribePro', {period})}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Carte ENTERPRISE */}
        <Card className="relative border-purple-500">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
            <span className="rounded-full bg-purple-500 px-3 py-1 text-sm font-medium text-white">
              {t('badge.enterprise')}
            </span>
          </div>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {t('plans.enterprise.name')}
            </CardTitle>
            <CardDescription>
              {t('plans.enterprise.description')}
            </CardDescription>

            {/* Toggle annuel/mensuel */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <Label className="text-sm">{t('billing.monthly')}</Label>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t('billing.yearly')}</Label>
                {isYearly && (
                  <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-500">
                    {t('billing.discount')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 text-5xl font-bold">
              ${isYearly ? totalEntrepriseYearly : totalEntrepriseMonthly}
            </div>
            <div className="text-muted-foreground text-sm">
              {isYearly ? t('billing.perYear') : t('billing.perMonth')}
            </div>

            {/* Sélecteur minimaliste de sièges */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-muted-foreground text-xs">
                {t('billing.users')}
              </span>
              <Select
                value={seats.toString()}
                onValueChange={(value) => setSeats(parseInt(value))}
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
            {isYearly && (
              <div className="text-sm text-green-500">
                {t('billing.monthsFree')}
              </div>
            )}
            {seats > 1 && (
              <div className="text-muted-foreground mt-1 text-xs">
                $
                {isYearly
                  ? initialPriceRecaps.entrepriseYearly.unitPrice
                  : initialPriceRecaps.entrepriseMonthly.unitPrice}{' '}
                {t('billing.perUser')}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <FeatureList features={t.raw('plans.enterprise.features')} />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleUpgradeEnterprise}
              disabled={isUpgradingEnterprise}
              className="w-full bg-purple-500 text-white hover:bg-purple-400"
              size="lg"
            >
              {isUpgradingEnterprise ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('cta.redirecting')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('cta.subscribeEnterprise', {period})}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <p className="text-muted-foreground mt-8 text-center text-xs">
        {t('secureNotice')}
      </p>
    </div>
  )
}

function FeatureList({features}: {features: string[]}) {
  return (
    <ul className="space-y-2 text-sm">
      {features.map((feature) => (
        <li key={feature} className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          {feature}
        </li>
      ))}
    </ul>
  )
}
