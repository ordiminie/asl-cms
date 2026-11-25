import * as documentTemplateServiceMethods from '../../document-template-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Un document produit porte le nom, l'adresse et les parcelles d'un membre ;
 * un lot porte des fiches : rien de tout cela n'a sa place dans les journaux
 * (ADR 047, ADR 074).
 */
const documentTemplateServiceInterceptor = createServiceInterceptor(
  documentTemplateServiceMethods,
  'DOCUMENT-TEMPLATE-SERVICE',
  {shouldLogDetails: () => false}
)

export default documentTemplateServiceInterceptor
