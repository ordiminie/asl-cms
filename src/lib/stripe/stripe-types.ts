import React from 'react'
import z from 'zod'

import {Plan} from '@/services/types/domain/subscription-types'

export type AppPlan = Partial<Plan> &
  Required<
    Pick<
      Plan,
      | 'priceId'
      | 'code'
      | 'planName'
      | 'isRecurring'
      | 'limits'
      | 'price'
      | 'features'
    >
  >

export type AvailablePlan = {
  id: string
  name: string
  price: number | null
  yearlyPrice: number
  priceDisplay: string
  yearlyPriceDisplay: string
  description: string
  features: string[]
  icon: React.ReactElement
  color: string
  popular: boolean
}

export const StripeCheckoutConst = {
  EMBEDED_FORM: 'EmbededForm',
  EXTERNAL_FORM: 'ExternalForm',
  REACT_STRIPE_FORM: 'ReactStripeForm',
  PAYMENT_LINK: 'PaymentLink',
} as const

export type StripeCheckoutType =
  (typeof StripeCheckoutConst)[keyof typeof StripeCheckoutConst]

export const StripeCheckoutTypeSchema = z.enum(
  [
    StripeCheckoutConst.EMBEDED_FORM,
    StripeCheckoutConst.EXTERNAL_FORM,
    StripeCheckoutConst.REACT_STRIPE_FORM,
    StripeCheckoutConst.PAYMENT_LINK,
  ] satisfies [StripeCheckoutType, ...StripeCheckoutType[]],
  {
    message: 'Type de checkout Stripe non supporté.',
  }
)
