import homePageServiceInterceptor from './interceptors/home-page-service-logger-interceptor'

export const canManageHomePageService =
  homePageServiceInterceptor.canManageHomePageService
export const getHomePageForBureauService =
  homePageServiceInterceptor.getHomePageForBureauService
export const getPublicHomePageService =
  homePageServiceInterceptor.getPublicHomePageService
export const setHomePageService = homePageServiceInterceptor.setHomePageService
