'use client'

import {Subscription} from '@better-auth/stripe'
import {useCallback, useEffect, useState} from 'react'

import {useOrganization} from '@/components/context/organization-provider'
import {authClient} from '@/lib/better-auth/auth-client'
import {SubscriptionPlan} from '@/services/types/domain/subscription-types'

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'unpaid'

export type UseSubscriptionReturn = {
  subscriptions: Subscription[]
  activeSubscription: Subscription | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>

  isActive: boolean
  isTrialing: boolean
  isCanceled: boolean
  isFree: boolean
  cancelAtPeriodEnd: boolean

  plan: SubscriptionPlan | null
  planName: string | null
  seats: number
  status: SubscriptionStatus | null

  periodEnd: Date | null
  periodStart: Date | null
  trialEnd: Date | null

  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

export function useSubscription(): UseSubscriptionReturn {
  const {referenceId} = useOrganization()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSubscriptions = useCallback(async () => {
    if (!referenceId) {
      setLoading(false)
      setSubscriptions([])
      return
    }

    try {
      setLoading(true)
      setError(null)

      const {data} = await authClient.subscription.list({
        query: {
          referenceId: referenceId || '',
        },
      })

      setSubscriptions(data || [])
    } catch (err) {
      console.error('Error loading subscriptions:', err)
      setError(
        err instanceof Error ? err : new Error('Failed to load subscriptions')
      )
    } finally {
      setLoading(false)
    }
  }, [referenceId])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  const activeSubscription =
    subscriptions.find(
      (sub) => sub.status === 'active' || sub.status === 'trialing'
    ) || null

  const isActive = activeSubscription?.status === 'active'
  const isTrialing = activeSubscription?.status === 'trialing'
  const isCanceled = activeSubscription?.cancelAtPeriodEnd === true
  const isFree = !activeSubscription
  const cancelAtPeriodEnd = activeSubscription?.cancelAtPeriodEnd ?? false

  const plan = (activeSubscription?.plan as SubscriptionPlan) || null
  const planName = activeSubscription?.plan || null
  const seats = activeSubscription?.seats || 1
  const status = (activeSubscription?.status as SubscriptionStatus) || null

  const periodEnd = activeSubscription?.periodEnd
    ? new Date(activeSubscription.periodEnd)
    : null
  const periodStart = activeSubscription?.periodStart
    ? new Date(activeSubscription.periodStart)
    : null
  const trialEnd = activeSubscription?.trialEnd
    ? new Date(activeSubscription.trialEnd)
    : null

  const stripeSubscriptionId = activeSubscription?.stripeSubscriptionId || null
  const stripeCustomerId = activeSubscription?.stripeCustomerId || null

  return {
    subscriptions,
    activeSubscription,
    loading,
    error,
    refetch: loadSubscriptions,

    isActive,
    isTrialing,
    isCanceled,
    isFree,
    cancelAtPeriodEnd,

    plan,
    planName,
    seats,
    status,

    periodEnd,
    periodStart,
    trialEnd,

    stripeSubscriptionId,
    stripeCustomerId,
  }
}
