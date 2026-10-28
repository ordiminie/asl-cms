import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  getMyContactService,
  getMyParcelsService,
  isPlainMemberOfService,
} from '@/services/facades/member-space-service-facade'
import {
  MyContactDTO,
  MyParcelsDTO,
} from '@/services/types/domain/member-space-types'

/**
 * Espace membre (s12d). **Aucun `'use cache'`** : donnees par utilisateur,
 * streamees derriere un `<Suspense>`, jamais tirees du cache prive du
 * navigateur (ADR 038). `cache()` dedoublonne dans la requete.
 */

/** « Mes parcelles » du compte connecte, sur l'association du domaine appele. */
export const getMyParcelsDal = cache(
  async (): Promise<MyParcelsDTO | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getMyParcelsService(tenant.id)
  }
)

/** Le compte connecte est-il un simple membre de l'association du domaine ? */
export const isPlainMemberOfCurrentAssociationDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return isPlainMemberOfService(tenant.id)
  }
)

/** « Mes coordonnees » du compte connecte, sur l'association du domaine (s16). */
export const getMyContactDal = cache(
  async (): Promise<MyContactDTO | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getMyContactService(tenant.id)
  }
)
