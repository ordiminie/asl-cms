'use server'

import {revalidatePath} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {bulkUpdateAppSettingsService} from '@/services/facades/app-settings-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'

export type UpdateSettingsInput = Array<{key: string; value: string}>

export async function updateSettingsAction(
  settings: UpdateSettingsInput
): Promise<ActionResponse<void>> {
  try {
    const authUser = await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    await bulkUpdateAppSettingsService(settings, authUser.id)

    revalidatePath('/admin/settings')

    return {
      success: true,
      message: 'Paramètres mis à jour avec succès',
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la mise à jour',
    }
  }
}
