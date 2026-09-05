import * as userSubmissionServiceMethods from '../../user-submission-service'
import {createServiceInterceptor} from './create-service-interceptor'

const userSubmissionServiceInterceptor = createServiceInterceptor(
  userSubmissionServiceMethods,
  'USER-SUBMISSION-SERVICE'
)

export default userSubmissionServiceInterceptor
