import * as campaignLetterServiceMethods from '../../campaign-letter-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le courrier porte noms et domiciles des membres (s28) : ni arguments ni
 * resultats dans les journaux, comme les campagnes (ADR 051).
 */
const campaignLetterServiceInterceptor = createServiceInterceptor(
  campaignLetterServiceMethods,
  'CAMPAIGN-LETTER-SERVICE',
  {shouldLogDetails: () => false}
)

export default campaignLetterServiceInterceptor
