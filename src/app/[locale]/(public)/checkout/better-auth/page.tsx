import {connection} from 'next/server'

import {
  getEntreprisePlan,
  getFreePlan,
  getLifetimePlan,
  getProPlan,
} from '@/app/dal/subscription-dal'
import {getSubscriptionRecap} from '@/lib/stripe/stripe-utils'

import CheckoutBetterAuth from './checkout-better-auth'

// Tunnel de paiement : dynamique par nature (prix, session utilisateur).
export const instant = false

export default async function Page() {
  // Le SDK Stripe lit `Date.now()` à chaque appel, ce qui est interdit au
  // prerender. `instant = false` ne suffit pas : il autorise une route
  // bloquante, pas la lecture de l'horloge. Il faut marquer explicitement le
  // rendu comme fait à la requête.
  await connection()

  // permet un gestion dynamique des prix (si modifié coté dashboard stripe)
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

  const initialPriceRecaps = {
    proMonthly: priceProMonthly.recap,
    proYearly: priceProYearly.recap,
    lifetime: priceLifetime.recap,
    entrepriseMonthly: priceEntrepriseMonthly.recap,
    entrepriseYearly: priceEntrepriseYearly.recap,
  }

  return <CheckoutBetterAuth initialPriceRecaps={initialPriceRecaps} />
}
