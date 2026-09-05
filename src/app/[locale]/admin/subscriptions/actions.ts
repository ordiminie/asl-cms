'use server'

import {revalidatePath} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {
  cancelSubscriptionAdminService,
  reactivateSubscriptionAdminService,
} from '@/services/facades/subscription-service-facade'
import {ActionResponse} from '@/services/types/common-type'
import {RoleConst} from '@/services/types/domain/auth-types'

/**
 * Annuler un abonnement (action admin)
 */
export async function cancelSubscriptionAction(
  subscriptionId: string
): Promise<ActionResponse<void>> {
  try {
    // Vérification de l'authentification et des permissions admin
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    // Annulation de l'abonnement
    await cancelSubscriptionAdminService(subscriptionId)

    // Revalidation du cache
    revalidatePath('/admin/subscriptions')

    return {
      success: true,
      message: 'Abonnement annulé avec succès',
    }
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'abonnement:", error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Erreur lors de l'annulation",
    }
  }
}

/**
 * Réactiver un abonnement (action admin)
 */
export async function reactivateSubscriptionAction(
  subscriptionId: string
): Promise<ActionResponse<void>> {
  try {
    // Vérification de l'authentification et des permissions admin
    await requireActionAuth({
      roles: [RoleConst.ADMIN, RoleConst.SUPER_ADMIN],
    })

    // Réactivation de l'abonnement
    await reactivateSubscriptionAdminService(subscriptionId)

    // Revalidation du cache
    revalidatePath('/admin/subscriptions')

    return {
      success: true,
      message: 'Abonnement réactivé avec succès',
    }
  } catch (error) {
    console.error("Erreur lors de la réactivation de l'abonnement:", error)
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réactivation',
    }
  }
}
