import {and, count, desc, eq} from 'drizzle-orm'

import db from '@/db/models/db'
import {
  AddNotificationModel,
  NotificationModel,
  notifications,
  UpdateNotificationModel,
} from '@/db/models/notification-model'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'

// CRUD operations

/**
 * Créer une nouvelle notification
 */
export const createNotificationDao = async (
  notification: AddNotificationModel
): Promise<NotificationModel> => {
  const row = await db.insert(notifications).values(notification).returning()
  return row[0]
}

/**
 * Récupérer une notification par ID
 */
export const getNotificationByIdDao = async (
  id: string
): Promise<NotificationModel | undefined> => {
  const row = await db.query.notifications.findFirst({
    where: (notifications, {eq}) => eq(notifications.id, id),
    with: {
      user: true,
    },
  })
  return row
}

/**
 * Récupérer toutes les notifications d'un utilisateur avec pagination
 */
export const getNotificationsByUserIdDao = async (
  userId: string,
  pagination: Pagination
): Promise<PaginatedResponse<NotificationModel>> => {
  const {limit, offset} = pagination

  // Récupérer les notifications avec pagination
  const rows = await db.query.notifications.findMany({
    where: (notifications, {eq}) => eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
    offset,
  })

  // Compter le total
  const [totalResult] = await db
    .select({count: count()})
    .from(notifications)
    .where(eq(notifications.userId, userId))

  const total = totalResult.count

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

/**
 * Récupérer les notifications non lues d'un utilisateur
 */
export const getUnreadNotificationsByUserIdDao = async (
  userId: string,
  pagination: Pagination
): Promise<PaginatedResponse<NotificationModel>> => {
  const {limit, offset} = pagination

  // Récupérer les notifications non lues avec pagination
  const rows = await db.query.notifications.findMany({
    where: (notifications, {eq, and}) =>
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    orderBy: [desc(notifications.createdAt)],
    limit,
    offset,
  })

  // Compter le total des notifications non lues
  const [totalResult] = await db
    .select({count: count()})
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  const total = totalResult.count

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

/**
 * Compter les notifications non lues d'un utilisateur
 */
export const countUnreadNotificationsByUserIdDao = async (
  userId: string
): Promise<number> => {
  const [result] = await db
    .select({count: count()})
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return result.count
}

/**
 * Marquer une notification comme lue
 */
export const markNotificationAsReadDao = async (
  id: string
): Promise<NotificationModel | undefined> => {
  const row = await db
    .update(notifications)
    .set({read: true})
    .where(eq(notifications.id, id))
    .returning()

  return row[0]
}

/**
 * Marquer toutes les notifications d'un utilisateur comme lues
 */
export const markAllNotificationsAsReadDao = async (
  userId: string
): Promise<number> => {
  const result = await db
    .update(notifications)
    .set({read: true})
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return result.rowCount || 0
}

/**
 * Supprimer une notification
 */
export const deleteNotificationDao = async (id: string): Promise<boolean> => {
  const result = await db.delete(notifications).where(eq(notifications.id, id))

  return (result.rowCount || 0) > 0
}

/**
 * Supprimer toutes les notifications lues d'un utilisateur
 */
export const deleteReadNotificationsByUserIdDao = async (
  userId: string
): Promise<number> => {
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, true)))

  return result.rowCount || 0
}

/**
 * Mettre à jour une notification
 */
export const updateNotificationDao = async (
  id: string,
  data: Partial<UpdateNotificationModel>
): Promise<NotificationModel | undefined> => {
  const row = await db
    .update(notifications)
    .set(data)
    .where(eq(notifications.id, id))
    .returning()

  return row[0]
}
