import * as emailSendingServiceMethods from '../../email-sending-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le resultat ne porte ni adresse ni contenu ; il reste hors des journaux par
 * prudence, comme les autres lectures du bureau.
 */
const emailSendingServiceInterceptor = createServiceInterceptor(
  emailSendingServiceMethods,
  'EMAIL-SENDING-SERVICE',
  {shouldLogDetails: () => false}
)

export default emailSendingServiceInterceptor
