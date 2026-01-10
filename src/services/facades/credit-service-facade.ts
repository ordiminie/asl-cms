import creditServiceInterceptor from './interceptors/credit-service-logger-interceptor'

// ========================================
// BALANCE & READ OPERATIONS
// ========================================
export const getBalanceService = creditServiceInterceptor.getBalanceService
export const getCreditBalanceService =
  creditServiceInterceptor.getCreditBalanceService
export const canConsumeService = creditServiceInterceptor.canConsumeService
export const getUsageGraphDataService =
  creditServiceInterceptor.getUsageGraphDataService
export const getRecentActivityService =
  creditServiceInterceptor.getRecentActivityService

// ========================================
// CONSUME OPERATIONS
// ========================================
export const consumeService = creditServiceInterceptor.consumeService
export const refundCreditsService =
  creditServiceInterceptor.refundCreditsService

// ========================================
// ALLOCATION OPERATIONS
// ========================================
export const allocateMonthlyCreditsService =
  creditServiceInterceptor.allocateMonthlyCreditsService

// ========================================
// GRANT OPERATIONS (ADMIN ONLY)
// ========================================
export const grantCreditsService = creditServiceInterceptor.grantCreditsService

// ========================================
// PACK PURCHASE OPERATIONS
// ========================================
export const getCreditPacksService =
  creditServiceInterceptor.getCreditPacksService
export const purchaseCreditPackService =
  creditServiceInterceptor.purchaseCreditPackService
export const completeCreditPackPurchaseService =
  creditServiceInterceptor.completeCreditPackPurchaseService

// ========================================
// ADMIN STATS OPERATIONS
// ========================================
export const canViewAdminCreditsStatsService =
  creditServiceInterceptor.canViewAdminCreditsStatsService
