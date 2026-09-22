import * as siteNavigationServiceMethods from '../../site-navigation-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le contenu du pied de page peut etre volumineux (texte riche) : il n'a pas sa
 * place dans les journaux, comme le contenu d'une page.
 */
const siteNavigationServiceInterceptor = createServiceInterceptor(
  siteNavigationServiceMethods,
  'SITE-NAVIGATION-SERVICE',
  {shouldLogDetails: () => false}
)

export default siteNavigationServiceInterceptor
