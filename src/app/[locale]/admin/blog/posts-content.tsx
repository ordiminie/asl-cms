import {
  checkPostPermissions,
  getAllCategoriesDal,
  getPostPermissionsDal,
  getPostsWithPaginationDal,
} from '@/app/dal/post-dal'
import {PostsManagement} from '@/components/features/admin/blog/posts-management'
import {PostFilters} from '@/services/types/domain/post-types'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
  status?: string
  categoryId?: string
}>

export default async function PostsContent({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  // Vérifier les permissions d'accès
  await checkPostPermissions()

  const searchStore = await searchParams
  const page = searchStore.page ? Number.parseInt(searchStore.page) : 1
  const limit = searchStore.limit ? Number.parseInt(searchStore.limit) : 10
  const offset = (page - 1) * limit

  // Construire les filtres
  const filters: PostFilters = {}
  if (searchStore.search) {
    filters.title = searchStore.search
  }
  if (searchStore.status) {
    filters.status = searchStore.status
  }
  if (searchStore.categoryId) {
    filters.categoryId = searchStore.categoryId
  }

  // Récupérer les données en parallèle
  const [posts, categories, permissions] = await Promise.all([
    getPostsWithPaginationDal({limit, offset}, filters),
    getAllCategoriesDal(),
    getPostPermissionsDal(),
  ])

  return (
    <PostsManagement
      initialPosts={posts.data}
      currentPage={page}
      pageSize={limit}
      totalItems={posts.pagination.total}
      categories={categories}
      permissions={permissions}
      initialFilters={{
        search: searchStore.search || '',
        status: searchStore.status || '',
        categoryId: searchStore.categoryId || '',
      }}
    />
  )
}
