import * as newsletterServiceMethods from '../../newsletter-service'
import {createServiceInterceptor} from './create-service-interceptor'

const newsletterServiceInterceptor = createServiceInterceptor(
  newsletterServiceMethods,
  'NEWSLETTER-SERVICE'
)

export default newsletterServiceInterceptor
