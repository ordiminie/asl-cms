import * as memberDocumentServiceMethods from '../../member-document-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Un depot transporte un fichier, une lecture rend son contenu, un lot porte
 * des noms de fichiers et de membres : rien de tout cela n'a sa place dans
 * les journaux (ADR 047, ADR 073).
 */
const memberDocumentServiceInterceptor = createServiceInterceptor(
  memberDocumentServiceMethods,
  'MEMBER-DOCUMENT-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberDocumentServiceInterceptor
