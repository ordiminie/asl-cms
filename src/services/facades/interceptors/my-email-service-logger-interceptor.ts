import * as myEmailServiceMethods from '../../my-email-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les adresses d'un membre sont des donnees personnelles, et un lien de
 * confirmation en est le titre (s54) : ni arguments ni resultats dans les
 * journaux.
 */
const myEmailServiceInterceptor = createServiceInterceptor(
  myEmailServiceMethods,
  'MY-EMAIL-SERVICE',
  {shouldLogDetails: () => false}
)

export default myEmailServiceInterceptor
