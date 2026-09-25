import * as siteAlertServiceMethods from '../../site-alert-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le message du bandeau est du contenu saisi par le bureau : il n'a pas sa
 * place dans les journaux, comme le pied de page.
 */
const siteAlertServiceInterceptor = createServiceInterceptor(
  siteAlertServiceMethods,
  'SITE-ALERT-SERVICE',
  {shouldLogDetails: () => false}
)

export default siteAlertServiceInterceptor
