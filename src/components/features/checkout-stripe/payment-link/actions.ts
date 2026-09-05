'use server'

import {headers} from 'next/headers'

import {getPlanByPriceId, isYearlyPrice} from '@/app/dal/subscription-dal'
import {logger} from '@/lib/logger'
import {stripeClient} from '@/lib/stripe/stripe-client'
import {getAuthUser} from '@/services/authentication/auth-service'
import {initSubscriptionService} from '@/services/facades/subscription-service-facade'
import {SubscriptionPlan} from '@/services/types/domain/subscription-types'

// Types communs importés
import type {CheckoutResult, SubscriptionData} from '../checkout-stripe-util'
import {createCheckoutMetadata} from '../checkout-stripe-util'

// 🎯 Fonction principale refactorisée
export async function createPaymentLink(
  priceId: string,
  seats: number = 1,
  guest: boolean = true
): Promise<CheckoutResult> {
  logger.info('[PAYMENT-LINK] Création payment link démarrée')
  logger.debug('[PAYMENT-LINK] Paramètres reçus:', {priceId, seats, guest})

  try {
    // Récupérer l'utilisateur connecté (pour validation)
    const user = await getAuthUser()
    logger.debug('[PAYMENT-LINK] Utilisateur récupéré:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
    })

    // Valider le plan
    const plan = await getPlanByPriceId(priceId)
    if (!plan) {
      logger.error('[PAYMENT-LINK] ❌ Plan non trouvé pour priceId:', priceId)
      throw new Error('Plan not found')
    }
    logger.debug('[PAYMENT-LINK] Plan récupéré:', {
      planCode: plan.code,
      isRecurring: plan.isRecurring,
    })

    // 1️⃣ Validation du mode (payment link = guest uniquement)
    validatePaymentLinkMode(guest, user)

    // 2️⃣ Préparation structure plan
    const planData = {
      code: plan.code as SubscriptionPlan,
      isRecurring: plan.isRecurring,
    }

    // 3️⃣ Initialisation subscription si récurrent
    const subscriptionId = await initSubscriptionForPaymentLink(
      planData.code,
      planData.isRecurring,
      seats
    )
    const isYearly = await isYearlyPrice(plan.priceId)
    // 4️⃣ Préparation des données
    const subscriptionData: SubscriptionData = {
      subscriptionId,
      plan: planData,
      seats,
      isYearly,
    }

    // 4️⃣ Création metadata
    const metadata = createPaymentLinkMetadata(subscriptionData)

    // 5️⃣ Création payment link Stripe
    const paymentLink = await createStripePaymentLink(priceId, seats, metadata)

    return {
      success: true,
      url: paymentLink.url,
    }
  } catch (error) {
    logger.error(
      '[PAYMENT-LINK] ❌ Erreur lors de la création payment link:',
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 1️⃣ Validation du mode payment link (guest uniquement)
function validatePaymentLinkMode(guest: boolean, user: unknown): void {
  if (!guest) {
    logger.error(
      '[PAYMENT-LINK] ❌ Payment link seulement disponible en mode guest'
    )
    throw new Error('Payment link is only available for guest checkout')
  }

  if (user && !guest) {
    logger.warn(
      '[PAYMENT-LINK] ⚠️ Utilisateur connecté mais mode guest forcé pour payment link'
    )
  }

  logger.info(
    '[PAYMENT-LINK] 📋 Mode guest validé (obligatoire pour payment link)'
  )
}

// 2️⃣ Initialisation subscription pour payment link
async function initSubscriptionForPaymentLink(
  planCode: SubscriptionData['plan']['code'],
  isRecurring: boolean,
  seats: number
): Promise<string> {
  // Pour les plans non-récurrents, pas besoin de subscription en BDD
  if (!isRecurring) {
    logger.warn(
      "[PAYMENT-LINK] 💳 Plan one-time : pas d'initialisation subscription"
    )
    // pour le moment on creer la souscription meme si c un payment unique
    //return 'one-time-payment' // Identifiant symbolique
  }

  // Pour les plans récurrents, initialiser subscription en BDD
  logger.info(
    '[PAYMENT-LINK] 💾 Plan récurrent : initialisation subscription en BDD'
  )

  const subscriptionId = await initSubscriptionService({
    plan: planCode,
    seats,
    referenceId: undefined, // 🎯 Mode guest : referenceId sera undefined (cohérent avec embed/external)
    stripeCustomerId: undefined, // Pas de customer en mode guest
  })

  logger.debug('[PAYMENT-LINK] Subscription initialisée:', {subscriptionId})

  if (!subscriptionId) {
    logger.error(
      "[PAYMENT-LINK] ❌ Erreur lors de l'initialisation de la subscription"
    )
    throw new Error("Erreur lors de l'initialisation de la subscription")
  }

  return subscriptionId
}

// 3️⃣ Création des metadata spécifiques payment link
function createPaymentLinkMetadata(
  subscriptionData: SubscriptionData
): Record<string, string> {
  // Utilise la fonction commune avec checkoutType 'payment-link'
  return createCheckoutMetadata(
    'guest', // Mode toujours guest pour payment link
    subscriptionData,
    {customerId: undefined, customerEmail: undefined, user: undefined}, // Pas de customer
    'payment-link'
  )
}

// 4️⃣ Création du payment link Stripe
async function createStripePaymentLink(
  priceId: string,
  seats: number,
  metadata: Record<string, string>
): Promise<{url: string}> {
  logger.info('[PAYMENT-LINK] 🔧 Création payment link Stripe')

  const headersList = await headers()
  const origin = headersList.get('origin') || ''

  const paymentLink = await stripeClient.paymentLinks.create({
    line_items: [
      {
        price: priceId,
        quantity: seats,
      },
    ],
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `${origin}/checkout/success?redirect_status=succeeded`,
      },
    },
    metadata,
  })

  logger.info('✅ [PAYMENT-LINK] Payment link créé avec succès')
  logger.debug('[PAYMENT-LINK] Détails payment link:', {
    url: paymentLink.url,
    id: paymentLink.id,
    metadata: paymentLink.metadata,
  })

  return paymentLink
}
