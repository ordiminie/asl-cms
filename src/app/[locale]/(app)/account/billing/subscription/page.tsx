import {CreditCard, Crown, Zap} from 'lucide-react'
import {notFound} from 'next/navigation'

import {
  getEntreprisePlan,
  getFreePlan,
  getProPlan,
} from '@/app/dal/subscription-dal'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

import SubscriptionPage from './subscription'

export default async function Page() {
  if (!isPageEnabled(PagesConst.SUBSCRIPTION)) {
    return notFound()
  }

  // Récupération des plans via le DAL
  const [planFree, planPro, planEntreprise] = await Promise.all([
    getFreePlan(),
    getProPlan(),
    getEntreprisePlan(),
  ])

  // Vérification que tous les plans sont disponibles
  if (!planFree || !planPro || !planEntreprise) {
    throw new Error('Impossible de charger les plans')
  }

  const availablePlans = [
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
  ]

  return <SubscriptionPage availablePlans={availablePlans} />
}
