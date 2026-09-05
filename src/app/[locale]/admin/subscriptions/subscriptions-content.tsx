import {
  getSubscriptionAdminPermissionsDal,
  getSubscriptionsWithPaginationDal,
} from '@/app/dal/subscription-dal'
import SubscriptionsManagement from '@/components/features/admin/subscriptions/subscriptions-management'
import {DATA_ROWS_PER_PAGE} from '@/lib/constants'

interface SubscriptionsContentProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
  }>
}

export async function SubscriptionsContent({
  searchParams,
}: SubscriptionsContentProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const limit = Number(params.limit) || DATA_ROWS_PER_PAGE

  const pagination = {
    offset: (page - 1) * limit,
    limit,
  }

  const [subscriptionsData, permissions] = await Promise.all([
    getSubscriptionsWithPaginationDal(pagination, search),
    getSubscriptionAdminPermissionsDal(),
  ])

  return (
    <SubscriptionsManagement
      initialSubscriptions={subscriptionsData.data}
      currentPage={page}
      pageSize={limit}
      totalSubscriptions={subscriptionsData.pagination.total}
      permissions={permissions}
      searchQuery={search}
    />
  )
}
