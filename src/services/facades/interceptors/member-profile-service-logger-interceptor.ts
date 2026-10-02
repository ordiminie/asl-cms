import * as memberProfileServiceMethods from '../../member-profile-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le nom, l'adresse postale, le telephone et l'email d'un proprietaire sont
 * des donnees personnelles : ni arguments ni resultats dans les journaux.
 */
const memberProfileServiceInterceptor = createServiceInterceptor(
  memberProfileServiceMethods,
  'MEMBER-PROFILE-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberProfileServiceInterceptor
