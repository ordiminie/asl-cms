'use server'

import {isYearlyPrice as isYearlyPriceDal} from '@/app/dal/subscription-dal'
import {getPriceIdFromSubscriptionId} from '@/lib/stripe/stripe-utils'

export async function getPriceIdFromSubscriptionIdAction(
  subscriptionId: string
) {
  return await getPriceIdFromSubscriptionId(subscriptionId)
}

export async function isYearlyPrice(priceId: string) {
  return await isYearlyPriceDal(priceId)
}
