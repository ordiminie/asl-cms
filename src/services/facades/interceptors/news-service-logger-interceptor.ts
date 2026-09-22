import * as newsServiceMethods from '../../news-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Le contenu d'une actualite peut etre volumineux (markdown, fichier
 * d'image) : il n'a pas sa place dans les journaux.
 */
const newsServiceInterceptor = createServiceInterceptor(
  newsServiceMethods,
  'NEWS-SERVICE',
  {shouldLogDetails: () => false}
)

export default newsServiceInterceptor
