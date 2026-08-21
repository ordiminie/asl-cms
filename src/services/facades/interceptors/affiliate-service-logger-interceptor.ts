import * as affiliateServiceMethods from '../../affiliate-service'
import {createServiceInterceptor} from './create-service-interceptor'

const affiliateServiceInterceptor = createServiceInterceptor(
  affiliateServiceMethods,
  'AFFILIATE-SERVICE'
)

export default affiliateServiceInterceptor
