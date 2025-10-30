import * as notificationServiceMethods from '../../notification-service'
import {createServiceInterceptor} from './create-service-interceptor'

const notificationServiceInterceptor = createServiceInterceptor(
  notificationServiceMethods,
  'NOTIFICATION-SERVICE'
)

export default notificationServiceInterceptor
