import * as campaignServiceMethods from '../../campaign-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le contenu d'une campagne et ses destinataires sont des donnees
 * personnelles (ADR 051) : ni arguments ni resultats dans les journaux.
 */
const campaignServiceInterceptor = createServiceInterceptor(
  campaignServiceMethods,
  'CAMPAIGN-SERVICE',
  {shouldLogDetails: () => false}
)

export default campaignServiceInterceptor
