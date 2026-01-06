import {OrganizationDTO} from '@/app/dal/organization-dal'
import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'
import {Organization} from '@/services/types/domain/organization-types'

/**
 * Trie les organisations par rôle : OWNER en premier, puis ADMIN, puis les autres
 * @param organizations - Liste des organisations avec leur rôle
 * @returns Liste triée des organisations
 */
export function sortOrganizationsByRole<T extends {id: string; role: string}>(
  organizations: T[]
): T[] {
  return organizations.sort((a, b) => {
    const roleOrder = {
      [UserOrganizationRoleConst.OWNER]: 0,
      [UserOrganizationRoleConst.ADMIN]: 1,
      [UserOrganizationRoleConst.MEMBER]: 2,
    }

    const aOrder = roleOrder[a.role] ?? 3
    const bOrder = roleOrder[b.role] ?? 3

    return aOrder - bOrder
  })
}

export function organizationDTO(
  organization?: Organization
): OrganizationDTO | undefined {
  if (!organization) return

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? '',
    description: organization.description ?? null,
    logo: organization.logo ?? null,
    createdAt: organization.createdAt ?? null,
    updatedAt: organization.updatedAt ?? null,
    metadata: organization.metadata ?? null,
    limitOverrides:
      (organization.limitOverrides as Record<string, number>) ?? null,
  }
}
