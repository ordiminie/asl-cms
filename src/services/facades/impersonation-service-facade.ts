import impersonationServiceInterceptor from './interceptors/impersonation-service-logger-interceptor'

export const openImpersonationService =
  impersonationServiceInterceptor.openImpersonationService
export const stopImpersonationService =
  impersonationServiceInterceptor.stopImpersonationService
