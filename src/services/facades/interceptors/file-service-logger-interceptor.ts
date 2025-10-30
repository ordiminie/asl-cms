import * as fileServiceMethods from '../../file-service'
import {createServiceInterceptor} from './create-service-interceptor'

const fileServiceInterceptor = createServiceInterceptor(
  fileServiceMethods,
  'FILE-SERVICE'
)

export default fileServiceInterceptor
