import parcelOwnershipServiceInterceptor from './interceptors/parcel-ownership-service-logger-interceptor'

export const attachParcelService =
  parcelOwnershipServiceInterceptor.attachParcelService
export const getMemberParcelsService =
  parcelOwnershipServiceInterceptor.getMemberParcelsService
export const getParcelOwnerAtService =
  parcelOwnershipServiceInterceptor.getParcelOwnerAtService
export const getSaleContextService =
  parcelOwnershipServiceInterceptor.getSaleContextService
export const recordSaleService =
  parcelOwnershipServiceInterceptor.recordSaleService
