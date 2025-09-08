import 'server-only'

import Stripe from 'stripe'

import {env} from '@/env'

export const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil',
})
