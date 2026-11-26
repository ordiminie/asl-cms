import {getAuthUser} from '@/services/authentication/auth-service'
import {ActionIdConst} from '@/services/types/domain/action-registry-types'

import {canPerformAction} from './action-registry-authorization'

/**
 * Mettre a jour les coordonnees des fiches depuis le fichier de l'annee
 * (s56) : reserve a qui porte `member.contact.import` dans **cette**
 * association — la presidence par defaut, le SuperAdmin compris.
 */
export const canImportMemberContacts = async (
  organizationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  return canPerformAction(
    authUser,
    organizationId,
    ActionIdConst.MEMBER_CONTACT_IMPORT
  )
}
