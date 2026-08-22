'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {markAffiliatePayoutPaidService} from '@/services/facades/affiliate-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'

export async function markAffiliatePayoutPaidAction(input: {
  affiliateId: string
  externalReference?: string
  notes?: string
}): Promise<ActionResponse<{amountCents: number}>> {
  const t = await getTranslations('Affiliate.admin')

  try {
    await requireActionAuth({roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN]})

    const payout = await markAffiliatePayoutPaidService(input)
    revalidatePath('/admin/affiliates')

    if (!payout) {
      return {success: false, message: t('nothingDue')}
    }

    return {
      success: true,
      message: t('payoutRecorded'),
      data: {amountCents: payout.amountCents},
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('unauthorized')}
    }
    if (error instanceof ValidationError) {
      return {success: false, message: error.message}
    }
    return {success: false, message: t('payoutFailed')}
  }
}
