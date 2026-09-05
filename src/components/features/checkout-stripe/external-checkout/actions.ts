'use server'

import {headers} from 'next/headers'

import {getPlanByPriceId, isYearlyPrice} from '@/app/dal/subscription-dal'
import {logger} from '@/lib/logger'
import {stripeClient} from '@/lib/stripe/stripe-client'
import {getAuthUser} from '@/services/authentication/auth-service'
import {initSubscriptionService} from '@/services/facades/subscription-service-facade'
import {getBillingContext} from '@/services/subscription-service'
import {SubscriptionPlan} from '@/services/types/domain/subscription-types'

// Types communs importés
import type {
  CheckoutMode,
  CheckoutResult,
  CustomerInfo,
  SubscriptionData,
} from '../checkout-stripe-util'
import {
  createCheckoutMetadata,
  validateCheckoutMode,
} from '../checkout-stripe-util'

// 🎯 Fonction principale refactorisée
export async function createCheckoutSession(
  priceId: string,
  seats: number = 1,
  guest: boolean = false
): Promise<CheckoutResult> {
  logger.info('[EXTERNAL-CHECKOUT] Création session checkout externe démarrée')
  logger.debug('[EXTERNAL-CHECKOUT] Paramètres reçus:', {priceId, seats, guest})

  try {
    // Récupérer l'utilisateur connecté (optionnel si guest)
    const user = await getAuthUser()
    logger.debug('[EXTERNAL-CHECKOUT] Utilisateur récupéré:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
    })

    // Valider le plan
    const plan = await getPlanByPriceId(priceId)
    if (!plan) {
      logger.error(
        '[EXTERNAL-CHECKOUT] ❌ Plan non trouvé pour priceId:',
        priceId
      )
      throw new Error('Plan not found')
    }
    logger.debug('[EXTERNAL-CHECKOUT] Plan récupéré:', {
      planCode: plan.code,
      isRecurring: plan.isRecurring,
    })

    // 1️⃣ Validation du mode
    const mode = validateCheckoutMode(guest, user, 'EXTERNAL-CHECKOUT')

    // 2️⃣ Gestion customer
    const customerInfo = await initUserCustomer(mode, user)

    // 3️⃣ Initialisation subscription
    const subscriptionId = await initSubscription(
      customerInfo,
      plan.code as SubscriptionPlan,
      seats
    )
    const isYearly = await isYearlyPrice(plan.priceId)
    // 4️⃣ Préparation des données
    const subscriptionData: SubscriptionData = {
      subscriptionId,
      plan: {
        code: plan.code as SubscriptionPlan,
        isRecurring: plan.isRecurring,
      },
      seats,
      isYearly,
    }

    // 5️⃣ Création metadata
    const metadata = createCheckoutMetadata(
      mode,
      subscriptionData,
      customerInfo,
      'external'
    )

    // 6️⃣ Création session Stripe
    const session = await createStripeSession(
      priceId,
      subscriptionData,
      customerInfo,
      metadata
    )

    return {
      success: true,
      url: session.url,
      sessionId: session.id,
    }
  } catch (error) {
    logger.error(
      '[EXTERNAL-CHECKOUT] ❌ Erreur lors de la création session:',
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 2️⃣ Gestion du customer selon le mode
async function initUserCustomer(
  mode: CheckoutMode,
  user: CustomerInfo['user']
): Promise<CustomerInfo> {
  if (mode === 'guest') {
    logger.info('[EXTERNAL-CHECKOUT] 📋 Mode guest détecté')
    return {
      customerId: undefined,
      customerEmail: undefined,
      user: undefined,
    }
  }

  // Mode authenticated
  if (!user) {
    throw new Error('User required for authenticated checkout')
  }

  logger.info('[EXTERNAL-CHECKOUT] 👤 Mode utilisateur connecté détecté')

  let customerId = user.stripeCustomerId || undefined

  //mode connecté on veut set le stripeCustomerId si non disponible pour etre better-auth compliant
  if (!customerId) {
    logger.info('[EXTERNAL-CHECKOUT] 🔧 Création customer Stripe')
    const customer = await stripeClient.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
        managed_by: 'custom_checkout',
      },
    })
    customerId = customer.id
    logger.debug('[EXTERNAL-CHECKOUT] Customer Stripe créé:', {customerId})
  }

  return {
    customerId,
    customerEmail: undefined,
    user,
  }
}

// 3️⃣ Initialisation de la subscription
async function initSubscription(
  customerInfo: CustomerInfo,
  planCode: SubscriptionData['plan']['code'],
  seats: number
): Promise<string> {
  logger.info('[EXTERNAL-CHECKOUT] 💾 Initialisation subscription en BDD')

  let referenceId: string | undefined

  // Déterminer referenceId seulement si pas en mode guest
  if (customerInfo.user) {
    const context = await getBillingContext()
    referenceId = context.referenceId
  } else {
    // Mode guest : referenceId sera undefined
    referenceId = undefined
  }

  const subscriptionId = await initSubscriptionService({
    plan: planCode,
    seats,
    referenceId, // 🎯 Utilise le bon referenceId selon la config BILLING_MODE
    stripeCustomerId: customerInfo.customerId,
  })

  logger.debug('[EXTERNAL-CHECKOUT] Subscription initialisée:', {
    subscriptionId,
  })

  if (!subscriptionId) {
    logger.error(
      "[EXTERNAL-CHECKOUT] ❌ Erreur lors de l'initialisation de la subscription"
    )
    throw new Error("Erreur lors de l'initialisation de la subscription")
  }

  return subscriptionId
}

// 5️⃣ Création de la session Stripe
async function createStripeSession(
  priceId: string,
  subscriptionData: SubscriptionData,
  customerInfo: CustomerInfo,
  metadata: Record<string, string>
): Promise<{url: string | null; id: string}> {
  logger.info('[EXTERNAL-CHECKOUT] 🔧 Création session Stripe')

  const headersList = await headers()
  const origin = headersList.get('origin') || ''

  const session = await stripeClient.checkout.sessions.create({
    customer: customerInfo.customerId,
    customer_email: customerInfo.customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: subscriptionData.seats,
      },
    ],
    mode: subscriptionData.plan.isRecurring ? 'subscription' : 'payment',
    success_url: `${origin}/checkout/success?redirect_status=succeeded&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    // `subscription_data.metadata` en plus de `metadata` : le plugin lit les
    // metadata de la SESSION dans onCheckoutSessionCompleted, mais celles de la
    // SUBSCRIPTION dans onSubscriptionCreated/Updated. Sans elles, un
    // `customer.subscription.created` arrivant avant la session fait chercher
    // par stripeCustomerId et crée une SECONDE ligne d'abonnement. Le plugin
    // pose lui-même les deux.
    metadata,
    subscription_data: subscriptionData.plan.isRecurring
      ? {metadata}
      : undefined,
    payment_method_types: ['card'],
  })

  logger.info('✅ [EXTERNAL-CHECKOUT] Session externe créée avec succès')
  logger.debug('[EXTERNAL-CHECKOUT] Détails session:', {
    sessionId: session.id,
    mode: customerInfo.customerId ? 'authenticated' : 'guest',
    customer: customerInfo.customerId,
    customerEmail: customerInfo.customerEmail,
    url: session.url,
  })

  return session
}
