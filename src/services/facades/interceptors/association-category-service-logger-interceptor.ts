import * as associationCategoryServiceMethods from '../../association-category-service'
import {createServiceInterceptor} from './create-service-interceptor'

const associationCategoryServiceInterceptor = createServiceInterceptor(
  associationCategoryServiceMethods,
  'ASSOCIATION-CATEGORY-SERVICE'
)

export default associationCategoryServiceInterceptor
