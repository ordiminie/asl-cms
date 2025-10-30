import * as emailServiceMethods from '../../email-service'
import {createServiceInterceptor} from './create-service-interceptor'

const emailServiceInterceptor = createServiceInterceptor(
  emailServiceMethods,
  'EMAIL-SERVICE'
)

export default emailServiceInterceptor
