'use server'

import {revalidatePath} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationError} from '@/services/errors/validation-error'
import {setMyAffiliateCodeService} from '@/services/facades/affiliate-service-facade'
import {ActionResponse} from '@/services/types/common-type'

export async function setAffiliateCodeAction(
  code: string
): Promise<ActionResponse<{code: string}>> {
  const t = await getTranslations('Affiliate')

  try {
    await requireActionAuth()

    const affiliate = await setMyAffiliateCodeService(code)
    revalidatePath('/account/affiliate')

    return {
      success: true,
      message: t('success.codeSaved'),
      data: {code: affiliate.code},
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {success: false, message: t('errors.unauthorized')}
    }
    if (error instanceof ValidationError) {
      return {success: false, message: error.message}
    }
    return {success: false, message: t('errors.codeSaveFailed')}
  }
}
