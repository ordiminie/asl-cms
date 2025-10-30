'use client'

import {useEffect, useRef, useState} from 'react'

import {useAuth} from '@/components/context/auth-provider'

/**
 * Hook pour récupérer le nombre de notifications non lues
 */
export function useUnreadNotifications() {
  const {user} = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading] = useState(false)
  const notificationsRef = useRef(user?.notifications)

  useEffect(() => {
    notificationsRef.current = user?.notifications
  }, [user?.notifications])

  useEffect(() => {
    // Si on a les notifications dans l'user, compter celles non lues
    if (notificationsRef.current) {
      const unreadNotifications = notificationsRef.current.filter(
        (notification) => !notification.read
      )
      const newCount = unreadNotifications.length
      setUnreadCount((prev) => (prev !== newCount ? newCount : prev))
      return
    }

    // Sinon, on garde 0
    setUnreadCount((prev) => (prev !== 0 ? 0 : prev))
  }, [user?.notifications])

  // Fonction pour mettre à jour le count manuellement
  const updateUnreadCount = (newCount: number) => {
    setUnreadCount(newCount)
  }

  const decrementUnreadCount = () => {
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  return {unreadCount, loading, updateUnreadCount, decrementUnreadCount}
}
