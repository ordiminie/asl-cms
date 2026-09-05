import {redirect} from 'next/navigation'

import {getUnreadNotificationsForUser} from '@/app/dal/notification-dal'
import NotificationsManagement from '@/components/features/notifications/notifications-management'
import {getAuthUser} from '@/services/authentication/auth-service'

export default async function NotificationsContent() {
  const authUser = await getAuthUser()

  if (!authUser) {
    redirect('/login')
  }

  // Récupérer les notifications avec pagination par défaut
  const notificationsData = await getUnreadNotificationsForUser(authUser.id, {
    limit: 20,
    offset: 0,
  })

  return (
    <NotificationsManagement
      initialData={notificationsData}
      userId={authUser.id}
    />
  )
}
