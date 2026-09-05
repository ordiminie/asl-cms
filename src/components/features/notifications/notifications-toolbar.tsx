'use client'

import {useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NotificationsToolbarProps {
  filter: 'all' | 'unread'
  onFilterChange: (filter: 'all' | 'unread') => void
  onMarkAllAsRead: () => void
  hasUnreadNotifications: boolean
  loading: boolean
}

export default function NotificationsToolbar({
  filter,
  onFilterChange,
  onMarkAllAsRead,
  hasUnreadNotifications,
  loading,
}: NotificationsToolbarProps) {
  const t = useTranslations('Notifications')
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {filter === 'all' ? t('filter.all') : t('filter.unread')}
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => onFilterChange('all')}
              className="gap-2"
            >
              <div className="h-2 w-2 rounded-full bg-gray-500" />
              {t('filter.allNotifications')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onFilterChange('unread')}
              className="gap-2"
            >
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              {t('filter.unreadOnly')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {filter === 'all' && (
          <Badge variant="secondary" className="text-xs">
            {t('filter.showing', {value: t('filter.all')})}
          </Badge>
        )}
        {filter === 'unread' && (
          <Badge variant="default" className="text-xs">
            {t('filter.showing', {value: t('filter.unread')})}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasUnreadNotifications && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkAllAsRead}
            disabled={loading}
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
            {t('markAllAsRead')}
          </Button>
        )}
      </div>
    </div>
  )
}
