import * as recipientGroupServiceMethods from '../../recipient-group-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les groupes nomment des personnes (fiches) et leurs noms peuvent en dire
 * long : ni arguments ni resultats dans les journaux (ADR 060).
 */
const recipientGroupServiceInterceptor = createServiceInterceptor(
  recipientGroupServiceMethods,
  'RECIPIENT-GROUP-SERVICE',
  {shouldLogDetails: () => false}
)

export default recipientGroupServiceInterceptor
