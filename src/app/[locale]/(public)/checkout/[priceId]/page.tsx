import {env} from 'process'

import CheckoutPage from '@/components/features/checkout-stripe/checkout-page'
import {logger} from '@/lib/logger'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

type PropsParams = {
  params: Promise<{priceId: string}>
  searchParams: Promise<{
    couponCode: string
    seats: number
    guest: string
    split?: string
  }>
}

export default async function Page({params, searchParams}: PropsParams) {
  const paramStore = await params
  const searchParamsStore = await searchParams
  const priceId = paramStore.priceId ?? ''
  const guest = searchParamsStore.guest === 'true'
  const enableInstallments = searchParamsStore.split === 'true'
  logger.info(
    '🔧 [CHECKOUT] checkoutType',
    env.NEXT_PUBLIC_STRIPE_CHECKOUT_TYPE
  )
  logger.info('🔧 [CHECKOUT] checkout as guest', guest)
  logger.info('🔧 [CHECKOUT] installments mode', enableInstallments)
  logger.info('🔧 [CHECKOUT] priceId', priceId)
  logger.info('🔧 [CHECKOUT] couponCode', searchParamsStore.couponCode)
  logger.info('🔧 [CHECKOUT] seats', searchParamsStore.seats)

  return (
    <CheckoutPage
      priceId={priceId}
      couponId={searchParamsStore.couponCode}
      seats={searchParamsStore.seats}
      guest={guest}
      enableInstallments={enableInstallments}
    />
  )
}
