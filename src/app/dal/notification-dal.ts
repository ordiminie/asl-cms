import {cache} from 'react'

import {
  getNotificationsByUserIdService,
  getUnreadNotificationsByUserIdService,
} from '@/services/facades/notification-service-facade'
import {Pagination} from '@/services/types/common-type'

export const getNotificationsForUser = cache(
  async (userId: string, pagination: Pagination) => {
    return await getNotificationsByUserIdService(userId, pagination)
  }
)
export const getUnreadNotificationsForUser = cache(
  async (userId: string, pagination: Pagination) => {
    return await getUnreadNotificationsByUserIdService(userId, pagination)
  }
)
