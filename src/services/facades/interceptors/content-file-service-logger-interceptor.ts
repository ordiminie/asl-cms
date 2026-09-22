import * as contentFileServiceMethods from '../../content-file-service'
import {createServiceInterceptor} from './create-service-interceptor'

/** Le contenu d'un fichier n'a pas sa place dans les journaux. */
const contentFileServiceInterceptor = createServiceInterceptor(
  contentFileServiceMethods,
  'CONTENT-FILE-SERVICE',
  {shouldLogDetails: () => false}
)

export default contentFileServiceInterceptor
