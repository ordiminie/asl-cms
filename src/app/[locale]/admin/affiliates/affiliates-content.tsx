import {
  getAffiliatesWithPaginationDal,
  getAffiliateTotalsDal,
} from '@/app/dal/affiliate-dal'
import {AffiliatesManagement} from '@/components/features/admin/affiliates/affiliates-management'

type AffiliatesContentProps = {
  searchParams: Promise<{page?: string; limit?: string}>
}

export async function AffiliatesContent({
  searchParams,
}: AffiliatesContentProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 20
  const offset = (page - 1) * limit

  const result = await getAffiliatesWithPaginationDal({limit, offset})

  const rows = await Promise.all(
    result.data.map(async (affiliate) => {
      const totals = await getAffiliateTotalsDal(affiliate.id)
      return {
        affiliateId: affiliate.id,
        userId: affiliate.userId,
        code: affiliate.code,
        status: affiliate.status,
        currency: 'USD',
        ...totals,
      }
    })
  )

  return (
    <AffiliatesManagement
      rows={rows}
      currentPage={result.pagination.page}
      totalPages={result.pagination.totalPages}
      total={result.pagination.total}
    />
  )
}
