import * as subscriptionServiceMethods from '../../subscription-service'
import {createServiceInterceptor} from './create-service-interceptor'

const subscriptionServiceInterceptor = createServiceInterceptor(
  subscriptionServiceMethods,
  'SUBSCRIPTION-SERVICE'
)

export default subscriptionServiceInterceptor
