'use server'

import {revalidatePath, updateTag} from 'next/cache'

import {TENANT_CACHE_TAG} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {MemberActionResult} from '@/components/features/organization/action'
import {withRlsBypass} from '@/db/tenant-scope'
import {canInviteToOrganization} from '@/services/authorization/organization-authorization'
import {
  createOrganizationMemberService,
  deleteInvitationByIdService,
  deleteOrganizationService,
  provisionOrganizationService,
  updateOrganizationModulesService,
  updateOrganizationService,
} from '@/services/facades/organization-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {
  OrganizationModule,
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

// ========================================
// PROVISIONING (s01)
// ========================================

export type ProvisionFormState = {
  success: boolean
  errors?: Array<{field: string; message: string}>
  message?: string
  organizationId?: string
  organizationName?: string
  domain?: string
  adminEmail?: string
}

/**
 * Provisionne une association. Reservee au SuperAdmin Zourite Studio.
 *
 * `withRlsBypass()` est la porte que l'ADR 002 reserve nommement au
 * provisioning : le tenant n'existe pas encore quand l'ecriture commence, donc
 * aucun scope ne peut etre pose. Les tables touchees ici relevent du plan
 * identite (ADR 014), et l'amorcage de lignes scopees passera par ce meme
 * point d'entree.
 *
 * `updateTag` et non `revalidateTag` : le SuperAdmin doit voir son association
 * repondre tout de suite, pas apres un rafraichissement en arriere-plan.
 */
export async function provisionOrganizationAction(
  prevState?: ProvisionFormState,
  formData?: FormData
): Promise<ProvisionFormState> {
  await requireActionAuth({
    roles: [RoleConst.SUPER_ADMIN],
  })

  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const name = (formData.get('name') as string) ?? ''
  const slug = (formData.get('slug') as string) ?? ''
  const domain = (formData.get('domain') as string) ?? ''
  const adminEmail = (formData.get('adminEmail') as string) ?? ''
  const contactEmail = (formData.get('contactEmail') as string) ?? ''
  const enabledModules = formData.getAll('modules') as OrganizationModule[]

  try {
    const provisioned = await withRlsBypass(async () =>
      provisionOrganizationService({
        name,
        slug,
        domain,
        adminEmail,
        contactEmail,
        enabledModules,
      })
    )

    updateTag(TENANT_CACHE_TAG)
    revalidatePath('/admin/organizations')

    return {
      success: true,
      organizationId: provisioned.organization.id,
      organizationName: provisioned.organization.name,
      domain: provisioned.organization.domain ?? domain,
      adminEmail,
    }
  } catch (error) {
    console.error('Erreur lors du provisioning:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

/**
 * Active ou desactive les modules d'une association (ADR 010). L'effet est
 * immediat : le tag de resolution du tenant est invalide dans la foulee, sans
 * quoi le drapeau resterait faux jusqu'a expiration du cache.
 */
export async function updateOrganizationModulesAction(
  organizationId: string,
  enabledModules: OrganizationModule[]
): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.SUPER_ADMIN],
  })

  try {
    await updateOrganizationModulesService(organizationId, enabledModules)

    updateTag(TENANT_CACHE_TAG)
    revalidatePath(`/admin/organizations/${organizationId}/edit`)

    return {success: true}
  } catch (error) {
    console.error('Erreur lors du changement de module:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}
