import * as memberRoleServiceMethods from '../../member-role-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le nom d'un membre et l'adresse d'un compte sont des donnees personnelles :
 * ni arguments ni resultats dans les journaux. La trace des roles vit en base
 * (`member_role_event`), pas dans les logs.
 */
const memberRoleServiceInterceptor = createServiceInterceptor(
  memberRoleServiceMethods,
  'MEMBER-ROLE-SERVICE',
  {shouldLogDetails: () => false}
)

export default memberRoleServiceInterceptor
