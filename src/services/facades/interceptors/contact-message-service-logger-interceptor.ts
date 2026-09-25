import * as contactMessageServiceMethods from '../../contact-message-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le corps d'un message et l'adresse de son auteur sont des donnees
 * personnelles : ni arguments ni resultats dans les journaux.
 */
const contactMessageServiceInterceptor = createServiceInterceptor(
  contactMessageServiceMethods,
  'CONTACT-MESSAGE-SERVICE',
  {shouldLogDetails: () => false}
)

export default contactMessageServiceInterceptor
