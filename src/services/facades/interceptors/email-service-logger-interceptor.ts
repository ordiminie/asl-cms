import * as emailServiceMethods from '../../email-service'
import {createServiceInterceptor} from './create-service-interceptor'

const emailServiceInterceptor = createServiceInterceptor(
  emailServiceMethods,
  'EMAIL-SERVICE',
  {
    shouldLogDetails: (methodName) =>
      methodName !== 'sendMagicLinkEmailService',
  }
)

export default emailServiceInterceptor
