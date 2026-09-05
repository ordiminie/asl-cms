import 'server-only'

import Stripe from 'stripe'

import {stripeClient} from '@/lib/stripe/stripe-client'

import {calculateInstallmentAmount} from './types'

// Fonction pour créer un Schedule Stripe pour les paiements en plusieurs fois
export async function createInstallmentSubscriptionSchedule(
  customerId: string,
  priceId: string,
  totalAmount: number,
  numberOfPayments: number,
  seats: number = 1,
  metadata: Record<string, string> = {}
) {
  const {installmentAmount, lastPaymentAmount} = calculateInstallmentAmount(
    totalAmount,
    numberOfPayments
  )

  // Récupérer le prix original pour obtenir la devise
  const originalPrice = await stripeClient.prices.retrieve(priceId)
  const currency = originalPrice.currency // Utiliser la devise du prix original

  // Créer un produit temporaire pour les échéanciers
  const product = await stripeClient.products.create({
    name: `Échéancier ${numberOfPayments}x`,
    metadata: {
      original_price_id: priceId,
      installment_type: 'custom_schedule',
      ...metadata,
    },
  })

  // Créer les prix pour chaque échéance (DOIVENT être récurrents pour Subscription Schedule)
  const installmentPrice = await stripeClient.prices.create({
    unit_amount: installmentAmount,
    currency: currency, // Utiliser la devise du prix original
    product: product.id,
    recurring: {
      interval: 'month', // OBLIGATOIRE : prix récurrent pour Subscription Schedule
    },
    metadata: {
      installment_type: 'regular',
      original_price_id: priceId,
    },
  })

  let lastPaymentPrice = installmentPrice
  if (lastPaymentAmount !== installmentAmount) {
    lastPaymentPrice = await stripeClient.prices.create({
      unit_amount: lastPaymentAmount,
      currency: currency, // Utiliser la devise du prix original
      product: product.id,
      recurring: {
        interval: 'month', // OBLIGATOIRE : prix récurrent pour Subscription Schedule
      },
      metadata: {
        installment_type: 'last_payment',
        original_price_id: priceId,
      },
    })
  }

  // Calculer les phases du schedule
  const phases: Stripe.SubscriptionScheduleCreateParams.Phase[] = []

  // Phase 1: Premier paiement (commence immédiatement)
  phases.push({
    items: [{price: installmentPrice.id, quantity: seats}],
    duration: {
      interval: 'month',
      interval_count: 1,
    },
  })

  // Phases intermédiaires (si il y en a)
  if (numberOfPayments > 2) {
    phases.push({
      items: [{price: installmentPrice.id, quantity: seats}],
      duration: {
        interval: 'month',
        interval_count: numberOfPayments - 2,
      },
    })
  }

  // Dernière phase (si montant différent)
  if (numberOfPayments > 1) {
    const finalPrice =
      lastPaymentAmount !== installmentAmount
        ? lastPaymentPrice
        : installmentPrice
    phases.push({
      items: [{price: finalPrice.id, quantity: seats}],
      duration: {
        interval: 'month',
        interval_count: 1,
      },
    })
  }

  // Créer le Subscription Schedule
  const currentDate = new Date()
  const schedule = await stripeClient.subscriptionSchedules.create({
    customer: customerId,
    start_date: Math.floor(currentDate.getTime() / 1000), // timestamp Unix
    end_behavior: 'cancel', // Annuler après les derniers paiements
    phases,
    metadata: {
      payment_type: 'installment',
      number_of_payments: numberOfPayments.toString(),
      total_amount: totalAmount.toString(),
      original_price_id: priceId,
      seats: seats.toString(),
      ...metadata,
      source: 'installment_checkout',
    },
  })

  return {
    schedule,
    product,
    installmentPrice,
    lastPaymentPrice,
  }
}
