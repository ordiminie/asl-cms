import * as homePageServiceMethods from '../../home-page-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * La page rendue est du contenu saisi par le bureau : elle n'a pas sa place
 * dans les journaux, comme les pages et le pied de page.
 */
const homePageServiceInterceptor = createServiceInterceptor(
  homePageServiceMethods,
  'HOME-PAGE-SERVICE',
  {shouldLogDetails: () => false}
)

export default homePageServiceInterceptor
