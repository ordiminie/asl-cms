import * as memberSpaceServiceMethods from '../../member-space-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les resultats nomment un proprietaire, ses parcelles et ses factures : ni
 * arguments ni resultats dans les journaux.
 */
const memberSpaceServiceInterceptor = createServiceInterceptor(
  memberSpaceServiceMethods,
  'MEMBER-SPACE-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberSpaceServiceInterceptor
