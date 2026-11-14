import * as memberQuestionServiceMethods from '../../member-question-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le texte d'une question et l'identite du membre sont des donnees
 * personnelles : ni arguments ni resultats dans les journaux.
 */
const memberQuestionServiceInterceptor = createServiceInterceptor(
  memberQuestionServiceMethods,
  'MEMBER-QUESTION-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberQuestionServiceInterceptor
