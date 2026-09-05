'use client'

import {formatDistanceToNow} from 'date-fns'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'

import {
  deleteNotificationAction,
  markNotificationAsReadAction,
  markNotificationAsUnreadAction,
} from '@/app/[locale]/(app)/account/notifications/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {getDateFnsLocale} from '@/lib/helper/date-helper'
import {Notification} from '@/services/types/domain/notification-types'

import NotificationIcon from './notification-icon'

interface NotificationItemProps {
  notification: Notification
  onUpdate: (notificationId: string, read: boolean) => Promise<void>
  onDelete: (notificationId: string) => void
}

export default function NotificationItem({
  notification,
  onUpdate,
  onDelete,
}: NotificationItemProps) {
  const t = useTranslations('Notifications')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)

  const handleMarkAsRead = async () => {
    if (notification.read) return

    setLoading(true)
    try {
      const result = await markNotificationAsReadAction(notification.id)
      if (result.success) {
        await onUpdate(notification.id, true)
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsUnread = async () => {
    if (!notification.read) return

    setLoading(true)
    try {
      const result = await markNotificationAsUnreadAction(notification.id)
      if (result.success) {
        await onUpdate(notification.id, false)
      }
    } catch (error) {
      console.error('Error marking as unread:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const result = await deleteNotificationAction(notification.id)
      if (result.success) {
        onDelete(notification.id)
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    } finally {
      setLoading(false)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: getDateFnsLocale(locale),
  })

  const handleCardClick = async () => {
    if (!notification.read) {
      await handleMarkAsRead()
    }
  }

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        !notification.read
          ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
          : 'hover:bg-muted/50'
      }`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <NotificationIcon
              type={notification.type}
              read={notification.read}
            />
            <div className="space-y-1">
              <h3 className="leading-tight font-semibold">
                {notification.title}
              </h3>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <time>{timeAgo}</time>
                <Badge variant="outline" className="text-xs">
                  {notification.type}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!notification.read && (
              <div
                className="h-2 w-2 rounded-full bg-blue-500"
                title={t('unread')}
              />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={loading}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!notification.read ? (
                  <DropdownMenuItem
                    onClick={handleMarkAsRead}
                    className="gap-2"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Marquer comme lue
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={handleMarkAsUnread}
                    className="gap-2"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Marquer comme non lue
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive gap-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm leading-relaxed">{notification.message}</p>

        {notification.metadata &&
          Object.keys(notification.metadata).length > 0 && (
            <div className="bg-muted/50 mt-3 rounded-md p-3">
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer font-medium">
                  Détails
                </summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {JSON.stringify(notification.metadata, null, 2)}
                </pre>
              </details>
            </div>
          )}
      </CardContent>
    </Card>
  )
}
