import 'server-only'

import {cache} from 'react'

import {
  listActiveReportCategoriesPublicService,
  listAssociationCategoriesService,
} from '@/services/facades/association-category-service-facade'
import {
  AssociationCategoryListDTO,
  CategoryDomainConst,
  PublicCategoryDTO,
} from '@/services/types/domain/association-category-types'

/**
 * Les categories de signalement actives, pour le formulaire public
 * `/signaler`. **Aucun `'use cache'`** : la liste depend du tenant du domaine
 * appele et doit refleter une categorie supprimee des la requete suivante
 * (critere 5). `cache()` deduplique seulement dans la requete.
 */
export const getActiveReportCategoriesDal = cache(
  async (organizationId: string): Promise<PublicCategoryDTO[]> =>
    listActiveReportCategoriesPublicService(organizationId)
)

/**
 * Les categories de signalement vues par le bureau, avec le nombre de
 * signalements que chacune porte. Donnee d'administration : aucun
 * `'use cache'`. Le service verifie `report.manage` et ouvre le scope du
 * tenant.
 */
export const getReportCategoriesForBureauDal = cache(
  async (organizationId: string): Promise<AssociationCategoryListDTO> =>
    listAssociationCategoriesService(organizationId, CategoryDomainConst.REPORT)
)
