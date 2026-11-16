import * as memberEmailConfirmationServiceMethods from '../../member-email-confirmation-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le jeton de confirmation est le seul titre de la page publique (s54) :
 * jamais dans les journaux, ni en argument ni en resultat.
 */
const memberEmailConfirmationServiceInterceptor = createServiceInterceptor(
  memberEmailConfirmationServiceMethods,
  'MEMBER-EMAIL-CONFIRMATION-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberEmailConfirmationServiceInterceptor
