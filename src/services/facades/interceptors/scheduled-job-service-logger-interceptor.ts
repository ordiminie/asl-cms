import * as scheduledJobServiceMethods from '../../scheduled-job-service'
import {createServiceInterceptor} from './create-service-interceptor'

/**
 * Les arguments d'un passage portent les gestionnaires et leurs taches : ni
 * arguments ni resultats dans les journaux (s26, ADR 052).
 */
const scheduledJobServiceInterceptor = createServiceInterceptor(
  scheduledJobServiceMethods,
  'SCHEDULED-JOB-SERVICE',
  {shouldLogDetails: () => false}
)

export default scheduledJobServiceInterceptor
