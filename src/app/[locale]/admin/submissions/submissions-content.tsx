import {
  getAllUserSubmissionsWithPaginationDal,
  getUserSubmissionPermissionsDal,
} from '@/app/dal/user-submission-dal'
import SubmissionsManagement from '@/components/features/admin/submissions/submissions-management'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
  type?: 'contact' | 'feedback' | 'support'
  read?: string
}>

export default async function SubmissionsContent({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const searchStore = await searchParams
  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 20
  const search = searchStore.search || ''
  const type = searchStore.type
  const read =
    searchStore.read === 'true'
      ? true
      : searchStore.read === 'false'
        ? false
        : undefined
  const offset = (page - 1) * limit

  const [submissions, permissions] = await Promise.all([
    getAllUserSubmissionsWithPaginationDal(
      {limit, offset},
      {type, read, search}
    ),
    getUserSubmissionPermissionsDal(),
  ])

  return (
    <SubmissionsManagement
      initialSubmissions={submissions.data}
      currentPage={page}
      pageSize={limit}
      totalSubmissions={submissions.pagination.total}
      permissions={permissions}
      searchQuery={search}
      typeFilter={type}
      readFilter={read}
    />
  )
}
