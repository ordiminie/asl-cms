import Stripe from 'stripe'

import {getPlanByPriceId} from '@/app/dal/subscription-dal'
import {PriceRecap} from '@/components/features/checkout-stripe/actions'

import {stripeClient} from './stripe-client'

/**
 * Récupère le priceId à partir d'un subscriptionId
 * @param subscriptionId - L'ID de l'abonnement Stripe
 * @returns Le priceId de l'abonnement ou null si non trouvé
 */
export async function getPriceIdFromSubscriptionId(
  subscriptionId: string
): Promise<string | null> {
  try {
    const subscription =
      await stripeClient.subscriptions.retrieve(subscriptionId)

    // Récupérer le premier item de l'abonnement (normalement il n'y en a qu'un)
    const firstItem = subscription.items.data[0]

    if (firstItem && firstItem.price && firstItem.price.id) {
      return firstItem.price.id
    }

    return null
  } catch (error) {
    console.error('Erreur lors de la récupération du priceId:', error)
    return null
  }
}

/**
 * Récupère les détails complets d'un abonnement
 * @param subscriptionId - L'ID de l'abonnement Stripe
 * @returns Les détails de l'abonnement ou null si non trouvé
 */
export async function getSubscriptionDetails(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId)
  return subscription
}

/**
 * Récupère le prix formaté depuis un objet Stripe subscription
 * @param stripeSubscription - L'objet Stripe subscription
 * @returns Le prix formaté avec devise et fréquence
 */
export function getFormattedPriceFromSubscription(
  stripeSubscription: Stripe.Subscription | null
): string {
  if (!stripeSubscription?.items?.data?.[0]?.price) {
    return 'Non défini'
  }

  const priceObject = stripeSubscription.items.data[0].price
  const quantity = stripeSubscription.items.data[0].quantity || 1

  // Récupérer le montant unitaire (en centimes)
  const unitAmount = priceObject.unit_amount || 0

  // Convertir en euros (diviser par 100 pour les centimes)
  const unitPrice = unitAmount / 100

  // Calculer le prix total avec la quantité
  const totalPrice = unitPrice * quantity

  // Récupérer la devise
  const currency = priceObject.currency?.toUpperCase() || 'EUR'

  // Récupérer la fréquence
  const interval = priceObject.recurring?.interval
  let frequencyText = ''

  switch (interval) {
    case 'month':
      frequencyText = '/mois'
      break
    case 'year':
      frequencyText = '/an'
      break
    case 'day':
      frequencyText = '/jour'
      break
    case 'week':
      frequencyText = '/semaine'
      break
    default:
      frequencyText = priceObject.recurring ? '/période' : ''
  }

  return `${totalPrice}${currency === 'EUR' ? '€' : ` ${currency}`}${frequencyText}`
}

/**
 * Récupère les informations détaillées d'un abonnement Stripe
 * @param stripeSubscription - L'objet Stripe subscription
 * @returns Les informations détaillées de l'abonnement
 */
export function getSubscriptionInfo(
  stripeSubscription: Stripe.Subscription | null
): {
  price: string
  quantity: number
  currency: string
  interval: string | null
  priceId: string | null
  unitAmount: number
} {
  if (!stripeSubscription?.items?.data?.[0]?.price) {
    return {
      price: 'Non défini',
      quantity: 0,
      currency: 'EUR',
      interval: null,
      priceId: null,
      unitAmount: 0,
    }
  }

  const priceObject = stripeSubscription.items.data[0].price
  const quantity = stripeSubscription.items.data[0].quantity || 1
  const unitAmount = priceObject.unit_amount || 0
  const currency = priceObject.currency?.toUpperCase() || 'EUR'
  const interval = priceObject.recurring?.interval || null
  const priceId = priceObject.id

  return {
    price: getFormattedPriceFromSubscription(stripeSubscription),
    quantity,
    currency,
    interval,
    priceId,
    unitAmount: unitAmount / 100, // Convertir en unité monétaire
  }
}

export async function getSubscriptionRecap(
  priceId: string,
  couponCode?: string,
  seats: number = 1
) {
  try {
    const plan = await getPlanByPriceId(priceId)
    // Récupérer les détails du prix
    const price = await stripeClient.prices.retrieve(priceId, {
      expand: ['product'], // Inclure les détails du produit associé
    })

    // Extraire le produit depuis le prix
    const product = price.product as Stripe.Product

    // Calculer le montant initial par siège
    const unitAmount = price.unit_amount || 0
    const unitOriginalPrice = unitAmount / 100 // Convertir les centimes en euros
    const unitFinalPrice = unitOriginalPrice
    let unitDiscount = 0
    let warning

    // Si un code promo est fourni, récupérer et appliquer la réduction
    if (couponCode) {
      try {
        const coupon = await stripeClient.coupons.retrieve(couponCode)

        if (coupon.valid) {
          if (coupon.amount_off) {
            // Réduction fixe en centimes par siège
            unitDiscount = coupon.amount_off / 100
          } else if (coupon.percent_off) {
            // Réduction en pourcentage par siège
            unitDiscount = (unitOriginalPrice * coupon.percent_off) / 100
          }
        }
      } catch (couponError) {
        console.warn('Error retrieving coupon:', couponError)
        // Continue sans appliquer de réduction si le coupon est invalide
        warning = 'Invalid coupon code'
      }
    }

    // Calculer les prix totaux avec le nombre de sièges
    const originalPrice = unitOriginalPrice * seats
    const discount = unitDiscount * seats
    const finalPrice = (unitFinalPrice - unitDiscount) * seats

    // Construire l'objet de récapitulatif

    return {
      success: true,
      recap: {
        priceId,
        planName: product.name,
        price: finalPrice,
        originalPrice,
        discount,
        description: product.description,
        features: product.metadata.features
          ? JSON.parse(product.metadata.features)
          : plan?.features,
        currency: price.currency,
        interval: price.recurring?.interval,
        intervalCount: price.recurring?.interval_count,
        seats,
        unitPrice: unitFinalPrice - unitDiscount,
        unitOriginalPrice,
        unitDiscount,
      } as PriceRecap,
      warning,
    }
  } catch (error) {
    console.error('Error getting stripe subscription recap:', error)
    throw error
  }
}
