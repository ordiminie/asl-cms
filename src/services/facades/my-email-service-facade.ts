import myEmailServiceInterceptor from './interceptors/my-email-service-logger-interceptor'

export const getMyEmailsService = myEmailServiceInterceptor.getMyEmailsService
export const addMyEmailService = myEmailServiceInterceptor.addMyEmailService
export const updateMyEmailService =
  myEmailServiceInterceptor.updateMyEmailService
export const correctMyPendingEmailService =
  myEmailServiceInterceptor.correctMyPendingEmailService
export const cancelMyPendingEmailService =
  myEmailServiceInterceptor.cancelMyPendingEmailService
