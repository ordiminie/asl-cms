'use server'

import Stripe from 'stripe'

import {getPlanByPriceId, isYearlyPrice} from '@/app/dal/subscription-dal'
import {logger} from '@/lib/logger'
import {stripeClient} from '@/lib/stripe/stripe-client'
import {getAuthUser} from '@/services/authentication/auth-service'
import {initSubscriptionService} from '@/services/facades/subscription-service-facade'
import {createSubscriptionFromStripeService} from '@/services/facades/subscription-service-facade'
import {createUserFromStripeService} from '@/services/facades/user-service-facade'
import {getBillingContext} from '@/services/subscription-service'
import {SubscriptionPlan} from '@/services/types/domain/subscription-types'

// Types communs importés
import type {
  CheckoutResult,
  CustomerInfo,
  SubscriptionData,
} from '../checkout-stripe-util'
import {
  createCheckoutMetadata,
  validateReactStripeMode,
} from '../checkout-stripe-util'

// 🎯 Fonction principale refactorisée
export async function createCheckoutSession(
  priceId: string,
  seats: number = 1,
  guest: boolean = false,
  email?: string
): Promise<CheckoutResult> {
  logger.info('[REACT-STRIPE] Création session checkout démarrée')
  logger.debug('[REACT-STRIPE] Paramètres reçus:', {
    priceId,
    seats,
    guest,
    email,
  })

  try {
    // Récupérer l'utilisateur connecté (optionnel si guest)
    const user = await getAuthUser()
    logger.debug('[REACT-STRIPE] Utilisateur récupéré:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
    })

    // Valider le plan
    const plan = await getPlanByPriceId(priceId)
    if (!plan) {
      logger.error('[REACT-STRIPE] ❌ Plan non trouvé pour priceId:', priceId)
      throw new Error('Plan not found')
    }
    logger.debug('[REACT-STRIPE] Plan récupéré:', {
      planCode: plan.code,
      isRecurring: plan.isRecurring,
    })

    // 1️⃣ Validation du mode (avec email requis pour guest)
    const mode = validateReactStripeMode(guest, user, email)

    // 2️⃣ Gestion customer
    const customerInfo = await initReactStripeCustomer(mode, user, email)

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
    const metadata = createReactStripeMetadata(
      subscriptionData,
      customerInfo,
      priceId
    )

    // 6️⃣ Récupération du prix pour calculs
    const priceDetails = await getStripePrice(priceId, seats)

    // 7️⃣ Création Setup Intent Stripe
    if (!customerInfo.customerId) {
      throw new Error('Customer ID is required for Setup Intent creation')
    }
    const setupIntent = await createStripeSetupIntent(
      customerInfo.customerId,
      metadata,
      priceDetails
    )

    return {
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customerInfo.customerId,
      priceId: priceId,
      amount: priceDetails.amount,
      unit_amount: priceDetails.unit_amount,
      currency: priceDetails.currency,
      seats: seats,
    }
  } catch (error) {
    logger.error(
      '[REACT-STRIPE] ❌ Erreur lors de la création session checkout:',
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// 1️⃣ Gestion du customer React Stripe (toujours crée un customer)
async function initReactStripeCustomer(
  mode: 'guest' | 'authenticated',
  user: CustomerInfo['user'],
  email?: string
): Promise<CustomerInfo> {
  if (mode === 'guest') {
    logger.info('[REACT-STRIPE] 📋 Mode guest détecté')

    // Mode Guest : créer un customer avec l'email fourni
    if (!email) {
      throw new Error('Email is required for guest checkout')
    }
    const customer = await stripeClient.customers.create({
      email: email,
      metadata: {
        managed_by: 'webhook_guest_checkout',
        source: 'react_stripe_elements',
      },
    })

    logger.debug('[REACT-STRIPE] Customer guest créé:', {
      customerId: customer.id,
      email: email,
    })

    return {
      customerId: customer.id,
      customerEmail: email,
      user: undefined,
    }
  }

  // Mode authenticated
  if (!user) {
    throw new Error('User required for authenticated checkout')
  }

  logger.info('[REACT-STRIPE] 👤 Mode utilisateur connecté détecté')

  let customerId = user.stripeCustomerId

  // Créer customer si nécessaire
  if (!customerId) {
    logger.info('[REACT-STRIPE] 🔧 Création customer Stripe pour utilisateur')
    const customer = await stripeClient.customers.create({
      email: user.email ?? '',
      metadata: {
        userId: user.id,
        source: 'react_stripe_elements',
      },
    })
    customerId = customer.id
    logger.debug('[REACT-STRIPE] Customer Stripe créé:', {customerId})
  }

  return {
    customerId,
    customerEmail: user.email,
    user,
  }
}

// 2️⃣ Initialisation de la subscription
async function initSubscription(
  customerInfo: CustomerInfo,
  planCode: SubscriptionData['plan']['code'],
  seats: number
): Promise<string> {
  logger.info('[REACT-STRIPE] 💾 Initialisation subscription en BDD')

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

  logger.debug('[REACT-STRIPE] Subscription initialisée:', {subscriptionId})

  if (!subscriptionId) {
    logger.error(
      "[REACT-STRIPE] ❌ Erreur lors de l'initialisation de la subscription"
    )
    throw new Error("Erreur lors de l'initialisation de la subscription")
  }

  return subscriptionId
}

// 3️⃣ Création des metadata spécifiques React Stripe
function createReactStripeMetadata(
  subscriptionData: SubscriptionData,
  customerInfo: CustomerInfo,
  priceId: string
): Record<string, string> {
  const mode = customerInfo.user ? 'authenticated' : 'guest'

  // Utilise la fonction commune avec checkoutType 'react-stripe'
  const baseMetadata = createCheckoutMetadata(
    mode,
    subscriptionData,
    customerInfo,
    'react-stripe'
  )

  // ✅ AJOUT CRITIQUE : Ajouter le priceId pour confirmSubscription
  return {
    ...baseMetadata,
    priceId: priceId,
  }
}

// 4️⃣ Récupération des détails du prix
async function getStripePrice(
  priceId: string,
  seats: number
): Promise<{amount: number; unit_amount: number; currency: string}> {
  const price = await stripeClient.prices.retrieve(priceId)

  if (!price || !price.unit_amount) {
    logger.error('[REACT-STRIPE] ❌ Prix non trouvé pour priceId:', priceId)
    throw new Error('Price not found')
  }

  const amount = price.unit_amount * seats * 100

  logger.debug('[REACT-STRIPE] Calculs montants:', {
    unitAmount: price.unit_amount,
    amount,
    seats,
  })

  return {
    amount,
    unit_amount: price.unit_amount,
    currency: price.currency,
  }
}

// 5️⃣ Création du Setup Intent Stripe
async function createStripeSetupIntent(
  customerId: string,
  metadata: Record<string, string>,
  priceDetails: {amount: number; unit_amount: number; currency: string}
): Promise<Stripe.SetupIntent> {
  logger.info('[REACT-STRIPE] 🔧 Création Setup Intent Stripe')

  const setupIntent = await stripeClient.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: {
      ...metadata,
      amount: priceDetails.amount.toString(),
      currency: priceDetails.currency,
    },
  })

  if (!setupIntent.client_secret) {
    logger.error(
      '[REACT-STRIPE] ❌ Client secret manquant pour le setup intent'
    )
    throw new Error('Client secret manquant pour le setup intent')
  }

  logger.info('✅ [REACT-STRIPE] Setup Intent créé avec succès')
  logger.debug('[REACT-STRIPE] Détails Setup Intent:', {
    setupIntentId: setupIntent.id,
    customerId,
    metadata,
  })

  return setupIntent
}

