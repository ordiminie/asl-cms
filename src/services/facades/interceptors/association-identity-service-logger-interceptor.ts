import * as associationIdentityServiceMethods from '../../association-identity-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les arguments portent un fichier et le resultat de la lecture son contenu :
 * rien de tout cela n'a sa place dans les journaux.
 */
const associationIdentityServiceInterceptor = createServiceInterceptor(
  associationIdentityServiceMethods,
  'ASSOCIATION-IDENTITY-SERVICE',
  {shouldLogDetails: () => false}
)

export default associationIdentityServiceInterceptor
