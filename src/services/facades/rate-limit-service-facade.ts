import rateLimitServiceInterceptor from './interceptors/rate-limit-service-logger-interceptor'

export const consumeMagicLinkRequestQuotaService =
  rateLimitServiceInterceptor.consumeMagicLinkRequestQuotaService
