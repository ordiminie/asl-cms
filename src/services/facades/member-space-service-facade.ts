import memberSpaceServiceInterceptor from './interceptors/member-space-service-logger-interceptor'

export const getMyLandsService = memberSpaceServiceInterceptor.getMyLandsService
export const isPlainMemberOfService =
  memberSpaceServiceInterceptor.isPlainMemberOfService
export const getMyContactService =
  memberSpaceServiceInterceptor.getMyContactService
export const updateMyContactService =
  memberSpaceServiceInterceptor.updateMyContactService
export const getMyInvoicesService =
  memberSpaceServiceInterceptor.getMyInvoicesService
