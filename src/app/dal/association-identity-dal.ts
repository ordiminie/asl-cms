import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {canManageAssociationIdentityService} from '@/services/facades/association-identity-service-facade'

/**
 * L'utilisateur connecte peut-il gerer l'identite de l'association du domaine
 * appele ? Donnee par utilisateur : jamais cachee au-dela de la requete, lue
 * derriere un `<Suspense>`.
 */
export const canManageCurrentAssociationIdentityDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return await canManageAssociationIdentityService(tenant.id)
  }
)
