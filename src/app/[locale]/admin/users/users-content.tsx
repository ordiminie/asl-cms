import {
  getAllUsersWithPaginationDal,
  getUserPermissionsDal,
} from '@/app/dal/user-dal'
import UsersManagement from '@/components/features/admin/users/users-management'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

export default async function UsersContent({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const searchStore = await searchParams
  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 20
  const search = searchStore.search || ''
  const offset = (page - 1) * limit

  const [users, permissions] = await Promise.all([
    getAllUsersWithPaginationDal({limit, offset}, search),
    getUserPermissionsDal(),
  ])

  return (
    <UsersManagement
      initialUsers={users.data}
      currentPage={page}
      pageSize={limit}
      totalUsers={users.pagination.total}
      permissions={permissions}
      searchQuery={search}
    />
  )
}
