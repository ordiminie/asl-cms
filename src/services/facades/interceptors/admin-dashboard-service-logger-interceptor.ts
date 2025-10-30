import * as adminDashboardServiceMethods from '../../admin-dashboard-service'
import {createServiceInterceptor} from './create-service-interceptor'

const adminDashboardServiceInterceptor = createServiceInterceptor(
  adminDashboardServiceMethods,
  'ADMIN-DASHBOARD-SERVICE'
)

export default adminDashboardServiceInterceptor
