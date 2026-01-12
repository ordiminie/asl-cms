'use server'

import {revalidatePath} from 'next/cache'
import {headers} from 'next/headers'

import {requireActionAuth} from '@/app/dal/user-dal'
import {auth} from '@/lib/auth'
import {
  getAllUsersWithPaginationService,
  updateUserService,
} from '@/services/facades/user-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'
import {Roles, UpdateUser, User} from '@/services/types/domain/user-types'

export type FormState = {
  success: boolean
  errors?: Array<{field: string; message: string}>
  message?: string
}

export async function updateUserAction(
  userId: string,
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
    const email = formData.get('email') as string
    const visibility = formData.get('visibility') as 'public' | 'private'

    // Validation basique côté serveur
    if (!name || !email) {
      return {
        success: false,
        message: "Le nom et l'email sont requis",
        errors: [
          ...(name ? [] : [{field: 'name', message: 'Le nom est requis'}]),
          ...(email ? [] : [{field: 'email', message: "L'email est requis"}]),
        ],
      }
    }

    await updateUserService({
      id: userId,
      name,
      email,
      visibility,
      updatedAt: new Date(),
    })

    revalidatePath('/admin/users')
    return {
      success: true,
      message: 'Utilisateur mis à jour avec succès',
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'utilisateur:", error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la mise à jour',
    }
  }
}

export async function updateUserDetailAction(
  userId: string,
  data: {
    name: string
    email: string
    role: string
    visibility: 'public' | 'private'
    banned: boolean
    banReason?: string
    banExpiresIn?: number
    twoFactorEnabled: boolean
    emailVerified: boolean
  }
): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    // Validation basique côté serveur
    if (!data.name || !data.email) {
      return {
        success: false,
        message: "Le nom et l'email sont requis",
        errors: [
          ...(data.name ? [] : [{field: 'name', message: 'Le nom est requis'}]),
          ...(data.email
            ? []
            : [{field: 'email', message: "L'email est requis"}]),
        ],
      }
    }

    // Ne pas passer les données de ban - elles sont gérées par Better Auth
    const updateData: UpdateUser = {
      id: userId,
      name: data.name,
      email: data.email,
      role: data.role as Roles,
      visibility: data.visibility,
      //twoFactorEnabled: data.twoFactorEnabled, // need use betterauth api
      emailVerified: data.emailVerified,
      updatedAt: new Date(),
    }

    await updateUserService(updateData)

    // Récupérer les headers pour l'authentification
    const currentHeaders = await headers()

    if (data.banned) {
      const result = await auth.api.banUser({
        body: {
          userId,
          banReason: data.banReason,
          banExpiresIn: data.banExpiresIn,
        },
        headers: currentHeaders,
        asResponse: true,
      })
      console.log('Ban result:', result.status, await result.text())
      if (!result.ok) {
        return {
          success: false,
          message: "Erreur lors du bannissement de l'utilisateur",
        }
      }
    } else {
      // Si l'utilisateur n'est plus banni, le débanner
      const result = await auth.api.unbanUser({
        body: {
          userId,
        },
        headers: currentHeaders,
        asResponse: true,
      })
      console.log('Unban result:', result.status, await result.text())
      if (!result.ok) {
        return {
          success: false,
          message: "Erreur lors du débannissement de l'utilisateur",
        }
      }
    }

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)
    return {
      success: true,
      message: 'Utilisateur mis à jour avec succès',
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'utilisateur:", error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la mise à jour',
    }
  }
}

export async function deleteUserAction(userId: string): Promise<FormState> {
  try {
    // Note: Nous n'avons pas encore implémenté deleteUserService
    // Ceci est un placeholder pour la fonction
    console.log('Delete user:', userId)

    revalidatePath('/admin/users')
    return {
      success: true,
      message: 'Utilisateur supprimé avec succès',
    }
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la suppression',
    }
  }
}

export async function fetchUsersAction(params: {
  limit: number
  offset: number
  search?: string
}): Promise<{
  success: boolean
  data: User[]
  pagination: {total: number; hasMore: boolean} | null
}> {
  try {
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    const result = await getAllUsersWithPaginationService(
      {limit: params.limit, offset: params.offset},
      params.search
    )

    return {
      success: true,
      data: result.data,
      pagination: {
        total: result.pagination.total,
        hasMore: params.offset + result.data.length < result.pagination.total,
      },
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    return {success: false, data: [], pagination: null}
  }
}
