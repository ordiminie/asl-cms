import * as pageServiceMethods from '../../page-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le contenu d'une page peut etre volumineux (blocs, markdown) : il n'a pas sa
 * place dans les journaux.
 */
const pageServiceInterceptor = createServiceInterceptor(
  pageServiceMethods,
  'PAGE-SERVICE',
  {shouldLogDetails: () => false}
)

export default pageServiceInterceptor
