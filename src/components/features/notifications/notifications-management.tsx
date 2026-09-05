'use client'

import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'

import {
  getNotificationsByFilterAction,
  markAllNotificationsAsReadAction,
} from '@/app/[locale]/(app)/account/notifications/actions'
import {useUnreadNotifications} from '@/components/hooks/use-unread-notifications'
import {Card} from '@/components/ui/card'
import {PaginatedResponse} from '@/services/types/common-type'
import {Notification} from '@/services/types/domain/notification-types'

import NotificationItem from './notification-item'
import NotificationsPagination from './notifications-pagination'
import NotificationsToolbar from './notifications-toolbar'

interface NotificationsManagementProps {
  initialData: PaginatedResponse<Notification>
  userId: string
}

export default function NotificationsManagement({
  initialData,
  userId,
}: NotificationsManagementProps) {
  const t = useTranslations('Notifications')
  const [data, setData] = useState(initialData)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [loading, setLoading] = useState(true)
  const {updateUnreadCount, decrementUnreadCount} = useUnreadNotifications()

  // Charger les notifications non lues au démarrage
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const result = await getNotificationsByFilterAction(
          `${userId}`,
          'unread',
          {page: 1, limit: initialData.pagination.limit}
        )
        if (cancelled) return
        if (result.success && result.data) {
          setData(result.data)
        }
      } catch (error) {
        if (cancelled) return
        console.error('Error filtering notifications:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId, initialData.pagination.limit])

  const handleFilterChange = async (newFilter: 'all' | 'unread') => {
    setFilter(newFilter)
    setLoading(true)

    try {
      const result = await getNotificationsByFilterAction(
        `${userId}`,
        newFilter,
        {
          page: 1,
          limit: data.pagination.limit,
        }
      )

      if (result.success && result.data) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error filtering notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      const result = await markAllNotificationsAsReadAction(userId)
      if (result.success) {
        // Marquer toutes les notifications comme lues dans le state local
        setData((prev) => ({
          ...prev,
          data: prev.data.map((notification) => ({
            ...notification,
            read: true,
          })),
        }))

        // Si on est en mode "non lues", recharger les données pour refléter le filtre
        if (filter === 'unread') {
          await handleFilterChange('unread')
        }

        // Mettre à jour le compteur global
        updateUnreadCount(0)
      } else {
        console.error('Failed to mark all as read:', result.error)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationUpdate = async (
    notificationId: string,
    read: boolean
  ) => {
    setData((prev) => ({
      ...prev,
      data: prev.data.map((notification) =>
        notification.id === notificationId
          ? {...notification, read}
          : notification
      ),
    }))

    // Si on est en mode "non lues" et qu'on marque comme lu,
    // retirer la notification de la liste
    if (filter === 'unread' && read) {
      setData((prev) => ({
        ...prev,
        data: prev.data.filter(
          (notification) => notification.id !== notificationId
        ),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }))
    }

    // Mettre à jour le compteur global
    if (read) {
      decrementUnreadCount()
    }
  }

  const handleNotificationDelete = (notificationId: string) => {
    setData((prev) => ({
      ...prev,
      data: prev.data.filter(
        (notification) => notification.id !== notificationId
      ),
      pagination: {
        ...prev.pagination,
        total: prev.pagination.total - 1,
      },
    }))
  }

  const hasUnreadNotifications = data.data.some(
    (notification) => !notification.read
  )

  return (
    <div className="space-y-6">
      <NotificationsToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        onMarkAllAsRead={handleMarkAllAsRead}
        hasUnreadNotifications={hasUnreadNotifications}
        loading={loading}
      />

      <div className="space-y-4">
        {data.data.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="space-y-3">
              <div className="text-muted-foreground mx-auto h-12 w-12">🔔</div>
              <h3 className="text-lg font-semibold">{t('empty.title')}</h3>
              <p className="text-muted-foreground">
                {filter === 'unread' ? t('empty.allRead') : t('empty.none')}
              </p>
            </div>
          </Card>
        ) : (
          data.data.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onUpdate={handleNotificationUpdate}
              onDelete={handleNotificationDelete}
            />
          ))
        )}
      </div>

      {data.pagination.totalPages > 1 && (
        <NotificationsPagination
          pagination={data.pagination}
          onPageChange={(page) => {
            // TODO: Implement pagination
            console.log('Page changed to:', page)
          }}
        />
      )}
    </div>
  )
}
