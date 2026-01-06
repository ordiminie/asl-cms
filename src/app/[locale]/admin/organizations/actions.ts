'use server'

import {revalidatePath} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {MemberActionResult} from '@/components/features/organization/action'
import {canInviteToOrganization} from '@/services/authorization/organization-authorization'
import {
  createOrganizationMemberService,
  deleteInvitationByIdService,
  deleteOrganizationService,
  updateOrganizationService,
} from '@/services/facades/organization-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {
  OrganizationRole,
  OrganizationRoleConst,
} from '@/services/types/domain/organization-types'

export type FormState = {
  success: boolean
  errors?: Array<{field: string; message: string}>
  message?: string
}

export async function updateOrganizationAction(
  id: string,
  prevState?: FormState,
  formData?: FormData
): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })
  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  try {
    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const description = formData.get('description') as string
    const limitOverridesStr = formData.get('limitOverrides') as string

    // Parse limitOverrides si présent
    let limitOverrides: Record<string, number> | undefined
    if (limitOverridesStr) {
      try {
        limitOverrides = JSON.parse(limitOverridesStr)
      } catch {
        return {
          success: false,
          message: 'Format des limites invalide',
        }
      }
    }

    // Validation optionnelle des données
    if (!name || !slug) {
      return {
        success: false,
        message: 'Le nom et le slug sont requis',
      }
    }

    await updateOrganizationService({
      id,
      name,
      slug,
      description: description || undefined,
      limitOverrides,
    })

    revalidatePath('/admin/organizations')
    return {
      success: true,
      message: 'Organisation mise à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

export async function deleteOrganizationAction(id: string): Promise<FormState> {
  try {
    await deleteOrganizationService(id)

    revalidatePath('/admin/organizations')
    return {
      success: true,
      message: 'Organisation supprimée avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

export async function addUserToOrganizationAction(
  organizationId: string,
  userId: string,
  email: string,
  role: OrganizationRole = OrganizationRoleConst.member as OrganizationRole
): Promise<MemberActionResult> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    // const limits = await checkMembersLimit(1)
    // if (!limits.allowed) {
    //   return {
    //     success: false,
    //     message: `Vous avez atteint la limite d'invitations pour votre abonnement ${limits.limitType} : ${limits.limit}`,
    //   }
    // }
    const hasPermission = await canInviteToOrganization(organizationId)
    if (!hasPermission) {
      return {
        success: false,
        message: "Vous n'avez pas les permissions pour inviter des membres",
      }
    }

    await createOrganizationMemberService({
      organizationId,
      userId,
      role: role || 'member',
      createdAt: new Date(),
    })

    revalidatePath(`/admin/organizations/${organizationId}/edit`)
    return {success: true, message: 'Membre ajouté avec succès'}
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function deleteAdminMemberInvitationAction(
  organizationId: string,
  invitationId: string
) {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  await deleteInvitationByIdService(invitationId)

  revalidatePath(`/admin/organizations/${organizationId}/edit`)
  return {success: true, message: 'Invitation annulée'}
}
