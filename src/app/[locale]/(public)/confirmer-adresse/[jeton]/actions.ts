'use server'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import type {ConfirmMemberEmailActionResult} from '@/components/features/member-email/member-email-confirmation-panel'
import {logger} from '@/lib/logger'
import {confirmMemberEmailService} from '@/services/facades/member-email-confirmation-service-facade'

/**
 * « Confirmer cette adresse » (s54, ecran 3, etat 3a), ADR 056 §5.
 *
 * **Action publique, sans `requireActionAuth()`, et c'est delibere** : la
 * personne arrive depuis l'email envoye a l'adresse, sans session ; le jeton
 * aleatoire est son seul titre (precedent : `confirmUnsubscribeAction`). Le
 * tenant vient du domaine appele : un jeton d'une autre association est un
 * lien inutilisable. La reponse ne porte aucun detail, et le jeton n'est
 * jamais journalise.
 */
export async function confirmMemberEmailAction(
  _prevState: ConfirmMemberEmailActionResult | undefined,
  formData: FormData
): Promise<ConfirmMemberEmailActionResult> {
  const tenant = await getCurrentTenantDal()
  if (!tenant) return {status: 'invalid'}

  try {
    return await confirmMemberEmailService({
      organizationId: tenant.id,
      token: formData.get('token')?.toString() ?? '',
    })
  } catch (error) {
    logger.error('[MEMBER-EMAIL] Confirmation en echec', {
      error: error instanceof Error ? error.name : 'unknown',
    })
    return {status: 'error'}
  }
}
