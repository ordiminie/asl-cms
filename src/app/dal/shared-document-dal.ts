import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {listAssociationCategoriesService} from '@/services/facades/association-category-service-facade'
import {
  canManageSharedDocumentsService,
  getSharedDocumentsForBureauService,
  getSharedDocumentsForMemberService,
} from '@/services/facades/shared-document-service-facade'
import {
  AssociationCategoryListDTO,
  CategoryDomainConst,
  PublicCategoryDTO,
} from '@/services/types/domain/association-category-types'
import {
  BureauSharedDocumentDTO,
  SharedDocumentDTO,
} from '@/services/types/domain/shared-document-types'

/**
 * Lectures des documents partages (s31, ADR 069). **Aucun `'use cache'`** :
 * toutes ces donnees sont lues sous session et doivent refleter un depot ou
 * un retrait des la requete suivante (critere 5). `cache()` deduplique
 * seulement dans la requete.
 */

/**
 * L'utilisateur connecte peut-il gerer les documents de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentSharedDocumentsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageSharedDocumentsService(tenant.id)
  }
)

/** Liste de gestion du bureau, du plus recent au plus ancien. */
export const getSharedDocumentsForBureauDal = cache(
  async (organizationId: string): Promise<BureauSharedDocumentDTO[]> =>
    getSharedDocumentsForBureauService(organizationId)
)

/**
 * Les categories du domaine `document`, avec le nombre de documents que
 * chacune range. Le service verifie `shared.document.manage`.
 */
export const getDocumentCategoriesForBureauDal = cache(
  async (organizationId: string): Promise<AssociationCategoryListDTO> =>
    listAssociationCategoriesService(
      organizationId,
      CategoryDomainConst.DOCUMENT
    )
)

/** Les categories actives proposees au depot : identifiant et nom seuls. */
export const getDocumentCategoryChoicesDal = cache(
  async (organizationId: string): Promise<PublicCategoryDTO[]> => {
    const list = await getDocumentCategoriesForBureauDal(organizationId)
    return list.items.map((category) => ({
      id: category.id,
      name: category.name,
    }))
  }
)

/**
 * « Documents de l'association » du compte connecte, sur l'association du
 * domaine (s31, critere 2). Un compte sans droit de lecture n'y voit rien,
 * sans que l'espace membre casse ; une panne remonte.
 */
export const getMySharedDocumentsDal = cache(
  async (): Promise<SharedDocumentDTO[] | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getSharedDocumentsForMemberService(tenant.id).catch(
      (error: unknown) => {
        if (error instanceof AuthorizationError) return undefined
        throw error
      }
    )
  }
)
