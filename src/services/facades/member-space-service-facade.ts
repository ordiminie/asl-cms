import memberSpaceServiceInterceptor from './interceptors/member-space-service-logger-interceptor'

export const getMyParcelsService =
  memberSpaceServiceInterceptor.getMyParcelsService
export const isPlainMemberOfService =
  memberSpaceServiceInterceptor.isPlainMemberOfService
export const getMyContactService =
  memberSpaceServiceInterceptor.getMyContactService
export const updateMyContactService =
  memberSpaceServiceInterceptor.updateMyContactService
