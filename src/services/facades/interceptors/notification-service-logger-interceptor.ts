import * as notificationServiceMethods from '../../notification-service'
import {NotificationTypeConst} from '../../types/domain/notification-types'
import {createServiceInterceptor} from './create-service-interceptor'

const notificationServiceInterceptor = createServiceInterceptor(
  notificationServiceMethods,
  'NOTIFICATION-SERVICE',
  {
    shouldLogDetails: (methodName, args) =>
      methodName !== 'createTypedNotificationService' ||
      (args[0] as {type?: unknown} | undefined)?.type !==
        NotificationTypeConst.magic_link,
  }
)

export default notificationServiceInterceptor
