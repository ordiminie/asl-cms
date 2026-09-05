'use server'

import {revalidatePath} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {
  archiveUserSubmissionService,
  markAsReadService,
} from '@/services/facades/user-submission-service-facade'
import {RoleConst} from '@/services/types/domain/auth-types'

export type FormState = {
  success: boolean
  errors?: Array<{field: string; message: string}>
  message?: string
}

export async function markAsReadAction(id: string): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    await markAsReadService(id)

    revalidatePath('/admin/submissions')
    return {
      success: true,
      message: 'Soumission marquée comme lue',
    }
  } catch (error) {
    console.error('Erreur lors du marquage comme lu:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}

export async function archiveSubmissionAction(id: string): Promise<FormState> {
  await requireActionAuth({
    roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
  })

  try {
    await archiveUserSubmissionService(id)

    revalidatePath('/admin/submissions')
    return {
      success: true,
      message: 'Soumission archivée',
    }
  } catch (error) {
    console.error("Erreur lors de l'archivage:", error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Une erreur est survenue',
    }
  }
}
