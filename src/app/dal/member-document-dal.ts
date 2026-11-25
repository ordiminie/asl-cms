import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {listAssociationCategoriesService} from '@/services/facades/association-category-service-facade'
import {
  canManageMemberDocumentsService,
  getMemberDocumentBatchReachService,
  getMemberDocumentsForBureauService,
  getMemberDocumentsOfProfileForBureauService,
  getMyMemberDocumentsService,
} from '@/services/facades/member-document-service-facade'
import {
  AssociationCategoryListDTO,
  CategoryDomainConst,
  PublicCategoryDTO,
} from '@/services/types/domain/association-category-types'
import type {
  BureauMemberDocumentDTO,
  BureauMemberDocumentPageDTO,
  MemberDocumentBatchReachDTO,
  MyMemberDocumentDTO,
} from '@/services/types/domain/member-document-types'

/**
 * Lectures des documents nominatifs (s32, ADR 073). **Aucun `'use cache'`** :
 * donnees personnelles lues sous session, streamees derriere un
 * `<Suspense>`. `cache()` deduplique seulement dans la requete.
 */

/** Le compte connecte gere-t-il les documents nominatifs du domaine ? */
export const canManageCurrentMemberDocumentsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageMemberDocumentsService(tenant.id)
  }
)

/**
 * Les documents d'une fiche ; rien pour un compte qui ne les gere pas : la
 * section n'est alors pas rendue (ecran 2).
 */
export const getMemberDocumentsOfProfileForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<BureauMemberDocumentDTO[] | undefined> => {
    if (!(await canManageMemberDocumentsService(organizationId))) {
      return undefined
    }
    return getMemberDocumentsOfProfileForBureauService(
      organizationId,
      memberProfileId
    )
  }
)

/**
 * Les categories du domaine `member_document`, avec le nombre de documents
 * que chacune range. Le service verifie `member.document.manage`.
 */
export const getMemberDocumentCategoriesForBureauDal = cache(
  async (organizationId: string): Promise<AssociationCategoryListDTO> =>
    listAssociationCategoriesService(
      organizationId,
      CategoryDomainConst.MEMBER_DOCUMENT
    )
)

/** Les categories actives proposees au depot : identifiant et nom seuls. */
export const getMemberDocumentCategoryChoicesDal = cache(
  async (organizationId: string): Promise<PublicCategoryDTO[]> => {
    const list = await getMemberDocumentCategoriesForBureauDal(organizationId)
    return list.items.map((category) => ({
      id: category.id,
      name: category.name,
    }))
  }
)

/**
 * Une page de la vue d'ensemble du bureau (critere 6) : filtres et
 * pagination appliques par le serveur.
 */
export const getMemberDocumentsForBureauDal = cache(
  async (
    organizationId: string,
    filters: {search?: string; categoryId?: string; page: number}
  ): Promise<BureauMemberDocumentPageDTO> =>
    getMemberDocumentsForBureauService({organizationId, ...filters})
)

/** Les fiches qu'un lot peut atteindre, ou non (5d, 5e). */
export const getMemberDocumentBatchReachDal = cache(
  async (organizationId: string): Promise<MemberDocumentBatchReachDTO> =>
    getMemberDocumentBatchReachService(organizationId)
)

/**
 * « Mes documents » du compte connecte, sur l'association du domaine (s32,
 * criteres 1, 3 et 5). Sans session, rien, sans que l'espace membre casse ;
 * une panne remonte.
 */
export const getMyMemberDocumentsDal = cache(
  async (): Promise<MyMemberDocumentDTO[] | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getMyMemberDocumentsService(tenant.id).catch((error: unknown) => {
      if (error instanceof AuthorizationError) return undefined
      throw error
    })
  }
)
