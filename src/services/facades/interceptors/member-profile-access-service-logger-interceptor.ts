import * as memberProfileAccessServiceMethods from '../../member-profile-access-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les arguments portent l'identifiant d'un compte et les fiches lues des
 * données nominatives : ils n'ont pas leur place dans les journaux.
 */
const memberProfileAccessServiceInterceptor = createServiceInterceptor(
  memberProfileAccessServiceMethods,
  'MEMBER-PROFILE-ACCESS-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberProfileAccessServiceInterceptor
