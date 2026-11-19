import * as pennylaneSyncServiceMethods from '../../pennylane-sync-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Ni arguments ni resultats dans les journaux (s20, ADR 062) : une
 * synchronisation porte des noms de clients et des references.
 */
const pennylaneSyncServiceInterceptor = createServiceInterceptor(
  pennylaneSyncServiceMethods,
  'PENNYLANE-SYNC-SERVICE',
  {shouldLogDetails: () => false}
)

export default pennylaneSyncServiceInterceptor
