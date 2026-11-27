import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {canImportMemberContactsService} from '@/services/facades/member-annual-import-service-facade'

/**
 * L'utilisateur connecte peut-il mettre a jour les coordonnees depuis le
 * fichier de l'annee (s56) sur l'association du domaine appele ? Donnee par
 * utilisateur : jamais cachee au-dela de la requete.
 */
export const canImportCurrentMemberContactsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canImportMemberContactsService(tenant.id)
  }
)