// 🔄 Fonction de confirmation (gardée pour compatibilité mais simplifiée)
export async function confirmSubscription(setupIntentId: string) {
  logger.info("[REACT-STRIPE] Confirmation de l'abonnement démarrée")
  logger.debug('[REACT-STRIPE] Setup Intent ID:', setupIntentId)

  try {
    // Récupérer le Setup Intent pour obtenir le payment method ET les métadonnées
    const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId)
    logger.debug('[REACT-STRIPE] Setup Intent récupéré:', setupIntent)

    const metadata = setupIntent.metadata
    const subscriptionId = metadata?.subscriptionId // 🎯 Maintenant vrai UUID !

    logger.debug('[REACT-STRIPE] Métadonnées Setup Intent:', metadata)

    const seats = metadata?.seats ? parseInt(metadata.seats) : 1
    const isRecurring = metadata?.isRecurring === 'true'
    const isGuestCheckout = metadata?.guest_checkout === 'true'

    if (setupIntent.status !== 'succeeded') {
      logger.error('[REACT-STRIPE] ❌ Setup Intent non confirmé')
      throw new Error('Setup Intent non confirmé')
    }

    const customerId = setupIntent.customer as string
    const paymentMethodId = setupIntent.payment_method as string

    let stripeSubscription: Stripe.Subscription | null = null
    let customerEmail: string = ''

    // Gestion différente selon guest ou user connecté
    if (isGuestCheckout) {
      logger.info('[REACT-STRIPE] 📋 Mode guest détecté pour confirmation')

      // Mode Guest : récupérer l'email du customer
      const customer = await stripeClient.customers.retrieve(customerId)
      if (customer.deleted) {
        logger.error('[REACT-STRIPE] ❌ Customer supprimé')
        throw new Error('Customer supprimé')
      }
      customerEmail = customer.email || ''

      if (!customerEmail) {
        logger.error(
          "[REACT-STRIPE] ❌ Email requis pour finaliser l'abonnement guest"
        )
        throw new Error("Email requis pour finaliser l'abonnement guest")
      }

      // Créer l'utilisateur guest en base de données
      await createUserFromStripeService({
        email: customerEmail,
        stripeCustomerId: customerId,
        name: customerEmail.split('@')[0],
      })
      logger.info('✅ [REACT-STRIPE] Utilisateur guest créé:', customerEmail)
    } else {
      logger.info(
        '[REACT-STRIPE] 👤 Mode utilisateur connecté détecté pour confirmation'
      )

      // Mode User connecté : vérifier l'authentification
      const user = await getAuthUser()
      if (!user) {
        logger.error(
          '[REACT-STRIPE] ❌ Utilisateur non connecté pour confirmation'
        )
        return {
          success: false,
          error: 'Utilisateur non connecté',
        }
      }
      customerEmail = user.email ?? ''
    }

    if (isRecurring) {
      logger.info('[REACT-STRIPE] 🔧 Création abonnement Stripe')

      // Créer l'abonnement Stripe avec le payment method confirmé
      stripeSubscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: metadata?.priceId || '',
            quantity: seats,
          },
        ],
        default_payment_method: paymentMethodId,
        metadata: {
          subscriptionId: subscriptionId || 'default-subscription-id', // 🎯 Utilise le vrai UUID !
          email: customerEmail,
          source: 'react_stripe_elements',
          ...(isGuestCheckout
            ? {guest_checkout: 'true'}
            : {managed_by: 'better_auth'}),
        },
      })

      logger.debug('[REACT-STRIPE] Abonnement Stripe créé:', {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
      })
    }

    // Récupérer les informations du plan depuis le priceId
    const plan = await getPlanByPriceId(metadata?.priceId || '')
    if (!plan) {
      logger.error(
        '[REACT-STRIPE] ❌ Plan non trouvé pour ce priceId:',
        metadata?.priceId
      )
      throw new Error('Plan non trouvé pour ce priceId')
    }
    const isYearly = await isYearlyPrice(plan.priceId)
    // Créer l'abonnement en base via le service
    await createSubscriptionFromStripeService(
      customerEmail,
      plan.code as SubscriptionPlan,
      isYearly,
      stripeSubscription?.id ?? '',
      customerId,
      seats
    )

    logger.info('✅ [REACT-STRIPE] Abonnement confirmé avec succès')
    logger.debug('[REACT-STRIPE] Détails abonnement:', {
      mode: isGuestCheckout ? 'guest' : 'user_connecté',
      customerEmail,
      subscriptionId: stripeSubscription?.id,
    })

    return {
      success: true,
      subscriptionId: stripeSubscription?.id ?? '',
      status: stripeSubscription?.status ?? '',
    }
  } catch (error) {
    logger.error(
      "[REACT-STRIPE] ❌ Erreur lors de la confirmation de l'abonnement:",
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
