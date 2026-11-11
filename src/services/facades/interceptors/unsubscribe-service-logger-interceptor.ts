import * as unsubscribeServiceMethods from '../../unsubscribe-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le jeton de desinscription est le seul titre du membre (ADR 051) : ni
 * arguments ni resultats dans les journaux.
 */
const unsubscribeServiceInterceptor = createServiceInterceptor(
  unsubscribeServiceMethods,
  'UNSUBSCRIBE-SERVICE',
  {shouldLogDetails: () => false}
)

export default unsubscribeServiceInterceptor
