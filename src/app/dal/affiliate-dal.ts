import 'server-only'

import {cache} from 'react'

import {
  getAffiliatesWithPaginationService,
  getAffiliateTotalsService,
  getMyAffiliateCommissionsService,
  getMyAffiliateDashboardService,
} from '@/services/facades/affiliate-service-facade'
import {PaginatedResponse, Pagination} from '@/services/types/common-type'
import {
  Affiliate,
  AffiliateCommission,
  AffiliateDashboardDTO,
} from '@/services/types/domain/affiliate-types'

// Aucune de ces lectures n'est cachée : elles dépendent toutes de la session.
// Elles sont streamées derrière un <Suspense> par la page qui les consomme.

export const getMyAffiliateDashboardDal = cache(
  async (): Promise<AffiliateDashboardDTO> => getMyAffiliateDashboardService()
)

export const getMyAffiliateCommissionsDal = cache(
  async (
    pagination: Pagination
  ): Promise<PaginatedResponse<AffiliateCommission>> =>
    getMyAffiliateCommissionsService(pagination)
)

export const getAffiliatesWithPaginationDal = cache(
  async (pagination: Pagination): Promise<PaginatedResponse<Affiliate>> =>
    getAffiliatesWithPaginationService(pagination)
)

export const getAffiliateTotalsDal = cache(async (affiliateId: string) =>
  getAffiliateTotalsService(affiliateId)
)
