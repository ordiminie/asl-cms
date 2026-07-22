import {logger} from '@/lib/logger'
import type {SubscriptionPlan} from '@/services/types/domain/subscription-types'
import type {User} from '@/services/types/domain/user-types'

// Import pour les types installments
import type {InstallmentPlan} from './installments/types'

// Types communs pour tous les modes de checkout
export type CheckoutMode = 'guest' | 'authenticated'

export type CustomerInfo = {
  customerId?: string
  customerEmail?: string
  user?: User
}

export type SubscriptionData = {
  subscriptionId: string
  plan: {
    code: SubscriptionPlan
    isRecurring: boolean
  }
  isYearly: boolean
  seats: number
}

export type CheckoutResult = {
  success: boolean
  error?: string
  // Pour external checkout et payment link
  url?: string | null
  sessionId?: string
  // Pour embed checkout
  sessionUrl?: string | null
  clientSecret?: string | null
  // Pour react-stripe checkout
  setupIntentId?: string
  customerId?: string
  priceId?: string
  amount?: number
  unit_amount?: number
  currency?: string
  seats?: number
  // Pour installments checkout
  scheduleId?: string
  installmentPlan?: InstallmentPlan
}

export type CheckoutParams = {
  priceId: string
  seats: number
  guest: boolean
}

// Types spécifiques pour les fonctions communes
export type ValidationResult = {
  user: User | undefined
  plan: {
    planCode: SubscriptionPlan
    isRecurring: boolean
    isYearly: boolean
  }
  mode: CheckoutMode
}

export type MetadataConfig = {
  mode: CheckoutMode
  subscriptionData: SubscriptionData
  customerInfo: CustomerInfo
  checkoutType:
    'external' | 'embed' | 'payment-link' | 'react-stripe' | 'installments'
}

// 🛠️ Fonctions utilitaires communes

/**
 * Validation du mode de checkout - fonction commune réutilisable
 */
export function validateCheckoutMode(
  guest: boolean,
  user: User | undefined,
  context: string
): CheckoutMode {
  const isGuestCheckout = guest && !user
  const isUserCheckout = !guest && !!user

  // Vérifier que le mode est valide
  if (!isGuestCheckout && !isUserCheckout) {
    if (guest && user) {
      logger.error(
        `[${context}] ❌ Échec: impossible mode guest avec utilisateur connecté`
      )
      throw new Error(
        'Mode guest impossible avec utilisateur connecté - utilisez guest=false'
      )
    } else {
      logger.error(
        `[${context}] ❌ Échec: utilisateur non connecté en mode non-guest`
      )
      throw new Error(
        'Utilisateur non connecté - utilisez le mode guest ou connectez-vous'
      )
    }
  }

  return isGuestCheckout ? 'guest' : 'authenticated'
}

/**
 * Validation spécifique pour React Stripe (email requis en mode guest)
 */
export function validateReactStripeMode(
  guest: boolean,
  user: User | undefined,
  email?: string,
  context: string = 'REACT-STRIPE'
): CheckoutMode {
  // Validation de base
  const mode = validateCheckoutMode(guest, user, context)

  // Validation spécifique React Stripe
  if (mode === 'guest' && !email) {
    logger.error(`[${context}] ❌ Échec: email requis pour le mode guest`)
    throw new Error('Email requis pour le mode guest')
  }

  return mode
}

/**
 * Validation spécifique pour Installments (incompatible avec plans récurrents)
 */
export function validateInstallmentsPlan(
  plan: SubscriptionData['plan'],
  context: string = 'INSTALLMENTS-CHECKOUT'
): void {
  if (plan.isRecurring) {
    logger.error(`[${context}] ❌ Plan récurrent incompatible avec échéancier`)
    throw new Error(
      'Les paiements en plusieurs fois ne sont pas disponibles pour les abonnements récurrents'
    )
  }

  logger.debug(`[${context}] ✅ Plan one-time validé pour échéancier`)
}

/**
 * Création des metadata communes - maintenant supporte installments
 */
export function createCheckoutMetadata(
  mode: CheckoutMode,
  subscriptionData: SubscriptionData,
  customerInfo: CustomerInfo,
  checkoutType:
    'external' | 'embed' | 'payment-link' | 'react-stripe' | 'installments'
): Record<string, string> {
  const baseMetadata = {
    referenceId:
      mode === 'guest' ? 'guest' : (customerInfo.user?.id ?? 'guest'),
    subscriptionId: subscriptionData.subscriptionId,
    source: 'custom_checkout',
    checkoutType,
    isRecurring: subscriptionData.plan.isRecurring ? 'true' : 'false',
    seats: subscriptionData.seats.toString(),
    plan: subscriptionData.plan.code,
    interval: subscriptionData.isYearly ? 'year' : 'month',
  }

  // 🎯 Payment link : mode guest uniquement, pas de customerInfo
  if (checkoutType === 'payment-link') {
    logger.debug('[PAYMENT-LINK] Configuration guest (mode obligatoire)')
    return {
      ...baseMetadata,
      guest_checkout: 'true', // Payment link = toujours guest
    }
  }

  // 🎯 React Stripe : configuration spécialisée
  if (checkoutType === 'react-stripe') {
    logger.debug(`[REACT-STRIPE] Configuration ${mode}`)
    if (mode === 'guest') {
      return {
        ...baseMetadata,
        source: 'react_stripe_elements',
        guest_checkout: 'true',
        email: customerInfo.customerEmail ?? '',
      }
    } else {
      return {
        ...baseMetadata,
        source: 'react_stripe_elements',
        email: customerInfo.user?.email ?? '',
        userId: customerInfo.user?.id ?? '',
        customerEmail: customerInfo.user?.email ?? '',
      }
    }
  }

  // 🎯 Installments : configuration spécialisée
  if (checkoutType === 'installments') {
    logger.debug(`[INSTALLMENTS-CHECKOUT] Configuration ${mode}`)
    if (mode === 'guest') {
      return {
        ...baseMetadata,
        source: 'installment_checkout',
        guest_checkout: 'true',
      }
    } else {
      return {
        ...baseMetadata,
        source: 'installment_checkout',
        email: customerInfo.user?.email ?? '',
        userId: customerInfo.user?.id ?? '',
        customerEmail: customerInfo.user?.email ?? '',
      }
    }
  }

  // Logique existante pour external/embed
  if (mode === 'guest') {
    logger.debug(`[${checkoutType.toUpperCase()}-CHECKOUT] Configuration guest`)
    return {
      ...baseMetadata,
      guest_checkout: 'true',
    }
  }

  // Mode authenticated
  if (!customerInfo.user) {
    throw new Error('User required for metadata creation')
  }

  logger.debug(
    `[${checkoutType.toUpperCase()}-CHECKOUT] Configuration utilisateur connecté:`,
    {
      customerId: customerInfo.customerId,
      customerEmail: customerInfo.customerEmail,
      userId: customerInfo.user.id,
      email: customerInfo.user.email,
    }
  )

  return {
    ...baseMetadata,
    email: customerInfo.user.email ?? '',
    userId: customerInfo.user.id,
    customerEmail: customerInfo.user.email ?? '',
  }
}
