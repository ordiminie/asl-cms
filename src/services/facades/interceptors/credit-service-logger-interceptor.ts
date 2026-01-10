import * as creditServiceMethods from '../../credit-service'
import {createServiceInterceptor} from './create-service-interceptor'

const creditServiceInterceptor = createServiceInterceptor(
  creditServiceMethods,
  'CREDIT-SERVICE'
)

export default creditServiceInterceptor
