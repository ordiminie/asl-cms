import affiliateServiceInterceptor from './interceptors/affiliate-service-logger-interceptor'

// ========================================
// ESPACE AFFILIÉ
// ========================================
export const getMyAffiliateService =
  affiliateServiceInterceptor.getMyAffiliateService
export const setMyAffiliateCodeService =
  affiliateServiceInterceptor.setMyAffiliateCodeService
export const getMyAffiliateDashboardService =
  affiliateServiceInterceptor.getMyAffiliateDashboardService
export const getMyAffiliateCommissionsService =
  affiliateServiceInterceptor.getMyAffiliateCommissionsService

// ========================================
// ATTRIBUTION
// ========================================
export const attributeReferralForOrganizationService =
  affiliateServiceInterceptor.attributeReferralForOrganizationService

// ========================================
// WEBHOOK
// ========================================
export const recordBountyForPaidInvoiceService =
  affiliateServiceInterceptor.recordBountyForPaidInvoiceService
export const refundBountyBySourceService =
  affiliateServiceInterceptor.refundBountyBySourceService
export const refundBountyByPaymentIntentService =
  affiliateServiceInterceptor.refundBountyByPaymentIntentService
export const approveMaturedCommissionsService =
  affiliateServiceInterceptor.approveMaturedCommissionsService

// ========================================
// ADMINISTRATION
// ========================================
export const getAffiliatesWithPaginationService =
  affiliateServiceInterceptor.getAffiliatesWithPaginationService
export const getAffiliateTotalsService =
  affiliateServiceInterceptor.getAffiliateTotalsService
export const markAffiliatePayoutPaidService =
  affiliateServiceInterceptor.markAffiliatePayoutPaidService
