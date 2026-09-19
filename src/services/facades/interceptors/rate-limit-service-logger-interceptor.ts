import * as rateLimitServiceMethods from '../../rate-limit-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les arguments portent une adresse email en clair : ils n'ont pas leur place
 * dans les journaux.
 */
const rateLimitServiceInterceptor = createServiceInterceptor(
  rateLimitServiceMethods,
  'RATE-LIMIT-SERVICE',
  {shouldLogDetails: () => false}
)

export default rateLimitServiceInterceptor
