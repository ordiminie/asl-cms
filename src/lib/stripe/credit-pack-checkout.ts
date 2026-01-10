import Stripe from 'stripe'

import {logger} from '@/lib/logger'
import {
  CreditPackConfig,
  DEFAULT_CREDIT_PACKS,
} from '@/services/types/domain/credit-types'

import {stripeClient} from './stripe-client'

export interface CreditPackCheckoutResult {
  success: boolean
  url?: string | null
  sessionId?: string
  error?: string
}

/**
 * Crée une session Stripe Checkout pour l'achat d'un pack de crédits
 */
export async function createCreditPackCheckoutSession(
  organizationId: string,
  packId: string,
  successUrl: string,
  cancelUrl: string,
  customerEmail?: string,
  stripeCustomerId?: string
): Promise<CreditPackCheckoutResult> {
  logger.info(
    '[CREDIT-PACK-CHECKOUT] Création session checkout pack de crédits'
  )
  logger.debug('[CREDIT-PACK-CHECKOUT] Paramètres:', {
    organizationId,
    packId,
    customerEmail,
    stripeCustomerId,
  })

  try {
    // Trouver le pack
    const pack = DEFAULT_CREDIT_PACKS.find((p) => p.id === packId)
    if (!pack) {
      logger.error(`[CREDIT-PACK-CHECKOUT] Pack ${packId} non trouvé`)
      return {
        success: false,
        error: `Pack ${packId} non trouvé`,
      }
    }

    if (!pack.stripePriceId) {
      logger.error(
        `[CREDIT-PACK-CHECKOUT] Pack ${packId} n'a pas de stripePriceId configuré`
      )
      return {
        success: false,
        error: `Pack ${packId} n'est pas encore configuré dans Stripe`,
      }
    }

    // Préparer les options de la session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment', // One-time payment pour les packs
      payment_method_types: ['card'],
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&pack=${packId}`,
      cancel_url: cancelUrl,
      metadata: {
        type: 'credit_pack',
        organizationId,
        packId,
        credits: String(pack.credits),
        source: 'credit_pack_checkout',
      },
    }

    // Ajouter customer si disponible
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail
    }

    // Créer la session Stripe
    const session = await stripeClient.checkout.sessions.create(sessionParams)

    logger.info('[CREDIT-PACK-CHECKOUT] Session créée avec succès:', {
      sessionId: session.id,
      packId,
      credits: pack.credits,
    })

    return {
      success: true,
      url: session.url,
      sessionId: session.id,
    }
  } catch (error) {
    logger.error('[CREDIT-PACK-CHECKOUT] Erreur création session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

/**
 * Récupère les packs de crédits disponibles avec leurs prix Stripe
 */
export function getCreditPacks(): CreditPackConfig[] {
  return DEFAULT_CREDIT_PACKS
}

/**
 * Vérifie si un pack est valide et configuré
 */
export function isPackConfigured(packId: string): boolean {
  const pack = DEFAULT_CREDIT_PACKS.find((p) => p.id === packId)
  return Boolean(pack?.stripePriceId)
}
