import {cache} from 'react'

import {organizationDTO} from '@/lib/helper/organization-helper'
import {
  canCreateOrganization,
  canDeleteOrganization,
  canManageOrganizationMembers,
  canReadOrganizationMember,
  canUpdateOrganization,
} from '@/services/authorization/organization-authorization'
import {
  getAllOrganizationsWithPaginationService,
  getMembersAndInvitationsService,
  getOrganizationByIdService,
  getOrganizationBySlugService,
  getOrganizationMembersService,
  getOrganizationUsageService,
  getUserInvitationsService,
  getUserOrganizationsWithUsageService,
} from '@/services/facades/organization-service-facade'
import {Pagination} from '@/services/types/common-type'
import {MemberOrInvitationDTO} from '@/services/types/domain/organization-types'

export type OrganizationMemberDTO = {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  joinedAt: Date
}

export type OrganizationDTO = {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  createdAt: Date | null
  updatedAt: Date | null
  metadata: string | null
  limitOverrides: Record<string, number> | null
}

/**
 * Récupère les membres d'une organisation
 * @param organizationId - L'identifiant de l'organisation
 * @returns Les membres de l'organisation
 */
export const getOrganizationMembersDal = cache(
  async (organizationId: string): Promise<OrganizationMemberDTO[]> => {
    const members = await getOrganizationMembersService(organizationId)

    return members.map((m) => {
      if (!m.user) {
        throw new Error('User data missing from organization member')
      }
      return {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image ?? null,
        role: m.role,
        joinedAt: m.createdAt,
      }
    })
  }
)

/**
 * Récupère les membres et les invitations d'une organisation
 * @param organizationId - L'identifiant de l'organisation
 * @returns Les membres et les invitations de l'organisation
 */
export const getMembersAndInvitationsDal = cache(
  async (organizationId: string): Promise<MemberOrInvitationDTO[]> => {
    return await getMembersAndInvitationsService(organizationId)
  }
)

export const getAllOrganizationsWithPaginationDal = cache(
  async (pagination: Pagination, search?: string) => {
    return await getAllOrganizationsWithPaginationService(pagination, search)
  }
)

export async function getOrganizationPermissions(organizationId?: string) {
  const [canCreate, canEdit, canDelete, canReadMembers, canManageMembers] =
    await Promise.all([
      canCreateOrganization(),
      organizationId ? canUpdateOrganization(organizationId) : false,
      organizationId ? canDeleteOrganization(organizationId) : false,
      organizationId ? canReadOrganizationMember(organizationId) : false,
      organizationId ? canManageOrganizationMembers(organizationId) : false,
    ])

  return {
    canCreate,
    canEdit,
    canDelete,
    canReadMembers,
    canManageMembers,
  }
}

export const getOrganizationBySlugDal = cache(
  async (slug: string): Promise<OrganizationDTO | undefined> => {
    const organization = await getOrganizationBySlugService(slug)
    return organizationDTO(organization)
  }
)

export const getOrganizationByIdDal = cache(
  async (id: string): Promise<OrganizationDTO | undefined> => {
    const organization = await getOrganizationByIdService(id)
    return organizationDTO(organization)
  }
)

export const getOrganizationAdminPermissionsDal = cache(async () => {
  // Pour l'admin, toutes les permissions dépendent du droit de création
  const [canCreate] = await Promise.all([canCreateOrganization()])

  return {
    canCreate,
    canEdit: canCreate, // Admin peut éditer si il peut créer
    canDelete: canCreate, // Admin peut supprimer si il peut créer
    canManage: canCreate, // Admin peut gérer si il peut créer
  }
})
export const getUserInvitationsServiceDal = cache(async () => {
  const invitations = await getUserInvitationsService()
  return invitations
})

// ========================================
// USAGE FUNCTIONS
// ========================================

export const getOrganizationUsageDal = cache(async (organizationId: string) => {
  return await getOrganizationUsageService(organizationId)
})

export const getUserOrganizationsWithUsageDal = cache(async () => {
  return await getUserOrganizationsWithUsageService()
})
