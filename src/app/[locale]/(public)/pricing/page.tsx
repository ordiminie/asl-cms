import {CreditCard, Crown, Zap} from 'lucide-react'

import {
  getActiveSubscriptionsDal,
  getEntreprisePlan,
  getFreePlan,
  getLifetimePlan,
  getProPlan,
} from '@/app/dal/subscription-dal'
import PricingPlans from '@/components/features/payment/pricing'
import {AvailablePlan} from '@/lib/stripe/stripe-types'
import {getSubscriptionRecap} from '@/lib/stripe/stripe-utils'
import {getAuthUser} from '@/services/authentication/auth-service'

export default async function Page() {
  const user = await getAuthUser()
  const userSubscriptions = user ? await getActiveSubscriptionsDal() : []

  // Récupération des plans via le DAL
  const [planFree, planPro, planEntreprise, planLifetime] = await Promise.all([
    getFreePlan(),
    getProPlan(),
    getEntreprisePlan(),
    getLifetimePlan(),
  ])

  // Vérification que tous les plans sont disponibles
  if (!planFree || !planPro || !planEntreprise) {
    throw new Error('Impossible de charger les plans')
  }

  const priceProMonthly = await getSubscriptionRecap(planPro?.priceId)
  const priceProYearly = await getSubscriptionRecap(
    planPro?.annualDiscountPriceId as string
  )

  const priceEntrepriseMonthly = await getSubscriptionRecap(
    planEntreprise?.priceId
  )
  const priceEntrepriseYearly = await getSubscriptionRecap(
    planEntreprise?.annualDiscountPriceId as string
  )
  const priceLifetime = await getSubscriptionRecap(
    planLifetime?.priceId as string
  )

  const availablePlans: AvailablePlan[] = [
    {
      id: planFree.code,
      name: 'Gratuit',
      price: planFree.price ? parseFloat(planFree.price) : null,
      yearlyPrice: planFree.yearlyPrice ? parseFloat(planFree.yearlyPrice) : 0,
      priceDisplay: '€0/mois',
      yearlyPriceDisplay: '€0/an',
      description: 'Idéal pour débuter',
      features: planFree.features as string[],
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-gray-500',
      popular: false,
    },
    {
      id: planPro.code,
      name: 'Pro',
      price: planPro.price ? parseFloat(planPro.price) : null,
      yearlyPrice: planPro.yearlyPrice ? parseFloat(planPro.yearlyPrice) : 0,
      priceDisplay: '€29/mois',
      yearlyPriceDisplay: '€249/an',
      description: 'Parfait pour les équipes en croissance',
      features: planPro.features as string[],
      icon: <Crown className="h-5 w-5" />,
      color: 'bg-blue-500',
      popular: true,
    },
    {
      id: planEntreprise.code,
      name: 'Enterprise',
      price: planEntreprise.price ? parseFloat(planEntreprise.price) : null,
      yearlyPrice: planEntreprise.yearlyPrice
        ? parseFloat(planEntreprise.yearlyPrice)
        : 0,
      priceDisplay: '€99/mois',
      yearlyPriceDisplay: '€990/an',
      description: 'Pour les grandes organisations',
      features: planEntreprise.features as string[],
      icon: <CreditCard className="h-5 w-5" />,
      color: 'bg-purple-500',
      popular: false,
    },
    {
      id: planLifetime?.code || '',
      name: 'Lifetime',
      price: planLifetime?.price ? parseFloat(planLifetime.price) : null,
      yearlyPrice: planLifetime?.yearlyPrice
        ? parseFloat(planLifetime.yearlyPrice)
        : 0,
      priceDisplay: '€199/once',
      yearlyPriceDisplay: '€199/once',
      description: 'Pour les longues durées',
      features: (planLifetime?.features as string[]) || [],
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-gray-500',
      popular: false,
    },
  ]

  return (
    <PricingPlans
      subscriptions={userSubscriptions}
      priceProMonthly={priceProMonthly.recap}
      priceProYearly={priceProYearly.recap}
      priceLifetime={priceLifetime.recap}
      priceEntrepriseMonthly={priceEntrepriseMonthly.recap}
      priceEntrepriseYearly={priceEntrepriseYearly.recap}
      availablePlans={availablePlans}
    />
  )
}
