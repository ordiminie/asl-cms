'use server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {logger} from '@/lib/logger'
import {confirmUnsubscribeService} from '@/services/facades/unsubscribe-service-facade'
import type {ConfirmUnsubscribeActionResult} from '@/services/types/domain/campaign-types'

/**
 * « Me desinscrire » (ecran 6, etat a), s25, ADR 051.
 *
 * **Action publique, sans `requireActionAuth()`, et c'est delibere** : le
 * membre arrive depuis son email, sans session ; le jeton aleatoire est son
 * seul titre (precedent : `submitContactAction`). Le tenant vient du domaine
 * appele : un jeton d'une autre association est un lien invalide. La reponse
 * ne porte aucun detail, et le jeton n'est jamais journalise.
 */
export async function confirmUnsubscribeAction(
  _prevState: ConfirmUnsubscribeActionResult | undefined,
  formData: FormData
): Promise<ConfirmUnsubscribeActionResult> {
  const tenant = await getCurrentTenantDal()
  if (!tenant) return {status: 'invalid'}

  try {
    return await confirmUnsubscribeService({
      organizationId: tenant.id,
      token: formData.get('token')?.toString() ?? '',
    })
  } catch (error) {
    logger.error('[UNSUBSCRIBE] Confirmation en echec', {
      error: error instanceof Error ? error.name : 'unknown',
    })
    return {status: 'error'}
  }
}
