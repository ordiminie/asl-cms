import * as organizationServiceMethods from '../../organization-service'
import {createServiceInterceptor} from './create-service-interceptor'

const organizationServiceInterceptor = createServiceInterceptor(
  organizationServiceMethods,
  'ORGANIZATION-SERVICE'
)

export default organizationServiceInterceptor
