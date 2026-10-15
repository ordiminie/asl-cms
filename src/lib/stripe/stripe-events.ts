import Stripe from 'stripe'

import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {logger} from '@/lib/logger'
import {createSubscriptionFromStripeService} from '@/services/facades/subscription-service-facade'
import {SubscriptionPlan} from '@/services/types/domain/subscription-types'

export async function onStripeEvent(event: Stripe.Event) {
  logger.info('[STRIPE-EVENT] Réception événement Stripe:', event.type)
  logger.debug('[STRIPE-EVENT] Détails événement:', {
    eventId: event.id,
    eventData: event.data,
  })

  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        logger.info('🔧 Traitement customer.subscription.created')
        const subscription = event.data.object as Stripe.Subscription
        logger.info(
          '🔧 Traitement customer.subscription.created subscription.id',
          subscription.id
        )
        // Note: L'allocation des crédits est gérée par Better Auth onSubscriptionComplete
        break
      }
      case 'checkout.session.completed': {
        logger.info('🔧 Traitement checkout session completed')
        const session = event.data.object as Stripe.Checkout.Session

        // Le webhook ne cree aucun compte (s46b) : seul le paiement en
        // plusieurs fois d'un compte existant est traite ici, le reste par
        // Better Auth.
        const isInstallmentCheckout =
          session.metadata?.source === 'installment_checkout'
        if (isInstallmentCheckout) {
          logger.info('🔧 Traitement installment checkout')
          await handleInstallmentCheckoutSessionCompleted(session)
        }

        break
      }

      case 'customer.subscription.updated': {
        //https://github.com/better-auth/better-auth/issues/2087
        //https://github.com/better-auth/better-auth/blob/main/packages/stripe/src/hooks.ts#L42-L43
        logger.info('🔄 Traitement customer.subscription.updated')
        logger.info('✅ customer.subscription.updated traité')
        break
      }

      case 'customer.subscription.deleted': {
        logger.info('🗑️ [TEST] Traitement customer.subscription.deleted')

        break
      }

      case 'invoice.paid': {
        logger.info('💰 Invoice paid:', event.data.object.id)
        break
      }

      case 'payment_intent.succeeded': {
        //1 pour les paiements unique seulement // PlanConst.LIFETIME
        logger.info(
          '✅ Payment succeeded (payment_intent.succeeded):',
          event.data.object.id
        )

        break
      }

      default:
        logger.info('📝 Autre événement Stripe:', event.type)
    }
  } catch (error) {
    logger.error('❌ Erreur dans onEvent Stripe:', error)
  }
}

// ===================================
// 🎯 INSTALLMENT CHECKOUT : FONCTIONS SPÉCIALISÉES
// ===================================

/**
 * 🎯 FONCTION PRINCIPALE : Gestion des installment checkouts
 */
async function handleInstallmentCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  logger.info('🗓️ Traitement installment checkout session completed')
  const metadata = session.metadata || {}
  console.log('🔧handleInstallmentCheckoutSessionCompleted  metadata', metadata)
  // 1️⃣ Validation des données installment
  const installmentData = validateInstallmentCheckoutData(session, metadata)

  // 2️⃣ Compte existant uniquement : plus de mode invite (s46b)
  const finalUser = await getAuthenticatedUser(installmentData.customerEmail)

  // 3️⃣ Création subscription avec périodes installment
  await createInstallmentSubscription(installmentData, finalUser)

  logger.info('🎉 Workflow installment checkout terminé avec succès!')
}

/**
 * 1️⃣ VALIDATION : Données installment checkout
 */
function validateInstallmentCheckoutData(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
): {
  customerEmail: string
  customerName?: string
  stripeCustomerId?: string
  plan: string
  seats: number
  numberOfPayments: number
  scheduleId?: string
  stripeSubscriptionId?: string
} {
  logger.info('🔍 Validation des données installment checkout...')

  // Récupération des informations
  const customerEmail =
    metadata.customerEmail ?? session.customer_details?.email
  const customerName = session.customer_details?.name || undefined
  const stripeCustomerId = session.customer as string
  const plan = metadata.plan
  const seats = parseInt(metadata.seats || '1')
  const numberOfPayments = parseInt(metadata.number_of_payments || '1')
  const scheduleId = metadata.schedule_id
  const stripeSubscriptionId = session.subscription as string
  const isInstallmentCheckout = metadata.source === 'installment_checkout'

  // Validations critiques
  if (!customerEmail) {
    logger.error('❌ Email manquant pour installment checkout')
    throw new Error('Email manquant pour installment checkout')
  }

  if (!plan) {
    logger.error('❌ Plan manquant pour installment checkout')
    throw new Error('Plan manquant pour installment checkout')
  }

  if (!scheduleId) {
    logger.error('❌ Schedule ID manquant pour installment checkout')
    throw new Error('Schedule ID manquant pour installment checkout')
  }

  if (numberOfPayments < 2) {
    logger.error('❌ Nombre de paiements invalide pour installment')
    throw new Error('Nombre de paiements doit être >= 2')
  }

  if (!isInstallmentCheckout) {
    logger.error('❌ Installment checkout non supporté')
    throw new Error('Installment checkout non supporté')
  }

  logger.info('✅ Validation installment réussie')

  return {
    customerEmail,
    customerName,
    stripeCustomerId,
    plan,
    seats,
    numberOfPayments,
    scheduleId,
    stripeSubscriptionId,
  }
}

/**
 * 2️⃣ UTILISATEUR AUTHENTIFIÉ : Récupérer user existant
 */
async function getAuthenticatedUser(email: string): Promise<{
  id: string
  email: string
  stripeCustomerId: string
}> {
  logger.info('🔍 Récupération utilisateur authentifié...')

  const existingUser = await getUserByEmailDao(email)
  if (!existingUser) {
    throw new Error(`Utilisateur authentifié non trouvé: ${email}`)
  }

  return {
    id: existingUser.id,
    email: existingUser.email,
    stripeCustomerId: existingUser.stripeCustomerId || '',
  }
}

/**
 * 3️⃣ CRÉATION SUBSCRIPTION : Avec périodes installment
 */
async function createInstallmentSubscription(
  installmentData: {
    customerEmail: string
    plan: string
    seats: number
    numberOfPayments: number
    stripeSubscriptionId?: string
  },
  user: {
    id: string
    email: string
    stripeCustomerId: string
  }
): Promise<void> {
  logger.info('🗓️ Création subscription installment...')

  try {
    // Calculer la date de fin basée sur le nombre de paiements
    const currentDate = new Date()
    const endDate = new Date(currentDate)
    endDate.setMonth(endDate.getMonth() + installmentData.numberOfPayments)

    // Utiliser le service de création subscription existant

    await createSubscriptionFromStripeService(
      installmentData.customerEmail,
      installmentData.plan as SubscriptionPlan, // Cast vers SubscriptionPlan
      false, // yearly = false pour installments
      installmentData.stripeSubscriptionId || '',
      user.stripeCustomerId,
      installmentData.seats,
      endDate
    )

    logger.info('✅ Subscription installment créée avec succès:', {
      userEmail: installmentData.customerEmail,
      plan: installmentData.plan,
      seats: installmentData.seats,
      numberOfPayments: installmentData.numberOfPayments,
      endDate: endDate.toISOString(),
    })
  } catch (error) {
    logger.error(
      '❌ Erreur lors de la création subscription installment:',
      error
    )
    throw error
  }
}
