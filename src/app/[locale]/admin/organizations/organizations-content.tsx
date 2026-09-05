import {
  getAllOrganizationsWithPaginationDal,
  getOrganizationAdminPermissionsDal,
} from '@/app/dal/organization-dal'
import OrganizationsManagement from '@/components/features/admin/organizations/organizations-management'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
}>

export default async function OrganizationsContent({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const searchStore = await searchParams
  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 20
  const search = searchStore.search || ''
  const offset = (page - 1) * limit

  const [organizations, permissions] = await Promise.all([
    getAllOrganizationsWithPaginationDal({limit, offset}, search),
    getOrganizationAdminPermissionsDal(),
  ])

  return (
    <OrganizationsManagement
      initialOrganizations={organizations.data}
      currentPage={page}
      pageSize={limit}
      totalOrganizations={organizations.pagination.total}
      permissions={permissions}
      searchQuery={search}
    />
  )
}
