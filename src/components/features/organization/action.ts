'use server'

import {revalidatePath} from 'next/cache'
import {headers} from 'next/headers'

import {requireActionAuth} from '@/app/dal/user-dal'
import {auth} from '@/lib/better-auth/auth'
import {
  canInviteToOrganization,
  checkMembersLimit,
} from '@/services/authorization/organization-authorization'
import {uploadImageForEntityService} from '@/services/facades/file-service-facade'
import {
  createOrganizationMemberService,
  removeUserFromOrganizationService,
  updateOrganizationService,
} from '@/services/facades/organization-service-facade'
import {
  EntityTypeConst,
  FileCategoryConst,
} from '@/services/types/domain/file-types'
import {
  OrganizationRole,
  OrganizationRoleConst,
  UpdateOrganization,
} from '@/services/types/domain/organization-types'
import {User, UserDTO} from '@/services/types/domain/user-types'
import {searchUsersService} from '@/services/user-service'

import {
  organizationFormSchema,
  OrganizationFormSchemaType,
} from './organization-form-validation'

type ValidationError = {
  field: keyof OrganizationFormSchemaType
  message: string
}

export type FormState = {
  success: boolean
  errors?: ValidationError[]
  message?: string
}

export async function updateOrganizationAction(
  prevState?: FormState,
  formData?: FormData
): Promise<FormState> {
  const user = await requireActionAuth()

  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }
  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  // Extraire les données du FormData
  const organizationData: UpdateOrganization = {
    id: formData.get('id') as string,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string,
    logo: (formData.get('logo') as string) || '',
  }

  // STEP 1 : Valider les données avec le schéma Zod côté back
  const validationResult = organizationFormSchema.safeParse(organizationData)

  if (!validationResult.success) {
    // Récupérer les messages d'erreur à plat
    const errorMessages = validationResult.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ')
    // Récupérer les messages d'erreur pour chaque champ
    const validationErrors: ValidationError[] =
      validationResult.error.issues.map((err) => ({
        field: err.path[0] as keyof OrganizationFormSchemaType,
        message: err.message,
      }))
    return {
      success: false,
      message: `Validation échouée: ${errorMessages}`,
      errors: validationErrors,
    }
  }

  const validatedData = validationResult.data as UpdateOrganization

  try {
    await updateOrganizationService(validatedData)
    revalidatePath('/organizations')
    return {success: true, message: 'Organisation mise à jour avec succès'}
  } catch (error) {
    console.error(error)
    return {
      success: false,
      message: "Échec de la mise à jour de l'organisation",
    }
  }
}

export type MemberActionResult = {
  success: boolean
  message?: string
}

export async function addUserToOrganizationAction(
  organizationId: string,
  userId: string,
  email: string,
  role: OrganizationRole = OrganizationRoleConst.member as OrganizationRole,
  sendInvitationEmail?: boolean
): Promise<MemberActionResult> {
  await requireActionAuth()

  try {
    const limits = await checkMembersLimit(1)
    if (!limits.allowed) {
      return {
        success: false,
        message: `Vous avez atteint la limite d'invitations pour votre abonnement ${limits.limitType} : ${limits.limit}`,
      }
    }
    const hasPermission = await canInviteToOrganization(organizationId)
    if (!hasPermission) {
      return {
        success: false,
        message: "Vous n'avez pas les permissions pour inviter des membres",
      }
    }
    if (sendInvitationEmail) {
      const response = await auth.api.createInvitation({
        headers: await headers(),
        body: {
          organizationId,
          email: email,
          role: role,
        },
        asResponse: true,
      })

      if (!response.ok) {
        return {
          success: false,
          message: "Erreur lors de l'envoi de l'invitation",
        }
      }
    } else {
      await createOrganizationMemberService({
        organizationId,
        userId,
        role: role || 'member',
        createdAt: new Date(),
      })
    }
    revalidatePath(`/organizations/${organizationId}/edit`)
    return {success: true, message: 'Membre invité avec succès'}
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function cancelMemberInvitationAction(
  organizationId: string,
  invitationId: string
) {
  // Utilisation des paramètres pour éviter les warnings linter
  void organizationId
  void invitationId
  // À implémenter côté serveur

  const response = await auth.api.cancelInvitation({
    headers: await headers(),
    body: {
      invitationId,
    },
    asResponse: true,
  })

  if (!response.ok) {
    return {
      success: false,
      message: "Erreur lors de l'envoi de l'invitation",
    }
  }
  revalidatePath(`/organizations/${organizationId}/edit`)
  return {success: true, message: 'Invitation annulée'}
}

export async function searchUsersForOrganizationAction(
  organizationId: string,
  query: string
): Promise<UserDTO[]> {
  await requireActionAuth()
  console.log('organizationId', organizationId)
  console.log('query', query)
  if (!query || query.length < 2) return []
  const users = await searchUsersService(query, organizationId)
  // On retourne seulement les infos nécessaires pour l'autocomplete

  return users.map((u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? undefined,
  }))
}

export async function removeUserFromOrganizationAction(
  organizationId: string,
  userId: string
): Promise<MemberActionResult> {
  await requireActionAuth()
  try {
    await removeUserFromOrganizationService(userId, organizationId)
    revalidatePath(`/organizations/${organizationId}/edit`)
    return {success: true, message: 'Membre supprimé avec succès'}
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export type UploadImageState = {
  success: boolean
  message?: string
  imageUrl?: string
}

export async function uploadOrganizationImageAction(
  prevState?: UploadImageState,
  formData?: FormData
): Promise<UploadImageState> {
  const user = await requireActionAuth()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }
  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const file = formData.get('file') as File
  const organizationId = formData.get('organizationId') as string

  if (!file || file.size === 0) {
    return {success: false, message: 'Aucun fichier fourni'}
  }

  if (!organizationId) {
    return {success: false, message: "ID d'organisation manquant"}
  }

  try {
    const result = await uploadImageForEntityService({
      file,
      entityType: EntityTypeConst.ORGANIZATION,
      entityId: organizationId,
      category: FileCategoryConst.LOGO,
    })

    return {
      success: true,
      message: 'Image uploadée avec succès',
      imageUrl: result.url,
    }
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return {
      success: false,
      message: "Impossible d'uploader l'image. Veuillez réessayer.",
    }
  }
}
