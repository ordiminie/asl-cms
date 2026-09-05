'use server'

import {revalidatePath} from 'next/cache'

import {requireActionAuth} from '@/app/dal/user-dal'
import {
  deleteNotificationService,
  getNotificationsByUserIdService,
  getUnreadNotificationsByUserIdService,
  markAllNotificationsAsReadService,
  markNotificationAsReadService,
  updateNotificationService,
} from '@/services/facades/notification-service-facade'

export async function markNotificationAsReadAction(notificationId: string) {
  await requireActionAuth()
  try {
    await markNotificationAsReadService(notificationId)
    revalidatePath('/notifications')
    return {success: true}
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return {
      success: false,
      error: 'Erreur lors du marquage de la notification comme lue',
    }
  }
}

export async function markNotificationAsUnreadAction(notificationId: string) {
  await requireActionAuth()
  try {
    await updateNotificationService({
      id: notificationId,
      read: false,
    })
    revalidatePath('/notifications')
    return {success: true}
  } catch (error) {
    console.error('Error marking notification as unread:', error)
    return {
      success: false,
      error: 'Erreur lors du marquage de la notification comme non lue',
    }
  }
}

export async function deleteNotificationAction(notificationId: string) {
  await requireActionAuth()
  try {
    await deleteNotificationService(notificationId)
    revalidatePath('/notifications')
    return {success: true}
  } catch (error) {
    console.error('Error deleting notification:', error)
    return {
      success: false,
      error: 'Erreur lors de la suppression de la notification',
    }
  }
}

export async function markAllNotificationsAsReadAction(userId: string) {
  await requireActionAuth({uid: userId})
  try {
    const result = await markAllNotificationsAsReadService(userId)
    revalidatePath('/notifications')
    return {success: true, count: result}
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return {
      success: false,
      error: 'Erreur lors du marquage de toutes les notifications comme lues',
    }
  }
}

export async function getNotificationsByFilterAction(
  userId: string,
  filter: 'all' | 'unread',
  pagination: {page: number; limit: number}
) {
  await requireActionAuth({uid: userId})
  try {
    const offset = (pagination.page - 1) * pagination.limit
    const paginationParams = {
      limit: pagination.limit,
      offset,
    }

    const result =
      filter === 'unread'
        ? await getUnreadNotificationsByUserIdService(userId, paginationParams)
        : await getNotificationsByUserIdService(userId, paginationParams)

    revalidatePath('/notifications')
    return {success: true, data: result}
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return {
      success: false,
      error: 'Erreur lors de la récupération des notifications',
    }
  }
}
