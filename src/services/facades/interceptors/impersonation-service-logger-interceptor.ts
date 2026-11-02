import * as impersonationServiceMethods from '../../impersonation-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le nom d'un compte et le motif saisi sont des donnees personnelles : ni
 * arguments ni resultats dans les journaux. La trace vit en base
 * (`impersonation_event`), pas dans les logs.
 */
const impersonationServiceInterceptor = createServiceInterceptor(
  impersonationServiceMethods,
  'IMPERSONATION-SERVICE',
  {shouldLogDetails: () => false}
)

export default impersonationServiceInterceptor
