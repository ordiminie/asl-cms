import {getNotificationByIdDao} from '@/db/repositories/notification-repository'
import {getAuthUser} from '@/services/authentication/auth-service'

import {isUserAdmin, userCanOnResource} from './authorization-service'
import {ActionsConst, SubjectsConst} from './casl-abilities'

/**
 * Vérifier si l'utilisateur peut lire une notification spécifique
 */
export const canReadNotification = async (
  notificationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  const notification = await getNotificationByIdDao(notificationId)

  if (!notification) return false

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.NOTIFICATION,
    {
      id: notification.id,
      userId: notification.userId,
    }
  )
}

/**
 * Vérifier si l'utilisateur peut mettre à jour une notification spécifique
 */
export const canUpdateNotification = async (
  notificationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  const notification = await getNotificationByIdDao(notificationId)

  if (!notification) return false

  return userCanOnResource(
    authUser,
    ActionsConst.UPDATE,
    SubjectsConst.NOTIFICATION,
    {
      id: notification.id,
      userId: notification.userId,
    }
  )
}

/**
 * Vérifier si l'utilisateur peut supprimer une notification spécifique
 */
export const canDeleteNotification = async (
  notificationId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()
  const notification = await getNotificationByIdDao(notificationId)

  if (!notification) return false

  return userCanOnResource(
    authUser,
    ActionsConst.DELETE,
    SubjectsConst.NOTIFICATION,
    {
      id: notification.id,
      userId: notification.userId,
    }
  )
}

/**
 * Vérifier si l'utilisateur peut lire les notifications d'un utilisateur spécifique
 */
export const canReadUserNotifications = async (
  userId: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  return userCanOnResource(
    authUser,
    ActionsConst.READ,
    SubjectsConst.NOTIFICATION,
    {
      userId,
    }
  )
}

/**
 * Vérifier si l'utilisateur peut créer des notifications
 * - Les admins peuvent créer des notifications pour n'importe qui
 * - Les utilisateurs peuvent créer des notifications pour eux-mêmes (notifications système)
 */
export const canCreateNotification = async (
  userId?: string
): Promise<boolean> => {
  const authUser = await getAuthUser()

  // Si aucun utilisateur n'est connecté, pas d'autorisation
  if (!authUser) {
    return false
  }

  // Si c'est un admin, il peut créer des notifications pour n'importe qui
  if (isUserAdmin(authUser)) {
    return true
  }

  // Si un userId est fourni, l'utilisateur ne peut créer que pour lui-même
  if (userId) {
    return authUser.id === userId
  }

  // Par défaut, seuls les admins peuvent créer sans spécifier d'utilisateur
  return false
}

/**
 * Vérifier si l'utilisateur peut gérer toutes les notifications (admin)
 */
export const canManageNotifications = async (): Promise<boolean> => {
  const authUser = await getAuthUser()
  return isUserAdmin(authUser)
}
