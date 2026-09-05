import {
  getPlanAdminPermissionsDal,
  getPlansWithPaginationDal,
} from '@/app/dal/subscription-dal'
import PlansManagement from '@/components/features/admin/plans/plans-management'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

export default async function PlansContent({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const searchStore = await searchParams
  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 20
  const search = searchStore.search || ''
  const offset = (page - 1) * limit

  const [plans, permissions] = await Promise.all([
    getPlansWithPaginationDal({limit, offset}, search),
    getPlanAdminPermissionsDal(),
  ])

  return (
    <PlansManagement
      initialPlans={plans.data}
      currentPage={page}
      pageSize={limit}
      totalPlans={plans.pagination.total}
      permissions={permissions}
      searchQuery={search}
    />
  )
}
