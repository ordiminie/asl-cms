import * as postServiceMethods from '../../post-service'
import {createServiceInterceptor} from './create-service-interceptor'

const postServiceInterceptor = createServiceInterceptor(
  postServiceMethods,
  'POST-SERVICE'
)

export default postServiceInterceptor
