import * as sharedDocumentServiceMethods from '../../shared-document-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Un depot transporte un fichier, une lecture rend son contenu : ni l'un ni
 * l'autre n'a sa place dans les journaux.
 */
const sharedDocumentServiceInterceptor = createServiceInterceptor(
  sharedDocumentServiceMethods,
  'SHARED-DOCUMENT-SERVICE',
  {shouldLogDetails: () => false}
)

export default sharedDocumentServiceInterceptor
