import pageServiceInterceptor from './interceptors/page-service-logger-interceptor'

export const canManagePagesService =
  pageServiceInterceptor.canManagePagesService
export const createPageService = pageServiceInterceptor.createPageService
export const getPageBySlugService = pageServiceInterceptor.getPageBySlugService
export const getPageForBureauService =
  pageServiceInterceptor.getPageForBureauService
export const getPagesForBureauService =
  pageServiceInterceptor.getPagesForBureauService
export const publishPageService = pageServiceInterceptor.publishPageService
export const unpublishPageService = pageServiceInterceptor.unpublishPageService
export const updatePageService = pageServiceInterceptor.updatePageService
export const uploadPageBlockFileService =
  pageServiceInterceptor.uploadPageBlockFileService
