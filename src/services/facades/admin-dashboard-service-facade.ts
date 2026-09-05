import adminDashboardServiceInterceptor from './interceptors/admin-dashboard-service-logger-interceptor'

// Mapping de toutes les fonctions du service dans la façade
export const getDashboardStatsService =
  adminDashboardServiceInterceptor.getDashboardStatsService
export const getDashboardStatsWithParamsService =
  adminDashboardServiceInterceptor.getDashboardStatsWithParamsService
