import {getUserByEmailDao} from '@/db/repositories/user-repository'
import {sendMagicLinkEmailService} from '@/services/facades/email-service-facade'
import {createTypedNotificationService} from '@/services/facades/notification-service-facade'
import {NotificationTypeConst} from '@/services/types/domain/notification-types'

type SendMagicLinkData = {
  email: string
  url: string
}

export async function sendMagicLink({email, url}: SendMagicLinkData) {
  const user = await getUserByEmailDao(email)

  if (!user) {
    await sendMagicLinkEmailService({email, url})
    return
  }

  await createTypedNotificationService({
    userId: user.id,
    type: NotificationTypeConst.magic_link,
    metadata: {url, email},
  })
}
