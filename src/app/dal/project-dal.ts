import {cache} from 'react'

import {getAuthUser} from '@/services/authentication/auth-service'
import {
  canCreateProject,
  canDeleteProject,
  canUpdateProject,
} from '@/services/authorization/project-authorization'
import {getProjectsWithPaginationService} from '@/services/facades/project-service-facade'
import {PaginatedResponse} from '@/services/types/common-type'
import {Project, ProjectFilters} from '@/services/types/domain/project-types'

/**
 * Récupère les projets d'une organisation avec pagination et recherche optionnelle
 * @param organizationId - L'identifiant de l'organisation
 * @param pagination - Les paramètres de pagination (limit, offset)
 * @param search - Terme de recherche optionnel pour filtrer les projets par nom
 * @returns Une réponse paginée contenant les projets correspondants aux critères
 */
export const getProjectsByOrganizationWithPaginationDal = cache(
  async (
    organizationId: string,
    {limit, offset}: {limit: number; offset: number},
    search?: string
  ): Promise<PaginatedResponse<Project>> => {
    const filters: ProjectFilters = {
      organizationId,
      ...(search ? {name: search} : {}),
    }

    const result = await getProjectsWithPaginationService(
      {limit, offset},
      filters
    )
    return result
  }
)

/**
 * Récupère les permissions d'une organisation pour les projets
 * @param organizationId - L'identifiant de l'organisation
 * @returns Les permissions pour les projets de l'organisation
 */
export const getProjectPermissionsByOrganizationDal = cache(
  async (organizationId: string) => {
    const user = await getAuthUser()
    if (!user) {
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canManage: false,
      }
    }

    // Vérifier les permissions pour cette organisation
    const canCreate = await canCreateProject(organizationId)

    return {
      canCreate,
      canEdit: true, // Sera vérifié au niveau projet
      canDelete: true, // Sera vérifié au niveau projet
      canManage: canCreate, // Si on peut créer, on peut gérer les projets de l'organisation
    }
  }
)

/**
 * Récupère les permissions d'un projet
 * @param projectId - L'identifiant du projet
 * @returns Les permissions pour le projet
 */
export async function getProjectPermissions(projectId?: string) {
  if (!projectId) {
    return {
      canCreate: false,
      canEdit: false,
      canDelete: false,
    }
  }

  const [canEdit, canDelete] = await Promise.all([
    canUpdateProject(projectId),
    canDeleteProject(projectId),
  ])

  return {
    canCreate: false, // Pas applicable au niveau projet
    canEdit,
    canDelete,
  }
}
