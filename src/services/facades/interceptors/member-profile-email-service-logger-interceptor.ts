import * as memberProfileEmailServiceMethods from '../../member-profile-email-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les adresses d'une fiche sont des donnees personnelles (s54) : ni
 * arguments ni resultats dans les journaux.
 */
const memberProfileEmailServiceInterceptor = createServiceInterceptor(
  memberProfileEmailServiceMethods,
  'MEMBER-PROFILE-EMAIL-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberProfileEmailServiceInterceptor
