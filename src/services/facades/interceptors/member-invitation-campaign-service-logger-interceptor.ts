import * as memberInvitationCampaignServiceMethods from '../../member-invitation-campaign-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le lancement des invitations porte les adresses des proprietaires et, a la
 * livraison, leur lien de connexion : ni arguments ni resultats dans les
 * journaux (s42b, ADR 072 §8).
 */
const memberInvitationCampaignServiceInterceptor = createServiceInterceptor(
  memberInvitationCampaignServiceMethods,
  'MEMBER-INVITATION-CAMPAIGN-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberInvitationCampaignServiceInterceptor
