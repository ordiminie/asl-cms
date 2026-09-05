import * as projectServiceMethods from '../../project-service'
import {createServiceInterceptor} from './create-service-interceptor'

const projectServiceInterceptor = createServiceInterceptor(
  projectServiceMethods,
  'PROJECT-SERVICE'
)

export default projectServiceInterceptor
