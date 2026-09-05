import {env} from '@/env'
import {BillingModes} from '@/services/types/domain/subscription-types'

export const BILLING_MODE = env.NEXT_PUBLIC_BILLING_MODE

export function getReferenceIdByBillingMode(
  userId?: string,
  organizationId?: string
): string | undefined {
  if (organizationId && BILLING_MODE === BillingModes.ORGANIZATION) {
    return organizationId
  }

  return userId
}
