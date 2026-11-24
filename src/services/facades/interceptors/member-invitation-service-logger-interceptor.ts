import * as memberInvitationServiceMethods from '../../member-invitation-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Une invitation porte les adresses d'un proprietaire et, en chemin, son lien
 * de connexion : ni arguments ni resultats dans les journaux (s42a).
 */
const memberInvitationServiceInterceptor = createServiceInterceptor(
  memberInvitationServiceMethods,
  'MEMBER-INVITATION-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberInvitationServiceInterceptor
