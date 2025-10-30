import * as usersServiceMethods from '../../user-service'
import {createServiceInterceptor} from './create-service-interceptor'

const userServiceInterceptor = createServiceInterceptor(
  usersServiceMethods,
  'USER-SERVICE'
)

export default userServiceInterceptor
