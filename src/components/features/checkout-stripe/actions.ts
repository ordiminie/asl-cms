'use server'

import {requireActionAuth} from '@/app/dal/user-dal'
import {stripeClient} from '@/lib/stripe/stripe-client'
import {getSubscriptionRecap} from '@/lib/stripe/stripe-utils'
import {RoleConst} from '@/services/types/domain/auth-types'
// Numéro : 4242 4242 4242 4242
// Date d'expiration : N'importe quelle date future
// CVC : N'importe quels 3 chiffres
// Code postal : N'importe quels 5 chiffres

// auth
// Numéro : 4000 0025 0000 3155
// Date d'expiration : N'importe quelle date future
// CVC : N'importe quels 3 chiffres
// Code postal : N'importe quels 5 chiffres

//refuser
// Numéro : 4000 0000 0000 0002
// Date d'expiration : N'importe quelle date future
// CVC : N'importe quels 3 chiffres
// Code postal : N'importe quels 5 chiffres
export type PriceRecap = {
  priceId?: string
  planName: string
  price: number
  originalPrice: number
  discount: number
  description: string | null
  features?: string[]
  currency: string
  interval?: string
  intervalCount?: number
  seats: number
  unitPrice: number
  unitOriginalPrice: number
  unitDiscount: number
}

export async function getSubscriptionRecapInfo(
  priceId: string,
  couponCode?: string,
  seats: number = 1
) {
  return getSubscriptionRecap(priceId, couponCode, seats)
}

export async function createStripePrice(
  amount: number,
  currency: string = 'eur'
) {
  try {
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    // Créer d'abord un produit
    const product = await stripeClient.products.create({
      name: 'Pro Bundle',
      description: 'Lifetime Access to Pro Bundle',
    })

    // Créer ensuite un prix pour ce produit
    const price = await stripeClient.prices.create({
      unit_amount: amount * 100, // Convertit le montant en centimes (ex: 197€ -> 19700)
      currency,
      product: product.id,
    })

    return {
      success: true,
      priceId: price.id,
      productId: product.id,
    }
  } catch (error) {
    console.error('Error creating Stripe price:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// Fonction utilitaire pour récupérer un price
export async function getStripePrice(priceId: string) {
  try {
    const price = await stripeClient.prices.retrieve(priceId)
    return {
      success: true,
      price,
    }
  } catch (error) {
    console.error('Error retrieving Stripe price:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
