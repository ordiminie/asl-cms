import subscriptionServiceInterceptor from './interceptors/subscription-service-logger-interceptor'

// ========================================
// SERVICES DE SUBSCRIPTION
// ========================================
export const createSubscriptionFromStripeService =
  subscriptionServiceInterceptor.createSubscriptionFromStripeService
export const getSubscriptionByIdService =
  subscriptionServiceInterceptor.getSubscriptionByIdService
export const updateSubscriptionService =
  subscriptionServiceInterceptor.updateSubscriptionService
export const isPlanExistService =
  subscriptionServiceInterceptor.isPlanExistService
export const getActiveSubscriptionsByUserEmailService =
  subscriptionServiceInterceptor.getActiveSubscriptionsByUserEmailService
export const getSubscriptionByUserIdService =
  subscriptionServiceInterceptor.getSubscriptionByUserIdService
export const initSubscriptionService =
  subscriptionServiceInterceptor.initSubscriptionService
export const updateSubscriptionForWebhookService =
  subscriptionServiceInterceptor.updateSubscriptionForWebhookService
export const getBillingContext =
  subscriptionServiceInterceptor.getBillingContext

// ========================================
// SERVICES DE PLANS
// ========================================
export const createPlanService =
  subscriptionServiceInterceptor.createPlanService
export const getPlanByIdService =
  subscriptionServiceInterceptor.getPlanByIdService
export const getPlanByCodeService =
  subscriptionServiceInterceptor.getPlanByCodeService
export const getPlanByCodePublicService =
  subscriptionServiceInterceptor.getPlanByCodePublicService
export const getPlanByPriceIdService =
  subscriptionServiceInterceptor.getPlanByPriceIdService
export const getPlanByPriceIdPublicService =
  subscriptionServiceInterceptor.getPlanByPriceIdPublicService
export const getActivePlansService =
  subscriptionServiceInterceptor.getActivePlansService
export const getPlansWithPaginationService =
  subscriptionServiceInterceptor.getPlansWithPaginationService
export const updatePlanService =
  subscriptionServiceInterceptor.updatePlanService
export const softDeletePlanService =
  subscriptionServiceInterceptor.softDeletePlanService
export const deletePlanService =
  subscriptionServiceInterceptor.deletePlanService
export const isPlanNameExistService =
  subscriptionServiceInterceptor.isPlanNameExistService
export const isPriceIdExistService =
  subscriptionServiceInterceptor.isPriceIdExistService
export const getActivePlansForBetterAuthService =
  subscriptionServiceInterceptor.getActivePlansForBetterAuthService
export const isYearlyPriceService =
  subscriptionServiceInterceptor.isYearlyPriceService

// ========================================
// SERVICES DE SUBSCRIPTIONS ADMIN
// ========================================
export const getSubscriptionsWithPaginationService =
  subscriptionServiceInterceptor.getSubscriptionsWithPaginationService
export const cancelSubscriptionAdminService =
  subscriptionServiceInterceptor.cancelSubscriptionAdminService
export const reactivateSubscriptionAdminService =
  subscriptionServiceInterceptor.reactivateSubscriptionAdminService

// ========================================
// SERVICES DE STATISTIQUES MRR ADMIN
// ========================================
export const getAdminStripeSubscriptionMRRService =
  subscriptionServiceInterceptor.getAdminStripeSubscriptionMRRService

// ========================================
// SERVICES DE LIMITES EFFECTIVES
// ========================================
export const getEffectiveLimitsService =
  subscriptionServiceInterceptor.getEffectiveLimitsService
export const getEffectiveLimitForType =
  subscriptionServiceInterceptor.getEffectiveLimitForType
